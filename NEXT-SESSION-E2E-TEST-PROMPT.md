# Prompt for the next session — full end-to-end test of Dux CRM Realty

Copy everything below the line into a fresh session.

---

I need you to **end-to-end test the entire Dux CRM Realty app** by creating dummy entries that
exercise every entity type and, more importantly, **every linkage between them** — then verify
each one actually worked, and clean everything up afterwards.

## Read first

**Read `CLAUDE.md` at the repo root IN FULL** —
`/Users/shraddhasurana/Desktop/Aditya/Claude Code/dux_crm_realty/CLAUDE.md`.
It has the architecture, deploy loop, conventions, gotchas, data model, API list and current
status, including the two newest sections: **"Real client data"** and **"User management"**.
Then follow its file map. Do not skip this — several traps below are documented there.

## Environment

| | |
|---|---|
| Local source of truth | `/Users/shraddhasurana/Desktop/Aditya/Claude Code/dux_crm_realty/` |
| GitHub | `git@github.com:suranaaditya/crm-real-estate.git`, branch **`main`** (commit + push there, no new branch) |
| Server | `ssh frappe@187.127.132.58` (key `~/.ssh/id_ed25519`), bench `~/frappe-bench`, site `erp.jewonline.in` |
| App | https://erp.jewonline.in/app/realty-crm |
| API token (Administrator) | `Authorization: token 1dacdb9682a6ec9:8eb2714dcfdf091` |
| Deploy loop | **SHARED production box — never `bench restart`.** Follow CLAUDE.md exactly. |

**Logins** (real, working — credentials in `client-deliverables/_credentials.json`, git-ignored):

| Login | Access level | Linked rep |
|---|---|---|
| `gautam@shradharealty.in` | Admin | Gautam Jain |
| `director@shradharealty.in` | Admin | — |
| `vinita@shradharealty.in` | Sales Manager | — |
| `aniruddha@shradharealty.in` | Sales Executive | Aniruddha Mahakulkar |
| `sameer@shradharealty.in` | Sales Executive | Sameer Gedam |
| `shalu@shradharealty.in` | Sales Executive | Shalu |

Deep links work via the URL hash: `…/app/realty-crm#leads`, `#inventory`, `#approvals`,
`#documents`, `#calendar`, `#visits`, `#settings`, `#bookings`, `#payments`, `#partners`,
`#campaigns`, `#reports`.

## ⚠️ This is LIVE CLIENT DATA — read before you touch anything

The database holds **Shradha Realty's real customer records** (853 leads, 334 brokers with real
names and phone numbers). This is not a demo site.

1. **Take a backup first**: `bench --site erp.jewonline.in backup`. Record the path.
2. **Prefix every dummy record you create with `ZZTEST`** (lead names, project codes/names,
   partner names, document titles, task titles, user emails `zztest*@example.com`). This makes
   cleanup exact and auditable.
3. **Never edit or delete a real record.** If a test needs an existing lead, prefer one you
   created. If you must touch a real one, record its before-state and restore it exactly.
4. **Clean up everything at the end** and prove it by re-running the baseline count query below.
5. Do not send real email, real SMS/WhatsApp, or share anything externally.

### Baseline counts (as of 07 Aug 2026 — these must match again after cleanup)

```
Lead 853 | Channel Partner 334 | Sales Owner 4 | Lead Source 12 | Project 23 | Unit 189
Unit Hold 0 | Site Visit 32 | Task 18 | Booking 6 | Payment Due 60
Document 4 | Document Share 5 | CRM User 6 | Email Account 1 | Campaign 6
```

Query to re-check:
```bash
ssh frappe@187.127.132.58 'cd ~/frappe-bench && bench --site erp.jewonline.in mariadb --execute "
select \"Lead\" t,count(*) n from \`tabRealty Lead\` union all
select \"Channel Partner\",count(*) from \`tabRealty Channel Partner\` union all
select \"Sales Owner\",count(*) from \`tabRealty Sales Owner\` union all
select \"Project\",count(*) from \`tabRealty Project\` union all
select \"Unit\",count(*) from \`tabRealty Unit\` union all
select \"Unit Hold\",count(*) from \`tabRealty Unit Hold\` union all
select \"Site Visit\",count(*) from \`tabRealty Site Visit\` union all
select \"Task\",count(*) from \`tabRealty Task\` union all
select \"Document\",count(*) from \`tabRealty Document\` union all
select \"Document Share\",count(*) from \`tabRealty Document Share\` union all
select \"CRM User\",count(*) from \`tabRealty CRM User\`;"'
```

## What exists (so you know what to cover)

**24 doctypes**: Project (+Tower child), Unit, Unit Hold, Lead (+Lead Activity, Lead Task, Cost
Sheet Item children), Site Visit, Task, Booking, Payment Due (+Payment Plan, Plan Item), Channel
Partner, Sales Owner, Lead Source, Lead Stage, Document, Document Share, CRM User, Email Account,
Campaign, Message Template.

**50 whitelisted endpoints** in `dux_crm_realty/api/crm.py`:
`get_bootstrap`, `create_lead`, `log_activity`, `update_lead_stage`, `reassign_lead`,
`bulk_reassign`, `schedule_visit`, `create_task`, `set_task_status`, `toggle_task`,
`create_project`, `delete_project`, `add_units`, `set_unit_status`, `block_unit`,
`request_hold`, `approve_hold`, `reject_hold`, `release_hold`, `get_unit_holds`,
`upload_document`, `update_document`, `delete_document`, `download_document`,
`request_share`, `approve_share`, `reject_share`, `revoke_share`, `get_document_shares`,
`create_rep`, `create_crm_user`, `list_crm_users`, `set_crm_user_password`,
`set_crm_user_status`, `set_crm_user_role`, `link_crm_user_owner`, `change_my_password`,
`add_source`, `delete_source`, `advance_booking`, `record_receipt`, `send_reminder`,
`process_payout`, `save_email_account`, `delete_email_account`, `set_default_email_account`,
`test_email_account`, `draft_email`, `improve_text`, `send_email`.

**Modules (left nav)**: Dashboard, My Day, Approvals, Leads, Site Visits, Documents, Inventory,
Bookings, Payments, Partners, Campaigns, Reports, Settings.

## The linkages that actually matter — test these, not just CRUD

Anyone can create a record. The value is in proving the **joins, rollups, permissions and state
machines** hold. Cover at minimum:

1. **Lead → everything.** Create a `ZZTEST` lead. Verify it links correctly to Project, Source,
   Channel Partner, Sales Owner and Stage (all four are Frappe **Link** fields — an unmapped
   value throws). Then confirm every subsequent action auto-writes a **Lead Activity** row and
   updates `last_activity`: log a call, log a WhatsApp, change stage, reassign owner.
2. **Lead ↔ Task, both directions.** Create a task *from the lead drawer*, and create one *from
   My Day using the lead picker*. Both must appear on the lead's Tasks tab **and** on the
   assignee's My Day calendar, with the lead name shown. Toggle done/undone from both places.
3. **Lead → Site Visit.** Schedule a visit; verify it appears on the lead, on My Day, on the
   Site Visits team calendar, sets the lead's `visitOn`, and writes an activity row.
4. **Inventory hold/reserve state machine** (the richest area). On a `ZZTEST` project + units:
   request hold → approve → verify unit turns Blocked and rollups move; request a **hand-over**
   on a held unit → approve as the holder → old hold becomes `Overridden`; release → unit returns
   Available and any pending hand-over is auto-declined; `get_unit_holds` shows the full audit
   trail. Also test **Reserve**, **Mark sold**, and a hold for an **outside contact** (no lead) —
   the LEAD vs OUTSIDE badge must be unambiguous.
5. **Project ↔ Unit rollups.** After every status change, `Total = Available + Blocked +
   Reserved + Sold` must reconcile in the Inventory header. Check after add-units, after each
   hold transition, and after delete.
6. **Granular add-units.** Create a `ZZTEST` project, then add units with **floor bands**:
   floor 1 = two 2BHK + one 3BHK; floors 2–5 = five 2BHK; floor 6 = one penthouse. Verify unit
   numbering (`0101/0102/0103`, `02xx…`, `0601`) and that re-running is idempotent (skips, and
   reports `skipped`). Also test the guard: >99 units on one floor must be refused.
7. **Documents → Share → Approval.** Upload a `ZZTEST` document against a project, tag it, find
   it via the Documents search and filters, request a share **to a lead**, approve it as a
   manager, verify the share link works, then **revoke** it and verify access dies.
8. **Approvals inbox** must aggregate *both* pending hold requests *and* pending document shares
   in one screen, and approving/rejecting from there must have the same effect as doing it from
   the module.
9. **Identity & attribution.** Log in as `aniruddha@` (Sales Executive) and confirm the app
   greets him, that a hold he requests is attributed to **Aniruddha Mahakulkar**, and that he
   **cannot** approve his own request. Then approve as `gautam@` (Admin).
10. **Permission gating — test the DENY paths, not just the allow paths.** As a Sales Executive:
    `list_crm_users` must be refused; Settings → Users & access must not be visible; approving a
    hold must be refused. As a Sales Manager: can approve holds but **cannot** manage logins.
    Only Admin manages logins.
11. **User management.** Create a `zztest@example.com` login, set its password, change its role,
    link it to a rep, disable it, and verify a disabled login genuinely cannot sign in. Verify
    the last-admin lockout guard refuses to disable/demote the final Admin.
12. **Self-service password change.** Sign in as a test user and change the password via the
    **Change password** link (bottom-left, under the name). Verify: wrong current password is
    rejected without signing you out; the new password works; the old one does not.
13. **Search & navigation.** `/` focuses the search (⌘K must NOT be captured — it belongs to
    Frappe). Leads search; Inventory **cross-project** unit search with the jump chips; Documents
    search; the project tab strip's "Find project" box and scroll arrows.
14. **Bookings / Payments.** These still hold sample data with their lead links nulled (by
    design). Verify the pages render and `advance_booking` / `record_receipt` / `send_reminder` /
    `process_payout` still work without throwing.
15. **Refresh consistency.** After every write the UI calls `window.__refreshCRM()`. Confirm the
    on-screen numbers (KPIs, funnel, chips, rollups) actually move, and that an open detail panel
    re-resolves rather than showing stale data.

## Known traps (learned the hard way — don't rediscover them)

- **Real data contains nulls the old demo data never had.** Two crashes were already found and
  fixed this way (Dashboard `lastActivity` sort → blank page; `soldPct` → `NaN%`). **Assume more
  exist.** Any `.split()`, `.localeCompare()`, `.toLowerCase()` or arithmetic on a nullable field
  is a suspect. Actively hunt for these on every page with real data loaded.
- **`bench migrate` is currently BROKEN by another app** on this shared box (missing Role
  "Material Request Approver 3rd"). Not ours — do not "fix" another app's data. If you need a
  schema change, apply it via the doctype JSON and, if migrate blocks, set it directly through
  `bench console` (that's how the last permission change was applied).
- **`install.py make_doctype()` is create-only** — it silently skips existing doctypes. Field or
  permission changes to an existing doctype must go via JSON + migrate (or console), and be
  mirrored in `install.py` for fresh installs.
- **Frappe blocks deleting a linked document.** Cleanup order matters: Document Share → Document;
  Unit Hold → Unit; Task/Site Visit/Booking → Lead; then Lead; then Sales Owner / Channel Partner.
- **`_is_user_admin()` is deliberately narrower than `_is_manager()`** (Admin/System Manager vs
  also Sales Manager). Don't "simplify" them into one.
- **Identity attribution** resolves the session user via `Realty Sales Owner.user`. Testing the
  holder-vs-manager distinction **requires logging in as different users** — an Administrator
  token passes every gate and will give you false confidence.
- The demo "today" is pinned to **2026-04-29** (`get_bootstrap()["today"]`); new visits/tasks
  default relative to it so they land in the visible calendar week.
- Project codes must not collide with existing ones (`AN, GE, GP, RC, SP, RCP, RRS, SHH, RGM,
  GUP, LTC, STC, SJV, SGR, RJP, PBH, NCH, RGP, RMX, RHB, SAX, SNX, TN`).

## How to work

- **Ultracode is on**: use the **Workflow** tool. A good shape here is fan-out by module
  (Leads / Inventory+Holds / Documents+Shares / Users+Permissions / Calendar+Approvals /
  Bookings+Payments+Reports), each agent driving both the API and the browser, then an
  adversarial verify pass that tries to **disprove** each "it works" claim, then a completeness
  critic asking what wasn't covered.
- **Verify in the real UI**, not just via API. Use Claude-in-Chrome on
  https://erp.jewonline.in/app/realty-crm. Watch the browser console for errors on every page —
  that is how both crashes above were caught.
- Headless screenshots (useful for evidence) work like this — no Node on this Mac, so use Chrome
  directly with a minted session:
  ```bash
  # mint a sid by POSTing /api/method/login with a real credential, then:
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
    --hide-scrollbars --window-size=1600,1000 --virtual-time-budget=25000 \
    --screenshot=out.png "https://erp.jewonline.in/app/realty-crm?sid=$SID#leads"
  ```

## What I want back

1. A **findings report**: every bug found, with severity, exact reproduction steps, the affected
   file/endpoint, and whether you fixed it.
2. **Fix the bugs you find** (they're likely small null-guards and edge cases), deploy them,
   and re-verify.
3. A **coverage table**: entity/linkage × tested? × result.
4. **Proof of cleanup** — the baseline count query matching the numbers above.
5. Update `CLAUDE.md` with anything future-you would want to know.
6. **Commit and push to `main`** (no new branch). Never commit `client-data/` or
   `client-deliverables/` — they hold real customer PII and credentials and are git-ignored.

Start by reading `CLAUDE.md`, taking the backup, and planning the test matrix before creating
a single record.
