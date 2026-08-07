import React from "react";
/* Documents — the DMS library. Grid of documents with project / category / tag / free-text
   filters, upload, and per-document sharing (request → manager approval → link). Reuses the
   shared DMS globals (UploadDocumentModal, RequestShareModal, ShareHistoryModal, downloadDocument,
   copyShareLink, fmtBytes) defined in forms.jsx + lead-detail.jsx. */

window.PageDocuments = function PageDocuments({ search = "" }) {
  const data = window.CRM_DATA;
  const all = data.documents || [];
  const isManager = !!(data.currentUser && data.currentUser.isManager);
  const me = (data.currentUser && data.currentUser.name) || "";
  const [projectF, setProjectF] = React.useState("all");
  const [catF, setCatF] = React.useState("all");
  const [tagF, setTagF] = React.useState(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [shareDoc, setShareDoc] = React.useState(null);     // doc for RequestShareModal
  const [editDoc, setEditDoc] = React.useState(null);       // doc for EditDocumentModal
  const [history, setHistory] = React.useState(null);       // { docId, rows }

  const q = (search || "").trim().toLowerCase();
  const rows = all.filter(d =>
    (projectF === "all" || d.project === projectF) &&
    (catF === "all" || d.category === catF) &&
    (!tagF || (d.tags || []).includes(tagF)) &&
    (!q || `${d.title} ${d.fileName || ""} ${(d.tags || []).join(" ")} ${d.category}`.toLowerCase().includes(q)));

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

  const selectStyle = { padding: "8px 30px 8px 12px", borderRadius: 8, border: "1px solid var(--hairline)",
    fontSize: 13, fontFamily: "var(--font-body)", background: "var(--bg)", color: "var(--neutral-800)",
    cursor: "pointer", outline: "none", appearance: "none" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* filter bar */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--hairline)", background: "var(--bg)",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <select value={projectF} onChange={(e) => setProjectF(e.target.value)} style={selectStyle}>
            <option value="all">All projects</option>
            {(data.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--neutral-400)" }}><Icon name="chevronD" size={13} /></span>
        </div>
        <div style={{ position: "relative" }}>
          <select value={catF} onChange={(e) => setCatF(e.target.value)} style={selectStyle}>
            <option value="all">All categories</option>
            {(data.docCategories || []).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--neutral-400)" }}><Icon name="chevronD" size={13} /></span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--neutral-500)" }}><strong style={{ color: "var(--neutral-800)" }}>{rows.length}</strong> of {all.length}</span>
        <Btn variant="accent" size="sm" icon="upload" onClick={() => setUploadOpen(true)}>Upload</Btn>
      </div>

      {/* tag chips */}
      {(data.docTags || []).length > 0 && (
        <div style={{ padding: "12px 24px 0", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--neutral-400)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <Icon name="tag" size={12} /> Tags
          </span>
          <FilterChip active={!tagF} onClick={() => setTagF(null)}>All</FilterChip>
          {(data.docTags || []).map(t => <FilterChip key={t} active={tagF === t} onClick={() => setTagF(t)}>{t}</FilterChip>)}
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {rows.length === 0 && (
          <div style={{ padding: 56, textAlign: "center", background: "var(--bg)", border: "1px dashed var(--hairline)", borderRadius: 14, color: "var(--neutral-400)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--neutral-600)", marginBottom: 6 }}>
              {all.length === 0 ? "No documents yet" : "No documents match your filters"}
            </div>
            <div style={{ fontSize: 13, marginBottom: 18 }}>Upload brochures, cost sheets, agreements, legal papers and more — organised by project.</div>
            <Btn variant="accent" icon="upload" onClick={() => setUploadOpen(true)}>Upload a document</Btn>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {rows.map(d => (
            <DocCard key={d.id} d={d} isManager={isManager} me={me}
              onDownload={() => downloadDocument(d.id)} onShare={() => setShareDoc(d)}
              onEdit={() => setEditDoc(d)} onHistory={() => showHistory(d.id)} act={act} />
          ))}
        </div>
      </div>

      <UploadDocumentModal open={uploadOpen} onClose={() => setUploadOpen(false)}
        onSaved={async () => { if (window.__refreshCRM) await window.__refreshCRM(); }} />
      <RequestShareModal open={!!shareDoc} doc={shareDoc} onClose={() => setShareDoc(null)}
        onSaved={async () => { if (window.__refreshCRM) await window.__refreshCRM(); }} />
      <EditDocumentModal open={!!editDoc} doc={editDoc} onClose={() => setEditDoc(null)}
        onSaved={async () => { if (window.__refreshCRM) await window.__refreshCRM(); }} />
      <ShareHistoryModal history={history} onClose={() => setHistory(null)} />
    </div>
  );
};

function DocCard({ d, isManager, me, onDownload, onShare, onEdit, onHistory, act }) {
  const data = window.CRM_DATA;
  const proj = (data.projects || []).find(p => p.id === d.project);
  const shares = d.shares || [];
  const approved = shares.filter(s => s.status === "Approved");
  const pending = shares.filter(s => s.status === "Requested");
  const canEdit = isManager || d.uploadedBy === me;   // mirrors update_document's own gate
  const tone = (fg, bg) => ({ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700,
    padding: "3px 8px", borderRadius: 999, background: bg, color: fg, letterSpacing: "0.02em" });
  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--hairline)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--neutral-100)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--neutral-600)", flexShrink: 0 }}>
          <Icon name="file" size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, lineHeight: 1.3, wordBreak: "break-word" }}>{d.title}</div>
          <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 3 }}>
            {fmtBytes(d.size)} · {fmtRelative(d.at)}{d.uploadedBy ? " · " + d.uploadedBy : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {/* update_document only accepts the uploader or a manager — don't offer the
              affordance to anyone else, they'd just hit a 403 after filling the form. */}
          {canEdit && <button onClick={onEdit} title="Edit / rename / delete" style={{ ...iconBtn, width: 32, height: 32 }}><Icon name="edit" size={14} /></button>}
          <button onClick={onDownload} title="Download" style={{ ...iconBtn, width: 32, height: 32 }}><Icon name="download" size={14} /></button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", padding: "3px 8px", borderRadius: 4, background: "var(--dux-amber-100)", color: "var(--dux-amber-600)", textTransform: "uppercase" }}>{d.category}</span>
        {proj && <span style={{ fontSize: 11, color: "var(--neutral-600)" }}>{proj.name}</span>}
        {d.unit && <span style={{ fontSize: 11, color: "var(--neutral-400)", fontFamily: "var(--font-mono)" }}>· {d.unit}</span>}
        {d.leadId && <span style={{ fontSize: 11, color: "var(--neutral-400)", fontFamily: "var(--font-mono)" }}>· {d.leadId}</span>}
      </div>

      {(d.tags || []).length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {d.tags.map(t => <span key={t} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: "var(--info-bg)", color: "var(--info)" }}>{t}</span>)}
        </div>
      )}

      {/* sharing */}
      <div style={{ paddingTop: 12, borderTop: "1px dashed var(--hairline)", display: "flex", flexDirection: "column", gap: 8 }}>
        {!d.shareable && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--neutral-400)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="shield" size={13} /> Not shareable
            </span>
            {canEdit && <Btn variant="outline" size="sm" icon="link" onClick={() => act("update_document", { document: d.id, shareable: 1 }, "Marked shareable", "green")}>Make shareable</Btn>}
          </div>
        )}
        {d.shareable && approved.length === 0 && pending.length === 0 && (
          <Btn variant="accent" size="sm" icon="link" onClick={onShare}>Share with a lead</Btn>
        )}
        {pending.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={tone("var(--dux-amber-600)", "var(--dux-amber-100)")}><Icon name="clock" size={10} /> PENDING</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{s.leadName}</span>
            <div style={{ flex: 1 }} />
            {isManager
              ? <>
                  <Btn variant="accent" size="sm" icon="check" onClick={() => act("approve_share", { share_id: s.id }, "Share approved", "green")}>Approve</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => act("reject_share", { share_id: s.id }, "Declined", "orange")}>Decline</Btn>
                </>
              : (me === s.requestedBy && <Btn variant="ghost" size="sm" onClick={() => act("reject_share", { share_id: s.id }, "Cancelled", "orange")}>Cancel</Btn>)}
          </div>
        ))}
        {approved.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={tone("var(--success)", "var(--success-bg)")}><Icon name="check" size={10} /> SHARED</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{s.leadName}</span>
            <span style={{ fontSize: 11, color: "var(--neutral-400)" }}>{s.accessCount || 0} open{(s.accessCount || 0) === 1 ? "" : "s"}</span>
            <div style={{ flex: 1 }} />
            {s.shareUrl && <Btn variant="outline" size="sm" icon="copy" onClick={() => copyShareLink(s.shareUrl)}>Copy</Btn>}
            {isManager && <Btn variant="ghost" size="sm" onClick={() => act("revoke_share", { share_id: s.id }, "Revoked", "orange")}>Revoke</Btn>}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {d.shareable && (approved.length > 0 || pending.length > 0) && <Btn variant="ghost" size="sm" icon="link" onClick={onShare}>Share with another lead</Btn>}
          <div style={{ flex: 1 }} />
          <button onClick={onHistory} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--neutral-500)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="eye" size={12} /> History
          </button>
        </div>
      </div>
    </div>
  );
}
