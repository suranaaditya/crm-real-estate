# dux_crm_realty — agent handoff / project context

**Read this first.** This is a custom **ERPNext v16 (Frappe v16) app** that implements the
**Shradha Realty** real-estate CRM — a pixel-perfect React UI (ported from a Claude-Design
prototype) backed by real Frappe DocTypes + whitelisted APIs. The whole app renders as a
single-page React app mounted on a Frappe **desk page** at `/app/realty-crm`.

> Design principle (borrowed from `dux_cybervidya`): **keep the prototype UI exactly; the only
> substitution is the data source.** `api/crm.get_bootstrap` returns live data in the exact shape of
> the prototype's `window.CRM_DATA`, so the ported React components render unchanged.

---

## Environment (dev server)

| | |
|---|---|
| SSH | `ssh frappe@187.127.132.58` (ed25519 key at `~/.ssh/id_ed25519`, paired with server + GitHub) |
| Bench | `/home/frappe/frappe-bench` |
| Site | `erp.jewonline.in` → https://erp.jewonline.in (shared box — do NOT touch other sites/apps) |
| Versions | Frappe 16.x, ERPNext 16.x, Node 24, Yarn 1.22 |
| App page | **https://erp.jewonline.in/app/realty-crm** |
| Test login | `crm.demo@shradha.local` / `Realty@1234` (System Manager + Realty Admin) |
| API token (Administrator, for HTTP tests) | `1dacdb9682a6ec9:8eb2714dcfdf091` — `Authorization: token <key:secret>` |

The app is developed **locally** (this folder) and deployed to the server. Local is the source of
truth; the server additionally holds built assets + Frappe-generated files.

---

## Deploy loop — READ CAREFULLY

**This box runs under `supervisor`, NOT `bench start`. NEVER run `bench restart`.**

1. **Edit locally**, then rsync up:
   ```bash
   rsync -az --exclude '.git' --exclude '__pycache__' --exclude '*.pyc' \
     --exclude 'node_modules' --exclude 'public/dist' \
     ./ frappe@187.127.132.58:'frappe-bench/apps/dux_crm_realty/'
   ```
2. **DocType / JSON / fixtures change** → on server:
   `bench --site erp.jewonline.in migrate && bench --site erp.jewonline.in clear-cache`
3. **Python (.py) change** → `clear-cache` **and** SIGTERM the gunicorn master (gunicorn runs
   `--preload`, so workers cache stale imports):
   ```bash
   bench --site erp.jewonline.in clear-cache
   SUP=$(pgrep -x supervisord | head -1)
   MASTER=$(ps -ef | awk -v sup="$SUP" '/gunicorn -b 127\.0\.0\.1:8000/ && !/grep/ && $3==sup {print $2}')
   kill -TERM "$MASTER"   # supervisor respawns in ~2s
   ```
4. **JS / CSS change** → `bench build --app dux_crm_realty`
5. React deps (`react`, `react-dom`) live in this app's `package.json`; run `yarn install` in the
   app dir once on the server so esbuild can resolve them.

New DocTypes are created programmatically: edit `install.py`, then
`bench --site erp.jewonline.in execute dux_crm_realty.install.create_doctypes` (idempotent — skips
existing), `migrate`, then rsync the generated `doctype/<name>/` JSON back down for version control.

---

## Architecture & file map

```
dux_crm_realty/                         # python package (app)
  hooks.py                              # after_install -> install.after_install
  install.py                            # roles + ALL DocTypes (programmatic, idempotent)
  seed.py                               # run() seeds demo data from seed_data.json; seed_tasks()
  seed_data.json                        # exact prototype dataset (generated from data.js via Node)
  scripts/gen_seed.js                   # Node shim that dumps the prototype's CRM_DATA -> JSON
  api/crm.py                            # get_bootstrap + ALL whitelisted write endpoints
  dux_crm_realty/doctype/realty_*/      # DocType JSON + controllers (Frappe-generated)
  dux_crm_realty/page/realty_crm/       # desk page loader (realty_crm.js) + Page JSON
  public/css/realty_crm.css             # design tokens + base (PLAIN static file — see gotcha)
  public/images/                        # brand logos / project imagery
  public/js/realty_crm/                 # the React app (esbuild bundle)
    realty_crm.bundle.jsx               # entry: imports react, mounts, registers frappe.ui.RealtyCRM
    app-root.jsx                        # RealtyApp: router state, New-Lead modal, __refreshCRM
    components/shell.jsx                # Icon set, Avatar, StageBadge, ScoreChip, Sidebar, Topbar, Btn…
    components/forms.jsx                # Modal, Field/Input/Select, NewLeadModal, CreateProjectModal,
                                        #   AddUnitsModal, TaskModal
    components/lead-detail.jsx          # the lead drawer (tabs, schedule-visit modal, tasks)
    pages/direction-a.jsx               # Leads (table↔kanban, search, filters, KPIs, bulk, export)
    pages/page-calendar.jsx             # "My Day" — tasks + visits calendar (owner selector)
    pages/page-visits.jsx, page-inventory.jsx, page-bookings.jsx, page-payments.jsx,
    pages/page-partners.jsx, page-reports.jsx, page-settings.jsx, campaigns.jsx, workspace.jsx
design-reference/                       # the original Claude-Design prototype (pixel source of truth)
```

**Frontend mechanics:** esbuild builds `*.bundle.jsx` (`bench build`). React is imported per-file
(`import React from "react"`, the Raven pattern). Cross-component sharing uses **`window.*` globals**
(the prototype's own pattern — e.g. `window.Icon`, `window.Workspace`) which esbuild leaves as global
refs. The page loader (`page/realty_crm/realty_crm.js`) hides `.page-head` for a full-bleed surface,
loads the CSS as a plain asset, then `frappe.require("realty_crm.bundle.jsx")` and mounts
`new frappe.ui.RealtyCRM({ wrapper, page })`.

---

## Data model (DocTypes, all `Realty `-prefixed)

Realty **Project** (+ child Realty Tower), **Unit**, **Lead** (+ child Activity / Cost Sheet Item),
**Site Visit**, **Booking**, **Payment Due**, **Channel Partner**, **Campaign**, **Task** (standalone,
drives the calendar), and masters **Lead Stage / Lead Source / Sales Owner / Message Template /
Payment Plan**. Shapes map 1:1 to the prototype's `app/data.js`. Roles: `Realty Sales Executive /
Sales Manager / Finance / Admin`.

## Key API (all in `api/crm.py`, whitelisted)

- `get_bootstrap()` → the entire dataset in `window.CRM_DATA` shape (projects, leads, visits,
  bookings, paymentDues, campaigns, grids, tasks, stages, owners, currentUser, today …).
- Writes: `create_lead`, `log_activity`, `update_lead_stage`, `reassign_lead`, `bulk_reassign`,
  `schedule_visit`, `block_unit`, `advance_booking`, `record_receipt`, `send_reminder`,
  `process_payout`, `create_project`, `add_units`, `create_task`, `set_task_status`.

---

## Conventions & gotchas (don't relearn these the hard way)

- **CSS is a plain static file** (`public/css/realty_crm.css`) loaded by the page loader via
  `frappe.require("/assets/dux_crm_realty/css/realty_crm.css")`. Do **NOT** `import` it from the
  bundle — `frappe.require` loads the JS but does not inject CSS esbuild extracts from a JS import
  (symptom: all `:root` tokens empty → totally unstyled "missing background").
- **Pinned demo date:** the app's "today" is **2026-04-29** (`get_bootstrap()["today"]`, seed dates,
  `fmtRelative`, calendar anchors). New visits/tasks default their date to `CRM_DATA.today + N` so they
  land in the visible calendar week. Change in one place to go real-time (will empty the demo views).
- **Reserved Frappe fieldnames avoided:** use `sales_owner` (not `owner`), `lead_created` (not
  `creation`). "Entered by" = the doc's built-in `owner` (creator), surfaced as `enteredBy`.
- **Assignment model:** lead capture has NO assign field. `create_lead` records the creator and
  defaults `sales_owner` to that person if they're a Realty Sales Owner, else **Unassigned**. A
  manager assigns from the lead drawer (Status + Assign-to selects). Unassigned leads have
  `ownerName=null` → **always guard `ownerName.split(...)`** (it once blanked the whole list).
- **`bench browse` resolves the wrong host** on this box → use the API token above for HTTP tests.
- After a write, the UI calls `window.__refreshCRM()` (refetch `get_bootstrap`, re-render). The lead
  drawer keeps local state for the bits it mutates so it stays correct across refreshes.

## Verifying

- Backend: `bench --site erp.jewonline.in console`, or `curl` `get_bootstrap` with the API token.
- Browser: open `/app/realty-crm` (desk login). Exercise New-Lead, table↔kanban + filters/search,
  the lead drawer (status/assign/log-call/schedule-visit/tasks), Inventory (New project / Add units /
  block unit), Bookings (advance stage), Payments, My Day calendar (create task, owner selector).

## Current state (done) & ideas for next

**Done:** all modules render live; full CRUD/actions wired; Project+Inventory creation; lead
assignment model; status changes; **Tasks + "My Day" calendar** (manager can view anyone's agenda);
Leads page fully functional. Verified live in-browser.

**Not yet / out of scope (production-build items):** real SMS/WhatsApp/email & payment gateways
(`send_reminder` just logs a Communication), cost-sheet/agreement PDF generation, RERA hooks, native
mobile, deep role/row-level permission hardening, real login/SSO. Smaller follow-ups discussed:
Payments "Record receipt" as a styled modal (currently a `frappe.prompt`), task editing/reassignment,
dashboard overdue-task badges, aligning the New-Lead summary "Entered by" with the real logged-in user.
