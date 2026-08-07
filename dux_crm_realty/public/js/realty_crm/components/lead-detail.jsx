import React from "react";
/* Lead detail panel — opens as a side drawer over the list views.
   Shared across all three directions. */

const { useState: ldUseState } = React;

const drawerSelect = {
  padding: "7px 12px", borderRadius: 8, border: "1px solid var(--hairline)",
  fontSize: 13, fontFamily: "var(--font-body)", background: "var(--bg)",
  color: "var(--neutral-800)", cursor: "pointer", outline: "none",
};
const drawerLbl = {
  fontFamily: "var(--font-display)", fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.06em", fontSize: 10, color: "var(--neutral-400)",
};

window.LeadDetail = function LeadDetail({ lead, onClose }) {
  const [tab, setTab] = ldUseState("activity");
  const [stage, setStage] = ldUseState(lead ? lead.stage : null);
  const [owner, setOwner] = ldUseState(lead ? (lead.ownerName || "") : "");
  const [activities, setActivities] = ldUseState(lead ? (lead.activities || []) : []);
  const [actModal, setActModal] = ldUseState(null);   // {type, label} | null
  const [visitOpen, setVisitOpen] = ldUseState(false);
  const [emailOpen, setEmailOpen] = ldUseState(false);
  if (!lead) return null;
  const data = window.CRM_DATA;
  const project = data.projects.find(p => p.id === lead.project);

  const refreshList = () => { if (window.__refreshCRM) window.__refreshCRM(); };

  const changeStage = async (s) => {
    setStage(s);
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.update_lead_stage", args: { lead: lead.id, stage: s } });
      if (r.message && r.message.activities) setActivities(r.message.activities);
      frappe.show_alert({ message: "Status changed to " + s, indicator: "blue" });
      refreshList();
    } catch (e) { frappe.msgprint(e.message || "Could not change status"); }
  };

  const changeOwner = async (o) => {
    setOwner(o);
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.reassign_lead", args: { lead: lead.id, owner: o || "" } });
      if (r.message && r.message.activities) setActivities(r.message.activities);
      frappe.show_alert({ message: o ? ("Assigned to " + esc(o)) : "Unassigned", indicator: "green" });
      refreshList();
    } catch (e) { frappe.msgprint(e.message || "Could not reassign"); }
  };

  const onLogged = (acts) => { setActivities(acts); setTab("activity"); refreshList(); };

  return (
   <>
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
            <StageBadge stage={stage} size="lg" />
            <Btn variant="accent" size="sm" icon="phone" onClick={() => setActModal({ type: "call", label: "Log a call" })}>Log call</Btn>
            <Btn variant="outline" size="sm" icon="whatsapp" onClick={() => setActModal({ type: "whatsapp", label: "Log a WhatsApp message" })}>WhatsApp</Btn>
            <Btn variant="outline" size="sm" icon="mail" onClick={() => setEmailOpen(true)}>Email</Btn>
            <Btn variant="outline" size="sm" icon="calendar" onClick={() => setVisitOpen(true)}>Schedule visit</Btn>
          </div>

          {/* Manager controls: change status + assign owner */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={drawerLbl}>Status</span>
              <select value={stage} onChange={(e) => changeStage(e.target.value)} style={drawerSelect}>
                {data.stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={drawerLbl}>Assign to</span>
              <select value={owner} onChange={(e) => changeOwner(e.target.value)} style={drawerSelect}>
                <option value="">Unassigned</option>
                {data.owners.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* Key facts grid */}
        <div style={{ padding: "16px 24px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, borderBottom: "1px solid var(--hairline)" }}>
          <Fact label="Project"   value={project?.name} sub={project?.locality} />
          <Fact label="Interest"  value={lead.interest} sub={"Budget " + fmtINR(lead.budget)} />
          <Fact label="Source"    value={lead.source}   sub={lead.channelPartnerName || "Direct"} />
          <Fact label="Entered by" value={lead.enteredBy || "—"} sub={owner ? ("Owner: " + owner) : "Unassigned"} />
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
          {tab === "activity" && <ActivityTab lead={lead} activities={activities} setActivities={setActivities} />}
          {tab === "tasks" && <TasksTab lead={lead} owners={data.owners} />}
          {tab === "units" && <UnitsTab inv={data.inventory[lead.project]} lead={lead} />}
          {tab === "docs" && <DocsTab lead={lead} />}
          {tab === "pricing" && <PricingTab lead={lead} />}
        </div>
      </div>

      <style>{`
        @keyframes duxFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes duxSlideIn { from { transform: translateX(40px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
      `}</style>
    </div>

    <LogActivityModal modal={actModal} onClose={() => setActModal(null)} lead={lead} onLogged={onLogged} />
    <ScheduleVisitModal open={visitOpen} onClose={() => setVisitOpen(false)} lead={lead} onLogged={onLogged} />
    <EmailComposerModal open={emailOpen} onClose={() => setEmailOpen(false)} lead={lead} onLogged={onLogged} />
   </>
  );
};

// ---------- Dux-styled modal shell (fixed, above the drawer) ----------
function LeadModal({ open, onClose, eyebrow, title, subtitle, width = 560, children, footer }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,26,46,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(4px)", animation: "duxFade 160ms var(--ease-standard)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width, maxWidth: "92%", maxHeight: "92%", display: "flex", flexDirection: "column",
        background: "var(--bg)", borderRadius: 14, boxShadow: "var(--shadow-xl)", overflow: "hidden",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flex: 1 }}>
            {eyebrow && <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>{eyebrow}</div>}
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: "var(--neutral-600)", marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ ...iconBtn, width: 32, height: 32, border: "1px solid var(--hairline)" }}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>{children}</div>
        {footer && <div style={{ padding: "16px 24px", borderTop: "1px solid var(--hairline)", background: "var(--neutral-50)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Log call / WhatsApp / note modal ----------
function LogActivityModal({ modal, onClose, lead, onLogged }) {
  const [text, setText] = ldUseState("");
  const [busy, setBusy] = ldUseState(false);
  React.useEffect(() => { if (modal) { setText(""); setBusy(false); } }, [modal]);
  if (!modal) return null;
  const meta = {
    call:     { eyebrow: "LOG A CALL",     icon: "phone",    placeholder: "What was discussed on the call?" },
    whatsapp: { eyebrow: "LOG A WHATSAPP", icon: "whatsapp", placeholder: "Summary of the WhatsApp conversation…" },
    note:     { eyebrow: "ADD A NOTE",     icon: "note",     placeholder: "Add a note…" },
  }[modal.type] || { eyebrow: "LOG", icon: "note", placeholder: "Details…" };
  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.log_activity", args: { lead: lead.id, text: text.trim(), activity_type: modal.type } });
      onLogged(r.message || r);
      frappe.show_alert({ message: modal.label + " logged", indicator: "green" });
      onClose();
    } catch (e) { frappe.msgprint(e.message || "Could not log activity"); setBusy(false); }
  };
  return (
    <LeadModal open={!!modal} onClose={onClose} eyebrow={meta.eyebrow} title={modal.label}
      subtitle={lead.name + " · " + lead.id} width={560}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon={meta.icon} onClick={submit}>{busy ? "Saving…" : "Log"}</Btn>
      </>}>
      <Field label={modal.label}>
        <Textarea autoFocus placeholder={meta.placeholder} rows={5} value={text}
          onChange={(e) => setText(e.target.value)} />
      </Field>
    </LeadModal>
  );
}

// ---------- Schedule visit modal ----------
function ScheduleVisitModal({ open, onClose, lead, onLogged }) {
  const defaultDate = () => {
    // anchor to the app's reference "today" so a new visit lands in the
    // currently-visible calendar week (the demo timeline is pinned, not real-time)
    const base = (window.CRM_DATA && window.CRM_DATA.today) || "2026-04-29";
    const d = new Date(base + "T00:00:00");
    d.setDate(d.getDate() + 2);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const [form, setForm] = ldUseState({ date: defaultDate(), time: "11:00", partyOf: 2, notes: "" });
  const [busy, setBusy] = ldUseState(false);
  React.useEffect(() => { if (open) { setForm({ date: defaultDate(), time: "11:00", partyOf: 2, notes: "" }); setBusy(false); } }, [open]);
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.schedule_visit", args: { payload: { date: form.date, time: form.time, partyOf: form.partyOf, notes: form.notes, lead: lead.id } } });
      if (r.message && r.message.activities) onLogged(r.message.activities);
      frappe.show_alert({ message: "Visit " + r.message.visit_id + " scheduled", indicator: "green" });
      onClose();
    } catch (e) { frappe.msgprint(e.message || "Could not schedule visit"); setBusy(false); }
  };
  return (
    <LeadModal open={open} onClose={onClose} eyebrow="SCHEDULE A SITE VISIT" title="Schedule a site visit"
      subtitle={lead.name + " · " + (lead.projectName || "")} width={600}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon="calendar" onClick={submit}>{busy ? "Scheduling…" : "Schedule visit"}</Btn>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Visit date" required>
          <Input type="date" value={form.date} onChange={(e) => u("date", e.target.value)} />
        </Field>
        <Field label="Time">
          <Input type="time" value={form.time} onChange={(e) => u("time", e.target.value)} />
        </Field>
        <Field label="Party of" hint="Number of visitors">
          <Input type="number" min="1" value={form.partyOf} onChange={(e) => u("partyOf", e.target.value)} />
        </Field>
        <div />
        <Field label="Notes" span={2}>
          <Textarea placeholder="Pickup, model flat, documents to carry…" rows={3} value={form.notes} onChange={(e) => u("notes", e.target.value)} />
        </Field>
      </div>
    </LeadModal>
  );
}

// ---------- AI email composer (draft with Gemma, attach docs, send) ----------
function EmailComposerModal({ open, onClose, lead, onLogged }) {
  const data = window.CRM_DATA;
  const kinds = data.emailKinds || ["Greeting", "Follow-up", "Custom"];
  const accounts = (data.emailAccounts || []).filter(a => a.enabled && a.hasPassword);
  const def = data.defaultEmailAccount;
  const [to, setTo] = ldUseState("");
  const [account, setAccount] = ldUseState("");
  const [kind, setKind] = ldUseState(kinds[0] || "Greeting");
  const [instruction, setInstruction] = ldUseState("");
  const [subject, setSubject] = ldUseState("");
  const [body, setBody] = ldUseState("");
  const [attach, setAttach] = ldUseState([]);          // document_ids
  const [busy, setBusy] = ldUseState("");              // "draft" | "improve" | "send" | ""
  React.useEffect(() => {
    if (open) {
      setTo(lead.email || ""); setAccount((def && def.id) || (accounts[0] && accounts[0].id) || "");
      setKind(kinds[0] || "Greeting"); setInstruction(""); setSubject(""); setBody(""); setAttach([]); setBusy("");
    }
  }, [open]);
  if (!open) return null;

  // attachable docs = the lead's docs + this project's docs (deduped)
  const freshLead = (data.leads || []).find(l => l.id === lead.id) || lead;
  const seen = {};
  const docs = [...(freshLead.documents || []), ...((data.documentsByProject || {})[lead.project] || [])]
    .filter(d => { if (seen[d.id]) return false; seen[d.id] = 1; return true; });
  const toggleAttach = (id) => setAttach(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);
  const noAccount = accounts.length === 0;

  const draft = async () => {
    setBusy("draft");
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.draft_email", args: { lead: lead.id, instruction, kind } });
      setSubject(r.message.subject || ""); setBody(r.message.body || "");
    } catch (e) { frappe.msgprint(e.message || "Could not draft the email"); }
    setBusy("");
  };
  const improve = async () => {
    if (!body.trim()) return;
    setBusy("improve");
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.improve_text", args: { text: body } });
      setBody(r.message.text || body);
    } catch (e) { frappe.msgprint(e.message || "Could not improve the text"); }
    setBusy("");
  };
  const send = async () => {
    if (!to.trim()) { frappe.msgprint("Enter a recipient email address."); return; }
    if (!subject.trim() && !body.trim()) { frappe.msgprint("Draft or write the email first."); return; }
    setBusy("send");
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.send_email", args: { payload: {
        lead: lead.id, to: to.trim(), subject: subject.trim(), body, account, attachments: attach } } });
      frappe.show_alert({ message: "Email sent to " + esc(r.message.to), indicator: "green" });
      if (r.message && r.message.activities) onLogged(r.message.activities);
      onClose();
    } catch (e) { frappe.msgprint(e.message || "Could not send the email"); setBusy(""); }
  };

  return (
    <LeadModal open={open} onClose={onClose} eyebrow="EMAIL · AI DRAFT" title={"Email " + lead.name}
      subtitle={lead.id + (lead.projectName ? " · " + lead.projectName : "")} width={680}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon="mail" onClick={send}
          style={{ opacity: (busy || noAccount) ? 0.6 : 1, pointerEvents: busy ? "none" : "auto" }}>
          {busy === "send" ? "Sending…" : "Send email"}
        </Btn>
      </>}>
      {noAccount && (
        <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 8, background: "var(--dux-amber-100)", color: "var(--dux-amber-600)", fontSize: 12, fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}>
          <Icon name="mail" size={14} /> No sending email is set up yet — add yours in Settings → Email. You can still draft below.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="To" required><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="lead@email.com" /></Field>
        <Field label="From">
          {accounts.length ? (
            <Select value={account} onChange={(e) => setAccount(e.target.value)}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.senderName ? a.senderName + " · " : ""}{a.email}{a.isDefault ? " (default)" : ""}</option>)}
            </Select>
          ) : <Input value="— none configured —" readOnly style={{ background: "var(--neutral-50)", color: "var(--neutral-400)" }} />}
        </Field>
        <Field label="Email type" span={2}>
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>{kinds.map(k => <option key={k}>{k}</option>)}</Select>
        </Field>
        <Field label="Tell the AI what to write" span={2} hint="It already knows the lead, project, configuration & budget — just add the gist">
          <Textarea rows={2} value={instruction} placeholder="e.g. Invite them for a Saturday site visit and attach the cost sheet" onChange={(e) => setInstruction(e.target.value)} />
        </Field>
      </div>
      <div style={{ margin: "12px 0 16px" }}>
        <Btn variant="primary" size="sm" icon="flame" onClick={draft} style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? "none" : "auto" }}>
          {busy === "draft" ? "Drafting with AI…" : (subject || body ? "Re-draft with AI" : "Draft with AI")}
        </Btn>
      </div>

      <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" /></Field>
      <div style={{ height: 12 }} />
      <Field label="Body">
        <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the email, or let the AI draft it above…" />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <button onClick={improve} disabled={!!busy || !body.trim()} style={{
          border: 0, background: "transparent", cursor: body.trim() ? "pointer" : "default",
          fontSize: 12, fontWeight: 600, color: body.trim() ? "var(--dux-navy)" : "var(--neutral-300)",
          display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Icon name="check" size={13} /> {busy === "improve" ? "Polishing…" : "Fix English / polish"}
        </button>
      </div>

      {docs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>Attach documents · {attach.length} selected</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
            {docs.map(d => {
              const on = attach.includes(d.id);
              return (
                <button key={d.id} onClick={() => toggleAttach(d.id)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", textAlign: "left",
                  border: "1px solid " + (on ? "var(--dux-amber)" : "var(--hairline)"), borderRadius: 9,
                  background: on ? "var(--dux-amber-100)" : "var(--bg)", cursor: "pointer" }}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    border: "1.5px solid " + (on ? "var(--dux-amber-600)" : "var(--neutral-300)"), background: on ? "var(--dux-amber-600)" : "transparent", color: "#fff" }}>
                    {on && <Icon name="check" size={11} />}
                  </span>
                  <Icon name="file" size={15} style={{ color: "var(--neutral-500)" }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
                  <span style={{ fontSize: 10, color: "var(--neutral-400)" }}>{d.category} · {fmtBytes(d.size)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </LeadModal>
  );
}

function Fact({ label, value, sub }) {
  return (
    <div>
      <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--neutral-400)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ActivityTab({ lead, activities, setActivities }) {
  const iconFor = { call: "phone", whatsapp: "whatsapp", email: "mail", visit: "calendar", note: "note", created: "plus" };
  const toneFor = { call: "var(--info)", whatsapp: "var(--success)", email: "var(--info)", visit: "var(--dux-amber-600)", note: "var(--neutral-600)", created: "var(--neutral-600)" };
  const activity = activities || [];
  const setActivity = setActivities;
  const [text, setText] = ldUseState("");
  const [busy, setBusy] = ldUseState(false);
  const log = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.log_activity", args: { lead: lead.id, text: text.trim(), activity_type: "note" } });
      setActivity(r.message);
      setText("");
    } catch (e) { frappe.msgprint(e.message || "Could not log activity"); }
    setBusy(false);
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <input placeholder="Add a note, log an activity…" value={text}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") log(); }}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--hairline)", fontFamily: "var(--font-body)", fontSize: 14, outline: "none" }} />
        <Btn variant="primary" size="sm" onClick={log}>Log</Btn>
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

function TasksTab({ lead }) {
  const [items, setItems] = ldUseState(lead.tasks || []);
  const [modalOpen, setModalOpen] = ldUseState(false);
  const toggle = (t) => {
    setItems(items.map(x => x.id === t.id ? { ...x, done: !x.done } : x));
    frappe.call({ method: "dux_crm_realty.api.crm.set_task_status", args: { task: t.id } }).catch(() => {});
  };
  const onSaved = async () => {
    if (window.__refreshCRM) await window.__refreshCRM();
    const fresh = (window.CRM_DATA.leads || []).find(l => l.id === lead.id);
    if (fresh) setItems(fresh.tasks || []);
  };
  const open = items.filter(t => !t.done);
  const done = items.filter(t => t.done);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div className="dux-eyebrow" style={{ fontSize: 10, flex: 1 }}>Open · {open.length}</div>
        <Btn variant="accent" size="sm" icon="plus" onClick={() => setModalOpen(true)}>New task</Btn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {open.length === 0 && <div style={{ fontSize: 13, color: "var(--neutral-400)" }}>No open tasks. Create one to schedule a follow-up.</div>}
        {open.map(t => <TaskRow key={t.id} t={t} onToggle={() => toggle(t)} />)}
      </div>
      {done.length > 0 && <>
        <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>Completed · {done.length}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {done.map(t => <TaskRow key={t.id} t={t} onToggle={() => toggle(t)} />)}
        </div>
      </>}
      <TaskModal open={modalOpen} onClose={() => setModalOpen(false)} lead={lead}
        defaultOwner={lead.ownerName} onSaved={onSaved} />
    </div>
  );
}

const TASK_ICON = { "Follow-up call": "phone", "WhatsApp": "whatsapp", "Email": "mail", "Site visit": "calendar", "Send documents": "file", "Collect documents": "file", "Payment follow-up": "rupee", "Meeting": "users", "Other": "note" };

function TaskRow({ t, onToggle }) {
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
      <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--neutral-50)", border: "1px solid var(--hairline)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--neutral-600)", flexShrink: 0 }}>
        <Icon name={TASK_ICON[t.type] || "note"} size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--neutral-400)" : "var(--neutral-800)" }}>{t.title}</div>
        <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, color: "var(--neutral-400)", flexWrap: "wrap" }}>
          <span style={{ color: tone, fontWeight: 600 }}>● {(t.priority || "med").toUpperCase()}</span>
          <span>{t.type}</span>
          <span>Due {fmtRelative(t.due)}{t.dueTime ? " · " + t.dueTime : ""}</span>
          {t.ownerName && <span>{t.ownerName}</span>}
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
            reserved:  { bg: "var(--info-bg)",       fg: "var(--info)",      bd: "rgba(47,110,181,0.3)" },
            sold:      { bg: "var(--neutral-100)",  fg: "var(--neutral-600)", bd: "var(--hairline)" },
          };
          const t = tones[u.status] || tones.available;
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

// ---------- DMS helpers (shared by the drawer DocsTab) ----------
window.fmtBytes = (n) => {
  if (n == null) return "—";
  if (n >= 1048576) return (n / 1048576).toFixed(1).replace(/\.0$/, "") + " MB";
  if (n >= 1024) return Math.max(1, Math.round(n / 1024)) + " KB";
  return n + " B";
};
window.downloadDocument = (docId) =>
  window.open("/api/method/dux_crm_realty.api.crm.download_document?document=" + encodeURIComponent(docId), "_blank");
window.copyShareLink = (url) => {
  if (!url) return;
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
    () => frappe.show_alert({ message: "Share link copied", indicator: "green" }),
    () => window.prompt("Copy this share link:", url));
};

function DocsTab({ lead }) {
  // re-resolve the lead's docs from fresh data each render (survives __refreshCRM)
  const fresh = (window.CRM_DATA.leads || []).find(l => l.id === lead.id) || lead;
  const docs = fresh.documents || [];
  const data = window.CRM_DATA;
  const isManager = !!(data.currentUser && data.currentUser.isManager);
  const me = (data.currentUser && data.currentUser.name) || "";
  const [uploadOpen, setUploadOpen] = ldUseState(false);
  const [editDoc, setEditDoc] = ldUseState(null);    // doc for EditDocumentModal
  const [cat, setCat] = ldUseState("all");
  const [q, setQ] = ldUseState("");
  const [history, setHistory] = ldUseState(null);   // { docId, rows } | null

  const cats = ["all", ...Array.from(new Set(docs.map(d => d.category).filter(Boolean)))];
  const query = q.trim().toLowerCase();
  const shown = docs.filter(d =>
    (cat === "all" || d.category === cat) &&
    (!query || `${d.title} ${(d.tags || []).join(" ")} ${d.category}`.toLowerCase().includes(query)));

  const act = async (method, args, msg, ind) => {
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm." + method, args });
      frappe.show_alert({ message: msg, indicator: ind || "blue" });
      if (window.__refreshCRM) await window.__refreshCRM();
    } catch (e) { frappe.msgprint(e.message || "Action failed"); }
  };
  const showHistory = async (docId) => {
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.get_document_shares", args: { document: docId } });
      setHistory({ docId, rows: r.message || [] });
    } catch (e) { frappe.msgprint(e.message || "Could not load history"); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="dux-eyebrow" style={{ fontSize: 10, flex: 1 }}>Documents · {docs.length}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--neutral-50)", border: "1px solid var(--hairline)", borderRadius: 8, padding: "6px 10px", width: 180 }}>
          <Icon name="search" size={13} style={{ color: "var(--neutral-400)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search docs…"
            style={{ border: 0, outline: "none", background: "transparent", flex: 1, minWidth: 0, fontSize: 12, fontFamily: "var(--font-body)" }} />
        </div>
        <Btn variant="accent" size="sm" icon="upload" onClick={() => setUploadOpen(true)}>Upload</Btn>
      </div>

      {cats.length > 2 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {cats.map(c => (
            <FilterChip key={c} active={cat === c} onClick={() => setCat(c)}>{c === "all" ? "All" : c}</FilterChip>
          ))}
        </div>
      )}

      {shown.length === 0 && (
        <div style={{ padding: 28, textAlign: "center", border: "1px dashed var(--hairline)", borderRadius: 12, color: "var(--neutral-400)", fontSize: 13 }}>
          {docs.length === 0 ? "No documents yet. Upload a brochure, cost sheet or KYC doc for this lead." : "No documents match your filter."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map(d => {
          const share = (d.shares || []).find(s => s.leadId === lead.id);
          return (
            <div key={d.id} style={{ border: "1px solid var(--hairline)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--neutral-100)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--neutral-600)", flexShrink: 0 }}>
                  <Icon name="file" size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {d.title}
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", padding: "2px 6px", borderRadius: 4, background: "var(--neutral-100)", color: "var(--neutral-600)", textTransform: "uppercase" }}>{d.category}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 2 }}>
                    {fmtBytes(d.size)} · uploaded {fmtRelative(d.at)}{d.uploadedBy ? " · " + d.uploadedBy : ""}
                  </div>
                  {(d.tags || []).length > 0 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                      {d.tags.map(t => <span key={t} style={tagChip}>{t}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {/* mirrors update_document's gate — uploader or manager only */}
                  {(isManager || d.uploadedBy === me) &&
                    <button onClick={() => setEditDoc(d)} title="Edit / rename / delete" style={{ ...iconBtn, width: 32, height: 32 }}><Icon name="edit" size={14} /></button>}
                  <button onClick={() => downloadDocument(d.id)} title="Download" style={{ ...iconBtn, width: 32, height: 32 }}><Icon name="download" size={14} /></button>
                </div>
              </div>

              {/* share row for THIS lead */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--hairline)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {share && share.status === "Approved" && (
                  <>
                    <span style={shareTag("var(--success)", "var(--success-bg)")}><Icon name="check" size={11} /> Shared · {share.accessCount || 0} open{(share.accessCount || 0) === 1 ? "" : "s"}</span>
                    {share.shareUrl && <Btn variant="outline" size="sm" icon="copy" onClick={() => copyShareLink(share.shareUrl)}>Copy link</Btn>}
                    {isManager && <Btn variant="ghost" size="sm" onClick={() => act("revoke_share", { share_id: share.id }, "Share revoked", "orange")}>Revoke</Btn>}
                  </>
                )}
                {share && share.status === "Requested" && (
                  <>
                    <span style={shareTag("var(--dux-amber-600)", "var(--dux-amber-100)")}><Icon name="clock" size={11} /> Share pending approval</span>
                    {isManager
                      ? <>
                          <Btn variant="accent" size="sm" icon="check" onClick={() => act("approve_share", { share_id: share.id }, "Share approved", "green")}>Approve</Btn>
                          <Btn variant="ghost" size="sm" onClick={() => act("reject_share", { share_id: share.id }, "Request declined", "orange")}>Decline</Btn>
                        </>
                      : (me === share.requestedBy
                          ? <Btn variant="ghost" size="sm" onClick={() => act("reject_share", { share_id: share.id }, "Request cancelled", "orange")}>Cancel</Btn>
                          : <span style={{ fontSize: 12, color: "var(--neutral-500)" }}>Awaiting manager approval.</span>)}
                  </>
                )}
                {!share && d.shareable && (
                  <Btn variant="accent" size="sm" icon="link" onClick={() => act("request_share", { document: d.id, lead: lead.id }, "Share requested — pending approval", "blue")}>
                    {isManager ? "Share with this lead" : "Request share"}
                  </Btn>
                )}
                {!share && !d.shareable && (
                  <>
                    <span style={{ fontSize: 12, color: "var(--neutral-400)" }}>Not shareable.</span>
                    {(isManager || d.uploadedBy === me) &&
                      <Btn variant="outline" size="sm" icon="link" onClick={() => act("update_document", { document: d.id, shareable: 1 }, "Marked shareable", "green")}>Make shareable</Btn>}
                  </>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={() => showHistory(d.id)} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--neutral-500)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Icon name="eye" size={12} /> Share history
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <UploadDocumentModal open={uploadOpen} onClose={() => setUploadOpen(false)}
        project={lead.project} lead={lead.id}
        onSaved={async () => { if (window.__refreshCRM) await window.__refreshCRM(); }} />
      <EditDocumentModal open={!!editDoc} doc={editDoc} onClose={() => setEditDoc(null)}
        onSaved={async () => { if (window.__refreshCRM) await window.__refreshCRM(); }} />
      <ShareHistoryModal history={history} onClose={() => setHistory(null)} />
    </div>
  );
}

const tagChip = {
  fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999,
  background: "var(--info-bg)", color: "var(--info)", fontFamily: "var(--font-body)",
};
const shareTag = (fg, bg) => ({
  display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700,
  padding: "4px 9px", borderRadius: 999, background: bg, color: fg, letterSpacing: "0.02em",
});

window.ShareHistoryModal = function ShareHistoryModal({ history, onClose }) {
  if (!history) return null;
  const STATUS_TONE = {
    Approved: ["var(--success)", "var(--success-bg)"], Requested: ["var(--dux-amber-600)", "var(--dux-amber-100)"],
    Rejected: ["var(--neutral-600)", "var(--neutral-100)"], Revoked: ["var(--error)", "var(--error-bg)"],
    Expired: ["var(--neutral-600)", "var(--neutral-100)"],
  };
  return (
    <LeadModal open={!!history} onClose={onClose} eyebrow="AUDIT TRAIL" title="Share history"
      subtitle={history.docId} width={620}
      footer={<Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>}>
      {history.rows.length === 0 && <div style={{ fontSize: 13, color: "var(--neutral-400)" }}>This document has never been shared.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {history.rows.map((r, i) => {
          const tone = STATUS_TONE[r.status] || STATUS_TONE.Requested;
          return (
            <div key={i} style={{ border: "1px solid var(--hairline)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={shareTag(tone[0], tone[1])}>{r.status}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{r.leadName}</span>
                <div style={{ flex: 1 }} />
                {r.shareUrl && <Btn variant="outline" size="sm" icon="copy" onClick={() => copyShareLink(r.shareUrl)}>Copy link</Btn>}
              </div>
              <div style={{ fontSize: 11, color: "var(--neutral-500)", lineHeight: 1.7 }}>
                Requested by {r.requestedBy || "—"} on {r.requestedOn || "—"}
                {r.approvedBy ? <> · approved by {r.approvedBy} on {r.approvedOn}</> : null}
                {r.status === "Approved" ? <> · opened {r.accessCount || 0}×{r.lastAccessedOn ? " (last " + r.lastAccessedOn + ")" : ""}</> : null}
                {r.closedBy ? <> · {r.closeReason || "Closed"} by {r.closedBy} on {r.closedOn}</> : null}
              </div>
            </div>
          );
        })}
      </div>
    </LeadModal>
  );
};

function PricingTab({ lead }) {
  // NO placeholder fallback. This used to fall back to an invented cost sheet ("Unit B-705,
  // 1145 sqft", base price 79,20,000, floor rise, east-facing premium…). Realty Cost Sheet
  // Item has zero rows site-wide, so EVERY one of the 853 real client leads rendered that
  // same fabricated quotation — numbers a rep could have read out to a customer.
  const rows = (lead.costSheet || []).map(r => [r.label, r.amount]);
  if (!rows.length) {
    return (
      <div style={{ padding: "28px 4px", textAlign: "center", color: "var(--neutral-400)" }}>
        <Icon name="rupee" size={22} style={{ opacity: 0.5 }} />
        <div style={{ fontSize: 13, marginTop: 10, color: "var(--neutral-600)", fontWeight: 600 }}>No cost sheet yet</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>
          Cost-sheet generation isn’t built yet — prepare the quotation outside the CRM and
          upload it on the Documents tab.
        </div>
      </div>
    );
  }
  const subtotal = rows.reduce((a, [, v]) => a + (v || 0), 0);
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
