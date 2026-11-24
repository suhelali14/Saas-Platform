/**
 * What somebody asked the assistant for, worked out by rule.
 *
 * ── Why rules come first ─────────────────────────────────────────────
 *
 * Most of what is asked of an assistant in a clinic is one of a few dozen
 * things said a few hundred ways: open the queue, show her last
 * prescription, who is waiting, find Ramesh Joshi. A language model can
 * understand every one of them, takes two or three seconds to do it, and
 * charges for each. A pattern understands the common ones in a
 * millisecond for nothing.
 *
 * So a request is tried here first, in English, Hindi and Marathi, in
 * either script. Only what no rule recognises goes on to a model
 * (lib/assistant/model.ts) -- the unusual request, the one phrased in a
 * way nobody anticipated. The more of the everyday this file catches, the
 * less the assistant costs to run and the faster it feels.
 *
 * ── What it must not do ──────────────────────────────────────────────
 *
 * Guess. A rule either recognises a request or returns null. A request
 * half-understood by a rule and acted on is worse than one handed to a
 * model that reads all of it.
 *
 * Pure: text in, an intent out. No database, no network, tested against
 * real sentences.
 */

import { readVitals } from "../scribe/structure.js";

export interface Intent {
  /** The name of an action in the registry. */
  action: string;
  params: Record<string, unknown>;
}

/** Every screen a person can be taken to, and the words they call it by. */
export interface Screen {
  key: string;
  path: string;
  label: string;
  said: RegExp;
}

export const SCREENS: Screen[] = [
  { key: "queue", path: "/queue", label: "Queue", said: /\b(?:queue|waiting list|today'?s? list|opd list)\b|क्यू|रांग|कतार/i },
  { key: "overview", path: "/", label: "Overview", said: /\b(?:overview|dashboard|home)\b|डॅशबोर्ड|डैशबोर्ड/i },
  { key: "patients", path: "/patients", label: "All patients", said: /\b(?:all patients|patients? list|patient register)\b|सर्व पेशंट|सभी मरीज/i },
  { key: "requests", path: "/requests", label: "Booking requests", said: /\b(?:booking requests?|appointment requests?|online requests?)\b/i },
  { key: "reminders", path: "/reminders", label: "Follow-ups due", said: /\b(?:follow[- ]?ups?( due)?|reminders?|recall list)\b|फॉलो ?अप/i },
  { key: "labs", path: "/labs", label: "Lab orders", said: /\b(?:lab orders?|labs?|lab reports?|pathology)\b|लॅब|लैब/i },
  { key: "pharmacy", path: "/pharmacy", label: "Pharmacy", said: /\b(?:pharmacy|medicine stock|stock|dispens\w+)\b|फार्मसी|औषध साठा|दवा स्टॉक/i },
  { key: "billing", path: "/billing", label: "Billing", said: /\b(?:billing|bills?|invoices?)\b|बिल/i },
  { key: "expenses", path: "/expenses", label: "Expenses", said: /\b(?:expenses?|kharcha|spending)\b|खर्च/i },
  { key: "analytics", path: "/analytics", label: "Reports", said: /\b(?:reports?|analytics|statistics)\b|रिपोर्ट्स/i },
  { key: "counter", path: "/counter", label: "Cash counter", said: /\b(?:cash counter|counter|till)\b|काउंटर/i },
  { key: "claims", path: "/claims", label: "Claims", said: /\b(?:claims?|insurance desk|tpa)\b/i },
  { key: "ipd", path: "/ipd", label: "Bed board", said: /\b(?:bed board|beds?|ipd|inpatients?|admissions?|wards?)\b|बेड/i },
  { key: "nursing", path: "/nursing", label: "Nursing", said: /\b(?:nursing|ward chart)\b/i },
  { key: "ot", path: "/ot", label: "Operation theatre", said: /\b(?:operation theatre|theatre|ot list)\b/i },
  { key: "radiology", path: "/radiology", label: "Radiology", said: /\b(?:radiology|imaging|x-?rays? list|scans?)\b/i },
  { key: "departments", path: "/departments", label: "Departments", said: /\b(?:departments?)\b/i },
  { key: "website", path: "/website", label: "Website", said: /\b(?:website|site builder|web ?page)\b|वेबसाइट|वेबसाईट/i },
  { key: "staff", path: "/staff", label: "Staff", said: /\b(?:staff|logins?|users?)\b|स्टाफ/i },
  { key: "settings", path: "/settings", label: "Settings", said: /\b(?:settings?|letterhead|preferences)\b|सेटिंग/i },
  { key: "audit", path: "/audit", label: "Audit log", said: /\b(?:audit( log)?|access log)\b/i },
];

/** Words that mean "take me there", in three languages and two scripts. */
const GO = /\b(?:open|go to|goto|take me to|show me the|show the|switch to|kholo|khol|dikhao|dikha|ughda|dakhva|chalo)\b|खोलो|खोल|दिखाओ|दिखा|उघडा|उघड|दाखवा|दाखव/i;

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
  "जानेवारी": 0, "जनवरी": 0, "फेब्रुवारी": 1, "फरवरी": 1, "मार्च": 2, "एप्रिल": 3, "अप्रैल": 3, "मे": 4, "मई": 4, "जून": 5,
  "जुलै": 6, "जुलाई": 6, "ऑगस्ट": 7, "अगस्त": 7, "सप्टेंबर": 8, "सितंबर": 8, "ऑक्टोबर": 9, "अक्टूबर": 9, "नोव्हेंबर": 10, "नवंबर": 10, "डिसेंबर": 11, "दिसंबर": 11,
};

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * A day that was named: "12 October", "12/10", "yesterday", "परवा".
 *
 * A date with no year is the most recent one that is not in the future:
 * in March, "12 October" is last October. A doctor asking about a visit
 * is asking about one that happened.
 */
export function readDate(text: string, today: Date): string | null {
  const t = text.toLowerCase();
  const day = (offset: number) => { const d = new Date(today); d.setDate(d.getDate() + offset); return isoDate(d); };

  if (/\b(?:day before yesterday|parso|parson)\b|परसों|परवा/.test(t)) return day(-2);
  if (/\b(?:yesterday|kal)\b|कल|काल/.test(t)) return day(-1);
  if (/\b(?:today|aaj|aj)\b|आज/.test(t)) return day(0);
  const ago = /\b(\d{1,3})\s*(?:days?|din)\s*(?:ago|pehle|pahle|back)\b|(\d{1,3})\s*(?:दिन पहले|दिवसांपूर्वी|दिवसापूर्वी)/.exec(t);
  if (ago) return day(-Number(ago[1] ?? ago[2]));

  const settle = (d: number, m: number, y: number | null): string | null => {
    let year = y ?? today.getFullYear();
    if (year < 100) year += 2000;
    let date = new Date(year, m, d, 12);
    if (date.getMonth() !== m || date.getDate() !== d) return null;
    if (y === null && date.getTime() > today.getTime() + 86_400_000) date = new Date(year - 1, m, d, 12);
    return isoDate(date);
  };

  const numeric = /\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/.exec(t);
  if (numeric) return settle(Number(numeric[1]), Number(numeric[2]) - 1, numeric[3] ? Number(numeric[3]) : null);

  const monthNames = Object.keys(MONTHS).join("|");
  const dayFirst = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${monthNames})(?:[a-z]*)?(?:,?\\s*(\\d{4}))?`, "iu").exec(t);
  if (dayFirst) return settle(Number(dayFirst[1]), MONTHS[dayFirst[2]!.toLowerCase()]!, dayFirst[3] ? Number(dayFirst[3]) : null);
  const monthFirst = new RegExp(`(${monthNames})(?:[a-z]*)?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?`, "iu").exec(t);
  if (monthFirst) return settle(Number(monthFirst[2]), MONTHS[monthFirst[1]!.toLowerCase()]!, monthFirst[3] ? Number(monthFirst[3]) : null);

  return null;
}

/** "this patient", as opposed to somebody named. */
const THIS_PATIENT = /\b(?:this patient|the patient|him|her|his|their|them|iska|iski|inka|inki|isko|unka|unki|yancha|yanchi|hyancha|tyancha|tyanchi|tyache)\b|इसका|इसकी|इनका|इनकी|उनका|उनकी|यांचा|यांची|ह्यांचा|त्यांचा|त्यांची|याची|याचा/i;

/** Things asked about a patient, each against the action that answers it. */
const ABOUT_PATIENT: { said: RegExp; action: string }[] = [
  { said: /\b(?:last|previous|pichli|pichla|purani|magchi|maghchi|aadhichi)\b.{0,24}\b(?:prescription|medicines?|dawai|dava|aushadh|rx)\b|\b(?:what (?:is|was) (?:she|he|they) (?:on|taking))\b|पिछली दवा|पिछला प्रिस्क्रिप्शन|मागची औषध|मागील औषध|आधीची औषध/i, action: "last_prescription" },
  { said: /\b(?:lab|blood|test|report)s?\b.{0,16}\b(?:results?|reports?|came|aaya|aale)\b|\b(?:reports?|results?)\b.{0,10}\b(?:lab|test|blood)\b|\b(?:lab reports?|test results?|blood reports?)\b|रिपोर्ट|तपासणी निकाल|जांच रिपोर्ट/i, action: "lab_results" },
  { said: /\b(?:allerg\w+)\b|एलर्जी|ॲलर्जी|अलर्जी/i, action: "patient_brief" },
  { said: /\b(?:summary|brief|history|background|overview of (?:this|the) patient|tell me about)\b|इतिहास|हिस्ट्री|माहिती/i, action: "patient_brief" },
  { said: /\b(?:bp|blood pressure|weight|sugar|vitals?)\b.{0,16}\b(?:trend|history|over time|graph|last few|previous|pichle|magche)\b|\b(?:trend|history) of (?:bp|weight|vitals?)\b/i, action: "vitals_trend" },
  { said: /\b(?:pending|outstanding|due|baki|baaki|udhari)\b.{0,14}\b(?:bill|amount|payment|balance|paise|rakkam)\b|\b(?:how much (?:does|do) (?:she|he|they) owe)\b|\bbalance\b|बाकी|उधारी/i, action: "patient_dues" },
  { said: /\b(?:family|relatives?|husband|wife|mother|father|son|daughter|children)\b.{0,16}\b(?:records?|members?|linked|list|kaun|kon)\b|\bfamily\b|कुटुंब|परिवार/i, action: "family_members" },
  { said: /\b(?:past|previous|old|earlier|all|pichle|purane|magche|junya)\b.{0,12}\b(?:visits?|consultations?|bhet|bheti)\b|\bvisit history\b|\blast visit\b|पिछली विज़िट|मागील भेट|मागची भेट/i, action: "visit_history" },
];

/** Questions about the clinic's day, not about one patient. */
const ABOUT_CLINIC: { said: RegExp; action: string }[] = [
  { said: /\b(?:who(?:'s| is) (?:next|waiting)|how many (?:patients?|people) (?:are )?(?:waiting|left|today)|waiting (?:patients?|count)|kitne (?:patient|mareez|marij)|kiti (?:patient|peshant)|next patient)\b|कितने मरीज|किती पेशंट|पुढचा पेशंट|अगला मरीज/i, action: "queue_summary" },
  { said: /\b(?:what (?:needs|is) (?:my )?attention|what(?:'s| is) pending|anything pending|pending (?:work|things|kaam)|to[- ]?do)\b|काय बाकी|क्या बाकी|काय राहिलं/i, action: "needs_attention" },
  { said: /\b(?:follow[- ]?ups?|recalls?)\b.{0,14}\b(?:due|today|pending|overdue|list)\b|\bwho(?:'s| is) (?:due|overdue)\b/i, action: "followups_due" },
  { said: /\b(?:today'?s?|aaj(?:cha|che|ka|ki)?)\b.{0,12}\b(?:collection|earning|income|cash|kamai|jama)\b|\bhow much (?:did we|have we) (?:collect|earn)\w*\b|आजची जमा|आज की कमाई|आजचा गल्ला/i, action: "todays_collection" },
];

/** A phone number or a file number said as part of a search. */
const FILE_NUMBER = /\b[A-Z]{2,5}-?\d{3,6}\b/;
const PHONE = /(?:\d[\s-]?){8,12}/;

const FIND = /\b(?:find|search(?: for)?|look ?up|pull up|open|show|get|dhundo|dhoondo|shodha|shodh|kholo|dikhao|ughda|dakhva)\b|ढूंढो|खोजो|शोधा|खोलो|दिखाओ|उघडा|दाखवा/i;
const FILE_WORDS = /\b(?:patient|file|record|ka file|ki file|chi file|cha file|profile|case|mareez|marij|peshant)\b|पेशंट|मरीज|फाइल|फाईल/i;

/** What is left of a search once the words that are not a name are gone. */
function nameFrom(text: string): string {
  return text
    .replace(FIND, " ")
    .replace(/\b(?:patient|file|record|profile|case|named?|called|the|a|an|of|for|me|please|ka|ki|ke|ko|chi|cha|che|la|mr|mrs|ms|shri|smt)\b\.?/gi, " ")
    .replace(/पेशंट|मरीज|फाइल|फाईल|का|की|के|को|ची|चा|चे|ला|जी/g, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface RouteContext {
  today: Date;
  /** A patient is on screen, so "her last prescription" means theirs. */
  hasPatient: boolean;
  /** A visit is open, so vitals said aloud have somewhere to go. */
  hasVisit?: boolean;
}

/**
 * The intent a rule recognises, or null.
 *
 * The order matters and is deliberate: a question about the patient on
 * screen is tried before a search, because "show her lab reports" opens
 * with the same word a search does.
 */
export function route(input: string, context: RouteContext): Intent | null {
  const text = input.trim().replace(/\s+/g, " ");
  if (text.length < 2) return null;
  const date = readDate(text, context.today);

  // ── Vitals, said as numbers ────────────────────────────────────────
  // "BP 142 by 90, weight 77" is the same few shapes every time, and the
  // rules that read them for the listening assistant read them here.
  // Only a short remark that is nothing but vitals: a sentence with more
  // in it is saying something else as well, and goes to the model.
  if (context.hasVisit && text.split(" ").length <= 14 && !/\b(?:trend|history|last|previous|graph|show|what|kya|kiti|kitna)\b/i.test(text)) {
    const { vitals } = readVitals(text);
    const said = Object.keys(vitals).length;
    // The 2 in "SpO2" is a letter of its name, not a reading.
    const numbers = (text.replace(/sp ?o ?2/gi, "spo").match(/\d+(?:\.\d+)?/g) ?? []).length;
    // Every number in the remark was read as a vital: nothing is left over.
    const read = (vitals.bp ? 2 : 0) + (said - (vitals.bp ? 1 : 0));
    if (said > 0 && numbers === read) return { action: "record_vitals", params: { ...vitals } };
  }

  // A request to CHANGE something is never answered by a rule that reads.
  // "Add her husband to the family" contains "family", and showing the
  // family list in reply would be answering a different question.
  const changes = /\b(?:add|create|book|schedule|order|issue|write|record|note down|save|update|change|edit|remove|delete|cancel|link|register|admit|jodo|jod|banao|likho|likh|hatao|badlo|noand|nond|nondva)\b|जोड़ो|जोडा|बनाओ|लिखो|लिहा|हटाओ|काढा|बदलो|बदला|नोंदवा/i.test(text);

  // ── About the patient on screen ────────────────────────────────────
  if (context.hasPatient && !changes) {
    if (date && /\b(?:visit|consultation|came|aaya|aayi|aale|prescription|medicines?|note|case ?sheet|what happened)\b|भेट|आले|आया|आई/i.test(text)) {
      return { action: "visit_on_date", params: { date } };
    }
    for (const { said, action } of ABOUT_PATIENT) {
      if (said.test(text)) return { action, params: {} };
    }
  }

  // ── About the day ──────────────────────────────────────────────────
  if (!changes) {
    for (const { said, action } of ABOUT_CLINIC) {
      if (said.test(text)) return { action, params: {} };
    }
  }
  if (changes) return null;

  // ── Go to a screen ─────────────────────────────────────────────────
  // Only a short request: "open billing". A long sentence that happens
  // to contain "open" and "bill" is asking for something else.
  if (GO.test(text) && text.split(" ").length <= 6 && !FILE_WORDS.test(text) && !THIS_PATIENT.test(text)) {
    const screen = SCREENS.find((s) => s.said.test(text));
    if (screen) return { action: "open_screen", params: { screen: screen.key } };
  }

  // ── Find a patient ─────────────────────────────────────────────────
  const fileNumber = FILE_NUMBER.exec(text);
  if (fileNumber && text.split(" ").length <= 6) return { action: "find_patient", params: { query: fileNumber[0] } };
  const phone = PHONE.exec(text);
  if (phone && text.split(" ").length <= 8 && (FIND.test(text) || FILE_WORDS.test(text) || text.replace(/[\s-]/g, "").length <= 13)) {
    return { action: "find_patient", params: { query: phone[0].replace(/[\s-]/g, "") } };
  }
  if (FIND.test(text) && FILE_WORDS.test(text)) {
    const name = nameFrom(text);
    // One to four words that are not themselves a screen: a name.
    if (name.length >= 3 && name.split(" ").length <= 4 && !SCREENS.some((s) => s.said.test(name))) {
      return { action: "find_patient", params: { query: name } };
    }
  }

  return null;
}
