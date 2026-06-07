import React from "react";
/* Channel Partners — broker management. Uses CRM_DATA.channelPartners shape. */

window.PagePartners = function PagePartners() {
  const data = window.CRM_DATA;
  const tierTone = {
    Platinum: { bg: "linear-gradient(135deg, #5E437F, #8564A8)", fg: "#fff" },
    Gold:     { bg: "linear-gradient(135deg, #C68B4E, #E8A95B)", fg: "#fff" },
    Silver:   { bg: "var(--neutral-100)", fg: "var(--neutral-600)" },
  };

  const partners = data.channelPartners;
  const totalLeads      = partners.reduce((a, p) => a + (p.totalLeads || 0), 0);
  const totalBookings   = partners.reduce((a, p) => a + (p.bookings || 0), 0);
  const totalCommission = partners.reduce((a, p) => a + (p.commission || 0), 0);
  const totalOutstanding= partners.reduce((a, p) => a + (p.outstanding || 0), 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--hairline)", background: "var(--bg)", display: "flex", gap: 14, alignItems: "center" }}>
        <input placeholder="Search partners…" style={{ maxWidth: 320, flex: 1, padding: "8px 12px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 13, fontFamily: "var(--font-body)" }} />
        <select defaultValue="" style={{ width: 160, padding: "8px 12px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 13 }}>
          <option value="">All tiers</option><option>Platinum</option><option>Gold</option><option>Silver</option>
        </select>
        <div style={{ flex: 1 }} />
        <Btn variant="accent" size="sm" icon="plus">Onboard partner</Btn>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
          <StatCard label="ACTIVE PARTNERS" value={partners.length} icon="users" />
          <StatCard label="TOTAL LEADS" value={totalLeads} delta="+22% QoQ" icon="chart" />
          <StatCard label="BOOKINGS" value={totalBookings} icon="check" />
          <StatCard label="PAYOUTS DUE" value={fmtINR(totalOutstanding)} deltaTone="down" delta={"of " + fmtINR(totalCommission)} icon="rupee" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {partners.map(p => {
            const tier = tierTone[p.tier] || tierTone.Silver;
            return (
              <div key={p.id} style={{
                background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, padding: 20,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 10,
                      background: "var(--dux-navy)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700,
                    }}>{p.name.split(" ").map(w => w[0]).join("").slice(0, 2)}</div>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 2 }}>{p.contact} · {p.phone}</div>
                      <div style={{ fontSize: 10, color: "var(--neutral-400)", marginTop: 2, fontFamily: "var(--font-mono)" }}>{p.rera}</div>
                    </div>
                  </div>
                  <span style={{
                    padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    background: tier.bg, color: tier.fg,
                  }}>{p.tier}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: "14px 0", borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }}>
                  <KVStat label="LEADS" value={p.totalLeads} />
                  <KVStat label="BOOKINGS" value={p.bookings} />
                  <KVStat label="COMMISSION" value={fmtINR(p.commission)} mono />
                  <KVStat label="EMAIL" value={p.email} small />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                  <div>
                    <div className="dux-eyebrow" style={{ fontSize: 9 }}>OUTSTANDING PAYOUT</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: p.outstanding > 0 ? "var(--dux-amber-600)" : "var(--neutral-400)", marginTop: 2 }}>
                      {fmtINR(p.outstanding)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn variant="ghost" size="sm">View leads</Btn>
                    <Btn variant="outline" size="sm" onClick={async () => {
                      if (!p.outstanding) { frappe.show_alert("No outstanding payout for " + p.name); return; }
                      try {
                        const r = await frappe.call({ method: "dux_crm_realty.api.crm.process_payout", args: { partner: p.id } });
                        frappe.show_alert({ message: "Cleared " + fmtINR(r.message.cleared) + " to " + p.name, indicator: "green" });
                        if (window.__refreshCRM) await window.__refreshCRM();
                      } catch (e) { frappe.msgprint(e.message || "Could not process payout"); }
                    }}>Process payout</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function KVStat({ label, value, mono, small }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="dux-eyebrow" style={{ fontSize: 9 }}>{label}</div>
      <div style={{
        fontFamily: mono ? "var(--font-mono)" : "var(--font-display)",
        fontSize: small ? 11 : (mono ? 13 : 16),
        fontWeight: 700, marginTop: 2,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{value}</div>
    </div>
  );
}
