/* Workspace — unified leads view with Table ↔ Kanban toggle.
   Combines former Direction A (table-led) and Direction B (kanban). */

const { useState: aUseState, useMemo: aUseMemo } = React;

window.DirectionA = function Workspace({ density = "comfortable", defaultView = "table", onNav, active = "leads" }) {
  const data = window.CRM_DATA;
  const [view, setView] = aUseState(defaultView);
  const [stage, setStage] = aUseState("all");
  const [project, setProject] = aUseState("all");
  const [openLead, setOpenLead] = aUseState(null);
  const [sort, setSort] = aUseState({ key: "lastActivity", dir: "desc" });
  const [selected, setSelected] = aUseState(new Set());

  const leads = aUseMemo(() => {
    let l = data.leads.slice();
    if (stage !== "all") l = l.filter(x => x.stage === stage);
    if (project !== "all") l = l.filter(x => x.project === project);
    l.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      return sort.dir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return l;
  }, [stage, project, sort]);

  const counts = aUseMemo(() => {
    const c = { all: data.leads.length };
    data.stages.forEach(s => c[s.id] = data.leads.filter(l => l.stage === s.id).length);
    return c;
  }, []);

  const rowH = density === "compact" ? 44 : 56;
  const isKanban = view === "kanban";

  return (
    <div style={{ display: "flex", height: "100%", background: isKanban ? "var(--neutral-50)" : "var(--bg)", position: "relative", overflow: "hidden" }}>
      <Sidebar active={active} onNav={onNav} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Leads" subtitle={isKanban ? "PIPELINE · KANBAN" : "SALES PIPELINE · TABLE"}>
          <ViewToggle view={view} setView={setView} />
          <Btn variant="outline" icon="filter" size="sm">Filters</Btn>
          <Btn variant="accent" icon="plus" size="sm">New Lead</Btn>
        </Topbar>

        {/* KPI strip */}
        <div style={{ padding: "20px 24px 0", display: "flex", gap: 14 }}>
          <StatCard label="OPEN LEADS" value="38" delta="+12 this week" icon="users" />
          <StatCard label="VISITS THIS WEEK" value="14" delta="+3 vs last" icon="calendar" />
          <StatCard label="HOT (SCORE 75+)" value="9" delta="+2 today" icon="flame" />
          <StatCard label="BOOKINGS APRIL" value="6" delta="₹ 4.8 Cr" icon="rupee" />
          <StatCard label="CONVERSION" value="14.2%" delta="+0.8 pp" icon="chart" />
        </div>

        {/* Stage chips + filters */}
        <div style={{ padding: "16px 24px 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {!isKanban && <FilterChip active={stage === "all"} onClick={() => setStage("all")} count={counts.all}>All</FilterChip>}
          {!isKanban && data.stages.map(s => (
            <FilterChip key={s.id} active={stage === s.id} onClick={() => setStage(s.id)} count={counts[s.id]}>{s.label}</FilterChip>
          ))}
          {isKanban && <>
            <FilterChip>My leads</FilterChip>
            <FilterChip>Hot only</FilterChip>
            <FilterChip>Visit due this week</FilterChip>
          </>}
          <div style={{ flex: 1 }} />
          <select value={project} onChange={(e) => setProject(e.target.value)} style={selectStyle}>
            <option value="all">All projects</option>
            {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select style={selectStyle}>
            <option>All owners</option>
            {data.owners.map(o => <option key={o.id}>{o.name}</option>)}
          </select>
          <select style={selectStyle}>
            <option>All sources</option>
            {data.sources.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {isKanban
          ? <KanbanView data={data} leads={data.leads.filter(l => project === "all" || l.project === project)} density={density} onOpen={setOpenLead} />
          : <TableView leads={leads} totalCount={data.leads.length} density={density} rowH={rowH}
              selected={selected} setSelected={setSelected} sort={sort} setSort={setSort} onOpen={setOpenLead} />
        }
      </div>
      {openLead && <LeadDetail lead={openLead} onClose={() => setOpenLead(null)} />}
    </div>
  );
};

// ---------- View toggle ----------
function ViewToggle({ view, setView }) {
  return (
    <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--neutral-50)", borderRadius: 999, border: "1px solid var(--hairline)" }}>
      {[
        { id: "table",  icon: "list", label: "Table"  },
        { id: "kanban", icon: "grid", label: "Kanban" },
      ].map(t => {
        const active = view === t.id;
        return (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 999, border: 0, cursor: "pointer",
            background: active ? "var(--bg)" : "transparent",
            boxShadow: active ? "var(--shadow-xs)" : "none",
            fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
            color: active ? "var(--dux-navy)" : "var(--neutral-600)", textTransform: "uppercase",
          }}>
            <Icon name={t.icon} size={13} />{t.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Table view ----------
function TableView({ leads, totalCount, density, rowH, selected, setSelected, sort, setSort, onOpen }) {
  return (
    <div style={{ flex: 1, padding: "16px 24px 24px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{
        border: "1px solid var(--hairline)", borderRadius: 12, background: "var(--bg)",
        display: "flex", flexDirection: "column", flex: 1, overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", padding: "10px 16px",
          borderBottom: "1px solid var(--hairline)", fontSize: 12, color: "var(--neutral-600)",
          background: "var(--neutral-50)",
        }}>
          <div style={{ flex: 1 }}>
            Showing <strong style={{ color: "var(--neutral-800)" }}>{leads.length}</strong> of {totalCount} leads
            {selected.size > 0 && <> · <strong style={{ color: "var(--dux-amber-600)" }}>{selected.size} selected</strong></>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {selected.size > 0 && <>
              <Btn variant="soft" size="sm" icon="users">Reassign</Btn>
              <Btn variant="soft" size="sm" icon="mail">Bulk message</Btn>
            </>}
            <Btn variant="ghost" size="sm" icon="download">Export</Btn>
          </div>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
              <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                <Th w={36}><Checkbox checked={selected.size === leads.length && leads.length > 0}
                   onChange={() => setSelected(selected.size === leads.length ? new Set() : new Set(leads.map(l => l.id)))} /></Th>
                <Th>Lead</Th>
                <Th>Project / Interest</Th>
                <Th>Stage</Th>
                <Th>Score</Th>
                <Th>Source</Th>
                <Th>Owner</Th>
                <Th sortable sort={sort} setSort={setSort} k="lastActivity">Last activity</Th>
                <Th sortable sort={sort} setSort={setSort} k="visitOn">Next visit</Th>
                <Th>Budget</Th>
                <Th w={60}></Th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id} onClick={() => onOpen(l)} style={{
                  cursor: "pointer", borderBottom: "1px solid var(--hairline)",
                  height: rowH, transition: "background 150ms",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--neutral-50)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(l.id)} onChange={() => {
                      const s = new Set(selected); s.has(l.id) ? s.delete(l.id) : s.add(l.id); setSelected(s);
                    }} />
                  </Td>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={l.name} initials={l.initials} size={density === "compact" ? 28 : 34} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "var(--neutral-900)", display: "flex", alignItems: "center", gap: 6 }}>
                          {l.name}
                          {l.starred && <Icon name="starF" size={11} style={{ color: "var(--dux-amber)" }} />}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--neutral-400)", fontFamily: "var(--font-mono)" }}>{l.id} · {l.phone}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div style={{ fontWeight: 500 }}>{l.projectName}</div>
                    <div style={{ fontSize: 11, color: "var(--neutral-400)" }}>{l.interest}</div>
                  </Td>
                  <Td><StageBadge stage={l.stage} /></Td>
                  <Td><ScoreChip score={l.score} /></Td>
                  <Td>
                    <div style={{ fontSize: 12 }}>{l.source}</div>
                    {l.channelPartnerName && <div style={{ fontSize: 10, color: "var(--neutral-400)" }}>{l.channelPartnerName}</div>}
                  </Td>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={l.ownerName} initials={l.ownerInitials} size={24} />
                      <span style={{ fontSize: 12 }}>{l.ownerName.split(" ")[0]}</span>
                    </div>
                  </Td>
                  <Td><span style={{ fontSize: 12, color: "var(--neutral-600)" }}>{fmtRelative(l.lastActivity)}</span></Td>
                  <Td>{l.visitOn ? <span style={{ fontSize: 12, color: "var(--dux-amber-600)", fontWeight: 600 }}>{fmtRelative(l.visitOn)}</span> : <span style={{ color: "var(--neutral-300)" }}>—</span>}</Td>
                  <Td><span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>{fmtINR(l.budget)}</span></Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <button style={{ ...iconBtn, width: 28, height: 28, border: "none" }}><Icon name="dots" size={16} /></button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- Kanban view ----------
function KanbanView({ data, leads, density, onOpen }) {
  const visibleStages = data.stages.filter(s => s.id !== "lost");
  const grouped = {};
  visibleStages.forEach(s => grouped[s.id] = []);
  leads.forEach(l => { if (grouped[l.stage]) grouped[l.stage].push(l); });
  Object.keys(grouped).forEach(k => grouped[k].sort((a, b) => b.score - a.score));
  const stageValue = (id) => grouped[id].reduce((a, l) => a + l.budget, 0);
  const totalValue = visibleStages.reduce((a, s) => a + stageValue(s.id), 0);

  return (
    <>
      <div style={{ padding: "12px 24px 0", fontSize: 12, color: "var(--neutral-600)" }}>
        <strong style={{ color: "var(--neutral-900)", fontFamily: "var(--font-display)", fontSize: 14 }}>{fmtINR(totalValue)}</strong> in pipeline · {leads.length} active leads
      </div>
      <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden", padding: "16px 24px 24px" }}>
        <div style={{ display: "flex", gap: 14, height: "100%", minWidth: "fit-content" }}>
          {visibleStages.map(s => (
            <KanColumn key={s.id} stage={s} leads={grouped[s.id]} value={stageValue(s.id)} density={density} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </>
  );
}

function KanColumn({ stage, leads, value, density, onOpen }) {
  const tones = { info: "var(--info)", neutral: "var(--neutral-600)", amber: "var(--dux-amber-600)",
    coral: "#B5462C", success: "var(--success)", error: "var(--error)" };
  return (
    <div style={{ width: 304, flexShrink: 0, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        padding: "12px 14px", borderRadius: "10px 10px 0 0",
        background: "var(--bg)", border: "1px solid var(--hairline)", borderBottom: "none",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: tones[stage.tone] }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>{stage.label}</div>
          <div style={{ fontSize: 10, color: "var(--neutral-400)", fontFamily: "var(--font-mono)" }}>{leads.length} leads · {fmtINR(value)}</div>
        </div>
        <button style={{ ...iconBtn, width: 24, height: 24, border: "none" }}><Icon name="plus" size={14} /></button>
      </div>
      <div style={{
        flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 10,
        background: "var(--bg)", border: "1px solid var(--hairline)", borderTop: "none", borderRadius: "0 0 10px 10px",
      }}>
        {leads.map(l => <KanCard key={l.id} lead={l} density={density} onClick={() => onOpen(l)} />)}
        {leads.length === 0 && <div style={{ fontSize: 12, color: "var(--neutral-400)", textAlign: "center", padding: 20 }}>Empty</div>}
      </div>
    </div>
  );
}

function KanCard({ lead, density, onClick }) {
  const isHot = lead.score >= 75;
  return (
    <div onClick={onClick} style={{
      padding: density === "compact" ? 10 : 14,
      background: "var(--bg)", border: "1px solid var(--hairline)",
      borderLeft: "3px solid " + (isHot ? "var(--dux-amber)" : "var(--hairline)"),
      borderRadius: 8, cursor: "pointer", transition: "all 200ms var(--ease-standard)",
      boxShadow: "var(--shadow-xs)",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-xs)"; e.currentTarget.style.transform = "none"; }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Avatar name={lead.name} initials={lead.initials} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, display: "flex", alignItems: "center", gap: 6 }}>
            {lead.name}
            {lead.starred && <Icon name="starF" size={10} style={{ color: "var(--dux-amber)" }} />}
          </div>
          <div style={{ fontSize: 10, color: "var(--neutral-400)", fontFamily: "var(--font-mono)" }}>{lead.id}</div>
        </div>
        <ScoreChip score={lead.score} />
      </div>
      <div style={{ fontSize: 12, color: "var(--neutral-800)", marginBottom: 6 }}>
        <strong>{lead.interest}</strong> at {lead.projectName}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--dux-navy)", marginBottom: 10 }}>
        {fmtINR(lead.budget)}
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingTop: 8, borderTop: "1px solid var(--hairline)", fontSize: 11, color: "var(--neutral-400)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Avatar name={lead.ownerName} initials={lead.ownerInitials} size={20} />
          <span>{lead.ownerName.split(" ")[0]}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lead.visitOn && <span style={{ color: "var(--dux-amber-600)", fontWeight: 600 }}>
            <Icon name="calendar" size={11} style={{ verticalAlign: "-1px" }} /> {fmtRelative(lead.visitOn)}
          </span>}
          <span>{fmtRelative(lead.lastActivity)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Shared helpers ----------
const selectStyle = {
  padding: "7px 12px", borderRadius: 999, border: "1px solid var(--hairline)",
  fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600,
  background: "var(--bg)", color: "var(--neutral-800)", cursor: "pointer", outline: "none",
  letterSpacing: "0.02em",
};

function Th({ children, w, sortable, sort, setSort, k }) {
  const active = sort?.key === k;
  return (
    <th style={{
      width: w, padding: "10px 14px", textAlign: "left", fontSize: 11,
      fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.06em",
      textTransform: "uppercase", color: "var(--neutral-400)", whiteSpace: "nowrap",
      cursor: sortable ? "pointer" : "default",
    }} onClick={() => sortable && setSort({ key: k, dir: active && sort.dir === "asc" ? "desc" : "asc" })}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {children}
        {sortable && active && <span style={{ color: "var(--dux-amber-600)" }}>{sort.dir === "asc" ? "↑" : "↓"}</span>}
      </span>
    </th>
  );
}
function Td({ children, onClick }) {
  return <td onClick={onClick} style={{ padding: "8px 14px", verticalAlign: "middle" }}>{children}</td>;
}
function Checkbox({ checked, onChange }) {
  return (
    <button onClick={onChange} style={{
      width: 16, height: 16, borderRadius: 4, cursor: "pointer",
      border: "1.5px solid " + (checked ? "var(--dux-navy)" : "var(--neutral-300)"),
      background: checked ? "var(--dux-navy)" : "transparent",
      color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0,
    }}>{checked && <Icon name="check" size={10} />}</button>
  );
}
