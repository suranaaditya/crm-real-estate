/* Mobile companion — bottom-tab nav, lead-list and lead-detail screens.
   Designed for sales executives in the field. */

const { useState: mUseState } = React;

window.MobileApp = function MobileApp() {
  const [view, setView] = mUseState("list"); // list | detail
  const [lead, setLead] = mUseState(null);
  const data = window.CRM_DATA;

  return (
    <div style={{
      width: 390, height: 844, background: "var(--neutral-50)",
      borderRadius: 44, border: "10px solid #1A1A1A", boxShadow: "var(--shadow-xl)",
      position: "relative", overflow: "hidden", display: "flex", flexDirection: "column",
      fontFamily: "var(--font-body)",
    }}>
      {/* Status bar */}
      <div style={{
        height: 44, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)", flexShrink: 0,
        background: view === "detail" ? "var(--dux-navy)" : "var(--bg)",
        color: view === "detail" ? "white" : "var(--dux-black)",
      }}>
        <span>9:41</span>
        <div style={{ width: 100, height: 24 }} />
        <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontSize: 11 }}>●●●●●</span>
          <span>100%</span>
        </span>
      </div>

      {view === "list" && <MobileList data={data} onOpen={(l) => { setLead(l); setView("detail"); }} />}
      {view === "detail" && <MobileDetail lead={lead} onBack={() => setView("list")} />}

      {/* Bottom tabs */}
      <div style={{
        flexShrink: 0, padding: "8px 12px 24px", background: "var(--bg)",
        borderTop: "1px solid var(--hairline)",
        display: "flex", justifyContent: "space-around",
      }}>
        {[
          { id: "home", icon: "home", label: "Home" },
          { id: "leads", icon: "users", label: "Leads", active: true },
          { id: "visit", icon: "calendar", label: "Visits" },
          { id: "more", icon: "dots", label: "More" },
        ].map(t => (
          <button key={t.id} style={{
            background: "transparent", border: 0, cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "8px 12px", color: t.active ? "var(--dux-amber-600)" : "var(--neutral-400)",
          }}>
            <Icon name={t.icon} size={20} />
            <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-display)" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

function MobileList({ data, onOpen }) {
  const leads = data.leads.slice(0, 10);
  return (
    <>
      <div style={{ padding: "8px 20px 16px", background: "var(--bg)", flexShrink: 0 }}>
        <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 4 }}>SHRADHA CRM</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em" }}>Hi, Priya</div>
        <div style={{ fontSize: 13, color: "var(--neutral-400)", marginTop: 2 }}>You have 4 site visits today</div>
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, padding: "10px 14px", borderRadius: 999, background: "var(--neutral-50)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Icon name="search" size={14} style={{ color: "var(--neutral-400)" }} />
            <span style={{ fontSize: 13, color: "var(--neutral-400)" }}>Search leads, units…</span>
          </div>
          <button style={{ ...iconBtn, width: 40, height: 40, borderRadius: 999, background: "var(--dux-amber)", border: "none", color: "var(--dux-black)" }}>
            <Icon name="plus" size={18} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
        <div style={{ display: "flex", gap: 8, padding: "12px 4px", overflowX: "auto" }}>
          <FilterChip active>All · {leads.length}</FilterChip>
          <FilterChip>New</FilterChip>
          <FilterChip>Site Visit</FilterChip>
          <FilterChip>Hot</FilterChip>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {leads.map(l => (
            <div key={l.id} onClick={() => onOpen(l)} style={{
              background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12,
              padding: 14, display: "flex", gap: 12, alignItems: "center", cursor: "pointer",
            }}>
              <Avatar name={l.name} initials={l.initials} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{l.name}</div>
                  {l.starred && <Icon name="starF" size={11} style={{ color: "var(--dux-amber)" }} />}
                </div>
                <div style={{ fontSize: 11, color: "var(--neutral-400)" }}>{l.interest} · {fmtINR(l.budget)} · {l.projectName}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <StageBadge stage={l.stage} />
                  {l.visitOn && <span style={{ fontSize: 10, color: "var(--dux-amber-600)", fontWeight: 600 }}>
                    <Icon name="calendar" size={10} style={{ verticalAlign: "-1px" }} /> {fmtRelative(l.visitOn)}
                  </span>}
                </div>
              </div>
              <ScoreChip score={l.score} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function MobileDetail({ lead, onBack }) {
  if (!lead) return null;
  const data = window.CRM_DATA;
  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
      <div style={{ background: "var(--dux-navy)", color: "white", padding: "8px 16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.1)", border: 0, color: "white",
            width: 36, height: 36, borderRadius: 999, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="arrowL" size={16} />
          </button>
          <div style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-mono)" }}>{lead.id}</div>
          <button style={{ background: "rgba(255,255,255,0.1)", border: 0, color: "white",
            width: 36, height: 36, borderRadius: 999, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="dots" size={16} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={lead.name} initials={lead.initials} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>{lead.name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{lead.occupation} · {lead.city}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <StageBadge stage={lead.stage} size="lg" />
          <ScoreChip score={lead.score} />
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", gap: 8 }}>
        <ActionBtn icon="phone" label="Call" />
        <ActionBtn icon="whatsapp" label="WhatsApp" tone="amber" />
        <ActionBtn icon="calendar" label="Visit" />
        <ActionBtn icon="note" label="Note" />
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>NEXT TASK</div>
        <div style={{
          padding: 14, background: "var(--dux-amber-100)", border: "1px solid rgba(242,169,59,0.3)",
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Site visit — Tower B, Unit 705</div>
          <div style={{ fontSize: 12, color: "var(--dux-amber-600)", fontWeight: 600, marginTop: 4 }}>
            <Icon name="calendar" size={12} style={{ verticalAlign: "-1px" }} /> Tomorrow, 11:00 AM · Abhiman Niwas
          </div>
        </div>
      </div>

      <div style={{ padding: "0 16px 24px" }}>
        <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>RECENT ACTIVITY</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.activity.slice(-3).reverse().map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: "var(--neutral-50)",
                border: "1px solid var(--hairline)", flexShrink: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--dux-amber-600)",
              }}><Icon name={a.type === "call" ? "phone" : a.type === "email" ? "mail" : "note"} size={14} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{a.text}</div>
                <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{a.who} · {a.at}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, tone }) {
  const isAmber = tone === "amber";
  return (
    <button style={{
      flex: 1, padding: "12px 8px", borderRadius: 12,
      background: isAmber ? "var(--dux-amber)" : "var(--neutral-50)",
      color: isAmber ? "var(--dux-black)" : "var(--neutral-800)",
      border: "1px solid " + (isAmber ? "var(--dux-amber)" : "var(--hairline)"),
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer",
      fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600,
    }}>
      <Icon name={icon} size={18} />
      {label}
    </button>
  );
}
