/* Desk page that hosts the Shradha CRM React app. Immersive full-bleed surface
   (page-head hidden) below the desk navbar — mirrors dux_chatbot's pattern.
   The heavy React bundle is loaded lazily via frappe.require (like Raven). */

/* The CRM ships its own navy sidebar, so we hide Frappe's 50px desk sidebar
   while THIS page is the active route and restore it everywhere else. The hide
   is a body class consumed by realty_crm.css; this is per-tab DOM only (no server
   / cross-user state), and the router guard guarantees it never leaks to other
   desk pages on this shared box. */
const REALTY_BODY_CLASS = "realty-crm-active";
function _realtyHideDeskSidebar() { document.body.classList.add(REALTY_BODY_CLASS); }
function _realtyRestoreDeskSidebar() { document.body.classList.remove(REALTY_BODY_CLASS); }
function _realtySyncDeskSidebar() {
	const route = (frappe.get_route && frappe.get_route()) || [];
	if (route && route[0] === "realty-crm") _realtyHideDeskSidebar();
	else _realtyRestoreDeskSidebar();
}

frappe.pages["realty-crm"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Shradha CRM",
		single_column: true,
	});

	const $wrapper = $(wrapper);
	// Immersive: drop Frappe's page head + body padding so the CRM owns the viewport.
	$wrapper.find(".page-head").hide();
	// Reserve space for the desk navbar ONLY if one is actually present+visible — this
	// desk renders the CRM full-bleed with no navbar, so a hardcoded fallback would
	// leave a dead strip at the bottom. Measure it; default to 0 when absent.
	const $nav = $(".navbar");
	const navH = ($nav.length && $nav.is(":visible")) ? ($nav.outerHeight() || 0) : 0;
	const mount = $('<div class="realty-crm-root"></div>').css({
		height: "calc(100vh - " + navH + "px)",
		overflow: "hidden",
	});
	$wrapper.find(".page-body").css({ "margin-top": 0, padding: 0 }).empty().append(mount);

	// Hide the desk sidebar now (first construction) and keep it in sync with the
	// route. Bind the router guard exactly ONCE (on_page_load runs once) so it can
	// never stack duplicate listeners; it is idempotent (only toggles a class).
	_realtyHideDeskSidebar();
	frappe.router.on("change", _realtySyncDeskSidebar);

	// Load the design tokens / base CSS as a plain static asset first (Frappe's
	// frappe.require does not inject the CSS esbuild extracts from the JS bundle),
	// then load the React bundle and mount.
	frappe.require("/assets/dux_crm_realty/css/realty_crm.css").then(() => {
		frappe.require("realty_crm.bundle.jsx").then(() => {
			new frappe.ui.RealtyCRM({ wrapper: mount, page: page });
		});
	});
};

// Fire on every entry/exit of this desk page (incl. back/forward + app switches).
frappe.pages["realty-crm"].on_page_show = _realtyHideDeskSidebar;
frappe.pages["realty-crm"].on_page_hide = _realtyRestoreDeskSidebar;
