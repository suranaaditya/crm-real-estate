import React from "react";
/* Form primitives: Field, Input, Select, Textarea, Modal.
   Used by New Lead modal + every page form. */

const { useState: useStateF, useEffect: useEffectF, useRef: useRefF } = React;

window.Field = function Field({ label, required, hint, error, children, span = 1 }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: `span ${span}` }}>
      <span style={{
        fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600,
        letterSpacing: "0.06em", textTransform: "uppercase",
        color: error ? "var(--error)" : "var(--neutral-600)",
      }}>
        {label}{required && <span style={{ color: "var(--dux-amber-600)" }}> *</span>}
      </span>
      {children}
      {hint && !error && <span style={{ fontSize: 11, color: "var(--neutral-400)" }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: "var(--error)" }}>{error}</span>}
    </label>
  );
};

const inputBase = {
  padding: "10px 12px", borderRadius: 8, border: "1px solid var(--hairline)",
  background: "var(--bg)", fontSize: 14, fontFamily: "var(--font-body)",
  color: "var(--neutral-900)", outline: "none", width: "100%",
  transition: "border-color 150ms, box-shadow 150ms",
};

window.Input = function Input(props) {
  const [focused, setFocused] = useStateF(false);
  return <input {...props} onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
    onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
    style={{
      ...inputBase,
      borderColor: focused ? "var(--dux-navy)" : "var(--hairline)",
      boxShadow: focused ? "0 0 0 3px rgba(15,26,46,0.08)" : "none",
      ...(props.style || {}),
    }} />;
};

window.Select = function Select({ children, ...rest }) {
  const [focused, setFocused] = useStateF(false);
  return (
    <div style={{ position: "relative" }}>
      <select {...rest} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          ...inputBase, appearance: "none", paddingRight: 32, cursor: "pointer",
          borderColor: focused ? "var(--dux-navy)" : "var(--hairline)",
          boxShadow: focused ? "0 0 0 3px rgba(15,26,46,0.08)" : "none",
          ...(rest.style || {}),
        }}>
        {children}
      </select>
      <span style={{
        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
        pointerEvents: "none", color: "var(--neutral-400)",
      }}>
        <Icon name="chevronD" size={14} />
      </span>
    </div>
  );
};

window.Textarea = function Textarea(props) {
  const [focused, setFocused] = useStateF(false);
  return <textarea {...props} onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
    onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
    style={{
      ...inputBase, minHeight: 80, resize: "vertical", fontFamily: "var(--font-body)",
      borderColor: focused ? "var(--dux-navy)" : "var(--hairline)",
      boxShadow: focused ? "0 0 0 3px rgba(15,26,46,0.08)" : "none",
      ...(props.style || {}),
    }} />;
};

// ---------- Modal shell ----------
window.Modal = function Modal({ open, onClose, title, subtitle, eyebrow, width = 720, children, footer }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: "rgba(15,26,46,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 60, backdropFilter: "blur(4px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width, maxWidth: "92%", maxHeight: "92%", display: "flex", flexDirection: "column",
        background: "var(--bg)", borderRadius: 14, boxShadow: "var(--shadow-xl)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid var(--hairline)",
          display: "flex", alignItems: "flex-start", gap: 14,
        }}>
          <div style={{ flex: 1 }}>
            {eyebrow && <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>{eyebrow}</div>}
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: "var(--neutral-600)", marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{
            ...iconBtn, width: 32, height: 32, border: "1px solid var(--hairline)",
          }}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {children}
        </div>
        {footer && <div style={{
          padding: "16px 24px", borderTop: "1px solid var(--hairline)", background: "var(--neutral-50)",
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10,
        }}>{footer}</div>}
      </div>
    </div>
  );
};

// ---------- New Lead modal ----------
window.NewLeadModal = function NewLeadModal({ open, onClose, onSave }) {
  const data = window.CRM_DATA;
  const [form, setForm] = useStateF({
    name: "", phone: "", email: "", occupation: "",
    source: "Website", channelPartner: "",
    project: "P-AN", interest: "3 BHK", budget: "",
    owner: "U1", city: "Nagpur",
    stage: "new", priority: "medium",
    notes: "",
  });
  const [step, setStep] = useStateF(1);
  const [errors, setErrors] = useStateF({});

  const update = (k, v) => setForm({ ...form, [k]: v });

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.phone.trim()) e.phone = "Required";
    else if (form.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a valid phone";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave && onSave(form);
    onClose();
  };

  const StepDot = ({ n, label, active, done }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: active || done ? 1 : 0.5 }}>
      <span style={{
        width: 22, height: 22, borderRadius: "50%",
        background: done ? "var(--success)" : active ? "var(--dux-navy)" : "var(--neutral-100)",
        color: done || active ? "#fff" : "var(--neutral-600)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700,
      }}>{done ? <Icon name="check" size={11} /> : n}</span>
      <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-display)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose}
      eyebrow="ADD A NEW LEAD"
      title={form.name ? `New lead: ${form.name}` : "Capture a new lead"}
      subtitle="Fill in what you have — you can complete the rest later."
      width={780}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        {step > 1 && <Btn variant="outline" size="sm" onClick={() => setStep(step - 1)}>Back</Btn>}
        {step < 3 && <Btn variant="primary" size="sm" icon="arrowR"
          onClick={() => { if (step === 1 && !validate()) return; setStep(step + 1); }}>Continue</Btn>}
        {step === 3 && <Btn variant="accent" size="sm" icon="check" onClick={handleSave}>Save lead</Btn>}
      </>}>
      <div style={{ display: "flex", gap: 24, marginBottom: 24, paddingBottom: 16, borderBottom: "1px dashed var(--hairline)" }}>
        <StepDot n={1} label="Contact" active={step === 1} done={step > 1} />
        <div style={{ flex: 0.3, height: 1, background: "var(--hairline)", alignSelf: "center" }} />
        <StepDot n={2} label="Interest" active={step === 2} done={step > 2} />
        <div style={{ flex: 0.3, height: 1, background: "var(--hairline)", alignSelf: "center" }} />
        <StepDot n={3} label="Assignment" active={step === 3} done={false} />
      </div>

      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Full name" required error={errors.name} span={2}>
            <Input placeholder="e.g. Rajesh Khandelwal" value={form.name} onChange={(e) => update("name", e.target.value)} />
          </Field>
          <Field label="Phone" required error={errors.phone}>
            <Input placeholder="+91 98220 41782" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" placeholder="name@email.com" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </Field>
          <Field label="Occupation">
            <Input placeholder="e.g. Chartered Accountant" value={form.occupation} onChange={(e) => update("occupation", e.target.value)} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
          </Field>
          <Field label="Source" span={2}>
            <Select value={form.source} onChange={(e) => update("source", e.target.value)}>
              {data.sources.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          {form.source === "Channel Partner" && (
            <Field label="Channel partner" span={2}>
              <Select value={form.channelPartner} onChange={(e) => update("channelPartner", e.target.value)}>
                <option value="">— Select partner —</option>
                {data.channelPartners.map(cp => <option key={cp.id} value={cp.id}>{cp.name} ({cp.contact})</option>)}
              </Select>
            </Field>
          )}
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Project of interest" span={2}>
            <Select value={form.project} onChange={(e) => update("project", e.target.value)}>
              {data.projects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.locality}, {p.city}</option>)}
            </Select>
          </Field>
          <Field label="Configuration">
            <Select value={form.interest} onChange={(e) => update("interest", e.target.value)}>
              {["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Row House", "Office Suite", "Retail Shop"].map(t => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Budget (₹)" hint="Approx. — used for unit recommendations">
            <Input type="text" placeholder="e.g. 7500000" value={form.budget} onChange={(e) => update("budget", e.target.value)} />
          </Field>
          <Field label="Initial notes" span={2} hint="Anything from the first conversation">
            <Textarea placeholder="Looking for east-facing 3 BHK, ready to visit this weekend…" rows={4}
              value={form.notes} onChange={(e) => update("notes", e.target.value)} />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Initial stage" span={2}>
            <Select value={form.stage} onChange={(e) => update("stage", e.target.value)}>
              {data.stages.filter(s => s.id !== "lost" && s.id !== "booked").map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Priority" span={2}>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { id: "low",    label: "Low",    color: "var(--neutral-600)" },
                { id: "medium", label: "Medium", color: "var(--info)" },
                { id: "high",   label: "High",   color: "var(--dux-amber-600)" },
                { id: "hot",    label: "🔥 Hot", color: "#B5462C" },
              ].map(p => {
                const active = form.priority === p.id;
                return (
                  <button key={p.id} onClick={() => update("priority", p.id)} style={{
                    flex: 1, padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                    border: "1.5px solid " + (active ? p.color : "var(--hairline)"),
                    background: active ? p.color : "var(--bg)",
                    color: active ? "#fff" : "var(--neutral-800)",
                    fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
                  }}>{p.label}</button>
                );
              })}
            </div>
          </Field>
          <div style={{ gridColumn: "span 2", padding: 14, background: "var(--neutral-50)", borderRadius: 10, border: "1px solid var(--hairline)" }}>
            <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>QUICK SUMMARY</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", fontSize: 13 }}>
              <span style={{ color: "var(--neutral-600)" }}>Lead</span><strong>{form.name || "—"}</strong>
              <span style={{ color: "var(--neutral-600)" }}>Phone</span><strong>{form.phone || "—"}</strong>
              <span style={{ color: "var(--neutral-600)" }}>Source</span><strong>{form.source}{form.channelPartner ? " · " + (data.channelPartners.find(c => c.id === form.channelPartner)?.name) : ""}</strong>
              <span style={{ color: "var(--neutral-600)" }}>Interest</span><strong>{form.interest} at {data.projects.find(p => p.id === form.project)?.name}</strong>
              <span style={{ color: "var(--neutral-600)" }}>Entered by</span><strong>{(data.currentUser && data.currentUser.name) || "You"}</strong>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--neutral-600)", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Icon name="users" size={14} style={{ marginTop: 1, color: "var(--dux-amber-600)" }} />
              <span>Assignment is done by a manager from the lead's detail panel. New leads default to the person who entered them.</span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ---------- New Project modal ----------
window.CreateProjectModal = function CreateProjectModal({ open, onClose, onSaved }) {
  const [form, setForm] = useStateF({ code: "", name: "", type: "Residential", city: "Nagpur",
    locality: "", typology: "2 & 3 BHK Flats", possession: "", priceFrom: "", priceTo: "", towers: "" });
  const [err, setErr] = useStateF({});
  const u = (k, v) => setForm({ ...form, [k]: v });
  const save = async () => {
    const e = {};
    if (!form.code.trim()) e.code = "Required";
    if (!form.name.trim()) e.name = "Required";
    setErr(e);
    if (Object.keys(e).length) return;
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.create_project", args: { payload: form } });
      frappe.show_alert({ message: "Project " + r.message.code + " created", indicator: "green" });
      onSaved && await onSaved(r.message);
      onClose();
    } catch (ex) { frappe.msgprint(ex.message || "Could not create project"); }
  };
  return (
    <Modal open={open} onClose={onClose} eyebrow="NEW PROJECT" title="Add a project"
      subtitle="Create the project, then add its inventory." width={720}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon="check" onClick={save}>Create project</Btn>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Project code" required error={err.code} hint="Short code, e.g. AN, SP">
          <Input placeholder="AN" value={form.code} onChange={(e) => u("code", e.target.value.toUpperCase())} />
        </Field>
        <Field label="Project name" required error={err.name}>
          <Input placeholder="Abhiman Niwas" value={form.name} onChange={(e) => u("name", e.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={form.type} onChange={(e) => u("type", e.target.value)}>
            {["Residential", "Commercial", "Row Houses"].map(t => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Typology"><Input placeholder="2 & 3 BHK Flats" value={form.typology} onChange={(e) => u("typology", e.target.value)} /></Field>
        <Field label="City"><Input value={form.city} onChange={(e) => u("city", e.target.value)} /></Field>
        <Field label="Locality"><Input placeholder="Hingna Road" value={form.locality} onChange={(e) => u("locality", e.target.value)} /></Field>
        <Field label="Possession"><Input placeholder="Dec 2027" value={form.possession} onChange={(e) => u("possession", e.target.value)} /></Field>
        <Field label="Towers (planned)"><Input type="number" value={form.towers} onChange={(e) => u("towers", e.target.value)} /></Field>
        <Field label="Price from (₹)"><Input type="number" placeholder="4250000" value={form.priceFrom} onChange={(e) => u("priceFrom", e.target.value)} /></Field>
        <Field label="Price to (₹)"><Input type="number" placeholder="8900000" value={form.priceTo} onChange={(e) => u("priceTo", e.target.value)} /></Field>
      </div>
    </Modal>
  );
};

// ---------- Add Units (inventory) modal ----------
window.AddUnitsModal = function AddUnitsModal({ open, onClose, project, onSaved }) {
  const [form, setForm] = useStateF({ tower: "A", floors: "4", unitsPerFloor: "4",
    typology: "2 BHK", carpet: "720", price: "5200000" });
  const u = (k, v) => setForm({ ...form, [k]: v });
  const total = (parseInt(form.floors) || 0) * (parseInt(form.unitsPerFloor) || 0);
  const code = (project || "").replace("P-", "");
  const save = async () => {
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.add_units", args: { payload: { ...form, project } } });
      frappe.show_alert({ message: r.message.created + " units added to " + code, indicator: "green" });
      onSaved && await onSaved(r.message);
      onClose();
    } catch (ex) { frappe.msgprint(ex.message || "Could not add units"); }
  };
  return (
    <Modal open={open} onClose={onClose} eyebrow="ADD INVENTORY" title={"Add units to " + code}
      subtitle="Generate a tower's units in one step." width={680}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon="plus" onClick={save}>Add {total} units</Btn>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Tower" hint="A single letter or code"><Input value={form.tower} onChange={(e) => u("tower", e.target.value.toUpperCase())} /></Field>
        <Field label="Typology">
          <Select value={form.typology} onChange={(e) => u("typology", e.target.value)}>
            {["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Row House", "Office Suite", "Retail Shop"].map(t => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Floors"><Input type="number" value={form.floors} onChange={(e) => u("floors", e.target.value)} /></Field>
        <Field label="Units per floor"><Input type="number" value={form.unitsPerFloor} onChange={(e) => u("unitsPerFloor", e.target.value)} /></Field>
        <Field label="Carpet area (sqft)"><Input type="number" value={form.carpet} onChange={(e) => u("carpet", e.target.value)} /></Field>
        <Field label="Price (₹)"><Input type="number" value={form.price} onChange={(e) => u("price", e.target.value)} /></Field>
      </div>
      <div style={{ marginTop: 16, padding: 12, background: "var(--neutral-50)", borderRadius: 10, fontSize: 13, color: "var(--neutral-600)" }}>
        Generates <strong style={{ color: "var(--neutral-800)" }}>{total}</strong> available units in Tower {form.tower} ({form.floors} floors × {form.unitsPerFloor} per floor).
      </div>
    </Modal>
  );
};

// ---------- Task modal (used by lead drawer + My Calendar) ----------
window.TaskModal = function TaskModal({ open, onClose, lead, defaultDate, defaultOwner, onSaved }) {
  const data = window.CRM_DATA;
  const TYPES = ["Follow-up call", "WhatsApp", "Email", "Site visit", "Send documents", "Collect documents", "Payment follow-up", "Meeting", "Other"];
  const init = () => ({
    title: "", type: "Follow-up call", date: defaultDate || (data.today || ""),
    time: "10:00", priority: "med",
    assignedTo: defaultOwner || (data.currentUser && data.currentUser.name) || "",
    notes: "",
  });
  const [form, setForm] = useStateF(init);
  useEffectF(() => { if (open) setForm(init()); }, [open, defaultDate, defaultOwner]);
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.title.trim()) { frappe.msgprint("Task title is required."); return; }
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm.create_task", args: { payload: { ...form, lead: lead ? lead.id : null } } });
      frappe.show_alert({ message: "Task created", indicator: "green" });
      onSaved && await onSaved();
      onClose();
    } catch (e) { frappe.msgprint(e.message || "Could not create task"); }
  };
  if (!open) return null;
  const PRI = [["low", "Low"], ["med", "Medium"], ["high", "High"]];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,26,46,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: "92%", maxHeight: "92%", display: "flex", flexDirection: "column", background: "var(--bg)", borderRadius: 14, boxShadow: "var(--shadow-xl)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>NEW TASK</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>Create a task</div>
            {lead && <div style={{ fontSize: 13, color: "var(--neutral-600)", marginTop: 4 }}>Linked to {lead.name} · {lead.id}</div>}
          </div>
          <button onClick={onClose} style={{ ...iconBtn, width: 32, height: 32, border: "1px solid var(--hairline)" }}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Task" required span={2}>
              <Input autoFocus placeholder="e.g. Call back about pricing" value={form.title} onChange={(e) => u("title", e.target.value)} />
            </Field>
            <Field label="Type">
              <Select value={form.type} onChange={(e) => u("type", e.target.value)}>{TYPES.map(t => <option key={t}>{t}</option>)}</Select>
            </Field>
            <Field label="Assign to" hint="Managers can assign to anyone">
              <Select value={form.assignedTo} onChange={(e) => u("assignedTo", e.target.value)}>
                {(data.owners || []).map(o => <option key={o.id} value={o.name}>{o.name} · {o.role}</option>)}
              </Select>
            </Field>
            <Field label="Due date"><Input type="date" value={form.date} onChange={(e) => u("date", e.target.value)} /></Field>
            <Field label="Time"><Input type="time" value={form.time} onChange={(e) => u("time", e.target.value)} /></Field>
            <Field label="Priority" span={2}>
              <div style={{ display: "flex", gap: 8 }}>
                {PRI.map(([id, lbl]) => {
                  const a = form.priority === id;
                  const c = id === "high" ? "var(--dux-amber-600)" : id === "med" ? "var(--info)" : "var(--neutral-600)";
                  return <button key={id} onClick={() => u("priority", id)} style={{ flex: 1, padding: "9px 12px", borderRadius: 8, cursor: "pointer", border: "1.5px solid " + (a ? c : "var(--hairline)"), background: a ? c : "var(--bg)", color: a ? "#fff" : "var(--neutral-800)", fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 600 }}>{lbl}</button>;
                })}
              </div>
            </Field>
            <Field label="Notes" span={2}><Textarea rows={3} placeholder="Optional details…" value={form.notes} onChange={(e) => u("notes", e.target.value)} /></Field>
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--hairline)", background: "var(--neutral-50)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="accent" size="sm" icon="check" onClick={save}>Create task</Btn>
        </div>
      </div>
    </div>
  );
};
