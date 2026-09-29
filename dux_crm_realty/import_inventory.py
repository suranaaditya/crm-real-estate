"""Load the client's real inventory, project details and site visits.

Source: Gautam Jain's reply of 21 Aug 2026 to the "Data required for CRM App" thread
(the filled-in "Shradha Realty - CRM Data Request.xlsx"). All the messy parsing happens
locally in the payload builder; this module only writes clean, pre-shaped rows.

Run on the server:
    bench --site erp.jewonline.in execute dux_crm_realty.import_inventory.run \
        --kwargs "{'path': '/home/frappe/_inventory_payload.json', 'dry_run': 1}"

What it does
    1. Projects  — updates the listed fields on existing projects (matched by CODE, which the
                   builder resolved from the project NAME — the client's own short codes clash
                   with ours, e.g. their "GP" is our Gulab Palace = GUP), creates the new ones.
    2. Units     — for projects in ``replace_units_for`` it first deletes units that are NOT in
                   the payload (the prototype's demo stock); then inserts every payload unit
                   whose unit_id doesn't exist yet. Refuses to delete a unit that has a hold,
                   a document or a booking pointing at it — except the known demo booking.
    3. Rollups   — recomputes each touched project's totals and rebuilds its tower rows.
    4. Visits    — inserts site visits (skipping ones already loaded: same date + visitor +
                   rep + project), links the lead when the builder matched the phone to exactly
                   one lead, and appends a "visit" activity to that lead's timeline.

Idempotent: re-running it changes nothing. ``dry_run=1`` does all the work, prints the
report and rolls back.
"""

import json
from collections import Counter

import frappe

from dux_crm_realty.api.crm import _insert_with_id, _recompute_project_counts

PROJECT_FIELDS = ("project_type", "city", "locality", "typology", "towers_count",
	"possession", "price_from", "price_to")
UNIT_FIELDS = ("project", "tower", "floor", "unit_no", "typology", "carpet_area",
	"built_up_area", "facing", "price", "status", "remarks")


def _log(msg):
	print("[inventory] " + msg)


def run(path="/home/frappe/_inventory_payload.json", dry_run=1):
	dry_run = int(dry_run)
	payload = json.load(open(path))
	report = Counter()
	notes = []
	_log("payload: %d projects, %d units, %d visits (dry_run=%s)" % (
		len(payload["projects"]), len(payload["units"]), len(payload["visits"]), dry_run))

	try:
		# ------------------------------------------------------------- 1. projects
		for p in payload["projects"]:
			code = p["code"]
			if frappe.db.exists("Realty Project", code):
				doc = frappe.get_doc("Realty Project", code)
				changed = []
				for f in PROJECT_FIELDS:
					v = p.get(f)
					if v in (None, ""):
						continue
					if doc.get(f) != v:
						doc.set(f, v)
						changed.append(f)
				if changed:
					doc.save(ignore_permissions=True)
					report["project_updated"] += 1
					notes.append("updated %s: %s" % (code, ", ".join(changed)))
			else:
				frappe.get_doc({"doctype": "Realty Project", "project_code": code,
					"project_name": p["name"], "total_units": 0, "sold": 0, "blocked": 0,
					"reserved": 0, "available": 0,
					**{f: p.get(f) for f in PROJECT_FIELDS if p.get(f) not in (None, "")}}
				).insert(ignore_permissions=True)
				report["project_created"] += 1
				notes.append("created %s (%s)" % (code, p["name"]))

		# ------------------------------------------- 2a. remove demo stock we replace
		keep = {u["unit_id"] for u in payload["units"]}
		allowed_booking_refs = set(payload.get("allowed_dangling_bookings") or [])
		for code in payload.get("replace_units_for") or []:
			old = [n for n in frappe.get_all("Realty Unit", filters={"project": code}, pluck="name")
				if n not in keep]
			for n in old:
				if frappe.db.exists("Realty Unit Hold", {"unit": n}):
					frappe.throw("Unit %s has hold history — not deleting." % n)
				if frappe.db.exists("Realty Document", {"unit": n}):
					frappe.throw("Unit %s has a document attached — not deleting." % n)
				bk = frappe.db.get_value("Realty Booking", {"unit": n}, "booking_id")
				if bk and bk not in allowed_booking_refs:
					frappe.throw("Unit %s is named by booking %s — not deleting." % (n, bk))
			for n in old:
				frappe.delete_doc("Realty Unit", n, force=1, ignore_permissions=True)
			report["demo_units_deleted"] += len(old)
			notes.append("%s: removed %d demo units" % (code, len(old)))

		# ------------------------------------------------------------- 2b. units
		touched = set()
		for u in payload["units"]:
			touched.add(u["project"])
			if frappe.db.exists("Realty Unit", u["unit_id"]):
				report["unit_skipped_existing"] += 1
				continue
			frappe.get_doc({"doctype": "Realty Unit", "unit_id": u["unit_id"],
				**{f: u.get(f) for f in UNIT_FIELDS}}).insert(ignore_permissions=True)
			report["unit_created"] += 1

		# ------------------------------------------------------- 3. rollups + towers
		for code in sorted(touched | set(payload.get("replace_units_for") or [])):
			_recompute_project_counts(code)
			proj = frappe.get_doc("Realty Project", code)
			towers = {}
			for t, fl in frappe.db.sql("""select tower, max(floor) from `tabRealty Unit`
					where project=%s and ifnull(tower,'')!='' group by tower""", (code,)):
				towers[t] = fl
			proj.set("towers", [{"tower_code": t, "tower_name": "Tower " + t, "floors": f or 0}
				for t, f in sorted(towers.items())])
			proj.save(ignore_permissions=True)
			_recompute_project_counts(code)  # save() must not leave stale rollups behind

		# -------------------------------------------------------------- 4. visits
		for v in payload["visits"]:
			if frappe.db.exists("Realty Site Visit", {"visit_date": v["visit_date"],
					"lead_name": v["lead_name"], "sales_owner": v["sales_owner"],
					"project": v.get("project")}):
				report["visit_skipped_existing"] += 1
				continue
			lead = v.get("lead")
			if lead and not frappe.db.exists("Realty Lead", lead):
				lead = None
				report["visit_lead_vanished"] += 1
			project = v.get("project") if v.get("project") and frappe.db.exists(
				"Realty Project", v["project"]) else None
			_insert_with_id(lambda vid: {
				"doctype": "Realty Site Visit", "visit_id": vid, "lead": lead,
				"lead_name": v["lead_name"], "project": project,
				"sales_owner": v["sales_owner"], "party_of": v.get("party_of"),
				"visit_date": v["visit_date"], "visit_time": v.get("visit_time"),
				"mode": "in-person", "status": v.get("status") or "completed",
				"notes": v.get("notes"),
			}, "Realty Site Visit", "visit_id", "VST-", 4, ignore_permissions=True)
			report["visit_created"] += 1
			if lead:
				report["visit_linked_to_lead"] += 1
				ld = frappe.get_doc("Realty Lead", lead)
				text = v["activity_text"]
				if not any(a.activity_type == "visit" and a.text == text for a in ld.activities):
					ld.append("activities", {"activity_datetime": v["visit_date"] + " 00:00:00",
						"who": v["sales_owner"], "activity_type": "visit", "text": text})
					if not ld.last_activity or str(ld.last_activity) < v["visit_date"]:
						ld.last_activity = v["visit_date"]
					ld.save(ignore_permissions=True)
					report["lead_activity_added"] += 1

		for k, n in sorted(report.items()):
			_log("%-26s %d" % (k, n))
		for n in notes:
			_log("  · " + n)
		for code in sorted(touched):
			r = frappe.db.get_value("Realty Project", code,
				["total_units", "available", "blocked", "reserved", "sold"], as_dict=True)
			_log("  %-4s total=%s avail=%s blocked=%s reserved=%s sold=%s" % (
				code, r.total_units, r.available, r.blocked, r.reserved, r.sold))
	except Exception:
		frappe.db.rollback()
		_log("FAILED — rolled back")
		raise

	if dry_run:
		frappe.db.rollback()
		_log("DRY RUN — rolled back, nothing written")
	else:
		frappe.db.commit()
		_log("COMMITTED")
	return dict(report)
