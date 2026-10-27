"""Shared helpers for the demo recording: browser setup, a visible cursor, smooth clicks."""
import pathlib
import re
import time

BASE = "https://erp.jewonline.in"
APP = BASE + "/app/realty-crm"
HERE = pathlib.Path(__file__).parent
W, H = 1920, 1080


def read_sid():
    txt = (HERE / "sid.txt").read_text()
    return re.search(r"SID (\w+)", txt).group(1)


# A visible mouse pointer + click ripple (headless recordings have no cursor) and a
# caption-safe bottom margin. Injected into every document.
CURSOR_JS = r"""
(() => {
  if (window.__demoCursor) return;
  window.__demoCursor = true;
  const make = () => {
    if (document.getElementById('demo-cursor')) return;
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    c.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.6 14.8 L11.6 21.6 L14.4 20.4 L11.4 13.6 L17.6 13.6 Z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, {position: 'fixed', left: '0px', top: '0px', zIndex: 2147483647, pointerEvents: 'none',
      transform: 'translate(-4px,-2px)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))', opacity: '0', transition: 'opacity .2s'});
    document.documentElement.appendChild(c);
    const r = document.createElement('div');
    r.id = 'demo-ripple';
    Object.assign(r.style, {position: 'fixed', width: '44px', height: '44px', marginLeft: '-22px', marginTop: '-22px',
      borderRadius: '50%', border: '3px solid rgba(232,169,91,.95)', background: 'rgba(232,169,91,.25)',
      zIndex: 2147483646, pointerEvents: 'none', opacity: '0', transform: 'scale(.4)', transition: 'all .45s ease-out'});
    document.documentElement.appendChild(r);
  };
  const move = (e) => { make(); const c = document.getElementById('demo-cursor'); c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; c.style.opacity = '1'; };
  document.addEventListener('mousemove', move, true);
  document.addEventListener('mousedown', (e) => {
    make(); const r = document.getElementById('demo-ripple');
    r.style.transition = 'none'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
    r.style.opacity = '1'; r.style.transform = 'scale(.4)';
    requestAnimationFrame(() => { r.style.transition = 'all .5s ease-out'; r.style.opacity = '0'; r.style.transform = 'scale(1.6)'; });
  }, true);
  if (document.readyState !== 'loading') make(); else document.addEventListener('DOMContentLoaded', make);
})();
"""


class Pointer:
    """Moves the (visible) mouse smoothly and clicks like a person would."""

    def __init__(self, page):
        self.page = page
        self.x, self.y = W / 2, H / 2

    def move_to(self, x, y, steps=None):
        dist = ((x - self.x) ** 2 + (y - self.y) ** 2) ** 0.5
        steps = steps or max(8, min(40, int(dist / 22)))
        self.page.mouse.move(x, y, steps=steps)
        self.x, self.y = x, y

    def to(self, locator, pause=0.25):
        locator.scroll_into_view_if_needed(timeout=8000)
        box = locator.bounding_box(timeout=8000)
        self.move_to(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        time.sleep(pause)
        return box

    def click(self, locator, pause=0.35, after=0.6):
        self.to(locator, pause)
        self.page.mouse.down(); time.sleep(0.06); self.page.mouse.up()
        time.sleep(after)

    def type_into(self, locator, text, delay=55, clear=True):
        self.click(locator, after=0.2)
        if clear:
            locator.fill("")
        locator.press_sequentially(text, delay=delay)
        time.sleep(0.3)

    def hover(self, locator, pause=0.8):
        self.to(locator, pause)

    def nudge(self):
        """Re-announce the pointer position to a freshly loaded document (shows the cursor)."""
        self.page.mouse.move(self.x + 1, self.y); self.page.mouse.move(self.x, self.y)


def new_context(browser, record_dir=None, logged_in=True):
    kw = dict(viewport={"width": W, "height": H}, device_scale_factor=1, locale="en-IN",
              timezone_id="Asia/Kolkata", accept_downloads=True)
    if record_dir:
        kw["record_video_dir"] = str(record_dir)
        kw["record_video_size"] = {"width": W, "height": H}
    ctx = browser.new_context(**kw)
    if logged_in:
        ctx.add_cookies([{"name": "sid", "value": read_sid(), "domain": "erp.jewonline.in", "path": "/",
                          "httpOnly": True, "secure": True, "sameSite": "Lax"},
                         {"name": "system_user", "value": "yes", "domain": "erp.jewonline.in", "path": "/"},
                         {"name": "user_id", "value": "crm.demo%40shradha.local", "domain": "erp.jewonline.in", "path": "/"},
                         {"name": "full_name", "value": "Admin", "domain": "erp.jewonline.in", "path": "/"}])
    ctx.add_init_script(CURSOR_JS)
    return ctx
