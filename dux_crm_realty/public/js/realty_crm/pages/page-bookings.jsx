import React from "react";
/* Bookings — list + cost sheet detail. Uses CRM_DATA.bookings shape. */

window.PageBookings = function PageBookings() {
  const data = window.CRM_DATA;
  const [selected, setSelected] = React.useState(data.bookings[0]?.id);
  const booking = data.bookings.find(b => b.id === selected);

  const stages = [
    { id: "token-received", label: "Token" },
    { id: "agreement-signed", label: "Agreement" },
    { id: "registration-pending", label: "Registration pending" },
    { id: "registered", label: "Registered" },
  ];

  const stageTone = {
    "token-received":        { bg: "var(--info-bg)", fg: "var(--info)", label: "Token" },
    "agreement-signed":      { bg: "var(--dux-amber-100)", fg: "var(--dux-amber-600)", label: "Agreement" },
    "registration-pending":  { bg: "var(--dux-coral-100)", fg: "#B5462C", label: "Reg. pending" },
    "registered":            { bg: "var(--success-bg)", fg: "var(--success)", label: "Registered" },
  };

  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "380px 1fr", overflow: "hidden" }}>
      <div style={{ borderRight: "1px solid var(--hairline)", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>Bookings</div>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--neutral-100)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
              {data.bookings.length}
            </span>
          </div>
          <input placeholder="Search by name, unit, BK code…" style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 13, fontFamily: "var(--font-body)" }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {data.bookings.map(b => {
            const active = b.id === selected;
            const tone = stageTone[b.stage] || stageTone["token-received"];
            return (
              <button key={b.id} onClick={() => setSelected(b.id)} style={{
                width: "100%", padding: "14px 20px", border: "none",
                background: active ? "var(--dux-amber-100)" : "transparent",
                borderLeft: active ? "3px solid var(--dux-amber)" : "3px solid transparent",
                borderBottom: "1px solid var(--hairline)", textAlign: "left", cursor: "pointer",
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{b.leadName}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--neutral-400)" }}>{b.id}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--neutral-600)" }}>
                  {b.project} · {b.unit} · {b.typology}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                    background: tone.bg, color: tone.fg,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>{tone.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>{fmtINR(b.bsp)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {booking && (
        <div style={{ overflow: "auto", padding: 28 }}>
          <div className="dux-eyebrow" style={{ fontSize: 10, color: "var(--dux-amber-600)" }}>BOOKING · {booking.id}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700 }}>{booking.leadName}</div>
            <div style={{ fontSize: 13, color: "var(--neutral-400)" }}>
              {booking.project} · Unit {booking.unit} · {booking.typology} · {booking.carpet} sqft
            </div>
          </div>

          <div style={{ marginTop: 24, padding: 20, background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              {stages.map((s, i) => {
                const idx = stages.findIndex(x => x.id === booking.stage);
                const status = i < idx ? "done" : i === idx ? "active" : "pending";
                return (
                  <React.Fragment key={s.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: status === "done" ? "var(--success)" : status === "active" ? "var(--dux-amber)" : "var(--neutral-100)",
                        color: status === "pending" ? "var(--neutral-400)" : "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                      }}>{status === "done" ? "✓" : i + 1}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: status === "pending" ? "var(--neutral-400)" : "var(--neutral-800)" }}>{s.label}</div>
                        <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 2 }}>
                          {status === "done" ? "Completed" : status === "active" ? "In progress" : "Pending"}
                        </div>
                      </div>
                    </div>
                    {i < stages.length - 1 && <div style={{ flex: 1, height: 2, background: i < idx ? "var(--success)" : "var(--neutral-100)", margin: "0 12px" }} />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginTop: 18 }}>
            <Panel title="Cost sheet" subtitle="ALL-IN PRICE">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  {[
                    { label: "Basic Sale Price (BSP)", v: booking.bsp },
                    { label: "Carpet area", v: booking.carpet + " sqft" },
                    { label: "Rate per sqft", v: "₹ " + Math.round(booking.bsp / booking.carpet).toLocaleString("en-IN") },
                    { label: "Other charges (PLC, parking, club)", v: booking.otherCharges },
                    { label: "GST @ 5%", v: booking.gst },
                    { label: "Token paid", v: booking.tokenAmount },
                  ].map(row => (
                    <tr key={row.label} style={{ borderBottom: "1px solid var(--hairline)" }}>
                      <td style={{ padding: "10px 0", color: "var(--neutral-600)" }}>{row.label}</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                        {typeof row.v === "number" ? fmtINR(row.v) : row.v}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ padding: "14px 0 4px", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700 }}>Total payable</td>
                    <td style={{ padding: "14px 0 4px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--dux-amber-600)" }}>
                      {fmtINR(booking.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <Btn variant="primary" size="sm" onClick={() => frappe.show_alert("Cost sheet PDF generation is a production-build step.")}>Generate cost sheet PDF</Btn>
                <Btn variant="outline" size="sm" onClick={() => frappe.show_alert("Email gateway is a production-build step.")}>Email to customer</Btn>
                {booking.stage !== "registered" && <Btn variant="accent" size="sm" icon="arrowR" onClick={async () => {
                  try {
                    const r = await frappe.call({ method: "dux_crm_realty.api.crm.advance_booking", args: { booking_id: booking.id } });
                    frappe.show_alert({ message: "Stage advanced to " + r.message.stage, indicator: "green" });
                    if (window.__refreshCRM) await window.__refreshCRM();
                  } catch (e) { frappe.msgprint(e.message || "Could not advance stage"); }
                }}>Advance stage</Btn>}
              </div>
            </Panel>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Panel title="Applicant" subtitle="PRIMARY">
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <Avatar name={booking.leadName} initials={booking.leadName.split(" ").map(w => w[0]).join("").slice(0,2)} size={44} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{booking.leadName}</div>
                    <div style={{ fontSize: 11, color: "var(--neutral-400)" }}>{[booking.leadId ? "Lead " + booking.leadId : null, "Booked " + fmtDate(booking.date)].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--neutral-600)", lineHeight: 1.6 }}>
                  Sales owner: {booking.owner}<br/>
                  Token paid: {fmtINR(booking.tokenAmount)} ({booking.tokenPaid ? "received" : "pending"})<br/>
                  Agreement: {booking.agreementSigned ? "Signed" : "Pending signature"}
                </div>
              </Panel>

              <Panel title="Documents" subtitle="STATUS">
                {[
                  { name: "Booking form",   done: true },
                  { name: "Token receipt",  done: booking.tokenPaid },
                  { name: "Agreement",      done: booking.agreementSigned },
                  { name: "Sale deed",      done: booking.stage === "registered" },
                  { name: "Possession letter", done: false },
                ].map(d => (
                  <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--hairline)", fontSize: 13 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: 4,
                        background: d.done ? "var(--success)" : "var(--neutral-100)",
                        color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
                      }}>{d.done ? "✓" : ""}</span>
                      {d.name}
                    </span>
                    <span style={{ fontSize: 11, color: d.done ? "var(--success)" : "var(--neutral-400)" }}>
                      {d.done ? "Verified" : "Pending"}
                    </span>
                  </div>
                ))}
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
