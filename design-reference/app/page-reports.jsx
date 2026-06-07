/* Reports & analytics */

window.PageReports = function PageReports() {
  const data = window.CRM_DATA;

  // Source breakdown
  const sourceCounts = {};
  data.leads.forEach(l => { sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1; });
  const sourceTotal = Object.values(sourceCounts).reduce((a, b) => a + b, 0);
  const sourcePalette = ["#244C5A", "#E8A95B", "#568A4F", "#B5462C", "#8564A8", "#5C6B73"];

  // Monthly trend (mock 6 months)
  const months = [
    { m: "Nov", visits: 42, bookings: 4 },
    { m: "Dec", visits: 38, bookings: 3 },
    { m: "Jan", visits: 51, bookings: 5 },
    { m: "Feb", visits: 47, bookings: 6 },
    { m: "Mar", visits: 62, bookings: 7 },
    { m: "Apr", visits: 56, bookings: 8 },
  ];
  const maxV = Math.max(...months.map(m => m.visits));

  // Sales by project
  const byProject = data.projects.map(p => ({
    name: p.code, label: p.name, sold: p.sold, total: p.totalUnits,
    revenue: p.sold * (p.priceFrom + p.priceTo) / 2,
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
        <StatCard label="GROSS BOOKINGS" value={fmtINR(data.bookings.reduce((a, b) => a + b.bsp, 0))} delta="+34% YoY" icon="rupee" />
        <StatCard label="UNITS SOLD" value={data.projects.reduce((a, p) => a + p.sold, 0)} delta="+12 this month" icon="building" />
        <StatCard label="LEAD → BOOKING" value="14.2%" delta="+2.1 pp" icon="chart" />
        <StatCard label="AVG. SALES CYCLE" value="38 days" delta="-4 days" icon="calendar" />
      </div>

      {/* Trend chart */}
      <Panel title="Visits & bookings trend" subtitle="LAST 6 MONTHS">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 24, alignItems: "flex-end", padding: "20px 8px 8px", height: 240 }}>
          {months.map(m => {
            const vh = (m.visits / maxV) * 180;
            const bh = (m.bookings / maxV) * 180 * 4; // amplify
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
            <DonutChart data={Object.entries(sourceCounts).map(([k, v], i) => ({ label: k, value: v, color: sourcePalette[i % sourcePalette.length] }))} total={sourceTotal} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).map(([k, v], i) => (
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
              const pct = (p.sold / p.total) * 100;
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
