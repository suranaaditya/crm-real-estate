/* Lead detail panel — opens as a side drawer over the list views.
   Shared across all three directions. */

const { useState: ldUseState } = React;

window.LeadDetail = function LeadDetail({ lead, onClose }) {
  const [tab, setTab] = ldUseState("activity");
  if (!lead) return null;
  const data = window.CRM_DATA;
  const project = data.projects.find(p => p.id === lead.project);

  return (
    <div style={{
      position: "absolute", inset: 0,
      background: "rgba(15,26,46,0.32)", display: "flex", justifyContent: "flex-end",
      zIndex: 100, animation: "duxFade 200ms var(--ease-standard)",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(720px, 92%)", height: "100%", background: "var(--bg)",
        boxShadow: "var(--shadow-xl)", display: "flex", flexDirection: "column",
        animation: "duxSlideIn 280ms var(--ease-emphasized)",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <Avatar name={lead.name} initials={lead.initials} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>{lead.name}</div>
                {lead.starred && <Icon name="starF" size={16} style={{ color: "var(--dux-amber)" }} />}
                <ScoreChip score={lead.score} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, color: "var(--neutral-600)", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="phone" size={13} /> {lead.phone}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="mail" size={13} /> {lead.email}
                </span>
                <span style={{ color: "var(--neutral-400)" }}>{lead.id}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ ...iconBtn, border: "none", background: "transparent" }}>
              <Icon name="x" size={20} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <StageBadge stage={lead.stage} size="lg" />
            <Btn variant="accent" size="sm" icon="phone">Call</Btn>
            <Btn variant="outline" size="sm" icon="whatsapp">WhatsApp</Btn>
            <Btn variant="outline" size="sm" icon="calendar">Schedule visit</Btn>
            <Btn variant="ghost" size="sm" icon="edit">Edit</Btn>
          </div>
        </div>

        {/* Key facts grid */}
        <div style={{ padding: "16px 24px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, borderBottom: "1px solid var(--hairline)" }}>
          <Fact label="Project"   value={project?.name} sub={project?.locality} />
          <Fact label="Interest"  value={lead.interest} sub={"Budget " + fmtINR(lead.budget)} />
          <Fact label="Source"    value={lead.source}   sub={lead.channelPartnerName || "Direct"} />
          <Fact label="Owner"     value={lead.ownerName} sub={"Last touch " + fmtRelative(lead.lastActivity)} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 24, padding: "0 24px", borderBottom: "1px solid var(--hairline)" }}>
          {[
            ["activity", "Activity"],
            ["tasks", "Tasks"],
            ["units", "Unit interest"],
            ["docs", "Documents"],
            ["pricing", "Cost sheet"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              background: "transparent", border: 0, cursor: "pointer",
              padding: "14px 0", fontSize: 13, fontWeight: 600,
              fontFamily: "var(--font-display)", letterSpacing: "0.02em",
              color: tab === id ? "var(--dux-black)" : "var(--neutral-400)",
              borderBottom: "2px solid " + (tab === id ? "var(--dux-amber)" : "transparent"),
              marginBottom: -1,
            }}>{label}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {tab === "activity" && <ActivityTab activity={data.activity} />}
          {tab === "tasks" && <TasksTab tasks={data.tasks} owners={data.owners} />}
          {tab === "units" && <UnitsTab inv={data.inventory[lead.project]} lead={lead} />}
          {tab === "docs" && <DocsTab docs={data.documents} />}
          {tab === "pricing" && <PricingTab lead={lead} />}
        </div>
      </div>

      <style>{`
        @keyframes duxFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes duxSlideIn { from { transform: translateX(40px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
      `}</style>
    </div>
  );
};

function Fact({ label, value, sub }) {
  return (
    <div>
      <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--neutral-400)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ActivityTab({ activity }) {
  const iconFor = { call: "phone", whatsapp: "whatsapp", email: "mail", visit: "calendar", note: "note", created: "plus" };
  const toneFor = { call: "var(--info)", whatsapp: "var(--success)", email: "var(--info)", visit: "var(--dux-amber-600)", note: "var(--neutral-600)", created: "var(--neutral-600)" };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <input placeholder="Add a note, log an activity…"
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--hairline)", fontFamily: "var(--font-body)", fontSize: 14, outline: "none" }} />
        <Btn variant="primary" size="sm">Log</Btn>
      </div>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 15, top: 8, bottom: 8, width: 1, background: "var(--hairline)" }} />
        {activity.slice().reverse().map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 14, position: "relative", paddingBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--bg)", border: "1px solid var(--hairline)",
              color: toneFor[a.type] || "var(--neutral-600)",
              display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1,
            }}>
              <Icon name={iconFor[a.type] || "note"} size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--neutral-800)", lineHeight: 1.55 }}>{a.text}</div>
              <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                {a.who} · {a.at}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksTab({ tasks, owners }) {
  const [items, setItems] = ldUseState(tasks.map(t => ({ ...t })));
  const toggle = (id) => setItems(items.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const open = items.filter(t => !t.done);
  const done = items.filter(t => t.done);
  return (
    <div>
      <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>Open · {open.length}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {open.map(t => <TaskRow key={t.id} t={t} owners={owners} onToggle={() => toggle(t.id)} />)}
      </div>
      <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>Completed · {done.length}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {done.map(t => <TaskRow key={t.id} t={t} owners={owners} onToggle={() => toggle(t.id)} />)}
      </div>
    </div>
  );
}

function TaskRow({ t, owners, onToggle }) {
  const owner = owners.find(o => o.id === t.owner);
  const tone = t.priority === "high" ? "var(--error)" : t.priority === "med" ? "var(--dux-amber-600)" : "var(--neutral-400)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: 12,
      border: "1px solid var(--hairline)", borderRadius: 10, background: "var(--bg)",
    }}>
      <button onClick={onToggle} style={{
        width: 20, height: 20, borderRadius: 6, cursor: "pointer",
        border: "1.5px solid " + (t.done ? "var(--success)" : "var(--neutral-300)"),
        background: t.done ? "var(--success)" : "transparent",
        color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{t.done && <Icon name="check" size={12} />}</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--neutral-400)" : "var(--neutral-800)" }}>{t.title}</div>
        <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, color: "var(--neutral-400)" }}>
          <span style={{ color: tone, fontWeight: 600 }}>● {t.priority.toUpperCase()}</span>
          <span>Due {fmtRelative(t.due)}</span>
          <span>{owner?.name}</span>
        </div>
      </div>
    </div>
  );
}

function UnitsTab({ inv, lead }) {
  if (!inv) return <div style={{ color: "var(--neutral-400)", fontSize: 14 }}>No inventory loaded for this project.</div>;
  return (
    <div>
      <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>Tower B · Floor 7 · {lead.projectName}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {inv.units.map(u => {
          const tones = {
            available: { bg: "var(--success-bg)",   fg: "var(--success)",   bd: "rgba(58,143,90,0.3)" },
            blocked:   { bg: "var(--dux-amber-100)", fg: "var(--dux-amber-600)", bd: "rgba(242,169,59,0.4)" },
            sold:      { bg: "var(--neutral-100)",  fg: "var(--neutral-600)", bd: "var(--hairline)" },
          };
          const t = tones[u.status];
          const isFav = u.id === "B-705";
          return (
            <div key={u.id} style={{
              border: "1.5px solid " + (isFav ? "var(--dux-amber)" : t.bd),
              background: isFav ? "var(--dux-amber-100)" : t.bg,
              borderRadius: 10, padding: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>{u.tower}-{u.num}</div>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: t.fg, textTransform: "uppercase" }}>{u.status}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--neutral-600)", marginBottom: 8 }}>{u.typology} · {u.carpet} sqft · {u.facing}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600 }}>{fmtINR(u.price)}</div>
              {isFav && <div style={{ fontSize: 10, color: "var(--dux-amber-600)", fontWeight: 700, marginTop: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>★ Customer favourite</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocsTab({ docs }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {docs.map((d, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 14, padding: "12px 14px",
          border: "1px solid var(--hairline)", borderRadius: 10,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--neutral-100)",
            display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--neutral-600)" }}>
            <Icon name="file" size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
            <div style={{ fontSize: 11, color: "var(--neutral-400)" }}>{d.size} · uploaded {fmtRelative(d.at)}</div>
          </div>
          <button style={{ ...iconBtn, width: 32, height: 32 }}><Icon name="download" size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function PricingTab({ lead }) {
  const rows = [
    ["Base price (Unit B-705, 1145 sqft)", 7920000],
    ["Floor rise (7th floor @ ₹50/sqft)",   57250],
    ["East-facing premium",                  68700],
    ["Covered parking (2 slots)",           300000],
    ["Club membership",                      75000],
    ["Negotiated discount",                -202000],
  ];
  const subtotal = rows.reduce((a, [, v]) => a + v, 0);
  const gst = Math.round(subtotal * 0.05);
  const stamp = Math.round(subtotal * 0.06);
  const total = subtotal + gst + stamp;

  return (
    <div>
      <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 14 }}>Cost sheet · Draft v3 · {fmtRelative(lead.lastActivity)}</div>
      <div style={{ border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden" }}>
        {rows.map(([k, v], i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", padding: "12px 16px",
            borderBottom: "1px solid var(--hairline)", fontSize: 13,
            background: i % 2 ? "var(--bg)" : "var(--neutral-50)",
          }}>
            <span style={{ color: v < 0 ? "var(--success)" : "var(--neutral-800)" }}>{k}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: v < 0 ? "var(--success)" : "var(--neutral-800)" }}>{fmtINR(v)}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>
          <span>Sub-total</span><span style={{ fontFamily: "var(--font-mono)" }}>{fmtINR(subtotal)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", fontSize: 12, color: "var(--neutral-600)" }}>
          <span>GST @ 5%</span><span style={{ fontFamily: "var(--font-mono)" }}>{fmtINR(gst)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px 14px", fontSize: 12, color: "var(--neutral-600)" }}>
          <span>Stamp duty & registration (est.)</span><span style={{ fontFamily: "var(--font-mono)" }}>{fmtINR(stamp)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "16px", background: "var(--dux-navy)", color: "white" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", fontSize: 13 }}>Total payable</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 16 }}>{fmtINR(total)}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Btn variant="accent" icon="download">Download PDF</Btn>
        <Btn variant="outline" icon="whatsapp">Send on WhatsApp</Btn>
      </div>
    </div>
  );
}
