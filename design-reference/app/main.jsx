/* App entry — Workspace (Table↔Kanban) + Mobile companion. */

const { useEffect: appUseEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "comfortable",
  "accent": "#F2A93B",
  "defaultView": "table"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  appUseEffect(() => { document.documentElement.style.setProperty("--dux-amber", tweaks.accent); }, [tweaks.accent]);

  return (
    <>
      <DesignCanvas>
        <DCSection id="overview" title="Real Estate CRM — for Shradha Realty">
          <DCArtboard id="brief" label="Brief" width={920} height={620}>
            <Brief />
          </DCArtboard>
        </DCSection>

        <DCSection id="workspace" title="Leads workspace — Table & Kanban in one view">
          <DCArtboard id="ws" label="Toggle Table ↔ Kanban from the topbar" width={1440} height={900}>
            <Workspace density={tweaks.density} defaultView={tweaks.defaultView} initial="leads" />
          </DCArtboard>
        </DCSection>

        <DCSection id="modules" title="Full app — every module wired to the sidebar">
          <DCArtboard id="dashboard" label="Dashboard · executive overview" width={1440} height={900}>
            <Workspace density={tweaks.density} defaultView={tweaks.defaultView} initial="dashboard" />
          </DCArtboard>
          <DCArtboard id="visits" label="Site Visits · calendar" width={1440} height={900}>
            <Workspace density={tweaks.density} defaultView={tweaks.defaultView} initial="visits" />
          </DCArtboard>
          <DCArtboard id="inventory" label="Inventory · tower / floor / unit grid" width={1440} height={900}>
            <Workspace density={tweaks.density} defaultView={tweaks.defaultView} initial="inventory" />
          </DCArtboard>
          <DCArtboard id="bookings" label="Bookings · cost sheet" width={1440} height={900}>
            <Workspace density={tweaks.density} defaultView={tweaks.defaultView} initial="bookings" />
          </DCArtboard>
          <DCArtboard id="payments" label="Payments · collections & schedule" width={1440} height={900}>
            <Workspace density={tweaks.density} defaultView={tweaks.defaultView} initial="payments" />
          </DCArtboard>
          <DCArtboard id="partners" label="Channel Partners" width={1440} height={900}>
            <Workspace density={tweaks.density} defaultView={tweaks.defaultView} initial="partners" />
          </DCArtboard>
          <DCArtboard id="reports" label="Reports & Analytics" width={1440} height={900}>
            <Workspace density={tweaks.density} defaultView={tweaks.defaultView} initial="reports" />
          </DCArtboard>
          <DCArtboard id="settings" label="Settings" width={1440} height={900}>
            <Workspace density={tweaks.density} defaultView={tweaks.defaultView} initial="settings" />
          </DCArtboard>
        </DCSection>

        <DCSection id="mobile" title="Mobile companion — sales executives on the field">
          <DCArtboard id="mob" label="iOS · Lead list & detail" width={420} height={874}>
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, #F7F6F2 0%, #EFEEEA 100%)" }}>
              <MobileApp />
            </div>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Density">
          <TweakRadio value={tweaks.density} onChange={(v) => setTweak("density", v)}
            options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }]} />
        </TweakSection>
        <TweakSection title="Default view">
          <TweakRadio value={tweaks.defaultView} onChange={(v) => setTweak("defaultView", v)}
            options={[{ value: "table", label: "Table" }, { value: "kanban", label: "Kanban" }]} />
        </TweakSection>
        <TweakSection title="Accent color">
          <TweakColor value={tweaks.accent} onChange={(v) => setTweak("accent", v)} />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {["#F2A93B","#E26A4A","#2F6EB5","#3A8F5A","#0F1A2E"].map(c => (
              <button key={c} onClick={() => setTweak("accent", c)} style={{
                width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
                border: tweaks.accent === c ? "2px solid var(--dux-black)" : "1px solid var(--hairline)",
              }} />
            ))}
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

function Brief() {
  return (
    <div style={{
      height: "100%", padding: 40, background: "var(--neutral-50)",
      display: "flex", flexDirection: "column", gap: 24, fontFamily: "var(--font-body)", overflowY: "auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <img src={(window.__resources && window.__resources.duxLogoTight) || "assets/dux-logo-tight.png"} alt="Dux Digitech" style={{ height: 44, width: "auto", objectFit: "contain", display: "block" }} />
        <div style={{ flex: 1 }} />
        <span className="dux-eyebrow" style={{ fontSize: 10 }}>INTERNAL DESIGN BRIEF · v0.2</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 28, alignItems: "center" }}>
        <div>
          <div className="dux-eyebrow" style={{ fontSize: 11, marginBottom: 10 }}>FOR SHRADHA REALTY · ABHIMAN NIWAS, NAGPUR</div>
          <h1 className="dux-h1" style={{ fontSize: 38, marginBottom: 14 }}>
            A custom CRM for real estate, built around how the sales floor actually works.
          </h1>
          <p style={{ fontSize: 15, color: "var(--neutral-600)", lineHeight: 1.7 }}>
            One Leads workspace, two ways of looking at the same data — switch from <strong>Table</strong> for
            day-to-day operations to <strong>Kanban</strong> when you need to see the pipeline at a glance.
            Frappe-compatible schema underneath: leads, projects, towers, units, bookings, payments & channel partners.
          </p>
        </div>
        <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-md)" }}>
          <img src={(window.__resources && window.__resources.abhimanFacade) || "assets/abhiman-facade.jpg"} alt="Abhiman Niwas" style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
          <div style={{ padding: "10px 14px", background: "var(--bg)", fontSize: 12 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>Abhiman Niwas</div>
            <div style={{ color: "var(--neutral-400)", fontSize: 11 }}>Hingna Road, Nagpur · 2 & 3 BHK</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <BriefCard tone="01" title="Lead capture & qualification"
          desc="Multi-source intake — website, 99acres, MagicBricks, walk-ins, channel partners — with auto-scoring and stage progression." />
        <BriefCard tone="02" title="Site visits & inventory"
          desc="Tower → floor → unit picker. Block units in real time during a visit. Cost sheets generated on the spot." />
        <BriefCard tone="03" title="Bookings, payments, partners"
          desc="From negotiation to booking to payment schedule. Channel partner payouts & RERA tracking included." />
      </div>

      <div style={{ marginTop: "auto", padding: "14px 18px", background: "var(--bg)", borderRadius: 12, border: "1px dashed var(--hairline)" }}>
        <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>WHAT TO LOOK AT FIRST</div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--neutral-600)", lineHeight: 1.8 }}>
          <li>Use the <strong>Table ↔ Kanban</strong> toggle in the workspace topbar to switch views.</li>
          <li>Click any lead (try Rajesh Khandelwal, top of the list) for the full detail drawer.</li>
          <li>Open Tweaks (top-right) for density, accent colour & default view.</li>
        </ol>
      </div>
    </div>
  );
}

function BriefCard({ tone, title, desc }) {
  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, padding: 18 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: "var(--dux-navy)",
        color: "var(--dux-amber)", display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 800, marginBottom: 12, letterSpacing: "0.04em",
      }}>{tone}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--neutral-600)", lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
