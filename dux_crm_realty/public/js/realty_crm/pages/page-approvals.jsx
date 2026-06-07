import React from "react";
/* Approvals — one manager inbox for ALL request types: inventory hold/reserve requests AND
   document-share requests. Approve / reject from "Pending"; release a hold or revoke a share
   from "Active". Manager-only (gated on the real Frappe role surfaced as currentUser.isManager).
   Consumes data.pendingHolds + data.pendingShares + data.activeShares + approved holds flattened
   from data.grids. */

window.PageApprovals = function PageApprovals() {
  const data = window.CRM_DATA;
  const isManager = !!(data.currentUser && data.currentUser.isManager);
  const [tab, setTab] = React.useState("all");   // all | holds | shares

  if (!isManager) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "var(--neutral-400)" }}>
        <Icon name="shield" size={36} style={{ color: "var(--neutral-300)" }} />
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--neutral-600)" }}>Manager access only</div>
        <div style={{ fontSize: 13 }}>Approvals are visible to sales managers and admins.</div>
      </div>
    );
  }

  const pendingHolds = (data.pendingHolds || []).map(h => ({ ...h, _kind: "hold" }));
  const pendingShares = (data.pendingShares || []).map(s => ({ ...s, _kind: "share" }));
  // approved holds flattened from the live grids (they already carry their holds)
  const approvedHolds = [];
  Object.values(data.grids || {}).forEach(towers =>
    Object.values(towers || {}).forEach(floors =>
      Object.values(floors || {}).forEach(units =>
        (units || []).forEach(u => (u.holds || []).forEach(h => { if (h.status === "Approved") approvedHolds.push({ ...h, _kind: "hold" }); })))));
  const activeShares = (data.activeShares || []).map(s => ({ ...s, _kind: "share" }));

  const pending = tab === "holds" ? pendingHolds : tab === "shares" ? pendingShares
    : [...pendingHolds, ...pendingShares].sort((a, b) => ((a.requestedOn || "") < (b.requestedOn || "") ? 1 : -1));
  const active = tab === "holds" ? approvedHolds : tab === "shares" ? activeShares
    : [...approvedHolds, ...activeShares];

  const act = async (method, args, msg, ind) => {
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm." + method, args });
      frappe.show_alert({ message: msg, indicator: ind || "blue" });
      if (window.__refreshCRM) await window.__refreshCRM();
    } catch (e) { frappe.msgprint(e.message || "Action failed"); }
  };

  const counts = { all: pendingHolds.length + pendingShares.length, holds: pendingHolds.length, shares: pendingShares.length };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <FilterChip active={tab === "all"} onClick={() => setTab("all")} count={counts.all}>All</FilterChip>
        <FilterChip active={tab === "holds"} onClick={() => setTab("holds")} count={counts.holds}>Inventory holds</FilterChip>
        <FilterChip active={tab === "shares"} onClick={() => setTab("shares")} count={counts.shares}>Document shares</FilterChip>
      </div>

      {/* Pending */}
      <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>Pending · {pending.length}</div>
      {pending.length === 0 ? (
        <div style={{ padding: 36, textAlign: "center", border: "1px dashed var(--hairline)", borderRadius: 12, color: "var(--neutral-400)", fontSize: 13, marginBottom: 28 }}>
          Nothing waiting on you. New hold/reserve requests and document shares will land here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
          {pending.map(item => <PendingRow key={item._kind + item.id} item={item} act={act} />)}
        </div>
      )}

      {/* Active */}
      {active.length > 0 && (
        <>
          <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>Active · {active.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {active.map(item => <ActiveRow key={item._kind + item.id} item={item} act={act} />)}
          </div>
        </>
      )}
    </div>
  );
};

function ShareRecipientTag({ item }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 6px", borderRadius: 4, background: "var(--info-bg)", color: "var(--info)", border: "1px solid var(--info)" }}>LEAD</span>
      <span style={{ fontSize: 12, color: "var(--neutral-800)", fontWeight: 600 }}>{item.leadName || item.leadId || "—"}</span>
    </span>
  );
}

function HoldRecipientTag({ item }) {
  const outside = item.isOutside;
  const who = outside ? (item.contactName || "—") : (item.leadName || item.lead || "—");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 6px", borderRadius: 4,
        background: outside ? "var(--neutral-100)" : "var(--info-bg)", color: outside ? "var(--neutral-600)" : "var(--info)",
        border: "1px solid " + (outside ? "var(--hairline)" : "var(--info)") }}>{outside ? "OUTSIDE" : "LEAD"}</span>
      <span style={{ fontSize: 12, color: "var(--neutral-800)", fontWeight: 600 }}>{who}{outside && item.contactPhone ? " · " + item.contactPhone : ""}</span>
    </span>
  );
}

function RowShell({ icon, idText, kindPill, children, requestedBy, requestedByRole, when, actions }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, flexWrap: "wrap" }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--neutral-100)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--neutral-600)", flexShrink: 0 }}>
        <Icon name={icon} size={16} />
      </div>
      <div style={{ minWidth: 120 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12 }}>{idText}</div>
        {kindPill}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200, flexWrap: "wrap" }}>{children}</div>
      <div style={{ fontSize: 11, color: "var(--neutral-500)", minWidth: 120 }}>
        by <strong style={{ color: "var(--neutral-800)" }}>{requestedBy || "—"}</strong>{requestedByRole ? " · " + requestedByRole : ""}
        {when ? <div style={{ color: "var(--neutral-400)" }}>{when}</div> : null}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{actions}</div>
    </div>
  );
}

function PendingRow({ item, act }) {
  if (item._kind === "hold") {
    return (
      <RowShell icon="building" idText={item.unit}
        kindPill={<span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--neutral-100)", color: "var(--neutral-700)", letterSpacing: "0.04em" }}>{(item.kind || "Hold").toUpperCase()} · {(item.project || "").replace("P-", "")}</span>}
        requestedBy={item.requestedBy} requestedByRole={item.requestedByRole} when={item.requestedOn}
        actions={<>
          <Btn variant="accent" size="sm" icon="check" onClick={() => act("approve_hold", { hold_id: item.id }, item.unit + " approved", "green")}>Approve</Btn>
          <Btn variant="ghost" size="sm" onClick={() => act("reject_hold", { hold_id: item.id }, "Request declined", "orange")}>Decline</Btn>
        </>}>
        <HoldRecipientTag item={item} />
      </RowShell>
    );
  }
  return (
    <RowShell icon="file" idText={item.id}
      kindPill={<span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--dux-amber-100)", color: "var(--dux-amber-600)", letterSpacing: "0.04em" }}>SHARE{item.channel === "Comms" ? " · COMMS" : ""}</span>}
      requestedBy={item.requestedBy} requestedByRole={item.requestedByRole} when={item.requestedOn}
      actions={<>
        <Btn variant="accent" size="sm" icon="check" onClick={() => act("approve_share", { share_id: item.id }, "Share approved", "green")}>Approve</Btn>
        <Btn variant="ghost" size="sm" onClick={() => act("reject_share", { share_id: item.id }, "Request declined", "orange")}>Decline</Btn>
      </>}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--neutral-800)" }}>{item.documentTitle}</span>
      <span style={{ color: "var(--neutral-400)" }}>→</span>
      <ShareRecipientTag item={item} />
    </RowShell>
  );
}

function ActiveRow({ item, act }) {
  if (item._kind === "hold") {
    return (
      <RowShell icon="building" idText={item.unit}
        kindPill={<span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--info-bg)", color: "var(--info)", letterSpacing: "0.04em" }}>{(item.kind || "Hold").toUpperCase()} · {(item.project || "").replace("P-", "")}</span>}
        requestedBy={item.requestedBy} requestedByRole={item.requestedByRole} when={item.approvedBy ? "approved by " + item.approvedBy : item.requestedOn}
        actions={<Btn variant="outline" size="sm" onClick={() => act("release_hold", { hold_id: item.id }, "Released " + item.unit, "blue")}>Release</Btn>}>
        <HoldRecipientTag item={item} />
      </RowShell>
    );
  }
  return (
    <RowShell icon="file" idText={item.id}
      kindPill={<span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--success-bg)", color: "var(--success)", letterSpacing: "0.04em" }}>SHARED · {item.accessCount || 0} open{(item.accessCount || 0) === 1 ? "" : "s"}</span>}
      requestedBy={item.requestedBy} requestedByRole={item.requestedByRole} when={item.approvedBy ? "approved by " + item.approvedBy : item.requestedOn}
      actions={<>
        {item.shareUrl && <Btn variant="outline" size="sm" icon="copy" onClick={() => copyShareLink(item.shareUrl)}>Copy link</Btn>}
        <Btn variant="ghost" size="sm" onClick={() => act("revoke_share", { share_id: item.id }, "Share revoked", "orange")}>Revoke</Btn>
      </>}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--neutral-800)" }}>{item.documentTitle}</span>
      <span style={{ color: "var(--neutral-400)" }}>→</span>
      <ShareRecipientTag item={item} />
    </RowShell>
  );
}
