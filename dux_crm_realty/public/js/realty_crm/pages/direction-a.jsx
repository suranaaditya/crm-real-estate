import React from "react";
/* Workspace — unified leads view with Table ↔ Kanban toggle.
   Combines former Direction A (table-led) and Direction B (kanban). */

const { useState: aUseState, useMemo: aUseMemo } = React;

window.DirectionA = function Workspace({ density = "comfortable", defaultView = "table", onNav, active = "leads" }) {
  const data = window.CRM_DATA;
  const [view, setView] = aUseState(defaultView);
  const [stage, setStage] = aUseState("all");
  const [project, setProject] = aUseState("all");
  const [ownerF, setOwnerF] = aUseState("all");
  const [sourceF, setSourceF] = aUseState("all");
  const [query, setQuery] = aUseState("");
  const [qf, setQf] = aUseState({ hot: false, starred: false, visit: false, unassigned: false });
  const [showFilters, setShowFilters] = aUseState(false);
  const [openLead, setOpenLead] = aUseState(null);
  const [sort, setSort] = aUseState({ key: "lastActivity", dir: "desc" });
  const [selected, setSelected] = aUseState(new Set());

  const toggleQf = (k) => setQf(p => ({ ...p, [k]: !p[k] }));
  const isKanban = view === "kanban";

  const baseFiltered = aUseMemo(() => {
    const q = query.trim().toLowerCase();
    return data.leads.filter(l => {
      if (project !== "all" && l.project !== project) return false;
      if (ownerF !== "all" && (l.ownerName || "Unassigned") !== ownerF) return false;
      if (sourceF !== "all" && l.source !== sourceF) return false;
      if (qf.hot && !(l.score >= 75)) return false;
      if (qf.starred && !l.starred) return false;
      if (qf.visit && !l.visitOn) return false;
      if (qf.unassigned && l.ownerName) return false;
      if (q && !`${l.name} ${l.id} ${l.phone} ${l.email || ""} ${l.projectName || ""} ${l.interest || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [project, ownerF, sourceF, qf, query, data]);

  const leads = aUseMemo(() => {
    let l = baseFiltered.slice();
    if (stage !== "all") l = l.filter(x => x.stage === stage);
    l.sort((a, b) => {
      const av = a[sort.key] == null ? "" : a[sort.key], bv = b[sort.key] == null ? "" : b[sort.key];
      // must return 0 on ties: the old `av > bv ? 1 : -1` reported -1 for BOTH (a,b) and
      // (b,a), which breaks the comparator contract and shuffles equal rows (e.g. the ~700
      // leads whose visitOn is null) unpredictably between renders.
      if (av === bv) return 0;
      return sort.dir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return l;
  }, [baseFiltered, stage, sort]);

  const counts = aUseMemo(() => {
    const c = { all: baseFiltered.length };
    data.stages.forEach(s => c[s.id] = baseFiltered.filter(l => l.stage === s.id).length);
    return c;
  }, [baseFiltered, data]);

  const kpi = aUseMemo(() => {
    const all = data.leads, closed = ["booked", "lost"];
    const today = new Date((data.today || "2026-04-29") + "T00:00:00");
    const visitsWeek = (data.visits || []).filter(v => { const d = new Date(v.date + "T00:00:00"); const diff = (d - today) / 86400000; return diff >= -3 && diff <= 7; }).length;
    const booked = all.filter(l => l.stage === "booked").length;
    return {
      open: all.filter(l => !closed.includes(l.stage)).length,
      hot: all.filter(l => l.score >= 75 && !closed.includes(l.stage)).length,
      visitsWeek, bookings: (data.bookings || []).length,
      bookingsVal: (data.bookings || []).reduce((a, b) => a + (b.bsp || 0), 0),
      conv: all.length ? ((booked / all.length) * 100).toFixed(1) + "%" : "0%",
    };
  }, [data]);

  const rowH = density === "compact" ? 44 : 56;
  const refresh = () => { if (window.__refreshCRM) window.__refreshCRM(); };

  return (
    <div style={{ display: "flex", height: "100%", background: isKanban ? "var(--neutral-50)" : "var(--bg)", position: "relative", overflow: "hidden" }}>
      <Sidebar active={active} onNav={onNav} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Leads" subtitle={isKanban ? "PIPELINE · KANBAN" : "SALES PIPELINE · TABLE"}
          search={query} onSearch={setQuery} searchPlaceholder="Search name, phone, project…">
          <ViewToggle view={view} setView={setView} />
          <Btn variant={showFilters ? "primary" : "outline"} icon="filter" size="sm" onClick={() => setShowFilters(v => !v)}>Filters</Btn>
          <Btn variant="accent" icon="plus" size="sm" onClick={() => window.__openNewLead && window.__openNewLead()}>New Lead</Btn>
        </Topbar>

        {/* KPI strip (computed) */}
        <div style={{ padding: "20px 24px 0", display: "flex", gap: 14 }}>
          <StatCard label="OPEN LEADS" value={kpi.open} delta={data.leads.length + " total"} icon="users" />
          <StatCard label="VISITS THIS WEEK" value={kpi.visitsWeek} icon="calendar" />
          <StatCard label="HOT (SCORE 75+)" value={kpi.hot} icon="flame" />
          <StatCard label="BOOKINGS" value={kpi.bookings} delta={fmtINR(kpi.bookingsVal)} icon="rupee" />
          <StatCard label="CONVERSION" value={kpi.conv} icon="chart" />
        </div>

        {/* Quick filters (toggled by Filters button) */}
        {showFilters && (
          <div style={{ padding: "16px 24px 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--neutral-400)", fontFamily: "var(--font-display)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Quick filters</span>
            <FilterChip active={qf.hot} onClick={() => toggleQf("hot")}>🔥 Hot 75+</FilterChip>
            <FilterChip active={qf.starred} onClick={() => toggleQf("starred")}>★ Starred</FilterChip>
            <FilterChip active={qf.visit} onClick={() => toggleQf("visit")}>Visit scheduled</FilterChip>
            <FilterChip active={qf.unassigned} onClick={() => toggleQf("unassigned")}>Unassigned</FilterChip>
            {(qf.hot || qf.starred || qf.visit || qf.unassigned) &&
              <button onClick={() => setQf({ hot: false, starred: false, visit: false, unassigned: false })} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--dux-amber-600)", fontWeight: 600 }}>Clear</button>}
          </div>
        )}

        {/* Stage chips + dropdown filters */}
        <div style={{ padding: "16px 24px 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {!isKanban && <FilterChip active={stage === "all"} onClick={() => setStage("all")} count={counts.all}>All</FilterChip>}
          {!isKanban && data.stages.map(s => (
            <FilterChip key={s.id} active={stage === s.id} onClick={() => setStage(s.id)} count={counts[s.id]}>{s.label}</FilterChip>
          ))}
          {isKanban && <>
            <FilterChip active={qf.hot} onClick={() => toggleQf("hot")}>Hot only</FilterChip>
            <FilterChip active={qf.visit} onClick={() => toggleQf("visit")}>Visit due</FilterChip>
            <FilterChip active={qf.unassigned} onClick={() => toggleQf("unassigned")}>Unassigned</FilterChip>
          </>}
          <div style={{ flex: 1 }} />
          <select value={project} onChange={(e) => setProject(e.target.value)} style={selectStyle}>
            <option value="all">All projects</option>
            {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={ownerF} onChange={(e) => setOwnerF(e.target.value)} style={selectStyle}>
            <option value="all">All owners</option>
            <option value="Unassigned">Unassigned</option>
            {data.owners.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
          </select>
          <select value={sourceF} onChange={(e) => setSourceF(e.target.value)} style={selectStyle}>
            <option value="all">All sources</option>
            {data.sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {isKanban
          ? <KanbanView data={data} leads={baseFiltered} density={density} onOpen={setOpenLead} onNew={() => window.__openNewLead && window.__openNewLead()} />
          : <TableView leads={leads} totalCount={data.leads.length} density={density} rowH={rowH}
              owners={data.owners} refresh={refresh}
              selected={selected} setSelected={setSelected} sort={sort} setSort={setSort} onOpen={setOpenLead} />
        }
      </div>
      {openLead && <LeadDetail key={openLead.id} lead={openLead} onClose={() => setOpenLead(null)} />}
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
function TableView({ leads, totalCount, density, rowH, selected, setSelected, sort, setSort, onOpen, owners, refresh }) {
  const [reassignOpen, setReassignOpen] = React.useState(false);
  const [bulkOwner, setBulkOwner] = React.useState("");
  const [menuFor, setMenuFor] = React.useState(null); // lead id whose row menu is open

  const exportCsv = () => {
    const cols = ["id", "name", "phone", "email", "stage", "score", "projectName", "interest", "budget", "source", "ownerName", "enteredBy", "lastActivity", "visitOn"];
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const rows = [cols.join(",")].concat(leads.map(l => cols.map(c => esc(l[c])).join(",")));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "leads.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    frappe.show_alert({ message: leads.length + " leads exported", indicator: "green" });
  };

  const applyReassign = async () => {
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm.bulk_reassign", args: { leads: JSON.stringify([...selected]), owner: bulkOwner } });
      frappe.show_alert({ message: selected.size + " leads " + (bulkOwner ? "assigned to " + esc(bulkOwner) : "unassigned"), indicator: "green" });
      setReassignOpen(false); setSelected(new Set());
      if (refresh) await refresh();
    } catch (e) { frappe.msgprint(e.message || "Could not reassign"); }
  };

  const rowAction = async (l, action) => {
    setMenuFor(null);
    if (action === "open") return onOpen(l);
    try {
      if (action === "lost") await frappe.call({ method: "dux_crm_realty.api.crm.update_lead_stage", args: { lead: l.id, stage: "lost" } });
      if (action === "booked") await frappe.call({ method: "dux_crm_realty.api.crm.update_lead_stage", args: { lead: l.id, stage: "booked" } });
      frappe.show_alert({ message: esc(l.name) + " → " + esc(action), indicator: "blue" });
      if (refresh) await refresh();
    } catch (e) { frappe.msgprint(e.message || "Action failed"); }
  };

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
              <Btn variant="soft" size="sm" icon="users" onClick={() => { setBulkOwner(""); setReassignOpen(true); }}>Reassign</Btn>
              <Btn variant="soft" size="sm" icon="mail" onClick={() => frappe.show_alert("Bulk SMS/WhatsApp uses a messaging gateway — a production-build step.")}>Bulk message</Btn>
            </>}
            <Btn variant="ghost" size="sm" icon="download" onClick={exportCsv}>Export</Btn>
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
                    {l.ownerName ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar name={l.ownerName} initials={l.ownerInitials} size={24} />
                        <span style={{ fontSize: 12 }}>{l.ownerName.split(" ")[0]}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--neutral-400)", fontStyle: "italic" }}>Unassigned</span>
                    )}
                  </Td>
                  <Td><span style={{ fontSize: 12, color: "var(--neutral-600)" }}>{fmtRelative(l.lastActivity)}</span></Td>
                  <Td>{l.visitOn ? <span style={{ fontSize: 12, color: "var(--dux-amber-600)", fontWeight: 600 }}>{fmtRelative(l.visitOn)}</span> : <span style={{ color: "var(--neutral-300)" }}>—</span>}</Td>
                  <Td><span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>{fmtINR(l.budget)}</span></Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setMenuFor(menuFor === l.id ? null : l.id)} style={{ ...iconBtn, width: 28, height: 28, border: "none" }}><Icon name="dots" size={16} /></button>
                      {menuFor === l.id && (
                        <>
                          <div onClick={() => setMenuFor(null)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                          <div style={{ position: "absolute", right: 0, top: 30, zIndex: 41, minWidth: 168, background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 10, boxShadow: "var(--shadow-lg)", overflow: "hidden", padding: 4 }}>
                            {[["open", "Open lead", "arrowR"], ["booked", "Mark as booked", "check"], ["lost", "Mark as lost", "x"]].map(([a, label, ic]) => (
                              <button key={a} onClick={() => rowAction(l, a)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", border: 0, background: "transparent", cursor: "pointer", fontSize: 13, color: a === "lost" ? "var(--error)" : "var(--neutral-800)", borderRadius: 7, textAlign: "left" }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "var(--neutral-50)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                <Icon name={ic} size={14} />{label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {window.Modal && <Modal open={reassignOpen} onClose={() => setReassignOpen(false)}
        eyebrow="BULK ASSIGN" title={"Assign " + selected.size + " lead" + (selected.size === 1 ? "" : "s")}
        subtitle="Assign the selected leads to a sales owner." width={520}
        footer={<>
          <Btn variant="ghost" size="sm" onClick={() => setReassignOpen(false)}>Cancel</Btn>
          <Btn variant="accent" size="sm" icon="users" onClick={applyReassign}>Assign</Btn>
        </>}>
        <Field label="Assign to">
          <Select value={bulkOwner} onChange={(e) => setBulkOwner(e.target.value)}>
            <option value="">Unassigned</option>
            {(owners || []).map(o => <option key={o.id} value={o.name}>{o.name} · {o.role}</option>)}
          </Select>
        </Field>
      </Modal>}
    </div>
  );
}

// ---------- Kanban view ----------
function KanbanView({ data, leads, density, onOpen, onNew }) {
  const visibleStages = data.stages.filter(s => s.id !== "lost");
  const grouped = {};
  visibleStages.forEach(s => grouped[s.id] = []);
  leads.forEach(l => { if (grouped[l.stage]) grouped[l.stage].push(l); });
  Object.keys(grouped).forEach(k => grouped[k].sort((a, b) => b.score - a.score));
  const stageValue = (id) => grouped[id].reduce((a, l) => a + (l.budget || 0), 0);
  const totalValue = visibleStages.reduce((a, s) => a + stageValue(s.id), 0);
  // count the cards actually rendered — `leads` still includes the `lost` stage, which has
  // no column, so the header claimed 875 active while 740 cards were on screen
  const shownCount = visibleStages.reduce((a, s) => a + grouped[s.id].length, 0);

  return (
    <>
      <div style={{ padding: "12px 24px 0", fontSize: 12, color: "var(--neutral-600)" }}>
        <strong style={{ color: "var(--neutral-900)", fontFamily: "var(--font-display)", fontSize: 14 }}>{fmtINR(totalValue)}</strong> in pipeline · {shownCount} active leads
      </div>
      <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden", padding: "16px 24px 24px" }}>
        <div style={{ display: "flex", gap: 14, height: "100%", minWidth: "fit-content" }}>
          {visibleStages.map(s => (
            <KanColumn key={s.id} stage={s} leads={grouped[s.id]} value={stageValue(s.id)} density={density} onOpen={onOpen} onNew={onNew} />
          ))}
        </div>
      </div>
    </>
  );
}

function KanColumn({ stage, leads, value, density, onOpen, onNew }) {
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
        <button title="New lead" onClick={() => onNew && onNew()} style={{ ...iconBtn, width: 24, height: 24, border: "none" }}><Icon name="plus" size={14} /></button>
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
          {lead.ownerName
            ? <><Avatar name={lead.ownerName} initials={lead.ownerInitials} size={20} /><span>{lead.ownerName.split(" ")[0]}</span></>
            : <span style={{ fontStyle: "italic" }}>Unassigned</span>}
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
