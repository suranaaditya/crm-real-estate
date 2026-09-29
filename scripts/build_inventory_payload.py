"""Build the inventory / site-visit import payload from the client's filled workbook.

Runs LOCALLY (all messy parsing stays client-side; the server importer only writes clean rows):

    ssh frappe@187.127.132.58 'cd ~/frappe-bench && bench --site erp.jewonline.in mariadb --batch \
        --execute "select name, lead_name, phone from \`tabRealty Lead\`;"' > leads.tsv
    python3 scripts/build_inventory_payload.py "client-data/<workbook>.xlsx" leads.tsv
    scp _inventory_payload.json frappe@187.127.132.58:/home/frappe/
    bench --site erp.jewonline.in execute dux_crm_realty.import_inventory.run \
        --kwargs "{'path': '/home/frappe/_inventory_payload.json', 'dry_run': 1}"

Outputs (in the current directory, keep them OUT of git — they hold client data):
_inventory_payload.json, and issues.json (every data-quality problem found).
"""
import collections, csv, datetime, hashlib, json, re, sys
import openpyxl

WB = sys.argv[1] if len(sys.argv) > 1 else "client-data/Gautam reply 2026-08-21 - CRM Data Request.xlsx"
wb = openpyxl.load_workbook(WB, data_only=True)
issues = collections.defaultdict(list)

def rows(sheet, first=5):
    for r in wb[sheet].iter_rows(min_row=first):
        vals = [c.value for c in r]
        if any(v not in (None, "") for v in vals):
            yield r[0].row, [("" if v is None else v) for v in vals]

def s(v):
    return re.sub(r"\s+", " ", str(v)).strip() if v not in (None, "") else ""

def num(v):
    if v in (None, "", "-", "—"): return None
    try: return round(float(v), 2)
    except (TypeError, ValueError): return None

def excel_date(v):
    if isinstance(v, datetime.datetime): return v.date()
    if isinstance(v, datetime.date): return v
    if isinstance(v, (int, float)) or re.fullmatch(r"\d{5}(\.\d+)?", str(v)):
        return (datetime.datetime(1899, 12, 30) + datetime.timedelta(days=int(float(v)))).date()
    m = re.fullmatch(r"(\d{2})-(\d{2})-(\d{4})", str(v).strip())
    if m: return datetime.date(int(m[3]), int(m[2]), int(m[1]))
    return None

# ------------------------------------------------------------------ projects
# The client's short codes are NOT ours (their "GP" = our Gulab Palace GUP, and our GP is a
# different project), so we resolve by NAME. RO / SBH are new and free.
NAME_TO_CODE = {
    "abhiman niwas": "AN", "riaan residency": "RRS", "shradha house": "SHH",
    "shradha annex": "SAX", "riaan office": "RO", "riaan corporate park": "RCP",
    "gulab palace": "GUP", "shradha busiplex hinganghat": "SBH",
}
projects = []
for rn, c in rows("2. PROJECT MASTER"):
    name = s(c[0])
    if not name or name.lower() == "project name *": continue
    code = NAME_TO_CODE.get(name.lower())
    if not code:
        issues["project_unmapped"].append({"row": rn, "name": name}); continue
    poss = c[8]
    if isinstance(poss, (datetime.datetime, datetime.date)):
        poss = poss.strftime("%b %Y")
    elif isinstance(poss, (int, float)) or (isinstance(poss, str) and re.fullmatch(r"\d{5}", poss.strip())):
        d = excel_date(poss); poss = d.strftime("%b %Y")
        issues["possession_was_excel_number"].append({"row": rn, "project": name, "value": c[8], "read_as": poss})
    poss = s(poss) if s(poss) not in ("—", "-") else ""
    p = {"code": code, "name": name, "client_code": s(c[1]), "project_type": s(c[2]) or None,
         "city": s(c[3]) or None, "locality": s(c[4]) or None, "typology": s(c[5]) or None,
         "towers_count": int(c[6]) if num(c[6]) else None, "declared_total_units": int(c[7]) if num(c[7]) else None,
         "possession": poss or None, "price_from": num(c[9]) or None, "price_to": num(c[10]) or None,
         "rera": s(c[11]), "status": s(c[12])}
    if p["client_code"] and p["client_code"] != code:
        issues["client_code_differs"].append({"project": name, "client_code": p["client_code"], "crm_code": code})
    if not p["price_from"]: issues["project_no_price_band"].append(name)
    if p["rera"] in ("", "NA"): issues["project_no_rera"].append(f"{name} ({p['rera'] or 'blank'})")
    if not p["possession"]: issues["project_no_possession"].append(name)
    projects.append(p)
proj_by_name = {p["name"].lower(): p for p in projects}

# ------------------------------------------------------------------ units
SAMPLES = {("abhiman niwas", "a-0703"), ("abhiman niwas", "b-1101"), ("shradha house", "sh-101")}
def floor_num(v, where):
    t = s(v).lower()
    if isinstance(v, (int, float)): return int(v)
    if "basement" in t: return -1
    if "ground" in t or "mazz" in t or "mezz" in t: return 0
    m = re.match(r"(\d+)", t)
    if m: return int(m[1])
    issues["floor_unreadable"].append({"where": where, "value": v}); return 0

raw_units = []
for rn, c in rows("1. UNIT INVENTORY"):
    pname = s(c[0])
    if not pname or pname.lower() == "project name *": continue
    unit_no = s(c[3])
    if (pname.lower(), unit_no.lower()) in SAMPLES:
        issues["example_rows_left_in"].append({"sheet": "Unit Inventory", "row": rn, "unit": unit_no}); continue
    code = NAME_TO_CODE.get(pname.lower())
    if not code:
        issues["unit_project_unmapped"].append({"row": rn, "project": pname}); continue
    tower = s(c[1]).upper() if s(c[1]) not in ("—", "-") else ""
    typ = s(c[4])
    if re.fullmatch(r"shop-?\d+", typ, re.I):
        issues["type_column_holds_unit_no"].append({"row": rn, "project": pname, "unit": unit_no, "type": typ}); typ = "Shop"
    typ = {"office": "Office", "shop": "Shop"}.get(typ.lower(), typ)
    facing = s(c[7]).title() or None
    if facing and facing not in ("East", "West", "North", "South"):
        issues["facing_unreadable"].append({"row": rn, "value": c[7]}); facing = None
    status = s(c[9]).title() or "Available"
    raw_units.append({"row": rn, "project": code, "pname": pname, "tower": tower,
        "floor": floor_num(c[2], f"row {rn}"), "floor_label": s(c[2]), "unit_no": unit_no,
        "typology": typ, "carpet_area": num(c[5]), "built_up_area": num(c[6]), "facing": facing,
        "price": num(c[8]), "status": status, "holder": s(c[10]), "remarks": s(c[11]).replace("Unfurrnished", "Unfurnished") or None})
    if num(c[5]) is None: issues["unit_no_carpet"].append(f"{pname} {unit_no}")
    if num(c[6]) is None: issues["unit_no_builtup"].append(f"{pname} {unit_no}")

# unit ids: <CODE>-[<TOWER>-]<UNIT>; where a project repeats a unit number, both get the floor
key = lambda u: (u["project"], u["tower"], re.sub(r"\s+", "", u["unit_no"]).upper())
dupes = collections.Counter(key(u) for u in raw_units)
units = []
for u in raw_units:
    base = "-".join(x for x in (u["project"], u["tower"], re.sub(r"\s+", "", u["unit_no"]).upper()) if x)
    if dupes[key(u)] > 1:
        base += "-F%d" % u["floor"]
        issues["duplicate_unit_no"].append({"project": u["pname"], "unit": u["unit_no"], "floor": u["floor_label"]})
    units.append({"unit_id": base, **{k: u[k] for k in ("project", "tower", "floor", "unit_no", "typology",
        "carpet_area", "built_up_area", "facing", "price", "status", "remarks")}, "src_row": u["row"]})
    if u["price"] is None: issues["unit_no_price"].append(base)
assert len({u["unit_id"] for u in units}) == len(units), "unit ids not unique"

# SBH: a unit on the 2nd floor numbered with the 1st-floor prefix
for u in raw_units:
    if u["project"] == "SBH":
        pre = u["unit_no"].split()[0].upper()
        want = {-1: "BS", 0: "GS", 1: "FS", 2: "SS"}.get(u["floor"])
        if want and pre != want:
            issues["unit_prefix_floor_mismatch"].append({"unit": u["unit_no"], "floor": u["floor_label"], "expected_prefix": want})

per_proj = collections.Counter(u["project"] for u in units)
for p in projects:
    listed, declared = per_proj.get(p["code"], 0), p["declared_total_units"]
    if declared is not None and listed != declared:
        issues["count_mismatch"].append({"project": p["name"], "listed": listed, "declared": declared})
    elif declared is None:
        issues["declared_total_blank"].append({"project": p["name"], "listed": listed})
    types = sorted({u["typology"] for u in units if u["project"] == p["code"]})
    p["listed_types"] = types
# typology mismatch (AN master says 2 & 3 BHK; list has 1 & 2 BHK; RRS master 3 BHK & penthouse; list 4 BHK)
for p in projects:
    bhk_master = set(re.findall(r"(\d)\s*(?:&\s*(\d))?\s*bhk", (p["typology"] or "").lower()))
    m = {x for pair in bhk_master for x in pair if x}
    listed = {t.split()[0] for t in p["listed_types"] if "BHK" in t}
    if m and listed and not listed <= m:
        issues["typology_mismatch"].append({"project": p["name"], "master_says": p["typology"], "units_listed": p["listed_types"]})
statuses = collections.Counter(u["status"] for u in units)
if set(statuses) == {"Available"}: issues["all_units_available"].append(dict(statuses))

# ------------------------------------------------------------------ visits
leads = list(csv.DictReader(open(sys.argv[2] if len(sys.argv) > 2 else "leads.tsv"), delimiter="\t", quoting=csv.QUOTE_NONE))
norm = lambda p: (re.sub(r"\D", "", str(p or ""))[-10:] or None)
by_phone = collections.defaultdict(list)
for l in leads:
    if norm(l["phone"]): by_phone[norm(l["phone"])].append(l)
OWNER = {"aniruddha": "Aniruddha Mahakulkar", "aniruddha mahakulkar": "Aniruddha Mahakulkar",
         "sameer gedam": "Sameer Gedam", "sameer": "Sameer Gedam"}
PROJ_WORDS = [  # first match in the free-text "Project" cell wins for the link; full text kept in notes
    (r"shradha\s*ho[iu]se|shradha house", "SHH"), (r"shradha annex|shardha annex", "SAX"),
    (r"riaan corporate park|riaan corporare park|\brcp\b", "RCP"), (r"riaan residency", "RRS"),
    (r"riaan house wing b|riaan b\b", "RHB"), (r"\bsgr\b", "SGR"), (r"rai\s*gulmohar", "RGM"),
    (r"prabhu\s*stuti", "PBH"), (r"abhiman", "AN"), (r"gulab palace", "GUP"),
]
LAND = r"plot|land|parkhani|mhasala|masala"
HON = re.compile(r"^(mr|mrs|ms|miss|dr|adv|cp|cs|agent)\.?\s+", re.I)
def same_person(a, b):
    ta = set(HON.sub("", a.lower()).replace(".", " ").split()); tb = set(HON.sub("", b.lower()).replace(".", " ").split())
    ta -= {"mr", "mrs", "ms", "dr", "&", "+"}; tb -= {"mr", "mrs", "ms", "dr", "&", "+"}
    return bool(ta and tb and (ta <= tb or tb <= ta))
def resolve_project(txt):
    t = txt.lower(); hits = []
    for pat, code in PROJ_WORDS:
        m = re.search(pat, t)
        if m: hits.append((m.start(), code))
    return [c for _, c in sorted(hits)]

# the example rows we shipped in the request template, matched by a hash of the phone so the
# numbers themselves stay out of git
EXAMPLE_VISIT_PHONES = {"23c37df268af88e0c9bd2b01e568e97cad053c61521b0f008406d0af5fd0b3ec",
                        "4a6339a41c8f51105215ed31058e36ccaf52bb59ee4e7c1f7fbd8422473eb30e"}

phone_names = collections.defaultdict(set)
vrows = list(rows("3. SITE VISITS"))
for rn, c in vrows:
    if norm(c[3]): phone_names[norm(c[3])].add(s(c[2]).lower())
visits = []
for rn, c in vrows:
    if s(c[2]).lower() in ("lead name",): continue
    if hashlib.sha256((norm(c[3]) or "").encode()).hexdigest() in EXAMPLE_VISIT_PHONES:
        issues["example_rows_left_in"].append({"sheet": "Site Visits", "row": rn}); continue
    d = excel_date(c[0])
    if not d:
        issues["visit_date_unreadable"].append({"row": rn, "value": c[0]}); continue
    name, phone, ptxt, rep = s(c[2]), norm(c[3]), s(c[4]), OWNER.get(s(c[5]).lower())
    if not rep:
        issues["visit_rep_unknown"].append({"row": rn, "value": c[5]}); continue
    codes = resolve_project(ptxt)
    if len(codes) > 1: issues["visit_multi_project"].append({"row": rn, "recorded": ptxt, "linked_to": codes[0]})
    if not codes: issues["visit_project_not_in_crm"].append({"row": rn, "recorded": ptxt, "land": bool(re.search(LAND, ptxt.lower()))})
    hits = by_phone.get(phone, []) if phone else []
    lead = hits[0]["name"] if len(hits) == 1 else None
    if not phone: issues["visit_no_phone"].append({"row": rn, "name": name, "date": d.isoformat()})
    elif not hits: issues["visit_phone_not_a_lead"].append({"row": rn, "name": name, "phone": phone, "project": ptxt})
    if phone and len(phone_names[phone]) > 1:
        issues["visit_shared_phone"].append({"phone": phone, "names": sorted(phone_names[phone])})
    remark = s(c[8])
    if not remark: issues["visit_no_remarks"].append({"row": rn, "name": name})
    tail = " · ".join(x for x in (("Project(s) as recorded: " + ptxt) if (len(codes) != 1 or not ptxt) else "",
                                   ("Phone: " + phone) if phone and not lead else "") if x)
    visits.append({"src_row": rn, "visit_date": d.isoformat(), "visit_time": None, "lead": lead,
        "lead_name": name, "project": codes[0] if codes else None, "sales_owner": rep,
        "party_of": int(c[6]) if num(c[6]) else None, "status": (s(c[7]) or "Completed").lower(),
        "notes": (remark + ("\n\n" + tail if tail else "")).strip() or None,
        "activity_text": ("Site visit — %s%s. %s" % (ptxt or "project not recorded",
            "" if (lead and same_person(name, hits[0]["lead_name"])) else " (visitor: %s)" % name,
            remark or "No remarks recorded.")).strip()})
    if not s(c[1]): issues["visit_no_time"].append(rn)
    if not num(c[6]): issues["visit_no_party_size"].append(rn)
# de-dup shared-phone issue list
seen = set(); issues["visit_shared_phone"] = [x for x in issues["visit_shared_phone"] if not (x["phone"] in seen or seen.add(x["phone"]))]

# ------------------------------------------------------------------ other tabs
for sheet, label in (("4. LEAD ENRICHMENT", "lead_enrichment"), ("6. DOCUMENTS", "documents")):
    data = [c for rn, c in rows(sheet) if s(c[0]) and not s(c[0]).endswith("*")]
    issues[label + "_rows"] = [" | ".join(s(x) for x in c if s(x)) for c in data]
issues["team_rows"] = [" | ".join(s(x) for x in c) for rn, c in rows("5. TEAM & LOGINS") if s(c[0]) and not s(c[0]).endswith("*")]

payload = {"source": "Gautam Jain, 21-Aug-2026 reply to 'Data required for CRM App'",
    "replace_units_for": ["AN"], "allowed_dangling_bookings": ["BK-2599"],
    "projects": [{k: p[k] for k in ("code", "name", "project_type", "city", "locality", "typology",
        "towers_count", "possession", "price_from", "price_to")} for p in projects],
    "units": units, "visits": visits}
json.dump(payload, open("_inventory_payload.json", "w"), indent=1, default=str)
json.dump({"projects": projects, "issues": issues, "unit_counts": per_proj, "statuses": statuses},
          open("issues.json", "w"), indent=1, default=str)
print("projects", len(projects), "| units", len(units), dict(per_proj), "| visits", len(visits),
      "| visits linked", sum(1 for v in visits if v["lead"]))
for k, v in issues.items():
    print(f"  {k:30s} {len(v) if isinstance(v, list) else v}")
