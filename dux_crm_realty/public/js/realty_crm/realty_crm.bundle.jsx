import React from "react";
import { createRoot } from "react-dom/client";

/* NOTE: design tokens / base CSS are NOT imported here. Frappe's frappe.require
   loads a *.bundle.jsx but does not inject the CSS esbuild extracts from a JS
   import, so the page loader (realty_crm.js) loads the stylesheet as a plain
   static asset instead (the dux_cybervidya pattern). */

/* Component + page modules — each registers its component(s) on window.* (the
   prototype's own pattern). Imported for side-effects so they execute before
   the app renders. Order is dependency-friendly but cross-refs resolve at
   render time via globals, so it is not strict. */
import "./components/shell.jsx";
import "./components/forms.jsx";
import "./components/lead-detail.jsx";
import "./pages/direction-a.jsx";
import "./pages/page-calendar.jsx";
import "./pages/page-dashboard.jsx";
import "./pages/page-visits.jsx";
import "./pages/page-inventory.jsx";
import "./pages/page-bookings.jsx";
import "./pages/page-payments.jsx";
import "./pages/page-partners.jsx";
import "./pages/page-reports.jsx";
import "./pages/page-settings.jsx";
import "./pages/campaigns.jsx";
import "./pages/workspace.jsx";
import "./app-root.jsx";

/* App-served brand art (copied into public/images -> /assets/...) */
window.__resources = {
  duxMonoWhite: "/assets/dux_crm_realty/images/dux-monogram-white.png",
  duxLogoTightWhite: "/assets/dux_crm_realty/images/dux-logo-tight-white.png",
  duxLogoTight: "/assets/dux_crm_realty/images/dux-logo-tight.png",
  abhimanFacade: "/assets/dux_crm_realty/images/abhiman-facade.jpg",
  abhimanAerial: "/assets/dux_crm_realty/images/abhiman-aerial.jpg",
};

class RealtyCRM {
  constructor({ wrapper, page }) {
    this.wrapper = (wrapper && wrapper.get) ? wrapper.get(0) : wrapper;
    this.page = page;
    this._renderLoading();
    this._boot();
  }

  _renderLoading() {
    this.wrapper.innerHTML =
      '<div style="height:100%;display:flex;align-items:center;justify-content:center;' +
      'font-family:Poppins,system-ui,sans-serif;color:#9A9A9A;font-size:14px;">Loading Shradha CRM…</div>';
  }

  async _boot() {
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.get_bootstrap" });
      window.CRM_DATA = r.message;
      const root = createRoot(this.wrapper);
      this._root = root;
      root.render(React.createElement(window.RealtyApp));
    } catch (e) {
      console.error("RealtyCRM boot failed", e);
      this.wrapper.innerHTML =
        '<div style="padding:40px;font-family:Poppins,system-ui,sans-serif;color:#C8434A;">' +
        "Failed to load the CRM. Check the console / server logs.</div>";
    }
  }
}

frappe.provide("frappe.ui");
frappe.ui.RealtyCRM = RealtyCRM;
export default RealtyCRM;
