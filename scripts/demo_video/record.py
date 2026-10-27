"""Records the narrated walkthrough of the Shradha Realty CRM as ONE continuous browser video.

Each beat's on-screen actions run while that beat's narration will play. Actions are pinned to
the narration's WORD timings (audio/<beat>.words.json): d.atw("Kanban") waits until just before
that word is spoken. A beat is padded to its audio length; its start time (seconds into the video)
goes to timings.json, with any `cuts` (spans to drop: page loads, AI wait) so the assembler can
lay the audio on top.     python record.py [--dry]   (--dry = no waits, screenshot per beat)
"""
import json, re, sys, time, datetime, traceback, contextlib, subprocess
from playwright.sync_api import sync_playwright
from common import *

DRY = "--dry" in sys.argv
DUR = json.loads((HERE / "durations.json").read_text())
WORDS = {p.name.split(".")[0]: json.loads(p.read_text()) for p in (HERE / "audio").glob("*.words.json")}
GAP = 0.8
OUT = HERE / ("dry_out" if DRY else "rec_out"); OUT.mkdir(exist_ok=True)
SHOTS = OUT / "shots"; SHOTS.mkdir(exist_ok=True)

DEMO = "Rohan Kulkarni (Demo)"
DEMO_PHONE = "9000011122"
DUP_PHONE = "8888055940"          # an existing Abhiman Niwas lead's number — triggers the duplicate warning
REP = "Avinash Soyam"
PARTNER_Q = "Aslam"
DOC_TITLE = "Abhiman Niwas Brochure (Demo)"
PDF = HERE / (DOC_TITLE + ".pdf")
ASSETS = BASE + "/assets/dux_crm_realty/images/"
AI_UP = False

CHAPTER_JS = """(t) => { let el = document.getElementById('demo-chapter');
  if (!el) { el = document.createElement('div'); el.id = 'demo-chapter';
    Object.assign(el.style, {position:'fixed', left:'14px', top:'726px', width:'204px', transform:'translateY(8px)',
      zIndex: 2147483645, background:'#0F1A2E', color:'#fff', padding:'12px 16px', borderRadius:'12px',
      border:'1.5px solid rgba(232,169,91,.75)', font:'600 16px/1.3 Poppins, Inter, system-ui, sans-serif',
      letterSpacing:'.01em', boxShadow:'0 10px 28px rgba(0,0,0,.30)', opacity:'0', transition:'all .45s ease', pointerEvents:'none'});
    document.documentElement.appendChild(el); }
  el.innerHTML = t; requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
  clearTimeout(window.__chT); window.__chT = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; }, 4600); }"""

# A drawn stand-in for a native <select> popup (headless Chromium never paints those into the video).
LIST_JS = """(s, ti) => {
  const old = document.getElementById('demo-list'); if (old) old.remove();
  const r = s.getBoundingClientRect(), opts = [...s.options], rowH = 30, maxRows = 13;
  let start = 0; if (opts.length > maxRows) start = Math.max(0, Math.min(ti - 3, opts.length - maxRows));
  const shown = opts.slice(start, start + maxRows), h = shown.length * rowH + 8;
  const below = r.bottom + 4 + h < innerHeight - 8;
  const box = document.createElement('div'); box.id = 'demo-list';
  Object.assign(box.style, {position:'fixed', left: r.left + 'px', top: (below ? r.bottom + 4 : r.top - 4 - h) + 'px',
    width: Math.max(r.width, 230) + 'px', background:'#fff', border:'1px solid #c9ced8', borderRadius:'9px',
    boxShadow:'0 14px 34px rgba(15,26,46,.24)', zIndex: 2147483600, padding:'4px 0', pointerEvents:'none',
    font:'13px/1.2 Inter, system-ui, sans-serif', color:'#1d2433', opacity:'0', transition:'opacity .15s'});
  shown.forEach((o, i) => { const d = document.createElement('div'); const idx = start + i;
    d.textContent = o.text.trim() || '—'; d.dataset.idx = idx;
    Object.assign(d.style, {height: rowH + 'px', lineHeight: rowH + 'px', padding: '0 14px', whiteSpace: 'nowrap',
      overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: idx === s.selectedIndex ? '600' : '400',
      background: idx === s.selectedIndex ? '#eef1f6' : 'transparent'}); box.appendChild(d); });
  document.documentElement.appendChild(box); requestAnimationFrame(() => box.style.opacity = '1');
  const row = box.querySelector('[data-idx="' + ti + '"]'); const rr = (row || box).getBoundingClientRect();
  return {x: rr.left + Math.min(rr.width / 2, 110), y: rr.top + rr.height / 2};
}"""
LIST_HI_JS = """(ti) => { const b = document.getElementById('demo-list'); if (!b) return;
  b.querySelectorAll('[data-idx]').forEach(d => { const on = +d.dataset.idx === ti; d.style.background = on ? 'rgba(232,169,91,.30)' : 'transparent'; }); }"""
LIST_RM_JS = "() => { const b = document.getElementById('demo-list'); if (b) b.remove(); }"
RIPPLE_JS = "([x, y]) => document.dispatchEvent(new MouseEvent('mousedown', {clientX: x, clientY: y}))"
KEY_JS = """(k) => { const el = document.createElement('div');
  el.innerHTML = '<span style="display:inline-block;min-width:54px;padding:10px 18px;border-radius:10px;background:#fff;color:#0F1A2E;border:1px solid #c9ced8;border-bottom-width:4px;font:700 26px/1 Inter,system-ui,sans-serif;text-align:center">' + k + '</span><span style="margin-left:14px;font:600 18px Inter,system-ui,sans-serif">key</span>';
  Object.assign(el.style, {position:'fixed', left:'50%', top:'42%', transform:'translate(-50%,-50%)', zIndex:2147483640,
    background:'rgba(15,26,46,.92)', color:'#fff', padding:'16px 24px', borderRadius:'14px', pointerEvents:'none',
    boxShadow:'0 14px 34px rgba(0,0,0,.3)', transition:'opacity .4s'});
  document.documentElement.appendChild(el); setTimeout(() => el.style.opacity = '0', 1500); setTimeout(() => el.remove(), 2000); }"""
FLASH_JS = """(e) => { const o = e.style.background, t = e.style.transition; e.style.transition = 'background .2s';
  e.style.background = 'rgba(232,169,91,.22)'; setTimeout(() => { e.style.background = o; e.style.transition = t; }, 900); }"""

CARD_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1920px; height: 1080px; overflow: hidden; font-family: Poppins, system-ui, sans-serif; color: #fff; background: #0F1A2E; }
body > div { animation: fadein .7s ease both; } @keyframes fadein { from { opacity: 0; } }
.bg { position: absolute; inset: -2%%; background: url('%sabhiman-facade.jpg') center/cover no-repeat; animation: kb 40s ease-out forwards; }
.veil { position: absolute; inset: 0; background: linear-gradient(100deg, rgba(15,26,46,.97) 0%%, rgba(15,26,46,.92) 48%%, rgba(15,26,46,.55) 100%%); }
.wrap { position: absolute; left: 140px; top: 0; bottom: 0; width: 1150px; display: flex; flex-direction: column; justify-content: center; }
.eyebrow { color: #E8A95B; font-size: 22px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; margin-bottom: 26px; }
h1 { font-size: 92px; font-weight: 700; line-height: 1.02; letter-spacing: -.02em; }
.sub { font-size: 30px; color: #C9D2E3; margin-top: 26px; font-weight: 400; }
.list { margin-top: 54px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px 60px; max-width: 1000px; }
.list div { font-size: 24px; color: #E6EAF2; opacity: 0; transform: translateY(8px); animation: in .5s ease forwards;
  transition: color .35s, transform .35s; border-radius: 8px; }
.list div.on { color: #E8A95B; transform: translateX(10px); }
.list b { color: #E8A95B; font-weight: 600; margin-right: 14px; }
.cta { margin-top: 54px; display: inline-flex; align-items: center; gap: 18px; padding: 20px 30px; border-radius: 16px;
  background: rgba(232,169,91,.14); border: 1px solid rgba(232,169,91,.45); font-size: 27px; color: #F3E3CC;
  opacity: 0; animation: in .6s ease .9s forwards; align-self: flex-start; }
.cta b { color: #E8A95B; font-weight: 600; }
.brand { position: absolute; right: 110px; top: 78px; display: flex; align-items: center; gap: 22px; color: #9AA6BD; font-size: 20px; }
.brand img { height: 46px; }
.bar { width: 120px; height: 5px; background: #E8A95B; border-radius: 3px; margin-bottom: 34px; }
@keyframes in { to { opacity: 1; transform: none; } }
@keyframes kb { from { transform: scale(1); } to { transform: scale(1.09) translateX(-1.5%%); } }
"""


def card_html(eyebrow, title, sub, items=(), cta=None, foot="A walkthrough by DUX Digitech"):
    lis = "".join(f'<div id="it{i + 1}" style="animation-delay:{0.6 + i * 0.3:.2f}s"><b>{i + 1:02d}</b>{t}</div>' for i, t in enumerate(items))
    body = f'<div class="list">{lis}</div>' if items else ""
    if cta:
        body += f'<div class="cta">{cta}</div>'
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CARD_CSS % (ASSETS,)}</style></head><body>
<div class="bg"></div><div class="veil"></div><div class="wrap"><div class="bar"></div><div class="eyebrow">{eyebrow}</div><h1>{title}</h1>
<div class="sub">{sub}</div>{body}</div>
<div class="brand"><img src="{ASSETS}dux-logo-white.png" onerror="this.remove()"><span>{foot}</span></div></body></html>"""


INTRO = card_html("Shradha Realty · Sales CRM", "Complete app<br>walkthrough",
                  "Everything your sales team needs, step by step",
                  ["Logging in", "Dashboard &amp; menu", "Capturing &amp; assigning leads", "Calls, visits &amp; tasks",
                   "AI email assistant", "My Day calendar", "Inventory &amp; unit holds", "Documents &amp; approvals",
                   "Bookings, partners &amp; reports", "Settings in detail"])
OUTRO = card_html("Thank you", "Start using the<br>CRM every day",
                  "Every lead, every visit and every follow-up — in one place",
                  cta="<b>Questions or need help?</b>&nbsp; Reach out to the DUX Digitech team")

BROCHURE = f"""<!doctype html><html><head><meta charset="utf-8"><style>
body {{ font-family: Helvetica, Arial, sans-serif; margin: 0; color: #0F1A2E; }}
.hero {{ height: 520px; background: #0F1A2E url('{ASSETS}abhiman-facade.jpg') center/cover; }}
.pad {{ padding: 40px 56px; }} h1 {{ font-size: 40px; margin: 0 0 8px; }} .tag {{ color: #B8772E; font-weight: 700; letter-spacing: .14em; }}
p {{ font-size: 16px; line-height: 1.6; }} .note {{ margin-top: 40px; font-size: 12px; color: #777; }}
</style></head><body><div class="hero"></div><div class="pad"><div class="tag">SAMPLE · FOR THE DEMO VIDEO</div>
<h1>Abhiman Niwas</h1><p>Hingna Road, Nagpur · 1, 2 &amp; 3 BHK flats · Towers A1 and G7</p>
<p>This is a placeholder brochure used only to demonstrate document upload and sharing in the CRM walkthrough.</p>
<div class="note">Not a real brochure. Deleted after recording.</div></div></body></html>"""


def rx(text):
    return re.compile(r"^\s*" + re.escape(text) + r"\s*$", re.I)


class Demo:
    def __init__(self, page):
        self.page, self.ptr = page, Pointer(page)
        self.t0 = time.monotonic(); self.bs = 0.0; self.key = None
        self.timings, self.errors, self.cuts = [], [], []

    # ---------------- timing
    def now(self):
        return time.monotonic() - self.t0

    def at(self, sec):
        """Wait until `sec` seconds into the current beat's narration."""
        if DRY:
            return
        d = self.bs + sec - self.now()
        if d > 0:
            time.sleep(d)

    def t(self, word, n=1, after=0.0):
        """Start time of the n-th spoken `word` (case-insensitive) at/after `after` seconds."""
        norm = lambda x: re.sub(r"[^\w']", "", x).lower()
        hits = [w["start"] for w in WORDS[self.key] if norm(w["w"]) == word.lower() and w["start"] >= after]
        if len(hits) < n:
            raise KeyError(f"{self.key}: word {word!r} #{n} not in narration")
        return hits[n - 1]

    def atw(self, word, n=1, lead=0.5, after=0.0):
        self.at(max(0.0, self.t(word, n, after) - lead))

    @contextlib.contextmanager
    def cut(self):
        """Everything inside is removed from the final video (page loads, waiting on the AI)."""
        a = self.now()
        try:
            yield
        finally:
            self.cuts.append([round(a, 3), round(self.now(), 3)])

    def beat(self, key, fn, pre=None):
        if pre:
            self.soft(pre, key + ":pre")
        self.key = key
        self.bs = self.now()
        self.timings.append({"key": key, "start": round(self.bs, 3)})
        print(f"[{self.bs:7.1f}s] {key}", flush=True)
        try:
            fn()
        except Exception as e:
            self.errors.append([key, repr(e)[:400]])
            print("   ERR", key, repr(e)[:400], flush=True)
            traceback.print_exc(limit=2)
            try: self.page.screenshot(path=str(SHOTS / f"ERR_{key}.png"))
            except Exception: pass
        if DRY:
            self.page.screenshot(path=str(SHOTS / f"{len(self.timings):02d}_{key}.png"))
        else:
            over = self.now() - self.bs - (DUR[key] + GAP)
            if over > 0.3:
                print(f"   overran by {over:.1f}s", flush=True)
            self.at(DUR[key] + GAP)

    def soft(self, fn, label=""):
        try:
            fn()
        except Exception as e:
            self.errors.append([label or "soft", repr(e)[:300]])
            print("   soft-fail", label, repr(e)[:300], flush=True)

    # ---------------- locating
    def btn(self, text, scope=None):
        return (scope or self.page).locator("button").filter(has_text=rx(text)).filter(visible=True).first

    def text(self, t, exact=True, scope=None):
        return (scope or self.page).get_by_text(t, exact=exact).filter(visible=True).first

    def M(self):
        """The topmost open dialog overlay (every modal in the app blurs its backdrop)."""
        return self.page.locator("div[style*='backdrop-filter']").filter(visible=True).last

    def row(self, text, has_button):
        """Innermost visible div holding both `text` and a button labelled `has_button`."""
        b = self.page.locator("button").filter(has_text=rx(has_button))
        return self.page.locator("div").filter(has_text=text).filter(has=b).filter(visible=True).last

    def select_with(self, option_text, scope=None):
        o = self.page.locator("option").filter(has_text=option_text)
        return (scope or self.page).locator("select").filter(has=o).filter(visible=True).first

    def label_select(self, label):
        return self.page.locator("label").filter(has_text=re.compile(r"^\s*" + label, re.I)).locator("select").filter(visible=True).first

    # ---------------- acting
    def click(self, loc, **kw):
        self.ptr.click(loc, **kw)

    def hover(self, loc, pause=0.6):
        self.ptr.hover(loc, pause)

    def point(self, loc, fx=0.5, fy=0.5, pause=0.4):
        """Move to a spot inside an element (e.g. the left edge of a text, so the arrow doesn't hide it)."""
        loc.scroll_into_view_if_needed(timeout=8000)
        b = loc.bounding_box(timeout=8000)
        self.ptr.move_to(b["x"] + b["width"] * fx, b["y"] + b["height"] * fy); time.sleep(pause)

    def under(self, loc, fx=0.5, pause=0.3):
        loc.scroll_into_view_if_needed(timeout=8000)
        b = loc.evaluate("""e => { const r = document.createRange(); r.selectNodeContents(e);
          const b = r.getBoundingClientRect(); const o = e.getBoundingClientRect();
          return b.width ? {x: b.x, y: b.y, w: b.width, h: b.height} : {x: o.x, y: o.y, w: o.width, h: o.height}; }""")
        self.ptr.move_to(b["x"] + min(b["w"] * fx, 140), b["y"] + b["h"] + 3); time.sleep(pause)

    def type(self, loc, text, delay=55):
        self.ptr.type_into(loc, text, delay=delay)

    def ripple(self, x=None, y=None):
        self.page.evaluate(RIPPLE_JS, [self.ptr.x if x is None else x, self.ptr.y if y is None else y])

    def _index(self, sel, label=None, value=None, index=None):
        opts = sel.evaluate("s => [...s.options].map(o => [o.value, o.text.trim()])")
        if index is not None:
            return index
        for i, (v, t) in enumerate(opts):
            if (value is not None and v == value) or (label is not None and t == label):
                return i
        for i, (v, t) in enumerate(opts):
            if label is not None and t.startswith(label):
                return i
        raise ValueError(f"option not found: label={label} value={value} in {opts[:8]}")

    def open_list(self, sel, target):
        """Click the closed select and draw its option list, with the pointer resting on it."""
        self.ptr.to(sel, 0.2); self.ripple()
        return sel.evaluate(LIST_JS, target)

    def pick(self, sel, target, spot, pause=0.4):
        self.ptr.move_to(spot["x"], spot["y"]); self.page.evaluate(LIST_HI_JS, target); time.sleep(0.25)
        self.ripple(); time.sleep(0.3)
        self.page.evaluate(LIST_RM_JS)
        sel.select_option(index=target); time.sleep(pause)

    def choose(self, sel, word=None, n=1, lead=0.35, hold=0.7, pause=0.4, **opt):
        """Open the select, show its options, then pick one (at `word` if given)."""
        ti = self._index(sel, **opt)
        spot = self.open_list(sel, ti)
        if word:
            self.atw(word, n, lead=lead)
        else:
            time.sleep(hold)
        self.pick(sel, ti, spot, pause)

    def peek(self, sel, hold=1.4, **opt):
        """Show a select's options without changing it (optionally pointing at one of them)."""
        ti = self._index(sel, **opt) if opt else sel.evaluate("s => s.selectedIndex")
        spot = self.open_list(sel, ti)
        if opt:
            time.sleep(0.3); self.ptr.move_to(spot["x"], spot["y"]); self.page.evaluate(LIST_HI_JS, ti)
        time.sleep(hold); self.page.evaluate(LIST_RM_JS)

    def key_badge(self, k):
        self.page.evaluate(KEY_JS, k)

    def flash(self, loc):
        self.soft(lambda: loc.evaluate(FLASH_JS), "flash")

    def nav(self, label, expect=None):
        """Sidebar navigation that verifies it arrived (a drawer overlay can swallow the first click)."""
        item = self.page.locator("nav").get_by_text(label, exact=True).filter(visible=True).first
        for attempt in range(3):
            self.click(item, after=0.4)
            if not expect:
                time.sleep(0.6); return
            try:
                expect().wait_for(timeout=3500); time.sleep(0.3); return
            except Exception:
                print(f"   nav {label}: not there yet (try {attempt + 1})", flush=True)
        raise RuntimeError(f"could not navigate to {label}")

    def settings_nav(self, label):
        self.click(self.page.locator("nav button").filter(has_text=rx(label)).filter(visible=True).first, after=0.6)

    def chapter(self, n, title):
        self.page.evaluate(CHAPTER_JS, f'<div style="color:#E8A95B;font-size:13px;letter-spacing:.14em">CHAPTER {n:02d}</div><div>{title}</div>')

    def scroll(self, dy, steps=10, x=1100, y=620, dx=0):
        self.ptr.move_to(x, y)
        for _ in range(steps):
            self.page.mouse.wheel(dx / steps, dy / steps); time.sleep(0.05)

    def scroll_to(self, loc, frac=0.45, x=1100, y=620):
        self.ptr.move_to(x, y)
        last = None
        for _ in range(40):
            b = loc.bounding_box()
            if not b: break
            off = b["y"] - H * frac
            if abs(off) < 60 or (last is not None and abs(b["y"] - last) < 1): break   # arrived, or can't scroll
            last = b["y"]
            self.page.mouse.wheel(0, max(-140, min(140, off))); time.sleep(0.05)

    def esc(self):
        self.page.keyboard.press("Escape"); time.sleep(0.4)

    def confirm_yes(self, timeout=2500):
        try:
            y = self.btn("Yes"); y.wait_for(timeout=timeout); self.click(y)
        except Exception:
            pass

    def close_drawer(self):
        """Close the lead drawer and make sure it is gone (its overlay covers the sidebar too)."""
        for _ in range(3):
            if not self.page.locator("button").filter(has_text=rx("Edit details")).filter(visible=True).count():
                return
            self.ptr.move_to(420, 560); self.ripple(); self.page.mouse.down(); self.page.mouse.up(); time.sleep(0.6)


def wait_app(page, timeout=60000):
    page.wait_for_function("() => window.CRM_DATA && window.CRM_DATA.leads && document.querySelector('nav')", timeout=timeout)
    # the outer document can scroll a few px when a wheel event bubbles out of a list: lock it
    page.evaluate("""() => { document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden';
      const st = document.createElement('style'); st.textContent = '#alert-container { bottom: 150px !important; }'; document.head.appendChild(st); }""")
    time.sleep(1.0)


def ai_up():
    """Is the Gemma box answering the CRM server? Warm the model if so (cold load ~12 s)."""
    cmd = ("curl -s -m 5 -o /dev/null -w '%{http_code}' http://187.127.174.89:11434/api/tags && "
           "curl -s -m 90 http://187.127.174.89:11434/api/generate -d "
           "'{\"model\":\"gemma4:e4b\",\"prompt\":\"Say OK\",\"stream\":false,\"think\":false,\"keep_alive\":\"30m\"}' -o /dev/null -w ' %{http_code}'")
    try:
        r = subprocess.run(["ssh", "-o", "ConnectTimeout=8", "frappe@187.127.132.58", cmd], capture_output=True, text=True, timeout=120)
    except Exception as e:
        print("AI probe failed:", e); return False
    out = r.stdout.strip()
    print("AI probe:", out or r.stderr.strip()[:200], flush=True)
    return out.startswith("200") and out.endswith("200")


# ---------------------------------------------------------------- the walkthrough
def run(page, ctx):
    global AI_UP
    d = Demo(page)
    p = page
    dates = {}

    # ---- intro + login (logged out)
    def intro():
        p.set_content(INTRO, wait_until="load"); time.sleep(0.3)
        d.ptr.move_to(1700, 980)
        # light up each topic as it is named
        for word, n, items in [("log", 1, [1]), ("capture", 1, [3]), ("visits", 1, [4]), ("inventory", 1, [7]),
                               ("approvals", 1, [8]), ("settings", 1, [10])]:
            d.atw(word, n, lead=0.1)
            p.evaluate("(ids) => { document.querySelectorAll('.list div').forEach(e => e.classList.remove('on')); ids.forEach(i => document.getElementById('it' + i).classList.add('on')); }", items)
        d.atw("begin", lead=0.3)
        p.evaluate("() => document.querySelectorAll('.list div').forEach(e => e.classList.remove('on'))")
    d.beat("intro", intro)

    def login_pre():
        # a cut must sit BETWEEN beats: inside one it would pull that beat's actions ahead of its words
        with d.cut():
            p.goto(BASE + "/login", wait_until="domcontentloaded")
            p.locator("#login_email").wait_for(timeout=20000); time.sleep(0.5); d.ptr.nudge()

    def login():
        d.chapter(1, "Logging in")
        d.atw("login", 1, lead=0.4); d.ptr.move_to(960, 300); time.sleep(0.3)
        d.atw("Frappe", lead=0.6); d.soft(lambda: d.hover(p.get_by_text(re.compile("Login to", re.I)).filter(visible=True).first, 0.3), "login title")
        d.atw("Enter", lead=0.6); d.type(p.locator("#login_email"), "yourname@shradharealty.in", delay=60)
        d.atw("password", 1, lead=0.6); d.click(p.locator("#login_password"), after=0.2)
        btn = p.locator("button", has_text=re.compile("^\\s*Login\\s*$", re.I)).filter(visible=True).first
        d.atw("click", lead=0.7); d.point(btn, 0.12, 0.6, 0.2)
        d.at(d.t("Login", 1, after=d.t("click"))); d.ripple()       # the press, without submitting anything
        d.atw("change", lead=0.6); d.ptr.move_to(960, 560)

    d.beat("login", login, pre=login_pre)

    # ---- into the app (the page load itself is cut out of the video)
    def enter_app():
        with d.cut():
            ctx.clear_cookies()
            ctx.add_cookies([{"name": "sid", "value": read_sid(), "url": BASE, "httpOnly": True, "secure": True, "sameSite": "Lax"},
                             {"name": "system_user", "value": "yes", "url": BASE},
                             {"name": "user_id", "value": "crm.demo%40shradha.local", "url": BASE},
                             {"name": "full_name", "value": "Admin", "url": BASE}])
            p.goto(APP + "#dashboard", wait_until="domcontentloaded")
            wait_app(p)
            d.ptr.x, d.ptr.y = 960, 560; d.ptr.nudge(); time.sleep(0.4)
            dates["today"] = p.evaluate("() => window.todayISO()")
            t = datetime.date.fromisoformat(dates["today"])
            sunday = t + datetime.timedelta(days=6 - t.weekday())
            dates["tomorrow"] = min(t + datetime.timedelta(days=1), sunday).isoformat()
            visit = min(t + datetime.timedelta(days=3), sunday)
            dates["visit"], dates["visit_day"] = visit.isoformat(), visit.strftime("%A")
            dates["nextweek"] = (t + datetime.timedelta(days=7)).isoformat()
            dates["far"] = (t + datetime.timedelta(days=21)).isoformat()
            assert not p.evaluate(f"() => CRM_DATA.leads.some(l => (l.phone||'').endsWith('{DEMO_PHONE}'))"), "demo phone already exists"
            d.stages = p.evaluate("() => CRM_DATA.stages.map(s => [s.id, s.label])")
            print("   dates:", dates, flush=True)

    def dash1():
        d.chapter(2, "Dashboard &amp; menu")
        d.point(p.get_by_text(re.compile(r"^Good (morning|afternoon|evening)")).filter(visible=True).first, 0.25, 0.5)
        d.atw("date", lead=0.5); d.soft(lambda: d.under(p.get_by_text(re.compile(r"\d{1,2} [A-Z]{3} \d{4}", re.I)).filter(visible=True).first, 0.6), "date")
        d.atw("site", lead=0.5); d.soft(lambda: d.under(p.get_by_text(re.compile(r"^\d+ site visits?$")).filter(visible=True).first, 0.5), "visits today")
        d.atw("overdue", lead=0.5); d.soft(lambda: d.under(p.get_by_text(re.compile(r"^\d+ overdue follow")).filter(visible=True).first, 0.5), "overdue")
    d.beat("dash1", dash1, pre=enter_app)

    def dash2():
        d.ptr.move_to(300, 160, steps=20)
        for word, lbl in [("open", "OPEN LEADS"), ("visits", "VISITS THIS WEEK"), ("bookings", "BOOKINGS"),
                          ("overdue", "COLLECTIONS OVERDUE"), ("conversion", "CONVERSION")]:
            d.atw(word, lead=0.45)
            d.soft(lambda: d.point(d.text(lbl), 0.04, 4.5, 0.2), "kpi " + lbl)
    d.beat("dash2", dash2)

    def dash3():
        funnel = p.locator("div").filter(has=p.get_by_text("Sales funnel", exact=True)).filter(has_text="Booked").filter(visible=True).last
        d.under(d.text("Sales funnel"), 0.5, 0.3)
        d.atw("New", lead=0.5); d.soft(lambda: d.point(funnel.get_by_text("New", exact=True).first, 1.6, 0.5, 0.2), "funnel new")
        d.atw("Booked", lead=1.2); d.soft(lambda: d.point(funnel.get_by_text("Booked", exact=True).first, 1.6, 0.5, 0.2), "funnel booked")
        d.atw("Today", lead=0.5); d.under(d.text("Today"), 0.5, 0.3)
        d.atw("link", lead=0.5); d.soft(lambda: d.hover(p.get_by_text(re.compile("Open My Day")).filter(visible=True).first, 0.3), "open my day")
        d.atw("Project", lead=1.2); d.scroll_to(d.text("Project performance"), 0.12); d.under(d.text("Project performance"), 0.5, 0.2)
        d.atw("units", lead=0.5); d.soft(lambda: d.under(p.get_by_text(re.compile(r"^\d+ / \d+ sold$")).filter(visible=True).first, 0.5), "sold line")
    d.beat("dash3", dash3)

    def menu():
        d.ptr.move_to(140, 150)
        for word, n, lbl in [("Dashboard", 1, "Dashboard"), ("My", 1, "My Day"), ("Approvals", 1, "Approvals"), ("Leads", 1, "Leads"),
                             ("Site", 1, "Site Visits"), ("Documents", 1, "Documents"), ("Inventory", 1, "Inventory"),
                             ("Bookings", 1, "Bookings"), ("Payments", 1, "Payments"), ("Partners", 1, "Partners"),
                             ("Campaigns", 1, "Campaigns"), ("Reports", 1, "Reports"), ("Settings", 1, "Settings")]:
            d.atw(word, n, lead=0.3)
            item = p.locator("nav").get_by_text(lbl, exact=True).first
            d.soft(lambda: (d.point(item, -0.32, 0.55, 0.05), d.flash(item.locator("xpath=ancestor::*[self::button or self::a][1]"))), "menu " + lbl)
        d.atw("Let", lead=0.2); d.ptr.move_to(600, 560)
    d.beat("menu", menu)

    # ---- leads
    search = lambda: p.locator('input[data-crm-search="1"]').filter(visible=True).first

    def leads1():
        d.nav("Leads", expect=lambda: search()); d.chapter(3, "Capturing &amp; assigning leads")
        d.atw("all", lead=0.4); d.ptr.move_to(700, 420); time.sleep(0.4); d.ptr.move_to(700, 700, steps=30)
        for word, hdr in [("name", "Lead"), ("project", "Project / Interest"), ("stage", "Stage"), ("score", "Score"),
                          ("source", "Source"), ("owner", "Owner"), ("last", "Last activity")]:
            d.atw(word, lead=0.45)
            d.soft(lambda: d.under(p.get_by_text(re.compile(r"^\s*" + re.escape(hdr) + r"\W*$", re.I)).filter(visible=True).first, 0.5, 0.1), "hdr " + hdr)
    d.beat("leads1", leads1)

    def leads2():
        d.atw("search", lead=0.7); d.type(search(), "Abhiman", delay=110)
        d.atw("tip", lead=0.3); search().fill(""); d.ptr.move_to(1300, 150, steps=20)
        p.evaluate("() => document.activeElement && document.activeElement.blur()")
        d.atw("slash", lead=0.1); d.key_badge("/"); p.keyboard.press("/"); time.sleep(0.6)
        d.atw("search", 2, lead=0.2); search().press_sequentially("Riaan", delay=120)
        d.at(DUR["leads2"] - 0.6); search().fill("")
    d.beat("leads2", leads2)

    def leads3():
        visit_label = next((lbl for sid, lbl in d.stages if sid == "visit" or "visit" in lbl.lower()), "Site Visit")
        all_chip = lambda: p.locator("button").filter(has_text=re.compile(r"^\s*All\s*\d")).filter(visible=True).first
        d.atw("chips", lead=0.5); d.point(all_chip(), 0.5, 1.6, 0.2); d.ptr.move_to(1000, 282, steps=25)
        d.atw("site", lead=0.7); d.click(p.locator("button").filter(has_text=re.compile(r"^\s*" + re.escape(visit_label) + r"\s*\d")).filter(visible=True).first)
        d.atw("drop", lead=0.6); d.click(all_chip(), after=0.2)
        proj = d.select_with("All projects")
        d.choose(proj, word="project", lead=0.1, value="P-AN")
        d.atw("owner", lead=0.4); d.peek(d.select_with("All owners"), hold=0.8)
        d.atw("source", lead=0.4); d.peek(d.select_with("All sources"), hold=0.8)
        proj.select_option(value="all"); time.sleep(0.2)
        d.atw("Filters", lead=0.6); d.click(d.btn("Filters"), after=0.3)
        d.atw("hot", lead=0.5); d.soft(lambda: d.hover(p.locator("button").filter(has_text=re.compile("Hot 75")).filter(visible=True).first, 0.3), "hot")
        d.atw("assigned", lead=0.5); d.soft(lambda: d.hover(p.locator("button").filter(has_text=rx("Unassigned")).filter(visible=True).first, 0.3), "unassigned")
    d.beat("leads3", leads3)

    def leads4():
        d.click(d.btn("Filters"), after=0.2)
        d.atw("Kanban", lead=0.7); d.click(d.btn("Kanban"), after=0.4)
        d.atw("column", lead=0.3); d.ptr.move_to(420, 330); time.sleep(0.3); d.ptr.move_to(800, 330, steps=30)
        d.atw("Booked", lead=1.4); d.scroll(0, 10, 1100, 600, dx=900)
        d.soft(lambda: d.under(p.get_by_text("Booked", exact=True).filter(visible=True).last, 0.5, 0.2), "booked col")
        d.atw("Lost", lead=0.3); d.ptr.move_to(1300, 520, steps=25)
        d.atw("switch", lead=0.6); d.click(d.btn("Table"))
    d.beat("leads4", leads4)

    # ---- new lead
    def new1():
        d.atw("Click", lead=0.7); d.click(d.btn("New Lead"))
        d.atw("blank", lead=0.4); d.ptr.move_to(760, 460); time.sleep(0.3); d.ptr.move_to(1160, 460, steps=25)
        d.atw("full", lead=0.6); d.type(d.M().get_by_placeholder("e.g. Rajesh Khandelwal"), DEMO, delay=55)
        d.atw("mobile", lead=0.5); d.type(d.M().get_by_placeholder("10-digit mobile number"), DUP_PHONE, delay=80)
        d.atw("Email", lead=0.5); d.hover(d.M().get_by_placeholder("name@email.com"), 0.6)
    d.beat("new1", new1)

    def new2():
        warn = d.M().get_by_text(re.compile("already in the CRM", re.I)).first
        d.atw("warning", lead=0.5); d.soft(lambda: d.under(warn, 0.3, 0.3), "warning")
        d.atw("existing", lead=0.5); d.soft(lambda: d.under(d.M().get_by_text(re.compile(r"LD-\d{4}")).first, 0.4, 0.3), "existing lead")
        d.atw("correct", lead=0.5); d.type(d.M().get_by_placeholder("10-digit mobile number"), DEMO_PHONE, delay=85)
    d.beat("new2", new2)

    def new3():
        src = d.select_with("Channel Partner", scope=d.M())
        d.atw("select", lead=0.4)
        ti = d._index(src, label="Reference"); spot = d.open_list(src, ti)
        d.atw("Reference", lead=0.3); d.pick(src, ti, spot, 0.5)
        d.atw("Referred", lead=0.5); d.hover(d.M().get_by_placeholder("Who referred them?"), 0.2)
        ref = d.M().get_by_placeholder("Who referred them?")
        d.atw("type", lead=0.5); d.type(ref, "Sanj", delay=90); time.sleep(0.5)
        sug = d.M().get_by_text(re.compile(r"^Sanjay")).first
        d.atw("pick", lead=0.4)
        try:
            sug.wait_for(timeout=1200); d.click(sug, after=0.3)
        except Exception:
            ref.press_sequentially("ay Deshpande", delay=50)
        p.keyboard.press("Tab")
    d.beat("new3", new3)

    def new4():
        src = d.select_with("Channel Partner", scope=d.M())
        d.choose(src, word="Channel", lead=0.2, label="Channel Partner")
        box = d.M().get_by_placeholder("Search partners…")
        d.atw("type", lead=0.6); d.type(box, PARTNER_Q, delay=110)
        opt = d.M().get_by_text(re.compile(PARTNER_Q, re.I)).first
        d.atw("pick", lead=0.4); d.hover(opt, 0.3)
        d.atw("new", lead=0.5); d.soft(lambda: d.hover(d.M().get_by_text(re.compile(r"Add .*new partner")).first, 0.3), "add-partner row")
        d.atw("itself", lead=0.1); d.click(opt, after=0.5)
        d.ptr.move_to(960, 420)
    d.beat("new4", new4)

    def new5():
        d.click(d.btn("Continue", scope=d.M()))
        d.choose(d.select_with("— Not decided yet —", scope=d.M()), word="project", lead=0.1, value="P-AN")
        d.choose(d.select_with("— Not known yet —", scope=d.M()), word="two", n=2, lead=0.2, label="2 BHK")
        bud = d.M().get_by_placeholder("e.g. 75 L")
        hint = lambda: d.M().get_by_text(re.compile(r"^=\s*₹")).first
        d.atw("budget", lead=0.5); d.hover(bud, 0.2)
        d.atw("rupees", lead=0.6); d.type(bud, "4500000", delay=70)
        d.atw("forty", lead=0.4); d.type(bud, "45 L", delay=90)
        d.atw("crore", lead=0.3); d.soft(lambda: d.under(hint(), 0.5, 0.2), "budget hint")
        d.atw("understands", lead=0.3); d.soft(lambda: d.under(hint(), 0.9, 0.2), "budget hint 2")
        d.atw("Add", lead=0.6); d.type(d.M().locator("textarea").first, "Wants a 2 BHK on a higher floor. Will visit with family this week.", delay=26)
    d.beat("new5", new5)

    def new6():
        d.click(d.btn("Continue", scope=d.M())); d.ptr.move_to(960, 450, steps=15)
        stage = d.M().locator("select").first
        d.atw("stage", lead=0.4); d.choose(stage, word="priority", lead=0.6, value="new")
        d.atw("priority", lead=0.1); d.click(d.btn("High", scope=d.M()), after=0.3)
        d.atw("summary", lead=0.5); d.soft(lambda: d.hover(d.M().get_by_text("QUICK SUMMARY").first, 0.3), "summary")
        d.atw("Save", lead=0.7); d.click(d.btn("Save lead", scope=d.M()))
        p.get_by_text("Capture a new lead").or_(p.get_by_text("New lead: " + DEMO)).first.wait_for(state="hidden", timeout=20000)
        d.atw("created", lead=0.4); d.soft(lambda: d.under(p.get_by_text(DEMO, exact=True).filter(visible=True).first, 0.5, 0.2), "new row")
        d.atw("assigned", lead=0.5); d.soft(lambda: d.under(p.get_by_text("Aniruddha", exact=True).filter(visible=True).first, 0.5, 0.2), "a rep's lead")
        d.atw("Otherwise", lead=0.4); d.soft(lambda: d.under(p.get_by_text("Unassigned", exact=True).filter(visible=True).first, 0.5, 0.2), "unassigned")
        d.atw("see", lead=0.5); d.type(search(), "Rohan Kulkarni", delay=45)
    d.beat("new6", new6)

    # ---- lead drawer
    def drawer1():
        row = p.get_by_text(DEMO, exact=True).filter(visible=True).first
        row.wait_for(timeout=15000)
        d.atw("Click", lead=0.6); d.click(row, after=0.8)
        name = p.get_by_text(DEMO, exact=True).filter(visible=True).last
        d.atw("name", lead=0.5); d.under(name, 0.5, 0.2)
        d.atw("phone", lead=0.5); d.soft(lambda: d.under(p.get_by_text(DEMO_PHONE, exact=True).filter(visible=True).last, 0.5), "phone")
        d.atw("I", lead=0.5); d.soft(lambda: d.under(p.get_by_text(re.compile(r"^LD-\d{4}$")).filter(visible=True).last, 0.5), "lead id")
        for word, lbl in [("Log", "Log call"), ("WhatsApp", "WhatsApp"), ("Email", "Email"), ("Schedule", "Schedule visit"), ("Edit", "Edit details")]:
            d.atw(word, lead=0.45); d.hover(d.btn(lbl), 0.1)
    d.beat("drawer1", drawer1)

    def drawer2():
        d.atw("status", lead=0.5); d.hover(d.label_select("Status"), 0.3)
        d.atw("assign", lead=0.5); d.hover(d.label_select("Assign to"), 0.3)
        d.atw("Let", lead=0.2); d.choose(d.label_select("Assign to"), word="Avinash", lead=0.1, value=REP)
        d.soft(lambda: d.hover(p.get_by_text("Owner: " + REP).filter(visible=True).first, 0.6), "owner fact")
    d.beat("drawer2", drawer2)

    def drawer3():
        d.chapter(4, "Calls, visits &amp; tasks")
        d.atw("log", lead=0.7); d.click(d.btn("Log call"))
        ta = d.M().locator("textarea").first
        d.atw("Type", lead=0.4); d.type(ta, f"Spoke to Rohan. Interested in a 2 BHK at Abhiman Niwas, budget about 45 lakh. Coming for a site visit on {dates['visit_day']}.", delay=20)
        d.atw("Log", 2, lead=0.7); d.click(d.btn("Log", scope=d.M()))
        d.atw("Activity", lead=0.4); d.soft(lambda: d.under(p.get_by_text(re.compile("Spoke to Rohan")).filter(visible=True).first, 0.3, 0.3), "timeline")
        d.atw("complete", lead=0.3); d.ptr.move_to(1300, 520, steps=20); d.ptr.move_to(1300, 760, steps=40)
    d.beat("drawer3", drawer3)

    def drawer4():
        contacted = next((sid for sid, lbl in d.stages if lbl.lower().startswith("contact")), "contacted")
        d.atw("move", lead=0.5); d.choose(d.label_select("Status"), word="Contacted", lead=0.1, value=contacted)
        d.atw("phone", lead=0.5); d.soft(lambda: d.under(p.get_by_text(DEMO_PHONE, exact=True).filter(visible=True).last, 0.5), "phone")
        d.atw("email", lead=0.5); d.soft(lambda: d.under(p.get_by_text("No email", exact=True).filter(visible=True).last, 0.5), "email")
        d.atw("budget", lead=0.5); d.soft(lambda: d.under(p.get_by_text(re.compile(r"^Budget")).filter(visible=True).last, 0.5), "budget")
        d.atw("source", lead=0.5); d.soft(lambda: d.under(p.get_by_text("Channel Partner", exact=True).filter(visible=True).last, 0.5), "source")
        d.atw("Edit", lead=0.7); d.click(d.btn("Edit details"))
        em = d.M().locator('input[type="email"]').first
        d.atw("change", lead=0.5); d.type(em, "rohan.kulkarni@example.com", delay=22)
        d.atw("save", lead=0.9); d.click(d.btn("Save changes", scope=d.M()))
        d.atw("recorded", lead=0.4); d.soft(lambda: d.under(p.get_by_text(re.compile("^Details updated")).filter(visible=True).first, 0.3, 0.2), "details updated")
    d.beat("drawer4", drawer4)

    def visit():
        d.atw("Schedule", lead=0.7); d.click(d.btn("Schedule visit"))
        dt = d.M().locator('input[type="date"]').first
        tm = d.M().locator('input[type="time"]').first
        num = d.M().locator('input[type="number"]').first
        d.atw("date", lead=0.5); d.ptr.to(dt, 0.2); d.ripple(); dt.fill(dates["visit"]); time.sleep(0.4)
        d.atw("time", lead=0.4); d.ptr.to(tm, 0.2); d.ripple(); tm.fill("11:30"); time.sleep(0.3)
        d.atw("number", lead=0.4); d.ptr.to(num, 0.2); d.ripple(); num.fill("3"); time.sleep(0.3)
        d.atw("note", lead=0.5); d.type(d.M().get_by_placeholder("Pickup, model flat, documents to carry…"), "Family of three. Show the G7 model flat.", delay=28)
        d.atw("Schedule", 2, lead=0.6); d.click(d.btn("Schedule visit", scope=d.M()))
        entry = lambda: p.get_by_text(re.compile("^Site visit scheduled")).filter(visible=True).first
        d.atw("shows", lead=0.5); d.soft(lambda: d.under(entry(), 0.25, 0.2), "visit entry")
        d.atw("timeline", lead=0.5); d.soft(lambda: d.under(entry(), 0.6, 0.2), "visit entry 2")
    d.beat("visit", visit)

    def task1():
        d.atw("Tasks", lead=0.6); d.click(d.btn("Tasks"))
        d.atw("follow", lead=0.4); d.soft(lambda: d.point(p.get_by_text(re.compile("No open tasks")).filter(visible=True).first, 0.1), "empty tasks")
        d.atw("cost", lead=0.4); d.hover(d.btn("New task"), 0.2)
        d.atw("Click", lead=0.6); d.click(d.btn("New task"))
        d.atw("write", lead=0.5); d.type(d.M().get_by_placeholder("e.g. Call back about pricing"), "Share cost sheet for 2 BHK", delay=45)
        d.atw("type", lead=0.3); d.choose(d.select_with("Follow-up call", scope=d.M()), hold=0.6, label="Send documents")
    d.beat("task1", task1)

    def task2():
        d.atw("assign", lead=0.4); d.choose(d.select_with("— Not assigned —", scope=d.M()), word="member", lead=0.2, value=REP)
        dt = d.M().locator('input[type="date"]').first
        tm = d.M().locator('input[type="time"]').first
        d.atw("due", lead=0.4); d.ptr.to(dt, 0.2); d.ripple(); dt.fill(dates["tomorrow"]); time.sleep(0.3)
        d.atw("time", lead=0.3); d.ptr.to(tm, 0.2); d.ripple(); tm.fill("16:00"); time.sleep(0.2)
        d.atw("Create", lead=0.7); d.click(d.btn("Create task", scope=d.M()))
        d.atw("appears", lead=0.4); d.soft(lambda: d.under(p.get_by_text("Share cost sheet for 2 BHK").filter(visible=True).first, 0.4, 0.2), "task row")
        d.atw("ticks", lead=0.6); d.soft(lambda: d.hover(p.locator('[title="Mark as done"]').filter(visible=True).first, 0.4), "task tick")
    d.beat("task2", task2)

    def tabs():
        d.atw("Unit", lead=0.6); d.click(d.btn("Unit interest"), after=0.3)
        d.atw("available", lead=0.3); d.ptr.move_to(1300, 520, steps=20); d.ptr.move_to(1600, 640, steps=25)
        d.atw("Documents", lead=0.6); d.click(d.btn("Documents"), after=0.3)
        d.atw("upload", lead=0.5); d.hover(d.btn("Upload"), 0.3)
    d.beat("tabs", tabs)

    def email1():
        d.chapter(5, "AI email assistant")
        d.atw("Email", lead=0.7); d.click(d.btn("Email"))
        d.atw("type", lead=0.3); d.choose(d.select_with("Site visit invite", scope=d.M()), word="tell", lead=0.6, label="Site visit invite")
        d.type(d.M().get_by_placeholder("e.g. Invite them for a Saturday site visit and attach the cost sheet"),
               f"Invite them for the site visit on {dates['visit_day']} at 11:30 am and mention the 2 BHK options in tower G7.", delay=11)
        b = d.btn("Draft with AI", scope=d.M())
        d.atw("Draft", lead=0.7)
        if AI_UP:
            d.click(b, after=0.2)
        else:
            d.hover(b, 0.3)
    d.beat("email1", email1)

    def wait_draft():
        if not AI_UP:
            return
        with d.cut():     # the AI takes a few seconds; the wait is removed from the video
            p.wait_for_function("() => { const i = [...document.querySelectorAll('input')].find(x => x.placeholder === 'Subject line'); return i && i.value.length > 3; }",
                                timeout=120000)
            time.sleep(0.4)

    def email2():
        d.atw("subject", lead=0.4); d.point(d.M().get_by_placeholder("Subject line"), 0.1, 0.5, 0.2)
        d.atw("body", lead=0.4); d.point(d.M().locator("textarea").last, 0.15, 0.2, 0.2)
        d.atw("project", lead=0.3); d.ptr.move_to(900, 780, steps=40)
        d.atw("send", 1, lead=0.4); d.soft(lambda: d.scroll(500, 8, 960, 700), "composer scroll")
        d.atw("Settings", lead=1.6); d.soft(lambda: (d.scroll(-900, 8, 960, 600), d.point(d.M().get_by_text(re.compile("No sending email is set up")).first, 0.1, 0.5, 0.2)), "no account banner")
    d.beat("email2", email2, pre=wait_draft)

    # ---- My Day + Site Visits
    cal_date = lambda: p.locator('input[type="date"][title="Go to date"]').first

    def leave_composer():
        d.click(d.btn("Cancel", scope=d.M()), after=0.6)
        if d.M().count():
            d.click(d.btn("Cancel", scope=d.M()), after=0.6)
        d.close_drawer()

    def myday1():
        d.nav("My Day", expect=cal_date); d.chapter(6, "My Day calendar")
        d.atw("calendar", lead=0.3); d.ptr.move_to(700, 420, steps=25); d.ptr.move_to(1400, 620, steps=40)
        who = d.select_with("Everyone (team)")
        d.atw("Calendar", 2, lead=0.5); d.hover(who, 0.2)
        d.atw("pick", lead=0.3); d.choose(who, word="member", lead=0.1, value=REP)
        d.atw("Everyone", lead=0.4); d.peek(who, hold=1.0, label="Everyone (team)")
        d.atw("visit", lead=0.4); d.soft(lambda: d.under(p.get_by_text(re.compile("Rohan Kulkarni")).filter(visible=True).first, 0.5, 0.3), "visit item")
        d.atw("task", lead=0.4); d.soft(lambda: d.under(p.get_by_text(re.compile("Share cost sheet")).filter(visible=True).first, 0.5, 0.3), "task item")
    d.beat("myday1", myday1, pre=leave_composer)

    def myday2():
        d.atw("project", lead=0.3); d.choose(p.locator('select[title="Filter by project"]').first, hold=0.5, value="P-AN")
        d.atw("switch", lead=0.6); cal_date().fill(dates["tomorrow"]); d.click(d.btn("Day"), after=0.3)   # a day that has the task
        d.atw("day", lead=0.3); d.click(d.btn("Week"), after=0.3)
        d.atw("jump", lead=0.4); d.ptr.to(cal_date(), 0.2); d.ripple(); cal_date().fill(dates["nextweek"]); time.sleep(0.4)
        d.atw("today", lead=0.6); d.click(d.btn("Today"), after=0.3)
        d.atw("Click", lead=0.3); d.hover(p.get_by_text(re.compile("Rohan Kulkarni")).filter(visible=True).first, 0.2)
        d.atw("open", lead=0.6); d.click(p.get_by_text(re.compile("Rohan Kulkarni")).filter(visible=True).first, after=0.6)
    d.beat("myday2", myday2)

    def visits():
        d.nav("Site Visits", expect=lambda: p.get_by_text(re.compile("ALL VISITS", re.I)).filter(visible=True).first)
        d.atw("whole", lead=0.4); d.ptr.move_to(700, 420, steps=25); d.ptr.move_to(1500, 520, steps=40)
        d.atw("booked", lead=0.5); d.soft(lambda: d.point(p.get_by_text(re.compile("Rohan Kulkarni")).filter(visible=True).first, 0.2), "demo visit")
        d.atw("week", lead=0.6); d.ptr.to(cal_date(), 0.2); d.ripple(); cal_date().fill(dates["far"]); time.sleep(0.5)
        jump = p.get_by_text(re.compile("Jump to the latest visit")).filter(visible=True).first
        d.atw("link", lead=0.4); d.soft(lambda: d.hover(jump, 0.3), "jump link")
        d.atw("latest", lead=0.2); d.soft(lambda: d.click(jump, after=0.4), "jump")
    d.beat("visits", visits, pre=d.close_drawer)

    # ---- inventory
    unit = lambda: p.get_by_text(re.compile(r"^G7.501$")).filter(visible=True).first

    def inv1():
        d.nav("Inventory", expect=lambda: d.btn("New project")); d.chapter(7, "Inventory &amp; unit holds")
        d.atw("Select", lead=0.6); d.click(p.locator("button").filter(has_text="Abhiman Niwas").filter(visible=True).first)
        d.atw("project", 2, lead=0.4); d.point(p.get_by_text("Abhiman Niwas", exact=True).filter(visible=True).last, 0.2)
        d.atw("every", lead=0.4); d.scroll_to(unit(), 0.55); d.ptr.move_to(600, 560, steps=20); d.ptr.move_to(1000, 760, steps=30)
        for lbl in ["available", "blocked", "reserved", "sold"]:
            d.atw(lbl, lead=0.45)
            d.soft(lambda: d.hover(p.locator("button").filter(has_text=re.compile(r"^\s*" + lbl + r"\s*\d", re.I)).filter(visible=True).first, 0.1), lbl)
    d.beat("inv1", inv1)

    def inv2():
        d.atw("Click", lead=0.6); d.click(unit(), after=0.6)
        for word, lbl in [("carpet", "Carpet"), ("price", "Price"), ("status", "AVAILABLE")]:
            d.atw(word, lead=0.4)
            d.soft(lambda: d.under(p.get_by_text(lbl, exact=True).filter(visible=True).last, 0.5, 0.2), word)
        d.atw("Request", lead=0.7); d.click(d.btn("Request hold"))
        d.atw("select", lead=0.6); d.type(d.M().get_by_placeholder("Search name, phone, ID…"), "Rohan", delay=80)
        d.click(d.M().locator("button").filter(has_text=DEMO).first, after=0.3)
        d.atw("outside", lead=0.5); d.soft(lambda: d.hover(d.M().get_by_text("Outside enquiry", exact=True).first, 0.3), "outside toggle")
        d.atw("submit", lead=0.7); d.click(d.btn("Submit request", scope=d.M()), after=0.6)
        d.atw("manager", lead=0.4); d.soft(lambda: d.under(p.get_by_text(re.compile(r"HOLD REQUESTED", re.I)).filter(visible=True).first, 0.5, 0.2), "pending")
    d.beat("inv2", inv2)

    # ---- documents
    def docs1():
        d.nav("Documents", expect=lambda: d.btn("Upload")); d.chapter(8, "Documents &amp; approvals")
        d.atw("project", lead=0.5); d.soft(lambda: d.hover(d.select_with("All projects"), 0.2), "proj filter")
        d.atw("Click", lead=0.7); d.click(d.btn("Upload"))
        d.atw("choose", lead=0.5)
        with p.expect_file_chooser(timeout=10000) as fc:
            d.click(d.M().get_by_text("Click to choose a file").first, after=0.2)
        fc.value.set_files(str(PDF)); time.sleep(0.4)
        proj = d.M().locator("select").filter(has=p.locator('option[value="P-AN"]')).first
        d.atw("project", 2, lead=0.5); d.choose(proj, hold=0.15, value="P-AN")
        d.atw("category", lead=0.5); d.choose(d.select_with("Brochure", scope=d.M()), hold=0.2, label="Brochure")
        d.atw("shareable", lead=0.6); d.click(d.M().get_by_text("Mark as shareable").first.locator("xpath=preceding-sibling::button"), after=0.3)
        d.click(d.btn("Upload", scope=d.M()))
        p.get_by_text(DOC_TITLE).filter(visible=True).first.wait_for(timeout=30000)
    d.beat("docs1", docs1, pre=d.esc)

    def docs2():
        d.atw("clicks", lead=0.6); d.click(d.row(DOC_TITLE, "Share with a lead").locator("button").filter(has_text=rx("Share with a lead")).first)
        d.atw("selects", lead=0.5); d.type(d.M().get_by_placeholder("Search name, phone, ID…"), "Rohan", delay=80)
        d.click(d.M().locator("button").filter(has_text=DEMO).first, after=0.2)
        d.click(d.btn("Request share", scope=d.M()), after=0.5)
        d.atw("pending", lead=0.4); d.soft(lambda: d.point(p.get_by_text(re.compile("^\\s*PENDING\\s*$")).filter(visible=True).first, 0.2), "pending badge")
        d.atw("manager", lead=0.4); d.soft(lambda: d.hover(d.row(DOC_TITLE, "Approve").locator("button").filter(has_text=rx("Approve")).first, 0.3), "approve btn")
        d.atw("secure", lead=0.4); d.ptr.move_to(1200, 560, steps=25)
    d.beat("docs2", docs2)

    # ---- approvals
    hold_row = lambda b: d.row(re.compile(r"HOLD · AN"), b)
    share_row = lambda b: d.row(DOC_TITLE, b)

    def appr1():
        d.nav("Approvals", expect=lambda: p.get_by_text(re.compile(r"^Pending · \d+$")).filter(visible=True).first)
        d.atw("Unit", lead=0.4); d.soft(lambda: d.point(hold_row("Approve"), 0.2), "hold row")
        d.atw("document", lead=0.4); d.soft(lambda: d.point(share_row("Approve"), 0.2), "share row")
        d.atw("Approve", lead=0.7); d.click(hold_row("Approve").locator("button").filter(has_text=rx("Approve")).first, after=0.8)
        d.atw("document", 2, lead=0.8); d.click(share_row("Approve").locator("button").filter(has_text=rx("Approve")).first, after=0.8)
    d.beat("appr1", appr1)

    def appr2():
        d.atw("Active", lead=0.4); d.soft(lambda: d.under(p.get_by_text(re.compile(r"^Active · \d+$")).filter(visible=True).first, 0.5, 0.2), "active heading")
        d.ptr.move_to(700, 340, steps=15); d.ptr.move_to(700, 415, steps=15)
        d.atw("release", lead=0.7); d.click(hold_row("Release").locator("button").filter(has_text=rx("Release")).first, after=0.5)
        d.atw("copy", lead=0.7); d.soft(lambda: d.click(share_row("Copy link").locator("button").filter(has_text=rx("Copy link")).first, after=0.4), "copy link")
        d.atw("revoke", lead=0.6); d.click(share_row("Revoke").locator("button").filter(has_text=rx("Revoke")).first, after=0.5)
    d.beat("appr2", appr2)

    # ---- empty modules, partners, reports
    def empty():
        d.nav("Bookings"); d.chapter(9, "Bookings, partners &amp; reports")
        d.atw("payment", lead=0.6); d.nav("Payments")
        d.atw("marketing", lead=0.6); d.nav("Campaigns")
        d.atw("building", lead=0.5); d.soft(lambda: d.hover(d.btn("New campaign"), 0.3), "new campaign")
    d.beat("empty", empty)

    def partners():
        d.nav("Partners", expect=lambda: p.get_by_placeholder("Search name, contact, phone…"))
        d.atw("Search", lead=0.6); d.type(p.get_by_placeholder("Search name, contact, phone…"), PARTNER_Q, delay=110)
        d.atw("tier", lead=0.4); d.peek(d.select_with("All tiers"), hold=1.0)
        d.atw("View", lead=0.6); d.click(d.btn("View leads"), after=0.6)
        d.atw("New", lead=0.9); d.ptr.move_to(330, 1000); d.ripple(); p.mouse.down(); p.mouse.up(); time.sleep(0.3)
        d.atw("Onboard", lead=0.6); d.click(d.btn("Onboard partner"), after=0.6)
        d.at(DUR["partners"] + GAP - 0.9); d.click(d.btn("Cancel", scope=d.M()), after=0.1)
    d.beat("partners", partners)

    def reports():
        d.nav("Reports", expect=lambda: d.btn("Export CSV"))
        for word, lbl in [("Bookings", "GROSS BOOKINGS"), ("units", "UNITS SOLD"), ("conversion", "LEAD → BOOKING")]:
            d.atw(word, lead=0.45); d.soft(lambda: d.point(d.text(lbl), 0.25, 3.0, 0.1), lbl)
        d.atw("trend", lead=0.4); d.soft(lambda: d.under(d.text("Visits & bookings trend"), 0.5, 0.2), "trend")
        d.ptr.move_to(700, 420, steps=30)
        d.atw("sources", lead=0.8); d.scroll_to(d.text("Lead sources"), 0.3); d.under(d.text("Lead sources"), 0.5, 0.1)
        d.atw("project", lead=0.4); d.soft(lambda: d.under(d.text("Sales velocity by project"), 0.5, 0.2), "velocity")
        d.atw("Export", lead=1.2); d.scroll(-2400, 10); d.hover(d.btn("Export CSV"), 0.2)
    d.beat("reports", reports)

    # ---- settings
    def set1():
        d.nav("Settings", expect=lambda: p.locator("nav button").filter(has_text=rx("Workspace")).first); d.chapter(10, "Settings in detail")
        d.atw("currency", lead=0.5); d.soft(lambda: d.hover(p.locator('input[value="INR (₹)"]').first, 0.2), "currency")
        d.atw("time", lead=0.5); d.soft(lambda: d.point(p.locator('input[value="Asia/Kolkata (IST)"]').first, 0.93, 0.6, 0.2), "tz")
    d.beat("set1", set1)

    def set2():
        d.atw("Team", lead=0.6); d.settings_nav("Team & roles")
        d.atw("team", 2, lead=0.3); d.ptr.move_to(800, 330, steps=20); d.ptr.move_to(800, 470, steps=25)
        d.atw("logins", lead=0.4); d.soft(lambda: d.point(p.get_by_text(re.compile(r"@shradharealty\.in$")).filter(visible=True).first, 0.1), "login email")
        d.atw("site", lead=0.4); d.soft(lambda: d.hover(p.locator('select[title="Site"]').first, 0.2), "site col")
        site = p.locator("div").filter(has_text=REP).filter(has=p.locator('select[title="Site"]')).filter(visible=True).last.locator('select[title="Site"]').first
        d.atw("Avinash", lead=0.5); d.soft(lambda: d.under(p.get_by_text(REP, exact=True).filter(visible=True).first, 0.5), "avinash")
        d.atw("Abhiman", lead=0.5); d.soft(lambda: d.point(site, 0.15), "avinash site")
        d.atw("change", lead=0.4); d.soft(lambda: d.peek(site, hold=1.6), "peek site")
    d.beat("set2", set2)

    def set3():
        d.atw("Add", 2, lead=0.7); d.click(d.btn("Add member"))
        d.atw("name", lead=1.0); d.type(d.M().get_by_placeholder("e.g. Anita Kulkarni"), "Priya Sharma", delay=28)
        d.atw("role", lead=0.3); d.soft(lambda: d.hover(d.M().locator("select").first, 0.1), "role")
        d.atw("phone", lead=0.3); d.soft(lambda: d.hover(d.M().get_by_placeholder("+91…"), 0.1), "phone")
        d.atw("site", lead=0.3); d.soft(lambda: d.hover(d.select_with("— No particular site —", scope=d.M()), 0.1), "site")
        d.atw("email", lead=0.3); d.soft(lambda: d.hover(d.M().get_by_placeholder("name@shradha.in"), 0.1), "email")
        cb = d.M().get_by_text(re.compile("login for this person", re.I)).first.locator("xpath=preceding-sibling::button")
        d.atw("tick", lead=0.6); d.soft(lambda: d.click(cb, after=0.4), "tick login")
        d.atw("password", lead=0.4); d.soft(lambda: d.hover(d.M().locator("select").last, 0.3), "login role")
        d.at(DUR["set3"] + GAP - 0.8); d.click(d.btn("Cancel", scope=d.M()), after=0.1)
    d.beat("set3", set3)

    def users_pre():
        d.settings_nav("Users & access")
        p.get_by_text(re.compile(r"logins · people")).first.wait_for(timeout=10000); time.sleep(0.3)

    def set4():
        d.atw("manages", lead=0.3); d.ptr.move_to(900, 420, steps=20); d.ptr.move_to(900, 600, steps=30)
        d.atw("Click", lead=0.6); d.click(d.btn("Add login"))
        d.atw("name", lead=0.6); d.type(d.M().get_by_placeholder("e.g. Aniruddha Mahakulkar"), "Priya Sharma", delay=40)
        d.atw("email", lead=0.4); d.type(d.M().get_by_placeholder("name@shradharealty.in"), "priya@shradharealty.in", delay=30)
        acc = d.M().locator("select").filter(has=p.locator("option", has_text="Sales Executive")).first
        d.atw("access", 2, lead=0.3); d.soft(lambda: d.peek(acc, hold=0.9), "access")
        d.atw("temporary", lead=0.4); d.soft(lambda: d.point(d.M().get_by_text(re.compile("temporary password", re.I)).first, 0.1, 2.2, 0.2), "temp pw")
        d.atw("Create", 2, lead=0.5); d.point(d.btn("Create login", scope=d.M()), 0.1, 0.6, 0.2)
        d.atw("Copy", lead=0.4); d.ptr.move_to(960, 560, steps=25)
    d.beat("set4", set4, pre=users_pre)

    def set5():
        acc = d.M().locator("select").filter(has=p.locator("option", has_text="Sales Executive")).first
        d.atw("four", lead=0.3); d.hover(acc, 0.2)
        for i, (word, n) in enumerate([("Sales", 1), ("Sales", 2), ("Finance", 1), ("Admin", 1)]):
            d.atw(word, n, lead=0.3); d.soft(lambda: d.choose(acc, hold=0.45, index=i), f"access {i}")
        d.atw("From", lead=0.9); d.click(d.btn("Cancel", scope=d.M()), after=0.3)
        r = lambda b: p.locator("div").filter(has_text="avinash@shradharealty.in").filter(has=p.locator("button").filter(has_text=rx(b))).filter(visible=True).last
        d.soft(lambda: d.point(r("Set password"), 0.3, 0.5, 0.1), "to avinash")
        d.atw("reset", lead=0.4); d.soft(lambda: d.hover(r("Set password").locator("button").filter(has_text=rx("Set password")).first, 0.2), "set pw")
        d.atw("role", lead=0.4); d.soft(lambda: d.hover(r("Set password").locator("select").last, 0.2), "role")
        d.atw("disable", lead=0.4); d.soft(lambda: d.hover(r("Disable").locator("button").filter(has_text=rx("Disable")).first, 0.2), "disable")
    d.beat("set5", set5)

    def set6():
        d.atw("Projects", lead=0.6); d.settings_nav("Projects")
        d.atw("all", lead=0.2); d.scroll(500, 10, 1000, 600); d.scroll(-500, 8, 1000, 600)
        d.atw("Lead", lead=0.6); d.settings_nav("Lead stages")
        d.atw("New", lead=0.3); d.soft(lambda: d.point(p.get_by_text("New", exact=True).filter(visible=True).last, 0.2), "stage new")
        d.atw("Sources", lead=0.6); d.settings_nav("Sources")
        d.atw("add", lead=0.6); d.type(p.get_by_placeholder("Add a source…"), "Demo Portal", delay=55)
        d.click(d.btn("Add"), after=0.2)
        chip = p.locator("div").filter(has_text=rx("Demo Portal")).filter(visible=True).last
        chip.wait_for(timeout=8000); d.hover(chip, 0.2)
        d.atw("remove", lead=0.6); d.click(chip.locator('button[title="Remove"]').first, after=0.3); d.confirm_yes()
    d.beat("set6", set6)

    def set7():
        d.settings_nav("Email")
        d.atw("adds", lead=0.6); d.click(d.btn("Add email account"))
        d.atw("App", lead=0.4); d.soft(lambda: d.point(d.M().get_by_placeholder("16-character app password"), 0.1), "app pw")
        d.atw("Templates", lead=1.0); d.click(d.btn("Cancel", scope=d.M()), after=0.2); d.settings_nav("Templates")
        d.atw("Integrations", lead=0.6); d.settings_nav("Integrations")
        d.atw("WhatsApp", lead=0.4); d.soft(lambda: d.under(p.get_by_text("WhatsApp Business", exact=True).filter(visible=True).first, 0.5), "wa")
    d.beat("set7", set7)

    def pwd():
        link = p.get_by_text("Change password", exact=True).filter(visible=True).first
        d.atw("click", lead=0.4); d.under(link, 0.5)
        d.atw("name", lead=0.4); d.soft(lambda: d.point(p.get_by_text("Admin", exact=True).filter(visible=True).last, 0.2), "your name")
        d.atw("Enter", lead=0.9); d.click(link, after=0.4)
        pw = lambda i: d.M().locator('input[type="password"]').nth(i)
        d.atw("current", lead=0.3); d.soft(lambda: d.point(pw(0), 0.1), "current")
        d.atw("new", lead=0.3); d.soft(lambda: d.point(pw(1), 0.1), "new")
        d.atw("twice", lead=0.3); d.soft(lambda: d.point(pw(2), 0.1), "confirm")
        d.atw("save", lead=0.4); d.soft(lambda: d.hover(d.btn("Change password", scope=d.M()), 0.2), "save")
    d.beat("pwd", pwd)

    def outro_pre():
        with d.cut():      # close the dialog inside the cut: the film goes straight from it to the outro card
            d.soft(lambda: d.click(d.btn("Cancel", scope=d.M()), after=0.3), "close pw")
            p.set_content(OUTRO, wait_until="load"); time.sleep(0.15)
        d.ptr.move_to(1750, 1000)
    d.beat("outro", lambda: None, pre=outro_pre)
    time.sleep(1.5)
    return d


def make_pdf(browser):
    c = browser.new_context(); pg = c.new_page()
    pg.set_content(BROCHURE, wait_until="networkidle"); pg.pdf(path=str(PDF), format="A4", print_background=True)
    c.close()


if __name__ == "__main__":
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, args=["--disable-features=Translate", "--hide-scrollbars"])
        if not PDF.exists():
            make_pdf(b)
        AI_UP = ai_up()
        ctx = new_context(b, record_dir=None if DRY else OUT, logged_in=False)
        ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
        page = ctx.new_page()
        page.on("dialog", lambda dlg: dlg.accept())
        page.set_default_timeout(15000)
        d = None
        try:
            d = run(page, ctx)
        finally:
            vid = page.video.path() if page.video else None
            ctx.close(); b.close()
            if d:
                (OUT / "timings.json").write_text(json.dumps({"video": str(vid), "beats": d.timings, "cuts": d.cuts,
                                                              "errors": d.errors, "ai_up": AI_UP}, indent=1))
                print("ERRORS:", len(d.errors)); [print("  ", e) for e in d.errors]
            print("VIDEO:", vid)
