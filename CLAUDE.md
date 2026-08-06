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
    components/shell.jsx                # Icon set, Avatar, StageBadge, ScoreChip, Sidebar, Topbar,
                                        #   Btn, FilterChip, SegmentedControl, StatCard…
    components/forms.jsx                # Modal, Field/Input/Select, NewLeadModal, CreateProjectModal,
                                        #   AddUnitsModal, TaskModal (optional lead picker — project
                                        #   filter + search — shown when no lead is preset)
    components/lead-detail.jsx          # the lead drawer (tabs, schedule-visit modal, tasks)
    pages/direction-a.jsx               # Leads (table↔kanban, search, filters, KPIs, bulk, export)
    pages/page-calendar.jsx             # THE calendar — "My Day" tasks + visits; owner/team scope +
                                        #   project filter; "Site Visits" nav reuses it (teamView,
                                        #   Visits lens). Click a visit/linked item → opens lead drawer.
    pages/page-inventory.jsx, page-bookings.jsx, page-payments.jsx,
    pages/page-documents.jsx        # DMS library (filters + upload + per-doc sharing)
    pages/page-approvals.jsx        # unified manager inbox (holds + document shares)
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

Realty **Project** (+ child Realty Tower; rollup fields total_units/sold/blocked/**reserved**/available),
**Unit** (status **Available / Blocked / Reserved / Sold**), **Lead** (+ child Activity / Cost Sheet Item),
**Site Visit**, **Booking**, **Payment Due**, **Channel Partner**, **Campaign**, **Task** (standalone,
drives the calendar), **Unit Hold** (per-unit hold/reserve ledger), **Document** + **Document Share**
(the DMS — see below), and masters **Lead Stage / Lead Source / Sales Owner / Message Template /
Payment Plan**. Shapes map 1:1 to the prototype's `app/data.js`. Roles: `Realty Sales Executive /
Sales Manager / Finance / Admin`. **Schema changes go via editing the doctype JSON + `bench migrate`**
(mirror in `install.py` for fresh installs — `create_doctypes` is create-only and SKIPS existing
doctypes, so it won't apply field/option changes to a live site).

**DMS doctypes** (added):
- **Realty Document** — one row per stored file. `project` (reqd) + optional `unit`/`lead`/`booking`,
  `category` (Select), `tags_text` (CSV, normalized lowercase via `_norm_tags`), `shareable` (Check),
  `status` (Active/Archived), and the file handle (`file_doc` Link→File, `file_url`, `file_name`,
  `file_size`, `mime_type`, `content_hash`, all read-only) + `uploaded_by`/`uploaded_on`. The file is a
  **private Frappe File** (`is_private=1`, `attached_to` the document) saved via
  `frappe.utils.file_manager.save_file`. **`file_url` is NEVER shipped to the client** (see gotcha).
- **Realty Document Share** — share ledger / audit trail + approval state machine (mirrors Realty Unit
  Hold). `document` (reqd) + `lead` recipient (reqd), `status`
  (**Requested→Approved→Rejected/Revoked/Expired**), `channel` (Link/Comms), `share_key` (read-only,
  **unique**, minted ONLY on manager approval via `frappe.generate_hash(length=48)`), `expires_on`,
  `access_count`/`last_accessed_*` (audit), `requested_by`/`approved_by`/`closed_*`. `allow_rename=0` on
  both (audit identity is immutable — `make_doctype` now takes an `allow_rename` param).
- **Realty Email Account** — a per-user (or shared, if `owner_user` blank) SMTP sending account for the
  AI email feature. `email_id`, `sender_name`, `smtp_host`/`smtp_port`/`use_ssl` (Gmail defaults),
  `smtp_password` (**Password fieldtype → encrypted in `__Auth`**; read with `doc.get_password(...)`),
  `is_default`, `enabled`, `has_password` (read-only flag set on save so bootstrap needn't decrypt).
  Sending uses **smtplib directly** — it never touches Frappe's site-wide Email Account / default
  outgoing, so it can't disturb other apps on the shared box.

## Key API (all in `api/crm.py`, whitelisted)

- `get_bootstrap()` → the entire dataset in `window.CRM_DATA` shape (projects, leads, visits,
  bookings, paymentDues, campaigns, grids, tasks, stages, owners, currentUser, today …). Tasks
  carry `leadId` + `project` (P-<code>) so the calendar can filter tasks by project and open the
  linked lead; visits carry `leadId` likewise.
- Writes: `create_lead`, `log_activity`, `update_lead_stage`, `reassign_lead`, `bulk_reassign`,
  `schedule_visit`, `set_unit_status`, `block_unit`, `advance_booking`, `record_receipt`,
  `send_reminder`, `process_payout`, `create_project`, `add_units`, `create_task`, `set_task_status`.
- **`set_unit_status(unit_id, status)`** drives the inventory lifecycle (Available↔Blocked↔Reserved→Sold);
  validates the transition, gates a Sold→Available unwind to managers, recomputes project rollups.
  `block_unit` is now a back-compat shim that toggles Available↔Blocked via it.
- **`add_units(payload)`** is uniform OR granular. Uniform (legacy): `{tower, floors, unitsPerFloor,
  typology, carpet, price}`. Granular per-floor: `{tower, carpetDefault, priceDefault, bands:[{from, to,
  rows:[{typology, carpet?, price?, facing?, count}]}]}` — `count` is per-floor; single-floor band =
  penthouse. Numbered `<FL2><U2>`, idempotent (existing unit_ids skipped → `skipped` in the result).
- `_recompute_project_counts(code)` is authoritative for **total_units** too (so the inventory header
  reconciles Total = Available+Blocked+Reserved+Sold; seeded-but-unbuilt projects correctly read 0).
- **Unit hold/reserve workflow** (`Realty Unit Hold` doctype = per-unit audit log): `request_hold`
  (team member asks — for a `lead` OR outside `contact_name`/`contact_phone`; always pending, never
  auto-approves), `approve_hold` (manager, or the current holder for a hand-over), `reject_hold`
  (manager / requester-cancel / holder-decline), `release_hold` (holder or manager; auto-declines any
  pending hand-over), `get_unit_holds` (history). Each endpoint takes a `for_update` row lock on the
  unit (serialization point) — at most one Approved + one Requested hold per unit. `get_bootstrap`
  attaches active holds to each grid unit (`unit.holds`) + a top-level `pendingHolds`, and exposes
  `currentUser.isManager`; owners carry `phone`.
- **DMS — documents + manager-approved sharing** (`api/crm.py`): `upload_document` (**multipart** — the
  React app POSTs `FormData` via `fetch()` with `X-Frappe-CSRF-Token`, NOT `frappe.call`; reads
  `frappe.request.files['file']`, saves a private File, all-or-nothing with rollback),
  `update_document` (uploader/manager; un-sharing 1→0 HARD-REVOKES live shares, manager-gated),
  `delete_document` (manager; cascades shares + File), `download_document` (desk-authenticated internal
  download — re-checks `read` perm, streams via `get_file`, never hands out a `/private/files` URL),
  `request_share` (any rep, doc must be `shareable`; always pending; one live share per (doc,lead)),
  `approve_share`/`reject_share`/`revoke_share` (**approve+revoke are manager-only via `_is_manager()`**;
  approve mints `share_key` idempotently; all lock the **share row** with `for_update`+`reload()` —
  the share row is the serialization point, analog of the unit row for holds), `get_document_shares`
  (full audit trail for one doc), and `view_shared_document(key)` (**`allow_guest=True`** + `@rate_limit`
  from `frappe.rate_limiter` — the public link; serves the private bytes ONLY when Approved + unexpired
  + still shareable; denial is byte-identical 403; lazy-expires; bumps `access_count`). `get_bootstrap`
  adds `documents` (+ per-lead `documents` and `documentsByProject`), `pendingShares`, `activeShares`,
  `docTags`, `docCategories`; `documents[].shares` carries each doc's active shares.
- **AI email (Ollama / Gemma) + sending** (`api/crm.py`): `draft_email(lead, instruction, kind)` builds a
  context prompt (lead name, project + locality/city, configuration, budget, email type, the rep's free
  instruction) and calls the local **Gemma `gemma4:e4b`** box via `_ollama_generate` (recipe from the
  `dux_aichatbot` repo: `think:false`, `format:"json"`, `keep_alive:"15m"`); returns `{subject, body}`.
  `improve_text(text)` does English/grammar polish. Email-account CRUD: `save_email_account` /
  `set_default_email_account` / `delete_email_account` / `test_email_account` (SMTP connect check). And
  `send_email(payload)` — sends from the user's account via **smtplib** with selected Realty Documents
  attached (read via `get_file`), then logs a Communication + a lead activity. `get_bootstrap` exposes
  `emailAccounts` (no passwords), `defaultEmailAccount`, `emailKinds`.
  **LLM endpoint:** `frappe.conf.get("ollama_url")` (set in `site_config.json` →
  `http://187.127.174.89:11434/api/generate`; reachable only from the dev box `187.127.132.58` via a UFW
  rule). Full LLM box docs live in the sibling `dux_aichatbot` repo (`LLM_INFERENCE_SERVER.md`).

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
- **Frappe's own 50px desk sidebar (`.body-sidebar-container`) is hidden only on this page**: the page
  loader (`page/realty_crm/realty_crm.js`) toggles a `body.realty-crm-active` class via `on_page_show`/
  `on_page_hide` + a `frappe.router.on('change')` guard; `realty_crm.css` hides the sidebar under that
  class. It's per-tab DOM only — restored on every other route (don't break this on the shared box).
- **Inventory unit panel is click-to-select** (not hover — hover left the panel unreachable). Clicking a
  unit opens a persistent bottom-right panel (Esc / × / click-another to close) with contextual
  lifecycle buttons (`set_unit_status` for Mark-sold/legacy-release; the hold endpoints for
  request/approve/release); the panel re-resolves the unit from the live grid each render so it never
  shows a stale object after a refresh.
- **DMS sharing security model (read before touching it).** The manager-approval/revoke gate protects
  the **external/guest** link only. The File is `is_private=1`, so a guest CANNOT hit `/private/files/...`
  directly (Frappe 403s it) — the only public path is `view_shared_document(key)`, which streams the bytes
  itself via `frappe.utils.file_manager.get_file(file_url)` (reads off disk, NO Realty Document perm check —
  required so a Guest doesn't `PermissionError`). **Never ship `file_url` to the React client** (it isn't in
  `get_bootstrap`/upload return); internal downloads go through `download_document` (re-checks `read` perm).
  Internal policy: any logged-in user with `read` on Realty Document can download any doc via
  `download_document` — that is intentional (reps need project docs); `shareable`/approval/revoke govern the
  external surface, which is the brief's actual requirement. The share link is
  `…/api/method/dux_crm_realty.api.crm.view_shared_document?key=<48-char hash>`; `share_key` is `unique`
  and minted only on approve. Acceptance checks: guest curl to an approved key → bytes; guest curl to
  `/private/files/<name>` → 403; revoked/expired/invalid key → 403; a Sales Executive calling
  `approve_share`/`revoke_share`/`delete_document` → `PermissionError`.
- **DMS upload is multipart, not `frappe.call`.** `frappe.call` is JSON-only; the upload helper
  `window.__uploadDocument` (forms.jsx) POSTs `FormData` to `/api/method/…upload_document` with header
  `X-Frappe-CSRF-Token: frappe.csrf_token` (guard for empty token → reload). Downloads open
  `…/download_document?document=<id>` in a new tab (desk session cookie carries auth; GET needs no CSRF).
  Shared DMS UI globals live across files: `__uploadDocument`/`UploadDocumentModal`/`RequestShareModal`
  (forms.jsx), `downloadDocument`/`copyShareLink`/`fmtBytes`/`ShareHistoryModal` (lead-detail.jsx).
- **`uploaded_on` shows as "in N d"** in the demo because file timestamps are the REAL clock while the app's
  pinned "today" is 2026-04-29 (`fmtRelative` is relative to the pin). Cosmetic; consistent with the pin.
- **AI email = local Gemma, not a cloud LLM.** `draft_email`/`improve_text` POST to the Ollama box
  (`ollama_url` in site_config). Calls take ~2–25s (warm) and can cold-load ~12s — the composer shows a
  "Drafting…" state; don't lower the `requests` timeout (120s) below that. Output is reviewed/edited by the
  human before send (never auto-sent). `gemma4:e4b` needs `think:false` or it burns its token budget reasoning.
- **Email credentials are the user's to enter.** The SMTP **App Password** is typed by the user in
  Settings → Email (never by an agent). Gmail needs an App Password (2-Step Verification on). Sending is
  smtplib-direct and self-contained — verify drafting/compose/settings, but the first real send is the user's.
- **Python `_` gotcha (bit us once):** never use bare `_` as a throwaway (`a, _, b = x.partition(...)`) in a
  function that also calls `_()` (gettext) — it makes `_` a function-local and every `_("...")` then raises
  `UnboundLocalError`. Use `_sep`/`_x`. (List-comprehension `for _ in ...` is safe — own scope.)
- **Hold attribution identity is a known, documented limitation.** Actor identity comes from
  `_actor_owner()` (maps `frappe.session.user` → the `Realty Sales Owner.user` link, else falls back to
  the pinned persona). With ONE shared login (and reps not yet having Frappe Users) every actor
  collapses to that persona, so ownership gates (holder-can-release/approve, requester-can-cancel)
  effectively pass for the single user, and `requested_by` is client-asserted/informational.
  **Approvals still gate on real Frappe roles** (`_is_manager()` via `MANAGER_ROLES`). Real per-rep
  enforcement just needs each rep mapped to a Frappe User via that `user` link — no code change.

## Verifying

- Backend: `bench --site erp.jewonline.in console`, or `curl` `get_bootstrap` with the API token.
- Browser: open `/app/realty-crm` (desk login). Exercise New-Lead, table↔kanban + filters/search,
  the lead drawer (status/assign/log-call/schedule-visit/tasks), Inventory (New project / Add units /
  block unit), Bookings (advance stage), Payments, My Day calendar (create task, owner selector).

## Real client data (live since 07 Aug 2026)

The demo dataset has been **replaced with Shradha Realty's real records** (from Vinita
Aswani's 23-Jun-2026 email, 3 files). Source files live in `client-data/` and client
deliverables in `client-deliverables/` — **both git-ignored (PII)**.

- **853 leads** (Sell.do export + "Till Date Drive" register, 2022→2026), **334 channel
  partners**, **4 sales owners** (Aniruddha Mahakulkar, Sameer Gedam, Shalu, Gautam Jain),
  **12 sources**, **18 real projects**. 67 dummy-phone + 109 phone-less records excluded.
- Importer: `dux_crm_realty/import_client.py` (run with `bench execute … --kwargs "{'path': …}"`).
  Payload is built LOCALLY by `scratchpad/build_import_payload.py` (all messy parsing —
  the Sell.do CSV has a column-shift fault on 331/379 rows — stays client-side).
  **Take a `bench backup` first; the wipe is not reversible.**
- Demo Bookings / Payment Dues / Site Visits / Tasks were KEPT so those modules still
  demonstrate; their `lead` links were nulled and owner links re-pointed to real reps
  before deleting the demo leads (Frappe blocks deleting linked docs).
- Real data exposed null-safety bugs the demo data hid (dashboard `lastActivity` sort,
  `soldPct` NaN on 0-unit projects) — **assume more lurk; guard before dereferencing.**
- 6 client logins exist (see `client-deliverables/_credentials.json`, git-ignored).

## User management (Settings → Users & access)

`Realty CRM User` is an **explicit allowlist** — the ONLY logins this app may manage.
Never derive manageability from "holds a Realty role" (shared box; other apps' users
must stay invisible). Endpoints: `list_crm_users`, `create_crm_user`,
`set_crm_user_password`, `set_crm_user_status`, `set_crm_user_role`, `link_crm_user_owner`.

- Gate is **`_is_user_admin()` (Realty Admin / System Manager) — deliberately NARROWER than
  `_is_manager()`**. Approving a hold is a business call; resetting a password is an identity
  call. Do not "simplify" these into one gate.
- `_is_privileged()` is an **allowlist** (manageable only if roles ⊆ `SAFE_REALTY_ROLES`),
  not a System-Manager denylist. `_managed_user()` is the single choke point.
- `Realty CRM User` and `Realty Sales Owner` are **read-only to Sales Executives** — otherwise
  an exec could add themselves to the allowlist or repoint `Sales Owner.user` and inherit
  another rep's identity via `_actor_owner()`.
- `_current_owner()` now resolves the REAL session user (via `Realty Sales Owner.user`),
  falling back to the login's own name — the pinned "Priya Deshmukh" persona is gone, as are
  the hardcoded persona strings in `shell.jsx` / `page-dashboard.jsx`.
- Passwords are set directly (no SMTP on this box) and generated with `crypto.getRandomValues`.
  Setting one revokes outstanding reset keys + sessions.
- Modules are deep-linkable via the URL hash (`#leads`, `#inventory`) — also how the
  PDF screenshots are captured headlessly.

## Current state (done) & ideas for next

**Done:** all modules render live; full CRUD/actions wired; Project+Inventory creation; lead
assignment model; status changes; **Tasks + "My Day" calendar** (manager can view anyone's agenda
or "Everyone (team)", filter by project; the My-Day TaskModal can link a lead — project filter +
search — and linked tasks then show on the lead's Tasks tab); **Site Visits is now the same
calendar** (teamView + Visits lens — the standalone visits grid was retired, `page-visits.jsx`
deleted, `SegmentedControl` moved to `shell.jsx`); clicking a visit/linked item opens the lead
drawer. **Search shortcut is `/`** (capture-phase handler in `app-root.jsx`; ⌘K stays with Frappe's
global search). **Inventory finalized**: click-to-select unit panel with a full lifecycle
(Block/Hold · Reserve · Release · Mark sold / Confirm sold / Re-block / Release-sale) via
`set_unit_status` + the new `Reserved` status; stat header reconciles (Total/Available/Blocked/
Reserved/Sold); **granular per-floor Add-units** (floor bands with per-type rows — handles mixed
floors + a single penthouse on top); **Frappe desk sidebar hidden** on the CRM page (restored
elsewhere). **Unit hold/reserve approval workflow**: request (lead OR outside enquiry) → manager
approves; holder can release / approve a hand-over; manager can override; per-unit audit log
(`Realty Unit Hold`); panel shows holder + LEAD/OUTSIDE pill + contact; concurrency-safe via row
locks (identity caveat above). Leads page fully functional.

**Project DMS + Unified Approvals inbox** (added, verified live): a real Document Management System —
**Documents** sidebar page (card grid with project/category/tag/free-text filters + upload), documents
stored per project (+ optional unit/lead/booking) as **private Frappe File attachments**, tagging, and
**manager-approved sharing with a lead** via an unguessable public link (`view_shared_document`) that a
manager can **revoke** (link 403s) with a full **audit trail** (`get_document_shares` — who/when/opens).
The lead drawer **Documents tab is now real** (was static — filtered to the lead's docs, upload + request-
share + share status + history), and the **Inventory project view** shows a per-project documents panel.
Each document can be **edited** — rename (the title is the display + downloaded file name), change
category/tags, **toggle shareable** (1→0 hard-revokes live shares, manager-only), or **delete** (manager) —
via an `EditDocumentModal` (pencil button on each card / drawer row); non-shareable docs also get a
one-click **Make shareable**. Backed by `update_document` / `delete_document`.

**AI email assistant** (added, verified live — AI part end-to-end; live send is the user's to trigger):
integrates the sibling `dux_aichatbot`'s local **Gemma (`gemma4:e4b` on Ollama)** box. A new **Email**
section in Settings lets anyone add their own Gmail/SMTP sending address (App Password stored encrypted;
smtplib-direct, isolated from the shared site's email). The lead drawer gains an **Email** action (beside
Log call / WhatsApp / Schedule visit) opening an AI composer: pick an email type, tell the AI the gist,
and it drafts a polished subject+body **grounded in the lead's apartment/project/budget context**; a "Fix
English / polish" button cleans up grammar; documents (the lead's + the project's) can be attached; Send
goes out over SMTP and logs to the lead's Activity timeline. Verified live: `draft_email` (context-aware),
`improve_text`, the settings + composer UIs, attachment selection, and clean error paths (no-account,
SMTP-failure). Real outbound send needs the user's own App Password (agents never enter credentials).
A new **Approvals** sidebar page (manager-only, live pending badge = holds + shares) is the **unified
inbox**: pending inventory hold/reserve requests AND document-share requests in one place (tabs All /
Inventory holds / Document shares), with an Active section to **release** holds and **revoke** shares /
copy links. Approve/reject/revoke gate on real Frappe roles (`_is_manager()`). The full lifecycle
(upload → request → approve → guest opens link → revoke → 403) was verified live in-browser + via curl,
and backend acceptance tests confirmed the private-file ACL, role gating, idempotent approve, un-share
hard-revoke, `delete_project` document cascade, and the `share_key` unique index.

**Not yet / out of scope (production-build items):** real SMS/WhatsApp/email & payment gateways
(`send_reminder` just logs a Communication), cost-sheet/agreement PDF generation, RERA hooks, native
mobile, deep role/row-level permission hardening, real login/SSO. Smaller follow-ups discussed:
Payments "Record receipt" as a styled modal (currently a `frappe.prompt`), task editing/reassignment,
dashboard overdue-task badges, aligning the New-Lead summary "Entered by" with the real logged-in user.
