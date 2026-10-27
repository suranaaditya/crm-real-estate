# Undo the recording-only changes to the test login. exec()'d inside `bench console`.
# The display name was set to "Admin" for the video; the minted session must not outlive it.
import json
frappe.set_user("Administrator")
SID = open("/tmp/demo_sid.txt").read().strip()
u = frappe.get_doc("User", "crm.demo@shradha.local")
before = [u.first_name, u.last_name, u.full_name]
u.first_name, u.last_name = "CRM", "Demo"
u.save(ignore_permissions=True)
from frappe.sessions import delete_session
delete_session(SID, reason="demo video recording finished")
frappe.db.commit()
left = frappe.db.sql("select count(*) from `tabSessions` where sid=%s", SID)[0][0]
print("RESTORE_JSON " + json.dumps({"before": before, "after": [u.first_name, u.last_name, u.full_name], "session_rows_left": left}))
