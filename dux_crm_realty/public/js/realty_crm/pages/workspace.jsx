import React from "react";
/* Workspace shell — hosts the sidebar router and swaps in the active page.
   Each module is a separate file in app/page-*.jsx; this just wires them up. */

const { useState: wUseState } = React;

/* Deep links: the module lives in the URL hash (#leads, #inventory…) so a refresh
   keeps you where you were and a link can point at a specific module. Frappe v16
   routes on the path, not the hash, so this doesn't fight the desk router. */
const PAGE_IDS = ["dashboard", "calendar", "approvals", "leads", "visits", "documents",
  "inventory", "bookings", "payments", "partners", "campaigns", "reports", "settings"];
const _hashPage = () => {
  const h = (window.location.hash || "").replace(/^#/, "").trim().toLowerCase();
  return PAGE_IDS.includes(h) ? h : null;
};

window.Workspace = function Workspace({ density = "comfortable", defaultView = "table", initial = "leads" }) {
  const [activePage, setActivePage] = wUseState(_hashPage() || initial);
  const [invSearch, setInvSearch] = wUseState("");   // Inventory top-bar search
  const [docSearch, setDocSearch] = wUseState("");   // Documents top-bar search
  const onNav = (id) => {
    setActivePage(id); setInvSearch(""); setDocSearch("");
    try { window.location.hash = id; } catch (e) {}
  };
  React.useEffect(() => {
    const onHash = () => { const p = _hashPage(); if (p) setActivePage(p); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Pages that bring their own topbar / chrome
  const pageMeta = {
    dashboard: { title: "Dashboard",      subtitle: ("WELCOME BACK, " + String((window.CRM_DATA && window.CRM_DATA.currentUser && window.CRM_DATA.currentUser.name) || "").split(" ")[0].toUpperCase()) },
    calendar:  { title: "My Day",         subtitle: "TASKS & VISITS · MY CALENDAR" },
    approvals: { title: "Approvals",      subtitle: "MANAGER · PENDING REQUESTS" },
    leads:     { title: "Leads",          subtitle: "SALES PIPELINE" },
    visits:    { title: "Site Visits",    subtitle: "ALL VISITS · TEAM CALENDAR" },
    documents: { title: "Documents",      subtitle: "PROJECT DOCUMENT LIBRARY" },
    inventory: { title: "Inventory",      subtitle: "TOWERS · FLOORS · UNITS" },
    bookings:  { title: "Bookings",       subtitle: "AGREEMENTS · COST SHEETS" },
    payments:  { title: "Payments",       subtitle: "COLLECTIONS & SCHEDULE" },
    partners:  { title: "Channel Partners", subtitle: "BROKER NETWORK" },
    campaigns: { title: "Campaigns",      subtitle: "WHATSAPP · EMAIL · SMS" },
    reports:   { title: "Reports & Analytics", subtitle: "Q1 FY26" },
    settings:  { title: "Settings",       subtitle: "WORKSPACE PREFERENCES" },
  };
  const meta = pageMeta[activePage] || pageMeta.leads;

  // The Leads page is special — it owns its full chrome (table↔kanban, KPIs, filter row).
  if (activePage === "leads") {
    return <DirectionA density={density} defaultView={defaultView} onNav={onNav} active="leads" />;
  }

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--neutral-50)", overflow: "hidden" }}>
      <Sidebar active={activePage} onNav={onNav} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title={meta.title} subtitle={meta.subtitle}
          {...(activePage === "inventory" ? { search: invSearch, onSearch: setInvSearch, searchPlaceholder: "Search units — A-0703, 3 BHK, lead…" }
            : activePage === "documents" ? { search: docSearch, onSearch: setDocSearch, searchPlaceholder: "Search documents — title, tag, category…" } : {})}>
          {activePage === "dashboard" && <Btn variant="accent" icon="plus" size="sm" onClick={() => window.__openNewLead && window.__openNewLead()}>New Lead</Btn>}
        </Topbar>
        {activePage === "dashboard" && <PageDashboard onNav={onNav} />}
        {activePage === "calendar"  && <PageCalendar key="my-day" />}
        {activePage === "approvals" && <PageApprovals />}
        {activePage === "visits"    && <PageCalendar key="visits" initialKind="visits" teamView />}
        {activePage === "documents" && <PageDocuments search={docSearch} />}
        {activePage === "inventory" && <PageInventory search={invSearch} onNav={onNav} />}
        {activePage === "bookings"  && <PageBookings />}
        {activePage === "payments"  && <PagePayments />}
        {activePage === "partners"  && <PagePartners />}
        {activePage === "reports"   && <PageReports />}
        {activePage === "settings"  && <PageSettings />}
        {activePage === "campaigns" && <PageCampaigns />}
      </div>
    </div>
  );
};

function ComingSoon({ title }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--neutral-400)" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--neutral-600)" }}>{title}</div>
      <div style={{ fontSize: 13 }}>Module scaffolded — UI in next sprint.</div>
    </div>
  );
}
