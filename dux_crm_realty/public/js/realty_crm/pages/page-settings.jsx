import React from "react";
/* Settings — basic */

window.PageSettings = function PageSettings() {
  const [section, setSection] = React.useState("workspace");

  const canUsers = !!(window.CRM_DATA && window.CRM_DATA.currentUser && window.CRM_DATA.currentUser.canManageUsers);
  const sections = [
    { id: "workspace", label: "Workspace" },
    { id: "team", label: "Team & roles" },
    ...(canUsers ? [{ id: "users", label: "Users & access" }] : []),
    { id: "projects", label: "Projects" },
    { id: "stages", label: "Lead stages" },
    { id: "sources", label: "Sources" },
    { id: "email", label: "Email" },
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

      <div style={{ overflow: "auto", padding: 32, maxWidth: 920 }}>
        {section === "workspace" && <WorkspaceSettings />}
        {section === "team" && <TeamSettings />}
        {section === "users" && <UsersSettings />}
        {section === "projects" && <ProjectsSettings />}
        {section === "stages" && <StagesSettings />}
        {section === "sources" && <SourcesSettings />}
        {section === "email" && <EmailSettings />}
        {section === "templates" && <SimpleListSettings title="Message templates" items={["Welcome SMS", "Visit confirmation", "Follow-up call script", "Booking confirmation", "Payment reminder", "Possession invite"]} />}
        {section === "integrations" && <IntegrationsSettings />}
      </div>
    </div>
  );
};

const isMgr = () => !!(window.CRM_DATA && window.CRM_DATA.currentUser && window.CRM_DATA.currentUser.isManager);
const refreshCRM = async () => { if (window.__refreshCRM) await window.__refreshCRM(); };

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
  const data = window.CRM_DATA;
  const team = data.owners || [];
  const [addOpen, setAddOpen] = React.useState(false);
  const manager = isMgr();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>Team &amp; roles</div>
          <div style={{ fontSize: 13, color: "var(--neutral-400)", marginTop: 4 }}>{team.length} sales {team.length === 1 ? "rep" : "reps"} · holds &amp; leads are attributed to whoever has a login</div>
        </div>
        {manager && <Btn variant="primary" size="sm" icon="plus" onClick={() => setAddOpen(true)}>Add member</Btn>}
      </div>
      <div style={{ marginTop: 24, background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden" }}>
        {team.map((m, i) => (
          <div key={m.id || m.name} style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 14, alignItems: "center", borderTop: i ? "1px solid var(--hairline)" : "none" }}>
            <Avatar name={m.name} initials={m.initials} size={36} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: "var(--neutral-400)" }}>{m.login || m.phone || "—"}</div>
            </div>
            <span style={{ fontSize: 11, color: "var(--neutral-600)", fontWeight: 600 }}>{m.role}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, textTransform: "uppercase",
              background: m.login ? "rgba(86,138,79,0.12)" : "var(--neutral-100)",
              color: m.login ? "var(--success)" : "var(--neutral-400)",
            }}>{m.login ? "Has login" : "No login"}</span>
          </div>
        ))}
        {team.length === 0 && <div style={{ padding: 24, fontSize: 13, color: "var(--neutral-400)" }}>No team members yet.</div>}
      </div>
      <AddRepModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={refreshCRM} />
    </div>
  );
}

const LOGIN_ROLES = [
  ["Realty Sales Executive", "Sales Executive"],
  ["Realty Sales Manager", "Sales Manager"],
  ["Realty Finance", "Finance"],
  ["Realty Admin", "Admin"],
];

function UsersSettings() {
  const data = window.CRM_DATA;
  const [rows, setRows] = React.useState(null);   // null = loading
  const [addOpen, setAddOpen] = React.useState(false);
  const [pwdFor, setPwdFor] = React.useState(null);
  const load = async () => {
    try { const r = await frappe.call({ method: "dux_crm_realty.api.crm.list_crm_users" }); setRows(r.message || []); }
    catch (e) { frappe.msgprint(e.message || "Could not load logins"); setRows([]); }
  };
  React.useEffect(() => { load(); }, []);
  const call = async (method, args, msg) => {
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm." + method, args });
      if (msg) frappe.show_alert({ message: msg, indicator: "green" });
      await load();
      if (window.__refreshCRM) await window.__refreshCRM();
    } catch (e) { frappe.msgprint(e.message || "Action failed"); }
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>Users &amp; access</div>
          <div style={{ fontSize: 13, color: "var(--neutral-400)", marginTop: 4 }}>
            {rows === null ? "Loading…" : rows.length + " login" + (rows.length === 1 ? "" : "s") + " · people who can sign in to the CRM"}
          </div>
        </div>
        <Btn variant="primary" size="sm" icon="plus" onClick={() => setAddOpen(true)}>Add login</Btn>
      </div>

      <div style={{ marginTop: 16, padding: 12, background: "var(--neutral-50)", border: "1px solid var(--hairline)", borderRadius: 10, fontSize: 12, color: "var(--neutral-600)", display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Icon name="user" size={14} style={{ marginTop: 1, color: "var(--dux-amber-600)" }} />
        <span>Only logins created here are listed or changed. Other accounts on this server — including administrators — are never touched, and CRM logins never receive server-admin access.</span>
      </div>

      <div style={{ marginTop: 20, background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden" }}>
        {rows === null && <div style={{ padding: 24, fontSize: 13, color: "var(--neutral-400)" }}>Loading…</div>}
        {rows && rows.length === 0 && <div style={{ padding: 24, fontSize: 13, color: "var(--neutral-400)" }}>No CRM logins yet. Use “Add login” to create one for your team.</div>}
        {(rows || []).map((u, i) => (
          <div key={u.email} style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "auto 1fr auto auto auto auto", gap: 12, alignItems: "center", borderTop: i ? "1px solid var(--hairline)" : "none", opacity: u.enabled ? 1 : 0.55 }}>
            <Avatar name={u.name} initials={u.initials} size={36} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                {u.name}
                {u.isSelf && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--dux-amber-100)", color: "var(--dux-amber-600)" }}>YOU</span>}
                {!u.passwordSet && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--error-bg)", color: "var(--error)" }}>NO PASSWORD</span>}
              </div>
              <div style={{ fontSize: 11, color: "var(--neutral-400)" }}>{u.email}{u.lastLogin ? " · last login " + u.lastLogin : " · never logged in"}</div>
            </div>
            <select value={u.salesOwner || ""} title="Linked sales rep"
              onChange={(e) => call("link_crm_user_owner", { email: u.email, sales_owner: e.target.value || null }, "Rep link updated")}
              style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid var(--hairline)", fontSize: 12, background: "var(--bg)" }}>
              <option value="">— no rep —</option>
              {(data.owners || []).map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
            </select>
            <select value={u.role}
              onChange={(e) => call("set_crm_user_role", { email: u.email, role: e.target.value }, "Access level updated")}
              style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid var(--hairline)", fontSize: 12, background: "var(--bg)" }}>
              {LOGIN_ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <Btn variant="soft" size="sm" onClick={() => setPwdFor(u)}>Set password</Btn>
            <Btn variant="ghost" size="sm"
              onClick={() => call("set_crm_user_status", { email: u.email, enabled: u.enabled ? 0 : 1 }, u.enabled ? "Login disabled" : "Login enabled")}>
              {u.enabled ? "Disable" : "Enable"}
            </Btn>
          </div>
        ))}
      </div>

      <AddLoginModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={async () => { await load(); if (window.__refreshCRM) await window.__refreshCRM(); }} />
      <SetPasswordModal user={pwdFor} onClose={() => setPwdFor(null)} onSaved={load} />
    </div>
  );
}

function ProjectsSettings() {
  const data = window.CRM_DATA;
  const projects = data.projects || [];
  const manager = isMgr();
  const del = (p) => {
    frappe.confirm(
      `Delete <b>${p.name}</b>? This removes its towers, units and hold history. Sold units, bookings or linked leads will block the delete.`,
      async () => {
        try {
          const r = await frappe.call({ method: "dux_crm_realty.api.crm.delete_project", args: { code: p.id } });
          frappe.show_alert({ message: esc(p.name) + " deleted (" + r.message.units + " units)", indicator: "orange" });
          await refreshCRM();
        } catch (e) { frappe.msgprint(e.message || "Could not delete project"); }
      }
    );
  };
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>Projects</div>
      <div style={{ fontSize: 13, color: "var(--neutral-400)", marginTop: 4 }}>Create projects from Inventory → New project. Delete is blocked when a project has sold units, bookings or linked leads.</div>
      <div style={{ marginTop: 24, background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden" }}>
        {projects.map((p, i) => (
          <div key={p.id} style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 14, alignItems: "center", borderTop: i ? "1px solid var(--hairline)" : "none" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 4, background: "var(--neutral-100)", color: "var(--neutral-600)" }}>{p.code}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "var(--neutral-400)" }}>{p.locality ? p.locality + ", " : ""}{p.city} · {p.type}</div>
            </div>
            <span style={{ fontSize: 12, color: "var(--neutral-500)" }}>{p.totalUnits || 0} units · {p.sold || 0} sold</span>
            {manager
              ? <Btn variant="ghost" size="sm" icon="x" onClick={() => del(p)}>Delete</Btn>
              : <span style={{ fontSize: 11, color: "var(--neutral-300)" }}>—</span>}
          </div>
        ))}
        {projects.length === 0 && <div style={{ padding: 24, fontSize: 13, color: "var(--neutral-400)" }}>No projects yet.</div>}
      </div>
    </div>
  );
}

function SourcesSettings() {
  const data = window.CRM_DATA;
  const sources = data.sources || [];
  const manager = isMgr();
  const [adding, setAdding] = React.useState("");
  const add = async () => {
    const name = adding.trim();
    if (!name) return;
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm.add_source", args: { name } });
      setAdding("");
      await refreshCRM();
    } catch (e) { frappe.msgprint(e.message || "Could not add source"); }
  };
  const remove = async (name) => {
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm.delete_source", args: { name } });
      await refreshCRM();
    } catch (e) { frappe.msgprint(e.message || "Could not remove source"); }
  };
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>Lead sources</div>
      <div style={{ fontSize: 13, color: "var(--neutral-400)", marginTop: 4 }}>These power the “Source” dropdown when capturing a new lead.</div>
      <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {sources.map(it => (
          <div key={it} style={{ padding: "8px 14px", background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 999, fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 8 }}>
            {it}
            {manager && <button onClick={() => remove(it)} title="Remove" style={{ border: 0, background: "transparent", color: "var(--neutral-400)", cursor: "pointer", display: "inline-flex" }}><Icon name="x" size={13} /></button>}
          </div>
        ))}
        {sources.length === 0 && <span style={{ fontSize: 13, color: "var(--neutral-400)" }}>No sources yet.</span>}
      </div>
      {manager && (
        <div style={{ marginTop: 20, display: "flex", gap: 8, maxWidth: 360 }}>
          <input className="dux-input" placeholder="Add a source…" value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} style={{ flex: 1 }} />
          <Btn variant="outline" size="sm" icon="plus" onClick={add}>Add</Btn>
        </div>
      )}
    </div>
  );
}

function EmailSettings() {
  const data = window.CRM_DATA;
  const accounts = data.emailAccounts || [];
  const [editing, setEditing] = React.useState(undefined);  // undefined=closed · null=new · obj=edit
  const [testing, setTesting] = React.useState("");
  const act = async (method, args, msg, ind) => {
    try { await frappe.call({ method: "dux_crm_realty.api.crm." + method, args }); frappe.show_alert({ message: msg, indicator: ind || "blue" }); await refreshCRM(); }
    catch (e) { frappe.msgprint(e.message || "Action failed"); }
  };
  const test = async (a) => {
    setTesting(a.id);
    try { await frappe.call({ method: "dux_crm_realty.api.crm.test_email_account", args: { account: a.id } }); frappe.show_alert({ message: "Connection OK — " + a.email, indicator: "green" }); }
    catch (e) { frappe.msgprint(e.message || "Connection failed"); }
    setTesting(""); await refreshCRM();
  };
  const del = (a) => frappe.confirm(`Remove <b>${a.email}</b> as a sending address?`, () => act("delete_email_account", { account: a.id }, "Removed", "orange"));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>Email</div>
          <div style={{ fontSize: 13, color: "var(--neutral-400)", marginTop: 4 }}>Add the address you send lead emails from. For Gmail, use an App Password (not your login password).</div>
        </div>
        <Btn variant="primary" size="sm" icon="plus" onClick={() => setEditing(null)}>Add email account</Btn>
      </div>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        {accounts.length === 0 && (
          <div style={{ padding: 28, textAlign: "center", border: "1px dashed var(--hairline)", borderRadius: 12, color: "var(--neutral-400)", fontSize: 13 }}>
            No sending email yet. Add your Gmail (with an App Password) to start emailing leads from the CRM.
          </div>
        )}
        {accounts.map(a => (
          <div key={a.id} style={{ padding: "14px 18px", background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: "var(--neutral-100)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--neutral-600)", flexShrink: 0 }}>
              <Icon name="mail" size={17} />
            </div>
            <div style={{ minWidth: 200, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {a.email}
                {a.isDefault && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--dux-amber-100)", color: "var(--dux-amber-600)", textTransform: "uppercase" }}>Default</span>}
                {a.shared && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--info-bg)", color: "var(--info)", textTransform: "uppercase" }}>Shared</span>}
                {!a.enabled && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--neutral-100)", color: "var(--neutral-400)", textTransform: "uppercase" }}>Disabled</span>}
              </div>
              <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 2 }}>
                {a.senderName ? a.senderName + " · " : ""}{a.smtpHost}:{a.smtpPort}
                {!a.hasPassword && <span style={{ color: "var(--error)" }}> · no password set</span>}
                {a.lastStatus && <span style={{ color: a.lastStatus === "OK" ? "var(--success)" : "var(--error)" }}> · {a.lastStatus === "OK" ? "verified" : a.lastStatus}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {!a.isDefault && (a.mine || a.shared) && <Btn variant="ghost" size="sm" onClick={() => act("set_default_email_account", { account: a.id }, "Set as default", "green")}>Make default</Btn>}
              <Btn variant="soft" size="sm" onClick={() => test(a)}>{testing === a.id ? "Testing…" : "Test"}</Btn>
              <Btn variant="soft" size="sm" icon="edit" onClick={() => setEditing(a)}>Edit</Btn>
              <Btn variant="ghost" size="sm" icon="x" onClick={() => del(a)}>Remove</Btn>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, padding: 14, background: "var(--neutral-50)", border: "1px solid var(--hairline)", borderRadius: 10, fontSize: 12, color: "var(--neutral-600)", display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Icon name="mail" size={14} style={{ marginTop: 1, color: "var(--dux-amber-600)" }} />
        <span>Emails are sent directly from your address over SMTP — they don't go through any shared mailbox. Your app password is stored encrypted and is never shown again.</span>
      </div>

      <EmailAccountModal open={editing !== undefined} account={editing || null} onClose={() => setEditing(undefined)} onSaved={refreshCRM} />
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
