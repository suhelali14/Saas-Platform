/**
 * Guides: plain answers to the questions doctors and clinic owners in India
 * actually search for, and ask AI assistants.
 *
 * Why these exist: product pages answer "what does Nayaversse do". Nobody
 * searches for that until they have heard of it. They search "OPD queue
 * management" or "what should a prescription contain", and the page that
 * answers well is the one search engines and AI assistants cite. A guide is
 * useful on its own first and mentions the product once, at the end.
 *
 * Rules these are held to, same as the rest of the site:
 *   - No invented figures. No percentage, no "clinics save X hours".
 *   - Law and tax are stated only as far as the source supports, with the
 *     source named, and a line saying to check the current position. A
 *     wrong compliance claim on a page doctors act on is worse than none.
 *   - Other products are named only to say they exist. Nothing is claimed
 *     about what they do or cost.
 *
 * English only for now. Hindi and Marathi versions are the next step; the
 * routing already handles a page that exists in fewer languages.
 */

export interface GuideSection {
  heading: string;
  body: string[];
  /** Rendered as a checklist after the body paragraphs. */
  list?: string[];
}

export interface Guide {
  slug: string;
  /** On the page. */
  title: string;
  /** In search results; carries the words people type. */
  searchTitle: string;
  /** Meta description, the lede on the page, and the summary AI tools read. */
  description: string;
  published: string;
  updated: string;
  sections: GuideSection[];
  faqs: { q: string; a: string }[];
}

export const guidesIndex = {
  title: 'Guides for clinics',
  searchTitle: 'Clinic Management Guides for Doctors in India | Nayaversse',
  lede:
    'Practical guides for doctors and clinic owners in India: running the OPD queue, writing prescriptions, billing, patient data and the DPDP Act, and choosing clinic software. Written by the people who build Nayaversse.',
};

export const guides: Guide[] = [
  {
    slug: 'how-to-choose-clinic-management-software',
    title: 'How to choose clinic management software in India',
    searchTitle: 'How to Choose Clinic Management Software in India (2026 Checklist)',
    description:
      'A practical checklist for Indian clinics choosing software: what to test in a demo, what to ask about patient data, how to compare prices, and how to run a one-week trial before you commit.',
    published: '2026-11-23',
    updated: '2026-11-23',
    sections: [
      {
        heading: 'Start with your busiest hour, not the feature list',
        body: [
          'Most clinic software looks the same in a demo: patients, appointments, prescriptions, billing. What separates one product from another is how it behaves at 10:30 in the morning with a full waiting room, one doctor and one person at the front desk.',
          'Before you watch any demo, write down your busiest hour. How many patients come in, who checks them in, who takes payment, who dispenses medicine, and what goes wrong. Judge every product against that hour, not against a list of features.',
        ],
      },
      {
        heading: 'The checklist',
        body: ['Go through these in every demo, and ask the vendor to show each one rather than describe it.'],
        list: [
          'Queue: reception can add a walk-in in a few seconds, and the queue follows a priority rule (emergencies, pregnant women, seniors, children) by itself.',
          'Patient file: one record per patient with a file number, found by name, file number or phone. Allergies show first when the doctor opens a visit.',
          'Prescriptions: drug search from a real database of Indian medicines, repeat the last prescription in one step, print on your own letterhead with generic names.',
          'Billing: cash, UPI and card, part payments, and a daily closing that adds up without a spreadsheet.',
          'Pharmacy: stock by batch with expiry dates, and dispensing that uses the earliest expiry first.',
          'Lab: tests ordered from the visit, results attached to the patient file.',
          'Follow-ups: a list of patients who are due or overdue, ready to call.',
          'Staff roles: reception, nurses and doctors each see only what their work needs, and a log records who opened which record.',
          'Website and booking: online booking requests that enter the diary only after the clinic confirms them.',
          'Language: whether patients and staff can use it in Hindi, Marathi or your local language.',
          'Phone: it works on a phone at the front desk, not only on a desktop.',
        ],
      },
      {
        heading: 'Questions to ask about patient data',
        body: [
          "Patient records are the most sensitive thing your clinic holds, and under India's Digital Personal Data Protection Act, 2023 the clinic is responsible for them even when a vendor stores them. Ask every vendor:",
        ],
        list: [
          "Is my clinic's data kept in its own database, or in one shared with other clinics?",
          'Can I export everything (patients, visits, prescriptions, bills) at any time, in a format I can open without your software?',
          'Who at your company can see my records, and is that access logged?',
          'Is every access by my own staff logged, and can the log be edited?',
          'What happens to my data if I stop paying?',
        ],
      },
      {
        heading: 'How to compare prices',
        body: [
          'Compare the cost for a full year for your exact clinic, not the monthly number in an advert. Ask about setup or onboarding fees, charges per doctor or per login, SMS and WhatsApp message costs, extra modules (pharmacy, lab, website), and any fee for exporting your data when you leave.',
          'A cheap plan that charges for every message and every extra login can cost more by the end of the year than a plan priced for your whole clinic.',
        ],
      },
      {
        heading: 'Run a one-week trial before you commit',
        body: [
          'A demo shows the software on the vendor\'s best day. A trial shows it on yours. Use it for one full week of real OPD: check patients in, write prescriptions, take payments, close each day. If your front desk is not faster by the end of the week, it is the wrong product for you, however good the demo looked.',
        ],
      },
      {
        heading: 'Products clinics in India commonly compare',
        body: [
          'Names that come up often include Practo Ray, MocDoc, Zoho for Healthcare and Healthray, alongside many smaller products. Software directories such as Techjockey and SoftwareSuggest list more than a hundred, and some are built for one specialty, such as dental, physiotherapy or Ayurveda.',
          'Most "best clinic software" lists are written by one of the products on the list. Use the checklist above on each product instead of trusting any ranking, including ours.',
        ],
      },
      {
        heading: 'Where Nayaversse fits',
        body: [
          "Nayaversse is clinic software built in India, running in production at Vadgaonkar Clinic in Walwa, Sangli. Each clinic gets its own database, its records can be exported at any time, an append-only audit log records who opened which record, and the clinic's own website comes with it, in up to twelve Indian languages. It is built for single-doctor clinics up to small hospitals. If you want to hold it against the checklist above, book a walkthrough.",
        ],
      },
    ],
    faqs: [
      {
        q: 'What is clinic management software?',
        a: "Software that runs a clinic's daily work in one place: the queue and appointments, patient records, prescriptions, billing, pharmacy stock, lab orders and follow-ups.",
      },
      {
        q: 'Which is the best clinic management software in India?',
        a: 'There is no single best one. The right product fits your busiest hour, keeps your patient data under your control, and is priced for your clinic size. Use a checklist in the demo and run a one-week trial with real patients before you commit.',
      },
      {
        q: 'Does clinic software have to follow the DPDP Act?',
        a: 'The clinic is responsible for patient data under the Digital Personal Data Protection Act, 2023. Good software makes that easier with role-based access, access logs, secure storage and full export.',
      },
      {
        q: 'Can a small clinic use clinic management software on a phone?',
        a: 'Yes, if the product is built for it. Ask to see check-in, the queue and billing on a phone during the demo, because that is how many front desks actually work.',
      },
    ],
  },

  {
    slug: 'opd-queue-management',
    title: 'OPD queue management for small clinics',
    searchTitle: 'OPD Queue Management for Clinics: Tokens, Priority and a Live Queue',
    description:
      'How a small Indian clinic can run its OPD queue without calling out names: token numbers, a fair priority rule for emergencies, pregnant women, seniors and children, and a live queue patients can check on their phone.',
    published: '2026-11-23',
    updated: '2026-11-23',
    sections: [
      {
        heading: 'Why the queue matters more than it looks',
        body: [
          'In most clinics the front desk spends the morning answering one question: who is next? Every interruption slows check-in, and patients who cannot see the order assume it is unfair. A queue that follows a written rule and is visible to everyone fixes both problems.',
        ],
      },
      {
        heading: 'Give tokens, not names',
        body: [
          'Give every patient a token number at check-in and use it everywhere the waiting room can see. A waiting room is a public place, and a name shown beside a doctor or a department can reveal more than the patient wants to share.',
        ],
      },
      {
        heading: 'Write the priority rule down',
        body: [
          'Most clinics already let some patients go ahead. Writing the rule down makes it fair, and stops the front desk from having to defend every exception. A common order:',
        ],
        list: [
          'Emergencies first.',
          'Then pregnant women and senior citizens.',
          'Then children.',
          'Then everyone else, in the order they arrived.',
          'Within each group, first come, first served.',
        ],
      },
      {
        heading: 'Let patients check the queue themselves',
        body: [
          'Show the live queue on a screen in the waiting room, or on a web page patients can open on their own phone. When people can see their position, they stop asking the front desk, and some will step out and come back when their token is near.',
        ],
      },
      {
        heading: 'One front desk, one queue per doctor',
        body: [
          'In a polyclinic, keep one front desk but split the queue by doctor. Each doctor sees only their own list, and the waiting-room screen shows every doctor\'s current token side by side.',
        ],
      },
      {
        heading: 'Measure the wait once a week',
        body: [
          'Note when each patient checks in and when the consultation starts. The gap is the real waiting time. Look at it once a week, by day and by hour, and you will see which session needs a second person at the desk or a different appointment pattern.',
        ],
      },
      {
        heading: 'How Nayaversse runs the queue',
        body: [
          "Reception adds a walk-in in a few seconds and the queue orders itself by the rule above. Patients follow the live queue on a waiting-room screen or their own phone, by token number only, never by name. Booking requests from the clinic's website arrive at the front desk, and nothing enters the day's list until the clinic confirms it.",
        ],
      },
    ],
    faqs: [
      {
        q: 'What is OPD queue management?',
        a: 'The way a clinic decides and shows the order in which outpatients see the doctor: token numbers at check-in, a written priority rule, and a display patients can see.',
      },
      {
        q: 'Who should get priority in a clinic queue?',
        a: 'A common rule is emergencies first, then pregnant women and senior citizens, then children, then everyone else in the order they arrived. Whatever rule you choose, write it down and display it.',
      },
      {
        q: 'Should a waiting-room screen show patient names?',
        a: 'No. Show token numbers only. A waiting room is public, and a name next to a doctor or department can reveal private health information.',
      },
    ],
  },

  {
    slug: 'dpdp-act-for-clinics',
    title: 'The DPDP Act for clinics: what a small clinic needs to do',
    searchTitle: 'DPDP Act and DPDP Rules 2025 for Clinics: A Practical Checklist',
    description:
      "What India's Digital Personal Data Protection Act, 2023 and the DPDP Rules notified in November 2025 mean for a small clinic: the rollout dates and a plain checklist. Not legal advice.",
    published: '2026-11-23',
    updated: '2026-11-23',
    sections: [
      {
        heading: 'In one paragraph',
        body: [
          "The Digital Personal Data Protection Act, 2023 (the DPDP Act) governs how personal data in digital form is collected and used in India. A clinic that keeps patient records in software, on a computer or on a phone is a data fiduciary: it decides why and how that data is used, and it is responsible for it, including when a software vendor stores it on the clinic's behalf.",
        ],
      },
      {
        heading: 'The dates that matter',
        body: [
          'The Ministry of Electronics and Information Technology notified the DPDP Rules on 13 November 2025, with a rollout in three stages. The provisions setting up the Data Protection Board took effect at once. The rules for consent managers follow after twelve months, in November 2026. The remaining obligations, including reasonable security safeguards, privacy notices and breach reporting, apply after eighteen months, in May 2027.',
          'That gives a clinic until May 2027 for most of its own obligations. It is not long to change how a front desk works, so start now.',
        ],
      },
      {
        heading: 'A checklist for the clinic',
        body: ['None of these needs a large budget. Most are habits.'],
        list: [
          'Know what you hold: list the patient data you collect (registration details, phone numbers, visit notes, reports, scans) and where each lives: software, paper, WhatsApp, a laptop.',
          'Tell patients why: a short notice at registration that says what you collect, why, and whom to contact about it.',
          'Collect only what care needs, and stop collecting what you never use.',
          'Give each staff member their own login and only the access their work needs. Shared logins make it impossible to know who did what.',
          'Keep an access log of who opened which record and when, and keep it where nobody can edit it.',
          'Secure the basics: strong passwords, no patient files on personal phones or in group chats, and backups you have actually tested restoring.',
          'Plan for a breach before it happens: who decides, how you inform the Data Protection Board and the affected patients, and how you record what happened.',
          'Answer patients: a patient can ask what you hold about them and ask you to correct it. Decide who handles those requests.',
          "Check your vendors: your software, lab and any outsourced service process data for you. Ask how they protect it, and confirm you can export and delete it.",
        ],
      },
      {
        heading: "Children's data",
        body: [
          "The Rules generally require verifiable parental consent before processing a child's data, and restrict tracking and behavioural monitoring of children. They exempt healthcare providers from these conditions where the processing is needed to provide healthcare. Read the exemption narrowly: it covers care, not marketing.",
        ],
      },
      {
        heading: 'Where software helps, and where it does not',
        body: [
          'Software can enforce separate logins and role-based access, keep an append-only access log, store each clinic\'s data separately, and let you export everything. It cannot write your privacy notice for you, decide your breach process, or stop someone forwarding a report on WhatsApp. Those are the clinic\'s decisions.',
          'Nayaversse runs each clinic on its own database, logs every access to a patient record in a log that cannot be edited, separates access by role, and exports the full record at any time.',
        ],
      },
      {
        heading: 'This is not legal advice',
        body: [
          "This guide summarises the Act and the published rollout dates for a general reader. Your clinic's situation may differ. Read the Act and the Rules, and ask a lawyer before you rely on any single point.",
        ],
      },
    ],
    faqs: [
      {
        q: 'Does the DPDP Act apply to small clinics?',
        a: 'It applies to the processing of personal data in digital form, so a clinic that keeps patient records in software, on a computer or on a phone is covered. Check the Act and the Rules for any exemption that may apply to your situation.',
      },
      {
        q: 'When do clinics have to comply with the DPDP Rules?',
        a: 'The Rules were notified on 13 November 2025 and roll out in stages. Most obligations, including security safeguards, notices and breach reporting, apply eighteen months after notification, in May 2027.',
      },
      {
        q: 'Can a clinic send reports to patients on WhatsApp?',
        a: 'Many clinics do. The clinic remains responsible for that data, so send reports only to the patient\'s own number with their agreement, never in group chats, and do not keep copies on personal phones.',
      },
    ],
  },

  {
    slug: 'prescription-format-india',
    title: 'What a prescription in India should contain',
    searchTitle: 'Prescription Format in India: What Every Prescription Should Contain',
    description:
      'A checklist for a clear, complete prescription in India: doctor and registration details, patient details, generic drug names with strength, dose, frequency and duration, advice, follow-up and signature.',
    published: '2026-11-23',
    updated: '2026-11-23',
    sections: [
      {
        heading: 'Who reads a prescription',
        body: [
          'A prescription is read by a pharmacist who was not in the room, by a patient at home who may be unwell, and sometimes by another doctor months later. Each of them has to understand it without calling the clinic. That is the test for a good format.',
        ],
      },
      {
        heading: 'Doctor and clinic',
        body: [],
        list: [
          "The doctor's full name and qualifications.",
          'The registration number and the medical council that issued it.',
          "The clinic's name, address and phone number.",
          'The date.',
        ],
      },
      {
        heading: 'Patient',
        body: [],
        list: [
          'Name, age and sex.',
          "Weight for children, because doses depend on it.",
          'The clinic file number, so the record can be found again.',
          'Known allergies, printed where the pharmacist reads them before the medicines.',
        ],
      },
      {
        heading: 'Medicines',
        body: ['For each medicine:'],
        list: [
          'The generic name, written legibly. Capital letters help.',
          'Strength and form, for example 500 mg tablet or 5 ml syrup.',
          'Dose and frequency, in plain words beside any abbreviation: "twice a day" as well as BD.',
          'Duration in days.',
          'Route and timing where it matters, for example after food.',
        ],
      },
      {
        heading: 'Advice, tests and follow-up',
        body: [
          'Write the diagnosis or provisional diagnosis, any tests ordered, warning signs that should bring the patient back sooner, diet or activity advice, and the date of the next visit. A follow-up date on the prescription is the one the patient is most likely to remember.',
        ],
      },
      {
        heading: 'Signature',
        body: ["End with the doctor's signature. A printed name beside it helps the pharmacist read it."],
      },
      {
        heading: 'Generic names and the registration number: the rules',
        body: [
          'The Indian Medical Council (Professional Conduct, Etiquette and Ethics) Regulations, 2002 ask every doctor to display their registration number on prescriptions, certificates and receipts, and to prescribe drugs by their generic names; a 2016 amendment added that the names should be written legibly and preferably in capital letters. The National Medical Commission restated the generic-name requirement in 2023, and its 2023 conduct regulations were then put on hold after objections.',
          'Rules on prescribing change. Check the current position on the National Medical Commission website before you change your prescription template.',
        ],
      },
      {
        heading: 'Printing it well',
        body: [
          'A printed prescription removes the handwriting problem. A good template puts the clinic letterhead at the top, the patient details and allergies before the medicines, the medicines in a table with one row per drug, and the signature at the end. Nayaversse prints prescriptions this way on the clinic\'s own letterhead, with an allergy banner above the medicines and the doctor\'s signature image, and searches over two lakh Indian medicines as the doctor types.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is a registration number required on a prescription in India?',
        a: 'The Indian Medical Council regulations of 2002 ask every doctor to display their registration number on prescriptions, certificates and money receipts given to patients.',
      },
      {
        q: 'Do doctors in India have to prescribe generic names?',
        a: 'The 2002 regulations ask doctors to prescribe by generic name, and a 2016 amendment asked for legible names, preferably in capitals. The National Medical Commission restated this in 2023 and then put its 2023 regulations on hold. Check the current NMC position.',
      },
      {
        q: 'What do OD, BD, TDS and SOS mean on a prescription?',
        a: 'OD is once a day, BD twice a day, TDS three times a day, QID four times a day, SOS only when needed, and STAT immediately. Writing the plain words beside them helps patients.',
      },
      {
        q: 'Can a prescription be printed instead of handwritten?',
        a: "Yes. Printed prescriptions are common and easier to read. They still need the doctor's details, registration number and signature.",
      },
    ],
  },

  {
    slug: 'clinic-billing-upi-gst',
    title: 'Clinic billing in India: UPI, part payments and the daily closing',
    searchTitle: 'Clinic Billing in India: UPI, Part Payments, Daily Closing and GST',
    description:
      'How a small clinic can bill cleanly: one bill per visit, cash, UPI and card, part payments, a daily closing that adds up, and the GST basics for consultation fees and medicines.',
    published: '2026-11-23',
    updated: '2026-11-23',
    sections: [
      {
        heading: 'One bill per visit, built during the visit',
        body: [
          'Add charges as the visit happens: the consultation, any procedure, lab tests, medicines. When the patient reaches the counter the bill is already complete, and nothing depends on someone remembering what the doctor did.',
        ],
      },
      {
        heading: 'Record how each payment was made',
        body: [
          'Record every payment against the bill with its mode: cash, UPI or card. If a patient pays part now and part later, record both payments and show the balance. Never overwrite an earlier payment to make the numbers match.',
        ],
      },
      {
        heading: 'Close the day',
        body: ['At the end of each day:'],
        list: [
          'Total the day by payment mode: cash, UPI, card.',
          'Count the cash drawer against the cash total.',
          'Match the UPI total against your bank or UPI app statement.',
          'Explain any difference the same day, while people still remember.',
        ],
      },
      {
        heading: 'Keep a list of dues',
        body: [
          'Keep a list of bills with a balance still unpaid, with the patient\'s phone number. Look at it once a week. Money billed but not received is not income yet.',
        ],
      },
      {
        heading: 'What a receipt should show',
        body: [],
        list: [
          "The clinic's name and address, and the doctor's registration number.",
          'The date and a bill number.',
          'Each item and its amount.',
          'The amount paid, the payment mode and any balance due.',
        ],
      },
      {
        heading: 'GST: the basics',
        body: [
          'Health care services by a clinical establishment, an authorised medical practitioner or para-medics are exempt from GST under entry 74 of Notification 12/2017-Central Tax (Rate). Medicines and other goods sold separately, for example from a pharmacy counter, can be treated differently.',
          'Tax depends on how your clinic is set up. Ask your chartered accountant how this applies to you before you change your billing.',
        ],
      },
      {
        heading: 'Know what the clinic really earned',
        body: [
          'Record expenses as they happen (rent, salaries, supplies, electricity) under fixed categories, so they can be added up. Count revenue from payments received, not bills raised. The difference between the two is the real monthly result.',
        ],
      },
      {
        heading: 'How Nayaversse handles billing',
        body: [
          'Charges are added during the visit and payment is collected before the patient leaves. Every bill shows paid or pending, takes cash, UPI and card with part payments, and the day closes with totals by payment mode. An expense ledger and a monthly profit and loss show what the clinic really earned.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Do clinics charge GST on consultation fees?',
        a: 'Health care services by a clinical establishment or an authorised medical practitioner are exempt under entry 74 of Notification 12/2017-Central Tax (Rate). Medicines sold separately can be treated differently, so check with your chartered accountant.',
      },
      {
        q: 'How should a clinic reconcile UPI payments?',
        a: "At the daily closing, compare the day's UPI total in your billing software with the total in your bank or UPI app statement, and explain any difference the same day.",
      },
      {
        q: 'Should clinic revenue be counted when the bill is made?',
        a: 'No. Count revenue when payment is received. Unpaid bills are dues, and counting them as income makes the clinic look better off than it is.',
      },
    ],
  },
];

export const guideBySlug = (slug: string) => guides.find((g) => g.slug === slug);
