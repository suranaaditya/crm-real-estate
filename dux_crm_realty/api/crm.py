"""Whitelisted API for the Shradha CRM React app.

Design principle (borrowed from dux_cybervidya): the UI is unchanged from the
design prototype — the only substitution is the data source. ``get_bootstrap``
returns the entire live dataset in the EXACT shape of the prototype's
``window.CRM_DATA`` so the ported React components render with no data-layer
rewrites. The remaining endpoints are the write actions that make the app
fully interactive (create lead, log activity, block unit, advance booking,
record receipt, send reminder, process payout, schedule visit).
"""

import datetime

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit

CRM_ROLES = (
	"System Manager", "Realty Admin", "Realty Sales Manager",
	"Realty Sales Executive", "Realty Finance",
)

STAGE_ORDER = ["new", "contacted", "qualified", "visit", "negotiation", "booked", "lost"]
BOOKING_STAGES = ["token-received", "agreement-signed", "registration-pending", "registered"]

# Unit lifecycle. A unit moves Available <-> Blocked (hold) <-> Reserved (token/intent)
# and on to Sold; Sold is reversible only by a manager (revenue-affecting unwind).
ALLOWED_UNIT_STATUS = ("Available", "Blocked", "Reserved", "Sold")
_UNIT_TRANSITIONS = {
	"Available": {"Blocked", "Reserved", "Sold"},
	"Blocked": {"Available", "Reserved", "Sold"},
	"Reserved": {"Available", "Blocked", "Sold"},
	"Sold": {"Available"},  # unwind/cancel — manager/admin only (enforced below)
}
MANAGER_ROLES = ("Realty Sales Manager", "Realty Admin", "System Manager")
_UNIT_UNWIND_ROLES = MANAGER_ROLES
# A hold's "kind" maps to the unit status its approval produces.
KIND_TO_STATUS = {"Hold": "Blocked", "Reserve": "Reserved"}

# ---- DMS (document management + sharing) ----
DOC_CATEGORIES = ("Brochure", "Cost Sheet", "Floor Plan", "Agreement", "KYC", "Price List",
	"Allotment Letter", "Receipt", "RERA", "Legal", "Other")
SHARE_TERMINAL = ("Rejected", "Revoked", "Expired")
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB cap
ALLOWED_UPLOAD_EXT = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif",
	".doc", ".docx", ".xls", ".xlsx", ".csv", ".ppt", ".pptx", ".txt"}


def _is_manager():
	return any(r in MANAGER_ROLES for r in frappe.get_roles())


def _actor_owner():
	"""The acting Realty Sales Owner for the session user, for hold attribution.

	Resolves via the Sales Owner's ``user`` link; falls back to the pinned demo
	persona when the rep has no Frappe login yet. NOTE: with a single shared login
	the actor collapses to one identity — real per-rep enforcement needs each rep
	mapped to a Frappe User (see CLAUDE.md). Approvals still gate on real roles.
	"""
	name = frappe.db.get_value("Realty Sales Owner", {"user": frappe.session.user}, "full_name")
	if name:
		return name
	return _current_owner().get("name")

# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _guard():
	if frappe.session.user == "Guest":
		frappe.throw(_("Please log in to use the CRM."), frappe.PermissionError)


def _s(v):
	"""Serialize dates/datetimes/timedeltas to the strings the prototype expects."""
	if v is None:
		return None
	if isinstance(v, datetime.timedelta):  # Time fields come back as timedelta
		total = int(v.total_seconds())
		return f"{total // 3600:02d}:{(total % 3600) // 60:02d}"
	if isinstance(v, datetime.datetime):
		return v.strftime("%Y-%m-%d %H:%M")
	if isinstance(v, datetime.date):
		return v.isoformat()
	return v


def _initials(name):
	parts = (name or "").split()
	return ("".join(p[0] for p in parts[:2])).upper() if parts else "?"


def _pid(code):
	"""'AN' -> 'P-AN' (restore the prototype project id)."""
	return ("P-" + code) if code else None


# --------------------------------------------------------------------------- #
# bootstrap (read everything in CRM_DATA shape)
# --------------------------------------------------------------------------- #
@frappe.whitelist()
def get_bootstrap():
	_guard()

	# ---- masters / lookups ----
	owners = frappe.get_all("Realty Sales Owner",
		fields=["full_name", "owner_id", "role", "initials", "phone", "user"], order_by="owner_id")
	owner_by_name = {o.full_name: o for o in owners}

	projects_raw = frappe.get_all("Realty Project", fields=[
		"project_code", "project_name", "project_type", "city", "locality",
		"typology", "possession", "towers_count", "total_units", "sold",
		"blocked", "reserved", "available", "price_from", "price_to"], order_by="project_code")
	proj_name_by_code = {p.project_code: p.project_name for p in projects_raw}

	partners = frappe.get_all("Realty Channel Partner", fields=[
		"partner_name", "contact_person", "rera", "phone", "email", "tier",
		"total_leads", "bookings", "commission", "outstanding"], order_by="creation")

	stages = [{"id": s.stage_id, "label": s.label, "tone": s.tone}
		for s in frappe.get_all("Realty Lead Stage",
			fields=["stage_id", "label", "tone"], order_by="sort_order")]
	sources = frappe.get_all("Realty Lead Source", pluck="source_name", order_by="creation")

	# ---- child rows for leads, grouped by parent ----
	def _grouped(child_dt, fields):
		rows = frappe.get_all(child_dt, filters={"parenttype": "Realty Lead"},
			fields=["parent", *fields], order_by="parent asc, idx asc")
		out = {}
		for r in rows:
			out.setdefault(r.parent, []).append(r)
		return out

	acts = _grouped("Realty Lead Activity", ["activity_datetime", "who", "activity_type", "text"])
	costs = _grouped("Realty Cost Sheet Item", ["label", "amount"])

	# lead -> (lead_id, project) lookup so tasks can carry their lead's prototype
	# id + project — lets the calendar filter tasks by project and open the linked lead
	_lead_lookup = {l.name: l for l in frappe.get_all(
		"Realty Lead", fields=["name", "lead_id", "project"])}

	# standalone tasks (drive the personal calendar) — shaped, grouped by lead + kept whole
	def _shape_task(t):
		o = owner_by_name.get(t.assigned_to) or {}
		ll = _lead_lookup.get(t.lead) or {}
		return {"id": t.task_id, "title": t.title, "type": t.task_type, "status": t.status,
			"done": t.status == "Done", "priority": t.priority, "assignedTo": t.assigned_to,
			"assignedToInitials": o.get("initials"), "ownerName": t.assigned_to,
			"due": _s(t.due_date), "dueDate": _s(t.due_date), "dueTime": _s(t.due_time),
			"lead": t.lead, "leadId": ll.get("lead_id"), "leadName": t.lead_name,
			"project": _pid(ll.get("project")), "notes": t.notes}
	rtasks_all = frappe.get_all("Realty Task", fields=["task_id", "title", "task_type", "status",
		"priority", "assigned_to", "due_date", "due_time", "lead", "lead_name", "notes"],
		order_by="due_date asc, due_time asc")
	all_tasks = [_shape_task(t) for t in rtasks_all]
	tasks_by_lead = {}
	for t, st in zip(rtasks_all, all_tasks):
		if t.lead:
			tasks_by_lead.setdefault(t.lead, []).append(st)

	# ---- leads ----
	leads_raw = frappe.get_all("Realty Lead", fields=[
		"name", "lead_id", "lead_name", "phone", "email", "occupation", "city",
		"stage", "score", "starred", "followups", "tags_text", "project",
		"interest", "budget", "source", "channel_partner", "sales_owner",
		"lead_created", "last_activity", "visit_on", "owner"], order_by="lead_id")

	# resolve creator (doc owner) -> full name for "entered by"
	creator_ids = {ld.owner for ld in leads_raw if ld.owner}
	creator_names = {u.name: (u.full_name or u.name) for u in frappe.get_all(
		"User", filters={"name": ["in", list(creator_ids)]} if creator_ids else {"name": ["in", [""]]},
		fields=["name", "full_name"])}

	leads = []
	for ld in leads_raw:
		owner = owner_by_name.get(ld.sales_owner) or {}
		leads.append({
			"id": ld.lead_id, "name": ld.lead_name, "initials": _initials(ld.lead_name),
			"phone": ld.phone, "email": ld.email, "occupation": ld.occupation,
			"stage": ld.stage, "score": ld.score, "interest": ld.interest,
			"budget": ld.budget, "project": _pid(ld.project),
			"projectName": proj_name_by_code.get(ld.project),
			"source": ld.source, "owner": owner.get("owner_id"),
			"ownerName": ld.sales_owner, "ownerInitials": owner.get("initials"),
			"enteredBy": creator_names.get(ld.owner, ld.owner),
			"channelPartner": ld.channel_partner, "channelPartnerName": ld.channel_partner,
			"created": _s(ld.lead_created), "lastActivity": _s(ld.last_activity),
			"visitOn": _s(ld.visit_on), "city": ld.city,
			"starred": bool(ld.starred), "followups": ld.followups,
			"tags": [t.strip() for t in (ld.tags_text or "").split(",") if t.strip()],
			"activities": [{"at": _s(a.activity_datetime), "who": a.who,
				"type": a.activity_type, "text": a.text} for a in acts.get(ld.name, [])],
			"tasks": tasks_by_lead.get(ld.name, []),
			"costSheet": [{"label": c.label, "amount": c.amount} for c in costs.get(ld.name, [])],
		})

	# ---- inventory grids (ALL projects) keyed by prototype project id "P-<code>" ----
	units_raw = frappe.get_all("Realty Unit", fields=[
		"unit_id", "project", "tower", "floor", "unit_no", "typology", "carpet_area",
		"facing", "price", "status"], order_by="project asc, tower asc, floor asc, unit_no asc")
	unit_proj = {u.unit_id: _pid(u.project) for u in units_raw}

	# active holds (Requested/Approved) — ONE batched query, grouped by unit, so the
	# inventory panel renders attribution without N+1. Each unit carries 0-2 active
	# holds (≤1 Approved + ≤1 Requested). pendingHolds powers the manager approvals view.
	def _shape_hold(h):
		o = owner_by_name.get(h.requested_by) or {}
		ll = _lead_lookup.get(h.lead) or {}
		return {"id": h.hold_id, "kind": h.kind, "status": h.status,
			"requestedBy": h.requested_by, "requestedByRole": o.get("role"),
			"requestedByInitials": o.get("initials"), "requestedByPhone": o.get("phone"),
			"requestedOn": _s(h.requested_on), "approvedBy": h.approved_by,
			"lead": h.lead, "leadId": ll.get("lead_id"), "leadName": h.lead_name,
			"isOutside": not bool(h.lead), "contactName": h.contact_name,
			"contactPhone": h.contact_phone, "note": h.note,
			"unit": h.unit, "project": unit_proj.get(h.unit)}
	holds_by_unit, pending_holds = {}, []
	for h in frappe.get_all("Realty Unit Hold",
			filters={"status": ["in", ["Requested", "Approved"]]},
			fields=["hold_id", "unit", "kind", "status", "requested_by", "requested_on",
				"approved_by", "lead", "lead_name", "contact_name", "contact_phone", "note"],
			order_by="creation asc"):
		sh = _shape_hold(h)
		holds_by_unit.setdefault(h.unit, []).append(sh)
		if h.status == "Requested":
			pending_holds.append(sh)

	# ---- DMS: document shares + documents (2 batched queries, N+1-safe) ----
	is_mgr = _is_manager()
	me_owner = _actor_owner()
	now_dt = frappe.utils.now_datetime()

	# active shares (Requested/Approved), grouped by document docname. share_key/shareUrl are
	# exposed ONLY to a manager or the requester (never leaked broadly).
	shares_by_doc, pending_shares, active_shares = {}, [], []
	for s in frappe.get_all("Realty Document Share",
			filters={"status": ["in", ["Requested", "Approved"]]},
			fields=["share_id", "document", "lead", "lead_name", "document_title", "status",
				"channel", "requested_by", "requested_on", "approved_by", "approved_on",
				"share_key", "expires_on", "access_count"], order_by="creation asc"):
		o = owner_by_name.get(s.requested_by) or {}
		ll = _lead_lookup.get(s.lead) or {}
		eff = _effective_share_status(s.status, s.expires_on, now_dt)
		if eff == "Expired":
			continue
		expose = eff == "Approved" and s.share_key and (is_mgr or me_owner == s.requested_by)
		sh = {"id": s.share_id, "document": s.document, "documentTitle": s.document_title,
			"lead": s.lead, "leadId": ll.get("lead_id"), "leadName": s.lead_name,
			"status": eff, "channel": s.channel, "isOutside": False,
			"requestedBy": s.requested_by, "requestedByInitials": o.get("initials"),
			"requestedByRole": o.get("role"), "requestedOn": _s(s.requested_on) or "",
			"approvedBy": s.approved_by, "approvedOn": _s(s.approved_on),
			"accessCount": s.access_count,
			"shareUrl": (_share_url(s.share_key) if expose else None)}
		shares_by_doc.setdefault(s.document, []).append(sh)
		if eff == "Requested":
			pending_shares.append(sh)
		elif eff == "Approved":
			active_shares.append(sh)

	# documents (Active only), shaped + grouped by lead AND project. file_url is NOT shipped.
	def _shape_doc(d):
		ll = _lead_lookup.get(d.lead) or {}
		return {"id": d.document_id, "name": d.title, "title": d.title, "category": d.category,
			"tags": [t.strip() for t in (d.tags_text or "").split(",") if t.strip()],
			"project": _pid(d.project), "projectName": proj_name_by_code.get(d.project),
			"unit": d.unit, "lead": d.lead, "leadId": ll.get("lead_id"), "booking": d.booking,
			"shareable": bool(d.shareable), "hasFile": bool(d.file_doc),
			"fileName": d.file_name, "size": d.file_size, "mime": d.mime_type,
			"uploadedBy": d.uploaded_by, "at": _s(d.uploaded_on), "notes": d.notes,
			"shares": shares_by_doc.get(d.name, [])}
	documents, docs_by_lead, docs_by_project, doc_tags = [], {}, {}, set()
	for d in frappe.get_all("Realty Document", filters={"status": "Active"},
			fields=["name", "document_id", "title", "category", "tags_text", "project", "unit",
				"lead", "booking", "shareable", "file_doc", "file_name", "file_size",
				"mime_type", "uploaded_by", "uploaded_on", "notes"], order_by="uploaded_on desc"):
		if not d.file_doc:
			continue
		sd = _shape_doc(d)
		documents.append(sd)
		if d.lead:
			docs_by_lead.setdefault(d.lead, []).append(sd)
		docs_by_project.setdefault(_pid(d.project), []).append(sd)
		for t in sd["tags"]:
			doc_tags.add(t)
	# attach each lead's documents (leads_raw / leads are parallel lists from the loop above)
	for ld_raw, ld_dict in zip(leads_raw, leads):
		ld_dict["documents"] = docs_by_lead.get(ld_raw.name, [])

	grids = {}
	floor7b = []
	for u in units_raw:
		unit = {"id": u.unit_id, "tower": u.tower, "floor": u.floor, "num": u.unit_no,
			"typology": u.typology, "carpet": u.carpet_area, "facing": u.facing,
			"price": u.price, "status": (u.status or "").lower(),
			"holds": holds_by_unit.get(u.unit_id, [])}
		grids.setdefault(_pid(u.project), {}).setdefault(u.tower, {}).setdefault(u.floor, []).append(unit)
		if u.project == "AN" and u.tower == "B" and u.floor == 7:
			floor7b.append(unit)
	grid = grids.get("P-AN", {})  # back-compat alias (abhimanGrid)

	an_towers = [{"id": t.tower_code, "name": t.tower_name, "floors": t.floors}
		for t in frappe.get_all("Realty Tower", filters={"parent": "AN"},
			fields=["tower_code", "tower_name", "floors"], order_by="idx")]

	# ---- visits ----
	visits = []
	lead_meta = {ld["id"]: ld for ld in leads}
	for v in frappe.get_all("Realty Site Visit", fields=[
		"visit_id", "lead", "lead_name", "project", "sales_owner", "party_of",
		"visit_date", "visit_time", "duration", "mode", "status", "pickup", "notes"],
		order_by="visit_date asc, visit_time asc"):
		owner = owner_by_name.get(v.sales_owner) or {}
		lm = lead_meta.get(v.lead, {})
		visits.append({
			"id": v.visit_id, "leadId": v.lead, "leadName": v.lead_name,
			"leadInitials": _initials(v.lead_name), "leadPhone": lm.get("phone"),
			"project": _pid(v.project), "projectName": proj_name_by_code.get(v.project),
			"ownerId": owner.get("owner_id"), "ownerName": v.sales_owner,
			"ownerInitials": owner.get("initials"), "partyOf": v.party_of,
			"date": _s(v.visit_date), "time": _s(v.visit_time), "duration": v.duration,
			"mode": v.mode, "status": v.status, "pickup": bool(v.pickup), "notes": v.notes})

	# ---- bookings ----
	bookings = [{
		"id": b.booking_id, "date": _s(b.booking_date), "leadId": b.lead,
		"leadName": b.lead_name, "unit": b.unit, "project": b.project_name,
		"typology": b.typology, "carpet": b.carpet, "bsp": b.bsp,
		"otherCharges": b.other_charges, "gst": b.gst, "total": b.total,
		"tokenAmount": b.token_amount, "tokenPaid": bool(b.token_paid),
		"agreementSigned": bool(b.agreement_signed), "stage": b.stage,
		"owner": b.sales_owner_name}
		for b in frappe.get_all("Realty Booking", fields=[
			"booking_id", "booking_date", "lead", "lead_name", "unit", "project_name",
			"typology", "carpet", "bsp", "other_charges", "gst", "total",
			"token_amount", "token_paid", "agreement_signed", "stage", "sales_owner_name"],
			order_by="booking_date desc")]

	# ---- payment plan template + dues ----
	plan = frappe.get_all("Realty Payment Plan Item", filters={"parenttype": "Realty Payment Plan"},
		fields=["stage_name", "pct", "trigger"], order_by="idx")
	payment_template = [{"stage": p.stage_name, "pct": p.pct, "trigger": p.trigger} for p in plan]

	payment_dues = [{
		"id": p.due_id, "bookingId": p.booking, "leadName": p.lead_name, "unit": p.unit,
		"project": p.project_name, "stageName": p.stage_name, "pct": p.pct,
		"amount": p.amount, "dueDate": _s(p.due_date), "status": p.status,
		"paidAt": _s(p.paid_at), "receiptNo": p.receipt_no}
		for p in frappe.get_all("Realty Payment Due", fields=[
			"due_id", "booking", "lead_name", "unit", "project_name", "stage_name",
			"pct", "amount", "due_date", "status", "paid_at", "receipt_no"],
			order_by="due_date asc")]

	# ---- campaigns ----
	campaigns = [{
		"id": c.campaign_id, "name": c.campaign_name, "channel": c.channel,
		"status": c.status, "startDate": _s(c.start_date), "endDate": _s(c.end_date),
		"budget": c.budget, "spent": c.spent, "leads": c.leads, "qualified": c.qualified,
		"visits": c.visits, "bookings": c.bookings, "cpl": c.cpl}
		for c in frappe.get_all("Realty Campaign", fields=[
			"campaign_id", "campaign_name", "channel", "status", "start_date", "end_date",
			"budget", "spent", "leads", "qualified", "visits", "bookings", "cpl"],
			order_by="start_date desc")]

	# ---- projects (restore prototype shape) ----
	projects = [{
		"id": _pid(p.project_code), "code": p.project_code, "name": p.project_name,
		"type": p.project_type, "city": p.city, "locality": p.locality,
		"towers": p.towers_count, "totalUnits": p.total_units, "sold": p.sold,
		"blocked": p.blocked, "reserved": p.reserved, "available": p.available, "typology": p.typology,
		"priceFrom": p.price_from, "priceTo": p.price_to, "possession": p.possession}
		for p in projects_raw]

	channel_partners = [{
		"id": cp.partner_name, "name": cp.partner_name, "contact": cp.contact_person,
		"rera": cp.rera, "phone": cp.phone, "email": cp.email, "tier": cp.tier,
		"totalLeads": cp.total_leads, "bookings": cp.bookings,
		"commission": cp.commission, "outstanding": cp.outstanding} for cp in partners]

	# Top-level tasks/activity (the prototype's dashboard "Today" panel + any
	# global consumer expect these) — sourced from the focused lead.
	focused = next((l for l in leads if l["id"] == "LD-2400"), leads[0] if leads else None)

	return {
		"today": "2026-04-29",
		# NOTE: only the boolean belongs here — the user roster stays admin-only
		# behind list_crm_users().
		"currentUser": {**_current_owner(), "isManager": _is_manager(),
			"canManageUsers": _is_user_admin()},
		"tasks": all_tasks,
		"activity": focused["activities"] if focused else [],
		"projects": projects, "sources": sources, "stages": stages, "owners": [
			{"id": o.owner_id, "name": o.full_name, "role": o.role, "initials": o.initials,
			 "phone": o.phone, "login": o.user}
			for o in owners],
		"channelPartners": channel_partners, "leads": leads,
		"documents": documents, "documentsByProject": docs_by_project,
		"pendingShares": pending_shares, "activeShares": active_shares,
		"docTags": sorted(doc_tags), "docCategories": list(DOC_CATEGORIES),
		"emailAccounts": _visible_email_accounts(), "defaultEmailAccount": _default_email_account(),
		"emailKinds": list(EMAIL_KINDS),
		"inventory": {"P-AN": {"towers": an_towers, "units": floor7b}},
		"abhimanGrid": grid, "grids": grids, "pendingHolds": pending_holds,
		"visits": visits, "bookings": bookings,
		"paymentTemplate": payment_template, "paymentDues": payment_dues,
		"campaigns": campaigns,
	}


def _current_owner():
	"""Who the app greets and treats as "me".

	Resolves the REAL session user to their Realty Sales Owner (via the owner's
	``user`` link, else a full-name match). Falls back to the pinned demo persona
	only when the login isn't mapped to a rep — real per-rep identity is what makes
	hold/lead attribution meaningful.
	"""
	fields = ["full_name", "initials", "role"]
	row = frappe.db.get_value("Realty Sales Owner", {"user": frappe.session.user},
		fields, as_dict=True)
	if not row:
		fn = frappe.utils.get_fullname()
		if fn and frappe.db.exists("Realty Sales Owner", fn):
			row = frappe.db.get_value("Realty Sales Owner", fn, fields, as_dict=True)
	if row:
		return {"name": row.full_name, "initials": row.initials, "role": row.role}
	# A real login that isn't a sales rep (a director, finance, an admin) is greeted
	# by their own name — never by an arbitrary colleague's.
	if frappe.session.user not in ("Guest", "Administrator"):
		fn = frappe.utils.get_fullname()
		if fn:
			return {"name": fn, "initials": _initials(fn), "role": ""}
	if frappe.db.exists("Realty Sales Owner", "Priya Deshmukh"):
		return {"name": "Priya Deshmukh", "initials": "PD", "role": "Sales Executive"}
	first = frappe.get_all("Realty Sales Owner", fields=fields, limit=1)
	if first:
		return {"name": first[0].full_name, "initials": first[0].initials, "role": first[0].role}
	return {"name": frappe.utils.get_fullname(), "initials": "", "role": ""}


# --------------------------------------------------------------------------- #
# write actions
# --------------------------------------------------------------------------- #
def _next_id(doctype, field, prefix, width):
	last = frappe.db.sql(
		f"""select max(cast(replace(`{field}`, %s, '') as unsigned)) from `tab{doctype}`""",
		(prefix,))[0][0]
	return f"{prefix}{str((last or 0) + 1).zfill(width)}"


def _lead_activities(doc):
	"""Serialize a lead's activity timeline in the shape the drawer expects."""
	return [{"at": _s(a.activity_datetime), "who": a.who, "type": a.activity_type, "text": a.text}
		for a in doc.activities]


@frappe.whitelist()
def create_lead(payload):
	_guard()
	if isinstance(payload, str):
		payload = frappe.parse_json(payload)
	if not payload.get("name") or not payload.get("phone"):
		frappe.throw(_("Name and phone are required."))

	# Assignment is a MANAGER action, not part of capture. A new lead defaults to
	# its creator if the creator is a sales rep (Realty Sales Owner), otherwise it
	# is left Unassigned for a manager to assign later. The creator ("entered by")
	# is the Frappe doc owner, surfaced in get_bootstrap.
	entered_by = frappe.utils.get_fullname()
	owner_name = entered_by if frappe.db.exists("Realty Sales Owner", entered_by) else None

	cp = payload.get("channelPartner") or None
	score = {"hot": 85, "high": 70, "medium": 55, "low": 40}.get(payload.get("priority"), 55)
	code = (payload.get("project") or "").replace("P-", "", 1) or None
	today = frappe.utils.nowdate()

	doc = frappe.get_doc({
		"doctype": "Realty Lead",
		"lead_id": _next_id("Realty Lead", "lead_id", "LD-", 4),
		"lead_name": payload["name"], "phone": payload["phone"],
		"email": payload.get("email"), "occupation": payload.get("occupation"),
		"city": payload.get("city"), "stage": payload.get("stage") or "new",
		"score": score, "project": code, "interest": payload.get("interest"),
		"budget": frappe.utils.flt(payload.get("budget")) or None,
		"source": payload.get("source"), "channel_partner": cp,
		"sales_owner": owner_name, "lead_created": today, "last_activity": today,
		"activities": [{"activity_datetime": frappe.utils.now(), "who": entered_by,
			"activity_type": "created",
			"text": f"Lead captured from {payload.get('source', 'Direct')} by {entered_by}."}],
	})
	if payload.get("notes"):
		doc.append("activities", {"activity_datetime": frappe.utils.now(),
			"who": entered_by, "activity_type": "note", "text": payload["notes"]})
	doc.insert()
	frappe.db.commit()
	return {"ok": True, "lead_id": doc.lead_id}


@frappe.whitelist()
def log_activity(lead, text, activity_type="note"):
	_guard()
	doc = frappe.get_doc("Realty Lead", lead)
	doc.check_permission("write")
	doc.append("activities", {"activity_datetime": frappe.utils.now(),
		"who": frappe.utils.get_fullname() or "You", "activity_type": activity_type, "text": text})
	doc.last_activity = frappe.utils.nowdate()
	doc.save()
	frappe.db.commit()
	return _lead_activities(doc)


@frappe.whitelist()
def update_lead_stage(lead, stage):
	_guard()
	doc = frappe.get_doc("Realty Lead", lead)
	doc.check_permission("write")
	old = doc.stage
	doc.stage = stage
	doc.last_activity = frappe.utils.nowdate()
	doc.append("activities", {"activity_datetime": frappe.utils.now(),
		"who": frappe.utils.get_fullname() or "You", "activity_type": "note",
		"text": f"Stage changed from {old or '—'} to {stage}."})
	doc.save()
	frappe.db.commit()
	return {"ok": True, "stage": stage, "activities": _lead_activities(doc)}


@frappe.whitelist()
def reassign_lead(lead, owner=None):
	_guard()
	doc = frappe.get_doc("Realty Lead", lead)
	doc.check_permission("write")
	owner = owner or None
	if owner and not frappe.db.exists("Realty Sales Owner", owner):
		owner = frappe.db.get_value("Realty Sales Owner", {"owner_id": owner}, "full_name") or None
	doc.sales_owner = owner
	doc.append("activities", {"activity_datetime": frappe.utils.now(),
		"who": frappe.utils.get_fullname() or "You", "activity_type": "note",
		"text": f"Lead assigned to {owner or 'Unassigned'}."})
	doc.save()
	frappe.db.commit()
	return {"ok": True, "owner": owner, "activities": _lead_activities(doc)}


@frappe.whitelist()
def bulk_reassign(leads, owner=None):
	_guard()
	if isinstance(leads, str):
		leads = frappe.parse_json(leads)
	owner = owner or None
	if owner and not frappe.db.exists("Realty Sales Owner", owner):
		owner = frappe.db.get_value("Realty Sales Owner", {"owner_id": owner}, "full_name") or None
	who = frappe.utils.get_fullname() or "You"
	for lid in leads:
		doc = frappe.get_doc("Realty Lead", lid)
		doc.sales_owner = owner
		doc.append("activities", {"activity_datetime": frappe.utils.now(), "who": who,
			"activity_type": "note", "text": f"Lead assigned to {owner or 'Unassigned'}."})
		doc.save(ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "count": len(leads), "owner": owner}


@frappe.whitelist()
def create_task(payload):
	_guard()
	if isinstance(payload, str):
		payload = frappe.parse_json(payload)
	if not payload.get("title"):
		frappe.throw(_("Task title is required."))
	# assignee: explicit -> resolve; else default to creator (if a rep)
	assigned = payload.get("assignedTo") or None
	if assigned and not frappe.db.exists("Realty Sales Owner", assigned):
		assigned = frappe.db.get_value("Realty Sales Owner", {"owner_id": assigned}, "full_name") or assigned
	if not assigned:
		fn = frappe.utils.get_fullname()
		assigned = fn if frappe.db.exists("Realty Sales Owner", fn) else None
	lead = payload.get("lead") or None
	if lead and not frappe.db.exists("Realty Lead", lead):
		lead = frappe.db.get_value("Realty Lead", {"lead_id": lead}, "name") or None
	tm = payload.get("time")
	if tm and len(tm.split(":")) == 2:
		tm += ":00"
	doc = frappe.get_doc({
		"doctype": "Realty Task", "task_id": _next_id("Realty Task", "task_id", "TSK-", 4),
		"title": payload["title"], "task_type": payload.get("type") or "Follow-up call",
		"status": "Open", "priority": payload.get("priority") or "med",
		"assigned_to": assigned, "due_date": payload.get("date") or frappe.utils.nowdate(),
		"due_time": tm, "created_by_name": frappe.utils.get_fullname(),
		"lead": lead, "notes": payload.get("notes"),
	})
	doc.insert(ignore_permissions=True)
	if lead:
		ld = frappe.get_doc("Realty Lead", lead)
		ld.append("activities", {"activity_datetime": frappe.utils.now(),
			"who": frappe.utils.get_fullname() or "You", "activity_type": "note",
			"text": f"Task “{payload['title']}” created (due {doc.due_date})."})
		ld.save(ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "task_id": doc.task_id}


@frappe.whitelist()
def set_task_status(task, done=None, status=None):
	_guard()
	doc = frappe.get_doc("Realty Task", task)
	if status:
		doc.status = status
	elif done is not None:
		doc.status = "Done" if str(done) in ("1", "true", "True") else "Open"
	else:
		doc.status = "Done" if doc.status == "Open" else "Open"
	doc.save(ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "status": doc.status}


@frappe.whitelist()
def toggle_task(lead, task_index):
	_guard()
	doc = frappe.get_doc("Realty Lead", lead)
	doc.check_permission("write")
	idx = int(task_index)
	if 0 <= idx < len(doc.tasks):
		doc.tasks[idx].done = 0 if doc.tasks[idx].done else 1
		doc.save()
		frappe.db.commit()
	return {"ok": True}


@frappe.whitelist()
def set_unit_status(unit_id, status, note=None):
	"""Set a unit to an explicit status (Available/Blocked/Reserved/Sold).

	Replaces the old toggle: the inventory panel sends the exact target. Validates
	the target + the transition, gates a Sold-unwind behind a manager role, then
	recomputes the project rollups. ``block_unit`` delegates here for back-compat.
	"""
	_guard()
	# case-insensitive match against the allowed set (avoids brittle .title())
	target = next((s for s in ALLOWED_UNIT_STATUS
		if s.lower() == (status or "").strip().lower()), None)
	if not target:
		frappe.throw(_("Invalid unit status: {0}").format(status))
	# lock the unit row first → serialize against the hold endpoints
	frappe.db.get_value("Realty Unit", unit_id, "status", for_update=True)
	unit = frappe.get_doc("Realty Unit", unit_id)
	unit.check_permission("write")
	current = unit.status or "Available"
	if current == target:
		return {"ok": True, "unit": unit_id, "status": target.lower(), "unchanged": True}
	if target not in _UNIT_TRANSITIONS.get(current, set()):
		frappe.throw(_("Cannot move a unit from {0} to {1}.").format(current, target))
	# unwinding a sale reverses revenue — restrict to managers/admins
	if current == "Sold" and not _is_manager():
		frappe.throw(_("Only a manager can release a sold unit."), frappe.PermissionError)
	unit.status = target
	unit.save()
	# keep the hold ledger consistent: a manual move to Sold/Available closes any
	# active hold/request so unit.status and the ledger can never contradict.
	if target in ("Sold", "Available"):
		_close_active_holds(unit_id, "Overridden" if target == "Sold" else "Released",
			"Marked sold" if target == "Sold" else "Released")
	_recompute_project_counts(unit.project)
	frappe.db.commit()
	return {"ok": True, "unit": unit_id, "status": target.lower()}


@frappe.whitelist()
def block_unit(unit_id):
	"""Back-compat shim: toggle Available <-> Blocked via set_unit_status."""
	_guard()
	current = frappe.db.get_value("Realty Unit", unit_id, "status")
	return set_unit_status(unit_id, "Available" if current == "Blocked" else "Blocked")


# --------------------------------------------------------------------------- #
# unit hold / reserve workflow (request -> manager approval; holder hand-over)
# --------------------------------------------------------------------------- #
def _active_holds(unit_id):
	"""Active holds (Requested/Approved) for a unit. Invariant after each endpoint:
	at most one Approved + at most one Requested per unit."""
	return frappe.get_all("Realty Unit Hold",
		filters={"unit": unit_id, "status": ["in", ["Requested", "Approved"]]},
		fields=["name", "hold_id", "kind", "status", "requested_by"], order_by="creation asc")


def _get_hold(hold_id):
	if frappe.db.exists("Realty Unit Hold", hold_id):
		return frappe.get_doc("Realty Unit Hold", hold_id)
	name = frappe.db.get_value("Realty Unit Hold", {"hold_id": hold_id}, "name")
	if not name:
		frappe.throw(_("Hold {0} not found.").format(hold_id))
	return frappe.get_doc("Realty Unit Hold", name)


def _close_active_holds(unit_id, status, reason, exclude=None):
	"""Close every active hold on a unit (used when the approved slot is vacated)."""
	who = _actor_owner()
	for h in _active_holds(unit_id):
		if exclude and h.name == exclude:
			continue
		d = frappe.get_doc("Realty Unit Hold", h.name)
		d.status = status
		d.closed_by = who
		d.closed_on = frappe.utils.now()
		d.close_reason = reason
		d.save(ignore_permissions=True)


@frappe.whitelist()
def request_hold(unit_id, kind, lead=None, contact_name=None, contact_phone=None, note=None, requested_by=None):
	"""A team member asks to Hold/Reserve a unit (for a lead OR an outside enquiry).

	Creates a *pending* request (never auto-approves) — a manager (or, for a unit
	already held, its current holder) approves it. Locks the unit row so concurrent
	requests can't both pass the one-pending-per-unit guard.
	"""
	_guard()
	kind = (kind or "").strip().title()
	if kind not in KIND_TO_STATUS:
		frappe.throw(_("Hold kind must be Hold or Reserve."))
	# serialize all hold mutations for this unit on the unit row lock
	cur_status = frappe.db.get_value("Realty Unit", unit_id, "status", for_update=True)
	if cur_status is None:
		frappe.throw(_("Unit {0} not found.").format(unit_id))
	if cur_status == "Sold":
		frappe.throw(_("Unit {0} is sold.").format(unit_id))
	# resolve lead (accept lead_id or docname) vs outside contact
	lead = lead or None
	if lead and not frappe.db.exists("Realty Lead", lead):
		lead = frappe.db.get_value("Realty Lead", {"lead_id": lead}, "name") or None
	lead_name = frappe.db.get_value("Realty Lead", lead, "lead_name") if lead else None
	contact_name = (contact_name or "").strip() or None
	if not lead and not contact_name:
		frappe.throw(_("Pick a lead or enter an outside contact name."))
	# resolve requester (manager may file on behalf of a rep)
	rb = requested_by or _actor_owner()
	if rb and not frappe.db.exists("Realty Sales Owner", rb):
		rb = frappe.db.get_value("Realty Sales Owner", {"owner_id": rb}, "full_name") or rb
	# one pending request per unit (kind-agnostic) — a hand-over supersedes nothing
	# until approved, so block a second concurrent request.
	pending = [h for h in _active_holds(unit_id) if h.status == "Requested"]
	if pending:
		frappe.throw(_("A request is already pending for this unit (by {0}). Contact them or ask a manager to act.").format(pending[0].requested_by or "a colleague"))
	doc = frappe.get_doc({
		"doctype": "Realty Unit Hold",
		"hold_id": _next_id("Realty Unit Hold", "hold_id", "HLD-", 4),
		"unit": unit_id, "kind": kind, "status": "Requested",
		"requested_by": rb, "requested_on": frappe.utils.now(),
		"lead": lead, "lead_name": lead_name,
		"contact_name": contact_name, "contact_phone": (contact_phone or "").strip() or None,
		"note": note,
	}).insert(ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "hold_id": doc.hold_id, "status": "Requested"}


@frappe.whitelist()
def approve_hold(hold_id):
	"""Approve a pending request → the unit becomes Held/Reserved. Allowed for a
	manager, or (for a hand-over) the unit's current approved holder."""
	_guard()
	hold = _get_hold(hold_id)
	if hold.status != "Requested":
		frappe.throw(_("This request is no longer pending."))
	cur_status = frappe.db.get_value("Realty Unit", hold.unit, "status", for_update=True)
	if cur_status == "Sold":
		frappe.throw(_("Unit is sold."))
	approved = [h for h in _active_holds(hold.unit) if h.status == "Approved"]
	actor = _actor_owner()
	holder = approved[0].requested_by if approved else None
	if not (_is_manager() or (holder and actor == holder)):
		frappe.throw(_("Only a manager or the current holder can approve this."), frappe.PermissionError)
	# close any/all current Approved holds (hand-over/override + race backstop)
	for h in approved:
		d = frappe.get_doc("Realty Unit Hold", h.name)
		d.status = "Overridden"; d.closed_by = actor; d.closed_on = frappe.utils.now()
		d.close_reason = "Handed over"; d.save(ignore_permissions=True)
	hold.status = "Approved"
	hold.approved_by = actor
	hold.approved_on = frappe.utils.now()
	hold.save(ignore_permissions=True)
	proj = frappe.db.get_value("Realty Unit", hold.unit, "project")
	frappe.db.set_value("Realty Unit", hold.unit, "status", KIND_TO_STATUS[hold.kind])
	_recompute_project_counts(proj)
	frappe.db.commit()
	return {"ok": True, "hold_id": hold.hold_id, "status": KIND_TO_STATUS[hold.kind].lower()}


@frappe.whitelist()
def reject_hold(hold_id, reason=None):
	"""Reject/cancel a pending request. Manager, the requester (cancel own), or the
	current holder (decline a hand-over)."""
	_guard()
	hold = _get_hold(hold_id)
	if hold.status != "Requested":
		frappe.throw(_("This request is no longer pending."))
	frappe.db.get_value("Realty Unit", hold.unit, "status", for_update=True)
	approved = [h for h in _active_holds(hold.unit) if h.status == "Approved"]
	actor = _actor_owner()
	holder = approved[0].requested_by if approved else None
	if not (_is_manager() or actor == hold.requested_by or (holder and actor == holder)):
		frappe.throw(_("You can't decline this request."), frappe.PermissionError)
	hold.status = "Rejected"
	hold.closed_by = actor
	hold.closed_on = frappe.utils.now()
	hold.close_reason = reason or ("Cancelled" if actor == hold.requested_by else "Rejected")
	hold.save(ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "hold_id": hold.hold_id, "status": "Rejected"}


@frappe.whitelist()
def release_hold(hold_id, reason=None):
	"""Release an approved hold → unit goes Available. Allowed for the holder or a
	manager. Any pending hand-over is auto-declined so nothing is left dangling."""
	_guard()
	hold = _get_hold(hold_id)
	if hold.status != "Approved":
		frappe.throw(_("Only an approved hold can be released."))
	frappe.db.get_value("Realty Unit", hold.unit, "status", for_update=True)
	actor = _actor_owner()
	if not (_is_manager() or actor == hold.requested_by):
		frappe.throw(_("Only the holder or a manager can release this."), frappe.PermissionError)
	hold.status = "Released"
	hold.closed_by = actor
	hold.closed_on = frappe.utils.now()
	hold.close_reason = reason or "Released"
	hold.save(ignore_permissions=True)
	# vacating the slot: decline any pending hand-over request (no orphans)
	_close_active_holds(hold.unit, "Rejected", "Unit released", exclude=hold.name)
	proj = frappe.db.get_value("Realty Unit", hold.unit, "project")
	frappe.db.set_value("Realty Unit", hold.unit, "status", "Available")
	_recompute_project_counts(proj)
	frappe.db.commit()
	return {"ok": True, "hold_id": hold.hold_id, "status": "available"}


# --------------------------------------------------------------------------- #
# DMS — document management + manager-approved sharing
# --------------------------------------------------------------------------- #
def _resolve_lead(lead):
	"""Accept a Realty Lead docname OR its lead_id; return the docname (or None)."""
	lead = lead or None
	if lead and not frappe.db.exists("Realty Lead", lead):
		lead = frappe.db.get_value("Realty Lead", {"lead_id": lead}, "name") or None
	return lead


def _resolve_owner(name):
	"""Accept a Realty Sales Owner full_name OR owner_id; return a VALID owner name or None
	(so a bad value never breaks the requested_by Link on insert)."""
	if not name:
		return None
	if frappe.db.exists("Realty Sales Owner", name):
		return name
	return frappe.db.get_value("Realty Sales Owner", {"owner_id": name}, "full_name") or None


def _norm_tags(raw):
	"""Canonical CSV: split on comma, strip, lowercase, drop empties, dedupe (order-preserving)."""
	if not raw:
		return None
	seen, out = set(), []
	for t in str(raw).split(","):
		t = t.strip().lower()
		if t and t not in seen:
			seen.add(t)
			out.append(t)
	return ", ".join(out) or None


def _share_url(key):
	return frappe.utils.get_url("/api/method/dux_crm_realty.api.crm.view_shared_document?key=" + key) if key else None


def _effective_share_status(status, expires_on, now=None):
	"""An Approved share past its expiry reads as Expired for display (lazy expiry; the guest
	endpoint also flips it on the next hit)."""
	if status == "Approved" and expires_on:
		if frappe.utils.get_datetime(expires_on) < (now or frappe.utils.now_datetime()):
			return "Expired"
	return status


def _get_share(share_id):
	if frappe.db.exists("Realty Document Share", share_id):
		return frappe.get_doc("Realty Document Share", share_id)
	name = frappe.db.get_value("Realty Document Share", {"share_id": share_id}, "name")
	if not name:
		frappe.throw(_("Share {0} not found.").format(share_id))
	return frappe.get_doc("Realty Document Share", name)


def _active_shares(document):
	"""Live shares (Requested/Approved) for a document."""
	return frappe.get_all("Realty Document Share",
		filters={"document": document, "status": ["in", ["Requested", "Approved"]]},
		fields=["name", "share_id", "status", "requested_by"], order_by="creation asc")


def _close_active_shares(document, status, reason):
	"""Move every live share on a document to a terminal status (used on un-share / delete)."""
	who = _actor_owner()
	for s in _active_shares(document):
		d = frappe.get_doc("Realty Document Share", s.name)
		d.status = status
		d.closed_by = who
		d.closed_on = frappe.utils.now()
		d.close_reason = reason
		d.save(ignore_permissions=True)


def _log_share_comm(share, link):
	"""Attach-in-comms: log a Communication on the lead embedding the public LINK (never the
	private bytes) + a lead activity row so it shows in the drawer Activity tab."""
	frappe.get_doc({
		"doctype": "Communication", "communication_type": "Communication",
		"communication_medium": "Email", "sent_or_received": "Sent",
		"subject": f"Document shared — {share.document_title}",
		"content": f"A document has been shared with you: {link}",
		"reference_doctype": "Realty Lead", "reference_name": share.lead,
	}).insert(ignore_permissions=True)
	ld = frappe.get_doc("Realty Lead", share.lead)
	ld.append("activities", {"activity_datetime": frappe.utils.now(),
		"who": share.approved_by or _actor_owner(), "activity_type": "email",
		"text": f"Document “{share.document_title}” shared via link."})
	ld.last_activity = frappe.utils.nowdate()
	ld.save(ignore_permissions=True)


@frappe.whitelist()
def upload_document(title=None, project=None, unit=None, lead=None, booking=None,
		category="Other", tags=None, shareable=0, notes=None):
	"""Multipart upload. The React app POSTs FormData via fetch() with X-Frappe-CSRF-Token
	(frappe.call is JSON-only); the file arrives in frappe.request.files['file']. Stores a
	PRIVATE Frappe File attached to a new Realty Document. All-or-nothing — any failure rolls
	back so no orphan doc/File survives. file_url is NEVER returned (internal reads go through
	download_document; external only via an approved share link)."""
	_guard()
	if not frappe.has_permission("Realty Document", "create"):
		frappe.throw(_("Not permitted to upload documents."), frappe.PermissionError)
	files = frappe.request.files if frappe.request else None
	if not files or "file" not in files:
		frappe.throw(_("No file received."))
	up = files["file"]
	content = up.read()
	if not content:
		frappe.throw(_("The uploaded file is empty."))
	if len(content) > MAX_UPLOAD_BYTES:
		frappe.throw(_("File too large (max {0} MB).").format(MAX_UPLOAD_BYTES // (1024 * 1024)))
	import os
	import mimetypes
	from frappe.utils.file_manager import save_file
	ext = os.path.splitext(up.filename or "")[1].lower()
	if ext not in ALLOWED_UPLOAD_EXT:
		frappe.throw(_("File type {0} is not allowed.").format(ext or "(none)"))
	code = (project or "").replace("P-", "", 1)
	if not code or not frappe.db.exists("Realty Project", code):
		frappe.throw(_("Project {0} not found.").format(project))
	unit = unit or None
	if unit and not frappe.db.exists("Realty Unit", unit):
		unit = None
	booking = booking or None
	if booking and not frappe.db.exists("Realty Booking", booking):
		booking = None
	try:
		doc = frappe.get_doc({
			"doctype": "Realty Document",
			"document_id": _next_id("Realty Document", "document_id", "DOC-", 4),
			"title": (title or up.filename or "Untitled").strip(),
			"category": category if category in DOC_CATEGORIES else "Other",
			"status": "Active", "project": code, "unit": unit,
			"lead": _resolve_lead(lead), "booking": booking, "tags_text": _norm_tags(tags),
			"shareable": 1 if str(shareable) in ("1", "true", "True") else 0,
			"uploaded_by": _actor_owner(), "uploaded_on": frappe.utils.now(), "notes": notes,
		}).insert(ignore_permissions=True)
		# save_file dedups identical content by hash but always inserts a File row anchored to
		# THIS doc (attached_to_name), so deletes stay independent across documents.
		_file = save_file(up.filename, content, "Realty Document", doc.name, is_private=1)
		doc.db_set({
			"file_doc": _file.name, "file_url": _file.file_url, "file_name": _file.file_name,
			"file_size": _file.file_size, "content_hash": _file.content_hash,
			"mime_type": mimetypes.guess_type(up.filename)[0],
		}, update_modified=False)
		frappe.db.commit()
	except frappe.DuplicateEntryError:
		frappe.db.rollback()
		frappe.throw(_("Please retry — a concurrent upload used the same ID."))
	except Exception:
		frappe.db.rollback()
		raise
	return {"ok": True, "document_id": doc.document_id}


@frappe.whitelist()
def update_document(document, title=None, category=None, tags=None, shareable=None, status=None):
	"""Uploader or manager edits metadata. Turning shareable 1->0 is a HARD REVOKE of all live
	shares and is manager-gated. (Single-shared-login caveat: the uploader gate effectively
	passes for the one persona — see CLAUDE.md; role gates stay real.)"""
	_guard()
	doc = frappe.get_doc("Realty Document", document)
	is_mgr = _is_manager()
	if not is_mgr and doc.uploaded_by != _actor_owner():
		frappe.throw(_("You can only edit documents you uploaded."), frappe.PermissionError)
	if shareable is not None:
		new_share = 1 if str(shareable) in ("1", "true", "True") else 0
		if doc.shareable and not new_share:
			if not is_mgr:
				frappe.throw(_("Only a manager can un-share a document with live shares."), frappe.PermissionError)
			_close_active_shares(document, "Revoked", "Document marked not shareable")
		doc.shareable = new_share
	if title is not None:
		doc.title = title.strip()
	if category in DOC_CATEGORIES:
		doc.category = category
	if tags is not None:
		doc.tags_text = _norm_tags(tags)
	if status in ("Active", "Archived"):
		doc.status = status
	doc.save(ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "document_id": doc.document_id}


@frappe.whitelist()
def delete_document(document):
	"""Manager-only (mirrors delete_project). Revokes live shares, deletes the File, then the row."""
	_guard()
	if not _is_manager():
		frappe.throw(_("Only a manager can delete a document."), frappe.PermissionError)
	doc = frappe.get_doc("Realty Document", document)
	# share rows Link to the document → must be removed before the document is deleted
	for s in frappe.get_all("Realty Document Share", filters={"document": document}, pluck="name"):
		frappe.delete_doc("Realty Document Share", s, force=1, ignore_permissions=True)
	if doc.file_doc and frappe.db.exists("File", doc.file_doc):
		frappe.delete_doc("File", doc.file_doc, force=1, ignore_permissions=True)
	frappe.delete_doc("Realty Document", document, force=1, ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "deleted": document}


@frappe.whitelist()
def download_document(document):
	"""Desk-authenticated internal download. Re-checks read permission, then streams the private
	bytes via get_file — so the client never holds a raw /private/files URL. INTERNAL policy: any
	user with read on Realty Document may download; shareable/approval/revoke govern only the
	EXTERNAL guest link (the brief's actual security requirement)."""
	_guard()
	doc = frappe.get_doc("Realty Document", document)
	if not frappe.has_permission("Realty Document", "read", doc):
		frappe.throw(_("Not permitted to download this document."), frappe.PermissionError)
	if not doc.file_doc:
		frappe.throw(_("This document has no file."))
	from frappe.utils.file_manager import get_file
	import os
	_fname, content = get_file(doc.file_url)
	if isinstance(content, str):
		content = content.encode("utf-8")
	ext = os.path.splitext(doc.file_name or "")[1] or ""
	frappe.local.response.filename = (frappe.scrub(doc.title) or "document") + ext
	frappe.local.response.filecontent = content
	frappe.local.response.type = "download"


@frappe.whitelist()
def request_share(document, lead, note=None, channel="Link"):
	"""Any CRM user requests to share a SHAREABLE document WITH A LEAD. Always pending (mirrors
	request_hold). Blocks a second live (Requested OR Approved) share for the same (document, lead)."""
	_guard()
	# serialize on the document row (covers request vs un-share) + confirm a real file exists
	frappe.db.get_value("Realty Document", document, "document_id", for_update=True)
	doc = frappe.get_doc("Realty Document", document)
	if not doc.shareable:
		frappe.throw(_("Mark this document shareable before requesting a share."))
	if not doc.file_doc:
		frappe.throw(_("This document has no file to share."))
	lead = _resolve_lead(lead)
	if not lead:
		frappe.throw(_("Pick a lead to share with."))
	if frappe.db.exists("Realty Document Share",
			{"document": document, "lead": lead, "status": ["in", ["Requested", "Approved"]]}):
		frappe.throw(_("This document already has a live or pending share for this lead."))
	share = frappe.get_doc({
		"doctype": "Realty Document Share",
		"share_id": _next_id("Realty Document Share", "share_id", "SHR-", 4),
		"document": document, "document_title": doc.title,
		"lead": lead, "lead_name": frappe.db.get_value("Realty Lead", lead, "lead_name"),
		"status": "Requested", "channel": (channel if channel in ("Link", "Comms") else "Link"),
		"requested_by": _resolve_owner(_actor_owner()), "requested_on": frappe.utils.now(),
		"note": note,
	}).insert(ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "share_id": share.share_id, "status": "Requested"}


@frappe.whitelist()
def approve_share(share_id, expires_in_days=None):
	"""MANAGER ONLY. Mints the unguessable share_key (idempotent — a re-entrant approve never
	replaces a live token) and activates the public link. Locks the SHARE row first."""
	_guard()
	if not _is_manager():
		frappe.throw(_("Only a manager can approve a share."), frappe.PermissionError)
	share = _get_share(share_id)
	frappe.db.get_value("Realty Document Share", share.name, "status", for_update=True)
	share.reload()
	if share.status != "Requested":
		frappe.throw(_("This request is no longer pending."))
	if not frappe.db.get_value("Realty Document", share.document, "shareable"):
		frappe.throw(_("Document is no longer shareable."))
	share.status = "Approved"
	share.approved_by = _actor_owner()
	share.approved_on = frappe.utils.now()
	if not share.share_key:
		share.share_key = frappe.generate_hash(length=48)
	if frappe.utils.cint(expires_in_days) > 0:
		share.expires_on = frappe.utils.add_days(frappe.utils.now_datetime(), frappe.utils.cint(expires_in_days))
	share.save(ignore_permissions=True)
	frappe.db.commit()
	link = _share_url(share.share_key)
	comms_failed = False
	if share.channel == "Comms":  # after commit — comms failure never rolls back the approval
		try:
			_log_share_comm(share, link)
			frappe.db.commit()
		except Exception:
			frappe.db.rollback()
			comms_failed = True
			frappe.log_error(frappe.get_traceback(), "approve_share comms")
	return {"ok": True, "share_id": share.share_id, "status": "Approved",
		"link": link, "commsFailed": comms_failed}


@frappe.whitelist()
def reject_share(share_id, reason=None):
	"""Manager OR the requester (cancel own). Locks the share row."""
	_guard()
	share = _get_share(share_id)
	frappe.db.get_value("Realty Document Share", share.name, "status", for_update=True)
	share.reload()
	actor = _actor_owner()
	if not (_is_manager() or actor == share.requested_by):
		frappe.throw(_("You can't decline this request."), frappe.PermissionError)
	if share.status != "Requested":
		frappe.throw(_("This request is no longer pending."))
	share.status = "Rejected"
	share.closed_by = actor
	share.closed_on = frappe.utils.now()
	share.close_reason = reason or ("Cancelled" if actor == share.requested_by else "Rejected")
	share.save(ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "share_id": share.share_id, "status": "Rejected"}


@frappe.whitelist()
def revoke_share(share_id, reason=None):
	"""MANAGER ONLY (analog of release_hold). Approved -> Revoked; the link 403s on the next hit.
	Locks the share row so a concurrent approve/view can't interleave."""
	_guard()
	if not _is_manager():
		frappe.throw(_("Only a manager can revoke a share."), frappe.PermissionError)
	share = _get_share(share_id)
	frappe.db.get_value("Realty Document Share", share.name, "status", for_update=True)
	share.reload()
	if share.status != "Approved":
		frappe.throw(_("Only an approved share can be revoked."))
	share.status = "Revoked"
	share.closed_by = _actor_owner()
	share.closed_on = frappe.utils.now()
	share.close_reason = reason or "Revoked"
	share.save(ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "share_id": share.share_id, "status": "Revoked"}


@frappe.whitelist()
def get_document_shares(document):
	"""Full share history for one document (audit trail), newest first — powers 'who it was shared
	with'. Mirrors get_unit_holds. The share link is exposed only to a manager or the requester."""
	_guard()
	is_mgr = _is_manager()
	me = _actor_owner()
	now = frappe.utils.now_datetime()
	out = []
	for r in frappe.get_all("Realty Document Share", filters={"document": document},
			fields=["share_id", "lead", "lead_name", "status", "channel", "requested_by",
				"requested_on", "approved_by", "approved_on", "access_count", "last_accessed_on",
				"last_accessed_ip", "expires_on", "closed_by", "closed_on", "close_reason", "share_key"],
			order_by="creation desc"):
		eff = _effective_share_status(r.status, r.expires_on, now)
		live_lead = frappe.db.get_value("Realty Lead", r.lead, "lead_name") or r.lead_name
		expose = eff == "Approved" and r.share_key and (is_mgr or me == r.requested_by)
		out.append({"id": r.share_id, "lead": r.lead, "leadName": live_lead, "status": eff,
			"channel": r.channel, "requestedBy": r.requested_by, "requestedOn": _s(r.requested_on),
			"approvedBy": r.approved_by, "approvedOn": _s(r.approved_on), "accessCount": r.access_count,
			"lastAccessedOn": _s(r.last_accessed_on), "expiresOn": _s(r.expires_on),
			"closedBy": r.closed_by, "closedOn": _s(r.closed_on), "closeReason": r.close_reason,
			"shareUrl": (_share_url(r.share_key) if expose else None)})
	return out


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=30, seconds=60)
def view_shared_document(key=None):
	"""Public, key-validated download. Streams the underlying PRIVATE Frappe File ONLY when the
	share is Approved, unexpired, and the document is still shareable. Never exposes /private/files;
	denial is byte-identical (no enumeration oracle). Rate-limited per IP."""
	key = (key or "").strip()
	name = frappe.db.get_value("Realty Document Share", {"share_key": key}, "name") if key else None
	if not name:
		frappe.throw(_("This link is invalid or no longer available."), frappe.PermissionError)
	share = frappe.get_doc("Realty Document Share", name)
	now = frappe.utils.now_datetime()  # REAL clock, not the pinned demo date
	if share.status == "Approved" and share.expires_on and now > frappe.utils.get_datetime(share.expires_on):
		try:
			share.db_set({"status": "Expired", "closed_on": frappe.utils.now(), "close_reason": "Expired"},
				update_modified=False)
			frappe.db.commit()
		except Exception:
			frappe.db.rollback()
		share.reload()
	if share.status != "Approved":
		frappe.throw(_("This link is invalid or no longer available."), frappe.PermissionError)
	doc = frappe.get_doc("Realty Document", share.document)
	if not doc.shareable or not doc.file_doc:
		frappe.throw(_("This link is invalid or no longer available."), frappe.PermissionError)
	from frappe.utils.file_manager import get_file
	import os
	_fname, content = get_file(doc.file_url)
	if isinstance(content, str):
		content = content.encode("utf-8")
	try:
		share.db_set({"access_count": (share.access_count or 0) + 1,
			"last_accessed_on": frappe.utils.now(), "last_accessed_ip": frappe.local.request_ip},
			update_modified=False)
		frappe.db.commit()
	except Exception:
		frappe.db.rollback()
	ext = os.path.splitext(doc.file_name or "")[1] or ""
	frappe.local.response.filename = (frappe.scrub(doc.title) or "document") + ext
	frappe.local.response.filecontent = content
	frappe.local.response.type = "download"


# --------------------------------------------------------------------------- #
# AI email drafting (Ollama / Gemma) + email accounts + sending
# --------------------------------------------------------------------------- #
OLLAMA_TIMEOUT = 120
EMAIL_KINDS = ("Greeting", "Follow-up", "Site visit invite", "Cost sheet / pricing",
	"Share documents", "Thank you", "Custom")


def _ollama_url():
	# read from site_config (the dux_chatbot convention); fall back to the known LLM box
	return frappe.conf.get("ollama_url") or "http://187.127.174.89:11434/api/generate"


def _ollama_generate(prompt, num_predict=800, temperature=0.4, fmt="json"):
	"""Single-shot call to the Gemma/Ollama box (recipe from dux_aichatbot: think=false to
	avoid the model burning its budget reasoning; format=json for parseable output)."""
	import requests
	payload = {"model": "gemma4:e4b", "prompt": prompt, "stream": False, "think": False,
		"keep_alive": "15m", "options": {"num_predict": num_predict, "temperature": temperature}}
	if fmt:
		payload["format"] = fmt
	try:
		r = requests.post(_ollama_url(), json=payload, timeout=OLLAMA_TIMEOUT)
		r.raise_for_status()
		return (r.json() or {}).get("response", "") or ""
	except Exception as e:
		frappe.throw(_("The AI service is unavailable right now — please try again. ({0})").format(str(e)[:140]))


def _lead_email_context(ld):
	"""Compact, factual context block the model uses to ground the email."""
	proj = frappe.db.get_value("Realty Project", ld.project,
		["project_name", "locality", "city", "possession", "typology"], as_dict=True) if ld.project else None
	budget = ("about " + frappe.utils.fmt_money(ld.budget)) if ld.budget else "not specified"
	lines = [f"Lead name: {ld.lead_name}"]
	if ld.interest:
		lines.append(f"Looking for: {ld.interest}")
	if proj:
		where = ", ".join([x for x in [proj.get("locality"), proj.get("city")] if x])
		lines.append(f"Project of interest: {proj.get('project_name')}{(' (' + where + ')') if where else ''}")
		if proj.get("possession"):
			lines.append(f"Possession: {proj.get('possession')}")
	lines.append(f"Budget: {budget}")
	return "\n".join(lines)


@frappe.whitelist()
def draft_email(lead, instruction=None, kind="Custom"):
	"""Draft a warm, professional sales email for a lead using the local LLM. Grounded in the
	lead's apartment/project/budget context + the chosen email type + the rep's free instruction.
	Returns {subject, body} — always reviewed/edited by the human before sending."""
	_guard()
	name = _resolve_lead(lead) or lead
	ld = frappe.get_doc("Realty Lead", name)
	ld.check_permission("read")
	sender = frappe.utils.get_fullname() or "the Shradha Realty team"
	kind = kind if kind in EMAIL_KINDS else "Custom"
	prompt = (
		"You are an assistant for a sales executive at Shradha Realty, a real-estate developer in Nagpur, India. "
		"Write a warm, professional, concise email (about 120-160 words) from the sales executive to a prospective buyer (the lead). "
		"Return ONLY JSON with exactly two keys: \"subject\" (short) and \"body\". "
		"In the body use \\n for line breaks, address the lead by name, and end with a sign-off from the sender. "
		"Do not invent prices, dates, or unit numbers that are not given. Be helpful and human, not pushy.\n\n"
		f"Email type: {kind}\n"
		f"Sender (sign off as): {sender}, Shradha Realty\n"
		f"--- Lead context ---\n{_lead_email_context(ld)}\n"
		f"--- What the sales executive wants to say ---\n{(instruction or '').strip() or '(no extra instruction — write a fitting ' + kind + ' email)'}\n"
	)
	resp = _ollama_generate(prompt, num_predict=900, temperature=0.5, fmt="json")
	try:
		data = frappe.parse_json(resp) or {}
	except Exception:
		data = {}
	subject = (data.get("subject") or "").strip()
	body = (data.get("body") or "").strip()
	if not body:
		# model returned prose / non-JSON — surface it as the body so nothing is lost
		body = resp.strip()
	if not subject:
		pname = frappe.db.get_value("Realty Project", ld.project, "project_name") if ld.project else None
		subject = ("Regarding " + pname) if pname else "Following up on your enquiry"
	return {"subject": subject, "body": body}


@frappe.whitelist()
def improve_text(text):
	"""Correct grammar/spelling and improve the English of a draft, preserving meaning + line
	breaks. Powers the 'Fix English' button in the email composer."""
	_guard()
	text = (text or "").strip()
	if not text:
		return {"text": ""}
	prompt = (
		"Correct the grammar, spelling and English of the text below. Improve clarity and keep a "
		"professional, warm tone. Preserve the meaning and any line breaks. Do not add new facts. "
		"Return ONLY JSON with a single key \"text\" containing the corrected version. Use \\n for line breaks.\n\n"
		f"TEXT:\n{text}"
	)
	resp = _ollama_generate(prompt, num_predict=900, temperature=0.2, fmt="json")
	try:
		data = frappe.parse_json(resp) or {}
	except Exception:
		data = {}
	return {"text": (data.get("text") or text).strip()}


# ---- email accounts (per-user SMTP sender; self-contained, smtplib only) ----
def _visible_email_accounts():
	"""Accounts the current login may use: their own + shared (owner blank). Managers see all."""
	me = frappe.session.user
	mgr = _is_manager()
	out = []
	for ea in frappe.get_all("Realty Email Account", fields=[
			"account_id", "email_id", "sender_name", "owner_user", "is_default", "enabled",
			"has_password", "smtp_host", "smtp_port", "use_ssl", "last_tested", "last_status"],
			order_by="creation"):
		mine = ea.owner_user == me
		shared = not ea.owner_user
		if not (mine or shared or mgr):
			continue
		out.append({
			"id": ea.account_id, "email": ea.email_id, "senderName": ea.sender_name,
			"mine": mine, "shared": shared, "isDefault": bool(ea.is_default),
			"enabled": bool(ea.enabled), "hasPassword": bool(ea.has_password),
			"smtpHost": ea.smtp_host, "smtpPort": ea.smtp_port, "useSsl": bool(ea.use_ssl),
			"lastTested": _s(ea.last_tested), "lastStatus": ea.last_status})
	return out


def _default_email_account():
	"""The sending account to use for the current user: their default, else a shared default,
	else any enabled account they can use."""
	accts = [a for a in _visible_email_accounts() if a["enabled"] and a["hasPassword"]]
	if not accts:
		return None
	for a in accts:
		if a["mine"] and a["isDefault"]:
			return a
	for a in accts:
		if a["shared"] and a["isDefault"]:
			return a
	for a in accts:
		if a["mine"]:
			return a
	return accts[0]


@frappe.whitelist()
def save_email_account(payload):
	"""Create/update the current user's sending email account. The app password is stored
	encrypted (Password fieldtype). Only the owner (or a manager) may edit an account."""
	_guard()
	if isinstance(payload, str):
		payload = frappe.parse_json(payload)
	email_id = (payload.get("email") or "").strip().lower()
	if not email_id or "@" not in email_id:
		frappe.throw(_("Enter a valid email address."))
	acc_id = payload.get("id")
	if acc_id and frappe.db.exists("Realty Email Account", acc_id):
		doc = frappe.get_doc("Realty Email Account", acc_id)
		if doc.owner_user and doc.owner_user != frappe.session.user and not _is_manager():
			frappe.throw(_("You can only edit your own email account."), frappe.PermissionError)
	else:
		doc = frappe.get_doc({"doctype": "Realty Email Account",
			"account_id": _next_id("Realty Email Account", "account_id", "EML-", 4),
			"owner_user": frappe.session.user})
	doc.email_id = email_id
	doc.sender_name = (payload.get("senderName") or "").strip() or frappe.utils.get_fullname()
	doc.smtp_host = (payload.get("smtpHost") or "smtp.gmail.com").strip()
	doc.smtp_port = frappe.utils.cint(payload.get("smtpPort")) or 465
	doc.use_ssl = 1 if str(payload.get("useSsl", 1)) in ("1", "true", "True") else 0
	doc.enabled = 1 if str(payload.get("enabled", 1)) in ("1", "true", "True") else 0
	pw = payload.get("password")
	if pw:  # only overwrite when a new password is supplied (don't wipe on metadata edits)
		doc.smtp_password = pw
		doc.has_password = 1
	doc.save(ignore_permissions=True)
	if str(payload.get("isDefault")) in ("1", "true", "True"):
		_set_default_account(doc.name)
	elif payload.get("isDefault") is not None:
		doc.db_set("is_default", 0)
	frappe.db.commit()
	return {"ok": True, "id": doc.account_id}


def _set_default_account(name):
	doc = frappe.get_doc("Realty Email Account", name)
	# clear other defaults in the same scope (this user's, or shared)
	scope = {"owner_user": doc.owner_user} if doc.owner_user else {"owner_user": ["is", "not set"]}
	for other in frappe.get_all("Realty Email Account", filters={**scope, "is_default": 1}, pluck="name"):
		if other != name:
			frappe.db.set_value("Realty Email Account", other, "is_default", 0)
	frappe.db.set_value("Realty Email Account", name, "is_default", 1)


@frappe.whitelist()
def set_default_email_account(account):
	_guard()
	doc = frappe.get_doc("Realty Email Account", account)
	if doc.owner_user and doc.owner_user != frappe.session.user and not _is_manager():
		frappe.throw(_("You can only set your own account as default."), frappe.PermissionError)
	_set_default_account(doc.name)
	frappe.db.commit()
	return {"ok": True}


@frappe.whitelist()
def delete_email_account(account):
	_guard()
	doc = frappe.get_doc("Realty Email Account", account)
	if doc.owner_user and doc.owner_user != frappe.session.user and not _is_manager():
		frappe.throw(_("You can only delete your own email account."), frappe.PermissionError)
	frappe.delete_doc("Realty Email Account", doc.name, force=1, ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True}


def _smtp_connect(doc):
	"""Open + authenticate an SMTP connection for an account. Caller must quit()."""
	import smtplib
	import ssl as _ssl
	pw = doc.get_password("smtp_password", raise_exception=False)
	if not pw:
		frappe.throw(_("Add the app password for {0} (Settings → Email).").format(doc.email_id))
	host = doc.smtp_host or "smtp.gmail.com"
	port = frappe.utils.cint(doc.smtp_port) or (465 if doc.use_ssl else 587)
	if doc.use_ssl:
		server = smtplib.SMTP_SSL(host, port, context=_ssl.create_default_context(), timeout=30)
	else:
		server = smtplib.SMTP(host, port, timeout=30)
		server.starttls(context=_ssl.create_default_context())
	server.login(doc.email_id, pw)
	return server


@frappe.whitelist()
def test_email_account(account):
	"""Verify SMTP login works (connect + auth, no message sent). Records the result."""
	_guard()
	doc = frappe.get_doc("Realty Email Account", account)
	try:
		server = _smtp_connect(doc)
		server.quit()
		doc.db_set({"last_tested": frappe.utils.now(), "last_status": "OK"}, update_modified=False)
		frappe.db.commit()
		return {"ok": True, "status": "OK"}
	except Exception as e:
		msg = str(e)[:140]
		doc.db_set({"last_tested": frappe.utils.now(), "last_status": "Failed: " + msg}, update_modified=False)
		frappe.db.commit()
		frappe.throw(_("Could not connect: {0}").format(msg))


def _email_html(body):
	"""Wrap the plain-text (\\n) body in a clean branded HTML shell."""
	import html as _html
	esc = _html.escape(body or "")
	paras = "".join(
		"<p style='margin:0 0 14px'>" + p.replace("\n", "<br>") + "</p>"
		for p in esc.split("\n\n") if p.strip())
	return (
		"<div style='font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden'>"
		"<div style='background:#0F1A2E;color:#fff;padding:16px 24px;font-family:Georgia,serif;font-weight:700;font-size:18px;letter-spacing:.02em'>Shradha Realty</div>"
		"<div style='padding:24px;font-size:14px;line-height:1.65'>" + paras + "</div>"
		"<div style='padding:14px 24px;background:#f3f4f6;color:#6b7280;font-size:12px'>Shradha Realty · Nagpur · This email was sent via the Shradha CRM.</div>"
		"</div>")


@frappe.whitelist()
def send_email(payload):
	"""Send an email to a lead from the user's configured account, with selected Realty Documents
	attached. Self-contained smtplib send (does not touch the site's email). Logs a Communication
	+ a lead activity so it appears on the lead's Activity timeline."""
	_guard()
	if isinstance(payload, str):
		payload = frappe.parse_json(payload)
	to = (payload.get("to") or "").strip()
	if not to or "@" not in to:
		frappe.throw(_("Enter a valid recipient email address."))
	subject = (payload.get("subject") or "").strip() or "(no subject)"
	body = (payload.get("body") or "").strip()
	if not body:
		frappe.throw(_("The email body is empty."))
	lead_name = _resolve_lead(payload.get("lead"))
	# resolve sending account
	acc_id = payload.get("account")
	acc = None
	if acc_id and frappe.db.exists("Realty Email Account", acc_id):
		acc = frappe.get_doc("Realty Email Account", acc_id)
		if acc.owner_user and acc.owner_user != frappe.session.user and not _is_manager():
			frappe.throw(_("You can't send from that account."), frappe.PermissionError)
	else:
		d = _default_email_account()
		if d:
			acc = frappe.get_doc("Realty Email Account", d["id"])
	if not acc:
		frappe.throw(_("No sending email account is configured. Add one in Settings → Email."))
	if not acc.enabled:
		frappe.throw(_("That email account is disabled."))

	from email.message import EmailMessage
	from email.utils import formataddr
	msg = EmailMessage()
	msg["Subject"] = subject
	msg["From"] = formataddr((acc.sender_name or "Shradha Realty", acc.email_id))
	msg["To"] = to
	cc = (payload.get("cc") or "").strip()
	if cc:
		msg["Cc"] = cc
	msg.set_content(body)                       # plain-text part
	msg.add_alternative(_email_html(body), subtype="html")

	# attach selected Realty Documents (any the user can read)
	from frappe.utils.file_manager import get_file
	import mimetypes
	attached = []
	for doc_id in (payload.get("attachments") or []):
		if not frappe.db.exists("Realty Document", doc_id):
			continue
		rdoc = frappe.get_doc("Realty Document", doc_id)
		if not frappe.has_permission("Realty Document", "read", rdoc) or not rdoc.file_doc:
			continue
		_fn, content = get_file(rdoc.file_url)
		if isinstance(content, str):
			content = content.encode("utf-8")
		import os
		ext = os.path.splitext(rdoc.file_name or "")[1] or ""
		mtype = rdoc.mime_type or mimetypes.guess_type(rdoc.file_name or "")[0] or "application/octet-stream"
		maintype, _sep, subtype = mtype.partition("/")
		msg.add_attachment(content, maintype=maintype or "application", subtype=subtype or "octet-stream",
			filename=(frappe.scrub(rdoc.title) or "document") + ext)
		attached.append(rdoc.title)

	# send (surface SMTP/auth failures as a clean message, not a 500)
	try:
		server = _smtp_connect(acc)
		try:
			server.send_message(msg)
		finally:
			try:
				server.quit()
			except Exception:
				pass
	except frappe.PermissionError:
		raise
	except frappe.ValidationError:
		raise
	except Exception as e:
		frappe.throw(_("Could not send the email via {0}: {1}").format(acc.email_id, str(e)[:160]))

	# audit: Communication + lead activity
	frappe.get_doc({
		"doctype": "Communication", "communication_type": "Communication",
		"communication_medium": "Email", "sent_or_received": "Sent",
		"subject": subject, "content": _email_html(body), "sender": acc.email_id,
		"recipients": to,
		"reference_doctype": "Realty Lead" if lead_name else None,
		"reference_name": lead_name or None,
	}).insert(ignore_permissions=True)
	if lead_name:
		ld = frappe.get_doc("Realty Lead", lead_name)
		atxt = (" with " + str(len(attached)) + " attachment" + ("" if len(attached) == 1 else "s")) if attached else ""
		ld.append("activities", {"activity_datetime": frappe.utils.now(),
			"who": frappe.utils.get_fullname() or "You", "activity_type": "email",
			"text": f"Email sent to {to}{atxt}: “{subject}”."})
		ld.last_activity = frappe.utils.nowdate()
		ld.save(ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "attached": attached, "to": to,
		"activities": _lead_activities(frappe.get_doc("Realty Lead", lead_name)) if lead_name else None}


# --------------------------------------------------------------------------- #
# admin / settings (manager-gated)
# --------------------------------------------------------------------------- #
# Roles a manager may assign to a new login — never System Manager (no escalation).
SAFE_REALTY_ROLES = ("Realty Sales Executive", "Realty Sales Manager", "Realty Finance", "Realty Admin")

# --------------------------------------------------------------------------- #
# user administration
#
# DELIBERATELY NARROWER than _is_manager(): approving a unit hold is a business
# decision a Sales Manager makes; resetting a colleague's password is an identity
# decision, so only Realty Admin / System Manager may do it.
#
# The manageable set is EXACTLY the rows in "Realty CRM User" (an explicit
# allowlist) — never "whoever holds a Realty role". This is a shared server: other
# people's accounts must stay invisible and untouchable from this app.
# --------------------------------------------------------------------------- #
USER_ADMIN_ROLES = ("Realty Admin", "System Manager")
PRIVILEGED_ROLES = {"System Manager", "Administrator"}
PROTECTED_USERS = {"Administrator", "Guest"}
MIN_PASSWORD_LEN = 10


def _is_user_admin():
	return any(r in USER_ADMIN_ROLES for r in frappe.get_roles())


def _require_user_admin():
	_guard()
	if not _is_user_admin():
		frappe.throw(_("Only a CRM administrator can manage logins."), frappe.PermissionError)


def _safe_role(role):
	"""Throw on anything outside the Realty four — never silently coerce."""
	if role not in SAFE_REALTY_ROLES:
		frappe.throw(_("Invalid access level: {0}").format(role))
	return role


def _is_privileged(user):
	"""True unless the login holds ONLY Realty roles.

	An allowlist, not a denylist: on a shared ERPNext box the dangerous roles are
	mostly NOT System Manager (Accounts Manager, HR Manager, Purchase Manager …),
	so "manageable" must mean "carries nothing beyond the Realty four".
	"""
	baseline = {"All", "Guest", "Desk User", "Chat User", "Blogger", "Newsletter Manager"}
	roles = set(frappe.get_roles(user)) - baseline
	if roles & PRIVILEGED_ROLES:
		return True
	return not roles.issubset(set(SAFE_REALTY_ROLES))


def _effective_role(user, fallback=None):
	"""The role actually held, HIGHEST privilege first — a login carrying both
	Sales Executive and Admin must not be displayed as merely an executive."""
	roles = set(frappe.get_roles(user))
	for r in ("Realty Admin", "Realty Sales Manager", "Realty Finance", "Realty Sales Executive"):
		if r in roles:
			return r
	return fallback or "Realty Sales Executive"


def _active_admin_logins(exclude=None):
	"""Registry logins that are enabled AND actually hold Realty Admin (live roles,
	not the mirror field, which can drift)."""
	out = []
	for u in frappe.get_all("Realty CRM User", pluck="user"):
		if exclude and u == exclude:
			continue
		if not frappe.db.get_value("User", u, "enabled"):
			continue
		if "Realty Admin" in frappe.get_roles(u):
			out.append(u)
	return out


def _register_login(email, full_name, role, sales_owner=None, password_set=False):
	"""Every login this app creates MUST land in the registry, or it becomes
	permanently unmanageable (absent from _managed_user)."""
	if frappe.db.exists("Realty CRM User", email):
		return
	frappe.get_doc({
		"doctype": "Realty CRM User", "user": email, "full_name": full_name,
		"crm_role": role, "sales_owner": sales_owner, "status": "Active", "created_by_crm": 1,
		"password_set_on": frappe.utils.now() if password_set else None,
		"password_set_by": frappe.utils.get_fullname() if password_set else None,
	}).insert(ignore_permissions=True)


def _revoke_credentials(email):
	"""After an admin sets a password: kill outstanding reset links and live
	sessions, so an old /update-password key or a stolen session can't be reused."""
	frappe.db.set_value("User", email, {
		"reset_password_key": "", "last_reset_password_key_generated_on": None},
		update_modified=False)
	try:
		frappe.sessions.clear_sessions(email, keep_current=(email == frappe.session.user), force=True)
	except Exception:
		pass


def _managed_user(email):
	"""The single choke point: resolve a login this app is allowed to act on.

	Refuses protected accounts, accounts absent from the registry, and any login
	that holds server-admin privileges (checked live, so a login that later gains
	System Manager immediately drops out of CRM management). Unknown and
	unregistered return the SAME message so this can't enumerate accounts.
	"""
	email = (email or "").strip().lower()
	generic = _("That login is not managed by this CRM.")
	if not email or email in {u.lower() for u in PROTECTED_USERS}:
		frappe.throw(generic, frappe.PermissionError)
	if not frappe.db.exists("Realty CRM User", email):
		frappe.throw(generic, frappe.PermissionError)
	if not frappe.db.exists("User", email):
		frappe.throw(generic, frappe.PermissionError)
	if _is_privileged(email):
		frappe.throw(generic, frappe.PermissionError)
	return email


def _assert_roles_unprivileged(email):
	"""Post-condition: never leave a CRM login holding server-admin roles."""
	if _is_privileged(email):
		frappe.db.rollback()
		frappe.throw(_("Refusing to grant server-administrator access."), frappe.PermissionError)


@frappe.whitelist()
def change_my_password(current_password, new_password):
	"""Self-service password change for the signed-in user.

	The CRM renders full-bleed with no desk chrome, so there is no other way for a
	client user to change the first-time password we issued them. Requires the
	current password so an unattended session can't be hijacked into a lockout.
	"""
	_guard()
	user = frappe.session.user
	if user in PROTECTED_USERS:
		frappe.throw(_("This account's password must be changed by the server administrator."))
	new_password = new_password or ""
	if len(new_password) < MIN_PASSWORD_LEN:
		frappe.throw(_("New password must be at least {0} characters.").format(MIN_PASSWORD_LEN))
	if new_password == (current_password or ""):
		frappe.throw(_("The new password must be different from the current one."))
	from frappe.utils.password import check_password
	try:
		check_password(user, current_password or "")
	except frappe.AuthenticationError:
		# Plain ValidationError on purpose: re-raising AuthenticationError makes Frappe
		# tear down the session, so a single typo would sign the user out of the app.
		frappe.throw(_("Your current password is not correct."))
	doc = frappe.get_doc("User", user)
	doc.new_password = new_password
	doc.save(ignore_permissions=True)
	# invalidate any outstanding reset link and OTHER sessions, keep this one alive
	frappe.db.set_value("User", user, {
		"reset_password_key": "", "last_reset_password_key_generated_on": None},
		update_modified=False)
	try:
		frappe.sessions.clear_sessions(user, keep_current=True, force=True)
	except Exception:
		pass
	if frappe.db.exists("Realty CRM User", user):
		frappe.db.set_value("Realty CRM User", user, {
			"password_set_on": frappe.utils.now(), "password_set_by": "self"},
			update_modified=False)
	frappe.db.commit()
	return {"ok": True}


@frappe.whitelist()
def list_crm_users():
	"""Logins this CRM manages. Deliberately NOT part of get_bootstrap — the roster
	of colleague emails/login states is admin-only."""
	_require_user_admin()
	out = []
	for r in frappe.get_all("Realty CRM User",
			fields=["name", "user", "full_name", "crm_role", "sales_owner", "status",
				"password_set_on", "created_by_crm"], order_by="creation asc"):
		if _is_privileged(r.user):
			continue  # invisible, not just unmanageable
		u = frappe.db.get_value("User", r.user, ["enabled", "last_login", "full_name"],
			as_dict=True) or {}
		out.append({
			"email": r.user, "name": r.full_name or u.get("full_name") or r.user,
			"role": _effective_role(r.user, r.crm_role),
			"roleLabel": _effective_role(r.user, r.crm_role).replace("Realty ", ""),
			"salesOwner": r.sales_owner, "status": r.status,
			"enabled": bool(u.get("enabled")), "lastLogin": _s(u.get("last_login")),
			"passwordSet": bool(r.password_set_on),
			"isSelf": r.user == frappe.session.user,
			"initials": _initials(r.full_name or u.get("full_name") or r.user),
		})
	return out


@frappe.whitelist()
def create_crm_user(payload):
	"""Create a login for client staff + register it as CRM-managed."""
	_require_user_admin()
	if isinstance(payload, str):
		payload = frappe.parse_json(payload)
	email = (payload.get("email") or "").strip().lower()
	full_name = (payload.get("full_name") or "").strip()
	role = _safe_role(payload.get("role") or "Realty Sales Executive")
	password = payload.get("password") or ""
	if not email or "@" not in email:
		frappe.throw(_("A valid email is required — it becomes the login id."))
	if not full_name:
		frappe.throw(_("Full name is required."))
	if email in {u.lower() for u in PROTECTED_USERS}:
		frappe.throw(_("That login cannot be used."), frappe.PermissionError)
	if frappe.db.exists("Realty CRM User", email) or frappe.db.exists("User", email):
		# One generic message for both cases: a distinguishing error would let any
		# client admin probe this shared box for which addresses have accounts.
		# (Never adopt an existing account either — that would hand a stranger a CRM
		# identity via _actor_owner().)
		frappe.throw(_("That email can't be used for a new CRM login. "
			"Use a different address, or ask the server administrator."))
	if password and len(password) < MIN_PASSWORD_LEN:
		frappe.throw(_("Password must be at least {0} characters.").format(MIN_PASSWORD_LEN))

	doc = frappe.get_doc({
		"doctype": "User", "email": email, "first_name": full_name,
		"enabled": 1, "send_welcome_email": 0, "user_type": "System User",
		"roles": [{"role": role}],
	})
	if password:
		doc.new_password = password
	doc.insert(ignore_permissions=True)
	_assert_roles_unprivileged(email)

	owner = payload.get("sales_owner") or None
	if owner and frappe.db.exists("Realty Sales Owner", owner):
		if not frappe.db.get_value("Realty Sales Owner", owner, "user"):
			frappe.db.set_value("Realty Sales Owner", owner, "user", email)
	else:
		owner = None
	_register_login(email, full_name, role, owner, password_set=bool(password))
	frappe.db.commit()
	return {"ok": True, "email": email, "role": role}


@frappe.whitelist()
def set_crm_user_password(email, password):
	"""Set a temporary password (works without SMTP on this box)."""
	_require_user_admin()
	email = _managed_user(email)
	password = password or ""
	if len(password) < MIN_PASSWORD_LEN:
		frappe.throw(_("Password must be at least {0} characters.").format(MIN_PASSWORD_LEN))
	u = frappe.get_doc("User", email)
	u.new_password = password
	u.save(ignore_permissions=True)
	_revoke_credentials(email)
	frappe.db.set_value("Realty CRM User", email, {
		"password_set_on": frappe.utils.now(),
		"password_set_by": frappe.utils.get_fullname()}, update_modified=False)
	frappe.db.commit()
	return {"ok": True, "email": email}


@frappe.whitelist()
def set_crm_user_status(email, enabled):
	"""Enable/disable a login. Can't disable yourself or the last active admin."""
	_require_user_admin()
	email = _managed_user(email)
	on = str(enabled) in ("1", "true", "True")
	if not on:
		if email == frappe.session.user:
			frappe.throw(_("You can't disable your own login."))
		if "Realty Admin" in frappe.get_roles(email) and not _active_admin_logins(exclude=email):
			frappe.throw(_("This is the last active CRM administrator."))
	frappe.db.set_value("User", email, "enabled", 1 if on else 0)
	frappe.db.set_value("Realty CRM User", email, "status",
		"Active" if on else "Disabled", update_modified=False)
	frappe.db.commit()
	return {"ok": True, "email": email, "enabled": on}


@frappe.whitelist()
def set_crm_user_role(email, role):
	"""Change access level. Surgical: only touches the four Realty roles, so roles
	belonging to other apps on this shared site are never removed."""
	_require_user_admin()
	email = _managed_user(email)
	role = _safe_role(role)
	if ("Realty Admin" in frappe.get_roles(email) and role != "Realty Admin"
			and not _active_admin_logins(exclude=email)):
		frappe.throw(_("This is the last active CRM administrator."))
	u = frappe.get_doc("User", email)
	have = {r.role for r in u.roles}
	drop = [r for r in SAFE_REALTY_ROLES if r != role and r in have]
	if drop:
		u.remove_roles(*drop)
	if role not in have:
		u.add_roles(role)
	_assert_roles_unprivileged(email)
	frappe.db.set_value("Realty CRM User", email, "crm_role", role, update_modified=False)
	frappe.db.commit()
	return {"ok": True, "email": email, "role": role}


@frappe.whitelist()
def link_crm_user_owner(email, sales_owner=None):
	"""Link a login to a sales rep so holds/leads are attributed to that person."""
	_require_user_admin()
	email = _managed_user(email)
	owner = sales_owner or None
	if owner and not frappe.db.exists("Realty Sales Owner", owner):
		frappe.throw(_("Sales rep {0} not found.").format(owner))
	# one login <-> one rep
	for other in frappe.get_all("Realty Sales Owner", filters={"user": email}, pluck="name"):
		if other != owner:
			frappe.db.set_value("Realty Sales Owner", other, "user", None)
	if owner:
		taken = frappe.db.get_value("Realty Sales Owner", owner, "user")
		if taken and taken != email:
			frappe.throw(_("{0} is already linked to another login.").format(owner))
		frappe.db.set_value("Realty Sales Owner", owner, "user", email)
	frappe.db.set_value("Realty CRM User", email, "sales_owner", owner, update_modified=False)
	frappe.db.commit()
	return {"ok": True, "email": email, "salesOwner": owner}


@frappe.whitelist()
def create_rep(payload):
	"""Add a sales team member (Realty Sales Owner) and, optionally, a Frappe login
	(User) linked to it — which makes hold/lead attribution real for that rep.
	Manager-gated; the login may only get a Realty role (no privilege escalation)."""
	_guard()
	if not _is_manager():
		frappe.throw(_("Only a manager can add team members."), frappe.PermissionError)
	if isinstance(payload, str):
		payload = frappe.parse_json(payload)
	full_name = (payload.get("full_name") or "").strip()
	if not full_name:
		frappe.throw(_("Name is required."))
	if frappe.db.exists("Realty Sales Owner", full_name):
		frappe.throw(_("A team member named {0} already exists.").format(full_name))
	role_text = (payload.get("role") or "Sales Executive").strip()
	initials = ("".join(w[0] for w in full_name.split()[:2])).upper() or "?"
	owner_id = _next_id("Realty Sales Owner", "owner_id", "U", 0)
	email = (payload.get("email") or "").strip().lower() or None
	want_login = bool(payload.get("createLogin")) and bool(email)
	user_link = None
	if want_login:
		frole = payload.get("frappeRole") or "Realty Sales Executive"
		if frole not in SAFE_REALTY_ROLES:
			frole = "Realty Sales Executive"
		if frappe.db.exists("User", email):
			# Never silently adopt an existing account on this shared box: linking a
			# stranger's login to a rep would hand them a CRM identity via
			# _actor_owner() and pass holder/requester gates.
			frappe.throw(_("An account with that email already exists on this server. "
				"Use a different address, or link it from Settings → Users & access."))
		else:
			u = frappe.get_doc({
				"doctype": "User", "email": email, "first_name": full_name,
				"enabled": 1, "send_welcome_email": 0,
				"roles": [{"role": frole}],
			})
			u.insert(ignore_permissions=True)
			user_link = u.name
			_register_login(user_link, full_name, frole)
	frappe.get_doc({
		"doctype": "Realty Sales Owner", "full_name": full_name, "owner_id": owner_id,
		"role": role_text, "initials": initials,
		"phone": (payload.get("phone") or "").strip() or None, "user": user_link,
	}).insert(ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "name": full_name, "owner_id": owner_id, "login": user_link}


@frappe.whitelist()
def delete_project(code):
	"""Delete a project and cascade its units/holds/visits — but refuse if it has
	real transactions (sold units, bookings) or leads still pointing at it, so no
	revenue/relationship data is silently lost. Manager-gated."""
	_guard()
	if not _is_manager():
		frappe.throw(_("Only a manager can delete a project."), frappe.PermissionError)
	code = (code or "").replace("P-", "", 1)
	if not frappe.db.exists("Realty Project", code):
		frappe.throw(_("Project {0} not found.").format(code))
	pname = frappe.db.get_value("Realty Project", code, "project_name")
	sold = frappe.db.count("Realty Unit", {"project": code, "status": "Sold"})
	if sold:
		frappe.throw(_("Can't delete {0}: {1} unit(s) are sold. Unwind those first.").format(pname, sold))
	nbook = frappe.db.count("Realty Booking", {"project_name": pname}) if pname else 0
	if nbook:
		frappe.throw(_("Can't delete {0}: it has {1} booking(s).").format(pname, nbook))
	nleads = frappe.db.count("Realty Lead", {"project": code})
	if nleads:
		frappe.throw(_("Can't delete {0}: {1} lead(s) reference it — reassign them first.").format(pname, nleads))
	# documents (+ their shares + Files) — must precede unit/project deletes (link integrity:
	# Realty Document.project/.unit Link to the project/units being removed)
	for d in frappe.get_all("Realty Document", filters={"project": code}, pluck="name"):
		for s in frappe.get_all("Realty Document Share", filters={"document": d}, pluck="name"):
			frappe.delete_doc("Realty Document Share", s, force=1, ignore_permissions=True)
		fd = frappe.db.get_value("Realty Document", d, "file_doc")
		if fd and frappe.db.exists("File", fd):
			frappe.delete_doc("File", fd, force=1, ignore_permissions=True)
		frappe.delete_doc("Realty Document", d, force=1, ignore_permissions=True)
	# safe to cascade: units (+ their holds), site visits, then the project
	units = frappe.get_all("Realty Unit", filters={"project": code}, pluck="name")
	for uid in units:
		for h in frappe.get_all("Realty Unit Hold", filters={"unit": uid}, pluck="name"):
			frappe.delete_doc("Realty Unit Hold", h, force=1, ignore_permissions=True)
		frappe.delete_doc("Realty Unit", uid, force=1, ignore_permissions=True)
	for v in frappe.get_all("Realty Site Visit", filters={"project": code}, pluck="name"):
		frappe.delete_doc("Realty Site Visit", v, force=1, ignore_permissions=True)
	frappe.delete_doc("Realty Project", code, force=1, ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "deleted": code, "units": len(units)}


@frappe.whitelist()
def add_source(name):
	"""Add a lead source (the New-Lead 'Source' dropdown). Manager-gated."""
	_guard()
	if not _is_manager():
		frappe.throw(_("Only a manager can manage sources."), frappe.PermissionError)
	name = (name or "").strip()
	if not name:
		frappe.throw(_("Source name is required."))
	if not frappe.db.exists("Realty Lead Source", name):
		frappe.get_doc({"doctype": "Realty Lead Source", "source_name": name}).insert(ignore_permissions=True)
		frappe.db.commit()
	return {"ok": True, "name": name}


@frappe.whitelist()
def delete_source(name):
	"""Remove a lead source. Refuses if any lead still uses it. Manager-gated."""
	_guard()
	if not _is_manager():
		frappe.throw(_("Only a manager can manage sources."), frappe.PermissionError)
	name = (name or "").strip()
	if not frappe.db.exists("Realty Lead Source", name):
		return {"ok": True, "name": name}
	used = frappe.db.count("Realty Lead", {"source": name})
	if used:
		frappe.throw(_("Can't remove “{0}”: {1} lead(s) use it.").format(name, used))
	frappe.delete_doc("Realty Lead Source", name, force=1, ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "name": name}


@frappe.whitelist()
def get_unit_holds(unit_id):
	"""Full hold history for a unit (audit trail), newest first."""
	_guard()
	rows = frappe.get_all("Realty Unit Hold", filters={"unit": unit_id},
		fields=["hold_id", "kind", "status", "requested_by", "requested_on", "lead",
			"lead_name", "contact_name", "contact_phone", "note", "approved_by",
			"approved_on", "closed_by", "closed_on", "close_reason"],
		order_by="creation desc")
	return [{"id": r.hold_id, "kind": r.kind, "status": r.status, "requestedBy": r.requested_by,
		"requestedOn": _s(r.requested_on), "leadName": r.lead_name, "isOutside": not bool(r.lead),
		"contactName": r.contact_name, "contactPhone": r.contact_phone, "note": r.note,
		"approvedBy": r.approved_by, "approvedOn": _s(r.approved_on), "closedBy": r.closed_by,
		"closedOn": _s(r.closed_on), "closeReason": r.close_reason} for r in rows]


def _recompute_project_counts(code):
	from collections import Counter
	statuses = frappe.get_all("Realty Unit", filters={"project": code}, pluck="status")
	c = Counter(statuses)
	# recompute total too so the stat header always reconciles (Total = the sum of states)
	frappe.db.set_value("Realty Project", code, {
		"total_units": len(statuses),
		"sold": c.get("Sold", 0), "blocked": c.get("Blocked", 0),
		"reserved": c.get("Reserved", 0), "available": c.get("Available", 0)})


@frappe.whitelist()
def advance_booking(booking_id):
	_guard()
	bk = frappe.get_doc("Realty Booking", booking_id)
	bk.check_permission("write")
	i = BOOKING_STAGES.index(bk.stage) if bk.stage in BOOKING_STAGES else 0
	if i < len(BOOKING_STAGES) - 1:
		bk.stage = BOOKING_STAGES[i + 1]
		if bk.stage == "agreement-signed":
			bk.agreement_signed = 1
		bk.save()
		frappe.db.commit()
	return {"ok": True, "stage": bk.stage}


@frappe.whitelist()
def record_receipt(due_id):
	_guard()
	due = frappe.get_doc("Realty Payment Due", due_id)
	due.check_permission("write")
	due.status = "paid"
	due.paid_at = frappe.utils.nowdate()
	due.receipt_no = _next_id("Realty Payment Due", "receipt_no", "RCP-", 4) \
		if not due.receipt_no else due.receipt_no
	due.save()
	frappe.db.commit()
	return {"ok": True, "receipt_no": due.receipt_no}


@frappe.whitelist()
def send_reminder(due_id):
	_guard()
	due = frappe.get_doc("Realty Payment Due", due_id)
	# Real SMS/WhatsApp/email gateway is a production-build item — log a
	# Communication so the action is recorded and auditable.
	frappe.get_doc({
		"doctype": "Communication", "communication_type": "Communication",
		"communication_medium": "SMS", "sent_or_received": "Sent",
		"subject": f"Payment reminder — {due.stage_name}",
		"content": f"Reminder: {frappe.utils.fmt_money(due.amount)} due on {due.due_date} "
			f"for {due.lead_name} ({due.unit}).",
		"reference_doctype": "Realty Payment Due", "reference_name": due_id,
	}).insert(ignore_permissions=True)
	frappe.db.commit()
	return {"ok": True, "message": f"Reminder logged for {due.lead_name}."}


@frappe.whitelist()
def process_payout(partner):
	_guard()
	cp = frappe.get_doc("Realty Channel Partner", partner)
	cp.check_permission("write")
	cleared = cp.outstanding
	cp.outstanding = 0
	cp.save()
	frappe.db.commit()
	return {"ok": True, "cleared": cleared}


@frappe.whitelist()
def schedule_visit(payload):
	_guard()
	if isinstance(payload, str):
		payload = frappe.parse_json(payload)
	lead = frappe.get_doc("Realty Lead", {"lead_id": payload["lead"]}) \
		if not frappe.db.exists("Realty Lead", payload.get("lead", "")) \
		else frappe.get_doc("Realty Lead", payload["lead"])
	vtime = (payload.get("time") or "11:00")
	if len(vtime.split(":")) == 2:
		vtime += ":00"
	vdate = payload.get("date") or frappe.utils.nowdate()
	doc = frappe.get_doc({
		"doctype": "Realty Site Visit",
		"visit_id": _next_id("Realty Site Visit", "visit_id", "VST-", 4),
		"lead": lead.name, "project": lead.project, "sales_owner": lead.sales_owner,
		"party_of": frappe.utils.cint(payload.get("partyOf")) or 1,
		"visit_date": vdate, "visit_time": vtime,
		"duration": 60, "mode": payload.get("mode") or "in-person",
		"status": "confirmed", "notes": payload.get("notes"),
	})
	doc.insert()
	# reflect on the lead: next-visit date + an activity entry
	lead.visit_on = vdate
	lead.last_activity = frappe.utils.nowdate()
	lead.append("activities", {"activity_datetime": frappe.utils.now(),
		"who": frappe.utils.get_fullname() or "You", "activity_type": "visit",
		"text": f"Site visit scheduled for {vdate} {vtime[:5]} "
			f"(party of {frappe.utils.cint(payload.get('partyOf')) or 1})."})
	lead.save()
	frappe.db.commit()
	return {"ok": True, "visit_id": doc.visit_id, "activities": _lead_activities(lead)}


@frappe.whitelist()
def create_project(payload):
	_guard()
	if isinstance(payload, str):
		payload = frappe.parse_json(payload)
	code = (payload.get("code") or "").strip().upper()
	if not code or not payload.get("name"):
		frappe.throw(_("Project code and name are required."))
	if frappe.db.exists("Realty Project", code):
		frappe.throw(_("Project code {0} already exists.").format(code))
	frappe.get_doc({
		"doctype": "Realty Project", "project_code": code, "project_name": payload["name"],
		"project_type": payload.get("type") or "Residential", "city": payload.get("city"),
		"locality": payload.get("locality"), "typology": payload.get("typology"),
		"possession": payload.get("possession"),
		"towers_count": frappe.utils.cint(payload.get("towers")) or 0,
		"total_units": 0, "sold": 0, "blocked": 0, "available": 0,
		"price_from": frappe.utils.flt(payload.get("priceFrom")) or 0,
		"price_to": frappe.utils.flt(payload.get("priceTo")) or 0,
	}).insert()
	frappe.db.commit()
	return {"ok": True, "code": code, "id": "P-" + code}


@frappe.whitelist()
def add_units(payload):
	"""Bulk-generate units for a project — uniform OR granular per-floor.

	Two modes in one backward-compatible function:
	- Uniform (legacy): ``{tower, floors, unitsPerFloor, typology, carpet, price}``
	  → ``floors × unitsPerFloor`` identical units.
	- Granular: ``{tower, carpetDefault, priceDefault, bands:[{from, to,
	  rows:[{typology, carpet?, price?, facing?, count}]}]}`` → a per-floor mix,
	  where ``count`` is units of that type PER FLOOR and carpet/price/facing fall
	  back to the band defaults. Single-floor bands (from==to) model a penthouse.

	Units are numbered ``<FL2><U2>`` with the unit counter resetting each floor and
	incrementing left-to-right across the floor's types; unit_id is
	``<CODE>-<TOWER>-<FL2><U2>``. Existing unit_ids are skipped (idempotent).
	"""
	_guard()
	if isinstance(payload, str):
		payload = frappe.parse_json(payload)
	code = (payload.get("project") or "").replace("P-", "", 1)
	if not frappe.db.exists("Realty Project", code):
		frappe.throw(_("Project {0} not found.").format(code))
	tower = (payload.get("tower") or "A").strip().upper()
	facings = ["East", "West", "North", "South"]
	valid_facing = set(facings)

	# Resolve everything into a per-floor plan {floor_int: [unit-template, ...]}.
	plan = {}
	bands = payload.get("bands")
	if bands:
		carpet_def = frappe.utils.flt(payload.get("carpetDefault")) or 700
		price_def = frappe.utils.flt(payload.get("priceDefault")) or 5000000
		for b in bands:
			fr = frappe.utils.cint(b.get("from"))
			to = frappe.utils.cint(b.get("to"))
			if fr < 1 or to < 1:
				frappe.throw(_("Floor numbers must be 1 or greater."))
			if fr > to:
				frappe.throw(_("'To floor' ({0}) must be greater than or equal to 'From floor' ({1}).").format(to, fr))
			if to > 99:
				frappe.throw(_("Floors above 99 are not supported."))
			templates = []
			for r in (b.get("rows") or []):
				cnt = frappe.utils.cint(r.get("count")) or 1
				if cnt < 1:
					continue
				fc = r.get("facing")
				templates.extend([{
					"typology": r.get("typology") or "2 BHK",
					"carpet": frappe.utils.flt(r.get("carpet")) or carpet_def,
					"price": frappe.utils.flt(r.get("price")) or price_def,
					"facing": fc if fc in valid_facing else None,
				}] * cnt)
			if not templates:
				continue
			if len(templates) > 99:
				frappe.throw(_("A floor cannot have more than 99 units (floors {0}–{1} have {2}).").format(fr, to, len(templates)))
			for fl in range(fr, to + 1):
				if fl in plan:
					frappe.throw(_("Floor {0} appears in more than one band.").format(fl))
				plan[fl] = templates
	else:
		floors = frappe.utils.cint(payload.get("floors")) or 1
		per_floor = frappe.utils.cint(payload.get("unitsPerFloor")) or 4
		if per_floor > 99:
			frappe.throw(_("A floor cannot have more than 99 units."))
		typ = payload.get("typology") or "2 BHK"
		carpet = frappe.utils.flt(payload.get("carpet")) or 700
		price = frappe.utils.flt(payload.get("price")) or 5000000
		for fl in range(1, floors + 1):
			plan[fl] = [{"typology": typ, "carpet": carpet, "price": price, "facing": None}
				for _ in range(per_floor)]

	created, skipped = 0, 0
	for fl in sorted(plan):
		u = 0
		for tmpl in plan[fl]:
			u += 1
			num = f"{fl:02d}{u:02d}"
			# project-scoped unit_id so codes never collide across projects
			# (the seeded AN grid uses bare "A-0101"; new projects get "<CODE>-A-0101")
			uid = f"{code}-{tower}-{num}"
			if frappe.db.exists("Realty Unit", uid):
				skipped += 1
				continue
			frappe.get_doc({
				"doctype": "Realty Unit", "unit_id": uid, "project": code, "tower": tower,
				"floor": fl, "unit_no": num, "typology": tmpl["typology"],
				"carpet_area": tmpl["carpet"], "facing": tmpl["facing"] or facings[(u - 1) % 4],
				"price": tmpl["price"], "status": "Available",
			}).insert()
			created += 1

	# refresh denormalized project rollups + ensure/update the tower row
	from collections import Counter
	statuses = frappe.get_all("Realty Unit", filters={"project": code}, pluck="status")
	c = Counter(statuses)
	proj = frappe.get_doc("Realty Project", code)
	proj.total_units = len(statuses)
	proj.sold = c.get("Sold", 0)
	proj.blocked = c.get("Blocked", 0)
	proj.reserved = c.get("Reserved", 0)
	proj.available = c.get("Available", 0)
	proj.towers_count = len(set(frappe.get_all("Realty Unit", filters={"project": code}, pluck="tower")))
	# the tower's true top floor (across existing + newly added units; handles gappy towers)
	top_floor = frappe.db.sql(
		"select max(floor) from `tabRealty Unit` where project=%s and tower=%s", (code, tower))[0][0] or 1
	row = next((t for t in proj.towers if (t.tower_code or "").upper() == tower), None)
	if row:
		row.floors = max(frappe.utils.cint(row.floors), frappe.utils.cint(top_floor))
	else:
		proj.append("towers", {"tower_code": tower, "tower_name": f"Tower {tower}", "floors": top_floor})
	proj.save()
	frappe.db.commit()
	return {"ok": True, "created": created, "skipped": skipped}
