import React from "react";
/* Inventory — tower selector + floor/unit grid. Uses CRM_DATA.abhimanGrid + projects. */

window.PageInventory = function PageInventory() {
  const data = window.CRM_DATA;
  const [activeProject, setActiveProject] = React.useState((data.projects[0] && data.projects[0].id) || "P-AN");
  const [filter, setFilter] = React.useState("all");
  const [selectedUnit, setSelectedUnit] = React.useState(null);   // click-to-select detail panel
  const [holdModal, setHoldModal] = React.useState(null);          // {unit, kind} | null — request form
  const [showProjectModal, setShowProjectModal] = React.useState(false);
  const [showUnitsModal, setShowUnitsModal] = React.useState(false);
  const [projQuery, setProjQuery] = React.useState("");   // filter the project tabs

  // Esc closes the persistent detail panel
  React.useEffect(() => {
    if (!selectedUnit) return;
    const onKey = (e) => { if (e.key === "Escape") setSelectedUnit(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedUnit]);

  // Horizontally-scrollable project tabs: show ‹ › arrows only when overflowing.
  const tabScrollRef = React.useRef(null);
  const [tabOverflow, setTabOverflow] = React.useState(false);
  const allProjects = data.projects || [];
  const showProjSearch = allProjects.length > 6;
  const visibleProjects = React.useMemo(() => {
    const q = projQuery.trim().toLowerCase();
    if (!q) return allProjects;
    return allProjects.filter(p => `${p.name} ${p.code} ${p.locality || ""} ${p.city || ""}`.toLowerCase().includes(q));
  }, [allProjects, projQuery]);
  React.useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    const measure = () => setTabOverflow(el.scrollWidth > el.clientWidth + 4);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [visibleProjects.length]);
  const scrollTabs = (dir) => { const el = tabScrollRef.current; if (el) el.scrollBy({ left: dir * 280, behavior: "smooth" }); };

  const proj = data.projects.find(p => p.id === activeProject);

  // Live grid for whichever project is active (built from real units)
  const grids = data.grids || { "P-AN": data.abhimanGrid };
  const grid = (grids[activeProject] && Object.keys(grids[activeProject]).length) ? grids[activeProject] : null;

  const statusColors = {
    available: { bg: "var(--bg)",                border: "var(--success)",        fg: "var(--success)",       label: "Available" },
    blocked:   { bg: "var(--dux-amber-100)",     border: "var(--dux-amber-600)",  fg: "var(--dux-amber-600)", label: "Blocked" },
    reserved:  { bg: "var(--info-bg)",           border: "var(--info)",           fg: "var(--info)",          label: "Reserved" },
    sold:      { bg: "var(--neutral-100)",       border: "var(--neutral-400)",    fg: "var(--neutral-600)",   label: "Sold" },
  };

  // Flatten units for stats
  const allUnits = grid ? Object.entries(grid).flatMap(([tow, floors]) =>
    Object.values(floors).flat()
  ) : [];

  const statusCounts = { available: 0, blocked: 0, reserved: 0, sold: 0 };
  allUnits.forEach(u => { if (statusCounts[u.status] != null) statusCounts[u.status]++; });

  // Re-resolve the selected unit from the live grid each render so the panel never
  // shows a stale object after a refresh, and auto-closes if a filter hides it.
  const liveSelected = selectedUnit ? allUnits.find(u => u.id === selectedUnit.id) : null;

  const isManager = !!(data.currentUser && data.currentUser.isManager);
  const meName = (data.currentUser && data.currentUser.name) || "";
  // Pending requests for the active project (manager approvals view).
  const pendingForProject = (data.pendingHolds || []).filter(h => h.project === activeProject);

  // Direct status change (legacy Blocked/Reserved release, Mark sold, unwind sale).
  const applyStatus = async (unit, target, keepOpen) => {
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.set_unit_status", args: { unit_id: unit.id, status: target } });
      frappe.show_alert({ message: "Unit " + unit.id + " is now " + r.message.status, indicator: target === "Sold" ? "green" : target === "Available" ? "blue" : "orange" });
      if (!keepOpen) setSelectedUnit(null);
      if (window.__refreshCRM) await window.__refreshCRM();
    } catch (e) { frappe.msgprint(e.message || "Could not update unit"); }
  };
  // Hold workflow actions (request/approve/reject/release). Panel stays open and
  // re-resolves from the refreshed grid so the actor sees the new state.
  const holdCall = async (method, args, msg, indicator) => {
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm." + method, args });
      frappe.show_alert({ message: msg, indicator: indicator || "blue" });
      if (window.__refreshCRM) await window.__refreshCRM();
    } catch (e) { frappe.msgprint(e.message || "Action failed"); }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{
        padding: "0 12px 0 24px", display: "flex", alignItems: "center", gap: 6,
        borderBottom: "1px solid var(--hairline)", background: "var(--bg)",
      }}>
        {tabOverflow && (
          <button onClick={() => scrollTabs(-1)} title="Scroll left" style={{ ...iconBtn, width: 28, height: 28, border: "none", flexShrink: 0 }}><Icon name="arrowL" size={15} /></button>
        )}
        <div ref={tabScrollRef} className="dux-tabscroll" style={{ flex: 1, minWidth: 0, display: "flex", overflowX: "auto", scrollBehavior: "smooth" }}>
          {visibleProjects.map(p => {
            const active = p.id === activeProject;
            return (
              <button key={p.id} onClick={() => { setActiveProject(p.id); setSelectedUnit(null); }} style={{
                flexShrink: 0, whiteSpace: "nowrap",
                padding: "16px 18px", border: "none", background: "transparent",
                borderBottom: active ? "2px solid var(--dux-amber)" : "2px solid transparent",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? "var(--neutral-800)" : "var(--neutral-600)",
                fontFamily: "var(--font-display)",
              }}>
                <span style={{
                  fontSize: 9, padding: "2px 6px", borderRadius: 4, fontFamily: "var(--font-mono)",
                  background: active ? "var(--dux-amber-100)" : "var(--neutral-100)",
                  color: active ? "var(--dux-amber-600)" : "var(--neutral-600)",
                }}>{p.code}</span>
                {p.name}
                {p.locality && <span style={{ fontSize: 11, color: "var(--neutral-400)", fontWeight: 500 }}>· {p.locality}</span>}
              </button>
            );
          })}
          {visibleProjects.length === 0 && (
            <span style={{ padding: "16px 4px", fontSize: 13, color: "var(--neutral-400)" }}>No projects match “{projQuery}”.</span>
          )}
        </div>
        {tabOverflow && (
          <button onClick={() => scrollTabs(1)} title="Scroll right" style={{ ...iconBtn, width: 28, height: 28, border: "none", flexShrink: 0 }}><Icon name="arrowR" size={15} /></button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, paddingLeft: 8, borderLeft: "1px solid var(--hairline)", marginLeft: 4 }}>
          {showProjSearch && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--neutral-50)", border: "1px solid var(--hairline)", borderRadius: 8, padding: "6px 10px", width: 170 }}>
              <Icon name="search" size={14} style={{ color: "var(--neutral-400)" }} />
              <input value={projQuery} onChange={(e) => setProjQuery(e.target.value)} placeholder="Find project…"
                style={{ border: 0, outline: "none", background: "transparent", flex: 1, minWidth: 0, fontSize: 13, fontFamily: "var(--font-body)" }} />
              {projQuery && <button onClick={() => setProjQuery("")} title="Clear" style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--neutral-400)", display: "inline-flex" }}><Icon name="x" size={13} /></button>}
            </div>
          )}
          <Btn variant="outline" size="sm" icon="plus" onClick={() => setShowProjectModal(true)}>New project</Btn>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{
          background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 14, padding: 24, marginBottom: 20,
          display: "grid", gridTemplateColumns: "1.6fr repeat(6, 1fr)", gap: 18, alignItems: "center",
        }}>
          <div>
            <div className="dux-eyebrow" style={{ fontSize: 10 }}>{proj.code} · {proj.type}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, marginTop: 4 }}>{proj.name}</div>
            <div style={{ fontSize: 12, color: "var(--neutral-400)", marginTop: 2 }}>
              {proj.locality}, {proj.city} · {proj.typology} · {proj.towers} tower{proj.towers > 1 ? "s" : ""} · Possession {proj.possession}
            </div>
            <div style={{ marginTop: 12 }}>
              <Btn variant="accent" size="sm" icon="plus" onClick={() => setShowUnitsModal(true)}>Add units</Btn>
            </div>
          </div>
          <ProjStat label="TOTAL" value={proj.totalUnits} />
          <ProjStat label="AVAILABLE" value={proj.available} />
          <ProjStat label="BLOCKED" value={proj.blocked || 0} />
          <ProjStat label="RESERVED" value={proj.reserved || 0} />
          <ProjStat label="SOLD" value={proj.sold} accent />
          <ProjStat label="PRICE BAND" value={`${(proj.priceFrom / 10000000).toFixed(2)}–${(proj.priceTo / 10000000).toFixed(2)} Cr`} mono />
        </div>

        {/* Manager approvals — pending hold/reserve requests for this project */}
        {isManager && pendingForProject.length > 0 && (
          <div style={{ background: "var(--info-bg)", border: "1px solid var(--info)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div className="dux-eyebrow" style={{ fontSize: 10, color: "var(--info)", marginBottom: 10 }}>
              Pending approvals · {pendingForProject.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingForProject.map(h => (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 10 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, minWidth: 96 }}>{h.unit}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--neutral-100)", color: "var(--neutral-700)" }}>{(h.kind || "Hold").toUpperCase()}</span>
                  <LeadTag hold={h} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--neutral-600)" }}>
                    by <strong style={{ color: "var(--neutral-800)" }}>{h.requestedBy || "—"}</strong>{h.requestedByRole ? " · " + h.requestedByRole : ""}
                  </div>
                  <Btn variant="accent" size="sm" icon="check" onClick={() => holdCall("approve_hold", { hold_id: h.id }, h.unit + " approved", "green")}>Approve</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => holdCall("reject_hold", { hold_id: h.id }, "Request declined", "orange")}>Decline</Btn>
                </div>
              ))}
            </div>
          </div>
        )}

        {!grid && (
          <div style={{
            padding: 48, textAlign: "center", background: "var(--bg)",
            border: "1px dashed var(--hairline)", borderRadius: 12,
            color: "var(--neutral-400)",
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--neutral-600)", marginBottom: 6 }}>
              No inventory yet for {proj.name}
            </div>
            <div style={{ fontSize: 13, marginBottom: 18 }}>Add a tower's units to start building the tower / floor / unit map.</div>
            <Btn variant="accent" icon="plus" onClick={() => setShowUnitsModal(true)}>Add units</Btn>
          </div>
        )}

        {grid && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")} count={allUnits.length}>All</FilterChip>
              {Object.entries(statusColors).map(([k, s]) => (
                <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)} count={statusCounts[k] || 0}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: s.fg }} />
                    {s.label}
                  </span>
                </FilterChip>
              ))}
            </div>

            {Object.entries(grid).map(([tower, floors]) => {
              const sortedFloors = Object.keys(floors).map(Number).sort((a, b) => b - a);
              return (
                <div key={tower} style={{ marginBottom: 32 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>Tower {tower}</div>
                    <div style={{ fontSize: 12, color: "var(--neutral-400)" }}>{Object.values(floors).flat().length} units</div>
                  </div>
                  <div style={{
                    background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, padding: 16,
                    display: "flex", flexDirection: "column", gap: 6,
                  }}>
                    {sortedFloors.map(f => {
                      const units = (floors[f] || []).slice().sort((a, b) => (a.num || a.unit || "").localeCompare(b.num || b.unit || ""));
                      const visible = filter === "all" ? units : units.filter(u => u.status === filter);
                      if (filter !== "all" && visible.length === 0) return null;
                      return (
                        <div key={f} style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 12, alignItems: "center" }}>
                          <div style={{
                            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                            color: "var(--neutral-600)", textAlign: "right",
                          }}>
                            FL {f.toString().padStart(2, "0")}
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {visible.map(u => {
                              const sc = statusColors[u.status] || statusColors.available;
                              const isSel = liveSelected && liveSelected.id === u.id;
                              const uHolds = u.holds || [];
                              const hasPending = uHolds.some(h => h.status === "Requested");
                              return (
                                <div key={u.id}
                                     onClick={() => setSelectedUnit(prev => (prev && prev.id === u.id) ? null : u)}
                                     style={{
                                       width: 88, padding: "8px 10px",
                                       background: sc.bg,
                                       border: `1.5px solid ${sc.border}`, borderRadius: 6,
                                       cursor: "pointer", position: "relative",
                                       outline: hasPending ? "2px dashed var(--info)" : "none",
                                       outlineOffset: hasPending ? 1 : 0,
                                       boxShadow: isSel ? "0 0 0 2px var(--dux-amber)" : "none",
                                       transition: "box-shadow 150ms var(--ease-standard)",
                                     }}>
                                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: sc.fg }}>
                                    {u.tower}-{u.num}
                                  </div>
                                  <div style={{ fontSize: 10, color: "var(--neutral-600)", marginTop: 2 }}>{u.typology}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {liveSelected && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, width: 320,
          background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12,
          boxShadow: "var(--shadow-xl)", padding: 18, zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>
                Tower {liveSelected.tower} · {liveSelected.num}
              </div>
              <div style={{ fontSize: 12, color: "var(--neutral-400)" }}>{liveSelected.typology} · {liveSelected.facing} facing</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
                background: (statusColors[liveSelected.status] || statusColors.available).bg,
                color: (statusColors[liveSelected.status] || statusColors.available).fg,
                border: `1px solid ${(statusColors[liveSelected.status] || statusColors.available).border}`,
              }}>{(statusColors[liveSelected.status] || statusColors.available).label.toUpperCase()}</span>
              <button onClick={() => setSelectedUnit(null)} aria-label="Close" title="Close"
                style={{ ...iconBtn, width: 26, height: 26 }}><Icon name="x" size={14} /></button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12, marginBottom: 14 }}>
            <KV label="Carpet" value={liveSelected.carpet + " sqft"} />
            <KV label="Price" value={fmtINR(liveSelected.price)} />
            <KV label="Rate/sqft" value={"₹ " + Math.round(liveSelected.price / liveSelected.carpet).toLocaleString("en-IN")} />
            <KV label="All-in" value={fmtINR(Math.round(liveSelected.price * 1.08))} />
          </div>
          {(() => {
            const holds = liveSelected.holds || [];
            const approved = holds.find(h => h.status === "Approved");
            const pending = holds.find(h => h.status === "Requested");
            const btn = { flex: "1 1 auto", justifyContent: "center" };
            const canApproveApproved = approved && (isManager || meName === approved.requestedBy);

            if (approved) {
              return (
                <>
                  <HolderBlock hold={approved} />
                  {pending && (
                    <div style={{ marginTop: 10, padding: 10, border: "1px dashed var(--info)", borderRadius: 8, background: "var(--info-bg)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--info)", marginBottom: 4 }}>HAND-OVER REQUESTED</div>
                      <RequesterRow hold={pending} />
                      <LeadTag hold={pending} />
                      {(isManager || meName === approved.requestedBy) && (
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <Btn variant="accent" size="sm" style={btn} onClick={() => holdCall("approve_hold", { hold_id: pending.id }, "Handed over", "green")}>Approve hand-over</Btn>
                          <Btn variant="ghost" size="sm" onClick={() => holdCall("reject_hold", { hold_id: pending.id }, "Declined", "orange")}>Decline</Btn>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {canApproveApproved && <Btn variant="accent" size="sm" style={btn} onClick={() => holdCall("release_hold", { hold_id: approved.id }, "Released " + liveSelected.id, "blue")}>Release</Btn>}
                    {isManager && <Btn variant="primary" size="sm" style={btn} onClick={() => applyStatus(liveSelected, "Sold", true)}>Mark sold</Btn>}
                    {!pending && <Btn variant="outline" size="sm" style={btn} onClick={() => setHoldModal({ unit: liveSelected, kind: approved.kind || "Hold" })}>Request hand-over</Btn>}
                  </div>
                </>
              );
            }

            if (pending) {
              return (
                <>
                  <div style={{ padding: 10, border: "1px dashed var(--info)", borderRadius: 8, background: "var(--info-bg)", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--info)", letterSpacing: "0.04em" }}>{(pending.kind || "Hold").toUpperCase()} REQUESTED · PENDING</div>
                    <RequesterRow hold={pending} />
                    <LeadTag hold={pending} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    {isManager && <Btn variant="accent" size="sm" style={btn} onClick={() => holdCall("approve_hold", { hold_id: pending.id }, "Approved " + liveSelected.id, "green")}>Approve</Btn>}
                    {(isManager || meName === pending.requestedBy) && <Btn variant="ghost" size="sm" onClick={() => holdCall("reject_hold", { hold_id: pending.id }, meName === pending.requestedBy && !isManager ? "Request cancelled" : "Declined", "orange")}>{meName === pending.requestedBy && !isManager ? "Cancel request" : "Decline"}</Btn>}
                    {!isManager && meName !== pending.requestedBy && <span style={{ fontSize: 12, color: "var(--neutral-500)" }}>Awaiting manager approval.</span>}
                  </div>
                </>
              );
            }

            // no active hold
            if (liveSelected.status === "sold") {
              return (
                <div style={{ display: "flex", gap: 8 }}>
                  {isManager
                    ? <Btn variant="outline" size="sm" style={btn} onClick={() => applyStatus(liveSelected, "Available")}>Release sale</Btn>
                    : <span style={{ fontSize: 12, color: "var(--neutral-500)" }}>This unit is sold.</span>}
                </div>
              );
            }
            const legacyHeld = liveSelected.status === "blocked" || liveSelected.status === "reserved";
            return (
              <>
                {legacyHeld && (
                  <div style={{ fontSize: 12, color: "var(--neutral-500)", marginBottom: 10 }}>
                    {liveSelected.status[0].toUpperCase() + liveSelected.status.slice(1)} with no request on file — release it, or request it to record who it’s for.
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Btn variant="accent" size="sm" style={btn} onClick={() => setHoldModal({ unit: liveSelected, kind: "Hold" })}>Request hold</Btn>
                  <Btn variant="outline" size="sm" style={btn} onClick={() => setHoldModal({ unit: liveSelected, kind: "Reserve" })}>Request reserve</Btn>
                  {legacyHeld && isManager && <Btn variant="ghost" size="sm" onClick={() => applyStatus(liveSelected, "Available")}>Release</Btn>}
                  {isManager && <Btn variant="primary" size="sm" onClick={() => applyStatus(liveSelected, "Sold", true)}>Mark sold</Btn>}
                </div>
              </>
            );
          })()}
        </div>
      )}

      <CreateProjectModal open={showProjectModal} onClose={() => setShowProjectModal(false)}
        onSaved={async (r) => { if (window.__refreshCRM) await window.__refreshCRM(); if (r && r.id) setActiveProject(r.id); }} />
      <AddUnitsModal open={showUnitsModal} onClose={() => setShowUnitsModal(false)} project={activeProject}
        onSaved={async () => { if (window.__refreshCRM) await window.__refreshCRM(); }} />
      <HoldRequestModal open={!!holdModal} onClose={() => setHoldModal(null)}
        unit={holdModal && holdModal.unit} initialKind={holdModal && holdModal.kind}
        onSaved={async () => { if (window.__refreshCRM) await window.__refreshCRM(); }} />
    </div>
  );
};

// ---------- hold attribution sub-components ----------
function LeadTag({ hold }) {
  const outside = hold.isOutside;
  const who = outside ? (hold.contactName || "—") : (hold.leadName || hold.lead || "—");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6 }}>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 6px", borderRadius: 4,
        background: outside ? "var(--neutral-100)" : "var(--info-bg)",
        color: outside ? "var(--neutral-600)" : "var(--info)",
        border: "1px solid " + (outside ? "var(--hairline)" : "var(--info)"),
      }}>{outside ? "OUTSIDE" : "LEAD"}</span>
      <span style={{ fontSize: 12, color: "var(--neutral-800)", fontWeight: 600 }}>
        {who}{outside && hold.contactPhone ? " · " + hold.contactPhone : ""}
      </span>
    </span>
  );
}

function RequesterRow({ hold }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
      <Avatar name={hold.requestedBy} initials={hold.requestedByInitials} size={24} />
      <div style={{ fontSize: 12, minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>{hold.requestedBy || "—"}</span>
        <span style={{ color: "var(--neutral-400)" }}>{hold.requestedByRole ? " · " + hold.requestedByRole : ""}{hold.requestedByPhone ? " · " + hold.requestedByPhone : ""}</span>
      </div>
    </div>
  );
}

function HolderBlock({ hold }) {
  return (
    <div style={{ padding: 12, border: "1px solid var(--hairline)", borderRadius: 10, background: "var(--neutral-50)" }}>
      <div className="dux-eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>{hold.kind === "Reserve" ? "Reserved by" : "Held by"}</div>
      <RequesterRow hold={hold} />
      <LeadTag hold={hold} />
      {hold.note && <div style={{ fontSize: 12, color: "var(--neutral-600)", marginTop: 6 }}>{hold.note}</div>}
      {(hold.approvedBy || hold.requestedOn) && (
        <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 6 }}>
          {hold.approvedBy ? "Approved by " + hold.approvedBy : ""}{hold.requestedOn ? (hold.approvedBy ? " · " : "Requested ") + hold.requestedOn : ""}
        </div>
      )}
    </div>
  );
}

function ProjStat({ label, value, accent, mono }) {
  return (
    <div>
      <div className="dux-eyebrow" style={{ fontSize: 9 }}>{label}</div>
      <div style={{
        fontFamily: mono ? "var(--font-mono)" : "var(--font-display)",
        fontSize: mono ? 16 : 22, fontWeight: 700, marginTop: 4,
        color: accent ? "var(--dux-amber-600)" : "var(--neutral-800)",
      }}>{value}</div>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <div className="dux-eyebrow" style={{ fontSize: 9 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}
