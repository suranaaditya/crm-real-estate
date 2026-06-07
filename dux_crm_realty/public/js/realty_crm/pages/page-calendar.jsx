import React from "react";
/* My Calendar — the single calendar surface for tasks + site visits, week/day.
   Owner selector views anyone's agenda (or "Everyone (team)") and a project
   filter narrows to one project; the kind chips (All / Tasks / Visits) switch
   the lens. The "Site Visits" nav entry mounts this with teamView + the Visits
   lens, so there is no separate visits calendar. Clicking a visit (or a
   lead-linked item) opens the lead drawer. */

const CAL_ICON = { "Follow-up call": "phone", "WhatsApp": "whatsapp", "Email": "mail", "Site visit": "calendar", "Send documents": "file", "Collect documents": "file", "Payment follow-up": "rupee", "Meeting": "users", "Other": "note" };

const EVERYONE = "__all__";   // owner-selector sentinel: show the whole team's agenda

window.PageCalendar = function PageCalendar({ initialKind = "all", teamView = false }) {
  const data = window.CRM_DATA;
  const TODAY = data.today || "2026-04-29";
  const pad = (n) => String(n).padStart(2, "0");
  const fmtISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const mondayOf = (iso) => { const d = new Date(iso + "T00:00:00"); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d; };

  const me = (data.currentUser && data.currentUser.name) || (data.owners[0] && data.owners[0].name) || "";
  const [owner, setOwner] = React.useState(teamView ? EVERYONE : me);
  const [kind, setKind] = React.useState(initialKind);   // all | tasks | visits
  const [projectF, setProjectF] = React.useState("all"); // all | P-<code>
  const [view, setView] = React.useState("week");
  const [weekStart, setWeekStart] = React.useState(() => mondayOf(TODAY));
  const [selectedDate, setSelectedDate] = React.useState(TODAY);
  const [taskOpen, setTaskOpen] = React.useState(false);
  const [openLead, setOpenLead] = React.useState(null);   // lead drawer (opened from a visit/linked task)
  const findLead = (id) => (data.leads || []).find(l => l.id === id);

  const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); const iso = fmtISO(d);
    return { date: iso, label: DOW[i], num: d.getDate(), today: iso === TODAY };
  });
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${MON[weekStart.getMonth()]} ${weekStart.getDate()} – ${MON[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  const shiftWeek = (n) => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + n * 7); return d; });

  const refresh = async () => { if (window.__refreshCRM) await window.__refreshCRM(); };
  const toggleTask = async (id) => { try { await frappe.call({ method: "dux_crm_realty.api.crm.set_task_status", args: { task: id } }); await refresh(); } catch (e) { frappe.msgprint(e.message || "Could not update task"); } };

  const items = React.useMemo(() => {
    const out = [];
    const mineT = (t) => owner === EVERYONE || t.assignedTo === owner;
    const mineV = (v) => owner === EVERYONE || v.ownerName === owner;
    const inProj = (p) => projectF === "all" || p === projectF;
    if (kind !== "visits") (data.tasks || []).filter(t => mineT(t) && inProj(t.project)).forEach(t => out.push({
      id: t.id, date: t.dueDate, time: (t.dueTime || "09:00").slice(0, 5), kind: "task",
      title: t.title, type: t.type, sub: t.type + (t.leadName ? " · " + t.leadName : ""),
      priority: t.priority, done: t.done, leadId: t.leadId, raw: t,
    }));
    if (kind !== "tasks") (data.visits || []).filter(v => mineV(v) && inProj(v.project)).forEach(v => out.push({
      id: v.id, date: v.date, time: (v.time || "11:00").slice(0, 5), kind: "visit",
      title: v.leadName, type: "Site visit",
      sub: (v.projectName || "Site visit") + " · party of " + v.partyOf + (v.status ? " · " + v.status : ""),
      status: v.status, leadId: v.leadId, raw: v,
    }));
    return out;
  }, [owner, kind, projectF, data]);

  const toneFor = (it) => {
    if (it.kind === "visit") return { bg: "var(--dux-amber-100)", fg: "var(--dux-amber-600)" };
    if (it.priority === "high") return { bg: "var(--dux-coral-100)", fg: "#B5462C" };
    if (it.priority === "med") return { bg: "var(--info-bg)", fg: "var(--info)" };
    return { bg: "var(--neutral-100)", fg: "var(--neutral-600)" };
  };

  const slots = []; for (let h = 8; h <= 19; h++) slots.push(h);
  const itemsOn = (iso, h) => items.filter(it => it.date === iso && parseInt(it.time.split(":")[0]) === h);
  const dayItems = items.filter(it => it.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));

  const openTasks = items.filter(it => it.kind === "task" && !it.done);
  const overdue = items.filter(it => it.kind === "task" && !it.done && it.date < TODAY);
  const todayCount = items.filter(it => it.date === TODAY).length;
  const visitsCount = items.filter(it => it.kind === "visit").length;

  const onItemClick = (it) => {
    if (it.kind === "task") return toggleTask(it.id);
    if (it.kind === "visit" && it.leadId) { const l = findLead(it.leadId); if (l) setOpenLead(l); }
  };

  const ItemCard = ({ it, compact }) => {
    const tone = toneFor(it);
    const clickable = it.kind === "task" || (it.kind === "visit" && it.leadId);
    return (
      <div onClick={() => onItemClick(it)} title={it.kind === "task" ? "Click to mark done/undone" : (it.leadId ? "Open lead" : "")}
        style={{ background: tone.bg, borderLeft: `3px solid ${tone.fg}`, borderRadius: compact ? 4 : 8, padding: compact ? "4px 6px" : "10px 12px", cursor: clickable ? "pointer" : "default", marginBottom: compact ? 2 : 0, opacity: it.done ? 0.55 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: compact ? 4 : 8 }}>
          {!compact && <Icon name={CAL_ICON[it.type] || "note"} size={14} style={{ color: tone.fg }} />}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: compact ? 9 : 11, color: tone.fg, fontWeight: 700 }}>{it.time}</span>
          {it.kind === "task" && it.done && <Icon name="check" size={compact ? 9 : 12} style={{ color: "var(--success)" }} />}
        </div>
        <div style={{ fontSize: compact ? 11 : 13, fontWeight: 600, color: "var(--neutral-800)", textDecoration: it.done ? "line-through" : "none", lineHeight: 1.25, marginTop: compact ? 0 : 2 }}>{it.title}</div>
        {!compact && <div style={{ fontSize: 11, color: "var(--neutral-500)", marginTop: 2 }}>{it.sub}</div>}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid var(--hairline)", background: "var(--bg)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Btn variant="ghost" size="sm" onClick={() => shiftWeek(-1)}>‹</Btn>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, minWidth: 200, textAlign: "center" }}>{weekLabel}</div>
          <Btn variant="ghost" size="sm" onClick={() => shiftWeek(1)}>›</Btn>
        </div>
        <Btn variant="outline" size="sm" onClick={() => { setWeekStart(mondayOf(TODAY)); setSelectedDate(TODAY); }}>Today</Btn>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--neutral-400)", fontFamily: "var(--font-display)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Calendar of</span>
        <select value={owner} onChange={(e) => setOwner(e.target.value)} style={{ padding: "8px 12px", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 13, fontFamily: "var(--font-body)" }}>
          <option value={EVERYONE}>Everyone (team)</option>
          {(data.owners || []).map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
        </select>
        <select value={projectF} onChange={(e) => setProjectF(e.target.value)} title="Filter by project" style={{ padding: "8px 12px", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 13, fontFamily: "var(--font-body)" }}>
          <option value="all">All projects</option>
          {(data.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <SegmentedControl value={view} onChange={setView} options={[{ value: "week", label: "Week" }, { value: "day", label: "Day" }]} />
        <Btn variant="accent" size="sm" icon="plus" onClick={() => setTaskOpen(true)}>New task</Btn>
      </div>

      {/* filter chips */}
      <div style={{ padding: "14px 24px 0", display: "flex", gap: 8, alignItems: "center" }}>
        <FilterChip active={kind === "all"} onClick={() => setKind("all")} count={items.length}>All</FilterChip>
        <FilterChip active={kind === "tasks"} onClick={() => setKind("tasks")}>Tasks</FilterChip>
        <FilterChip active={kind === "visits"} onClick={() => setKind("visits")}>Visits</FilterChip>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--neutral-500)" }}>
          {owner === EVERYONE ? "Team" : owner === me ? "Your" : owner + "’s"} agenda · <strong style={{ color: "var(--neutral-800)" }}>{openTasks.length}</strong> open tasks
          {overdue.length > 0 && <> · <strong style={{ color: "var(--error)" }}>{overdue.length} overdue</strong></>}
        </span>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
          <StatCard label="DUE TODAY" value={todayCount} icon="calendar" />
          <StatCard label="OPEN TASKS" value={openTasks.length} icon="check" />
          <StatCard label="OVERDUE" value={overdue.length} deltaTone="down" delta={overdue.length ? "needs attention" : "all clear"} icon="x" />
          <StatCard label="VISITS" value={visitsCount} icon="building" />
        </div>

        {view === "week" && (
          <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: "var(--neutral-50)", borderBottom: "1px solid var(--hairline)" }} />
            {weekDays.map(d => (
              <div key={d.date} onClick={() => { setSelectedDate(d.date); setView("day"); }} style={{ padding: "12px 14px", textAlign: "center", cursor: "pointer", borderBottom: "1px solid var(--hairline)", borderLeft: "1px solid var(--hairline)", background: d.today ? "var(--dux-amber-100)" : "var(--neutral-50)" }}>
                <div className="dux-eyebrow" style={{ fontSize: 10 }}>{d.label}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: d.today ? "var(--dux-amber-600)" : "var(--neutral-800)", marginTop: 2 }}>{d.num}</div>
              </div>
            ))}
            {slots.map(h => (
              <React.Fragment key={h}>
                <div style={{ padding: "8px 10px", fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--neutral-400)", textAlign: "right", borderTop: "1px solid var(--hairline)", background: "var(--neutral-50)" }}>
                  {h > 12 ? `${h - 12} PM` : `${h} AM`}
                </div>
                {weekDays.map(d => (
                  <div key={d.date + h} style={{ minHeight: 54, borderTop: "1px solid var(--hairline)", borderLeft: "1px solid var(--hairline)", padding: 4, background: d.today ? "rgba(242,169,59,0.04)" : "transparent" }}>
                    {itemsOn(d.date, h).map(it => <ItemCard key={it.kind + it.id} it={it} compact />)}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        )}

        {view === "day" && (
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>{new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
              <div style={{ fontSize: 13, color: "var(--neutral-400)" }}>{dayItems.length} items</div>
              <div style={{ flex: 1 }} />
              <Btn variant="ghost" size="sm" onClick={() => setView("week")}>← Back to week</Btn>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden" }}>
              {slots.map(h => {
                const its = dayItems.filter(it => parseInt(it.time.split(":")[0]) === h);
                return (
                  <React.Fragment key={h}>
                    <div style={{ padding: "16px 12px", borderTop: h === 8 ? "none" : "1px solid var(--hairline)", background: "var(--neutral-50)", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--neutral-600)" }}>
                      {h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`}
                    </div>
                    <div style={{ padding: 10, borderTop: h === 8 ? "none" : "1px solid var(--hairline)", minHeight: 56, display: "flex", flexDirection: "column", gap: 8 }}>
                      {its.map(it => <ItemCard key={it.kind + it.id} it={it} />)}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <TaskModal open={taskOpen} onClose={() => setTaskOpen(false)}
        defaultOwner={owner === EVERYONE ? me : owner}
        defaultDate={selectedDate} onSaved={refresh} />
      {openLead && <LeadDetail key={openLead.id} lead={openLead} onClose={() => setOpenLead(null)} />}
    </div>
  );
};
