/* Inventory — tower selector + floor/unit grid. Uses CRM_DATA.abhimanGrid + projects. */

window.PageInventory = function PageInventory() {
  const data = window.CRM_DATA;
  const [activeProject, setActiveProject] = React.useState("P-AN");
  const [filter, setFilter] = React.useState("all");
  const [hoverUnit, setHoverUnit] = React.useState(null);

  const proj = data.projects.find(p => p.id === activeProject);

  // Only Abhiman Niwas has the full grid; for other projects, show a message
  const grid = activeProject === "P-AN" ? data.abhimanGrid : null;

  const statusColors = {
    available: { bg: "var(--bg)",                border: "var(--success)",        fg: "var(--success)",       label: "Available" },
    blocked:   { bg: "var(--dux-amber-100)",     border: "var(--dux-amber-600)",  fg: "var(--dux-amber-600)", label: "Blocked" },
    sold:      { bg: "var(--neutral-100)",       border: "var(--neutral-400)",    fg: "var(--neutral-600)",   label: "Sold" },
  };

  // Flatten units for stats
  const allUnits = grid ? Object.entries(grid).flatMap(([tow, floors]) =>
    Object.values(floors).flat()
  ) : [];

  const statusCounts = { available: 0, blocked: 0, sold: 0 };
  allUnits.forEach(u => { if (statusCounts[u.status] != null) statusCounts[u.status]++; });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{
        padding: "0 24px", display: "flex", gap: 0,
        borderBottom: "1px solid var(--hairline)", background: "var(--bg)",
      }}>
        {data.projects.map(p => {
          const active = p.id === activeProject;
          return (
            <button key={p.id} onClick={() => setActiveProject(p.id)} style={{
              padding: "16px 20px", border: "none", background: "transparent",
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
              <span style={{ fontSize: 11, color: "var(--neutral-400)", fontWeight: 500 }}>· {p.locality}</span>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{
          background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 14, padding: 24, marginBottom: 20,
          display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", gap: 24, alignItems: "center",
        }}>
          <div>
            <div className="dux-eyebrow" style={{ fontSize: 10 }}>{proj.code} · {proj.type}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, marginTop: 4 }}>{proj.name}</div>
            <div style={{ fontSize: 12, color: "var(--neutral-400)", marginTop: 2 }}>
              {proj.locality}, {proj.city} · {proj.typology} · {proj.towers} tower{proj.towers > 1 ? "s" : ""} · Possession {proj.possession}
            </div>
          </div>
          <ProjStat label="TOTAL UNITS" value={proj.totalUnits} />
          <ProjStat label="SOLD" value={proj.sold} accent />
          <ProjStat label="AVAILABLE" value={proj.available} />
          <ProjStat label="PRICE BAND" value={`${(proj.priceFrom / 10000000).toFixed(2)}–${(proj.priceTo / 10000000).toFixed(2)} Cr`} mono />
        </div>

        {!grid && (
          <div style={{
            padding: 48, textAlign: "center", background: "var(--bg)",
            border: "1px dashed var(--hairline)", borderRadius: 12,
            color: "var(--neutral-400)",
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--neutral-600)", marginBottom: 6 }}>
              Detailed inventory grid for {proj.name} loading
            </div>
            <div style={{ fontSize: 13 }}>Tower / floor / unit map will be available once construction phase data is synced from RERA.</div>
            <div style={{ marginTop: 16, fontSize: 12 }}>
              Summary: {proj.sold} sold · {proj.available} available · {proj.blocked} blocked
            </div>
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
                              return (
                                <div key={u.id}
                                     onMouseEnter={() => setHoverUnit(u)}
                                     onMouseLeave={() => setHoverUnit(null)}
                                     style={{
                                       width: 88, padding: "8px 10px",
                                       background: sc.bg,
                                       border: `1.5px solid ${sc.border}`, borderRadius: 6,
                                       cursor: "pointer", position: "relative",
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

      {hoverUnit && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, width: 320,
          background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12,
          boxShadow: "var(--shadow-md)", padding: 18, zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>
                Tower {hoverUnit.tower} · {hoverUnit.num}
              </div>
              <div style={{ fontSize: 12, color: "var(--neutral-400)" }}>{hoverUnit.typology} · {hoverUnit.facing} facing</div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
              background: (statusColors[hoverUnit.status] || statusColors.available).bg,
              color: (statusColors[hoverUnit.status] || statusColors.available).fg,
              border: `1px solid ${(statusColors[hoverUnit.status] || statusColors.available).border}`,
            }}>{(statusColors[hoverUnit.status] || statusColors.available).label.toUpperCase()}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12, marginBottom: 12 }}>
            <KV label="Carpet" value={hoverUnit.carpet + " sqft"} />
            <KV label="Price" value={fmtINR(hoverUnit.price)} />
            <KV label="Rate/sqft" value={"₹ " + Math.round(hoverUnit.price / hoverUnit.carpet).toLocaleString("en-IN")} />
            <KV label="All-in" value={fmtINR(Math.round(hoverUnit.price * 1.08))} />
          </div>
          <Btn variant="primary" size="sm" style={{ width: "100%" }}>
            {hoverUnit.status === "available" ? "Block / Hold unit" : "View details"}
          </Btn>
        </div>
      )}
    </div>
  );
};

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
