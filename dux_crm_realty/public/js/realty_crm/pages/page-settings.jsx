import React from "react";
/* Settings — basic */

window.PageSettings = function PageSettings() {
  const [section, setSection] = React.useState("workspace");

  const sections = [
    { id: "workspace", label: "Workspace" },
    { id: "team", label: "Team & roles" },
    { id: "stages", label: "Lead stages" },
    { id: "sources", label: "Sources" },
    { id: "templates", label: "Templates" },
    { id: "integrations", label: "Integrations" },
  ];

  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "240px 1fr", overflow: "hidden" }}>
      <nav style={{ borderRight: "1px solid var(--hairline)", padding: "20px 12px", background: "var(--bg)" }}>
        <div className="dux-eyebrow" style={{ fontSize: 10, padding: "0 12px 10px" }}>SETTINGS</div>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            width: "100%", padding: "10px 12px", border: "none",
            background: section === s.id ? "var(--dux-amber-50)" : "transparent",
            color: section === s.id ? "var(--dux-amber-600)" : "var(--neutral-600)",
            borderRadius: 6, fontSize: 13, fontWeight: section === s.id ? 700 : 500,
            textAlign: "left", cursor: "pointer", marginBottom: 2,
          }}>{s.label}</button>
        ))}
      </nav>

      <div style={{ overflow: "auto", padding: 32, maxWidth: 880 }}>
        {section === "workspace" && <WorkspaceSettings />}
        {section === "team" && <TeamSettings />}
        {section === "stages" && <StagesSettings />}
        {section === "sources" && <SimpleListSettings title="Lead sources" items={["Walk-in", "Website", "Channel Partner", "99acres", "MagicBricks", "Facebook", "Instagram", "Newspaper", "Hoarding", "Referral"]} />}
        {section === "templates" && <SimpleListSettings title="Message templates" items={["Welcome SMS", "Visit confirmation", "Follow-up call script", "Booking confirmation", "Payment reminder", "Possession invite"]} />}
        {section === "integrations" && <IntegrationsSettings />}
      </div>
    </div>
  );
};

function WorkspaceSettings() {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>Workspace</div>
      <div style={{ fontSize: 13, color: "var(--neutral-400)", marginTop: 4 }}>Organisation profile and regional defaults</div>

      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 24 }}>
        <Field label="Organisation name"><input className="dux-input" defaultValue="Shradha Realty Limited" /></Field>
        <Field label="GST number"><input className="dux-input" defaultValue="27AABCS1234L1Z9" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Currency"><select className="dux-input" defaultValue="INR"><option>INR</option></select></Field>
          <Field label="Timezone"><select className="dux-input" defaultValue="IST"><option>Asia/Kolkata (IST)</option></select></Field>
        </div>
        <Field label="Registered address"><textarea className="dux-input" rows={3} defaultValue="Plot 42, Wardhaman Nagar, Nagpur, Maharashtra 440008" /></Field>
        <Field label="Logo">
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, border: "1px dashed var(--hairline)", borderRadius: 8, background: "var(--neutral-50)" }}>
            <div style={{ width: 56, height: 56, borderRadius: 8, background: "var(--dux-navy)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700 }}>SR</div>
            <div style={{ flex: 1, fontSize: 12, color: "var(--neutral-600)" }}>Recommended 512×512 PNG, transparent background.</div>
            <Btn variant="outline" size="sm">Upload</Btn>
          </div>
        </Field>
        <div style={{ display: "flex", gap: 10, paddingTop: 14, borderTop: "1px solid var(--hairline)" }}>
          <Btn variant="primary" size="sm">Save changes</Btn>
          <Btn variant="ghost" size="sm">Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

function TeamSettings() {
  const team = [
    { name: "Priya Mehta", role: "Sales Lead", email: "priya@shradha.in", status: "active" },
    { name: "Rohan Bhide", role: "Sales Executive", email: "rohan@shradha.in", status: "active" },
    { name: "Anita Kulkarni", role: "Sales Executive", email: "anita@shradha.in", status: "active" },
    { name: "Vivek Joshi", role: "CRM Manager", email: "vivek@shradha.in", status: "active" },
    { name: "Sunita Rao", role: "Accounts", email: "sunita@shradha.in", status: "active" },
    { name: "Amit Deshpande", role: "Site Manager", email: "amit@shradha.in", status: "invited" },
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>Team & roles</div>
          <div style={{ fontSize: 13, color: "var(--neutral-400)", marginTop: 4 }}>{team.length} members across Shradha Realty</div>
        </div>
        <Btn variant="primary" size="sm" icon="plus">Invite member</Btn>
      </div>
      <div style={{ marginTop: 24, background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden" }}>
        {team.map((m, i) => (
          <div key={m.email} style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 14, alignItems: "center", borderTop: i ? "1px solid var(--hairline)" : "none" }}>
            <Avatar name={m.name} initials={m.name.split(" ").map(w => w[0]).join("")} size={36} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: "var(--neutral-400)" }}>{m.email}</div>
            </div>
            <span style={{ fontSize: 11, color: "var(--neutral-600)", fontWeight: 600 }}>{m.role}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, textTransform: "uppercase",
              background: m.status === "active" ? "rgba(86,138,79,0.12)" : "var(--dux-amber-100)",
              color: m.status === "active" ? "var(--success)" : "var(--dux-amber-600)",
            }}>{m.status}</span>
            <Btn variant="ghost" size="sm">Edit</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

function StagesSettings() {
  const data = window.CRM_DATA;
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>Lead stages</div>
      <div style={{ fontSize: 13, color: "var(--neutral-400)", marginTop: 4 }}>Drag to reorder. Stages drive the pipeline view.</div>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
        {data.stages.map((s, i) => (
          <div key={s.id} style={{
            padding: "14px 18px", display: "flex", alignItems: "center", gap: 14,
            background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 8,
          }}>
            <span style={{ color: "var(--neutral-400)", cursor: "grab" }}>⋮⋮</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neutral-400)", width: 24 }}>{(i + 1).toString().padStart(2, "0")}</span>
            <input className="dux-input" defaultValue={s.label} style={{ flex: 1, maxWidth: 320 }} />
            <span style={{ fontSize: 11, color: "var(--neutral-400)" }}>tone:</span>
            <select className="dux-input" defaultValue={s.tone} style={{ width: 110 }}>
              <option>info</option><option>amber</option><option>coral</option><option>success</option><option>neutral</option>
            </select>
            <Btn variant="ghost" size="sm">Remove</Btn>
          </div>
        ))}
        <Btn variant="outline" size="sm" icon="plus" style={{ alignSelf: "flex-start", marginTop: 8 }}>Add stage</Btn>
      </div>
    </div>
  );
}

function SimpleListSettings({ title, items }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map(it => (
          <div key={it} style={{ padding: "8px 14px", background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 999, fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 8 }}>
            {it}
            <span style={{ color: "var(--neutral-400)", cursor: "pointer" }}>×</span>
          </div>
        ))}
        <button style={{ padding: "8px 14px", background: "transparent", border: "1px dashed var(--neutral-300)", borderRadius: 999, fontSize: 13, color: "var(--neutral-600)", cursor: "pointer" }}>+ Add</button>
      </div>
    </div>
  );
}

function IntegrationsSettings() {
  const items = [
    { name: "WhatsApp Business", desc: "Send templated messages and visit reminders", on: true },
    { name: "Tally Prime", desc: "Sync receipts and invoices to accounting", on: true },
    { name: "MagicBricks Lead Sync", desc: "Auto-import leads from listings", on: true },
    { name: "99acres Lead Sync", desc: "Auto-import leads from listings", on: false },
    { name: "Google Calendar", desc: "Mirror site visits to your team's calendars", on: true },
    { name: "RERA Public Portal", desc: "Pull project status & inventory disclosures", on: false },
  ];
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>Integrations</div>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map(it => (
          <div key={it.name} style={{
            padding: 18, background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 10,
            display: "grid", gridTemplateColumns: "1fr auto auto", gap: 14, alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{it.name}</div>
              <div style={{ fontSize: 12, color: "var(--neutral-400)", marginTop: 2 }}>{it.desc}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: it.on ? "rgba(86,138,79,0.12)" : "var(--neutral-100)", color: it.on ? "var(--success)" : "var(--neutral-400)" }}>
              {it.on ? "CONNECTED" : "OFF"}
            </span>
            <Btn variant={it.on ? "outline" : "primary"} size="sm">{it.on ? "Manage" : "Connect"}</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--neutral-800)" }}>{label}</div>
      {children}
    </div>
  );
}
