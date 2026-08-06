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

// ---------- Add Units (inventory) modal — uniform OR granular per-floor ----------
const UNIT_TYPOLOGIES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Penthouse", "Row House", "Office Suite", "Retail Shop"];
const UNIT_FACINGS = ["", "East", "West", "North", "South"];
const cellInput = { padding: "7px 8px", borderRadius: 6, border: "1px solid var(--hairline)", fontSize: 12, fontFamily: "var(--font-body)", background: "var(--bg)", color: "var(--neutral-900)", outline: "none", width: "100%" };
const newRow = () => ({ typology: "2 BHK", carpet: "", price: "", facing: "", count: "1" });

window.AddUnitsModal = function AddUnitsModal({ open, onClose, project, onSaved }) {
  const initForm = () => ({ tower: "A", floors: "4", unitsPerFloor: "4", typology: "2 BHK", carpet: "720", price: "5200000" });
  const [form, setForm] = useStateF(initForm);
  const [granular, setGranular] = useStateF(false);
  const [bands, setBands] = useStateF([]);
  useEffectF(() => { if (open) { setForm(initForm()); setGranular(false); setBands([]); } }, [open]);
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const code = (project || "").replace("P-", "");

  // --- band editor helpers (immutable) ---
  const setBand = (i, patch) => setBands(bs => bs.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  const setRow = (bi, ri, patch) => setBands(bs => bs.map((b, i) => i === bi ? { ...b, rows: b.rows.map((r, j) => j === ri ? { ...r, ...patch } : r) } : b));
  const addRow = (bi) => setBands(bs => bs.map((b, i) => i === bi ? { ...b, rows: [...b.rows, newRow()] } : b));
  const removeRow = (bi, ri) => setBands(bs => bs.map((b, i) => i === bi ? { ...b, rows: b.rows.filter((_, j) => j !== ri) } : b));
  const addBand = () => setBands(bs => { const maxTo = bs.reduce((m, b) => Math.max(m, parseInt(b.to) || 0), 0); const f = String(maxTo + 1); return [...bs, { from: f, to: f, rows: [newRow()] }]; });
  const removeBand = (i) => setBands(bs => bs.filter((_, idx) => idx !== i));
  const enableGranular = () => {
    setBands([{ from: "1", to: form.floors || "1", rows: [{ typology: form.typology, carpet: form.carpet, price: form.price, facing: "", count: form.unitsPerFloor || "1" }] }]);
    setGranular(true);
  };

  // --- math + validation ---
  const perFloor = (b) => b.rows.reduce((s, r) => s + (parseInt(r.count) || 0), 0);
  const bandFloors = (b) => { const f = parseInt(b.from) || 0, t = parseInt(b.to) || 0; return f && t && t >= f ? (t - f + 1) : 0; };
  const bandTotal = (b) => perFloor(b) * bandFloors(b);
  const uniformTotal = (parseInt(form.floors) || 0) * (parseInt(form.unitsPerFloor) || 0);
  const grandTotal = granular ? bands.reduce((s, b) => s + bandTotal(b), 0) : uniformTotal;

  const errors = [];
  if (granular) {
    const seen = {};
    bands.forEach((b, i) => {
      const f = parseInt(b.from) || 0, t = parseInt(b.to) || 0;
      if (f < 1) errors.push(`Band ${i + 1}: from-floor must be 1 or more`);
      else if (t < f) errors.push(`Band ${i + 1}: to-floor must be ≥ from-floor`);
      else { for (let fl = f; fl <= t; fl++) { if (seen[fl] != null) errors.push(`Floor ${fl} is in more than one band`); seen[fl] = i; } }
      if (perFloor(b) > 99) errors.push(`Band ${i + 1}: more than 99 units per floor`);
    });
    if (grandTotal === 0) errors.push("Add at least one unit");
  }
  const canSave = granular ? errors.length === 0 && grandTotal > 0 : uniformTotal > 0;

  const save = async () => {
    if (!canSave) return;
    let payload;
    if (granular && grandTotal > 0) {
      payload = {
        project, tower: form.tower,
        carpetDefault: form.carpet, priceDefault: form.price,
        bands: bands.map(b => ({
          from: parseInt(b.from) || 0, to: parseInt(b.to) || 0,
          rows: b.rows.filter(r => (parseInt(r.count) || 0) > 0).map(r => ({
            typology: r.typology, carpet: r.carpet, price: r.price, facing: r.facing, count: parseInt(r.count) || 1,
          })),
        })),
      };
    } else {
      payload = { ...form, project };  // legacy uniform path
    }
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.add_units", args: { payload } });
      const msg = r.message.created + " units added to " + code + (r.message.skipped ? " (" + r.message.skipped + " already existed)" : "");
      frappe.show_alert({ message: msg, indicator: "green" });
      onSaved && await onSaved(r.message);
      onClose();
    } catch (ex) { frappe.msgprint(ex.message || "Could not add units"); }
  };

  return (
    <Modal open={open} onClose={onClose} eyebrow="ADD INVENTORY" title={"Add units to " + code}
      subtitle="Set a uniform tower, or a per-floor mix for varied layouts." width={720}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon="plus" onClick={save}
          style={{ opacity: canSave ? 1 : 0.5, pointerEvents: canSave ? "auto" : "none" }}>
          Add {grandTotal} unit{grandTotal === 1 ? "" : "s"}
        </Btn>
      </>}>
      {/* Tower-wide defaults (uniform mode = the whole submission) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Tower" hint="A single letter or code"><Input value={form.tower} onChange={(e) => u("tower", e.target.value.toUpperCase())} /></Field>
        <Field label={granular ? "Default typology" : "Typology"}>
          <Select value={form.typology} onChange={(e) => u("typology", e.target.value)}>
            {UNIT_TYPOLOGIES.map(t => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        {!granular && <Field label="Floors"><Input type="number" min="1" value={form.floors} onChange={(e) => u("floors", e.target.value)} /></Field>}
        {!granular && <Field label="Units per floor"><Input type="number" min="1" value={form.unitsPerFloor} onChange={(e) => u("unitsPerFloor", e.target.value)} /></Field>}
        <Field label={granular ? "Default carpet (sqft)" : "Carpet area (sqft)"}><Input type="number" value={form.carpet} onChange={(e) => u("carpet", e.target.value)} /></Field>
        <Field label={granular ? "Default price (₹)" : "Price (₹)"}><Input type="number" value={form.price} onChange={(e) => u("price", e.target.value)} /></Field>
      </div>

      {/* Progressive disclosure toggle */}
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
        {!granular ? (
          <button onClick={enableGranular} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px dashed var(--hairline)", background: "var(--neutral-50)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-display)", color: "var(--dux-navy)" }}>
            <Icon name="chevronD" size={14} /> Floors vary? Set a per-floor mix
          </button>
        ) : (
          <button onClick={() => setGranular(false)} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--neutral-500)" }}>
            ← Back to a uniform tower
          </button>
        )}
      </div>

      {/* Band editor */}
      {granular && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {bands.map((b, bi) => (
            <div key={bi} style={{ border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--neutral-50)", borderBottom: "1px solid var(--hairline)" }}>
                <span style={{ ...drawerEyebrow }}>Floors</span>
                <input type="number" min="1" value={b.from} onChange={(e) => setBand(bi, { from: e.target.value })} style={{ ...cellInput, width: 64 }} />
                <span style={{ color: "var(--neutral-400)" }}>–</span>
                <input type="number" min="1" value={b.to} onChange={(e) => setBand(bi, { to: e.target.value })} style={{ ...cellInput, width: 64 }} />
                <span style={{ fontSize: 11, color: "var(--neutral-500)" }}>
                  {bandFloors(b) === 1 ? "Single floor (penthouse / amenity)" : bandFloors(b) > 1 ? `${bandFloors(b)} floors` : "—"}
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: "var(--neutral-600)" }}>{perFloor(b)}/floor · <strong>{bandTotal(b)}</strong> total</span>
                {bands.length > 1 && <button onClick={() => removeBand(bi)} title="Remove band" style={{ ...iconBtn, width: 26, height: 26 }}><Icon name="x" size={13} /></button>}
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.9fr 1.1fr 1fr 0.7fr 28px", gap: 8, marginBottom: 6 }}>
                  {["Typology", "Carpet", "Price ₹", "Facing", "Per floor", ""].map((h, i) => (
                    <span key={i} style={{ ...drawerEyebrow, fontSize: 9 }}>{h}</span>
                  ))}
                </div>
                {b.rows.map((r, ri) => (
                  <div key={ri} style={{ display: "grid", gridTemplateColumns: "1.5fr 0.9fr 1.1fr 1fr 0.7fr 28px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <select value={r.typology} onChange={(e) => setRow(bi, ri, { typology: e.target.value })} style={{ ...cellInput, cursor: "pointer" }}>
                      {UNIT_TYPOLOGIES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <input type="number" placeholder={form.carpet || "720"} value={r.carpet} onChange={(e) => setRow(bi, ri, { carpet: e.target.value })} style={cellInput} />
                    <input type="number" placeholder={form.price || "—"} value={r.price} onChange={(e) => setRow(bi, ri, { price: e.target.value })} style={cellInput} />
                    <select value={r.facing} onChange={(e) => setRow(bi, ri, { facing: e.target.value })} style={{ ...cellInput, cursor: "pointer" }}>
                      {UNIT_FACINGS.map(fc => <option key={fc} value={fc}>{fc || "Auto"}</option>)}
                    </select>
                    <input type="number" min="1" value={r.count} onChange={(e) => setRow(bi, ri, { count: e.target.value })} style={cellInput} />
                    {b.rows.length > 1
                      ? <button onClick={() => removeRow(bi, ri)} title="Remove" style={{ ...iconBtn, width: 26, height: 26, border: "none" }}><Icon name="x" size={12} /></button>
                      : <span />}
                  </div>
                ))}
                <button onClick={() => addRow(bi)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--dux-amber-600)", padding: "2px 0" }}>+ Add unit type</button>
              </div>
            </div>
          ))}
          <button onClick={addBand} style={{ border: "1px dashed var(--hairline)", background: "var(--neutral-50)", borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-display)", color: "var(--dux-navy)" }}>
            + Add another floor band
          </button>
        </div>
      )}

      {/* Summary / errors */}
      <div style={{ marginTop: 16, padding: 12, background: errors.length ? "var(--error-bg)" : "var(--neutral-50)", borderRadius: 10, fontSize: 13, color: errors.length ? "var(--error)" : "var(--neutral-600)" }}>
        {errors.length
          ? errors[0]
          : <>Generates <strong style={{ color: "var(--neutral-800)" }}>{grandTotal}</strong> available unit{grandTotal === 1 ? "" : "s"} in Tower {form.tower || "?"}{!granular && <> ({form.floors} floors × {form.unitsPerFloor} per floor)</>}.</>}
      </div>
    </Modal>
  );
};
const drawerEyebrow = { fontFamily: "var(--font-display)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10, color: "var(--neutral-400)" };

// ---------- Email account modal (Settings → Email) ----------
window.EmailAccountModal = function EmailAccountModal({ open, onClose, account, onSaved }) {
  const init = () => ({ email: "", senderName: "", smtpHost: "smtp.gmail.com", smtpPort: 465,
    useSsl: true, password: "", isDefault: true, enabled: true });
  const [form, setForm] = useStateF(init);
  const [busy, setBusy] = useStateF(false);
  const [adv, setAdv] = useStateF(false);
  useEffectF(() => {
    if (open) {
      if (account) setForm({ id: account.id, email: account.email || "", senderName: account.senderName || "",
        smtpHost: account.smtpHost || "smtp.gmail.com", smtpPort: account.smtpPort || 465,
        useSsl: account.useSsl !== false, password: "", isDefault: !!account.isDefault, enabled: account.enabled !== false });
      else setForm(init());
      setBusy(false); setAdv(false);
    }
  }, [open, account]);
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  if (!open) return null;
  const save = async () => {
    if (!form.email.trim() || !form.email.includes("@")) { frappe.msgprint("Enter a valid email address."); return; }
    if (!account && !form.password) { frappe.msgprint("Enter the app password for this account."); return; }
    setBusy(true);
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm.save_email_account", args: { payload: form } });
      frappe.show_alert({ message: "Email account saved", indicator: "green" });
      onSaved && await onSaved(); onClose();
    } catch (e) { frappe.msgprint(e.message || "Could not save email account"); setBusy(false); }
  };
  const Check = ({ on, onClick, label }) => (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <button onClick={(e) => { e.preventDefault(); onClick(); }} style={{
        width: 18, height: 18, borderRadius: 5, cursor: "pointer", flexShrink: 0,
        border: "1.5px solid " + (on ? "var(--dux-navy)" : "var(--neutral-300)"),
        background: on ? "var(--dux-navy)" : "transparent", color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{on && <Icon name="check" size={12} />}</button>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
    </label>
  );
  return (
    <Modal open={open} onClose={onClose} eyebrow="EMAIL ACCOUNT" title={account ? "Edit email account" : "Add a sending email"}
      subtitle="Emails to leads are sent from this address (SMTP). For Gmail, use an App Password." width={600}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon="check" onClick={save}>{busy ? "Saving…" : "Save"}</Btn>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Email address" required><Input type="email" autoFocus placeholder="you@gmail.com" value={form.email} onChange={(e) => u("email", e.target.value)} /></Field>
        <Field label="Sender name" hint="Shown as the From name"><Input placeholder="e.g. Priya · Shradha Realty" value={form.senderName} onChange={(e) => u("senderName", e.target.value)} /></Field>
        <Field label={account ? "App password (leave blank to keep)" : "App password"} required={!account} span={2}
          hint="Gmail: myaccount.google.com → Security → App passwords (needs 2-Step Verification). Paste the 16-character code.">
          <Input type="password" autoComplete="new-password" placeholder={account ? "•••••••••••• (unchanged)" : "16-character app password"} value={form.password} onChange={(e) => u("password", e.target.value)} />
        </Field>
        <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 12, padding: 14, border: "1px solid var(--hairline)", borderRadius: 10, background: "var(--neutral-50)" }}>
          <Check on={form.isDefault} onClick={() => u("isDefault", !form.isDefault)} label="Use this as my default sending address" />
          <Check on={form.enabled} onClick={() => u("enabled", !form.enabled)} label="Enabled" />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <button onClick={() => setAdv(a => !a)} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--dux-navy)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="chevronD" size={13} /> {adv ? "Hide" : "Advanced"} SMTP settings
          </button>
        </div>
        {adv && <>
          <Field label="SMTP host"><Input value={form.smtpHost} onChange={(e) => u("smtpHost", e.target.value)} /></Field>
          <Field label="SMTP port"><Input type="number" value={form.smtpPort} onChange={(e) => u("smtpPort", e.target.value)} /></Field>
          <div style={{ gridColumn: "span 2" }}><Check on={form.useSsl} onClick={() => u("useSsl", !form.useSsl)} label="Use SSL (port 465). Uncheck for STARTTLS (port 587)." /></div>
        </>}
      </div>
    </Modal>
  );
};

// ---------- Reusable lead picker (project filter + search) ----------
window.LeadPicker = function LeadPicker({ value, onChange, defaultProject }) {
  const data = window.CRM_DATA;
  const [query, setQuery] = useStateF("");
  const [projectF, setProjectF] = useStateF(defaultProject && (data.projects || []).some(p => p.id === defaultProject) ? defaultProject : "all");
  const picked = value ? (data.leads || []).find(l => l.id === value) : null;
  const matches = !value ? (data.leads || []).filter(l => {
    if (projectF !== "all" && l.project !== projectF) return false;
    const q = query.trim().toLowerCase();
    if (q && !`${l.name} ${l.id} ${l.phone || ""} ${l.projectName || ""}`.toLowerCase().includes(q)) return false;
    return true;
  }).slice(0, 6) : [];
  if (picked) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--hairline)", borderRadius: 8, background: "var(--neutral-50)" }}>
        <Avatar name={picked.name} initials={picked.initials} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{picked.name}</div>
          <div style={{ fontSize: 11, color: "var(--neutral-400)", fontFamily: "var(--font-mono)" }}>{picked.id} · {picked.projectName || "—"}</div>
        </div>
        <button onClick={() => onChange("")} title="Clear" style={{ ...iconBtn, width: 28, height: 28 }}><Icon name="x" size={14} /></button>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <Select value={projectF} onChange={(e) => setProjectF(e.target.value)} style={{ flex: "0 0 40%" }}>
          <option value="all">All projects</option>
          {(data.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Input placeholder="Search name, phone, ID…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1 }} />
      </div>
      <div style={{ marginTop: 8, maxHeight: 168, overflowY: "auto", border: "1px solid var(--hairline)", borderRadius: 8 }}>
        {matches.length === 0 && <div style={{ padding: "12px", fontSize: 12, color: "var(--neutral-400)" }}>No leads match — adjust the project or search.</div>}
        {matches.map(l => (
          <button key={l.id} onClick={() => onChange(l.id)} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px",
            border: 0, borderBottom: "1px solid var(--hairline)", background: "transparent", cursor: "pointer", textAlign: "left",
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--neutral-50)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <Avatar name={l.name} initials={l.initials} size={26} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--neutral-800)" }}>{l.name}</div>
              <div style={{ fontSize: 11, color: "var(--neutral-400)", fontFamily: "var(--font-mono)" }}>{l.id} · {l.projectName || "—"}{l.phone ? " · " + l.phone : ""}</div>
            </div>
            <StageBadge stage={l.stage} />
          </button>
        ))}
      </div>
    </div>
  );
};

// ---------- Add team member (Settings) ----------
const REP_LOGIN_ROLES = [
  ["Realty Sales Executive", "Sales Executive"],
  ["Realty Sales Manager", "Sales Manager"],
  ["Realty Finance", "Finance"],
  ["Realty Admin", "Admin"],
];
window.AddRepModal = function AddRepModal({ open, onClose, onSaved }) {
  const init = () => ({ full_name: "", role: "Sales Executive", phone: "", email: "", createLogin: false, frappeRole: "Realty Sales Executive" });
  const [form, setForm] = useStateF(init);
  const [busy, setBusy] = useStateF(false);
  useEffectF(() => { if (open) { setForm(init()); setBusy(false); } }, [open]);
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  if (!open) return null;
  const save = async () => {
    if (!form.full_name.trim()) { frappe.msgprint("Name is required."); return; }
    if (form.createLogin && !form.email.trim()) { frappe.msgprint("An email is required to create a login."); return; }
    setBusy(true);
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.create_rep", args: { payload: form } });
      frappe.show_alert({ message: form.full_name + " added" + (r.message.login ? " · login " + r.message.login : ""), indicator: "green" });
      onSaved && await onSaved();
      onClose();
    } catch (e) { frappe.msgprint(e.message || "Could not add member"); setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} eyebrow="TEAM" title="Add a team member"
      subtitle="Add a sales rep — and optionally create an ERPNext login so holds & leads are attributed to them."
      width={600}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon="check" onClick={save}>{busy ? "Adding…" : "Add member"}</Btn>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Full name" required span={2}><Input autoFocus placeholder="e.g. Anita Kulkarni" value={form.full_name} onChange={(e) => u("full_name", e.target.value)} /></Field>
        <Field label="Title / role">
          <Select value={form.role} onChange={(e) => u("role", e.target.value)}>
            {["Sales Executive", "Sales Manager", "Telecaller", "Finance", "Admin"].map(r => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Phone"><Input placeholder="+91…" value={form.phone} onChange={(e) => u("phone", e.target.value)} /></Field>
        <Field label="Email" span={2} hint="Used as the ERPNext login id, if you create one"><Input type="email" placeholder="name@shradha.in" value={form.email} onChange={(e) => u("email", e.target.value)} /></Field>
        <div style={{ gridColumn: "span 2", padding: 14, border: "1px solid var(--hairline)", borderRadius: 10, background: "var(--neutral-50)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <button onClick={(e) => { e.preventDefault(); u("createLogin", !form.createLogin); }} style={{
              width: 18, height: 18, borderRadius: 5, cursor: "pointer", flexShrink: 0,
              border: "1.5px solid " + (form.createLogin ? "var(--dux-navy)" : "var(--neutral-300)"),
              background: form.createLogin ? "var(--dux-navy)" : "transparent",
              color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>{form.createLogin && <Icon name="check" size={12} />}</button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Create an ERPNext login for this person</span>
          </label>
          {form.createLogin && (
            <div style={{ marginTop: 12 }}>
              <Field label="Login role">
                <Select value={form.frappeRole} onChange={(e) => u("frappeRole", e.target.value)}>
                  {REP_LOGIN_ROLES.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
                </Select>
              </Field>
              <div style={{ fontSize: 11, color: "var(--neutral-500)", marginTop: 8, display: "flex", gap: 6, alignItems: "flex-start" }}>
                <Icon name="user" size={13} style={{ marginTop: 1, color: "var(--dux-amber-600)" }} />
                <span>Creates a Frappe/ERPNext User (no password — they set one via “Forgot password”). The login is linked to this rep so their holds and leads are attributed correctly.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

// ---------- Add login + set password (Settings -> Users & access) ----------
const LOGIN_ROLE_OPTS = [
  ["Realty Sales Executive", "Sales Executive — leads, own holds"],
  ["Realty Sales Manager", "Sales Manager — approves holds"],
  ["Realty Finance", "Finance — payments view"],
  ["Realty Admin", "Admin — can manage logins"],
];
// Credentials must come from a CSPRNG — Math.random() is predictable from a few
// outputs and every password in this module would inherit that weakness.
function _rand(n) {
  const out = new Uint32Array(n);
  (window.crypto || window.msCrypto).getRandomValues(out);
  return out;
}
function genPassword() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ", b = "abcdefghijkmnopqrstuvwxyz", c = "23456789", d = "@#$%&*";
  const pick = (s, n) => { const r = _rand(n); return Array.from({ length: n }, (_, i) => s[r[i] % s.length]).join(""); };
  const raw = (pick(a, 2) + pick(b, 5) + pick(c, 3) + pick(d, 1)).split("");
  const r = _rand(raw.length);
  for (let i = raw.length - 1; i > 0; i--) { const j = r[i] % (i + 1); [raw[i], raw[j]] = [raw[j], raw[i]]; }
  return raw.join("");
}
const copyText = (t) => {
  try { navigator.clipboard.writeText(t); frappe.show_alert({ message: "Copied", indicator: "green" }); }
  catch (e) { frappe.msgprint("Copy manually: " + t); }
};

window.AddLoginModal = function AddLoginModal({ open, onClose, onSaved }) {
  const data = window.CRM_DATA;
  const init = () => ({ full_name: "", email: "", role: "Realty Sales Executive", sales_owner: "", password: genPassword() });
  const [form, setForm] = useStateF(init);
  const [busy, setBusy] = useStateF(false);
  const [done, setDone] = useStateF(null);
  useEffectF(() => { if (open) { setForm(init()); setBusy(false); setDone(null); } }, [open]);
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  if (!open) return null;
  const save = async () => {
    if (!form.full_name.trim()) { frappe.msgprint("Full name is required."); return; }
    if (!form.email.trim() || form.email.indexOf("@") < 0) { frappe.msgprint("A valid email is required — it becomes the login id."); return; }
    if ((form.password || "").length < 10) { frappe.msgprint("Password must be at least 10 characters."); return; }
    setBusy(true);
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm.create_crm_user", args: { payload: form } });
      setDone({ email: form.email.trim().toLowerCase(), password: form.password });
      onSaved && await onSaved();
    } catch (e) { frappe.msgprint(e.message || "Could not create the login"); setBusy(false); }
  };
  if (done) {
    return (
      <Modal open={open} onClose={onClose} eyebrow="LOGIN CREATED" title="Share these credentials"
        subtitle="Shown once. Copy them now and send to the person securely." width={560}
        footer={<Btn variant="accent" size="sm" icon="check" onClick={onClose}>Done</Btn>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[["Sign-in page", "https://erp.jewonline.in/app/realty-crm"], ["Login id", done.email], ["Temporary password", done.password]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--hairline)", borderRadius: 8, background: "var(--neutral-50)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="dux-eyebrow" style={{ fontSize: 9 }}>{k}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, wordBreak: "break-all" }}>{v}</div>
              </div>
              <Btn variant="soft" size="sm" onClick={() => copyText(v)}>Copy</Btn>
            </div>
          ))}
          <div style={{ fontSize: 12, color: "var(--neutral-600)" }}>Ask them to change the password after their first sign-in.</div>
        </div>
      </Modal>
    );
  }
  return (
    <Modal open={open} onClose={onClose} eyebrow="USERS & ACCESS" title="Add a login"
      subtitle="Creates an ERPNext login for this person and registers it with the CRM." width={620}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon="check" onClick={save}>{busy ? "Creating…" : "Create login"}</Btn>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Full name" required span={2}><Input autoFocus placeholder="e.g. Aniruddha Mahakulkar" value={form.full_name} onChange={(e) => u("full_name", e.target.value)} /></Field>
        <Field label="Email (login id)" required span={2}><Input type="email" placeholder="name@shradharealty.in" value={form.email} onChange={(e) => u("email", e.target.value)} /></Field>
        <Field label="Access level" span={2}>
          <Select value={form.role} onChange={(e) => u("role", e.target.value)}>
            {LOGIN_ROLE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Link to sales rep" span={2} hint="So their holds and leads are attributed to them">
          <Select value={form.sales_owner} onChange={(e) => u("sales_owner", e.target.value)}>
            <option value="">— none —</option>
            {(data.owners || []).map(o => <option key={o.id} value={o.name}>{o.name} · {o.role}</option>)}
          </Select>
        </Field>
        <Field label="Temporary password" span={2} hint="Minimum 10 characters. They should change it after signing in.">
          <div style={{ display: "flex", gap: 8 }}>
            <Input value={form.password} onChange={(e) => u("password", e.target.value)} style={{ fontFamily: "var(--font-mono)" }} />
            <Btn variant="soft" size="sm" onClick={() => u("password", genPassword())}>Regenerate</Btn>
          </div>
        </Field>
      </div>
    </Modal>
  );
};

window.SetPasswordModal = function SetPasswordModal({ user, onClose, onSaved }) {
  const [pwd, setPwd] = useStateF("");
  const [busy, setBusy] = useStateF(false);
  const [done, setDone] = useStateF(false);
  useEffectF(() => { if (user) { setPwd(genPassword()); setBusy(false); setDone(false); } }, [user]);
  if (!user) return null;
  const save = async () => {
    if ((pwd || "").length < 10) { frappe.msgprint("Password must be at least 10 characters."); return; }
    setBusy(true);
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm.set_crm_user_password", args: { email: user.email, password: pwd } });
      setDone(true);
      onSaved && await onSaved();
    } catch (e) { frappe.msgprint(e.message || "Could not set the password"); setBusy(false); }
  };
  return (
    <Modal open={!!user} onClose={onClose} eyebrow="RESET PASSWORD" title={"Set a password for " + user.name}
      subtitle={user.email} width={520}
      footer={done
        ? <Btn variant="accent" size="sm" icon="check" onClick={onClose}>Done</Btn>
        : <><Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
            <Btn variant="accent" size="sm" icon="check" onClick={save}>{busy ? "Saving…" : "Set password"}</Btn></>}>
      {done ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px solid var(--hairline)", borderRadius: 8, background: "var(--neutral-50)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dux-eyebrow" style={{ fontSize: 9 }}>New password — copy it now</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>{pwd}</div>
          </div>
          <Btn variant="soft" size="sm" onClick={() => copyText(pwd)}>Copy</Btn>
        </div>
      ) : (
        <Field label="New password" hint="Minimum 10 characters. Share it securely; they should change it after signing in.">
          <div style={{ display: "flex", gap: 8 }}>
            <Input value={pwd} onChange={(e) => setPwd(e.target.value)} style={{ fontFamily: "var(--font-mono)" }} />
            <Btn variant="soft" size="sm" onClick={() => setPwd(genPassword())}>Regenerate</Btn>
          </div>
        </Field>
      )}
    </Modal>
  );
};

// ---------- Change my own password (self-service) ----------
window.ChangePasswordModal = function ChangePasswordModal({ open, onClose }) {
  const [cur, setCur] = useStateF("");
  const [nw, setNw] = useStateF("");
  const [cf, setCf] = useStateF("");
  const [busy, setBusy] = useStateF(false);
  const [done, setDone] = useStateF(false);
  useEffectF(() => { if (open) { setCur(""); setNw(""); setCf(""); setBusy(false); setDone(false); } }, [open]);
  if (!open) return null;
  const save = async () => {
    if (!cur) { frappe.msgprint("Enter your current password."); return; }
    if ((nw || "").length < 10) { frappe.msgprint("New password must be at least 10 characters."); return; }
    if (nw !== cf) { frappe.msgprint("The two new-password entries do not match."); return; }
    setBusy(true);
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm.change_my_password",
        args: { current_password: cur, new_password: nw } });
      setDone(true);
      setCur(""); setNw(""); setCf("");
    } catch (e) { frappe.msgprint(e.message || "Could not change the password"); setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} eyebrow="MY ACCOUNT" title="Change your password"
      subtitle={((window.CRM_DATA && window.CRM_DATA.currentUser && window.CRM_DATA.currentUser.name) || "") + " · signed in"}
      width={520}
      footer={done
        ? <Btn variant="accent" size="sm" icon="check" onClick={onClose}>Done</Btn>
        : <><Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
            <Btn variant="accent" size="sm" icon="check" onClick={save}>{busy ? "Saving…" : "Change password"}</Btn></>}>
      {done ? (
        <div style={{ padding: 14, border: "1px solid var(--success)", background: "var(--success-bg)", borderRadius: 10, fontSize: 13, color: "var(--success)" }}>
          Your password has been changed. You stay signed in here; any other devices have been signed out.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Current password" required>
            <Input type="password" autoFocus value={cur} onChange={(e) => setCur(e.target.value)} />
          </Field>
          <Field label="New password" required hint="At least 10 characters. Use a mix of letters, numbers and a symbol.">
            <Input type="password" value={nw} onChange={(e) => setNw(e.target.value)} />
          </Field>
          <Field label="Confirm new password" required error={cf && nw !== cf ? "Does not match" : null}>
            <Input type="password" value={cf} onChange={(e) => setCf(e.target.value)} />
          </Field>
        </div>
      )}
    </Modal>
  );
};

// ---------- Hold / Reserve request modal (inventory) ----------
window.HoldRequestModal = function HoldRequestModal({ open, onClose, unit, initialKind, onSaved }) {
  const data = window.CRM_DATA;
  const [kind, setKind] = useStateF(initialKind || "Hold");
  const [mode, setMode] = useStateF("lead");   // lead | outside
  const [lead, setLead] = useStateF("");
  const [contactName, setContactName] = useStateF("");
  const [contactPhone, setContactPhone] = useStateF("");
  const [requestedBy, setRequestedBy] = useStateF("");
  const [note, setNote] = useStateF("");
  const [busy, setBusy] = useStateF(false);
  useEffectF(() => {
    if (open) {
      setKind(initialKind || "Hold"); setMode("lead"); setLead(""); setContactName("");
      setContactPhone(""); setNote(""); setBusy(false);
      setRequestedBy((data.currentUser && data.currentUser.name) || ((data.owners || [])[0] || {}).name || "");
    }
  }, [open, initialKind]);
  if (!open || !unit) return null;
  const code = (unit.id || "").split("-")[0];
  const save = async () => {
    if (mode === "lead" && !lead) { frappe.msgprint("Pick a lead, or switch to an outside enquiry."); return; }
    if (mode === "outside" && !contactName.trim()) { frappe.msgprint("Enter the outside contact name."); return; }
    setBusy(true);
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm.request_hold", args: {
        unit_id: unit.id, kind,
        lead: mode === "lead" ? lead : null,
        contact_name: mode === "outside" ? contactName : null,
        contact_phone: mode === "outside" ? contactPhone : null,
        requested_by: requestedBy, note,
      } });
      frappe.show_alert({ message: kind + " requested for " + unit.id + " — pending approval", indicator: "blue" });
      onSaved && await onSaved();
      onClose();
    } catch (e) { frappe.msgprint(e.message || "Could not submit the request"); setBusy(false); }
  };
  const Toggle = ({ options, value, onChange }) => (
    <div style={{ display: "inline-flex", padding: 3, background: "var(--neutral-100)", borderRadius: 8, gap: 2 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          padding: "7px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
          fontFamily: "var(--font-display)", background: value === o.value ? "var(--bg)" : "transparent",
          color: value === o.value ? "var(--neutral-800)" : "var(--neutral-600)",
          boxShadow: value === o.value ? "var(--shadow-xs)" : "none",
        }}>{o.label}</button>
      ))}
    </div>
  );
  return (
    <Modal open={open} onClose={onClose} eyebrow="REQUEST" title={"Request " + kind.toLowerCase() + " · " + (unit.tower + "-" + unit.num)}
      subtitle={"Goes to a manager for approval. " + code + " · " + (unit.typology || "")} width={600}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon="check" onClick={save}>{busy ? "Submitting…" : "Submit request"}</Btn>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="What are you requesting?">
          <Toggle value={kind} onChange={setKind} options={[{ value: "Hold", label: "Hold" }, { value: "Reserve", label: "Reserve" }]} />
        </Field>
        <Field label="For" hint="Link a CRM lead, or capture an outside enquiry that isn’t a lead yet">
          <Toggle value={mode} onChange={setMode} options={[{ value: "lead", label: "Existing lead" }, { value: "outside", label: "Outside enquiry" }]} />
        </Field>
        {mode === "lead" ? (
          <Field label="Lead">
            <LeadPicker value={lead} onChange={setLead} defaultProject={unit.project} />
          </Field>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Contact name" required><Input autoFocus placeholder="e.g. Walk-in — Mr. Shah" value={contactName} onChange={(e) => setContactName(e.target.value)} /></Field>
            <Field label="Contact phone"><Input placeholder="+91…" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></Field>
          </div>
        )}
        <Field label="Requested by" hint="Defaults to you; a manager can file on behalf of a rep">
          <Select value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)}>
            {(data.owners || []).map(o => <option key={o.id} value={o.name}>{o.name}{o.role ? " · " + o.role : ""}</option>)}
          </Select>
        </Field>
        <Field label="Note" hint="Optional — context for the approver / next person">
          <Textarea rows={2} placeholder="Why this hold, until when, etc." value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
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
    lead: "", notes: "",
  });
  const [form, setForm] = useStateF(init);
  // lead-picker filters (only used when no lead is pre-linked, e.g. from My Day)
  const [leadQuery, setLeadQuery] = useStateF("");
  const [leadProject, setLeadProject] = useStateF("all");
  useEffectF(() => { if (open) { setForm(init()); setLeadQuery(""); setLeadProject("all"); } }, [open, defaultDate, defaultOwner]);
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.title.trim()) { frappe.msgprint("Task title is required."); return; }
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm.create_task", args: { payload: { ...form, lead: lead ? lead.id : (form.lead || null) } } });
      frappe.show_alert({ message: "Task created", indicator: "green" });
      onSaved && await onSaved();
      onClose();
    } catch (e) { frappe.msgprint(e.message || "Could not create task"); }
  };
  if (!open) return null;
  const PRI = [["low", "Low"], ["med", "Medium"], ["high", "High"]];
  // selected linked lead (when picking from My Day) + the filtered candidate list
  const pickedLead = (!lead && form.lead) ? (data.leads || []).find(l => l.id === form.lead) : null;
  const leadMatches = (!lead && !form.lead) ? (data.leads || []).filter(l => {
    if (leadProject !== "all" && l.project !== leadProject) return false;
    const q = leadQuery.trim().toLowerCase();
    if (q && !`${l.name} ${l.id} ${l.phone || ""} ${l.projectName || ""}`.toLowerCase().includes(q)) return false;
    return true;
  }).slice(0, 6) : [];
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
            {!lead && (
              <Field label="Link to a lead" span={2} hint="Optional — connects this task to a lead so it also appears on the lead’s Tasks tab">
                {pickedLead ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--hairline)", borderRadius: 8, background: "var(--neutral-50)" }}>
                    <Avatar name={pickedLead.name} initials={pickedLead.initials} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{pickedLead.name}</div>
                      <div style={{ fontSize: 11, color: "var(--neutral-400)", fontFamily: "var(--font-mono)" }}>{pickedLead.id} · {pickedLead.projectName || "—"}</div>
                    </div>
                    <button onClick={() => u("lead", "")} title="Unlink" style={{ ...iconBtn, width: 28, height: 28 }}><Icon name="x" size={14} /></button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Select value={leadProject} onChange={(e) => setLeadProject(e.target.value)} style={{ flex: "0 0 40%" }}>
                        <option value="all">All projects</option>
                        {(data.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                      <Input placeholder="Search name, phone, ID…" value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <div style={{ marginTop: 8, maxHeight: 168, overflowY: "auto", border: "1px solid var(--hairline)", borderRadius: 8 }}>
                      {leadMatches.length === 0 && <div style={{ padding: "12px 12px", fontSize: 12, color: "var(--neutral-400)" }}>No leads match — adjust the project or search.</div>}
                      {leadMatches.map(l => (
                        <button key={l.id} onClick={() => u("lead", l.id)} style={{
                          display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px",
                          border: 0, borderBottom: "1px solid var(--hairline)", background: "transparent",
                          cursor: "pointer", textAlign: "left",
                        }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--neutral-50)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          <Avatar name={l.name} initials={l.initials} size={26} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--neutral-800)" }}>{l.name}</div>
                            <div style={{ fontSize: 11, color: "var(--neutral-400)", fontFamily: "var(--font-mono)" }}>{l.id} · {l.projectName || "—"}{l.phone ? " · " + l.phone : ""}</div>
                          </div>
                          <StageBadge stage={l.stage} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Field>
            )}
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

// ---------- DMS: multipart upload helper (fetch + CSRF; frappe.call is JSON-only) ----------
window.__uploadDocument = async (file, { title, project, unit, lead, booking, category, tags, shareable }) => {
  if (!frappe.csrf_token) { frappe.msgprint("Session expired — please reload the page."); return null; }
  const fd = new FormData();
  fd.append("file", file);
  if (title) fd.append("title", title);
  fd.append("project", project || "");
  if (unit) fd.append("unit", unit);
  if (lead) fd.append("lead", lead);
  if (booking) fd.append("booking", booking);
  fd.append("category", category || "Other");
  fd.append("tags", tags || "");
  fd.append("shareable", shareable ? 1 : 0);
  let res;
  try {
    res = await fetch("/api/method/dux_crm_realty.api.crm.upload_document",
      { method: "POST", headers: { "X-Frappe-CSRF-Token": frappe.csrf_token }, body: fd });
  } catch (e) { frappe.msgprint("Upload failed — network error."); return null; }
  if (!res.ok) {
    let msg = "Upload failed (" + res.status + ")";
    try {
      const j = await res.json();
      const sm = j._server_messages && JSON.parse(j._server_messages)[0];
      if (sm) msg = JSON.parse(sm).message || msg;
    } catch (e) {}
    frappe.msgprint(msg); return null;
  }
  frappe.show_alert({ message: "Document uploaded", indicator: "green" });
  if (window.__refreshCRM) await window.__refreshCRM();
  return await res.json();
};

// ---------- DMS: upload-document modal (scope can be pre-filled by the caller) ----------
window.UploadDocumentModal = function UploadDocumentModal({ open, onClose, onSaved,
    project: lockProject, lead: lockLead, unit, booking }) {
  const data = window.CRM_DATA;
  const cats = data.docCategories || ["Other"];
  const init = () => ({ title: "", category: "Brochure", tags: "", shareable: false,
    project: lockProject || (data.projects && data.projects[0] && data.projects[0].id) || "", lead: lockLead || "" });
  const [form, setForm] = useStateF(init);
  const [file, setFile] = useStateF(null);
  const [busy, setBusy] = useStateF(false);
  const fileRef = useRefF(null);
  useEffectF(() => { if (open) { setForm(init()); setFile(null); setBusy(false); } }, [open, lockProject, lockLead]);
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  if (!open) return null;
  const save = async () => {
    if (!file) { frappe.msgprint("Choose a file to upload."); return; }
    if (!form.project) { frappe.msgprint("Pick a project."); return; }
    setBusy(true);
    const r = await window.__uploadDocument(file, {
      title: form.title.trim() || file.name, project: form.project,
      unit: unit || null, lead: form.lead || null, booking: booking || null,
      category: form.category, tags: form.tags, shareable: form.shareable });
    setBusy(false);
    if (r) { onSaved && await onSaved(r.message || r); onClose(); }
  };
  const proj = (data.projects || []).find(p => p.id === form.project);
  return (
    <Modal open={open} onClose={onClose} eyebrow="ADD DOCUMENT" title="Upload a document"
      subtitle={lockProject && proj ? ("To " + proj.name) : "Store a document against a project (and optionally a unit / lead / booking)."}
      width={640}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon="upload" onClick={save}>{busy ? "Uploading…" : "Upload"}</Btn>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* NOT wrapped in <Field> — Field renders a <label>, and a <label> containing a file
            input natively forwards clicks to it; combined with the explicit .click() that double-
            fires the OS picker (opens, then reopens without attaching). Use a plain block instead. */}
        <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--neutral-600)" }}>
            File<span style={{ color: "var(--dux-amber-600)" }}> *</span>
          </span>
          <div onClick={() => fileRef.current && fileRef.current.click()}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer",
              border: "1px dashed " + (file ? "var(--dux-amber)" : "var(--hairline)"), borderRadius: 10,
              background: file ? "var(--dux-amber-100)" : "var(--neutral-50)" }}>
            <Icon name={file ? "file" : "upload"} size={18} style={{ color: file ? "var(--dux-amber-600)" : "var(--neutral-400)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--neutral-800)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file ? file.name : "Click to choose a file"}</div>
              <div style={{ fontSize: 11, color: "var(--neutral-400)" }}>{file ? (Math.max(1, Math.round(file.size / 1024)) + " KB") : "PDF, image, Office docs · max 25 MB"}</div>
            </div>
            {file && <button onClick={(e) => { e.stopPropagation(); setFile(null); }} title="Remove" style={{ ...iconBtn, width: 28, height: 28 }}><Icon name="x" size={14} /></button>}
          </div>
          <input ref={fileRef} type="file" style={{ display: "none" }}
            onChange={(e) => { const fl = e.target.files && e.target.files[0]; if (fl) { setFile(fl); if (!form.title) u("title", fl.name.replace(/\.[^.]+$/, "")); } }} />
        </div>
        <Field label="Title" span={2}><Input placeholder="e.g. Tower B cost sheet v3" value={form.title} onChange={(e) => u("title", e.target.value)} /></Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => u("category", e.target.value)}>{cats.map(c => <option key={c}>{c}</option>)}</Select>
        </Field>
        <Field label="Project" required>
          {lockProject ? (
            <Input value={proj ? proj.name : form.project} readOnly style={{ background: "var(--neutral-50)" }} />
          ) : (
            <Select value={form.project} onChange={(e) => u("project", e.target.value)}>
              {(data.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Tags" span={2} hint="Comma-separated — e.g. legal, rera, tower-b">
          <Input placeholder="legal, brochure, tower-b" value={form.tags} onChange={(e) => u("tags", e.target.value)} />
        </Field>
        {!lockLead && (
          <Field label="Link to a lead" span={2} hint="Optional — shows the doc on that lead's Documents tab">
            <LeadPicker value={form.lead} onChange={(v) => u("lead", v)} defaultProject={form.project} />
          </Field>
        )}
        <div style={{ gridColumn: "span 2", padding: 14, border: "1px solid var(--hairline)", borderRadius: 10, background: "var(--neutral-50)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <button onClick={(e) => { e.preventDefault(); u("shareable", !form.shareable); }} style={{
              width: 18, height: 18, borderRadius: 5, cursor: "pointer", flexShrink: 0,
              border: "1.5px solid " + (form.shareable ? "var(--dux-navy)" : "var(--neutral-300)"),
              background: form.shareable ? "var(--dux-navy)" : "transparent",
              color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>{form.shareable && <Icon name="check" size={12} />}</button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Mark as shareable</span>
          </label>
          <div style={{ fontSize: 11, color: "var(--neutral-500)", marginTop: 8, display: "flex", gap: 6, alignItems: "flex-start" }}>
            <Icon name="shield" size={13} style={{ marginTop: 1, color: "var(--dux-amber-600)" }} />
            <span>Shareable docs can be sent to a lead via a link — but every share still needs a manager's approval before it goes out.</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ---------- DMS: request-share modal (DMS page — lead not fixed, uses LeadPicker) ----------
window.RequestShareModal = function RequestShareModal({ open, onClose, doc, onSaved }) {
  const [lead, setLead] = useStateF("");
  const [channel, setChannel] = useStateF("Link");
  const [note, setNote] = useStateF("");
  const [busy, setBusy] = useStateF(false);
  useEffectF(() => { if (open) { setLead(""); setChannel("Link"); setNote(""); setBusy(false); } }, [open, doc]);
  if (!open || !doc) return null;
  const save = async () => {
    if (!lead) { frappe.msgprint("Pick a lead to share with."); return; }
    setBusy(true);
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm.request_share",
        args: { document: doc.id, lead, note, channel } });
      frappe.show_alert({ message: "Share requested — pending manager approval", indicator: "blue" });
      if (window.__refreshCRM) await window.__refreshCRM();
      onSaved && await onSaved(); onClose();
    } catch (e) { frappe.msgprint(e.message || "Could not request share"); setBusy(false); }
  };
  const ChannelToggle = () => (
    <div style={{ display: "inline-flex", padding: 3, background: "var(--neutral-100)", borderRadius: 8, gap: 2 }}>
      {[{ value: "Link", label: "Share a link" }, { value: "Comms", label: "Log in lead's comms" }].map(o => (
        <button key={o.value} onClick={() => setChannel(o.value)} style={{
          padding: "7px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
          fontFamily: "var(--font-display)", background: channel === o.value ? "var(--bg)" : "transparent",
          color: channel === o.value ? "var(--neutral-800)" : "var(--neutral-600)",
          boxShadow: channel === o.value ? "var(--shadow-xs)" : "none",
        }}>{o.label}</button>
      ))}
    </div>
  );
  return (
    <Modal open={open} onClose={onClose} eyebrow="REQUEST SHARE" title={"Share “" + doc.title + "”"}
      subtitle="Goes to a manager for approval. The link only goes live once approved." width={580}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon="check" onClick={save}>{busy ? "Submitting…" : "Request share"}</Btn>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Share with (lead)"><LeadPicker value={lead} onChange={setLead} defaultProject={doc.project} /></Field>
        <Field label="How" hint="A link is generated on approval; 'comms' also logs it on the lead's activity"><ChannelToggle /></Field>
        <Field label="Note" hint="Optional — context for the approver"><Textarea rows={2} placeholder="Why share this, etc." value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
};

// ---------- DMS: edit-document modal (rename, category, tags, shareable toggle, delete) ----------
window.EditDocumentModal = function EditDocumentModal({ open, onClose, doc, onSaved }) {
  const data = window.CRM_DATA;
  const isManager = !!(data.currentUser && data.currentUser.isManager);
  const cats = data.docCategories || ["Other"];
  const [form, setForm] = useStateF({ title: "", category: "Other", tags: "", shareable: false });
  const [busy, setBusy] = useStateF(false);
  useEffectF(() => {
    if (open && doc) setForm({ title: doc.title || "", category: doc.category || "Other",
      tags: (doc.tags || []).join(", "), shareable: !!doc.shareable });
  }, [open, doc]);
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  if (!open || !doc) return null;
  const liveShares = (doc.shares || []).filter(s => s.status === "Approved" || s.status === "Requested").length;
  const finish = async () => { if (window.__refreshCRM) await window.__refreshCRM(); onSaved && await onSaved(); onClose(); };
  const save = async () => {
    if (!form.title.trim()) { frappe.msgprint("Title can't be empty."); return; }
    setBusy(true);
    try {
      await frappe.call({ method: "dux_crm_realty.api.crm.update_document", args: {
        document: doc.id, title: form.title.trim(), category: form.category,
        tags: form.tags, shareable: form.shareable ? 1 : 0 } });
      frappe.show_alert({ message: "Document updated", indicator: "green" });
      await finish();
    } catch (e) { frappe.msgprint(e.message || "Could not update document"); setBusy(false); }
  };
  const del = () => {
    frappe.confirm(
      `Delete <b>${frappe.utils ? frappe.utils.escape_html(doc.title) : doc.title}</b>? This permanently removes the file and any share links.`,
      async () => {
        try {
          await frappe.call({ method: "dux_crm_realty.api.crm.delete_document", args: { document: doc.id } });
          frappe.show_alert({ message: "Document deleted", indicator: "orange" });
          await finish();
        } catch (e) { frappe.msgprint(e.message || "Could not delete document"); }
      });
  };
  return (
    <Modal open={open} onClose={onClose} eyebrow="EDIT DOCUMENT" title="Edit document"
      subtitle={doc.fileName || doc.id} width={600}
      footer={<>
        {isManager && <Btn variant="ghost" size="sm" icon="x" onClick={del} style={{ color: "var(--error)", marginRight: "auto" }}>Delete</Btn>}
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon="check" onClick={save}>{busy ? "Saving…" : "Save changes"}</Btn>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Title" required span={2} hint="This is the display name (also the downloaded file name)">
          <Input autoFocus value={form.title} onChange={(e) => u("title", e.target.value)} />
        </Field>
        <Field label="Category"><Select value={form.category} onChange={(e) => u("category", e.target.value)}>{cats.map(c => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Tags" hint="Comma-separated"><Input value={form.tags} onChange={(e) => u("tags", e.target.value)} /></Field>
        <div style={{ gridColumn: "span 2", padding: 14, border: "1px solid var(--hairline)", borderRadius: 10, background: "var(--neutral-50)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <button onClick={(e) => { e.preventDefault(); u("shareable", !form.shareable); }} style={{
              width: 18, height: 18, borderRadius: 5, cursor: "pointer", flexShrink: 0,
              border: "1.5px solid " + (form.shareable ? "var(--dux-navy)" : "var(--neutral-300)"),
              background: form.shareable ? "var(--dux-navy)" : "transparent",
              color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>{form.shareable && <Icon name="check" size={12} />}</button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Shareable</span>
          </label>
          <div style={{ fontSize: 11, color: "var(--neutral-500)", marginTop: 8, display: "flex", gap: 6, alignItems: "flex-start" }}>
            <Icon name="shield" size={13} style={{ marginTop: 1, color: "var(--dux-amber-600)" }} />
            <span>{form.shareable
              ? "Can be shared with leads — each share still needs a manager's approval before it goes out."
              : (doc.shareable && liveShares
                  ? "Turning this off will REVOKE its live share link(s) (manager only)."
                  : "Turn on to allow sharing this document with a lead.")}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
