"""Seed the Dux CRM Realty doctypes with the prototype's illustrative dataset.

Data source: ``seed_data.json`` — produced by running the design prototype's
``app/data.js`` through Node (see ``scripts/gen_seed.js``), so the live app shows
the exact same leads / inventory / visits / bookings the comps were drawn from.
All dates are relative to the prototype's pinned "today" = 2026-04-29; the React
app pins the same reference date so relative labels ("Tomorrow", "18d ago") match.

Run:
    bench --site <site> execute dux_crm_realty.seed.run                 # clear + seed
    bench --site <site> execute dux_crm_realty.seed.run --kwargs "{'clear': False}"
"""

import datetime
import json
import os

import frappe

DATA_PATH = os.path.join(os.path.dirname(__file__), "seed_data.json")

# pinned demo "today" — keep in sync with api/crm.get_bootstrap()["today"]
TODAY = datetime.date(2026, 4, 29)


def days_from_now(n):
	return (TODAY + datetime.timedelta(days=n)).isoformat()

# Pricing-tab rows for the focused lead (hard-coded in the prototype's
# lead-detail.jsx PricingTab, not in data.js).
RAJESH_COST_SHEET = [
	("Base price (Unit B-705, 1145 sqft)", 7920000),
	("Floor rise (7th floor @ ₹50/sqft)", 57250),
	("East-facing premium", 68700),
	("Covered parking (2 slots)", 300000),
	("Club membership", 75000),
	("Negotiated discount", -202000),
]

MESSAGE_TEMPLATES = [
	("Welcome SMS", "SMS"),
	("Visit confirmation", "WhatsApp"),
	("Follow-up call script", "Call"),
	("Booking confirmation", "WhatsApp"),
	("Payment reminder", "SMS"),
	("Possession invite", "Email"),
]

# doctypes wiped on reseed — children first is irrelevant for db.delete, but
# transactional-before-master keeps it tidy.
CLEAR_ORDER = [
	"Realty Payment Due", "Realty Booking", "Realty Site Visit", "Realty Lead",
	"Realty Unit", "Realty Campaign", "Realty Channel Partner", "Realty Sales Owner",
	"Realty Lead Source", "Realty Lead Stage", "Realty Message Template",
	"Realty Project", "Realty Payment Plan",
	# child tables
	"Realty Tower", "Realty Lead Activity", "Realty Lead Task",
	"Realty Cost Sheet Item", "Realty Payment Plan Item",
]


def _load():
	with open(DATA_PATH, encoding="utf-8") as fh:
		return json.load(fh)


def _proj_code(pid):
	"""'P-AN' -> 'AN' (the Realty Project name)."""
	return (pid or "").replace("P-", "", 1)


def _ins(doc):
	frappe.get_doc(doc).insert(ignore_permissions=True, ignore_if_duplicate=True)


def clear_all():
	for dt in CLEAR_ORDER:
		if frappe.db.exists("DocType", dt):
			frappe.db.delete(dt)
	frappe.db.commit()


def run(clear=True):
	d = _load()
	if clear:
		clear_all()

	owners_by_id = {o["id"]: o for o in d["owners"]}

	# ---- masters ----
	for i, s in enumerate(d["stages"]):
		_ins({"doctype": "Realty Lead Stage", "stage_id": s["id"],
			"label": s["label"], "tone": s["tone"], "sort_order": i})

	for s in d["sources"]:
		_ins({"doctype": "Realty Lead Source", "source_name": s})

	for o in d["owners"]:
		_ins({"doctype": "Realty Sales Owner", "full_name": o["name"],
			"owner_id": o["id"], "role": o["role"], "initials": o["initials"]})

	for name, channel in MESSAGE_TEMPLATES:
		_ins({"doctype": "Realty Message Template", "template_name": name, "channel": channel})

	for cp in d["channelPartners"]:
		_ins({"doctype": "Realty Channel Partner", "partner_name": cp["name"],
			"contact_person": cp.get("contact"), "tier": cp.get("tier"),
			"rera": cp.get("rera"), "phone": cp.get("phone"), "email": cp.get("email"),
			"total_leads": cp.get("totalLeads", 0), "bookings": cp.get("bookings", 0),
			"commission": cp.get("commission", 0), "outstanding": cp.get("outstanding", 0)})

	# ---- projects (+ towers child) ----
	# named towers only known for Abhiman Niwas (the only project with a grid)
	an_towers = d["inventory"].get("P-AN", {}).get("towers", [])
	for p in d["projects"]:
		towers = []
		if p["id"] == "P-AN":
			towers = [{"tower_code": t["id"], "tower_name": t["name"], "floors": t["floors"]}
				for t in an_towers]
		_ins({"doctype": "Realty Project", "project_code": p["code"],
			"project_name": p["name"], "project_type": p["type"], "city": p["city"],
			"locality": p["locality"], "typology": p["typology"], "possession": p["possession"],
			"towers_count": p["towers"], "total_units": p["totalUnits"], "sold": p["sold"],
			"blocked": p["blocked"], "available": p["available"],
			"price_from": p["priceFrom"], "price_to": p["priceTo"], "towers": towers})

	# ---- payment plan template ----
	_ins({"doctype": "Realty Payment Plan", "plan_name": "Construction Linked (10-stage)",
		"items": [{"stage_name": t["stage"], "pct": t["pct"], "trigger": t["trigger"]}
			for t in d["paymentTemplate"]]})

	# ---- units (full Abhiman grid) ----
	for tower, floors in d["abhimanGrid"].items():
		for _floor, units in floors.items():
			for u in units:
				_ins({"doctype": "Realty Unit", "unit_id": u["id"], "project": "AN",
					"tower": u["tower"], "floor": u["floor"], "unit_no": u["num"],
					"typology": u["typology"], "carpet_area": u["carpet"],
					"facing": u["facing"], "price": u["price"],
					"status": u["status"].capitalize()})
	frappe.db.commit()

	# ---- leads (+ activity/tasks/cost-sheet for the focused lead) ----
	focused_id = d["leads"][0]["id"]  # LD-2400, Rajesh
	for idx, ld in enumerate(d["leads"]):
		doc = {
			"doctype": "Realty Lead", "lead_id": ld["id"], "lead_name": ld["name"],
			"phone": ld["phone"], "email": ld["email"], "occupation": ld.get("occupation"),
			"city": ld.get("city"), "stage": ld["stage"], "score": ld["score"],
			"starred": 1 if ld.get("starred") else 0, "followups": ld.get("followups", 0),
			"tags_text": ", ".join(ld.get("tags") or []),
			"project": _proj_code(ld.get("project")), "interest": ld.get("interest"),
			"budget": ld.get("budget"), "source": ld.get("source"),
			"channel_partner": ld.get("channelPartnerName"),
			"sales_owner": ld.get("ownerName"),
			"lead_created": ld.get("created"), "last_activity": ld.get("lastActivity"),
			"visit_on": ld.get("visitOn"),
		}
		if ld["id"] == focused_id:
			doc["activities"] = [{
				"activity_datetime": a["at"] + ":00", "who": a["who"],
				"activity_type": a["type"], "text": a["text"]} for a in d["activity"]]
			doc["tasks"] = [{
				"title": t["title"], "due_date": t["due"], "done": 1 if t["done"] else 0,
				"owner_rep": owners_by_id.get(t["owner"], {}).get("name"),
				"priority": t["priority"]} for t in d["tasks"]]
			doc["cost_sheet_items"] = [{"label": k, "amount": v} for k, v in RAJESH_COST_SHEET]
		else:
			# one "created" event so every drawer has a timeline
			doc["activities"] = [{
				"activity_datetime": (ld.get("created") or "2026-04-01") + " 10:00:00",
				"who": "System", "activity_type": "created",
				"text": f"Lead captured from {ld.get('source', 'Direct')}."}]
		_ins(doc)
	frappe.db.commit()

	# ---- site visits ----
	for v in d["visits"]:
		_ins({"doctype": "Realty Site Visit", "visit_id": v["id"], "lead": v["leadId"],
			"project": _proj_code(v.get("project")), "sales_owner": v.get("ownerName"),
			"party_of": v.get("partyOf"), "visit_date": v["date"],
			"visit_time": (v["time"] + ":00") if v.get("time") else None,
			"duration": v.get("duration"), "mode": v.get("mode"), "status": v["status"],
			"pickup": 1 if v.get("pickup") else 0, "notes": v.get("notes")})
	frappe.db.commit()

	# ---- bookings ----
	for b in d["bookings"]:
		_ins({"doctype": "Realty Booking", "booking_id": b["id"], "booking_date": b["date"],
			"lead": b["leadId"] if frappe.db.exists("Realty Lead", b["leadId"]) else None,
			"lead_name": b["leadName"], "project_name": b["project"], "unit": b["unit"],
			"typology": b["typology"], "carpet": b["carpet"], "bsp": b["bsp"],
			"other_charges": b["otherCharges"], "gst": b["gst"], "total": b["total"],
			"token_amount": b["tokenAmount"], "token_paid": 1 if b["tokenPaid"] else 0,
			"agreement_signed": 1 if b["agreementSigned"] else 0, "stage": b["stage"],
			"sales_owner_name": b["owner"]})
	frappe.db.commit()

	# ---- payment dues ----
	for p in d["paymentDues"]:
		_ins({"doctype": "Realty Payment Due", "due_id": p["id"], "booking": p["bookingId"],
			"lead_name": p["leadName"], "unit": p["unit"], "project_name": p["project"],
			"stage_name": p["stageName"], "pct": p["pct"], "amount": p["amount"],
			"due_date": p["dueDate"], "status": p["status"], "paid_at": p.get("paidAt"),
			"receipt_no": p.get("receiptNo")})
	frappe.db.commit()

	# ---- campaigns ----
	for c in d["campaigns"]:
		_ins({"doctype": "Realty Campaign", "campaign_id": c["id"], "campaign_name": c["name"],
			"channel": c["channel"], "status": c["status"], "start_date": c["startDate"],
			"end_date": c["endDate"], "budget": c["budget"], "spent": c["spent"],
			"leads": c["leads"], "qualified": c["qualified"], "visits": c["visits"],
			"bookings": c["bookings"], "cpl": c["cpl"]})
	frappe.db.commit()

	counts = {dt: frappe.db.count(dt) for dt in (
		"Realty Project", "Realty Unit", "Realty Lead", "Realty Site Visit",
		"Realty Booking", "Realty Payment Due", "Realty Channel Partner", "Realty Campaign")}
	print("dux_crm_realty seeded:", counts)
	return counts


def seed_tasks(reset=False):
	"""Add standalone Realty Tasks for the personal calendar. Idempotent and
	NON-destructive (does not touch leads/visits/projects) so it is safe to run
	on a live demo. Dates are relative to the pinned 'today' = 2026-04-29."""
	if not frappe.db.exists("DocType", "Realty Task"):
		print("Realty Task doctype missing — run install.create_doctypes first.")
		return
	if reset:
		frappe.db.delete("Realty Task")
	if frappe.db.count("Realty Task") and not reset:
		print("Realty Task already seeded:", frappe.db.count("Realty Task"))
		return

	P, R, A, V, N = ("Priya Deshmukh", "Rohan Kulkarni", "Anjali Bhosale",
		"Vikram Joshi", "Neha Pandey")
	# (title, type, owner, dueOffset, time, priority, lead, status, notes)
	rows = [
		("Call back — discuss unit 705 pricing", "Follow-up call", P, 0, "10:30", "high", "LD-2400", "Open", "Wants 3% discount + covered parking."),
		("Share final cost sheet PDF", "Send documents", P, 1, "12:00", "high", "LD-2400", "Open", ""),
		("Collect KYC — PAN + Aadhaar", "Collect documents", P, 2, "16:00", "med", "LD-2400", "Open", ""),
		("Site-visit follow-up calls", "Follow-up call", P, 0, "17:30", "med", None, "Open", ""),
		("WhatsApp brochure to new web leads", "WhatsApp", P, -1, "09:30", "low", None, "Done", ""),
		("Pipeline review with manager", "Meeting", P, 3, "09:00", "med", None, "Open", ""),
		("Re-engage cold leads batch", "WhatsApp", P, 4, "16:00", "low", None, "Open", ""),
		("Token payment follow-up", "Payment follow-up", R, 1, "11:00", "high", None, "Open", ""),
		("Call Diya Patel re: agreement", "Follow-up call", R, 0, "15:00", "med", None, "Open", ""),
		("Email price list — Pinnacle", "Email", A, 2, "10:00", "low", None, "Open", ""),
		("Confirm Saturday site visits", "Follow-up call", A, 1, "18:00", "med", None, "Open", ""),
		("Negotiation callback — Royal Commercia", "Follow-up call", V, 0, "14:00", "high", None, "Open", ""),
		("Registration appointment prep", "Meeting", V, 4, "11:00", "med", None, "Open", ""),
		("Welcome call — referral lead", "Follow-up call", N, 1, "10:00", "med", None, "Open", ""),
		("Send documents checklist", "Send documents", N, 2, "13:00", "low", None, "Open", ""),
	]
	n = 0
	for (title, typ, owner, off, time, pri, lead, status, notes) in rows:
		lead_ref = lead if (lead and frappe.db.exists("Realty Lead", lead)) else None
		_ins({
			"doctype": "Realty Task", "task_id": "TSK-" + str(4000 + n),
			"title": title, "task_type": typ, "status": status, "priority": pri,
			"assigned_to": owner, "due_date": days_from_now(off), "due_time": time + ":00",
			"created_by_name": "Vikram Joshi", "lead": lead_ref, "notes": notes,
		})
		n += 1
	frappe.db.commit()
	print("seeded Realty Tasks:", n)
	return n
