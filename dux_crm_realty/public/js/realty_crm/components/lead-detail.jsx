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
      frappe.show_alert({ message: o ? ("Assigned to " + o) : "Unassigned", indicator: "green" });
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
          {tab === "docs" && <DocsTab docs={data.documents} />}
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
  const rows = (lead.costSheet && lead.costSheet.length)
    ? lead.costSheet.map(r => [r.label, r.amount])
    : [
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
