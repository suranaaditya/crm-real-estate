import React from "react";
/* Reports & analytics */

window.PageReports = function PageReports() {
  const data = window.CRM_DATA;

  // Source breakdown. A lead with no source would key the object as the STRING "null" and
  // render a legend row literally labelled "null" — bucket those as "Not set".
  const sourceCounts = {};
  data.leads.forEach(l => {
    const k = l.source || "Not set";
    sourceCounts[k] = (sourceCounts[k] || 0) + 1;
  });
  const sourceTotal = Object.values(sourceCounts).reduce((a, b) => a + b, 0);
  // ONE ordering shared by the donut and its legend — they used to iterate different
  // orders (unsorted vs sorted), so 9 of 12 legend swatches named the wrong arc.
  const sourceRows = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
  const sourcePalette = ["#244C5A", "#E8A95B", "#568A4F", "#B5462C", "#8564A8", "#5C6B73"];

  // Monthly trend — the trailing 6 months ending at "today", computed from real visits and
  // bookings. (This was a hardcoded mock array that showed ~296 visits against 32 real ones.)
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const anchor = new Date(data.today + "T00:00:00");
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    months.push({
      m: MON[d.getMonth()], key,
      visits: data.visits.filter(v => (v.date || "").slice(0, 7) === key).length,
      bookings: data.bookings.filter(b => (b.date || "").slice(0, 7) === key).length,
    });
  }
  // one shared scale for both series (the old code amplified bookings 4x, which made the
  // two bars incomparable); floor at 1 so an all-zero window can't divide by zero
  const maxV = Math.max(1, ...months.map(m => Math.max(m.visits, m.bookings)));

  // Lead -> booking conversion, same definition the Leads page and Dashboard use.
  const bookedLeads = data.leads.filter(l => l.stage === "booked").length;
  const leadToBooking = data.leads.length
    ? ((bookedLeads / data.leads.length) * 100).toFixed(1) + "%" : "—";

  // Average sales cycle = booking date - lead creation, over bookings that still carry a
  // lead link. Shows "—" rather than inventing a number when nothing is measurable.
  const leadCreated = {};
  data.leads.forEach(l => { if (l.created) leadCreated[l.id] = l.created; });
  const cycles = data.bookings
    .map(b => {
      const c = leadCreated[b.leadId];
      if (!c || !b.date) return null;
      const days = (new Date(b.date) - new Date(c)) / 86400000;
      return days >= 0 ? days : null;
    })
    .filter(d => d !== null);
  const avgCycle = cycles.length
    ? Math.round(cycles.reduce((a, d) => a + d, 0) / cycles.length) + " days" : "—";

  // Sales by project
  const byProject = data.projects.map(p => ({
    name: p.code, label: p.name, sold: p.sold, total: p.totalUnits,
    revenue: p.sold * ((p.priceFrom || 0) + (p.priceTo || 0)) / 2,
  }));

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div>
          <div className="dux-eyebrow" style={{ fontSize: 10 }}>FY 2025-26 · Q1</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, marginTop: 4 }}>Reports & Analytics</div>
        </div>
        <div style={{ flex: 1 }} />
        <select className="dux-input" style={{ width: 180 }} defaultValue="quarter"><option value="quarter">This quarter</option><option>Last 6 months</option><option>YTD</option></select>
        <Btn variant="outline" size="sm" icon="files">Export PDF</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatCard label="GROSS BOOKINGS" value={fmtINR(data.bookings.reduce((a, b) => a + (b.bsp || 0), 0))} delta={data.bookings.length + " bookings"} icon="rupee" />
        <StatCard label="UNITS SOLD" value={data.projects.reduce((a, p) => a + (p.sold || 0), 0)} delta={data.projects.reduce((a, p) => a + (p.totalUnits || 0), 0) + " total units"} icon="building" />
        <StatCard label="LEAD → BOOKING" value={leadToBooking} delta={bookedLeads + " of " + data.leads.length} icon="chart" />
        <StatCard label="AVG. SALES CYCLE" value={avgCycle} delta={cycles.length ? cycles.length + " bookings sampled" : "no linked bookings"} icon="calendar" />
      </div>

      {/* Trend chart */}
      <Panel title="Visits & bookings trend" subtitle="LAST 6 MONTHS">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 24, alignItems: "flex-end", padding: "20px 8px 8px", height: 240 }}>
          {months.map(m => {
            const vh = (m.visits / maxV) * 180;
            const bh = (m.bookings / maxV) * 180;
            return (
              <div key={m.m} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 180 }}>
                  <div style={{ width: 28, height: vh, background: "var(--dux-navy)", borderRadius: "4px 4px 0 0", position: "relative" }}>
                    <span style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--dux-navy)" }}>{m.visits}</span>
                  </div>
                  <div style={{ width: 28, height: bh, background: "var(--dux-amber)", borderRadius: "4px 4px 0 0", position: "relative" }}>
                    <span style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--dux-amber-600)" }}>{m.bookings}</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--neutral-600)" }}>{m.m}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 18, paddingTop: 12, borderTop: "1px solid var(--hairline)", marginTop: 8 }}>
          <Legend color="var(--dux-navy)" label="Site visits" />
          <Legend color="var(--dux-amber)" label="Bookings" />
        </div>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Source breakdown */}
        <Panel title="Lead sources" subtitle="Q1 FY26">
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "center" }}>
            <DonutChart data={sourceRows.map(([k, v], i) => ({ label: k, value: v, color: sourcePalette[i % sourcePalette.length] }))} total={sourceTotal} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sourceRows.map(([k, v], i) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: sourcePalette[i % sourcePalette.length] }} />
                  <span style={{ flex: 1 }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{v}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--neutral-400)", width: 40, textAlign: "right" }}>{Math.round(v / sourceTotal * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Sales by project */}
        <Panel title="Sales velocity by project" subtitle="UNITS SOLD">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {byProject.map(p => {
              // 0/0 => NaN => width:"NaN%" is invalid CSS, the browser drops the
              // declaration and the bar renders FULL — i.e. an unbuilt project read as
              // 100% sold. Same guard the dashboard already had.
              const pct = p.total ? (p.sold / p.total) * 100 : 0;
              return (
                <div key={p.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{p.label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--neutral-600)" }}>{p.sold}/{p.total} · {fmtINR(p.revenue)}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--neutral-100)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg, var(--dux-amber), var(--dux-amber-600))" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
};

function Legend({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
      <span style={{ color: "var(--neutral-600)", fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function DonutChart({ data, total, size = 160 }) {
  const r = size / 2 - 12;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--neutral-50)" strokeWidth="20" />
      {data.map((d, i) => {
        const len = (d.value / total) * circumference;
        const dash = `${len} ${circumference - len}`;
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="20" strokeDasharray={dash} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`} />;
        offset += len;
        return el;
      })}
      <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, fill: "var(--neutral-800)" }}>{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 10, fill: "var(--neutral-400)", letterSpacing: "0.08em" }}>LEADS</text>
    </svg>
  );
}
