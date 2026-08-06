"""Programmatic setup for the Dux CRM Realty app.

Creates the four Realty roles and every Realty-prefixed DocType that backs the
Shradha CRM. DocType schemas map 1:1 to the shapes in the original design
prototype's ``app/data.js``. Run once after install (also wired to
``after_install`` in hooks):

    bench --site <site> execute dux_crm_realty.install.after_install

In developer mode this writes canonical DocType JSON + controller stubs to disk
so they are version-controlled and re-synced on every ``bench migrate``.
Idempotent: existing roles / doctypes are skipped, so it is safe to re-run.
"""

import frappe

MODULE = "Dux CRM Realty"

REALTY_ROLES = [
	"Realty Sales Executive",
	"Realty Sales Manager",
	"Realty Finance",
	"Realty Admin",
]


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def f(fieldname, fieldtype, label=None, **kw):
	d = {"fieldname": fieldname, "fieldtype": fieldtype}
	if label:
		d["label"] = label
	d.update(kw)
	return d


def _perms(extra_full=None, exec_write=True, finance_write=False):
	"""Standard permission block. System Manager + Realty Admin/Manager get full
	control; Sales Executive read/write/create; Finance read (+write on money
	doctypes). Deep field/row-level hardening is a later step (see plan)."""
	full = {
		"read": 1, "write": 1, "create": 1, "delete": 1,
		"report": 1, "export": 1, "print": 1, "email": 1, "share": 1,
	}
	rows = [
		{"role": "System Manager", **full},
		{"role": "Realty Admin", **full},
		{"role": "Realty Sales Manager", **full},
	]
	if exec_write:
		rows.append({"role": "Realty Sales Executive", "read": 1, "write": 1, "create": 1, "report": 1, "export": 1, "print": 1, "email": 1, "share": 1})
	else:
		rows.append({"role": "Realty Sales Executive", "read": 1, "report": 1})
	if finance_write:
		rows.append({"role": "Realty Finance", "read": 1, "write": 1, "create": 1, "report": 1, "export": 1, "print": 1})
	else:
		rows.append({"role": "Realty Finance", "read": 1, "report": 1})
	return rows


def make_doctype(name, fields, autoname=None, istable=0, title_field=None,
		search_fields=None, perms=None, allow_rename=1):
	if frappe.db.exists("DocType", name):
		return
	doc = {
		"doctype": "DocType",
		"name": name,
		"module": MODULE,
		"custom": 0,
		"engine": "InnoDB",
		"fields": fields,
		"sort_field": "modified",
		"sort_order": "DESC",
		"allow_rename": allow_rename,
		"track_changes": 1,
		"istable": istable,
	}
	if istable:
		doc["editable_grid"] = 1
		doc["permissions"] = []
	else:
		doc["permissions"] = perms if perms is not None else _perms()
		doc["index_web_pages_for_search"] = 1
	if autoname:
		doc["autoname"] = autoname
	if title_field:
		doc["title_field"] = title_field
	if search_fields:
		doc["search_fields"] = search_fields
	frappe.get_doc(doc).insert(ignore_permissions=True)
	frappe.db.commit()


# --------------------------------------------------------------------------- #
# roles
# --------------------------------------------------------------------------- #
def create_roles():
	for r in REALTY_ROLES:
		if not frappe.db.exists("Role", r):
			frappe.get_doc({
				"doctype": "Role",
				"role_name": r,
				"desk_access": 1,
			}).insert(ignore_permissions=True)
	frappe.db.commit()


# --------------------------------------------------------------------------- #
# doctypes (child tables first, then masters, then transactional)
# --------------------------------------------------------------------------- #
def create_doctypes():
	# ---- child tables ----
	make_doctype("Realty Tower", istable=1, fields=[
		f("tower_code", "Data", "Tower Code", in_list_view=1, reqd=1),
		f("tower_name", "Data", "Tower Name", in_list_view=1),
		f("floors", "Int", "Floors", in_list_view=1),
	])

	make_doctype("Realty Lead Activity", istable=1, fields=[
		f("activity_datetime", "Datetime", "When", in_list_view=1),
		f("who", "Data", "Who", in_list_view=1),
		f("activity_type", "Select", "Type", options="created\ncall\nwhatsapp\nemail\nvisit\nnote", in_list_view=1),
		f("text", "Small Text", "Text", in_list_view=1),
	])

	make_doctype("Realty Cost Sheet Item", istable=1, fields=[
		f("label", "Data", "Label", in_list_view=1),
		f("amount", "Currency", "Amount", in_list_view=1),
	])

	make_doctype("Realty Payment Plan Item", istable=1, fields=[
		f("stage_name", "Data", "Stage", in_list_view=1, reqd=1),
		f("pct", "Float", "Percent", in_list_view=1),
		f("trigger", "Data", "Trigger", in_list_view=1),
	])

	# ---- masters ----
	make_doctype("Realty Lead Stage", autoname="field:stage_id",
		title_field="label", fields=[
		f("stage_id", "Data", "Stage ID", reqd=1, unique=1, in_list_view=1),
		f("label", "Data", "Label", reqd=1, in_list_view=1),
		f("tone", "Select", "Tone", options="info\nneutral\namber\ncoral\nsuccess\nerror", in_list_view=1),
		f("sort_order", "Int", "Sort Order", in_list_view=1),
	])

	make_doctype("Realty Lead Source", autoname="field:source_name", fields=[
		f("source_name", "Data", "Source Name", reqd=1, unique=1, in_list_view=1),
	])

	make_doctype("Realty Sales Owner", autoname="field:full_name",
		title_field="full_name", fields=[
		f("full_name", "Data", "Full Name", reqd=1, unique=1, in_list_view=1),
		f("owner_id", "Data", "Owner ID", in_list_view=1),
		f("role", "Data", "Role", in_list_view=1),
		f("initials", "Data", "Initials", in_list_view=1),
		# session->rep mapping for hold attribution (blank until reps get Frappe logins)
		f("user", "Link", "User", options="User"),
		f("phone", "Data", "Phone"),
	# BLOCKER FIX: `user` decides whose identity a session resolves to
	# (_actor_owner). If sales executives can write this doctype, any of them can
	# point a rep row at their own login and inherit that rep's holds/leads.
	# Managers/admins write; everyone else reads.
	], perms=_perms(exec_write=False))

	# child table that links a master (Sales Owner) — created after it exists
	make_doctype("Realty Lead Task", istable=1, fields=[
		f("title", "Data", "Title", in_list_view=1, reqd=1),
		f("due_date", "Date", "Due", in_list_view=1),
		f("done", "Check", "Done", in_list_view=1),
		f("owner_rep", "Link", "Owner", options="Realty Sales Owner", in_list_view=1),
		f("priority", "Select", "Priority", options="low\nmed\nhigh", in_list_view=1),
	])

	make_doctype("Realty Message Template", autoname="field:template_name", fields=[
		f("template_name", "Data", "Template Name", reqd=1, unique=1, in_list_view=1),
		f("channel", "Select", "Channel", options="SMS\nWhatsApp\nEmail\nCall", in_list_view=1),
		f("body", "Text", "Body"),
	])

	make_doctype("Realty Channel Partner", autoname="field:partner_name",
		title_field="partner_name", search_fields="contact_person,phone", fields=[
		f("partner_name", "Data", "Partner Name", reqd=1, unique=1, in_list_view=1),
		f("contact_person", "Data", "Contact Person", in_list_view=1),
		f("tier", "Select", "Tier", options="Platinum\nGold\nSilver", in_list_view=1),
		f("rera", "Data", "RERA No."),
		f("phone", "Data", "Phone"),
		f("email", "Data", "Email"),
		f("col_break_cp", "Column Break"),
		f("total_leads", "Int", "Total Leads"),
		f("bookings", "Int", "Bookings"),
		f("commission", "Currency", "Commission Earned"),
		f("outstanding", "Currency", "Outstanding Payout"),
	])

	make_doctype("Realty Payment Plan", autoname="field:plan_name",
		title_field="plan_name", fields=[
		f("plan_name", "Data", "Plan Name", reqd=1, unique=1, in_list_view=1),
		f("items", "Table", "Milestones", options="Realty Payment Plan Item"),
	])

	# ---- core: project + tower, unit ----
	make_doctype("Realty Project", autoname="field:project_code",
		title_field="project_name", search_fields="project_name,locality,city", fields=[
		f("project_code", "Data", "Project Code", reqd=1, unique=1, in_list_view=1),
		f("project_name", "Data", "Project Name", reqd=1, in_list_view=1),
		f("project_type", "Select", "Type", options="Residential\nCommercial\nRow Houses", in_list_view=1),
		f("city", "Data", "City"),
		f("locality", "Data", "Locality"),
		f("typology", "Data", "Typology"),
		f("possession", "Data", "Possession"),
		f("col_break_proj", "Column Break"),
		f("towers_count", "Int", "Towers"),
		f("total_units", "Int", "Total Units"),
		f("sold", "Int", "Sold"),
		f("blocked", "Int", "Blocked"),
		f("reserved", "Int", "Reserved"),
		f("available", "Int", "Available"),
		f("price_from", "Currency", "Price From"),
		f("price_to", "Currency", "Price To"),
		f("sec_break_towers", "Section Break", "Towers"),
		f("towers", "Table", "Towers", options="Realty Tower"),
		f("sec_break_img", "Section Break", "Imagery"),
		f("facade_image", "Attach Image", "Facade Image"),
		f("aerial_image", "Attach Image", "Aerial Image"),
	])

	make_doctype("Realty Unit", autoname="field:unit_id",
		search_fields="project,tower,typology", fields=[
		f("unit_id", "Data", "Unit ID", reqd=1, unique=1, in_list_view=1),
		f("project", "Link", "Project", options="Realty Project", in_list_view=1, reqd=1),
		f("tower", "Data", "Tower", in_list_view=1),
		f("floor", "Int", "Floor", in_list_view=1),
		f("unit_no", "Data", "Unit No."),
		f("typology", "Data", "Typology", in_list_view=1),
		f("col_break_unit", "Column Break"),
		f("carpet_area", "Float", "Carpet Area (sqft)"),
		f("facing", "Select", "Facing", options="East\nWest\nNorth\nSouth"),
		f("price", "Currency", "Price", in_list_view=1),
		f("status", "Select", "Status", options="Available\nBlocked\nReserved\nSold", in_list_view=1, default="Available"),
	])

	# ---- lead ----
	make_doctype("Realty Lead", autoname="field:lead_id",
		title_field="lead_name", search_fields="lead_name,phone,email", fields=[
		f("lead_id", "Data", "Lead ID", reqd=1, unique=1, in_list_view=1),
		f("lead_name", "Data", "Name", reqd=1, in_list_view=1),
		f("phone", "Data", "Phone", in_list_view=1),
		f("email", "Data", "Email"),
		f("occupation", "Data", "Occupation"),
		f("city", "Data", "City"),
		f("col_break_lead1", "Column Break"),
		f("stage", "Link", "Stage", options="Realty Lead Stage", in_list_view=1),
		f("score", "Int", "Score", in_list_view=1),
		f("starred", "Check", "Starred"),
		f("followups", "Int", "Follow-ups"),
		f("tags_text", "Small Text", "Tags"),
		f("sec_break_interest", "Section Break", "Interest"),
		f("project", "Link", "Project", options="Realty Project"),
		f("interest", "Data", "Configuration"),
		f("budget", "Currency", "Budget"),
		f("col_break_lead2", "Column Break"),
		f("source", "Link", "Source", options="Realty Lead Source"),
		f("channel_partner", "Link", "Channel Partner", options="Realty Channel Partner"),
		f("sales_owner", "Link", "Owner", options="Realty Sales Owner"),
		f("sec_break_dates", "Section Break", "Timeline"),
		f("lead_created", "Date", "Created On"),
		f("last_activity", "Date", "Last Activity"),
		f("col_break_lead3", "Column Break"),
		f("visit_on", "Date", "Next Visit"),
		f("sec_break_activity", "Section Break", "Activity"),
		f("activities", "Table", "Activities", options="Realty Lead Activity"),
		f("sec_break_tasks", "Section Break", "Tasks"),
		f("tasks", "Table", "Tasks", options="Realty Lead Task"),
		f("sec_break_cost", "Section Break", "Cost Sheet"),
		f("cost_sheet_items", "Table", "Cost Sheet", options="Realty Cost Sheet Item"),
	])

	# ---- site visit ----
	make_doctype("Realty Site Visit", autoname="field:visit_id",
		title_field="lead_name", fields=[
		f("visit_id", "Data", "Visit ID", reqd=1, unique=1, in_list_view=1),
		f("lead", "Link", "Lead", options="Realty Lead", in_list_view=1),
		f("lead_name", "Data", "Lead Name", fetch_from="lead.lead_name", read_only=1, in_list_view=1),
		f("project", "Link", "Project", options="Realty Project"),
		f("sales_owner", "Link", "Owner", options="Realty Sales Owner", in_list_view=1),
		f("col_break_visit", "Column Break"),
		f("party_of", "Int", "Party Of"),
		f("visit_date", "Date", "Date", in_list_view=1),
		f("visit_time", "Time", "Time", in_list_view=1),
		f("duration", "Int", "Duration (min)"),
		f("mode", "Select", "Mode", options="in-person\nvirtual"),
		f("status", "Select", "Status", options="confirmed\nin-progress\ncompleted\nno-show\ntentative", in_list_view=1),
		f("pickup", "Check", "Pickup Required"),
		f("notes", "Small Text", "Notes"),
	])

	# ---- booking ----
	make_doctype("Realty Booking", autoname="field:booking_id",
		title_field="lead_name", search_fields="lead_name,unit", fields=[
		f("booking_id", "Data", "Booking ID", reqd=1, unique=1, in_list_view=1),
		f("booking_date", "Date", "Booking Date", in_list_view=1),
		f("lead", "Link", "Lead", options="Realty Lead"),
		f("lead_name", "Data", "Customer", in_list_view=1),
		f("project_name", "Data", "Project", in_list_view=1),
		f("unit", "Data", "Unit", in_list_view=1),
		f("typology", "Data", "Typology"),
		f("carpet", "Float", "Carpet (sqft)"),
		f("col_break_bk", "Column Break"),
		f("stage", "Select", "Stage", options="token-received\nagreement-signed\nregistration-pending\nregistered", in_list_view=1),
		f("sales_owner_name", "Data", "Sales Owner"),
		f("token_amount", "Currency", "Token Amount"),
		f("token_paid", "Check", "Token Paid"),
		f("agreement_signed", "Check", "Agreement Signed"),
		f("sec_break_cost", "Section Break", "Cost Sheet"),
		f("bsp", "Currency", "Basic Sale Price"),
		f("other_charges", "Currency", "Other Charges"),
		f("col_break_cost", "Column Break"),
		f("gst", "Currency", "GST"),
		f("total", "Currency", "Total Payable", read_only=1),
	], perms=_perms(finance_write=True))

	# ---- payment plan template handled above; payment dues ----
	make_doctype("Realty Payment Due", autoname="field:due_id",
		search_fields="lead_name,unit,booking", fields=[
		f("due_id", "Data", "Due ID", reqd=1, unique=1, in_list_view=1),
		f("booking", "Link", "Booking", options="Realty Booking", in_list_view=1),
		f("lead_name", "Data", "Customer", in_list_view=1),
		f("unit", "Data", "Unit"),
		f("project_name", "Data", "Project"),
		f("col_break_due", "Column Break"),
		f("stage_name", "Data", "Milestone", in_list_view=1),
		f("pct", "Float", "Percent of BSP"),
		f("amount", "Currency", "Amount", in_list_view=1),
		f("due_date", "Date", "Due Date", in_list_view=1),
		f("status", "Select", "Status", options="paid\noverdue\ndue\nscheduled", in_list_view=1),
		f("paid_at", "Date", "Paid On"),
		f("receipt_no", "Data", "Receipt No."),
	], perms=_perms(finance_write=True))

	# ---- campaign ----
	make_doctype("Realty Campaign", autoname="field:campaign_id",
		title_field="campaign_name", fields=[
		f("campaign_id", "Data", "Campaign ID", reqd=1, unique=1, in_list_view=1),
		f("campaign_name", "Data", "Campaign Name", reqd=1, in_list_view=1),
		f("channel", "Data", "Channel", in_list_view=1),
		f("status", "Select", "Status", options="active\nended\nscheduled", in_list_view=1),
		f("col_break_camp", "Column Break"),
		f("start_date", "Date", "Start Date"),
		f("end_date", "Date", "End Date"),
		f("budget", "Currency", "Budget"),
		f("spent", "Currency", "Spent"),
		f("sec_break_camp", "Section Break", "Performance"),
		f("leads", "Int", "Leads"),
		f("qualified", "Int", "Qualified"),
		f("visits", "Int", "Visits"),
		f("col_break_camp2", "Column Break"),
		f("bookings", "Int", "Bookings"),
		f("cpl", "Currency", "Cost Per Lead"),
	])

	# ---- task (standalone — drives the personal calendar) ----
	make_doctype("Realty Task", autoname="field:task_id", title_field="title",
		search_fields="title,assigned_to,lead_name", fields=[
		f("task_id", "Data", "Task ID", reqd=1, unique=1, in_list_view=1),
		f("title", "Data", "Title", reqd=1, in_list_view=1),
		f("task_type", "Select", "Type", in_list_view=1,
			options="Follow-up call\nWhatsApp\nEmail\nSite visit\nSend documents\nCollect documents\nPayment follow-up\nMeeting\nOther",
			default="Follow-up call"),
		f("status", "Select", "Status", options="Open\nDone", default="Open", in_list_view=1),
		f("priority", "Select", "Priority", options="low\nmed\nhigh", default="med", in_list_view=1),
		f("col_break_task", "Column Break"),
		f("assigned_to", "Link", "Assigned To", options="Realty Sales Owner", in_list_view=1),
		f("due_date", "Date", "Due Date", in_list_view=1),
		f("due_time", "Time", "Due Time"),
		f("created_by_name", "Data", "Created By"),
		f("sec_break_task", "Section Break", "Related"),
		f("lead", "Link", "Lead", options="Realty Lead"),
		f("lead_name", "Data", "Lead Name", fetch_from="lead.lead_name", read_only=1),
		f("notes", "Small Text", "Notes"),
	])

	# ---- CRM login registry (the ALLOWLIST that bounds user management) ----
	# Membership is EXPLICIT: only logins listed here can be managed from the app.
	# Never derived from "holds a Realty role" — this is a shared server and other
	# people's accounts must stay invisible and untouchable.
	make_doctype("Realty CRM User", autoname="field:user", title_field="user",
		search_fields="user,full_name", fields=[
		f("user", "Link", "Login (User)", options="User", reqd=1, unique=1, in_list_view=1),
		f("full_name", "Data", "Full Name", in_list_view=1),
		f("crm_role", "Select", "CRM Role", in_list_view=1, default="Realty Sales Executive",
			options="Realty Sales Executive\nRealty Sales Manager\nRealty Finance\nRealty Admin"),
		f("sales_owner", "Link", "Sales Rep", options="Realty Sales Owner"),
		f("col_break_cu", "Column Break"),
		f("status", "Select", "Status", options="Active\nDisabled", default="Active", in_list_view=1),
		f("created_by_crm", "Check", "Created by CRM"),
		f("password_set_on", "Datetime", "Password Last Set On", read_only=1),
		f("password_set_by", "Data", "Password Last Set By", read_only=1),
		f("notes", "Small Text", "Notes"),
	], perms=[
		# BLOCKER FIX: the allowlist must NOT be writable by the role it bounds.
		# Realty Admin manages logins only through the whitelisted endpoints (which
		# use ignore_permissions); direct desk write would let them add themselves.
		{"role": "System Manager", "read": 1, "write": 1, "create": 1, "delete": 1, "report": 1, "print": 1},
		{"role": "Realty Admin", "read": 1},
	])

	# ---- unit hold / reserve ledger (audit log; one record per request) ----
	make_doctype("Realty Unit Hold", autoname="field:hold_id", title_field="hold_id",
		search_fields="unit,requested_by,lead_name", fields=[
		f("hold_id", "Data", "Hold ID", reqd=1, unique=1, in_list_view=1),
		f("unit", "Link", "Unit", options="Realty Unit", reqd=1, in_list_view=1),
		f("kind", "Select", "Kind", options="Hold\nReserve", default="Hold", in_list_view=1),
		f("status", "Select", "Status", options="Requested\nApproved\nRejected\nReleased\nOverridden",
			default="Requested", in_list_view=1),
		f("col_break_hold", "Column Break"),
		f("requested_by", "Link", "Requested By", options="Realty Sales Owner", in_list_view=1),
		f("requested_on", "Datetime", "Requested On"),
		f("approved_by", "Data", "Approved By"),
		f("approved_on", "Datetime", "Approved On"),
		f("sec_break_hold_lead", "Section Break", "Lead / Contact"),
		# lead set => CRM lead; else outside enquiry (contact_*). lead_name is frozen at
		# request time (NOT fetch_from) so the audit row stays historical.
		f("lead", "Link", "Lead", options="Realty Lead"),
		f("lead_name", "Data", "Lead Name"),
		f("contact_name", "Data", "Outside Contact Name"),
		f("contact_phone", "Data", "Outside Contact Phone"),
		f("note", "Small Text", "Note"),
		f("sec_break_hold_close", "Section Break", "Closure"),
		f("closed_by", "Data", "Closed By"),
		f("closed_on", "Datetime", "Closed On"),
		f("close_reason", "Data", "Close Reason"),
	])

	# ---- DMS: stored document (one row per uploaded file) ----
	# File lives as a PRIVATE Frappe File attached to this doc (attached_to_doctype/name);
	# file_url is NEVER shipped to the client — internal downloads go via download_document,
	# external sharing only via an approved Realty Document Share link. allow_rename=0 keeps
	# the audit id immutable.
	make_doctype("Realty Document", autoname="field:document_id", title_field="title",
		search_fields="title,project,category,tags_text", allow_rename=0, fields=[
		f("document_id", "Data", "Document ID", reqd=1, unique=1, in_list_view=1),
		f("title", "Data", "Title", reqd=1, in_list_view=1),
		f("category", "Select", "Category", in_list_view=1, default="Other",
			options="Brochure\nCost Sheet\nFloor Plan\nAgreement\nKYC\nPrice List\n"
				"Allotment Letter\nReceipt\nRERA\nLegal\nOther"),
		f("status", "Select", "Status", options="Active\nArchived", default="Active", in_list_view=1),
		f("tags_text", "Small Text", "Tags"),
		f("col_break_doc1", "Column Break"),
		f("project", "Link", "Project", options="Realty Project", reqd=1, in_list_view=1),
		f("unit", "Link", "Unit", options="Realty Unit"),
		f("lead", "Link", "Lead", options="Realty Lead"),
		f("booking", "Link", "Booking", options="Realty Booking"),
		f("shareable", "Check", "Shareable", default="0"),
		f("sec_break_doc_file", "Section Break", "File"),
		f("file_doc", "Link", "File", options="File"),
		f("file_url", "Data", "File URL", read_only=1),
		f("file_name", "Data", "File Name", read_only=1),
		f("file_size", "Int", "File Size (bytes)", read_only=1),
		f("mime_type", "Data", "MIME Type", read_only=1),
		f("content_hash", "Data", "Content Hash", read_only=1),
		f("col_break_doc2", "Column Break"),
		f("uploaded_by", "Data", "Uploaded By"),
		f("uploaded_on", "Datetime", "Uploaded On"),
		f("notes", "Small Text", "Notes"),
	])

	# ---- DMS: document share ledger (one row per share request; mirrors Realty Unit Hold) ----
	# State machine: Requested -> Approved (key minted, link live) -> Rejected/Revoked/Expired.
	# share_key is unguessable + UNIQUE, minted ONLY on manager approval. allow_rename=0.
	make_doctype("Realty Document Share", autoname="field:share_id", title_field="share_id",
		search_fields="document,lead,requested_by", allow_rename=0, fields=[
		f("share_id", "Data", "Share ID", reqd=1, unique=1, in_list_view=1),
		f("document", "Link", "Document", options="Realty Document", reqd=1, in_list_view=1),
		f("document_title", "Data", "Document Title"),
		f("lead", "Link", "Shared With (Lead)", options="Realty Lead", reqd=1, in_list_view=1),
		f("lead_name", "Data", "Lead Name"),
		f("status", "Select", "Status", in_list_view=1, default="Requested",
			options="Requested\nApproved\nRejected\nRevoked\nExpired"),
		f("channel", "Select", "Channel", options="Link\nComms", default="Link"),
		f("col_break_share1", "Column Break"),
		f("requested_by", "Link", "Requested By", options="Realty Sales Owner", in_list_view=1),
		f("requested_on", "Datetime", "Requested On"),
		f("approved_by", "Data", "Approved By"),
		f("approved_on", "Datetime", "Approved On"),
		f("note", "Small Text", "Note"),
		f("sec_break_share_link", "Section Break", "Share Link"),
		f("share_key", "Data", "Share Key", read_only=1, unique=1),
		f("expires_on", "Datetime", "Expires On"),
		f("access_count", "Int", "Access Count", default="0"),
		f("last_accessed_on", "Datetime", "Last Accessed On"),
		f("last_accessed_ip", "Data", "Last Accessed IP"),
		f("sec_break_share_close", "Section Break", "Closure"),
		f("closed_by", "Data", "Closed By"),
		f("closed_on", "Datetime", "Closed On"),
		f("close_reason", "Data", "Close Reason"),
	])

	# ---- Email: per-user sending account (SMTP). The smtp_password is a Password field
	# (encrypted in the __Auth table). This is SELF-CONTAINED — sending uses smtplib with
	# these creds directly and NEVER touches Frappe's site-wide Email Account / default
	# outgoing, so it can't disturb other apps on this shared box. owner_user blank = a
	# shared/global account anyone can use; otherwise it belongs to that login.
	make_doctype("Realty Email Account", autoname="field:account_id", title_field="email_id",
		search_fields="email_id,sender_name", allow_rename=0, fields=[
		f("account_id", "Data", "Account ID", reqd=1, unique=1, in_list_view=1),
		f("email_id", "Data", "Email Address", reqd=1, in_list_view=1),
		f("sender_name", "Data", "Sender Name", in_list_view=1),
		f("col_break_ea1", "Column Break"),
		f("owner_user", "Link", "Owner (User)", options="User"),
		f("is_default", "Check", "Default", default="0", in_list_view=1),
		f("enabled", "Check", "Enabled", default="1"),
		f("has_password", "Check", "Password Set", read_only=1, default="0"),
		f("sec_break_ea_smtp", "Section Break", "SMTP"),
		f("smtp_host", "Data", "SMTP Host", default="smtp.gmail.com"),
		f("smtp_port", "Int", "SMTP Port", default="465"),
		f("use_ssl", "Check", "Use SSL", default="1"),
		f("col_break_ea2", "Column Break"),
		f("smtp_password", "Password", "App Password"),
		f("last_tested", "Datetime", "Last Tested"),
		f("last_status", "Data", "Last Status"),
	])


def after_install():
	create_roles()
	create_doctypes()
	frappe.db.commit()
	print("dux_crm_realty: roles + doctypes created.")
