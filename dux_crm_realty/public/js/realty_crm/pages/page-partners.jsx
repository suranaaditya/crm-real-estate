import React from "react";
/* Channel Partners — broker management. Uses CRM_DATA.channelPartners shape. */

window.PagePartners = function PagePartners() {
  const data = window.CRM_DATA;
  const tierTone = {
    Platinum: { bg: "linear-gradient(135deg, #5E437F, #8564A8)", fg: "#fff" },
    Gold:     { bg: "linear-gradient(135deg, #C68B4E, #E8A95B)", fg: "#fff" },
    Silver:   { bg: "var(--neutral-100)", fg: "var(--neutral-600)" },
  };

  const [q, setQ] = React.useState("");
  const [tierF, setTierF] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [leadsOf, setLeadsOf] = React.useState(null);     // partner whose leads are listed
  const [openLead, setOpenLead] = React.useState(null);

  const all = data.channelPartners || [];
  // the search box and tier filter used to be inert inputs
  const needle = q.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const partners = all.filter(p =>
    (!tierF || p.tier === tierF) &&
    (!needle || [p.name, p.contact, p.email, p.rera].some(v => (v || "").toLowerCase().includes(needle))
      || (digits.length >= 3 && String(p.phone || "").replace(/\D/g, "").includes(digits))));
  const totalLeads      = partners.reduce((a, p) => a + (p.totalLeads || 0), 0);
  const totalBookings   = partners.reduce((a, p) => a + (p.bookings || 0), 0);
  const totalCommission = partners.reduce((a, p) => a + (p.commission || 0), 0);
  const totalOutstanding= partners.reduce((a, p) => a + (p.outstanding || 0), 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--hairline)", background: "var(--bg)", display: "flex", gap: 14, alignItems: "center" }}>
        <input placeholder="Search name, contact, phone…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320, flex: 1, padding: "8px 12px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 13, fontFamily: "var(--font-body)" }} />
        <select value={tierF} onChange={(e) => setTierF(e.target.value)} style={{ width: 160, padding: "8px 12px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 13 }}>
          <option value="">All tiers</option><option>Platinum</option><option>Gold</option><option>Silver</option>
        </select>
        {(needle || tierF) && <span style={{ fontSize: 12, color: "var(--neutral-600)" }}>{partners.length} of {all.length}</span>}
        <div style={{ flex: 1 }} />
        <Btn variant="accent" size="sm" icon="plus" onClick={() => setAddOpen(true)}>Onboard partner</Btn>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
          <StatCard label="ACTIVE PARTNERS" value={all.length} icon="users" />
          <StatCard label="TOTAL LEADS" value={totalLeads} icon="chart" />
          <StatCard label="BOOKINGS" value={totalBookings} icon="check" />
          <StatCard label="PAYOUTS DUE" value={fmtINR(totalOutstanding)} deltaTone="down" delta={"of " + fmtINR(totalCommission)} icon="rupee" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {partners.map(p => {
            const tier = tierTone[p.tier] || tierTone.Silver;
            return (
              <div key={p.id} style={{
                background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, padding: 20,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 10,
                      background: "var(--dux-navy)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700,
                    }}>{String(p.name || "?").split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2)}</div>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 2 }}>{[p.contact, p.phone].filter(Boolean).join(" · ") || "No contact details"}</div>
                      <div style={{ fontSize: 10, color: "var(--neutral-400)", marginTop: 2, fontFamily: "var(--font-mono)" }}>{p.rera}</div>
                    </div>
                  </div>
                  {p.tier && <span style={{
                    padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    background: tier.bg, color: tier.fg,
                  }}>{p.tier}</span>}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: "14px 0", borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }}>
                  <KVStat label="LEADS" value={p.totalLeads} />
                  <KVStat label="BOOKINGS" value={p.bookings} />
                  <KVStat label="COMMISSION" value={fmtINR(p.commission)} mono />
                  <KVStat label="EMAIL" value={p.email || "—"} small />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                  <div>
                    <div className="dux-eyebrow" style={{ fontSize: 9 }}>OUTSTANDING PAYOUT</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: p.outstanding > 0 ? "var(--dux-amber-600)" : "var(--neutral-400)", marginTop: 2 }}>
                      {fmtINR(p.outstanding)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn variant="ghost" size="sm" onClick={() => setLeadsOf(p)}>View leads</Btn>
                    <Btn variant="outline" size="sm" onClick={async () => {
                      if (!p.outstanding) { frappe.show_alert("No outstanding payout for " + esc(p.name)); return; }
                      try {
                        const r = await frappe.call({ method: "dux_crm_realty.api.crm.process_payout", args: { partner: p.id } });
                        frappe.show_alert({ message: "Cleared " + fmtINR(r.message.cleared) + " to " + esc(p.name), indicator: "green" });
                        if (window.__refreshCRM) await window.__refreshCRM();
                      } catch (e) { frappe.msgprint(e.message || "Could not process payout"); }
                    }}>Process payout</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {partners.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--neutral-400)", fontSize: 13 }}>
            {all.length ? "No partner matches your search." : "No channel partners yet."}
          </div>
        )}
      </div>
      <AddPartnerModal open={addOpen} onClose={() => setAddOpen(false)} />
      <PartnerLeadsModal partner={leadsOf} onClose={() => setLeadsOf(null)} onOpenLead={(l) => { setLeadsOf(null); setOpenLead(l); }} />
      {openLead && <LeadDetail key={openLead.id} lead={openLead} onClose={() => setOpenLead(null)} />}
    </div>
  );
};

// "Onboard partner" was an inert button. Same endpoint the New Lead form's
// "Add a new partner" uses.
function AddPartnerModal({ open, onClose }) {
  const blank = { name: "", contact: "", phone: "", email: "", rera: "", tier: "" };
  const [form, setForm] = React.useState(blank);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (open) { setForm(blank); setBusy(false); } }, [open]);
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.name.trim()) { frappe.show_alert({ message: "Enter the partner's name", indicator: "orange" }); return; }
    setBusy(true);
    try {
      const r = await frappe.call({ method: "dux_crm_realty.api.crm.create_channel_partner", args: { payload: form } });
      const filled = (r.message.filled || []).map(k => ({ contact_person: "contact", phone: "phone", email: "email", rera: "RERA", tier: "tier" }[k] || k));
      frappe.show_alert({ message: r.message.existing
        ? "Already onboarded: " + esc(r.message.partner.name) + (filled.length ? " — added " + filled.join(", ") : " (nothing new to add)")
        : "Partner added: " + esc(r.message.partner.name), indicator: "green" });
      if (window.__refreshCRM) await window.__refreshCRM();
      onClose();
    } catch (e) { /* frappe.call already showed the server's message */ }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={() => !busy && onClose()} eyebrow="CHANNEL PARTNERS" title="Onboard a partner" width={600}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Btn>
        <Btn variant="accent" size="sm" icon="check" onClick={save} disabled={busy}>{busy ? "Saving…" : "Add partner"}</Btn>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Partner / firm name" required span={2}><Input value={form.name} onChange={(e) => u("name", e.target.value)} /></Field>
        <Field label="Contact person"><Input value={form.contact} onChange={(e) => u("contact", e.target.value)} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => u("phone", e.target.value)} /></Field>
        <Field label="Email"><Input value={form.email} onChange={(e) => u("email", e.target.value)} /></Field>
        <Field label="RERA no."><Input value={form.rera} onChange={(e) => u("rera", e.target.value)} /></Field>
        <Field label="Tier">
          <Select value={form.tier} onChange={(e) => u("tier", e.target.value)}>
            <option value="">— Not set —</option><option>Platinum</option><option>Gold</option><option>Silver</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

// "View leads" was inert too: list the partner's leads, click one to open it.
function PartnerLeadsModal({ partner, onClose, onOpenLead }) {
  if (!partner) return null;
  const leads = (window.CRM_DATA.leads || []).filter(l => l.channelPartner === partner.id);
  return (
    <Modal open={!!partner} onClose={onClose} eyebrow="CHANNEL PARTNER" title={partner.name}
      subtitle={leads.length + " lead" + (leads.length === 1 ? "" : "s")} width={640}>
      {leads.length === 0 && <div style={{ fontSize: 13, color: "var(--neutral-400)" }}>No leads from this partner yet.</div>}
      {leads.map(l => (
        <div key={l.id} onClick={() => onOpenLead(l)} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 4px", borderBottom: "1px solid var(--hairline)", cursor: "pointer" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</div>
            <div style={{ fontSize: 11, color: "var(--neutral-400)" }}>{[l.id, l.phone, l.projectName].filter(Boolean).join(" · ")}</div>
          </div>
          <StageBadge stage={l.stage} />
          <span style={{ fontSize: 12, color: "var(--neutral-600)", width: 110, textAlign: "right" }}>{l.ownerName || "Unassigned"}</span>
        </div>
      ))}
    </Modal>
  );
}

function KVStat({ label, value, mono, small }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="dux-eyebrow" style={{ fontSize: 9 }}>{label}</div>
      <div style={{
        fontFamily: mono ? "var(--font-mono)" : "var(--font-display)",
        fontSize: small ? 11 : (mono ? 13 : 16),
        fontWeight: 700, marginTop: 2,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{value}</div>
    </div>
  );
}
