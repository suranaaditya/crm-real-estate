import React from "react";
/* Dashboard — executive overview at login. */

window.PageDashboard = function PageDashboard({ onNav }) {
  const data = window.CRM_DATA;
  // "today" comes from the bootstrap so the pin lives in exactly one place (see CLAUDE.md)
  const visitsToday = data.visits.filter(v => v.date === data.today).length;
  const visitsWeek = data.visits.filter(v => {
    const d = new Date(v.date), t = new Date(data.today);
    const diff = (d - t) / 86400000; return diff >= -3 && diff <= 7;
  }).length;
  const overdue = data.paymentDues.filter(p => p.status === "overdue").length;
  const overdueAmt = data.paymentDues.filter(p => p.status === "overdue").reduce((a, p) => a + (p.amount || 0), 0);

  // Conversion = leads that reached "booked". Computed, not asserted — the Leads page uses
  // the same definition, so the two screens can never disagree.
  const bookedLeads = data.leads.filter(l => l.stage === "booked").length;
  const conversion = data.leads.length
    ? ((bookedLeads / data.leads.length) * 100).toFixed(1) + "%" : "—";

  // Follow-ups the signed-in rep has actually let slip (open + past due).
  const myOpen = data.tasks.filter(t => !t.done && t.assignedTo === _me().name);
  const overdueTasks = myOpen.filter(t => t.due && t.due < data.today).length;

  // Funnel
  const funnel = data.stages.slice(0, 6).map(s => ({
    label: s.label, count: data.leads.filter(l => l.stage === s.id).length, tone: s.tone,
  }));
  // guard: with every stage empty, max is 0 and each bar's width becomes NaN% — an invalid
  // CSS value the browser drops, which renders as a FULL bar (i.e. reads as 100%).
  const funnelMax = Math.max(1, ...funnel.map(f => f.count));

  // Project performance
  const projPerf = data.projects.map(p => ({
    ...p, soldPct: p.totalUnits ? Math.round((p.sold / p.totalUnits) * 100) : 0,
    revenue: p.sold * ((p.priceFrom + p.priceTo) / 2),
  }));

  // Recent activity (last 8 leads by lastActivity)
  // lastActivity can legitimately be null on imported leads — guard the sort.
  const recent = [...data.leads]
    .sort((a, b) => String(b.lastActivity || "").localeCompare(String(a.lastActivity || "")))
    .slice(0, 6);

  // Today's tasks — MINE, due today or earlier. Without the assignee filter this panel
  // showed the whole team's open tasks to everyone under the label "Your plate".
  const todayTasks = myOpen
    .filter(t => !t.due || t.due <= data.today)
    .sort((a, b) => String(a.due || "").localeCompare(String(b.due || "")))
    .slice(0, 5);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Welcome banner */}
      <div style={{
        background: "linear-gradient(120deg, var(--dux-navy) 0%, var(--dux-navy-700) 100%)",
        color: "#fff", borderRadius: 14, padding: "24px 28px",
        display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "center",
      }}>
        <div>
          <div className="dux-eyebrow" style={{ color: "var(--dux-amber)", fontSize: 11, marginBottom: 8 }}>WEDNESDAY · 29 APR 2026</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>{"Good " + (new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening") + ", " + String(_me().name).split(" ")[0] + "."}</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.72)", marginTop: 6 }}>
            You have <strong style={{ color: "#fff" }}>{visitsToday} site visits</strong> today and <strong style={{ color: "var(--dux-amber)" }}>{overdueTasks} overdue follow-up{overdueTasks === 1 ? "" : "s"}</strong>.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="accent" size="sm" icon="plus" onClick={() => window.__openNewLead ? window.__openNewLead() : onNav("leads")}>New Lead</Btn>
          <Btn variant="outline" size="sm" icon="calendar" onClick={() => onNav("visits")} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.4)" }}>Today's visits</Btn>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <StatCard label="OPEN LEADS" value={data.leads.filter(l => !["booked", "lost"].includes(l.stage)).length} delta={data.leads.length + " total"} icon="users" />
        <StatCard label="VISITS THIS WEEK" value={visitsWeek} icon="calendar" />
        <StatCard label="BOOKINGS" value={data.bookings.length} delta={fmtINR(data.bookings.reduce((a, b) => a + (b.bsp || 0), 0))} icon="rupee" />
        <StatCard label="COLLECTIONS OVERDUE" value={fmtINR(overdueAmt)} delta={overdue + " overdue"} deltaTone="down" icon="money" />
        <StatCard label="CONVERSION" value={conversion} delta={bookedLeads + " booked"} icon="chart" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
        {/* Funnel */}
        <Panel title="Sales funnel" subtitle="THIS QUARTER" action={<Btn variant="ghost" size="sm" onClick={() => onNav("reports")}>View report →</Btn>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {funnel.map(f => {
              const pct = (f.count / funnelMax) * 100;
              const tones = { info: "var(--info)", neutral: "var(--neutral-600)", amber: "var(--dux-amber-600)", coral: "#B5462C", success: "var(--success)" };
              return (
                <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 100, fontSize: 12, fontWeight: 600, color: "var(--neutral-800)" }}>{f.label}</div>
                  <div style={{ flex: 1, height: 28, background: "var(--neutral-50)", borderRadius: 6, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: pct + "%", background: tones[f.tone], opacity: 0.85, borderRadius: 6, transition: "width 600ms var(--ease-emphasized)" }} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", padding: "0 10px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: pct > 35 ? "#fff" : "var(--neutral-800)" }}>
                      {f.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Today */}
        <Panel title="Today" subtitle="YOUR PLATE">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {todayTasks.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--neutral-400)", padding: "10px 2px" }}>
                {myOpen.length
                  ? `Nothing due today — ${myOpen.length} open task${myOpen.length === 1 ? "" : "s"} coming up.`
                  : "Nothing on your plate today."}
                {" "}
                <button onClick={() => onNav("calendar")} style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", color: "var(--dux-amber-600)", fontWeight: 600, fontSize: 13 }}>Open My Day →</button>
              </div>
            )}
            {todayTasks.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: "var(--neutral-50)", borderRadius: 8 }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 4, border: "1.5px solid " + (t.priority === "high" ? "var(--dux-amber-600)" : "var(--neutral-300)"),
                  marginTop: 2, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 2 }}>Due {fmtRelative(t.due)}</div>
                </div>
                {t.priority === "high" && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: "var(--dux-amber-100)", color: "var(--dux-amber-600)", fontWeight: 700 }}>HIGH</span>}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Projects */}
      <Panel title="Project performance" subtitle="LIVE INVENTORY" action={<Btn variant="ghost" size="sm" onClick={() => onNav("inventory")}>Open inventory →</Btn>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {projPerf.map(p => (
            <div key={p.id} style={{
              padding: 16, borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--bg)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 2 }}>{[p.locality, p.typology].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
                  background: "var(--neutral-100)", color: "var(--neutral-600)", fontFamily: "var(--font-display)" }}>{p.code}</span>
              </div>
              <div style={{ height: 6, background: "var(--neutral-100)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: p.soldPct + "%", background: "var(--dux-amber)", transition: "width 600ms" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "var(--neutral-600)" }}>{p.sold} / {p.totalUnits} sold</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--dux-amber-600)" }}>{p.soldPct}%</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Recent activity */}
      <Panel title="Recent lead activity" subtitle="ACROSS YOUR TEAM" action={<Btn variant="ghost" size="sm" onClick={() => onNav("leads")}>All leads →</Btn>}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {recent.map((l, i) => (
            <div key={l.id} style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 14, alignItems: "center",
              padding: "12px 4px", borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
            }}>
              <Avatar name={l.name} initials={l.initials} size={32} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</div>
                <div style={{ fontSize: 11, color: "var(--neutral-400)" }}>{[[l.interest, l.projectName].filter(Boolean).join(" at "), l.source].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <StageBadge stage={l.stage} />
              <ScoreChip score={l.score} />
              <span style={{ fontSize: 11, color: "var(--neutral-400)" }}>{fmtRelative(l.lastActivity)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

window.Panel = function Panel({ title, subtitle, action, children }) {
  return (
    <section style={{
      background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 14, padding: 20,
    }}>
      <header style={{ display: "flex", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
        <div style={{ flex: 1 }}>
          {subtitle && <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 4 }}>{subtitle}</div>}
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>{title}</div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
};
