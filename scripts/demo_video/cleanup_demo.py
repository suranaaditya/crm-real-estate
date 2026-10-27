# Removes every record the demo recording creates. exec()'d inside `bench console`.
import json
from dux_crm_realty.api import crm
frappe.set_user("Administrator")
out = {}
leads = frappe.get_all("Realty Lead", filters={"lead_name": ["like", "%(Demo)%"]}, pluck="name")
docs = frappe.get_all("Realty Document", filters={"title": ["like", "%(Demo)%"]}, pluck="name")
for d in docs:
	crm.delete_document(d)
for s in frappe.get_all("Realty Document Share", filters={"lead": ["in", leads or ["-"]]}, pluck="name"):
	frappe.delete_doc("Realty Document Share", s, force=1, ignore_permissions=True)
for h in frappe.get_all("Realty Unit Hold", filters={"lead": ["in", leads or ["-"]]}, fields=["name", "unit", "status"]):
	if h.status == "Approved":
		frappe.db.set_value("Realty Unit", h.unit, "status", "Available")
	frappe.delete_doc("Realty Unit Hold", h.name, force=1, ignore_permissions=True)
for t in frappe.get_all("Realty Task", filters={"lead": ["in", leads or ["-"]]}, pluck="name") + frappe.get_all("Realty Task", filters={"title": ["like", "%(Demo)%"]}, pluck="name"):
	if frappe.db.exists("Realty Task", t):
		frappe.delete_doc("Realty Task", t, force=1, ignore_permissions=True)
for v in frappe.get_all("Realty Site Visit", filters={"lead": ["in", leads or ["-"]]}, pluck="name"):
	frappe.delete_doc("Realty Site Visit", v, force=1, ignore_permissions=True)
for c in frappe.get_all("Communication", filters={"reference_doctype": "Realty Lead", "reference_name": ["in", leads or ["-"]]}, pluck="name"):
	frappe.delete_doc("Communication", c, force=1, ignore_permissions=True)
for l in leads:
	frappe.delete_doc("Realty Lead", l, force=1, ignore_permissions=True)
for src in ("Demo Portal",):
	if frappe.db.exists("Realty Lead Source", src) and not frappe.db.count("Realty Lead", {"source": src}):
		frappe.delete_doc("Realty Lead Source", src, force=1, ignore_permissions=True)
for p in frappe.get_all("Realty Channel Partner", filters={"partner_name": ["like", "%(Demo)%"]}, pluck="name"):
	frappe.delete_doc("Realty Channel Partner", p, force=1, ignore_permissions=True)
# rollups for any project whose unit status we touched
for code in frappe.get_all("Realty Project", pluck="name"):
	crm._recompute_project_counts(code)
frappe.db.commit()
out["deleted_leads"] = leads
out["deleted_docs"] = docs
out["left"] = {
	"leads": frappe.db.count("Realty Lead", {"lead_name": ["like", "%(Demo)%"]}),
	"docs": frappe.db.count("Realty Document", {"title": ["like", "%(Demo)%"]}),
	"blocked_units": frappe.db.count("Realty Unit", {"status": ["!=", "Available"]}),
	"holds": frappe.db.count("Realty Unit Hold"), "tasks": frappe.db.count("Realty Task"),
	"visits": frappe.db.count("Realty Site Visit"), "leads_total": frappe.db.count("Realty Lead"),
}
print("CLEANUP_JSON " + json.dumps(out, default=str))
