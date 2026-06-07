/* Desk page that hosts the Shradha CRM React app. Immersive full-bleed surface
   (page-head hidden) below the desk navbar — mirrors dux_chatbot's pattern.
   The heavy React bundle is loaded lazily via frappe.require (like Raven). */
frappe.pages["realty-crm"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Shradha CRM",
		single_column: true,
	});

	const $wrapper = $(wrapper);
	// Immersive: drop Frappe's page head + body padding so the CRM owns the viewport.
	$wrapper.find(".page-head").hide();
	const navH = $(".navbar").outerHeight() || 60;
	const mount = $('<div class="realty-crm-root"></div>').css({
		height: "calc(100vh - " + navH + "px)",
		overflow: "hidden",
	});
	$wrapper.find(".page-body").css({ "margin-top": 0, padding: 0 }).empty().append(mount);

	// Load the design tokens / base CSS as a plain static asset first (Frappe's
	// frappe.require does not inject the CSS esbuild extracts from the JS bundle),
	// then load the React bundle and mount.
	frappe.require("/assets/dux_crm_realty/css/realty_crm.css").then(() => {
		frappe.require("realty_crm.bundle.jsx").then(() => {
			new frappe.ui.RealtyCRM({ wrapper: mount, page: page });
		});
	});
};
