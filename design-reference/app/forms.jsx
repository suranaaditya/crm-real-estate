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
          <Field label="Assign to" required>
            <Select value={form.owner} onChange={(e) => update("owner", e.target.value)}>
              {data.owners.map(o => <option key={o.id} value={o.id}>{o.name} · {o.role}</option>)}
            </Select>
          </Field>
          <Field label="Initial stage">
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
              <span style={{ color: "var(--neutral-600)" }}>Owner</span><strong>{data.owners.find(o => o.id === form.owner)?.name}</strong>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
