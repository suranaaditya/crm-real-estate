# Mints a desk session for the test admin so the recorder never types a password. exec()'d inside
# `bench console`; prints "SID <hash>" — save that output as sid.txt next to these scripts.
# The display name is set to "Admin" because it shows on camera; restore_demo_user.py undoes both.
frappe.local.request = None                     # Session() expects a web request
frappe.local.request_ip = "127.0.0.1"
frappe.local.form_dict = frappe._dict({"sid": "Guest"})
from frappe.sessions import Session
u = frappe.get_doc("User", "crm.demo@shradha.local")
u.first_name, u.last_name = "Admin", ""
u.save(ignore_permissions=True)
s = Session(user="crm.demo@shradha.local", resume=False, full_name="Admin", user_type="System User")
frappe.db.commit()
print("SID", getattr(s, "sid", None) or s.data.get("sid"))
