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

CRM_ROLES = (
	"System Manager", "Realty Admin", "Realty Sales Manager",
	"Realty Sales Executive", "Realty Finance",
)

STAGE_ORDER = ["new", "contacted", "qualified", "visit", "negotiation", "booked", "lost"]
BOOKING_STAGES = ["token-received", "agreement-signed", "registration-pending", "registered"]

# Static illustrative documents (prototype lead-detail DocsTab is global).
DOCUMENTS = [
	{"name": "Cost-Sheet_AN_Tower-B_705_v3.pdf", "size": "412 KB", "at": "2026-04-28"},
	{"name": "Brochure_Abhiman-Niwas.pdf", "size": "8.2 MB", "at": "2026-04-14"},
	{"name": "PAN_RajeshKhandelwal.jpg", "size": "1.4 MB", "at": "2026-04-17"},
	{"name": "Aadhaar_RajeshKhandelwal.pdf", "size": "1.1 MB", "at": "2026-04-17"},
]


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
		fields=["full_name", "owner_id", "role", "initials"], order_by="owner_id")
	owner_by_name = {o.full_name: o for o in owners}

	projects_raw = frappe.get_all("Realty Project", fields=[
		"project_code", "project_name", "project_type", "city", "locality",
		"typology", "possession", "towers_count", "total_units", "sold",
		"blocked", "available", "price_from", "price_to"], order_by="project_code")
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

	# standalone tasks (drive the personal calendar) — shaped, grouped by lead + kept whole
	def _shape_task(t):
		o = owner_by_name.get(t.assigned_to) or {}
		return {"id": t.task_id, "title": t.title, "type": t.task_type, "status": t.status,
			"done": t.status == "Done", "priority": t.priority, "assignedTo": t.assigned_to,
			"assignedToInitials": o.get("initials"), "ownerName": t.assigned_to,
			"due": _s(t.due_date), "dueDate": _s(t.due_date), "dueTime": _s(t.due_time),
			"lead": t.lead, "leadName": t.lead_name, "notes": t.notes}
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
	grids = {}
	floor7b = []
	for u in units_raw:
		unit = {"id": u.unit_id, "tower": u.tower, "floor": u.floor, "num": u.unit_no,
			"typology": u.typology, "carpet": u.carpet_area, "facing": u.facing,
			"price": u.price, "status": (u.status or "").lower()}
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
		"blocked": p.blocked, "available": p.available, "typology": p.typology,
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
		"currentUser": _current_owner(),
		"tasks": all_tasks,
		"activity": focused["activities"] if focused else [],
		"projects": projects, "sources": sources, "stages": stages, "owners": [
			{"id": o.owner_id, "name": o.full_name, "role": o.role, "initials": o.initials}
			for o in owners],
		"channelPartners": channel_partners, "leads": leads, "documents": DOCUMENTS,
		"inventory": {"P-AN": {"towers": an_towers, "units": floor7b}},
		"abhimanGrid": grid, "grids": grids, "visits": visits, "bookings": bookings,
		"paymentTemplate": payment_template, "paymentDues": payment_dues,
		"campaigns": campaigns,
	}


def _current_owner():
	"""Greeting target — pinned to the prototype's logged-in rep when present."""
	if frappe.db.exists("Realty Sales Owner", "Priya Deshmukh"):
		return {"name": "Priya Deshmukh", "initials": "PD", "role": "Sales Executive"}
	first = frappe.get_all("Realty Sales Owner", fields=["full_name", "initials", "role"], limit=1)
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
def block_unit(unit_id):
	_guard()
	unit = frappe.get_doc("Realty Unit", unit_id)
	unit.check_permission("write")
	unit.status = "Available" if unit.status == "Blocked" else "Blocked"
	unit.save()
	_recompute_project_counts(unit.project)
	frappe.db.commit()
	return {"ok": True, "unit": unit_id, "status": unit.status.lower()}


def _recompute_project_counts(code):
	from collections import Counter
	c = Counter(frappe.get_all("Realty Unit", filters={"project": code}, pluck="status"))
	frappe.db.set_value("Realty Project", code, {
		"sold": c.get("Sold", 0), "blocked": c.get("Blocked", 0),
		"available": c.get("Available", 0)})


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
	"""Bulk-generate units for a project: tower x floors x units/floor."""
	_guard()
	if isinstance(payload, str):
		payload = frappe.parse_json(payload)
	code = (payload.get("project") or "").replace("P-", "", 1)
	if not frappe.db.exists("Realty Project", code):
		frappe.throw(_("Project {0} not found.").format(code))
	tower = (payload.get("tower") or "A").strip().upper()
	floors = frappe.utils.cint(payload.get("floors")) or 1
	per_floor = frappe.utils.cint(payload.get("unitsPerFloor")) or 4
	typology = payload.get("typology") or "2 BHK"
	carpet = frappe.utils.flt(payload.get("carpet")) or 700
	price = frappe.utils.flt(payload.get("price")) or 5000000
	facings = ["East", "West", "North", "South"]
	created = 0
	for fl in range(1, floors + 1):
		for u in range(1, per_floor + 1):
			num = f"{fl:02d}{u:02d}"
			# project-scoped unit_id so codes never collide across projects
			# (the seeded AN grid uses bare "A-0101"; new projects get "<CODE>-A-0101")
			uid = f"{code}-{tower}-{num}"
			if frappe.db.exists("Realty Unit", uid):
				continue
			frappe.get_doc({
				"doctype": "Realty Unit", "unit_id": uid, "project": code, "tower": tower,
				"floor": fl, "unit_no": num, "typology": typology, "carpet_area": carpet,
				"facing": facings[(u - 1) % 4], "price": price, "status": "Available",
			}).insert()
			created += 1

	# refresh denormalized project rollups + ensure a tower row exists
	from collections import Counter
	statuses = frappe.get_all("Realty Unit", filters={"project": code}, pluck="status")
	c = Counter(statuses)
	proj = frappe.get_doc("Realty Project", code)
	proj.total_units = len(statuses)
	proj.sold = c.get("Sold", 0)
	proj.blocked = c.get("Blocked", 0)
	proj.available = c.get("Available", 0)
	proj.towers_count = len(set(frappe.get_all("Realty Unit", filters={"project": code}, pluck="tower")))
	if not any((t.tower_code or "").upper() == tower for t in proj.towers):
		proj.append("towers", {"tower_code": tower, "tower_name": f"Tower {tower}", "floors": floors})
	proj.save()
	frappe.db.commit()
	return {"ok": True, "created": created}
