# Dux CRM Realty

A real-estate CRM for **Shradha Realty**, built as a custom **ERPNext v16 (Frappe)** app.

It reproduces an approved Claude-Design prototype pixel-for-pixel as a React single-page app
mounted on a Frappe desk page (`/app/realty-crm`), backed by real DocTypes and whitelisted APIs.

## Modules

Dashboard · **My Day** (personal tasks + visits calendar) · Leads (table ↔ kanban, search, filters,
lead detail drawer) · Site Visits · Inventory (tower/floor/unit grid, create project + add units) ·
Bookings (cost sheet + stage progress) · Payments · Channel Partners · Campaigns · Reports · Settings.

Fully interactive: capture/assign/score leads, change status, log calls/WhatsApp, schedule visits,
create & assign tasks, block units, advance bookings, record receipts, process payouts.

## Tech

- **Backend:** Frappe v16 DocTypes (`Realty *`) + whitelisted Python API (`api/crm.py`).
- **Frontend:** React, built by Frappe's esbuild as a `*.bundle.jsx`, mounted full-screen on a desk page.
- **Data principle:** `api/crm.get_bootstrap()` returns the live data in the prototype's exact
  `window.CRM_DATA` shape, so the ported UI renders with no data-layer rewrites.

## Install

```bash
cd ~/frappe-bench
bench get-app https://github.com/suranaaditya/crm-real-estate.git --branch main
cd apps/dux_crm_realty && yarn install && cd ~/frappe-bench
bench --site <site> install-app dux_crm_realty   # after_install creates roles + DocTypes
bench --site <site> execute dux_crm_realty.seed.run         # demo data (optional)
bench --site <site> execute dux_crm_realty.seed.seed_tasks  # demo tasks (optional)
bench build --app dux_crm_realty
```

Then open `/app/realty-crm`.

## For developers / agents

See **[CLAUDE.md](CLAUDE.md)** for the full architecture, deploy loop (this app's dev box runs under
supervisor — never `bench restart`), conventions, gotchas, and the current state / TODO.

The original design prototype is preserved under **`design-reference/`** as the pixel source of truth.

## License

MIT
