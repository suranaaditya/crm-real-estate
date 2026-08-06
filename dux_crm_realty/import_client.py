"""One-off importer: replace demo CRM data with the client's real data.

Run on the server:
    bench --site erp.jewonline.in execute dux_crm_realty.import_client.run \
        --kwargs "{'path': '/home/frappe/_import_payload.json'}"

What it REPLACES (real client data):
    Realty Lead, Realty Channel Partner, Realty Sales Owner, Realty Lead Source,
    plus it creates the client's real Realty Projects.

What it KEEPS (so Inventory / Bookings / Payments / Visits still demonstrate):
    Realty Project + Realty Unit inventory that already exists, Realty Booking,
    Realty Payment Due, Realty Site Visit, Realty Task, Realty Campaign.
    Those records' links to demo leads/owners are re-pointed or cleared first so
    Frappe's link-integrity checks don't block the delete and the pages still render.

Idempotent: safe to re-run (it clears the client rows it created and reloads).
"""

import json

import frappe

STAGE_IDS = ("new", "contacted", "qualified", "visit", "negotiation", "booked", "lost")


def _log(msg):
    print("[import] " + msg)


def _initials(name):
    parts = (name or "").split()
    return ("".join(p[0] for p in parts[:2])).upper() or "?"


def run(path="/home/frappe/_import_payload.json", dry_run=0):
    payload = json.load(open(path))
    dry_run = int(dry_run)
    _log("payload: %d leads, %d partners, %d owners, %d projects" % (
        len(payload["leads"]), len(payload["partners"]),
        len(payload["owners"]), len(payload["projects"])))
    if dry_run:
        _log("DRY RUN — nothing written")
        return

    # ---------------------------------------------------------------- 1. owners
    real_owners = []
    for i, o in enumerate(payload["owners"], start=1):
        name = o["name"]
        if not frappe.db.exists("Realty Sales Owner", name):
            frappe.get_doc({
                "doctype": "Realty Sales Owner", "full_name": name,
                "owner_id": "U%d" % (100 + i), "role": o.get("role") or "Sales Executive",
                "initials": _initials(name),
            }).insert(ignore_permissions=True)
        real_owners.append(name)
    frappe.db.commit()
    _log("owners ready: %s" % real_owners)

    # ------------------------------------------- 2. detach demo transactional links
    # Re-point owner links to real reps, and clear lead links, so the demo leads /
    # owners can be deleted without LinkExistsError and the modules still render.
    def _spread(idx):
        return real_owners[idx % len(real_owners)] if real_owners else None

    for i, name in enumerate(frappe.get_all("Realty Site Visit", pluck="name")):
        frappe.db.set_value("Realty Site Visit", name,
                            {"lead": None, "sales_owner": _spread(i)}, update_modified=False)
    for i, name in enumerate(frappe.get_all("Realty Task", pluck="name")):
        frappe.db.set_value("Realty Task", name,
                            {"lead": None, "assigned_to": _spread(i)}, update_modified=False)
    for name in frappe.get_all("Realty Booking", pluck="name"):
        frappe.db.set_value("Realty Booking", name, {"lead": None}, update_modified=False)
    for name in frappe.get_all("Realty Unit Hold", pluck="name"):
        frappe.delete_doc("Realty Unit Hold", name, force=1, ignore_permissions=True)
    frappe.db.commit()
    _log("demo visits/tasks/bookings detached; unit holds cleared")

    # ---------------------------------------------------------------- 3. wipe
    for name in frappe.get_all("Realty Lead", pluck="name"):
        frappe.delete_doc("Realty Lead", name, force=1, ignore_permissions=True)
    frappe.db.commit()
    _log("deleted all previous leads")

    for name in frappe.get_all("Realty Sales Owner", pluck="name"):
        if name not in real_owners:
            frappe.delete_doc("Realty Sales Owner", name, force=1, ignore_permissions=True)
    for name in frappe.get_all("Realty Channel Partner", pluck="name"):
        frappe.delete_doc("Realty Channel Partner", name, force=1, ignore_permissions=True)
    for name in frappe.get_all("Realty Lead Source", pluck="name"):
        frappe.delete_doc("Realty Lead Source", name, force=1, ignore_permissions=True)
    frappe.db.commit()
    _log("deleted demo owners / partners / sources")

    # ---------------------------------------------------------------- 4. sources
    for s in payload["sources"]:
        if not frappe.db.exists("Realty Lead Source", s):
            frappe.get_doc({"doctype": "Realty Lead Source", "source_name": s}).insert(
                ignore_permissions=True)
    frappe.db.commit()
    _log("sources: %d" % len(payload["sources"]))

    # ---------------------------------------------------------------- 5. projects
    proj_code = {}
    for p in payload["projects"]:
        code, name = p["code"], p["name"]
        existing = frappe.db.get_value("Realty Project", {"project_name": name}, "name")
        if existing:
            proj_code[name] = existing
            continue
        if frappe.db.exists("Realty Project", code):     # code taken by another project
            code = (code + "X")[:8]
        frappe.get_doc({
            "doctype": "Realty Project", "project_code": code, "project_name": name,
            "project_type": "Residential", "city": "Nagpur",
            "total_units": 0, "sold": 0, "blocked": 0, "reserved": 0, "available": 0,
            "towers_count": 0, "price_from": 0, "price_to": 0,
        }).insert(ignore_permissions=True)
        proj_code[name] = code
    frappe.db.commit()
    _log("projects mapped: %d" % len(proj_code))

    # ---------------------------------------------------------------- 6. partners
    partner_name = {}
    for p in payload["partners"]:
        base = (p["name"] or "").strip()[:120]
        if not base:
            continue
        name = base
        n = 2
        while frappe.db.exists("Realty Channel Partner", name):   # PK is partner_name
            name = "%s (%d)" % (base, n)
            n += 1
        tier = "Gold" if (p.get("response") or "").lower().startswith("interested") else "Silver"
        frappe.get_doc({
            "doctype": "Realty Channel Partner", "partner_name": name,
            "contact_person": (p.get("office") or base)[:120],
            "tier": tier, "phone": p.get("phone"), "email": p.get("email"),
            "rera": None, "total_leads": 0, "bookings": 0, "commission": 0, "outstanding": 0,
        }).insert(ignore_permissions=True)
        partner_name.setdefault(base, name)
    frappe.db.commit()
    _log("channel partners: %d" % len(partner_name))

    # ---------------------------------------------------------------- 7. leads
    valid_stage = set(frappe.get_all("Realty Lead Stage", pluck="name"))
    made = 0
    lead_counts = {}
    for i, L in enumerate(payload["leads"], start=1):
        stage = L["stage"] if L["stage"] in valid_stage else "new"
        proj = proj_code.get(L["project"]) if L.get("project") else None
        cp = partner_name.get(L["partner"]) if L.get("partner") else None
        owner = L["owner"] if L.get("owner") in real_owners else None
        created = L.get("created")
        doc = {
            "doctype": "Realty Lead",
            "lead_id": "LD-%04d" % (2000 + i),
            "lead_name": (L["name"] or "Unknown")[:140],
            "phone": L.get("phone"), "email": L.get("email"),
            "city": "Nagpur",
            "stage": stage, "score": L.get("score") or 45,
            "project": proj, "source": L.get("source") or "Direct",
            "channel_partner": cp, "sales_owner": owner,
            "lead_created": created, "last_activity": created,
            "starred": 0, "followups": 0,
        }
        acts = [{"activity_datetime": (created + " 10:00:00") if created else frappe.utils.now(),
                 "who": owner or "System", "activity_type": "created",
                 "text": "Lead imported from %s records." % (
                     "Sell.do export" if L.get("src") == "selldo" else "the sales register")}]
        if L.get("remarks"):
            acts.append({"activity_datetime": (created + " 10:05:00") if created else frappe.utils.now(),
                         "who": owner or "System", "activity_type": "note",
                         "text": str(L["remarks"])[:800]})
        doc["activities"] = acts
        frappe.get_doc(doc).insert(ignore_permissions=True)
        made += 1
        if cp:
            lead_counts[cp] = lead_counts.get(cp, 0) + 1
        if made % 200 == 0:
            frappe.db.commit()
            _log("  ...%d leads" % made)
    frappe.db.commit()
    _log("leads created: %d" % made)

    # ------------------------------------------------- 8. partner lead rollups
    for cp, n in lead_counts.items():
        frappe.db.set_value("Realty Channel Partner", cp, "total_leads", n, update_modified=False)
    frappe.db.commit()

    # ------------------------------------------------- 9. project rollups
    from dux_crm_realty.api.crm import _recompute_project_counts
    for code in frappe.get_all("Realty Project", pluck="name"):
        _recompute_project_counts(code)
    frappe.db.commit()

    _log("DONE. leads=%d partners=%d owners=%d sources=%d projects=%d" % (
        frappe.db.count("Realty Lead"), frappe.db.count("Realty Channel Partner"),
        frappe.db.count("Realty Sales Owner"), frappe.db.count("Realty Lead Source"),
        frappe.db.count("Realty Project")))
