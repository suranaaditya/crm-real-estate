# Copyright (c) 2026, Dux Digitech and contributors
# For license information, please see license.txt

from frappe.model.document import Document
from frappe.utils import flt


class RealtyBooking(Document):
	def validate(self):
		# "Total payable" on the Bookings page reads this field; nothing used to compute it
		self.total = flt(self.bsp) + flt(self.other_charges) + flt(self.gst)
