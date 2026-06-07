/* Sample data for the Real Estate CRM prototype.
   Inspired by Shradha Realty / Abhiman Niwas (Nagpur) — projects, units, leads. */

window.CRM_DATA = (() => {
  const projects = [
    { id: "P-AN", code: "AN", name: "Abhiman Niwas", type: "Residential", city: "Nagpur", locality: "Hingna Road",
      towers: 3, totalUnits: 144, sold: 89, blocked: 12, available: 43,
      typology: "2 & 3 BHK Flats", priceFrom: 4250000, priceTo: 8900000, possession: "Dec 2027" },
    { id: "P-SP", code: "SP", name: "Shradha Pinnacle", type: "Residential", city: "Nagpur", locality: "Wardha Road",
      towers: 2, totalUnits: 96, sold: 41, blocked: 8, available: 47,
      typology: "3 & 4 BHK Flats", priceFrom: 7800000, priceTo: 14500000, possession: "Jun 2028" },
    { id: "P-GE", code: "GE", name: "Green Estate Row Houses", type: "Row Houses", city: "Nagpur", locality: "Besa",
      towers: 1, totalUnits: 36, sold: 22, blocked: 3, available: 11,
      typology: "3 BHK Row House", priceFrom: 9500000, priceTo: 12200000, possession: "Mar 2027" },
    { id: "P-RC", code: "RC", name: "Royal Commercia", type: "Commercial", city: "Nagpur", locality: "Civil Lines",
      towers: 1, totalUnits: 64, sold: 12, blocked: 4, available: 48,
      typology: "Office & Retail", priceFrom: 3200000, priceTo: 22000000, possession: "Sep 2026" },
  ];

  const sources = ["Website", "99acres", "MagicBricks", "Walk-in", "Channel Partner", "Hoarding", "Referral", "Facebook Ad", "Google Ad", "Newspaper"];
  const stages = [
    { id: "new",        label: "New",          tone: "info"    },
    { id: "contacted",  label: "Contacted",    tone: "neutral" },
    { id: "qualified",  label: "Qualified",    tone: "amber"   },
    { id: "visit",      label: "Site Visit",   tone: "amber"   },
    { id: "negotiation",label: "Negotiation",  tone: "coral"   },
    { id: "booked",     label: "Booked",       tone: "success" },
    { id: "lost",       label: "Lost",         tone: "error"   },
  ];

  const owners = [
    { id: "U1", name: "Priya Deshmukh",  role: "Sales Executive", initials: "PD" },
    { id: "U2", name: "Rohan Kulkarni",  role: "Sales Executive", initials: "RK" },
    { id: "U3", name: "Anjali Bhosale",  role: "Telecaller",      initials: "AB" },
    { id: "U4", name: "Vikram Joshi",    role: "Sales Manager",   initials: "VJ" },
    { id: "U5", name: "Neha Pandey",     role: "Sales Executive", initials: "NP" },
  ];

  const channelPartners = [
    { id: "CP1", name: "Realty Junction",      contact: "Sandeep Gupta",  rera: "MAHA-RERA-A52100012345" },
    { id: "CP2", name: "Nagpur Homes Advisor", contact: "Manisha Khandelwal", rera: "MAHA-RERA-A52100098765" },
    { id: "CP3", name: "PropConnect",          contact: "Amit Shukla",    rera: "MAHA-RERA-A52100054321" },
  ];

  // Names + numbers — fictional
  const firstNames = ["Aarav","Vivaan","Aditya","Vihaan","Arjun","Sai","Reyansh","Krishna","Ishaan","Shaurya","Atharv","Rudra","Kabir","Anaya","Diya","Saanvi","Aadhya","Myra","Ira","Pari","Riya","Aanya","Navya","Kiara","Sara","Tanvi","Meera","Ananya","Nisha","Ritu","Pooja","Sneha","Kavya"];
  const lastNames = ["Sharma","Verma","Iyer","Patel","Rao","Singh","Joshi","Kulkarni","Deshpande","Bhosale","Pandey","Gupta","Mehta","Khan","Kapoor","Reddy","Mishra","Tripathi","Agrawal","Bansal","Khandelwal","Saxena","Shukla","Nair"];

  const occupations = ["Software Engineer","Doctor","Chartered Accountant","Business Owner","Bank Manager","Civil Engineer","Architect","Teacher","Government Officer","Marketing Manager","Consultant","Pharmacist"];

  const seed = 42;
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const rint = (lo, hi) => Math.floor(rand() * (hi - lo + 1)) + lo;

  const today = new Date("2026-04-29");
  const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d.toISOString().slice(0,10); };
  const daysFromNow = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); };

  const phones = () => "+91 " + (90 + rint(0,9)) + (rint(10000000, 99999999));
  const emailFrom = (fn, ln) => (fn + "." + ln).toLowerCase() + "@" + pick(["gmail.com","outlook.com","yahoo.in","rediffmail.com"]);

  const leads = [];
  for (let i = 0; i < 42; i++) {
    const fn = pick(firstNames);
    const ln = pick(lastNames);
    const stage = pick(stages.slice(0, 6).concat(stages[6])); // include lost occasionally
    const project = pick(projects);
    const source = pick(sources);
    const owner = pick(owners);
    const occupation = pick(occupations);
    const created = daysAgo(rint(0, 60));
    const lastActivity = daysAgo(rint(0, 14));
    const score = rint(28, 96);
    const interest = pick(["2 BHK", "3 BHK", "4 BHK", "Row House", "Office Suite", "Retail Shop"]);
    const budget = rint(40, 180) * 100000; // 40L–1.8Cr
    const cp = rand() < 0.35 ? pick(channelPartners) : null;
    const visitOn = stage.id === "visit" ? daysFromNow(rint(1, 7)) : (rand() < 0.25 ? daysFromNow(rint(1, 14)) : null);

    leads.push({
      id: "LD-" + String(2400 + i).padStart(4, "0"),
      name: fn + " " + ln,
      initials: (fn[0] + ln[0]).toUpperCase(),
      phone: phones(),
      email: emailFrom(fn, ln),
      occupation,
      stage: stage.id,
      score,
      interest,
      budget,
      project: project.id,
      projectName: project.name,
      source,
      owner: owner.id,
      ownerName: owner.name,
      ownerInitials: owner.initials,
      channelPartner: cp ? cp.id : null,
      channelPartnerName: cp ? cp.name : null,
      created,
      lastActivity,
      visitOn,
      city: pick(["Nagpur","Pune","Mumbai","Bhopal","Indore","Raipur","Hyderabad","Bengaluru"]),
      starred: rand() < 0.18,
      followups: rint(1, 9),
      tags: [interest, source].filter(Boolean),
    });
  }

  // Hand-craft the first lead so the detail screen feels real
  leads[0] = {
    id: "LD-2400",
    name: "Rajesh Khandelwal",
    initials: "RK",
    phone: "+91 98220 41782",
    email: "rajesh.khandelwal@gmail.com",
    occupation: "Chartered Accountant",
    stage: "negotiation",
    score: 84,
    interest: "3 BHK",
    budget: 7800000,
    project: "P-AN",
    projectName: "Abhiman Niwas",
    source: "Channel Partner",
    owner: "U1",
    ownerName: "Priya Deshmukh",
    ownerInitials: "PD",
    channelPartner: "CP1",
    channelPartnerName: "Realty Junction",
    created: daysAgo(18),
    lastActivity: daysAgo(1),
    visitOn: daysFromNow(2),
    city: "Nagpur",
    starred: true,
    followups: 6,
    tags: ["3 BHK","Channel Partner","Hot"],
  };

  // Activity timeline for the focused lead
  const activity = [
    { at: daysAgo(18) + " 10:24", who: "System",         type: "created",  text: "Lead captured from Channel Partner — Realty Junction (Sandeep Gupta)." },
    { at: daysAgo(18) + " 10:31", who: "Priya Deshmukh", type: "call",     text: "Inbound call. Looking for a 3 BHK in Hingna Road, possession before Mar 2028. Budget around ₹78 L." },
    { at: daysAgo(15) + " 16:02", who: "Priya Deshmukh", type: "whatsapp", text: "Sent project brochure & price list for Abhiman Niwas Tower B." },
    { at: daysAgo(12) + " 11:10", who: "Priya Deshmukh", type: "visit",    text: "Site visit completed — Tower B, Floor 7, Unit 704. Liked east-facing balcony, asked about 705." },
    { at: daysAgo(8)  + " 09:45", who: "Vikram Joshi",   type: "note",     text: "Internal note: lead is comparing with Shradha Pinnacle. Push possession date as differentiator." },
    { at: daysAgo(4)  + " 17:20", who: "Priya Deshmukh", type: "call",     text: "Discussed pricing for 705. Customer asked for 3% discount + free covered parking." },
    { at: daysAgo(1)  + " 12:15", who: "Priya Deshmukh", type: "email",    text: "Sent revised cost sheet — 2.5% negotiated discount, two parking slots included." },
  ];

  const tasks = [
    { id: "T1", title: "Site visit — Tower B, Unit 705",  due: daysFromNow(2),  done: false, owner: "U1", priority: "high" },
    { id: "T2", title: "Share final cost sheet PDF",      due: daysFromNow(1),  done: false, owner: "U1", priority: "high" },
    { id: "T3", title: "Follow up on parking allocation", due: daysFromNow(4),  done: false, owner: "U4", priority: "med"  },
    { id: "T4", title: "Send brochure",                   due: daysAgo(15),     done: true,  owner: "U1", priority: "low"  },
    { id: "T5", title: "First introductory call",         due: daysAgo(18),     done: true,  owner: "U1", priority: "med"  },
  ];

  const documents = [
    { name: "Cost-Sheet_AN_Tower-B_705_v3.pdf",  size: "412 KB", at: daysAgo(1)  },
    { name: "Brochure_Abhiman-Niwas.pdf",        size: "8.2 MB", at: daysAgo(15) },
    { name: "PAN_RajeshKhandelwal.jpg",          size: "1.4 MB", at: daysAgo(12) },
    { name: "Aadhaar_RajeshKhandelwal.pdf",      size: "1.1 MB", at: daysAgo(12) },
  ];

  const inventory = {
    "P-AN": {
      towers: [
        { id: "A", name: "Tower A", floors: 12 },
        { id: "B", name: "Tower B", floors: 12 },
        { id: "C", name: "Tower C", floors: 12 },
      ],
      // Generate units for tower B floor 7 (the one in the example)
      units: [
        { id: "B-701", tower: "B", floor: 7, num: "701", typology: "2 BHK", carpet: 712,  facing: "West",  price: 5290000, status: "sold" },
        { id: "B-702", tower: "B", floor: 7, num: "702", typology: "2 BHK", carpet: 712,  facing: "West",  price: 5290000, status: "sold" },
        { id: "B-703", tower: "B", floor: 7, num: "703", typology: "3 BHK", carpet: 1085, facing: "East",  price: 7650000, status: "available" },
        { id: "B-704", tower: "B", floor: 7, num: "704", typology: "3 BHK", carpet: 1085, facing: "East",  price: 7650000, status: "blocked" },
        { id: "B-705", tower: "B", floor: 7, num: "705", typology: "3 BHK", carpet: 1145, facing: "East",  price: 7920000, status: "available" },
        { id: "B-706", tower: "B", floor: 7, num: "706", typology: "2 BHK", carpet: 740,  facing: "North", price: 5450000, status: "available" },
      ]
    }
  };

  // Generate full inventory grid for Abhiman Niwas (3 towers × 12 floors × 4 units)
  function buildAbhimanGrid() {
    const grid = {};
    ["A", "B", "C"].forEach(tow => {
      grid[tow] = {};
      for (let f = 1; f <= 12; f++) {
        grid[tow][f] = [];
        for (let u = 1; u <= 4; u++) {
          const num = String(f).padStart(2, "0") + String(u).padStart(2, "0").slice(-2);
          const isCorner = u === 1 || u === 4;
          const typology = isCorner ? "3 BHK" : "2 BHK";
          const carpet = isCorner ? 1085 + rint(0, 80) : 712 + rint(0, 40);
          const price = isCorner ? 7600000 + rint(0, 600000) : 5200000 + rint(0, 350000);
          const facing = ["East", "West", "North", "South"][u - 1];
          // Status distribution: skewed by floor
          let status;
          const r = rand();
          if (f <= 4) {
            status = r < 0.78 ? "sold" : r < 0.88 ? "blocked" : "available";
          } else if (f <= 8) {
            status = r < 0.50 ? "sold" : r < 0.62 ? "blocked" : "available";
          } else {
            status = r < 0.22 ? "sold" : r < 0.32 ? "blocked" : "available";
          }
          grid[tow][f].push({
            id: tow + "-" + num, tower: tow, floor: f, num,
            typology, carpet, facing, price, status,
          });
        }
      }
    });
    return grid;
  }
  const abhimanGrid = buildAbhimanGrid();
  // Override floor 7 tower B with the hand-tuned units
  abhimanGrid.B[7] = inventory["P-AN"].units;

  // ---------- Site visits ----------
  const visits = [];
  const visitProjects = projects.slice(0, 3);
  for (let i = 0; i < 28; i++) {
    const lead = leads[rint(0, leads.length - 1)];
    const dayOffset = rint(-3, 10);
    const hour = pick([10, 11, 12, 14, 15, 16, 17]);
    const status = dayOffset < 0
      ? pick(["completed", "completed", "completed", "no-show"])
      : dayOffset === 0
      ? pick(["confirmed", "in-progress", "confirmed"])
      : pick(["confirmed", "tentative", "confirmed"]);
    visits.push({
      id: "VST-" + String(800 + i).padStart(4, "0"),
      leadId: lead.id, leadName: lead.name, leadInitials: lead.initials, leadPhone: lead.phone,
      project: lead.project, projectName: lead.projectName,
      ownerId: lead.owner, ownerName: lead.ownerName, ownerInitials: lead.ownerInitials,
      partyOf: rint(1, 4),
      date: daysFromNow(dayOffset),
      time: String(hour).padStart(2, "0") + ":" + pick(["00", "15", "30", "45"]),
      duration: 60,
      mode: pick(["in-person", "in-person", "in-person", "virtual"]),
      status,
      pickup: rand() < 0.3,
      notes: pick(["Interested in 3BHK east-facing", "Wants to see model flat", "Family visit including parents", "Comparing with Pinnacle", "Bringing channel partner", ""]),
    });
  }
  // First visit = the one in Rajesh Khandelwal's flow
  visits[0] = {
    id: "VST-0800",
    leadId: leads[0].id, leadName: leads[0].name, leadInitials: leads[0].initials, leadPhone: leads[0].phone,
    project: "P-AN", projectName: "Abhiman Niwas",
    ownerId: "U1", ownerName: "Priya Deshmukh", ownerInitials: "PD",
    partyOf: 3,
    date: daysFromNow(2), time: "11:30", duration: 90, mode: "in-person",
    status: "confirmed", pickup: true,
    notes: "Tower B unit 705 walk-through. Bringing wife and CA. Pickup from Sitabuldi 11:00.",
  };

  // ---------- Bookings ----------
  const bookings = [
    {
      id: "BK-2603", date: daysAgo(4), leadId: "LD-2412", leadName: "Aarav Sharma",
      unit: "B-505", project: "Abhiman Niwas",  typology: "3 BHK", carpet: 1085,
      bsp: 7235000, otherCharges: 415000, gst: 271050, total: 7921050,
      tokenAmount: 200000, tokenPaid: true, agreementSigned: true,
      stage: "agreement-signed", owner: "Priya Deshmukh",
    },
    {
      id: "BK-2602", date: daysAgo(7), leadId: "LD-2418", leadName: "Diya Patel",
      unit: "A-902", project: "Abhiman Niwas",  typology: "2 BHK", carpet: 740,
      bsp: 5390000, otherCharges: 320000, gst: 199400, total: 5909400,
      tokenAmount: 150000, tokenPaid: true, agreementSigned: false,
      stage: "token-received", owner: "Rohan Kulkarni",
    },
    {
      id: "BK-2601", date: daysAgo(11), leadId: "LD-2425", leadName: "Vihaan Joshi",
      unit: "T2-1101", project: "Shradha Pinnacle", typology: "3 BHK", carpet: 1340,
      bsp: 11450000, otherCharges: 720000, gst: 432900, total: 12602900,
      tokenAmount: 500000, tokenPaid: true, agreementSigned: true,
      stage: "registration-pending", owner: "Vikram Joshi",
    },
    {
      id: "BK-2600", date: daysAgo(18), leadId: "LD-2428", leadName: "Saanvi Iyer",
      unit: "B-302", project: "Abhiman Niwas",  typology: "2 BHK", carpet: 712,
      bsp: 5290000, otherCharges: 310000, gst: 195300, total: 5795300,
      tokenAmount: 100000, tokenPaid: true, agreementSigned: true,
      stage: "registered", owner: "Neha Pandey",
    },
    {
      id: "BK-2599", date: daysAgo(22), leadId: "LD-2410", leadName: "Kabir Mehta",
      unit: "C-1004", project: "Abhiman Niwas",  typology: "3 BHK", carpet: 1145,
      bsp: 7920000, otherCharges: 430000, gst: 296850, total: 8646850,
      tokenAmount: 250000, tokenPaid: true, agreementSigned: true,
      stage: "registered", owner: "Priya Deshmukh",
    },
    {
      id: "BK-2598", date: daysAgo(28), leadId: "LD-2419", leadName: "Pari Khan",
      unit: "RC-S204", project: "Royal Commercia", typology: "Office Suite", carpet: 620,
      bsp: 9920000, otherCharges: 480000, gst: 372000, total: 10772000,
      tokenAmount: 500000, tokenPaid: true, agreementSigned: true,
      stage: "registered", owner: "Vikram Joshi",
    },
  ];

  // ---------- Payment schedule template (10-stage construction-linked) ----------
  const paymentTemplate = [
    { stage: "Booking",                       pct: 10,  trigger: "On booking" },
    { stage: "Within 30 days",                pct: 15,  trigger: "T+30" },
    { stage: "Plinth completion",             pct: 10,  trigger: "Milestone" },
    { stage: "1st slab",                      pct: 10,  trigger: "Milestone" },
    { stage: "3rd slab",                      pct: 10,  trigger: "Milestone" },
    { stage: "5th slab",                      pct: 10,  trigger: "Milestone" },
    { stage: "Brickwork & internal plaster",  pct: 10,  trigger: "Milestone" },
    { stage: "Flooring & tiling",             pct: 10,  trigger: "Milestone" },
    { stage: "Finishing & external",          pct: 10,  trigger: "Milestone" },
    { stage: "Possession",                    pct: 5,   trigger: "Possession" },
  ];

  // Generate detailed payment schedules
  const paymentDues = [];
  bookings.forEach((bk, bIdx) => {
    paymentTemplate.forEach((step, sIdx) => {
      const amount = Math.round(bk.bsp * step.pct / 100);
      const dueOffset = sIdx === 0 ? 0 : sIdx * 60 + rint(-10, 10);
      const dueDate = (() => { const d = new Date(bk.date); d.setDate(d.getDate() + dueOffset); return d.toISOString().slice(0,10); })();
      let status, paidAt = null;
      if (sIdx <= 1 || (bk.stage === "registered" && sIdx <= 3)) {
        status = "paid";
        paidAt = (() => { const d = new Date(dueDate); d.setDate(d.getDate() + rint(0, 5)); return d.toISOString().slice(0,10); })();
      } else if (new Date(dueDate) < today && (sIdx === 2 || sIdx === 3)) {
        status = rand() < 0.3 ? "overdue" : "due";
      } else {
        status = "scheduled";
      }
      paymentDues.push({
        id: bk.id + "-" + (sIdx + 1),
        bookingId: bk.id, leadName: bk.leadName, unit: bk.unit, project: bk.project,
        stageName: step.stage, pct: step.pct, amount, dueDate, status, paidAt,
        receiptNo: status === "paid" ? "RCP-" + (4200 + bIdx * 10 + sIdx) : null,
      });
    });
  });

  // ---------- Campaigns ----------
  const campaigns = [
    { id: "CMP-001", name: "Diwali Booking Drive 2025", channel: "Multi-channel", status: "active",
      startDate: daysAgo(20), endDate: daysFromNow(8), budget: 850000, spent: 612000,
      leads: 124, qualified: 38, visits: 19, bookings: 4, cpl: 4935 },
    { id: "CMP-002", name: "Hingna Hoarding Campaign", channel: "Outdoor", status: "active",
      startDate: daysAgo(45), endDate: daysFromNow(15), budget: 320000, spent: 240000,
      leads: 47, qualified: 12, visits: 6, bookings: 1, cpl: 5106 },
    { id: "CMP-003", name: "Google Ads — 3BHK Nagpur", channel: "Google", status: "active",
      startDate: daysAgo(60), endDate: daysFromNow(30), budget: 450000, spent: 312000,
      leads: 218, qualified: 54, visits: 23, bookings: 5, cpl: 1431 },
    { id: "CMP-004", name: "MagicBricks Premium Listing", channel: "Portal", status: "active",
      startDate: daysAgo(90), endDate: daysFromNow(60), budget: 240000, spent: 180000,
      leads: 89, qualified: 21, visits: 11, bookings: 2, cpl: 2022 },
    { id: "CMP-005", name: "Republic Day Offer", channel: "Multi-channel", status: "ended",
      startDate: daysAgo(110), endDate: daysAgo(85), budget: 600000, spent: 587000,
      leads: 156, qualified: 41, visits: 22, bookings: 7, cpl: 3763 },
    { id: "CMP-006", name: "Channel Partner Meet 2026", channel: "Event", status: "scheduled",
      startDate: daysFromNow(12), endDate: daysFromNow(13), budget: 380000, spent: 0,
      leads: 0, qualified: 0, visits: 0, bookings: 0, cpl: 0 },
  ];

  // ---------- Channel partner extras ----------
  channelPartners.forEach((cp, i) => {
    cp.totalLeads  = [42, 31, 23][i];
    cp.bookings    = [4, 2, 1][i];
    cp.commission  = [185000, 96000, 42000][i];
    cp.outstanding = [62000, 24000, 18000][i];
    cp.tier        = ["Platinum", "Gold", "Silver"][i];
    cp.phone       = ["+91 98220 33445", "+91 99221 19087", "+91 96650 78211"][i];
    cp.email       = ["sandeep@realtyjunction.in", "manisha@nhadvisor.in", "amit@propconnect.co"][i];
  });

  return { projects, sources, stages, owners, channelPartners, leads, activity, tasks, documents, inventory, abhimanGrid, visits, bookings, paymentTemplate, paymentDues, campaigns };
})();
