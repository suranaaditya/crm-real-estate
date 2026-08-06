import React from "react";
/* Real app root — replaces the prototype's DesignCanvas/artboard scaffolding.
   Renders the Workspace shell full-screen, owns the New-Lead modal + global
   data-refresh, and a slim floating Tweaks control (accent / density / view). */

const TWEAK_DEFAULTS = { density: "comfortable", accent: "#F2A93B", defaultView: "table" };

function useLocalTweaks() {
  const [tweaks, setTweaks] = React.useState(() => {
    try { return { ...TWEAK_DEFAULTS, ...JSON.parse(localStorage.getItem("realtyCrmTweaks") || "{}") }; }
    catch (e) { return TWEAK_DEFAULTS; }
  });
  const setTweak = (k, v) => setTweaks(t => {
    const next = { ...t, [k]: v };
    try { localStorage.setItem("realtyCrmTweaks", JSON.stringify(next)); } catch (e) {}
    return next;
  });
  return [tweaks, setTweak];
}

function TweaksControl({ tweaks, setTweak }) {
  const [open, setOpen] = React.useState(false);
  const Radio = ({ field, options }) => (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map(o => {
        const active = tweaks[field] === o.value;
        return (
          <button key={o.value} onClick={() => setTweak(field, o.value)} style={{
            flex: 1, padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
            fontFamily: "var(--font-display)", border: "1.5px solid " + (active ? "var(--dux-navy)" : "var(--hairline)"),
            background: active ? "var(--dux-navy)" : "var(--bg)", color: active ? "#fff" : "var(--neutral-800)",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
  return (
    <div style={{ position: "absolute", right: 20, bottom: 20, zIndex: 200, fontFamily: "var(--font-body)" }}>
      {open && (
        <div style={{
          position: "absolute", bottom: 52, right: 0, width: 260, padding: 16,
          background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 14,
          boxShadow: "var(--shadow-xl)", display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div className="dux-eyebrow" style={{ fontSize: 10 }}>Tweaks</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--neutral-600)" }}>DENSITY</div>
            <Radio field="density" options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }]} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--neutral-600)" }}>DEFAULT VIEW</div>
            <Radio field="defaultView" options={[{ value: "table", label: "Table" }, { value: "kanban", label: "Kanban" }]} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--neutral-600)" }}>ACCENT</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["#F2A93B", "#E26A4A", "#2F6EB5", "#3A8F5A", "#0F1A2E"].map(c => (
                <button key={c} onClick={() => setTweak("accent", c)} style={{
                  width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer",
                  border: tweaks.accent === c ? "2px solid var(--dux-black)" : "1px solid var(--hairline)",
                }} />
              ))}
            </div>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} title="Tweaks" style={{
        width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
        background: "var(--dux-navy)", color: "#fff", boxShadow: "var(--shadow-lg)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name="settings" size={20} />
      </button>
    </div>
  );
}

window.RealtyApp = function RealtyApp() {
  const [nonce, setNonce] = React.useState(0);
  const [newLeadOpen, setNewLeadOpen] = React.useState(false);
  const [pwdOpen, setPwdOpen] = React.useState(false);
  const [tweaks, setTweak] = useLocalTweaks();

  React.useEffect(() => {
    document.documentElement.style.setProperty("--dux-amber", tweaks.accent);
  }, [tweaks.accent]);

  // "/" focuses the CRM search. ⌘K is reserved by Frappe's desk (global search),
  // so we use "/" and intercept it in the capture phase — beating Frappe's own
  // keydown handler — while leaving it untouched whenever the user is typing.
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const ae = document.activeElement;
      const tag = ae && ae.tagName;
      if (ae && (ae.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")) return;
      const box = document.querySelector('input[data-crm-search="1"]');
      if (!box) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      box.focus();
      if (box.select) box.select();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  // exposed so deep buttons (New Lead) + write actions can reach the root
  window.__openNewLead = () => setNewLeadOpen(true);
  window.__openChangePassword = () => setPwdOpen(true);
  window.__refreshCRM = async () => {
    const r = await frappe.call({ method: "dux_crm_realty.api.crm.get_bootstrap" });
    window.CRM_DATA = r.message;
    setNonce(n => n + 1);
  };

  const handleSave = async (form) => {
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.create_lead", args: { payload: form } });
      frappe.show_alert({ message: __("Lead {0} created", [r.message.lead_id]), indicator: "green" });
      await window.__refreshCRM();
    } catch (e) {
      frappe.msgprint({ title: __("Could not create lead"), message: e.message || String(e), indicator: "red" });
    }
  };

  return (
    <div style={{ height: "100%", position: "relative", background: "var(--neutral-50)" }} data-nonce={nonce}>
      <Workspace density={tweaks.density} defaultView={tweaks.defaultView} initial="dashboard" />
      <NewLeadModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} onSave={handleSave} />
      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </div>
  );
};
