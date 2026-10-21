/**
 * The site, in English. This file is the source; hi.ts and mr.ts must match it
 * key for key, which the compiler enforces through `Content = typeof en`.
 *
 * Rules this content is held to:
 *   - One live business. No customer count beyond the true one, no testimonial,
 *     no logo, no uptime figure, no benchmark, no certification, no press.
 *   - Every service row carries a status and the status is the truth. LIVE
 *     means running in production for someone who pays. BUILDING means the
 *     records exist and the screens for that trade do not. WAITLIST means not
 *     planned. BUILDING is not "available"; do not let an edit make it so.
 *   - No percentage anywhere. There is no measurement to cite, and the build
 *     fails if one appears.
 *   - Patient testimonials can never appear. The NMC Code of Medical Ethics
 *     prohibits a practitioner publishing them.
 *   - Keep it short. An owner reads this between customers, on a phone.
 */

export const en = {
  locale: 'en',
  dir: 'ltr',

  site: {
    name: 'Nayaverse',
    tagline: 'One system for how your business runs',
    description:
      'Business software built in India — counter, stock, bookings, billing, customers and your own website. Live today for clinics; retail, food, salons and gyms are being built.',
  },

  nav: {
    businesses: 'Businesses',
    system: 'The system',
    fares: 'Fares',
    about: 'About',
    questions: 'Questions',
    enquire: 'Enquire',
    skip: 'Skip to content',
    language: 'Language',
  },

  hero: {
    headline: ['One system', 'for how your', 'business runs'],
    route: ['Counter', 'Stock', 'Bookings', 'Billing', 'Customers', 'Your website'],
    lede:
      'What you sell, what is left, who is booked, what was billed and who owes you — in one place. It runs a clinic in Sangli today. The rest of the chart is being built.',
    fareLabel: 'From',
    fareFrom: '₹3,000',
    farePeriod: 'a month, per business',
    action: 'Book a walkthrough',
    secondary: 'Find your business',
    tally: {
      live: 'A clinic in Sangli',
      building: 'Retail, food, salons, gyms, services',
      waitlist: 'Hotels, and whatever you tell us',
    },
  },

  readiness: {
    LIVE: 'Live',
    BUILDING: 'Building',
    WAITLIST: 'Waitlist',
  },

  readinessMeaning: {
    LIVE: 'Running in production, for a business that pays for it.',
    BUILDING:
      'Being built now. The records this trade needs already exist — catalogue, orders, stock, bookings, billing, customers. The screens that speak your language are the work in hand. Whoever comes first on a row shapes them, and keeps the price they start on.',
    WAITLIST: 'Not planned yet — it is a genuinely different shape. Tell us and it goes on the list.',
  },

  servicePanel: {
    bandTitle: 'Service chart',
    heading: 'Find your business',
    lede:
      'Twenty-three kinds of business, and exactly one in production today. Here is the chart with the status on every row, rather than a feature grid that hides which is which.',
    hint: 'Select a row to see what it gets and where it stands.',
    all: 'All',
    rows: 'rows',
    footer: 'Not on the chart, or on it with the wrong status? Say so — who asks decides what gets built next.',
    stamp: 'Chart current',
    platformType: 'Platform type',
    colBusiness: 'Business',
    colGroup: 'Group',
    colStatus: 'Status',
  },

  /** group and detail per service row, keyed by the row code in services.ts. */
  groups: {
    Health: 'Health',
    Retail: 'Retail',
    Food: 'Food',
    'Personal care': 'Personal care',
    Fitness: 'Fitness',
    Education: 'Education',
    Services: 'Services',
    Hospitality: 'Hospitality',
  },

  services: {
    '01': {
      name: 'Clinic — general practice',
      detail:
        'The deepest thing built. Triaged queue, file numbers, case sheets, prescriptions off a 2,46,000-medicine Indian database, certificates, labs, pharmacy stock, billing, and the clinic’s own site in twelve languages. Running in Sangli.',
    },
    '02': {
      name: 'Small hospital — OPD',
      detail: 'The same clinical system across departments and several doctors. Built; no hospital running it yet.',
    },
    '03': { name: 'Pharmacy', detail: 'Batch stock with expiry-first dispensing, the medicine database, counter billing.' },
    '04': { name: 'Kirana store', detail: 'Counter billing, stock that falls as you sell, and khata for those who pay later.' },
    '05': { name: 'Retail shop', detail: 'Catalogue with variants, orders, stock movements, cash, UPI and card.' },
    '06': { name: 'Grocery', detail: 'Fast counter entry, loose and weighed items, supplier records.' },
    '07': { name: 'Electronics', detail: 'Serial-tracked items, warranty dates on the invoice, service tickets against a sale.' },
    '08': { name: 'Boutique', detail: 'Size and colour variants, alterations as a booking, measurements on file.' },
    '09': { name: 'D2C brand', detail: 'Catalogue, orders, stock and your own storefront, on the same records.' },
    '10': { name: 'Restaurant', detail: 'Menu as a catalogue, table and takeaway orders, ingredient stock, the day’s closing.' },
    '11': { name: 'Café', detail: 'Quick counter orders, a short menu that changes often, daily takings.' },
    '12': { name: 'Bakery', detail: 'Standing orders, cake bookings against a date, raw-material stock.' },
    '13': { name: 'Salon', detail: 'Services and prices, appointments against a stylist, what each client had last time.' },
    '14': { name: 'Spa', detail: 'Rooms and therapists as bookable resources, packages, prepaid balances.' },
    '15': { name: 'Gym and fitness', detail: 'Memberships with an expiry you can see coming, classes, and who has stopped turning up.' },
    '16': { name: 'Coaching class', detail: 'Batches, attendance, fee instalments and what is outstanding per student.' },
    '17': { name: 'School or institute', detail: 'Enrolment, fee schedules, staff, and a site with admissions information.' },
    '18': { name: 'Travel agency', detail: 'Enquiries, quotations, bookings against dates, payments in instalments.' },
    '19': { name: 'Real estate', detail: 'Listings, site visits as bookings, a follow-up trail per enquiry.' },
    '20': { name: 'Home business', detail: 'Orders over WhatsApp, a simple catalogue, and a page people can be sent to.' },
    '21': { name: 'Services — any trade', detail: 'Jobs, quotations, visits and invoices. Where electricians, tailors and repair shops land.' },
    '22': {
      name: 'Hotel or lodge',
      detail: 'Not built. Rooms, nights and occupancy are a different shape, and we will not pretend otherwise.',
    },
    '23': {
      name: 'Something not on this chart',
      detail: 'There is a general type carrying catalogue, orders, stock, bookings, billing and customers. If that fits how you work, say so.',
    },
  },

  chartSection: {
    bandTitle: 'Day charts',
    heading: 'What finished looks like',
    lede:
      'One of these runs a clinic in Sangli today. The other four are designs for rows still being built — so you can judge in thirty seconds whether we understand your trade.',
    hint: 'Select a row to open the record underneath it.',
    liveNotice: 'The live product’s own sort order, on sample rows. Watch what happens when an emergency walks in.',
    buildingNotice: 'Nothing here is running in a business yet. The records behind it are built; the screens for this trade are the work in hand.',
    live: 'Live.',
    notBuilt: 'Not built yet.',
    walkIn: 'Walk in an emergency',
    again: 'Run it again',
    clock: 'Clock',
    status: 'Status',
    announce: 'An emergency was admitted and placed ahead of everyone waiting.',
  },

  manifestPanel: {
    bandTitle: 'Manifest',
    heading: 'Everything the day needs, in one place',
    lede:
      'No separate billing software, no booking app that does not know your prices, no notebook for who owes you. One record per customer, one list of what you sell, one place the money is counted.',
    entries: 'entries in',
    parts: 'parts',
  },

  manifest: [
    {
      heading: 'Selling',
      note: 'Take the order, hold the booking, get paid — and have all three agree.',
      items: [
        { name: 'Catalogue', detail: 'Products with variants, services with a duration and a price. One list behind the counter, the website and every invoice, so a price changes once.' },
        { name: 'Orders', detail: 'At the counter, on the phone or from your site, with line items and who served it.' },
        { name: 'Bookings', detail: 'Against a person, a room or a chair — so two bookings cannot land on the same one.' },
        { name: 'Payments', detail: 'Part payments across cash, UPI and card. What you have earned counts money received, never invoices raised.' },
      ],
    },
    {
      heading: 'Stock and money',
      note: 'Know what you have, what it is worth, and what actually came in today.',
      items: [
        { name: 'Stock', detail: 'Every movement recorded — received, sold, returned, wasted — so the number on screen can be explained.' },
        { name: 'Batches and expiry', detail: 'Dispensed first-expired-first-out, never from an expired batch. Short stock warns; it never blocks.' },
        { name: 'Daily closing', detail: 'What came in, by payment mode. The number you check before locking up.' },
        { name: 'Analytics', detail: 'What sells, when you are busy, who is performing, new against returning.' },
      ],
    },
    {
      heading: 'Customers and staff',
      note: 'Remember every customer; give each person only the screen they need.',
      items: [
        { name: 'Customers', detail: 'What they bought or booked before, and what they still owe. Duplicates are detected and merged.' },
        { name: 'Staff logins', detail: 'Each person sees their job, not the rest of the business. Admin rights are separate from the job itself.' },
        { name: 'Conversations', detail: 'Messages kept against the customer’s record, so whoever serves them next knows what was said.' },
        { name: 'Tickets', detail: 'A complaint or a repair tracked to its close, against the sale it came from.' },
      ],
    },
    {
      heading: 'Your presence',
      note: 'Be findable by someone searching nearby at nine in the evening.',
      items: [
        { name: 'Your own website', detail: 'On your own domain, in your colours, from sections you reorder. Server-rendered, so search engines read it and a forwarded link unfurls.' },
        { name: 'Twelve Indian languages', detail: 'Fixed site text hand-translated into all twelve; your own words are yours to enter or have drafted and corrected. Shipped on the clinic product today.' },
        { name: 'A live queue', detail: 'Position and status with no login and nobody’s name shown. People stop asking the desk every five minutes.' },
      ],
    },
    {
      heading: 'Records',
      note: 'Paperwork that prints right, and records that stay yours.',
      items: [
        { name: 'Documents you compose', detail: 'Reorder, rename or hide any section; build the table’s own columns. Already have letterhead? Turn our header off and set a top offset in millimetres.' },
        { name: 'An access log nobody can edit', detail: 'Who read or changed which record, and when. No route in the API edits or deletes it. Built for what DPDP and NABH ask for.' },
        { name: 'Your data, exportable', detail: 'Full JSON and per-table CSV, whenever you want, with no credential material in the file.' },
      ],
    },
  ],

  growth: {
    bandTitle: 'Account',
    heading: 'Where it pays for itself',
    lede: 'Not features. The places time and money leak out of a business like yours, and what is done about each.',
    colLeak: 'The leak',
    colFix: 'What is done about it',
    colRemoves: 'Removes',
    entries: 'entries · no measured figures on this page',
    stamp: 'No figures claimed',
    rows: [
      { leak: 'The queue is an argument', removes: 'Interruptions', fix: 'A declared priority outranks arrival order, computed live and on a screen everyone can read. Reception stops arbitrating.' },
      { leak: 'The same thing typed twice', removes: 'Re-entry', fix: 'A returning customer’s last prescription, order or booking repeats in one keystroke. Search jumps to anyone by name, number or phone.' },
      { leak: 'Earned but never collected', removes: 'Write-offs', fix: 'Earnings count money received, never invoices raised. What is outstanding is a separate list with a name against every figure.' },
      { leak: 'Stock that expires on the shelf', removes: 'Dead stock', fix: 'Batches go first-expired-first-out, never expired. Expiry and low stock surface before they bite, not at the counter.' },
      { leak: 'The customer who stopped coming', removes: 'Silent churn', fix: 'Who is overdue, whose membership lapses this month, who has not been in for three weeks. A list you can work through.' },
      { leak: 'One person, two records', removes: 'Split histories', fix: 'Duplicates detected and merged. Half a history at the moment you need all of it is a safety problem in a clinic.' },
      { leak: 'No address on the internet', removes: 'Being invisible', fix: 'Your own site on your own domain, server-rendered, in up to twelve Indian languages, with your live queue on it.' },
      { leak: 'Paperwork rebuilt every time', removes: 'Re-typing', fix: 'Invoices, prescriptions and reports composed once — your sections, your columns, your letterhead — then printed the same way for ever.' },
    ],
    honesty:
      'These are mechanisms, not measured outcomes. One business is live and no study has been run, so there is no percentage on this page and there will not be one until there is a real measurement with a method attached.',
  },

  servicesOffer: {
    bandTitle: 'Counter services',
    heading: 'Work we do, not software you operate',
    lede:
      'Software gets a business running. Most then need somebody to do the work of being findable. In the two larger classes that work is in the package; below those it is quoted.',
    band: 'Done by people · included from Growing upward',
    included: [
      { name: 'Your site, built for you', detail: 'Pages written, your photographs placed, services and prices entered, in your languages, checked on a phone first.' },
      { name: 'Found on a map and in search', detail: 'Your listing claimed and filled in, hours and directions right, search markup and sitemap in place.' },
      { name: 'Campaigns written and sent', detail: 'Offers to your own customer list, written and scheduled, results read back in plain language.' },
      { name: 'Print that matches the screen', detail: 'Letterhead, cards, price lists, the board outside — one identity across all of it.' },
      { name: 'Your old records brought across', detail: 'Registers or spreadsheets migrated by hand and checked against the originals. Usually the thing that stops people switching.' },
      { name: 'Your staff trained', detail: 'On site where we can reach you, on a call where we cannot, and again a month later.' },
    ],
    availability: [
      { klass: 'Single counter', what: 'Quoted separately, if you want it' },
      { klass: 'Growing', what: 'Setup, migration and training included' },
      { klass: 'Multi-location', what: 'All of it included' },
      { klass: 'Custom', what: 'Scoped with you, written into the agreement' },
    ],
    honesty:
      'This is people doing work, with the time that implies. Not a feature that switches on. The amount in a package is finite and agreed in writing before you pay.',
  },

  farePanel: {
    bandTitle: 'Fare chart',
    band: 'Per business · billed monthly · no setup fee',
    heading: 'Find your row',
    lede: 'Price follows the size of the operation, not a count of features. Say how many people need a login.',
    selectorLabel: 'People who need a login',
    colClass: 'Class',
    colLogins: 'Logins',
    colFare: 'Fare',
    yourRow: 'Your row',
    action: 'Book a walkthrough',
    note: 'Billed monthly, per business. No setup fee. Your records are exportable in full from day one, so leaving costs nothing but the notice. Whoever is first on a row keeps the price they start on.',
    pageHeading: 'What it costs',
    pageLede:
      'From ₹3,000 a month, per business, by the number of people who need a login. Billed monthly, no setup fee, and your records are exportable in full from the first day.',
  },

  fares: [
    {
      code: 'A',
      klass: 'Single counter',
      forWhom: 'One location, the owner and a person or two.',
      size: '1–2 logins',
      fare: '₹3,000',
      period: 'a month',
      includes: 'The whole working day: catalogue, orders, bookings, stock, payments, invoices, customers, your own website, and documents you compose. Full export from day one.',
    },
    {
      code: 'B',
      klass: 'Growing',
      forWhom: 'Staff who each need a login, real stock, a booking diary that matters.',
      size: '3–10 logins',
      fare: '₹12,000',
      period: 'a month',
      includes: 'Everything in Single counter, plus staff accounts with their own roles, batch stock with expiry-first dispensing, the expense ledger and P&L, campaigns, analytics — and setup, migration and training done for you.',
    },
    {
      code: 'C',
      klass: 'Multi-location',
      forWhom: 'Several branches, or a small hospital running OPD across departments.',
      size: '11–40 logins',
      fare: '₹50,000',
      period: 'a month',
      includes: 'Everything in Growing, plus your site in twelve Indian languages, the append-only access log and full export, the deeper clinical modules where it is a clinic — and all the counter services: site, listings, campaigns and print.',
    },
    {
      code: 'D',
      klass: 'Custom',
      forWhom: 'More than that, or a requirement none of the rows above fits.',
      size: '40+ logins',
      fare: 'On enquiry',
      period: 'above ₹50,000',
      includes: 'Everything in Multi-location, scoped and written into the agreement. Priced against what you actually run — locations, departments, and how much of your old records need bringing across.',
    },
  ],

  about: {
    bandTitle: 'About',
    band: 'Particulars of the operator',
    heading: 'Who you would be dealing with',
    paragraphs: [
      'The software is written, deployed, supported and sold by the same person. There is no sales team to be handed to, and no support tier to escalate through.',
      'It started with one clinic in Sangli that needed its whole day handled — the queue, the case sheet, the prescription, the bill, the stock, and a website patients could find. Building that properly for one real practice is why the clinical side goes as deep as it does.',
      'The rest of the chart is the same records wearing the words of another trade. That is why one person can keep it all working — and it is the honest limit on how fast a row turns from Building to Live.',
    ],
    facts: [
      { label: 'Built by', value: 'Suhelali Pakjade, who also answers the phone' },
      { label: 'Based in', value: 'Bengaluru — from Sangli, Maharashtra' },
      { label: 'Live businesses', value: 'One clinic in Sangli, paying, in production' },
      { label: 'Outside money', value: 'None' },
      { label: 'Your data', value: 'Exportable in full, from day one' },
    ],
    closing:
      'If you need a vendor with a thousand customers and a support desk, there are good ones. If you would rather deal with the person who wrote it, that is the trade on offer.',
  },

  conditionsPanel: {
    bandTitle: 'Conditions of carriage',
    heading: 'The awkward questions',
    lede: 'Including the ones where the answer is no.',
    clauses: 'clauses',
  },

  conditions: [
    {
      q: 'How many businesses run this?',
      a: 'One. A clinic in Sangli, paying, in production. Every other row is being built, which is what its status says. If you need a vendor with a thousand customers, buy one — we would rather that than let you down.',
    },
    {
      q: 'What does “Building” mean on my row?',
      a: 'The plumbing is there; the screens for your trade are not finished. Catalogue, orders, stock, bookings, billing, customers and your website are written and working. Being first on a row means we build the rest with you in front of us. Expect rough edges; you keep the price you start on.',
    },
    {
      q: 'Does it run on the computer I have?',
      a: 'It runs in a browser — the counter machine, a laptop, a tablet or a phone. Nothing to install, nothing that breaks when Windows updates. Someone standing at a counter on a phone is the layout designed for first.',
    },
    {
      q: 'What happens to my data if I leave?',
      a: 'You export it. Full JSON and per-table CSV, every customer, order, invoice and record, from day one and without asking us. Uploaded files come too. No export fee, no notice period on your own data.',
    },
    {
      q: 'Who else can see my records?',
      a: 'A clinic gets its own database — not a row with your id in a shared table. The business platform is multi-tenant with per-business scoping, which is the ordinary arrangement and an honest difference worth knowing. Either way, the only thing read from a running deployment is whether its health check answers.',
    },
    {
      q: 'Will it message my customers on WhatsApp?',
      a: 'Not yet, and this is the one we are asked most. The integration is written against Meta’s API but has never run against live credentials, so treat it as not working until we say otherwise. No SMS or email delivery either. Reminders are in-app.',
    },
    {
      q: 'Can it print on my existing letterhead?',
      a: 'Yes. Turn our header off and set a top offset in millimetres, and the document starts below your pre-printed letterhead instead of across it.',
    },
    {
      q: 'Is this certified for DPDP or NABH?',
      a: 'No, and nobody issues such a certificate for software. What exists is the record-keeping they ask for: an append-only log of who read or changed what, with no route in the API that can edit or delete it.',
    },
    {
      q: 'Will it translate my prescriptions?',
      a: 'No, deliberately. Translation touches your website only. A mistranslated dose is a patient-safety incident, so dosages, diagnoses and certificates stay exactly as written.',
    },
    {
      q: 'How long does it take to start?',
      a: 'A business needs its database, its deployment, its certificate and its domain, then the logins. Honest position: automated but young — the first clinic took several attempts and needed manual repair. Expect us to sit with you through it.',
    },
  ],

  enquiry: {
    bandTitle: 'Enquiry',
    band: 'Nothing is posted or stored — this composes a message you send',
    heading: 'Enquiry counter',
    lede:
      'Twenty minutes, your screen and mine, on what you actually do at the counter every day. No slide deck. If it does not fit how you work, I will say so.',
    businessName: 'Business name',
    businessNamePlaceholder: 'As it is on the board outside',
    whatKind: 'What kind',
    chooseRow: 'Choose a row',
    city: 'City',
    loginsNeeded: 'People needing a login',
    yourName: 'Your name',
    phone: 'Phone',
    phonePlaceholder: 'So I can call rather than type',
    submit: 'Send on WhatsApp',
    submitFallback: 'Compose an email',
    unavailable:
      'The enquiry channel is not connected yet. Set the WhatsApp number, phone and email in src/content/contact.ts.',
    labelPhone: 'Phone',
    labelEmail: 'Email',
    messageTitle: 'Nayaverse enquiry',
    mBusiness: 'Business',
    mKind: 'Kind',
    mCity: 'City',
    mLogins: 'Logins needed',
    mFrom: 'From',
  },

  footer: {
    lines: [
      'Nayaverse — business software built in India, for how Indian businesses actually run.',
      'Full data export from the first day. One clinic live in Sangli; every other row is being built, and says so.',
    ],
    legal:
      'No patient testimonials are published anywhere in this product. The NMC Code of Medical Ethics prohibits a registered practitioner requesting or publishing them.',
  },

  charts: {
    columnLabels: {
      token: 'Tkn', file: 'File', age: 'Age', reason: 'Reason', mark: 'Priority', waited: 'Wait',
      time: 'Time', client: 'Client', service: 'Service', stylist: 'Stylist', due: 'Due',
      member: 'Member', plan: 'Plan', expires: 'Expires', seen: 'Last in', dues: 'Dues',
      bill: 'Bill', customer: 'Customer', items: 'Items', amount: 'Amount',
      table: 'Table', covers: 'Covers', order: 'Order', waiter: 'Served by', elapsed: 'Seated',
    },

    clinic: {
      tab: 'Clinic',
      bandTitle: 'OPD chart',
      unit: 'rows',
      heading: 'A queue that sorts itself',
      lede: 'A declared priority outranks the order people arrived in. Reception books a walk-in, the queue re-ranks, and nobody at the desk argues about whose turn it is. Someone already with the doctor is never pulled out.',
      note: 'Sample rows, not a real clinic. Patients appear by the last four digits of their file number — all the live public queue ever shows.',
      rows: {
        '04': { reason: 'Diabetes follow-up', status: 'Done', mark: '', detail: [
          { label: 'Vitals', value: 'BP 138/86 · 78 bpm · 81 kg' },
          { label: 'Diagnosis', value: 'Type 2 diabetes mellitus' },
          { label: 'Prescribed', value: 'Metformin 500 mg · twice daily · 30 days' },
        ] },
        '07': { reason: 'Antenatal check', status: 'Serving', mark: 'Antenatal', detail: [
          { label: 'Vitals', value: 'BP 110/70 · 84 bpm · 61 kg' },
          { label: 'Allergy', value: 'Penicillin' },
          { label: 'Follow-up', value: '4 weeks' },
        ] },
        '09': { reason: 'BP review', status: 'Next', mark: 'Senior', detail: [
          { label: 'Complaint', value: 'Giddiness on standing' },
          { label: 'Last visit', value: 'Hypertension — 6 weeks ago' },
        ] },
        '11': { reason: 'Cough and cold', status: 'Waiting', mark: 'Child', detail: [
          { label: 'Dose', value: 'Computed from 19 kg' },
        ] },
        '12': { reason: 'Fever, 3 days', status: 'Waiting', mark: '', detail: [
          { label: 'Ordered', value: 'CBC, Dengue NS1' },
        ] },
        '13': { reason: 'Dressing', status: 'Waiting', mark: '', detail: [] },
        '14': { reason: 'Chest pain', status: 'Next', mark: 'Emergency', detail: [
          { label: 'Vitals', value: 'BP 148/92 · 104 bpm · SpO₂ 96%' },
          { label: 'Triage', value: 'Emergency — ahead of every waiting row' },
        ] },
      },
    },

    salon: {
      tab: 'Salon',
      bandTitle: 'Today’s chairs',
      unit: 'bookings',
      heading: 'The same chart, in a salon',
      lede: 'Who is in which chair, who is free at half past, and whether the walk-in in front of you can be taken without pushing the next booking.',
      note: 'A design, not a deployment. Sample rows for a salon day.',
      rows: {
        s1: { client: 'Chair 1', service: 'Cut and finish', status: 'Done', mark: '', detail: [] },
        s2: { client: 'Chair 2', service: 'Colour — roots', status: 'Serving', mark: 'Runs 90m', detail: [
          { label: 'Last visit', value: 'Same shade, 7 weeks ago' },
          { label: 'Product', value: 'Taken off shelf stock on finish' },
        ] },
        s3: { client: 'Chair 1', service: 'Beard trim', status: 'Next', mark: '', detail: [] },
        s4: { client: 'Walk-in', service: 'Cut', status: 'Waiting', mark: 'No booking', detail: [
          { label: 'Fits', value: 'Asha is free 12:30–13:00' },
          { label: 'Why it matters', value: 'A walk-in turned away is the whole margin on that hour' },
        ] },
        s5: { client: 'Chair 2', service: 'Bridal trial', status: 'Waiting', mark: 'Advance paid', detail: [] },
      },
    },

    gym: {
      tab: 'Gym',
      bandTitle: 'Memberships',
      unit: 'members',
      heading: 'The chart about who stopped coming',
      lede: 'A gym loses money to a membership that quietly lapsed and a member nobody noticed had stopped coming. This is that list, with the call worth making today at the top.',
      note: 'A design, not a deployment. Members appear by the last four of their number.',
      rows: {
        g1: { plan: 'Annual', expires: 'in 4 days', seen: 'Yesterday', status: 'Renew', mark: 'Expiring', detail: [
          { label: 'Joined', value: 'Eleven months ago, renewed once' },
          { label: 'Why it is top', value: 'A renewal asked for before it lapses is the cheapest sale a gym makes' },
        ] },
        g2: { plan: 'Quarterly', expires: 'in 6 weeks', seen: '23 days ago', status: 'At risk', mark: 'Not seen', detail: [
          { label: 'Pattern', value: 'Four times a week until last month' },
        ] },
        g3: { plan: 'Monthly', expires: 'in 11 days', seen: 'Today', status: 'Owes', mark: 'Unpaid', detail: [] },
        g4: { plan: 'Annual + PT', expires: 'in 7 months', seen: 'Today', status: 'Active', mark: '', detail: [] },
        g5: { plan: 'Monthly', expires: 'Lapsed', seen: '2 months ago', status: 'Lapsed', mark: '', detail: [] },
      },
    },

    kirana: {
      tab: 'Kirana',
      bandTitle: 'Today’s counter',
      unit: 'bills',
      heading: 'The counter, and the book beside it',
      lede: 'What was sold today, and who is paying later. Khata sits beside cash and UPI as a way of paying, so the book by the till and the screen never disagree.',
      note: 'A design, not a deployment. Sample bills for a morning.',
      rows: {
        k1: { customer: 'Counter', status: 'Cash', mark: '', detail: [] },
        k2: { customer: '···0052', status: 'Khata', mark: 'On account', detail: [
          { label: 'Outstanding', value: '₹3,410 across four bills' },
          { label: 'Oldest', value: '31 days' },
        ] },
        k3: { customer: 'Counter', status: 'UPI', mark: '', detail: [] },
        k4: { customer: '···0118', status: 'Cash', mark: '', detail: [] },
        k5: { customer: 'Counter', status: 'Open', mark: 'At counter', detail: [] },
      },
    },

    restaurant: {
      tab: 'Restaurant',
      bandTitle: 'Floor',
      unit: 'tables',
      heading: 'Tables are a queue too',
      lede: 'Which table is waiting on the kitchen, which has asked for the bill, and which has been sitting twenty minutes with nobody back to it. That last one is the table that does not come again.',
      note: 'A design, not a deployment. Sample covers for one service.',
      rows: {
        r1: { order: 'Mains out', status: 'Eating', mark: '', detail: [] },
        r2: { order: 'Waiting on mains', status: 'Chase', mark: 'Kitchen late', detail: [
          { label: 'Ordered', value: '22 minutes ago' },
          { label: 'Why it is top', value: 'The table nobody went back to is the one that does not return' },
        ] },
        r3: { order: 'Bill asked', status: 'Billing', mark: 'Bill asked', detail: [] },
        r4: { order: 'Just seated', status: 'Ordering', mark: '', detail: [] },
        r5: { order: 'Cleared', status: 'Free', mark: '', detail: [] },
      },
    },
  },

  notFound: {
    heading: 'No such row',
    lede: 'That page is not on the chart. The ones that are:',
    chart: 'The chart',
    fares: 'Fares',
  },
};

/**
 * The shape every locale must fill.
 *
 * Deliberately NOT `as const`: with literal types, `const hi: Content` would
 * demand the Hindi strings be identical to the English ones. Widened to
 * `string`, the compiler instead enforces the thing that matters -- that a
 * translation is complete, with no key quietly missing and falling back to a
 * blank on a page somebody is deciding whether to trust.
 */
export type Content = typeof en;
