# Copyright (c) 2026, Dux Digitech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

# Changing where the account connects must come with a fresh app password. Otherwise the
# stored (encrypted) Gmail App Password would be decrypted and sent, by "Test" or "Send",
# to whatever SMTP server the editor typed in.
_DESTINATION = ("email_id", "smtp_host", "smtp_port", "use_ssl")


class RealtyEmailAccount(Document):
	def validate(self):
		if self.is_new():
			return
		moved = [f for f in _DESTINATION if self.has_value_changed(f)]
		pw = self.smtp_password or ""
		password_unchanged = not pw or set(pw) == {"*"}
		if moved and password_unchanged and self.has_password:
			frappe.throw(_("Re-enter the app password when you change the email address or SMTP server."))
