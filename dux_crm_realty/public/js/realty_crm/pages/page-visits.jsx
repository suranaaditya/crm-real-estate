import React from "react";
/* Site Visits — calendar grid + day timeline. Uses CRM_DATA.visits shape. */

window.PageVisits = function PageVisits() {
  const data = window.CRM_DATA;
  const [view, setView] = React.useState("week");
  const TODAY = data.today || "2026-04-29";
  const pad = (n) => String(n).padStart(2, "0");
  const fmtISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const mondayOf = (iso) => { const d = new Date(iso + "T00:00:00"); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d; };
  const [weekStart, setWeekStart] = React.useState(() => mondayOf(TODAY));
  const [selectedDate, setSelectedDate] = React.useState(TODAY);

  const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i);
    const iso = fmtISO(d);
    return { date: iso, label: DOW[i], num: d.getDate(), today: iso === TODAY };
  });
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${MON[weekStart.getMonth()]} ${weekStart.getDate()} – ${MON[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  const shiftWeek = (n) => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + n * 7); return d; });

  const dayVisits = data.visits.filter(v => v.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const slots = [];
  for (let h = 9; h <= 19; h++) slots.push(h);

  const statusTone = {
    confirmed:    { bg: "rgba(86, 138, 79, 0.12)", fg: "var(--success)",        label: "Confirmed" },
    "in-progress":{ bg: "var(--dux-amber-100)",    fg: "var(--dux-amber-600)",  label: "In progress" },
    completed:    { bg: "var(--neutral-100)",      fg: "var(--neutral-600)",    label: "Completed" },
    "no-show":    { bg: "var(--danger-50, #FBE5E5)", fg: "var(--danger, #D14343)", label: "No show" },
    tentative:    { bg: "var(--info-bg, #DCEAF8)", fg: "var(--info, #2F6EB5)",  label: "Tentative" },
  };
  const toneFor = (s) => statusTone[s] || statusTone.confirmed;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{
        padding: "16px 24px", display: "flex", alignItems: "center", gap: 16,
        borderBottom: "1px solid var(--hairline)", background: "var(--bg)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Btn variant="ghost" size="sm" onClick={() => shiftWeek(-1)}>‹</Btn>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, minWidth: 200, textAlign: "center" }}>
            {weekLabel}
          </div>
          <Btn variant="ghost" size="sm" onClick={() => shiftWeek(1)}>›</Btn>
        </div>
        <Btn variant="outline" size="sm" onClick={() => { setWeekStart(mondayOf(TODAY)); setSelectedDate(TODAY); }}>Today</Btn>
        <div style={{ flex: 1 }} />
        <SegmentedControl value={view} onChange={setView} options={[{ value: "week", label: "Week" }, { value: "day", label: "Day" }]} />
        <select className="dux-input" style={{ width: 200, padding: "8px 12px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 13 }} defaultValue="">
          <option value="">All projects</option>
          {data.projects.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
        </select>
        <Btn variant="accent" size="sm" icon="plus">Schedule visit</Btn>
      </div>

      {view === "week" && (
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
            <StatCard label="VISITS THIS WEEK" value={data.visits.length} delta="+3 vs last" icon="calendar" />
            <StatCard label="CONFIRMED" value={data.visits.filter(v => v.status === "confirmed").length} icon="check" />
            <StatCard label="NO SHOWS" value={data.visits.filter(v => v.status === "no-show").length} delta="2.1%" deltaTone="down" icon="x" />
            <StatCard label="COMPLETED" value={data.visits.filter(v => v.status === "completed").length} delta="last 30d" icon="chart" />
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)",
            background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden",
          }}>
            <div style={{ background: "var(--neutral-50)", borderBottom: "1px solid var(--hairline)" }} />
            {weekDays.map(d => (
              <div key={d.date} onClick={() => { setSelectedDate(d.date); setView("day"); }} style={{
                padding: "12px 14px", textAlign: "center", cursor: "pointer",
                borderBottom: "1px solid var(--hairline)",
                borderLeft: "1px solid var(--hairline)",
                background: d.today ? "var(--dux-amber-100)" : "var(--neutral-50)",
              }}>
                <div className="dux-eyebrow" style={{ fontSize: 10 }}>{d.label}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: d.today ? "var(--dux-amber-600)" : "var(--neutral-800)", marginTop: 2 }}>
                  {d.num}
                </div>
              </div>
            ))}

            {slots.map(h => (
              <React.Fragment key={h}>
                <div style={{
                  padding: "8px 10px", fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
                  color: "var(--neutral-400)", textAlign: "right", borderTop: "1px solid var(--hairline)",
                  background: "var(--neutral-50)",
                }}>
                  {h > 12 ? `${h - 12} PM` : `${h} AM`}
                </div>
                {weekDays.map(d => {
                  const slotVisits = data.visits.filter(v => {
                    const vh = parseInt(v.time.split(":")[0]);
                    return v.date === d.date && vh === h;
                  });
                  return (
                    <div key={d.date + h} style={{
                      minHeight: 56, borderTop: "1px solid var(--hairline)",
                      borderLeft: "1px solid var(--hairline)",
                      padding: 4,
                      background: d.today ? "rgba(242, 169, 59, 0.04)" : "transparent",
                    }}>
                      {slotVisits.map(v => {
                        const tone = toneFor(v.status);
                        return (
                          <div key={v.id} style={{
                            background: tone.bg, padding: "4px 6px",
                            borderRadius: 4, fontSize: 10, fontWeight: 600,
                            borderLeft: `2px solid ${tone.fg}`, marginBottom: 2,
                            cursor: "pointer", lineHeight: 1.3,
                          }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: tone.fg }}>{v.time}</div>
                            <div style={{ color: "var(--neutral-800)", fontSize: 11 }}>{v.leadName.split(" ")[0]}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {view === "day" && (
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700 }}>
              {new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <div style={{ fontSize: 13, color: "var(--neutral-400)" }}>{dayVisits.length} visits scheduled</div>
            <div style={{ flex: 1 }} />
            <Btn variant="ghost" size="sm" onClick={() => setView("week")}>← Back to week</Btn>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden" }}>
            {slots.map(h => {
              const slotVisits = dayVisits.filter(v => parseInt(v.time.split(":")[0]) === h);
              return (
                <React.Fragment key={h}>
                  <div style={{
                    padding: "16px 12px", borderTop: h === 9 ? "none" : "1px solid var(--hairline)",
                    background: "var(--neutral-50)", textAlign: "right",
                    fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--neutral-600)",
                  }}>
                    {h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`}
                  </div>
                  <div style={{
                    padding: 12, borderTop: h === 9 ? "none" : "1px solid var(--hairline)",
                    minHeight: 60, display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    {slotVisits.map(v => {
                      const tone = toneFor(v.status);
                      return (
                        <div key={v.id} style={{
                          padding: "12px 16px", borderRadius: 10,
                          background: tone.bg, borderLeft: `3px solid ${tone.fg}`,
                          display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 14, alignItems: "center",
                        }}>
                          <Avatar name={v.leadName} initials={v.leadInitials} size={36} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{v.leadName}</div>
                            <div style={{ fontSize: 12, color: "var(--neutral-600)" }}>
                              {v.time} · {v.projectName} · party of {v.partyOf} · {v.ownerName}
                            </div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: tone.fg, padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.7)" }}>
                            {tone.label.toUpperCase()}
                          </span>
                          <Btn variant="ghost" size="sm">Open lead</Btn>
                        </div>
                      );
                    })}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

window.SegmentedControl = function SegmentedControl({ value, onChange, options }) {
  return (
    <div style={{ display: "inline-flex", padding: 3, background: "var(--neutral-100)", borderRadius: 8, gap: 2 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          padding: "6px 14px", border: "none",
          background: value === o.value ? "var(--bg)" : "transparent",
          color: value === o.value ? "var(--neutral-800)" : "var(--neutral-600)",
          fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer",
          boxShadow: value === o.value ? "var(--shadow-xs)" : "none",
        }}>{o.label}</button>
      ))}
    </div>
  );
};
