import React from "react";
/* Shared CRM primitives — sidebar, topbar, avatars, badges, formatters.
   All three directions reuse these so the design language stays coherent. */

const { useState, useEffect, useMemo, useRef } = React;

// ---------- Formatters ----------
window.fmtINR = (n) => {
  if (n == null) return "—";
  if (n >= 10000000) return "₹ " + (n / 10000000).toFixed(2).replace(/\.00$/, "") + " Cr";
  if (n >= 100000)   return "₹ " + (n / 100000).toFixed(2).replace(/\.00$/, "") + " L";
  return "₹ " + n.toLocaleString("en-IN");
};
window.fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
window.fmtRelative = (iso) => {
  if (!iso) return "—";
  const today = new Date("2026-04-29");
  const d = new Date(iso);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 0)  return "in " + diff + "d";
  return Math.abs(diff) + "d ago";
};

// ---------- Tiny SVG icon set (Lucide-style strokes, 1.6 weight) ----------
window.Icon = function Icon({ name, size = 16, className = "", style = {} }) {
  const s = size;
  const stroke = "currentColor";
  const sw = 1.6;
  const common = { width: s, height: s, viewBox: "0 0 24 24", fill: "none",
    stroke, strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round",
    className, style };
  const paths = {
    search:    <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    plus:      <><path d="M12 5v14M5 12h14"/></>,
    filter:    <><path d="M3 5h18M6 12h12M10 19h4"/></>,
    chevron:   <><path d="m9 6 6 6-6 6"/></>,
    chevronD:  <><path d="m6 9 6 6 6-6"/></>,
    arrowR:    <><path d="M5 12h14M13 5l7 7-7 7"/></>,
    arrowL:    <><path d="M19 12H5M11 5l-7 7 7 7"/></>,
    phone:     <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></>,
    mail:      <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    whatsapp:  <><path d="M3 21l1.65-4.5A8.38 8.38 0 1 1 9 19.5L3 21Z"/><path d="M8.5 11c.5 1 1.5 2 2.5 2.5"/></>,
    user:      <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    users:     <><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8"/><path d="M22 21a7 7 0 0 0-5-6.7"/></>,
    home:      <><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/></>,
    building:  <><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01"/></>,
    funnel:    <><path d="M3 4h18l-7 9v6l-4-2v-4L3 4Z"/></>,
    calendar:  <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></>,
    chart:     <><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-7"/></>,
    inbox:     <><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5 5h14l3 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z"/></>,
    file:      <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
    rupee:     <><path d="M6 4h12M6 9h12M9 4c4 0 6 2 6 5s-2 5-6 5h-1l8 6"/></>,
    star:      <><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z"/></>,
    starF:     <><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z" fill="currentColor"/></>,
    bell:      <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>,
    grid:      <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    list:      <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
    dots:      <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    flame:     <><path d="M12 22c5 0 8-3 8-7 0-3-2-5-3-7-1 2-2 3-4 3 1-3 0-7-3-9-1 4-5 6-5 11 0 5 3 9 7 9Z"/></>,
    check:     <><path d="m5 12 5 5 9-11"/></>,
    x:         <><path d="M6 6l12 12M18 6 6 18"/></>,
    pin:       <><path d="M12 21v-7"/><path d="M9 4h6l-1 6 4 4H6l4-4-1-6Z"/></>,
    edit:      <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></>,
    download:  <><path d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16"/></>,
    note:      <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></>,
    cp:        <><path d="M12 2 2 7v6c0 5 4 8 10 9 6-1 10-4 10-9V7l-10-5Z"/></>,
    money:     <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 10v.01M18 14v.01"/></>,
    target:    <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  };
  return <svg {...common}>{paths[name] || null}</svg>;
};

// ---------- Avatar ----------
window.Avatar = function Avatar({ name, initials, size = 32, tone }) {
  // Deterministic hue from name
  let h = 0; for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const bg = tone || `oklch(0.86 0.05 ${hue})`;
  const fg = `oklch(0.32 0.06 ${hue})`;
  const fontSize = Math.round(size * 0.38);
  return (
    <div className="dux-avatar" style={{
      width: size, height: size, borderRadius: "50%",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: bg, color: fg, fontSize, fontWeight: 600, fontFamily: "var(--font-display)",
      letterSpacing: "0.02em", flexShrink: 0,
    }}>{initials}</div>
  );
};

// ---------- Stage badge ----------
window.StageBadge = function StageBadge({ stage, size = "sm" }) {
  const map = {
    new:        { bg: "var(--info-bg)",     fg: "var(--info)",      label: "New" },
    contacted:  { bg: "var(--neutral-100)", fg: "var(--neutral-800)", label: "Contacted" },
    qualified:  { bg: "var(--dux-amber-100)", fg: "var(--dux-amber-600)", label: "Qualified" },
    visit:      { bg: "var(--dux-amber-100)", fg: "var(--dux-amber-600)", label: "Site Visit" },
    negotiation:{ bg: "var(--dux-coral-100)", fg: "#B5462C",       label: "Negotiation" },
    booked:     { bg: "var(--success-bg)",  fg: "var(--success)",   label: "Booked" },
    lost:       { bg: "var(--error-bg)",    fg: "var(--error)",     label: "Lost" },
  };
  const s = map[stage] || map.new;
  const pad = size === "lg" ? "6px 12px" : "3px 9px";
  const fs = size === "lg" ? 12 : 11;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: pad, borderRadius: 999, fontSize: fs, fontWeight: 600,
      background: s.bg, color: s.fg, fontFamily: "var(--font-display)",
      letterSpacing: "0.02em", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
      {s.label}
    </span>
  );
};

// ---------- Score chip ----------
window.ScoreChip = function ScoreChip({ score }) {
  const tone = score >= 75 ? "hot" : score >= 50 ? "warm" : "cold";
  const c = tone === "hot"  ? { bg: "var(--dux-coral-100)", fg: "#B5462C" }
          : tone === "warm" ? { bg: "var(--dux-amber-100)", fg: "var(--dux-amber-600)" }
          :                   { bg: "var(--neutral-100)",   fg: "var(--neutral-600)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: c.bg, color: c.fg, fontFamily: "var(--font-display)",
    }}>
      {tone === "hot" && <Icon name="flame" size={11} />}
      {score}
    </span>
  );
};

// ---------- Sidebar (shared) ----------
window.Sidebar = function Sidebar({ active = "leads", compact = false, onNav }) {
  const nav = [
    { id: "dashboard", icon: "home",     label: "Dashboard" },
    { id: "calendar",  icon: "check",    label: "My Day" },
    { id: "leads",     icon: "users",    label: "Leads",      badge: 38 },
    { id: "visits",    icon: "calendar", label: "Site Visits", badge: 14 },
    { id: "inventory", icon: "building", label: "Inventory" },
    { id: "bookings",  icon: "file",     label: "Bookings" },
    { id: "payments",  icon: "rupee",    label: "Payments" },
    { id: "partners",  icon: "cp",       label: "Partners" },
    { id: "campaigns", icon: "target",   label: "Campaigns" },
    { id: "reports",   icon: "chart",    label: "Reports" },
    { id: "settings",  icon: "settings", label: "Settings" },
  ];
  const w = compact ? 64 : 232;
  return (
    <aside className="dux-sidebar" style={{
      width: w, background: "var(--dux-navy)", color: "var(--neutral-0)",
      display: "flex", flexDirection: "column", flexShrink: 0, height: "100%",
      borderRight: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{
        padding: compact ? "22px 12px" : "22px 20px",
        display: "flex", alignItems: "center", gap: 14,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        minHeight: 76,
      }}>
        {compact ? (
          <img src={(window.__resources && window.__resources.duxMonoWhite) || "assets/dux-monogram-white.png"} alt="Dux"
               style={{ height: 30, width: "auto", objectFit: "contain", display: "block", opacity: 0.95 }} />
        ) : (
          <>
            <div style={{ lineHeight: 1.05, flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "0.02em", color: "#FFF" }}>Shradha CRM</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 4 }}>Sales · Inventory · Bookings</div>
            </div>
            <img src={(window.__resources && window.__resources.duxLogoTightWhite) || "assets/dux-logo-tight-white.png"} alt="Dux Digitech"
                 title="Built by Dux Digitech"
                 style={{ height: 22, width: "auto", objectFit: "contain", display: "block", opacity: 0.7, flexShrink: 0 }} />
          </>
        )}
      </div>

      <nav style={{ padding: 12, flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {nav.map((n) => {
          const isActive = n.id === active;
          return (
            <a key={n.id} href="#" onClick={(e) => { e.preventDefault(); onNav && onNav(n.id); }} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: compact ? "10px" : "10px 12px",
              borderRadius: 8, color: isActive ? "var(--dux-amber)" : "rgba(255,255,255,0.78)",
              background: isActive ? "rgba(242,169,59,0.10)" : "transparent",
              fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 500,
              textDecoration: "none", transition: "all 200ms var(--ease-standard)",
              justifyContent: compact ? "center" : "flex-start",
            }}>
              <Icon name={n.icon} size={18} />
              {!compact && <span style={{ flex: 1 }}>{n.label}</span>}
              {!compact && n.badge && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                  background: isActive ? "var(--dux-amber)" : "rgba(255,255,255,0.12)",
                  color: isActive ? "var(--dux-black)" : "rgba(255,255,255,0.85)" }}>{n.badge}</span>
              )}
            </a>
          );
        })}
      </nav>

      <div style={{
        padding: compact ? 12 : "12px 16px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Avatar name="Priya Deshmukh" initials="PD" size={32} />
        {!compact && (
          <div style={{ lineHeight: 1.2, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display)" }}>Priya Deshmukh</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Sales Executive</div>
          </div>
        )}
        {!compact && <Icon name="settings" size={16} style={{ color: "rgba(255,255,255,0.55)" }} />}
      </div>
    </aside>
  );
};

// ---------- Top bar ----------
window.Topbar = function Topbar({ title, subtitle, children, accent, search, onSearch, searchPlaceholder }) {
  return (
    <header className="dux-topbar" style={{
      height: 64, padding: "0 24px",
      display: "flex", alignItems: "center", gap: 16,
      borderBottom: "1px solid var(--hairline)", background: "var(--bg)", flexShrink: 0,
    }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          {subtitle && <div className="dux-eyebrow" style={{ fontSize: 10, marginBottom: 4 }}>{subtitle}</div>}
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em" }}>{title}</div>
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center",
        background: "var(--neutral-50)", borderRadius: 8, padding: "8px 12px",
        gap: 8, width: 320, border: "1px solid transparent",
      }}>
        <Icon name="search" size={16} style={{ color: "var(--neutral-400)" }} />
        <input placeholder={searchPlaceholder || "Search leads, projects, units…"}
          value={onSearch ? (search || "") : undefined}
          onChange={onSearch ? (e) => onSearch(e.target.value) : undefined}
          style={{ background: "transparent", border: 0, outline: "none", flex: 1, fontFamily: "var(--font-body)", fontSize: 14 }} />
        {onSearch && search ? (
          <button onClick={() => onSearch("")} title="Clear" style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--neutral-400)", display: "inline-flex" }}><Icon name="x" size={14} /></button>
        ) : (
        <kbd style={{
          fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--neutral-400)",
          padding: "2px 6px", borderRadius: 4, background: "var(--bg)", border: "1px solid var(--hairline)"
        }}>⌘K</kbd>
        )}
      </div>
      <button title="Notifications" style={iconBtn}><Icon name="bell" size={18} /><span style={notifDot} /></button>
      {children}
    </header>
  );
};

const iconBtn = {
  position: "relative",
  width: 36, height: 36, border: "1px solid var(--hairline)", background: "var(--bg)",
  borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center",
  color: "var(--neutral-800)", cursor: "pointer",
};
const notifDot = {
  position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: "50%",
  background: "var(--dux-amber)", border: "2px solid var(--bg)",
};
window.iconBtn = iconBtn;

// ---------- Buttons ----------
window.Btn = function Btn({ variant = "primary", icon, children, size = "md", onClick, style }) {
  const sizes = {
    sm: { padding: "7px 14px", fontSize: 12 },
    md: { padding: "10px 18px", fontSize: 13 },
    lg: { padding: "14px 28px", fontSize: 14 },
  };
  const variants = {
    primary: { background: "var(--dux-navy)", color: "var(--neutral-0)", border: "1.5px solid var(--dux-navy)" },
    accent:  { background: "var(--dux-amber)", color: "var(--dux-black)", border: "1.5px solid var(--dux-amber)" },
    outline: { background: "transparent", color: "var(--dux-navy)", border: "1.5px solid var(--dux-navy)" },
    ghost:   { background: "transparent", color: "var(--neutral-800)", border: "1.5px solid transparent" },
    soft:    { background: "var(--neutral-50)", color: "var(--neutral-800)", border: "1.5px solid var(--hairline)" },
  };
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      borderRadius: 999, fontFamily: "var(--font-display)", fontWeight: 600,
      letterSpacing: "0.04em", textTransform: "uppercase",
      cursor: "pointer", transition: "all 250ms var(--ease-standard)",
      ...sizes[size], ...variants[variant], ...style,
    }}>
      {icon && <Icon name={icon} size={size === "sm" ? 13 : 15} />}
      {children}
    </button>
  );
};

// ---------- Stat card ----------
window.StatCard = function StatCard({ label, value, delta, deltaTone = "up", icon }) {
  const tone = deltaTone === "up" ? "var(--success)" : "var(--error)";
  return (
    <div style={{
      background: "var(--bg)", border: "1px solid var(--hairline)",
      borderRadius: 12, padding: 16, flex: 1, minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div className="dux-eyebrow" style={{ fontSize: 10 }}>{label}</div>
        {icon && <Icon name={icon} size={16} style={{ color: "var(--neutral-400)" }} />}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>{value}</div>
      {delta && (
        <div style={{ fontSize: 12, color: tone, fontWeight: 600, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
          <span>{deltaTone === "up" ? "↑" : "↓"}</span>{delta}
        </div>
      )}
    </div>
  );
};

// ---------- Filter chip ----------
window.FilterChip = function FilterChip({ active, children, onClick, count }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "7px 13px", borderRadius: 999, fontSize: 12, fontWeight: 600,
      fontFamily: "var(--font-display)", letterSpacing: "0.02em",
      cursor: "pointer", transition: "all 200ms var(--ease-standard)",
      background: active ? "var(--dux-navy)" : "var(--bg)",
      color: active ? "var(--neutral-0)" : "var(--neutral-800)",
      border: "1px solid " + (active ? "var(--dux-navy)" : "var(--hairline)"),
    }}>
      {children}
      {count != null && (
        <span style={{
          fontSize: 11, padding: "1px 6px", borderRadius: 999,
          background: active ? "rgba(255,255,255,0.18)" : "var(--neutral-100)",
          color: active ? "var(--neutral-0)" : "var(--neutral-600)",
        }}>{count}</span>
      )}
    </button>
  );
};
