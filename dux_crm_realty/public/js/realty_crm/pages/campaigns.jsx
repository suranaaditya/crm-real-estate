import React from "react";
/* Campaigns — marketing performance. The prototype shipped this as a "coming
   soon" stub but the dataset + design tokens are complete, so this is a real
   table view built in the same design language (noted as an addition). */

window.PageCampaigns = function PageCampaigns() {
  const data = window.CRM_DATA;
  const campaigns = data.campaigns || [];
  const [filter, setFilter] = React.useState("all");

  const statusTone = {
    active:    { bg: "var(--success-bg)",   fg: "var(--success)",       label: "Active" },
    ended:     { bg: "var(--neutral-100)",  fg: "var(--neutral-600)",   label: "Ended" },
    scheduled: { bg: "var(--info-bg)",      fg: "var(--info)",          label: "Scheduled" },
  };

  const visible = filter === "all" ? campaigns : campaigns.filter(c => c.status === filter);
  const active = campaigns.filter(c => c.status === "active");
  const totalLeads = campaigns.reduce((a, c) => a + (c.leads || 0), 0);
  const totalSpent = campaigns.reduce((a, c) => a + (c.spent || 0), 0);
  const totalBudget = campaigns.reduce((a, c) => a + (c.budget || 0), 0);
  const totalBookings = campaigns.reduce((a, c) => a + (c.bookings || 0), 0);
  const blendedCpl = totalLeads ? Math.round(totalSpent / totalLeads) : 0;

  const counts = {
    all: campaigns.length,
    active: active.length,
    scheduled: campaigns.filter(c => c.status === "scheduled").length,
    ended: campaigns.filter(c => c.status === "ended").length,
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--hairline)", background: "var(--bg)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <StatCard label="ACTIVE CAMPAIGNS" value={active.length} delta={counts.scheduled + " scheduled"} icon="target" />
          <StatCard label="LEADS GENERATED" value={totalLeads} delta={totalBookings + " bookings"} icon="users" />
          <StatCard label="MARKETING SPEND" value={fmtINR(totalSpent)} delta={"of " + fmtINR(totalBudget)} icon="rupee" />
          <StatCard label="BLENDED CPL" value={fmtINR(blendedCpl)} delta="cost per lead" icon="chart" />
        </div>
      </div>

      <div style={{ padding: "16px 24px 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} count={counts.all}>All</FilterChip>
        <FilterChip active={filter === "active"} onClick={() => setFilter("active")} count={counts.active}>Active</FilterChip>
        <FilterChip active={filter === "scheduled"} onClick={() => setFilter("scheduled")} count={counts.scheduled}>Scheduled</FilterChip>
        <FilterChip active={filter === "ended"} onClick={() => setFilter("ended")} count={counts.ended}>Ended</FilterChip>
        <div style={{ flex: 1 }} />
        <Btn variant="accent" icon="plus" size="sm">New campaign</Btn>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{ background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--neutral-50)", textAlign: "left", fontSize: 10, color: "var(--neutral-600)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Campaign</th>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Status</th>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Period</th>
                <th style={{ padding: "10px 16px", fontWeight: 700, minWidth: 150 }}>Budget</th>
                <th style={{ padding: "10px 16px", fontWeight: 700, textAlign: "right" }}>Leads</th>
                <th style={{ padding: "10px 16px", fontWeight: 700, textAlign: "right" }}>Qualified</th>
                <th style={{ padding: "10px 16px", fontWeight: 700, textAlign: "right" }}>Visits</th>
                <th style={{ padding: "10px 16px", fontWeight: 700, textAlign: "right" }}>Bookings</th>
                <th style={{ padding: "10px 16px", fontWeight: 700, textAlign: "right" }}>CPL</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(c => {
                const tone = statusTone[c.status] || statusTone.ended;
                const spentPct = c.budget ? Math.min(100, Math.round((c.spent / c.budget) * 100)) : 0;
                return (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "var(--neutral-400)" }}>{c.channel} · {c.id}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: tone.bg, color: tone.fg, textTransform: "uppercase", letterSpacing: "0.04em" }}>{tone.label}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--neutral-600)" }}>
                      {fmtDate(c.startDate)}<br />→ {fmtDate(c.endDate)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{fmtINR(c.spent)}</span>
                        <span style={{ color: "var(--neutral-400)" }}>{spentPct}%</span>
                      </div>
                      <div style={{ height: 6, background: "var(--neutral-100)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: spentPct + "%", background: "var(--dux-amber)" }} />
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{c.leads}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{c.qualified}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{c.visits}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--success)" }}>{c.bookings}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{c.cpl ? fmtINR(c.cpl) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
