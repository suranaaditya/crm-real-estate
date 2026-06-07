/* Payments — schedule + collections. Uses CRM_DATA.paymentDues shape. */

window.PagePayments = function PagePayments() {
  const data = window.CRM_DATA;
  const [tab, setTab] = React.useState("dues");

  const dues = data.paymentDues;
  const overdue = dues.filter(d => d.status === "overdue");
  const due = dues.filter(d => d.status === "due");
  const scheduled = dues.filter(d => d.status === "scheduled");
  const paid = dues.filter(d => d.status === "paid");
  const totalCollected = paid.reduce((a, d) => a + d.amount, 0);
  const totalOutstanding = [...overdue, ...due, ...scheduled].reduce((a, d) => a + d.amount, 0);

  const statusTone = {
    overdue:   { bg: "var(--error-bg)",       fg: "var(--error)",         label: "Overdue" },
    due:       { bg: "var(--dux-amber-100)",  fg: "var(--dux-amber-600)", label: "Due" },
    scheduled: { bg: "var(--info-bg)",        fg: "var(--info)",          label: "Scheduled" },
    paid:      { bg: "var(--success-bg)",     fg: "var(--success)",       label: "Paid" },
  };

  const visible = tab === "dues" ? [...overdue, ...due, ...scheduled].slice(0, 40) : paid.slice(0, 40);

  const today = new Date("2026-04-29");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--hairline)", background: "var(--bg)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <StatCard label="COLLECTED THIS QTR" value={fmtINR(totalCollected)} delta="+18% YoY" icon="rupee" />
          <StatCard label="OUTSTANDING" value={fmtINR(totalOutstanding)} delta={(overdue.length + due.length) + " active"} icon="money" />
          <StatCard label="OVERDUE" value={fmtINR(overdue.reduce((a, d) => a + d.amount, 0))} delta={overdue.length + " accounts"} deltaTone="down" icon="x" />
          <StatCard label="DPD AVERAGE" value="14 days" delta="-3 vs Q4" icon="chart" />
        </div>
      </div>

      <div style={{ padding: "0 24px", borderBottom: "1px solid var(--hairline)", background: "var(--bg)", display: "flex", alignItems: "center" }}>
        {[
          { id: "dues", label: "Outstanding & upcoming", count: overdue.length + due.length + scheduled.length },
          { id: "paid", label: "Received", count: paid.length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "14px 18px", border: "none", background: "transparent",
            borderBottom: tab === t.id ? "2px solid var(--dux-amber)" : "2px solid transparent",
            cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? "var(--neutral-800)" : "var(--neutral-600)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {t.label}
            <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 999, background: "var(--neutral-100)", fontFamily: "var(--font-mono)" }}>{t.count}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <Btn variant="outline" size="sm" icon="file">Export</Btn>
        <Btn variant="primary" size="sm" icon="plus" style={{ marginLeft: 10 }}>Record receipt</Btn>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{ background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--neutral-50)", textAlign: "left", fontSize: 10, color: "var(--neutral-600)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Customer</th>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Unit</th>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Milestone</th>
                <th style={{ padding: "10px 16px", fontWeight: 700, textAlign: "right" }}>Amount</th>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Due date</th>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Status</th>
                <th style={{ padding: "10px 16px", fontWeight: 700, textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(d => {
                const tone = statusTone[d.status] || statusTone.scheduled;
                const dpd = d.status === "overdue" ? Math.floor((today - new Date(d.dueDate)) / 86400000) : 0;
                const initials = d.leadName.split(" ").map(w => w[0]).join("").slice(0, 2);
                return (
                  <tr key={d.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={d.leadName} initials={initials} size={28} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{d.leadName}</div>
                          <div style={{ fontSize: 11, color: "var(--neutral-400)", fontFamily: "var(--font-mono)" }}>{d.bookingId}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: 12 }}>{d.unit}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div>{d.stageName}</div>
                      <div style={{ fontSize: 10, color: "var(--neutral-400)", marginTop: 2 }}>{d.pct}% of BSP</div>
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontWeight: 700, textAlign: "right" }}>{fmtINR(d.amount)}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12 }}>
                      {fmtDate(d.dueDate)}
                      {dpd > 0 && <div style={{ fontSize: 10, color: "var(--error)", fontWeight: 700, marginTop: 2 }}>{dpd}d overdue</div>}
                      {d.paidAt && <div style={{ fontSize: 10, color: "var(--success)", marginTop: 2 }}>Paid {fmtDate(d.paidAt)}</div>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
                        background: tone.bg, color: tone.fg, textTransform: "uppercase", letterSpacing: "0.04em",
                      }}>{tone.label}</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <Btn variant="ghost" size="sm">{d.status === "paid" ? (d.receiptNo || "View receipt") : "Send reminder"}</Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
