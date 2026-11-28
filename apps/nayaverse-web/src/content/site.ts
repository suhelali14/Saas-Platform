/**
 * The words the redesigned site adds (approved design, 26 November 2026).
 *
 * Everything the old site already said in three languages is still read from
 * en.ts / hi.ts / mr.ts and products.ts: the 23 businesses, the leak ledger,
 * the manifest, counter services, the four clinic classes, about, the
 * questions and the enquiry labels. This file holds only what is new: the
 * company-first home page, Growth as the marketing firm replaced (D43-D45 in
 * the Growth repository), and the monthly "from" prices the founder gave on
 * 26 November 2026. Prices are never written anywhere else.
 */
import type { Locale } from './index';

/** The founder's starting prices, per month, rupees (26 November 2026).
 *  Since 28 November the console sets the prices (content/pricing.ts);
 *  these are what the site shows until the console has answered, and for a
 *  clinic class whose plan the console has not put on sale. */
export const prices = {
  clinicClasses: [3000, 5000, 10000, 25000] as const,
  growthFrom: 10000,
  /** The fare chart's rows A-C, as the site has shown them. */
  fares: [3000, 12000, 50000] as const,
};

export interface SiteCopy {
  nav: { clinic: string; growth: string; vision: string; pricing: string; book: string; whatsapp: string };
  hero: { before: string; accent: string; after: string; lede: string; book: string; films: string; clinicLine: string; growthLine: string; stageHint: string; ledeShort: string };
  phone: { enlarge: string; drag: string; close: string };
  facts: { title: string; text: string }[];
  products: { heading: string; lede: string; growthPoints: string[]; growthLine: string; growthFor: string };
  money: { from: string; perMonth: string; custom: string; perYear: string; off: string };
  different: { heading: string; lede: string; items: { title: string; text: string; alt: string }[] };
  assistant: { pill: string; heading: string; lede: string; pick: string };
  growthHow: { heading: string; lede: string; steps: { title: string; text: string }[]; caption: string; more: string };
  films: { heading: string; lede: string; clinic: string; clinicNote: string; growth: string; growthNote: string };
  about: { heading: string; growthParagraph: string; checks: string; call: string; whatsapp: string };
  visionTeaser: { heading: string; lede: string; link: string };
  questions: { cost: { q: string; a: string }; whatsapp: string };
  enquiry: { heading: string; lede: string; about: string; options: [string, string, string, string]; call: string };
  footer: { products: string; company: string; contact: string; about: string; questions: string };
  clinic: { more: string; classesHeading: string; classesLede: string; pricingLink: string };
  growth: {
    before: string;
    accent: string;
    after: string;
    lede: string;
    pilot: string;
    standsTitle: string;
    standsText: string;
    statementCaption: string;
    firmHeading: string;
    firmLede: string;
    colFirm: string;
    colUs: string;
    firm: [string, string, string][];
    waysHeading: string;
    waysLede: string;
    ways: { kicker: string; title: string; text: string; points: string[] }[];
    waysRule: string;
    shownHeading: string;
    shownLede: string;
    shown: { q: string; a: string }[];
    proofHeading: string;
    proof: string[];
    repliesHeading: string;
    repliesLede: string;
    replies: string[];
    repliesCaption: string;
    whyHeading: string;
    whyLede: string;
    why: { t: string; d: string }[];
    priceNote: string;
    seePricing: string;
    standingHeading: string;
    standing: { t: string; d: string }[];
    pilotHeading: string;
    pilotLede: string;
  };
  pricing: {
    title: string;
    lede: string;
    clinicHeading: string;
    clinicLede: string;
    customFor: string;
    growthHeading: string;
    growthLede: string;
    growthPoints: string[];
    growthPlans: string;
    growthModules: string;
    howHeading: string;
    how: { t: string; d: string }[];
    platformHeading: string;
    platformLede: string;
    platformLink: string;
  };
}

const en: SiteCopy = {
  nav: { clinic: 'Clinic', growth: 'Growth', vision: 'Vision', pricing: 'Pricing', book: 'Book a walkthrough', whatsapp: 'Message on WhatsApp' },
  hero: {
    before: 'We build the software a business ',
    accent: 'runs its day on',
    after: '.',
    lede: 'Nayaversse is a software company from Sangli with two products. Clinic runs a doctor’s clinic from the first token to the day’s close. Growth does a marketing firm’s work for any business, with every rupee shown. Shops, salons, gyms and food come next.',
    book: 'Book a walkthrough',
    films: 'Watch the films',
    clinicLine: 'The whole day of a clinic. The queue sorts itself.',
    growthLine: 'Your marketing, without the marketing firm.',
    stageHint: 'Press a screen at the back to bring it forward.',
    ledeShort: 'A software company from Sangli with two products: Clinic, live at a paying clinic, and Growth, which does a marketing firm’s work.',
  },
  phone: { enlarge: 'Tap to enlarge', drag: 'Drag to look around', close: 'Close' },
  facts: [
    { title: 'Two products', text: 'Clinic and Growth, each with its true status on it' },
    { title: 'One live business', text: 'A clinic in Sangli, paying, in production since October 2026' },
    { title: 'One founder', text: 'Who writes it, sells it and answers the phone' },
    { title: 'No outside money', text: 'No investor decides what gets built' },
  ],
  products: {
    heading: 'One company, two products.',
    lede: 'Each says plainly where it stands. Live means a business pays for it and uses it every day.',
    growthFor: 'For any business that would otherwise hire a marketing firm.',
    growthLine: 'Makes the videos, runs the ads, brings back the customers who stopped coming and answers enquiries. You run it, or we run it for you.',
    growthPoints: [
      'Videos and ads made from your own photos, prices and offers',
      'Nothing is sent or spent until the owner approves it',
      'Ad money goes from you straight to Meta, capped at what you approved',
      'One screen shows what went out and what came back, in rupees',
    ],
  },
  money: { from: 'From', perMonth: 'a month', custom: 'Custom', perYear: 'a year', off: 'off' },
  different: {
    heading: 'Nayaversse Clinic: where it is different.',
    lede: 'Any clinic software can print a prescription. These are the parts the doctors we built it with did not find anywhere else.',
    items: [
      { title: 'The queue sorts itself', text: 'An emergency, a pregnant patient, a senior or a child goes ahead by a declared rule, on a screen everyone can read. Reception stops arguing.', alt: 'The clinic queue with an emergency placed first' },
      { title: 'It listens to the visit', text: 'In the consulting room it drafts the note, the medicines, the tests and the follow-up from the conversation. The doctor checks and confirms. In trial.', alt: 'The assistant listening to a visit and drafting the note' },
      { title: 'One sheet for the whole visit', text: 'Complaint, findings, diagnosis, medicines and tests on one sheet, written by hand or by voice, saved with one Confirm.', alt: 'One visit sheet with diagnosis, medicines and tests' },
      { title: 'Patients find you', text: 'The clinic’s own website in up to twelve Indian languages, with the live queue on it, so people stop asking the desk every five minutes.', alt: 'The clinic’s website in Marathi' },
    ],
  },
  assistant: {
    pill: 'Part of Clinic',
    heading: 'Say it. It waits for a yes.',
    lede: 'An assistant inside the clinic software. Say what you need, in English, Hindi or Marathi, or type it. It shows what it understood and saves nothing until someone confirms.',
    pick: 'Choose a film',
  },
  growthHow: {
    heading: 'Your marketing, without the marketing firm.',
    lede: 'Nayaversse Growth does the five jobs a firm does for a local business, in one place the owner can see into.',
    steps: [
      { title: 'It makes the work', text: 'Videos, posts, ads and offers, from your own photos and prices, in your language.' },
      { title: 'You run it, or we do', text: 'Use the tools yourself, or have a person at Nayaversse do the month’s work inside your account.' },
      { title: 'The owner approves', text: 'Anyone can draft. No message is sent and no ad money is spent until the owner says yes.' },
      { title: 'Rupees, not likes', text: 'What went out and what came back, traced by phone number. A few people are held back, so you see who would have come anyway.' },
    ],
    caption: 'The owner’s Home in Growth, on a demo salon. Every figure on it is made up; no business has used Growth yet.',
    more: 'All about Growth',
  },
  films: {
    heading: 'Both products, on film.',
    lede: 'Recorded from the products themselves. Every patient and customer in them is made up.',
    clinic: 'Nayaversse Clinic',
    clinicNote: 'The morning rush on paper, then the same morning on the real screens.',
    growth: 'Nayaversse Growth',
    growthNote: 'A demo salon brings back the customers who stopped coming. Narrated in English.',
  },
  about: {
    heading: 'About Nayaversse: who you would be dealing with.',
    growthParagraph: 'Growth came from the next question every owner asked: how do I get my customers back, without paying a firm for reports of likes?',
    checks: 'What you can check',
    call: 'Call',
    whatsapp: 'WhatsApp',
  },
  visionTeaser: {
    heading: 'What comes after.',
    lede: 'Twenty-three kinds of business on the same records as the clinic, each with its true status. One is in production.',
    link: 'Read the Vision',
  },
  questions: {
    cost: { q: 'What does it cost?', a: 'Clinic starts at {clinic} a month and Growth at {growth} a month. The exact price is quoted after the walkthrough, against the size of what you run, and written into the agreement.' },
    whatsapp: 'Clinic does not: its reminders are inside the app. Growth is the product that writes to customers on WhatsApp, Instagram and Messenger, only to people who agreed and only with words the owner approved. Growth has not yet run against live Meta accounts.',
  },
  enquiry: { heading: 'Twenty minutes, your screen and mine.', lede: 'On what you actually do at the desk every day. No slide deck. If it does not fit how you work, I will say so.', about: 'What you are asking about', options: ['Nayaversse Clinic', 'Nayaversse Growth', 'Both', 'Something on the Vision page'], call: 'Or call' },
  footer: { products: 'Products', company: 'Company', contact: 'Contact', about: 'About', questions: 'Questions' },
  clinic: {
    more: 'All about Clinic',
    classesHeading: 'From one doctor to a hospital.',
    classesLede: 'Four classes, each switching on more of the same system. Moving up is a setting changed, with the same records: nothing typed again, nothing lost.',
    pricingLink: 'What each class includes, and how it is paid for',
  },
  growth: {
    before: 'Your marketing, without the ',
    accent: 'marketing firm',
    after: '.',
    lede: 'Growth makes the videos, runs the ads, brings back the customers who stopped coming and answers enquiries. Run it yourself, or have us run it for you. Either way you see what was spent and what came back, in rupees.',
    pilot: 'Ask about a pilot',
    standsTitle: 'Finished, and unproven',
    standsText: 'It works end to end on our own machines. No business has used it, so nothing on this page is a result. The first businesses will be pilots.',
    statementCaption: 'The owner’s statement in Growth, on a demo salon. Every figure is made up.',
    firmHeading: 'Everything a marketing firm does, in one place you can see into.',
    firmLede: 'A firm does five jobs for a local business. Growth does the same five. The difference is the last row: what you are shown, and what you keep.',
    colFirm: 'With a marketing firm, usually',
    colUs: 'With Nayaversse Growth',
    firm: [
      ['Videos and posts', 'Made by someone you never meet. You see them once they are up.', 'Made from your own photos, prices and offers, in English, Hindi or Marathi. Nothing becomes a file until you have watched it.'],
      ['Ads', 'Often run from the firm’s account, with the ad money passing through them.', 'Run from your own Meta ad account, capped at the exact sum you approved. The money goes from you to Meta, never through us.'],
      ['Customers who stopped coming', 'Usually nobody’s job.', 'An offer on WhatsApp to the ones who agreed to messages, with a few held back so you can see what the message did.'],
      ['Enquiries', 'Answered when someone gets to them.', 'The questions people ask every day answered at any hour on WhatsApp, Instagram and Messenger, in words you approved.'],
      ['The report', 'Likes, reach and impressions, once a month.', 'Rupees, every week: what went out, what came back, and what could not be traced.'],
      ['If you leave', 'The page, the account and the history can stay behind with the firm.', 'The ad account, the customer list and the videos were yours from the first day.'],
    ],
    waysHeading: 'Two ways to run it. The same screen either way.',
    waysLede: 'Some owners want the tools. Some want it done. You choose, and you can change your mind in the middle of a month without losing anything.',
    ways: [
      { kicker: 'You run it', title: 'The tools, in your hands.', text: 'You or your staff make the videos, write the offers and start the ads. Growth drafts each one; you correct it and approve it.', points: ['A video studio that works from your own photos and prices', 'Ads you start in a few minutes, with the most they can spend shown first', 'Offers, automatic messages and replies on WhatsApp', 'Staff can draft. Only the owner can send or spend'] },
      { kicker: 'We run it for you', title: 'A person at Nayaversse does the work.', text: 'The month’s videos and posts are made for you, the ads set up, the offers drafted. All of it inside your own account, where you can watch.', points: ['Every piece of work is listed with who did it and when', 'You approve from your phone. Nothing is sent or spent without your yes', 'Your ad account, your page and your customer list stay yours', 'Take it back yourself whenever you like'] },
    ],
    waysRule: 'One rule holds in both: the software and our people may draft anything, but a message to your customers and a rupee of your ad money each need your approval, with the exact words and the exact sum in front of you.',
    shownHeading: 'What you are shown.',
    shownLede: 'Not a dashboard of likes. Three things an owner asks, answered on one screen.',
    shown: [
      { q: 'Where did my money go?', a: 'Ad money, message charges and our fee, each on its own line. Ad money and message charges are paid by you straight to Meta, so the figure can be checked against Meta’s own bill.' },
      { q: 'What did it bring back?', a: 'A booking counts only when the same phone number got a message, or opened a chat from an ad, and then booked. Everything else is listed as could not trace.' },
      { q: 'What was done for me?', a: 'Every video, ad and offer made this month, against what your plan includes, with what is waiting for your approval at the top.' },
    ],
    proofHeading: 'Some people are deliberately not messaged.',
    proof: [
      'Every offer to twenty or more people holds back a few at random. You then see, side by side, how many of the messaged came back and how many of the held-back came back anyway.',
      'That difference is what the message did. A small group is called a first sign, not proof.',
    ],
    repliesHeading: 'Enquiries answered at any hour, in your words.',
    repliesLede: 'Approve the answers to the questions people ask every day: price, timings, where you are. A message one answer clearly fits gets it on WhatsApp, Instagram or Messenger.',
    replies: ['Nothing is written freely: every word sent is a word you approved', 'Anything unclear, a complaint or a question about money waits for a person', 'At most three automatic replies a day to one person, and none once your staff have answered'],
    repliesCaption: 'An Instagram message on a demo salon, answered with the approved price, then a holding reply.',
    whyHeading: 'Why put your marketing money here.',
    whyLede: 'We cannot show you results from other businesses, because there are none yet. What we can show is how the money and the control are arranged, which you can check before you pay anything.',
    why: [
      { t: 'You own all of it', d: 'The ad account, the page, the customer list and the finished videos are in your name. We work as a guest in your accounts, and you can remove us in one tap.' },
      { t: 'The ad money never passes through us', d: 'You approve an exact sum. It is set as the spending limit at Meta, so a mistake on our side cannot spend more.' },
      { t: 'You see the return, or that there was none', d: 'If a month brought nothing back, the same screen says so. It is counted from your bookings, not written by the people whose fee depends on it.' },
      { t: 'It will not cost you your name', d: 'No guarantees, no “best in town”, no message to someone who asked you to stop. The rules that keep a number off the spam list are built in.' },
      { t: 'Your customers’ details stay private', d: 'Names, numbers and messages are kept encrypted. You can download everything held about one customer, or erase it for good.' },
      { t: 'It starts with people who know you', d: 'Before paying to reach strangers, Growth works the list you already have. That is where the first rupee usually comes back fastest.' },
    ],
    priceNote: 'Larger businesses are quoted individually. The first businesses join as pilots, and the price is agreed with each one.',
    seePricing: 'See pricing',
    standingHeading: 'Where it stands, plainly.',
    standing: [
      { t: 'Built and working on our machines', d: 'The video studio, ads from your own account, offers and automatic messages, automatic replies, the held-back comparison, the weekly report, export and erase.' },
      { t: 'Not yet run with live accounts', d: 'Ads against a real Meta ad account, sending through the WhatsApp Business service, Instagram and Messenger replies, and taking payments. Each has only run in test mode.' },
      { t: 'No business has used it', d: 'So there is no result to quote and no owner to call. The first businesses are pilots, and we sit with each one through its first month.' },
    ],
    pilotHeading: 'Be one of the first to run it.',
    pilotLede: 'A pilot, on terms we agree together. Run it yourself or have us run it. Either way we sit with you through the first month and read the result with you.',
  },
  pricing: {
    title: 'What it costs.',
    lede: 'Monthly, from a starting price, by the size of what you run. The exact figure is quoted after the walkthrough and written into the agreement. Your records export in full from the first day.',
    clinicHeading: 'Nayaversse Clinic',
    clinicLede: 'Four classes of the same system. A clinic moving up changes a setting, not its records.',
    customFor: 'Several branches, or a need none of the classes fits.',
    growthHeading: 'Nayaversse Growth',
    growthLede: 'A marketing firm’s work, run by you or by us, with every rupee shown.',
    growthPlans: 'Plans',
    growthModules: 'Or one part on its own',
    growthPoints: ['Videos and posts made each month', 'Ads from your own Meta account, around your area or across India', 'Offers and automatic replies on WhatsApp, Instagram and Messenger', 'A statement of what went out and what came back'],
    howHeading: 'How paying works',
    how: [
      { t: 'Monthly', d: 'Billed each month. The starting prices here are where each class begins; yours is quoted for what you run.' },
      { t: 'Ad money is separate', d: 'For Growth, ad money goes from your own account to Meta. It is never paid to us.' },
      { t: 'Seeing it first', d: 'The walkthrough runs on a demo with made-up records, so nothing real is ever on screen.' },
      { t: 'Leaving', d: 'Your records export in full, from the first day, without asking us.' },
    ],
    platformHeading: 'Shops, salons, gyms and food',
    platformLede: 'Not built yet. What we expect to charge, and how far each trade has got, is on the Vision page.',
    platformLink: 'Read the Vision',
  },
};

const hi: SiteCopy = {
  nav: { clinic: 'क्लिनिक', growth: 'ग्रोथ', vision: 'आगे की योजना', pricing: 'कीमत', book: 'डेमो बुक करें', whatsapp: 'WhatsApp पर लिखें' },
  hero: {
    before: 'हम वह सॉफ़्टवेयर बनाते हैं जिस पर ',
    accent: 'किसी व्यवसाय का पूरा दिन चलता है',
    after: '।',
    lede: 'Nayaversse सांगली की एक सॉफ़्टवेयर कंपनी है, जिसके दो प्रोडक्ट हैं। क्लिनिक, डॉक्टर के क्लिनिक को पहले टोकन से दिन के हिसाब तक चलाता है। ग्रोथ किसी भी व्यवसाय के लिए मार्केटिंग फ़र्म का काम करता है, हर रुपये का हिसाब दिखाकर। दुकानें, सैलून, जिम और खाने के व्यवसाय इसके बाद आएँगे।',
    book: 'डेमो बुक करें',
    films: 'फ़िल्में देखें',
    clinicLine: 'क्लिनिक का पूरा दिन। कतार अपने आप सही क्रम में लगती है।',
    growthLine: 'आपकी मार्केटिंग, बिना मार्केटिंग फ़र्म के।',
    stageHint: 'पीछे की किसी स्क्रीन को दबाएँ, वह आगे आ जाएगी।',
    ledeShort: 'सांगली की एक सॉफ़्टवेयर कंपनी, दो प्रोडक्ट के साथ: क्लिनिक, जो एक क्लिनिक में पैसे देकर रोज़ चल रहा है, और ग्रोथ, जो मार्केटिंग फ़र्म का काम करता है।',
  },
  phone: { enlarge: 'बड़ा देखने के लिए टैप करें', drag: 'इधर-उधर देखने के लिए खींचें', close: 'बंद करें' },
  facts: [
    { title: 'दो प्रोडक्ट', text: 'क्लिनिक और ग्रोथ, हर एक पर उसकी सच्ची स्थिति लिखी है' },
    { title: 'एक चालू व्यवसाय', text: 'सांगली का एक क्लिनिक, पैसे देकर, अक्टूबर 2026 से रोज़ इस्तेमाल में' },
    { title: 'एक संस्थापक', text: 'जो इसे बनाता है, बेचता है और फ़ोन भी उठाता है' },
    { title: 'बाहर का पैसा नहीं', text: 'क्या बनेगा, यह कोई निवेशक तय नहीं करता' },
  ],
  products: {
    heading: 'एक कंपनी, दो प्रोडक्ट।',
    lede: 'हर प्रोडक्ट साफ़ बताता है कि वह कहाँ तक पहुँचा है। चालू का मतलब है कि कोई व्यवसाय इसके पैसे देता है और रोज़ इसे इस्तेमाल करता है।',
    growthFor: 'हर उस व्यवसाय के लिए जो वरना मार्केटिंग फ़र्म रखता।',
    growthLine: 'वीडियो बनाता है, विज्ञापन चलाता है, जो ग्राहक आना बंद कर चुके उन्हें वापस बुलाता है और पूछताछ का जवाब देता है। आप चलाएँ, या हम आपके लिए चलाएँ।',
    growthPoints: [
      'आपकी अपनी फ़ोटो, दाम और ऑफ़र से बने वीडियो और विज्ञापन',
      'मालिक की मंज़ूरी के बिना न कोई मैसेज जाता है, न पैसा खर्च होता है',
      'विज्ञापन का पैसा सीधे आपसे Meta को जाता है, मंज़ूर रकम की सीमा में',
      'एक ही स्क्रीन पर रुपयों में: कितना गया और कितना लौटा',
    ],
  },
  money: { from: 'शुरुआत', perMonth: 'प्रति माह', custom: 'आपकी ज़रूरत के हिसाब से', perYear: 'प्रति वर्ष', off: 'छूट' },
  different: {
    heading: 'Nayaversse क्लिनिक: यह कहाँ अलग है।',
    lede: 'पर्चा तो हर क्लिनिक सॉफ़्टवेयर छाप देता है। ये वे हिस्से हैं जो जिन डॉक्टरों के साथ हमने इसे बनाया, उन्हें और कहीं नहीं मिले।',
    items: [
      { title: 'कतार अपने आप लगती है', text: 'इमरजेंसी, गर्भवती मरीज़, बुज़ुर्ग या बच्चा तय नियम से आगे जाते हैं, ऐसी स्क्रीन पर जो सब पढ़ सकते हैं। रिसेप्शन पर बहस बंद।', alt: 'क्लिनिक की कतार, जिसमें इमरजेंसी सबसे आगे है' },
      { title: 'यह परामर्श सुनता है', text: 'परामर्श कक्ष में बातचीत से नोट, दवाइयाँ, जाँच और फ़ॉलो-अप का मसौदा बनाता है। डॉक्टर जाँचकर पक्का करते हैं। परीक्षण में।', alt: 'सहायक परामर्श सुनकर नोट का मसौदा बना रहा है' },
      { title: 'पूरी विज़िट एक शीट पर', text: 'शिकायत, जाँच में मिला, निदान, दवाइयाँ और टेस्ट एक शीट पर, हाथ से या बोलकर लिखे, एक पुष्टि से सेव।', alt: 'निदान, दवाइयों और जाँच के साथ एक विज़िट शीट' },
      { title: 'मरीज़ आपको ढूँढ लेते हैं', text: 'क्लिनिक की अपनी वेबसाइट, बारह भारतीय भाषाओं तक में, उस पर लाइव कतार के साथ, ताकि लोग हर पाँच मिनट में डेस्क से न पूछें।', alt: 'मराठी में क्लिनिक की वेबसाइट' },
    ],
  },
  assistant: {
    pill: 'क्लिनिक का हिस्सा',
    heading: 'बोलिए। यह हाँ का इंतज़ार करता है।',
    lede: 'क्लिनिक सॉफ़्टवेयर के अंदर एक सहायक। जो चाहिए वह अंग्रेज़ी, हिंदी या मराठी में बोलें, या लिखें। यह दिखाता है कि उसने क्या समझा, और किसी के पुष्टि करने तक कुछ सेव नहीं करता।',
    pick: 'फ़िल्म चुनें',
  },
  growthHow: {
    heading: 'आपकी मार्केटिंग, बिना मार्केटिंग फ़र्म के।',
    lede: 'Nayaversse ग्रोथ वे पाँचों काम करता है जो एक फ़र्म किसी स्थानीय व्यवसाय के लिए करती है, एक ही जगह, जहाँ मालिक सब देख सकता है।',
    steps: [
      { title: 'यह काम बनाता है', text: 'वीडियो, पोस्ट, विज्ञापन और ऑफ़र, आपकी अपनी फ़ोटो और दामों से, आपकी भाषा में।' },
      { title: 'आप चलाएँ, या हम', text: 'टूल ख़ुद इस्तेमाल करें, या Nayaversse का कोई व्यक्ति आपके अकाउंट के अंदर महीने भर का काम करे।' },
      { title: 'मालिक मंज़ूरी देते हैं', text: 'मसौदा कोई भी बना सकता है। मालिक की हाँ के बिना न कोई मैसेज जाता है, न विज्ञापन का पैसा खर्च होता है।' },
      { title: 'लाइक नहीं, रुपये', text: 'कितना गया और कितना लौटा, फ़ोन नंबर से जोड़कर। कुछ लोगों को जानबूझकर छोड़ा जाता है, ताकि दिखे कि कौन वैसे भी आता।' },
    ],
    caption: 'डेमो सैलून पर ग्रोथ में मालिक का होम। इस पर हर आँकड़ा काल्पनिक है; किसी व्यवसाय ने अभी ग्रोथ इस्तेमाल नहीं किया है।',
    more: 'ग्रोथ के बारे में सब कुछ',
  },
  films: {
    heading: 'दोनों प्रोडक्ट, फ़िल्म पर।',
    lede: 'प्रोडक्ट से ही रिकॉर्ड की गई। इनमें हर मरीज़ और ग्राहक काल्पनिक है।',
    clinic: 'Nayaversse क्लिनिक',
    clinicNote: 'काग़ज़ पर सुबह की भीड़, फिर वही सुबह असली स्क्रीन पर।',
    growth: 'Nayaversse ग्रोथ',
    growthNote: 'एक डेमो सैलून उन ग्राहकों को वापस बुलाता है जो आना बंद कर चुके थे। अंग्रेज़ी में।',
  },
  about: {
    heading: 'Nayaversse के बारे में: आप किससे बात करेंगे।',
    growthParagraph: 'ग्रोथ उस अगले सवाल से निकला जो हर मालिक पूछता था: लाइक की रिपोर्ट के लिए किसी फ़र्म को पैसे दिए बिना, मैं अपने ग्राहक वापस कैसे लाऊँ?',
    checks: 'आप क्या जाँच सकते हैं',
    call: 'कॉल करें',
    whatsapp: 'WhatsApp',
  },
  visionTeaser: {
    heading: 'इसके बाद क्या आएगा।',
    lede: 'तेईस तरह के व्यवसाय, क्लिनिक वाले ही रिकॉर्ड पर, हर एक की सच्ची स्थिति के साथ। एक इस्तेमाल में है।',
    link: 'आगे की योजना पढ़ें',
  },
  questions: {
    cost: { q: 'इसकी कीमत क्या है?', a: 'क्लिनिक {clinic} प्रति माह से और ग्रोथ {growth} प्रति माह से शुरू होता है। सही कीमत डेमो के बाद, आपके काम के आकार के हिसाब से बताई जाती है और अनुबंध में लिखी जाती है।' },
    whatsapp: 'क्लिनिक नहीं: उसके रिमाइंडर ऐप के अंदर हैं। ग्रोथ वह प्रोडक्ट है जो WhatsApp, Instagram और Messenger पर ग्राहकों को लिखता है, सिर्फ़ उन्हें जिन्होंने हाँ कहा, और सिर्फ़ मालिक के मंज़ूर किए शब्दों में। ग्रोथ अभी असली Meta अकाउंट पर नहीं चला है।',
  },
  enquiry: { heading: 'बीस मिनट, आपकी स्क्रीन और मेरी।', lede: 'उस काम पर जो आप रोज़ डेस्क पर करते हैं। कोई स्लाइड नहीं। अगर यह आपके काम के तरीके में नहीं बैठता, तो मैं साफ़ कह दूँगा।', about: 'आप किसके बारे में पूछ रहे हैं', options: ['Nayaversse क्लिनिक', 'Nayaversse ग्रोथ', 'दोनों', 'आगे की योजना में से कुछ'], call: 'या कॉल करें' },
  footer: { products: 'प्रोडक्ट', company: 'कंपनी', contact: 'संपर्क', about: 'हमारे बारे में', questions: 'सवाल' },
  clinic: {
    more: 'क्लिनिक के बारे में सब कुछ',
    classesHeading: 'एक डॉक्टर से अस्पताल तक।',
    classesLede: 'चार श्रेणियाँ, हर एक उसी सिस्टम का और हिस्सा चालू करती है। आगे बढ़ना बस एक सेटिंग बदलना है, रिकॉर्ड वही रहते हैं: कुछ दोबारा नहीं लिखना, कुछ नहीं खोता।',
    pricingLink: 'हर श्रेणी में क्या है, और भुगतान कैसे होता है',
  },
  growth: {
    before: 'आपकी मार्केटिंग, बिना ',
    accent: 'मार्केटिंग फ़र्म',
    after: ' के।',
    lede: 'ग्रोथ वीडियो बनाता है, विज्ञापन चलाता है, आना बंद कर चुके ग्राहकों को वापस बुलाता है और पूछताछ का जवाब देता है। ख़ुद चलाएँ, या हमसे चलवाएँ। दोनों तरह आप रुपयों में देखते हैं कि क्या खर्च हुआ और क्या लौटा।',
    pilot: 'पायलट के बारे में पूछें',
    standsTitle: 'तैयार, पर अभी साबित नहीं',
    standsText: 'यह हमारी अपनी मशीनों पर शुरू से अंत तक चलता है। किसी व्यवसाय ने इसे इस्तेमाल नहीं किया है, इसलिए इस पेज पर कुछ भी नतीजा नहीं है। पहले व्यवसाय पायलट होंगे।',
    statementCaption: 'डेमो सैलून पर ग्रोथ में मालिक का हिसाब। हर आँकड़ा काल्पनिक है।',
    firmHeading: 'मार्केटिंग फ़र्म जो कुछ करती है, वह सब एक जगह जहाँ आप सब देख सकें।',
    firmLede: 'एक फ़र्म किसी स्थानीय व्यवसाय के लिए पाँच काम करती है। ग्रोथ भी वही पाँच करता है। फ़र्क आख़िरी पंक्ति में है: आपको क्या दिखाया जाता है, और आपके पास क्या रहता है।',
    colFirm: 'मार्केटिंग फ़र्म के साथ, आमतौर पर',
    colUs: 'Nayaversse ग्रोथ के साथ',
    firm: [
      ['वीडियो और पोस्ट', 'कोई ऐसा बनाता है जिससे आप कभी नहीं मिलते। पोस्ट होने के बाद दिखते हैं।', 'आपकी अपनी फ़ोटो, दाम और ऑफ़र से, अंग्रेज़ी, हिंदी या मराठी में। आपके देखे बिना कोई फ़ाइल नहीं बनती।'],
      ['विज्ञापन', 'अक्सर फ़र्म के अकाउंट से, विज्ञापन का पैसा उनके हाथ से होकर।', 'आपके अपने Meta विज्ञापन अकाउंट से, आपकी मंज़ूर की हुई सटीक रकम की सीमा में। पैसा आपसे Meta को जाता है, हमारे ज़रिए कभी नहीं।'],
      ['जो ग्राहक आना बंद कर चुके', 'आमतौर पर किसी का काम नहीं।', 'जिन्होंने मैसेज के लिए हाँ कहा, उन्हें WhatsApp पर ऑफ़र, कुछ लोगों को छोड़कर, ताकि दिखे कि मैसेज ने क्या किया।'],
      ['पूछताछ', 'जब किसी को समय मिले, तब जवाब।', 'रोज़ पूछे जाने वाले सवालों के जवाब किसी भी समय WhatsApp, Instagram और Messenger पर, आपके मंज़ूर किए शब्दों में।'],
      ['रिपोर्ट', 'लाइक, रीच और इंप्रेशन, महीने में एक बार।', 'हर हफ़्ते रुपयों में: क्या गया, क्या लौटा, और क्या जोड़ा नहीं जा सका।'],
      ['अगर आप छोड़ दें', 'पेज, अकाउंट और इतिहास फ़र्म के पास रह सकते हैं।', 'विज्ञापन अकाउंट, ग्राहकों की सूची और वीडियो पहले दिन से आपके थे।'],
    ],
    waysHeading: 'चलाने के दो तरीके। स्क्रीन दोनों में वही।',
    waysLede: 'कुछ मालिक टूल चाहते हैं। कुछ चाहते हैं कि काम हो जाए। आप चुनें, और महीने के बीच में भी बिना कुछ खोए मन बदल सकते हैं।',
    ways: [
      { kicker: 'आप चलाएँ', title: 'टूल, आपके हाथ में।', text: 'आप या आपका स्टाफ़ वीडियो बनाता है, ऑफ़र लिखता है और विज्ञापन शुरू करता है। ग्रोथ हर एक का मसौदा बनाता है; आप सुधारकर मंज़ूरी देते हैं।', points: ['आपकी अपनी फ़ोटो और दामों से काम करने वाला वीडियो स्टूडियो', 'कुछ मिनट में शुरू होने वाले विज्ञापन, सबसे ज़्यादा खर्च पहले दिखाकर', 'WhatsApp पर ऑफ़र, अपने आप जाने वाले मैसेज और जवाब', 'स्टाफ़ मसौदा बना सकता है। भेजना या खर्च करना सिर्फ़ मालिक कर सकता है'] },
      { kicker: 'हम आपके लिए चलाएँ', title: 'Nayaversse का एक व्यक्ति काम करता है।', text: 'महीने के वीडियो और पोस्ट आपके लिए बनते हैं, विज्ञापन तैयार होते हैं, ऑफ़र का मसौदा बनता है। सब कुछ आपके अपने अकाउंट के अंदर, जहाँ आप देख सकें।', points: ['हर काम किसने और कब किया, यह दर्ज रहता है', 'आप फ़ोन से मंज़ूरी देते हैं। आपकी हाँ के बिना कुछ नहीं जाता, कुछ खर्च नहीं होता', 'विज्ञापन अकाउंट, पेज और ग्राहकों की सूची आपकी ही रहती है', 'जब चाहें, काम ख़ुद वापस ले लें'] },
    ],
    waysRule: 'दोनों में एक नियम लागू है: सॉफ़्टवेयर और हमारे लोग कुछ भी मसौदा बना सकते हैं, पर ग्राहकों को हर मैसेज और विज्ञापन का हर रुपया आपकी मंज़ूरी माँगता है, सटीक शब्द और सटीक रकम आपके सामने रखकर।',
    shownHeading: 'आपको क्या दिखाया जाता है।',
    shownLede: 'लाइक का डैशबोर्ड नहीं। तीन बातें जो मालिक पूछता है, एक ही स्क्रीन पर।',
    shown: [
      { q: 'मेरा पैसा कहाँ गया?', a: 'विज्ञापन का पैसा, मैसेज का खर्च और हमारी फ़ीस, हर एक अलग पंक्ति में। विज्ञापन और मैसेज का पैसा आप सीधे Meta को देते हैं, इसलिए आँकड़ा Meta के अपने बिल से मिलाया जा सकता है।' },
      { q: 'इससे क्या लौटा?', a: 'बुकिंग तभी गिनी जाती है जब उसी फ़ोन नंबर को मैसेज गया हो या उसने विज्ञापन से चैट खोली हो, और फिर बुक किया हो। बाकी सब "जोड़ा नहीं जा सका" में दिखता है।' },
      { q: 'मेरे लिए क्या काम हुआ?', a: 'इस महीने बना हर वीडियो, विज्ञापन और ऑफ़र, आपके प्लान में जितना शामिल है उसके मुकाबले, और सबसे ऊपर वह जो आपकी मंज़ूरी का इंतज़ार कर रहा है।' },
    ],
    proofHeading: 'कुछ लोगों को जानबूझकर मैसेज नहीं भेजा जाता।',
    proof: [
      'बीस या ज़्यादा लोगों को भेजे गए हर ऑफ़र में से कुछ लोग बेतरतीब ढंग से छोड़ दिए जाते हैं। फिर आप साथ-साथ देखते हैं कि मैसेज पाने वालों में से कितने लौटे, और छोड़े गए लोगों में से कितने वैसे भी आए।',
      'यह फ़र्क ही वह है जो मैसेज ने किया। छोटे समूह को पहला संकेत कहा जाता है, सबूत नहीं।',
    ],
    repliesHeading: 'पूछताछ का जवाब किसी भी समय, आपके शब्दों में।',
    repliesLede: 'रोज़ पूछे जाने वाले सवालों के जवाब मंज़ूर करें: दाम, समय, आप कहाँ हैं। जिस मैसेज पर एक जवाब साफ़ बैठता है, उसे वह जवाब WhatsApp, Instagram या Messenger पर मिलता है।',
    replies: ['कुछ भी अपने मन से नहीं लिखा जाता: हर भेजा गया शब्द आपका मंज़ूर किया हुआ है', 'जो साफ़ न हो, शिकायत हो या पैसे का सवाल हो, वह किसी व्यक्ति का इंतज़ार करता है', 'एक व्यक्ति को दिन में ज़्यादा से ज़्यादा तीन अपने आप जवाब, और स्टाफ़ के जवाब देने के बाद एक भी नहीं'],
    repliesCaption: 'डेमो सैलून पर एक Instagram मैसेज, मंज़ूर किए दाम के जवाब के साथ, फिर एक रुकने वाला जवाब।',
    whyHeading: 'अपनी मार्केटिंग का पैसा यहाँ क्यों लगाएँ।',
    whyLede: 'हम आपको दूसरे व्यवसायों के नतीजे नहीं दिखा सकते, क्योंकि अभी कोई नहीं है। हम यह दिखा सकते हैं कि पैसा और नियंत्रण कैसे रखा गया है, जिसे आप कुछ भी देने से पहले जाँच सकते हैं।',
    why: [
      { t: 'सब कुछ आपका है', d: 'विज्ञापन अकाउंट, पेज, ग्राहकों की सूची और तैयार वीडियो आपके नाम पर हैं। हम आपके अकाउंट में मेहमान की तरह काम करते हैं, और आप एक टैप में हमें हटा सकते हैं।' },
      { t: 'विज्ञापन का पैसा हमारे हाथ से नहीं जाता', d: 'आप एक सटीक रकम मंज़ूर करते हैं। वही Meta पर खर्च की सीमा बनती है, इसलिए हमारी तरफ़ की गलती से ज़्यादा खर्च नहीं हो सकता।' },
      { t: 'आप नतीजा देखते हैं, या यह कि कुछ नहीं हुआ', d: 'अगर किसी महीने कुछ नहीं लौटा, तो वही स्क्रीन यह बताती है। यह आपकी बुकिंग से गिना जाता है, उन लोगों का लिखा नहीं जिनकी फ़ीस इस पर टिकी है।' },
      { t: 'आपका नाम ख़राब नहीं होगा', d: 'कोई गारंटी नहीं, "शहर में सबसे अच्छा" नहीं, रुकने को कहने वाले को कोई मैसेज नहीं। नंबर को स्पैम सूची से दूर रखने वाले नियम पहले से बने हुए हैं।' },
      { t: 'ग्राहकों की जानकारी निजी रहती है', d: 'नाम, नंबर और मैसेज एन्क्रिप्ट करके रखे जाते हैं। आप किसी एक ग्राहक की पूरी जानकारी डाउनलोड कर सकते हैं, या हमेशा के लिए मिटा सकते हैं।' },
      { t: 'शुरुआत उनसे जो आपको जानते हैं', d: 'अनजान लोगों तक पहुँचने के लिए पैसे देने से पहले, ग्रोथ आपकी पहले से मौजूद सूची पर काम करता है। पहला रुपया आमतौर पर वहीं से सबसे जल्दी लौटता है।' },
    ],
    priceNote: 'बड़े व्यवसायों की कीमत अलग से बताई जाती है। पहले व्यवसाय पायलट के तौर पर जुड़ते हैं, और कीमत हर एक के साथ तय होती है।',
    seePricing: 'कीमत देखें',
    standingHeading: 'यह कहाँ तक पहुँचा है, साफ़-साफ़।',
    standing: [
      { t: 'बना हुआ, हमारी मशीनों पर चलता हुआ', d: 'वीडियो स्टूडियो, आपके अकाउंट से विज्ञापन, ऑफ़र और अपने आप जाने वाले मैसेज, अपने आप जवाब, छोड़े गए लोगों से तुलना, हफ़्ते की रिपोर्ट, डाउनलोड और मिटाना।' },
      { t: 'असली अकाउंट पर अभी नहीं चला', d: 'असली Meta विज्ञापन अकाउंट पर विज्ञापन, WhatsApp Business सेवा से भेजना, Instagram और Messenger पर जवाब, और भुगतान लेना। हर एक सिर्फ़ टेस्ट मोड में चला है।' },
      { t: 'किसी व्यवसाय ने इस्तेमाल नहीं किया', d: 'इसलिए न बताने को कोई नतीजा है, न किसी मालिक से बात कराने को। पहले व्यवसाय पायलट हैं, और हम हर एक के साथ उसका पहला महीना बैठते हैं।' },
    ],
    pilotHeading: 'इसे चलाने वाले पहले लोगों में से बनें।',
    pilotLede: 'एक पायलट, उन शर्तों पर जो हम साथ तय करें। ख़ुद चलाएँ या हमसे चलवाएँ। दोनों तरह हम पहले महीने आपके साथ बैठते हैं और नतीजा आपके साथ पढ़ते हैं।',
  },
  pricing: {
    title: 'इसकी कीमत।',
    lede: 'मासिक, एक शुरुआती कीमत से, आपके काम के आकार के हिसाब से। सही रकम डेमो के बाद बताई जाती है और अनुबंध में लिखी जाती है। आपके रिकॉर्ड पहले दिन से पूरे डाउनलोड हो सकते हैं।',
    clinicHeading: 'Nayaversse क्लिनिक',
    clinicLede: 'एक ही सिस्टम की चार श्रेणियाँ। आगे बढ़ने वाला क्लिनिक एक सेटिंग बदलता है, अपने रिकॉर्ड नहीं।',
    customFor: 'कई शाखाएँ, या ऐसी ज़रूरत जो किसी श्रेणी में न बैठे।',
    growthHeading: 'Nayaversse ग्रोथ',
    growthLede: 'मार्केटिंग फ़र्म का काम, आप चलाएँ या हम, हर रुपये का हिसाब दिखाकर।',
    growthPlans: 'प्लान',
    growthModules: 'या सिर्फ़ एक हिस्सा',
    growthPoints: ['हर महीने बनने वाले वीडियो और पोस्ट', 'आपके अपने Meta अकाउंट से विज्ञापन, आपके इलाके में या पूरे भारत में', 'WhatsApp, Instagram और Messenger पर ऑफ़र और अपने आप जवाब', 'क्या गया और क्या लौटा, इसका हिसाब'],
    howHeading: 'भुगतान कैसे होता है',
    how: [
      { t: 'मासिक', d: 'हर महीने बिल। यहाँ लिखी शुरुआती कीमतें हर श्रेणी की शुरुआत हैं; आपकी कीमत आपके काम के हिसाब से बताई जाती है।' },
      { t: 'विज्ञापन का पैसा अलग', d: 'ग्रोथ में विज्ञापन का पैसा आपके अपने अकाउंट से Meta को जाता है। वह कभी हमें नहीं दिया जाता।' },
      { t: 'पहले देख लें', d: 'डेमो काल्पनिक रिकॉर्ड पर चलता है, इसलिए कुछ भी असली स्क्रीन पर नहीं आता।' },
      { t: 'छोड़ना', d: 'आपके रिकॉर्ड पहले दिन से पूरे डाउनलोड होते हैं, हमसे पूछे बिना।' },
    ],
    platformHeading: 'दुकानें, सैलून, जिम और खाना',
    platformLede: 'अभी नहीं बना। हम क्या लेने की उम्मीद करते हैं, और हर व्यवसाय कहाँ तक पहुँचा है, यह आगे की योजना वाले पेज पर है।',
    platformLink: 'आगे की योजना पढ़ें',
  },
};

const mr: SiteCopy = {
  nav: { clinic: 'क्लिनिक', growth: 'ग्रोथ', vision: 'पुढची योजना', pricing: 'किंमत', book: 'डेमो बुक करा', whatsapp: 'WhatsApp वर लिहा' },
  hero: {
    before: 'आम्ही असे सॉफ्टवेअर बनवतो ज्यावर ',
    accent: 'एखाद्या व्यवसायाचा पूर्ण दिवस चालतो',
    after: '.',
    lede: 'Nayaversse ही सांगलीची एक सॉफ्टवेअर कंपनी आहे, जिची दोन उत्पादने आहेत. क्लिनिक, डॉक्टरांचे क्लिनिक पहिल्या टोकनपासून दिवसाच्या हिशोबापर्यंत चालवते. ग्रोथ कोणत्याही व्यवसायासाठी मार्केटिंग फर्मचे काम करते, प्रत्येक रुपयाचा हिशोब दाखवून. दुकाने, सलून, जिम आणि खाद्य व्यवसाय यानंतर येतील.',
    book: 'डेमो बुक करा',
    films: 'फिल्म पाहा',
    clinicLine: 'क्लिनिकचा पूर्ण दिवस. रांग आपोआप योग्य क्रमात लागते.',
    growthLine: 'तुमचे मार्केटिंग, मार्केटिंग फर्मशिवाय.',
    stageHint: 'मागची कोणतीही स्क्रीन दाबा, ती पुढे येईल.',
    ledeShort: 'सांगलीची एक सॉफ्टवेअर कंपनी, दोन उत्पादनांसह: क्लिनिक, जे एका क्लिनिकमध्ये पैसे देऊन रोज चालू आहे, आणि ग्रोथ, जे मार्केटिंग फर्मचे काम करते.',
  },
  phone: { enlarge: 'मोठे पाहण्यासाठी टॅप करा', drag: 'आजूबाजूला पाहण्यासाठी ओढा', close: 'बंद करा' },
  facts: [
    { title: 'दोन उत्पादने', text: 'क्लिनिक आणि ग्रोथ, प्रत्येकावर त्याची खरी स्थिती लिहिलेली' },
    { title: 'एक चालू व्यवसाय', text: 'सांगलीतील एक क्लिनिक, पैसे देऊन, ऑक्टोबर 2026 पासून रोज वापरात' },
    { title: 'एक संस्थापक', text: 'जो ते बनवतो, विकतो आणि फोनही उचलतो' },
    { title: 'बाहेरचा पैसा नाही', text: 'काय बनेल हे कोणताही गुंतवणूकदार ठरवत नाही' },
  ],
  products: {
    heading: 'एक कंपनी, दोन उत्पादने.',
    lede: 'प्रत्येक उत्पादन स्पष्ट सांगते की ते कुठपर्यंत पोहोचले आहे. चालू म्हणजे एखादा व्यवसाय त्याचे पैसे देतो आणि रोज ते वापरतो.',
    growthFor: 'प्रत्येक अशा व्यवसायासाठी जो नाहीतर मार्केटिंग फर्म ठेवला असता.',
    growthLine: 'व्हिडिओ बनवते, जाहिराती चालवते, येणे थांबवलेल्या ग्राहकांना परत बोलावते आणि चौकशीला उत्तर देते. तुम्ही चालवा, किंवा आम्ही तुमच्यासाठी चालवू.',
    growthPoints: [
      'तुमच्या स्वतःच्या फोटो, दर आणि ऑफरपासून बनलेले व्हिडिओ आणि जाहिराती',
      'मालकाच्या मंजुरीशिवाय ना कोणता मेसेज जातो, ना पैसा खर्च होतो',
      'जाहिरातीचा पैसा थेट तुमच्याकडून Meta ला जातो, मंजूर रकमेच्या मर्यादेत',
      'एकाच स्क्रीनवर रुपयांत: किती गेले आणि किती परत आले',
    ],
  },
  money: { from: 'सुरुवात', perMonth: 'दरमहा', custom: 'तुमच्या गरजेनुसार', perYear: 'दरवर्षी', off: 'सूट' },
  different: {
    heading: 'Nayaversse क्लिनिक: हे कुठे वेगळे आहे.',
    lede: 'चिठ्ठी तर कोणतेही क्लिनिक सॉफ्टवेअर छापते. हे असे भाग आहेत जे ज्या डॉक्टरांसोबत आम्ही हे बनवले, त्यांना इतर कुठेही मिळाले नाहीत.',
    items: [
      { title: 'रांग आपोआप लागते', text: 'इमर्जन्सी, गरोदर रुग्ण, ज्येष्ठ किंवा मूल ठरलेल्या नियमाने पुढे जातात, अशा स्क्रीनवर जी सगळे वाचू शकतात. रिसेप्शनवरचे वाद थांबतात.', alt: 'क्लिनिकची रांग, ज्यात इमर्जन्सी सर्वात पुढे आहे' },
      { title: 'हे तपासणी ऐकते', text: 'तपासणीच्या खोलीत संभाषणावरून नोंद, औषधे, तपासण्या आणि फॉलो-अपचा मसुदा बनवते. डॉक्टर तपासून पक्के करतात. चाचणीत.', alt: 'सहाय्यक तपासणी ऐकून नोंदीचा मसुदा बनवत आहे' },
      { title: 'पूर्ण भेट एकाच शीटवर', text: 'तक्रार, तपासणीत आढळलेले, निदान, औषधे आणि चाचण्या एकाच शीटवर, हाताने किंवा बोलून लिहिलेल्या, एका पुष्टीने सेव्ह.', alt: 'निदान, औषधे आणि चाचण्यांसह एक भेट शीट' },
      { title: 'रुग्ण तुम्हाला शोधतात', text: 'क्लिनिकची स्वतःची वेबसाइट, बारा भारतीय भाषांपर्यंत, त्यावर लाइव्ह रांगेसह, म्हणजे लोक दर पाच मिनिटांनी डेस्कला विचारत नाहीत.', alt: 'मराठीतील क्लिनिकची वेबसाइट' },
    ],
  },
  assistant: {
    pill: 'क्लिनिकचा भाग',
    heading: 'बोला. ते होकाराची वाट पाहते.',
    lede: 'क्लिनिक सॉफ्टवेअरमधील एक सहाय्यक. जे हवे ते इंग्रजी, हिंदी किंवा मराठीत बोला, किंवा टाइप करा. त्याला काय समजले ते दाखवते, आणि कोणी पुष्टी करेपर्यंत काहीही सेव्ह करत नाही.',
    pick: 'फिल्म निवडा',
  },
  growthHow: {
    heading: 'तुमचे मार्केटिंग, मार्केटिंग फर्मशिवाय.',
    lede: 'Nayaversse ग्रोथ ती पाचही कामे करते जी एक फर्म स्थानिक व्यवसायासाठी करते, एकाच ठिकाणी, जिथे मालक सगळे पाहू शकतो.',
    steps: [
      { title: 'हे काम बनवते', text: 'व्हिडिओ, पोस्ट, जाहिराती आणि ऑफर, तुमच्या स्वतःच्या फोटो आणि दरांपासून, तुमच्या भाषेत.' },
      { title: 'तुम्ही चालवा, किंवा आम्ही', text: 'टूल्स स्वतः वापरा, किंवा Nayaversse मधील एखादी व्यक्ती तुमच्या अकाउंटमध्ये महिन्याचे काम करेल.' },
      { title: 'मालक मंजुरी देतात', text: 'मसुदा कोणीही बनवू शकतो. मालकाच्या होकाराशिवाय ना मेसेज जातो, ना जाहिरातीचा पैसा खर्च होतो.' },
      { title: 'लाइक नाही, रुपये', text: 'किती गेले आणि किती परत आले, फोन नंबरशी जोडून. काही लोकांना मुद्दाम वगळले जाते, म्हणजे कोण तसेही आले असते ते दिसते.' },
    ],
    caption: 'डेमो सलूनवर ग्रोथमधील मालकाचे होम. यावरील प्रत्येक आकडा काल्पनिक आहे; कोणत्याही व्यवसायाने अजून ग्रोथ वापरलेले नाही.',
    more: 'ग्रोथबद्दल सगळे',
  },
  films: {
    heading: 'दोन्ही उत्पादने, फिल्मवर.',
    lede: 'उत्पादनातूनच रेकॉर्ड केलेल्या. यातील प्रत्येक रुग्ण आणि ग्राहक काल्पनिक आहे.',
    clinic: 'Nayaversse क्लिनिक',
    clinicNote: 'कागदावरची सकाळची गर्दी, मग तीच सकाळ खऱ्या स्क्रीनवर.',
    growth: 'Nayaversse ग्रोथ',
    growthNote: 'एक डेमो सलून येणे थांबवलेल्या ग्राहकांना परत बोलावते. इंग्रजीत.',
  },
  about: {
    heading: 'Nayaversse बद्दल: तुम्ही कोणाशी बोलणार आहात.',
    growthParagraph: 'ग्रोथ त्या पुढच्या प्रश्नातून आले जो प्रत्येक मालक विचारत होता: लाइकच्या अहवालासाठी फर्मला पैसे न देता, माझे ग्राहक परत कसे आणू?',
    checks: 'तुम्ही काय तपासू शकता',
    call: 'कॉल करा',
    whatsapp: 'WhatsApp',
  },
  visionTeaser: {
    heading: 'यानंतर काय येईल.',
    lede: 'तेवीस प्रकारचे व्यवसाय, क्लिनिकच्याच नोंदींवर, प्रत्येकाच्या खऱ्या स्थितीसह. एक वापरात आहे.',
    link: 'पुढची योजना वाचा',
  },
  questions: {
    cost: { q: 'याची किंमत किती?', a: 'क्लिनिक {clinic} दरमहा पासून आणि ग्रोथ {growth} दरमहा पासून सुरू होते. नेमकी किंमत डेमोनंतर, तुमच्या कामाच्या आकारानुसार सांगितली जाते आणि करारात लिहिली जाते.' },
    whatsapp: 'क्लिनिक नाही: त्याचे रिमाइंडर ॲपमध्येच आहेत. ग्रोथ हे ते उत्पादन आहे जे WhatsApp, Instagram आणि Messenger वर ग्राहकांना लिहिते, फक्त ज्यांनी होकार दिला त्यांनाच, आणि फक्त मालकाने मंजूर केलेल्या शब्दांत. ग्रोथ अजून खऱ्या Meta अकाउंटवर चाललेले नाही.',
  },
  enquiry: { heading: 'वीस मिनिटे, तुमची स्क्रीन आणि माझी.', lede: 'तुम्ही रोज डेस्कवर करता त्या कामावर. कोणत्याही स्लाइड नाहीत. हे तुमच्या कामाच्या पद्धतीत बसत नसेल, तर मी स्पष्ट सांगेन.', about: 'तुम्ही कशाबद्दल विचारत आहात', options: ['Nayaversse क्लिनिक', 'Nayaversse ग्रोथ', 'दोन्ही', 'पुढच्या योजनेतील काही'], call: 'किंवा कॉल करा' },
  footer: { products: 'उत्पादने', company: 'कंपनी', contact: 'संपर्क', about: 'आमच्याबद्दल', questions: 'प्रश्न' },
  clinic: {
    more: 'क्लिनिकबद्दल सगळे',
    classesHeading: 'एका डॉक्टरपासून रुग्णालयापर्यंत.',
    classesLede: 'चार श्रेणी, प्रत्येक त्याच सिस्टिमचा आणखी भाग सुरू करते. पुढे जाणे म्हणजे फक्त एक सेटिंग बदलणे, नोंदी त्याच राहतात: काही पुन्हा लिहायचे नाही, काही हरवत नाही.',
    pricingLink: 'प्रत्येक श्रेणीत काय आहे, आणि पैसे कसे दिले जातात',
  },
  growth: {
    before: 'तुमचे मार्केटिंग, ',
    accent: 'मार्केटिंग फर्मशिवाय',
    after: '.',
    lede: 'ग्रोथ व्हिडिओ बनवते, जाहिराती चालवते, येणे थांबवलेल्या ग्राहकांना परत बोलावते आणि चौकशीला उत्तर देते. स्वतः चालवा, किंवा आमच्याकडून चालवून घ्या. दोन्ही प्रकारे तुम्ही रुपयांत पाहता की काय खर्च झाले आणि काय परत आले.',
    pilot: 'पायलटबद्दल विचारा',
    standsTitle: 'तयार, पण अजून सिद्ध नाही',
    standsText: 'हे आमच्या स्वतःच्या मशीनवर सुरुवातीपासून शेवटपर्यंत चालते. कोणत्याही व्यवसायाने ते वापरलेले नाही, म्हणून या पानावरील काहीही निकाल नाही. पहिले व्यवसाय पायलट असतील.',
    statementCaption: 'डेमो सलूनवर ग्रोथमधील मालकाचा हिशोब. प्रत्येक आकडा काल्पनिक आहे.',
    firmHeading: 'मार्केटिंग फर्म जे काही करते, ते सगळे एकाच ठिकाणी जिथे तुम्ही सगळे पाहू शकता.',
    firmLede: 'एक फर्म स्थानिक व्यवसायासाठी पाच कामे करते. ग्रोथही तीच पाच करते. फरक शेवटच्या ओळीत आहे: तुम्हाला काय दाखवले जाते, आणि तुमच्याकडे काय राहते.',
    colFirm: 'मार्केटिंग फर्मसोबत, साधारणपणे',
    colUs: 'Nayaversse ग्रोथसोबत',
    firm: [
      ['व्हिडिओ आणि पोस्ट', 'असे कोणी बनवते ज्याला तुम्ही कधी भेटत नाही. पोस्ट झाल्यावर दिसतात.', 'तुमच्या स्वतःच्या फोटो, दर आणि ऑफरपासून, इंग्रजी, हिंदी किंवा मराठीत. तुम्ही पाहिल्याशिवाय कोणतीही फाइल बनत नाही.'],
      ['जाहिराती', 'अनेकदा फर्मच्या अकाउंटवरून, जाहिरातीचा पैसा त्यांच्या हातून जाऊन.', 'तुमच्या स्वतःच्या Meta जाहिरात अकाउंटवरून, तुम्ही मंजूर केलेल्या नेमक्या रकमेच्या मर्यादेत. पैसा तुमच्याकडून Meta ला जातो, आमच्यामार्फत कधीच नाही.'],
      ['येणे थांबवलेले ग्राहक', 'साधारणपणे कोणाचेच काम नाही.', 'ज्यांनी मेसेजला होकार दिला त्यांना WhatsApp वर ऑफर, काहींना वगळून, म्हणजे मेसेजने काय केले ते दिसते.'],
      ['चौकशी', 'कोणाला वेळ मिळेल तेव्हा उत्तर.', 'रोज विचारल्या जाणाऱ्या प्रश्नांची उत्तरे कधीही WhatsApp, Instagram आणि Messenger वर, तुम्ही मंजूर केलेल्या शब्दांत.'],
      ['अहवाल', 'लाइक, रीच आणि इंप्रेशन, महिन्यातून एकदा.', 'दर आठवड्याला रुपयांत: काय गेले, काय परत आले, आणि काय जोडता आले नाही.'],
      ['तुम्ही सोडल्यास', 'पेज, अकाउंट आणि इतिहास फर्मकडे राहू शकतात.', 'जाहिरात अकाउंट, ग्राहकांची यादी आणि व्हिडिओ पहिल्या दिवसापासून तुमचे होते.'],
    ],
    waysHeading: 'चालवण्याचे दोन मार्ग. स्क्रीन दोन्हीत तीच.',
    waysLede: 'काही मालकांना टूल्स हवी असतात. काहींना काम पूर्ण झालेले हवे असते. तुम्ही निवडा, आणि महिन्याच्या मध्येही काहीही न गमावता मत बदलू शकता.',
    ways: [
      { kicker: 'तुम्ही चालवा', title: 'टूल्स, तुमच्या हातात.', text: 'तुम्ही किंवा तुमचा स्टाफ व्हिडिओ बनवतो, ऑफर लिहितो आणि जाहिराती सुरू करतो. ग्रोथ प्रत्येकाचा मसुदा बनवते; तुम्ही दुरुस्त करून मंजुरी देता.', points: ['तुमच्या स्वतःच्या फोटो आणि दरांवर चालणारा व्हिडिओ स्टुडिओ', 'काही मिनिटांत सुरू होणाऱ्या जाहिराती, जास्तीत जास्त खर्च आधी दाखवून', 'WhatsApp वर ऑफर, आपोआप जाणारे मेसेज आणि उत्तरे', 'स्टाफ मसुदा बनवू शकतो. पाठवणे किंवा खर्च करणे फक्त मालक करू शकतो'] },
      { kicker: 'आम्ही तुमच्यासाठी चालवतो', title: 'Nayaversse मधील एक व्यक्ती काम करते.', text: 'महिन्याचे व्हिडिओ आणि पोस्ट तुमच्यासाठी बनतात, जाहिराती तयार होतात, ऑफरचा मसुदा बनतो. सगळे तुमच्या स्वतःच्या अकाउंटमध्ये, जिथे तुम्ही पाहू शकता.', points: ['प्रत्येक काम कोणी आणि केव्हा केले, याची नोंद राहते', 'तुम्ही फोनवरून मंजुरी देता. तुमच्या होकाराशिवाय काही जात नाही, काही खर्च होत नाही', 'जाहिरात अकाउंट, पेज आणि ग्राहकांची यादी तुमचीच राहते', 'हवे तेव्हा काम स्वतः परत घ्या'] },
    ],
    waysRule: 'दोन्हीत एक नियम लागू आहे: सॉफ्टवेअर आणि आमची माणसे काहीही मसुदा बनवू शकतात, पण ग्राहकांना प्रत्येक मेसेज आणि जाहिरातीचा प्रत्येक रुपया तुमची मंजुरी मागतो, नेमके शब्द आणि नेमकी रक्कम तुमच्यासमोर ठेवून.',
    shownHeading: 'तुम्हाला काय दाखवले जाते.',
    shownLede: 'लाइकचा डॅशबोर्ड नाही. मालक विचारतो त्या तीन गोष्टी, एकाच स्क्रीनवर.',
    shown: [
      { q: 'माझा पैसा कुठे गेला?', a: 'जाहिरातीचा पैसा, मेसेजचा खर्च आणि आमची फी, प्रत्येक वेगळ्या ओळीत. जाहिरात आणि मेसेजचा पैसा तुम्ही थेट Meta ला देता, म्हणून आकडा Meta च्या स्वतःच्या बिलाशी जुळवता येतो.' },
      { q: 'यातून काय परत आले?', a: 'बुकिंग तेव्हाच मोजले जाते जेव्हा त्याच फोन नंबरला मेसेज गेला असेल किंवा त्याने जाहिरातीतून चॅट उघडली असेल, आणि मग बुक केले असेल. बाकी सगळे "जोडता आले नाही" मध्ये दिसते.' },
      { q: 'माझ्यासाठी काय काम झाले?', a: 'या महिन्यात बनलेला प्रत्येक व्हिडिओ, जाहिरात आणि ऑफर, तुमच्या प्लॅनमध्ये किती समाविष्ट आहे त्याच्या तुलनेत, आणि सर्वात वर तुमच्या मंजुरीची वाट पाहणारे.' },
    ],
    proofHeading: 'काही लोकांना मुद्दाम मेसेज पाठवला जात नाही.',
    proof: [
      'वीस किंवा जास्त लोकांना पाठवलेल्या प्रत्येक ऑफरमधून काही लोक यादृच्छिकपणे वगळले जातात. मग तुम्ही शेजारी शेजारी पाहता की मेसेज मिळालेल्यांपैकी किती परत आले, आणि वगळलेल्यांपैकी किती तसेही आले.',
      'हा फरक म्हणजेच मेसेजने केलेले काम. लहान गटाला पहिले संकेत म्हटले जाते, पुरावा नाही.',
    ],
    repliesHeading: 'चौकशीला कधीही उत्तर, तुमच्या शब्दांत.',
    repliesLede: 'रोज विचारल्या जाणाऱ्या प्रश्नांची उत्तरे मंजूर करा: दर, वेळ, तुम्ही कुठे आहात. ज्या मेसेजला एक उत्तर स्पष्ट बसते, त्याला ते उत्तर WhatsApp, Instagram किंवा Messenger वर मिळते.',
    replies: ['काहीही मनाने लिहिले जात नाही: पाठवलेला प्रत्येक शब्द तुम्ही मंजूर केलेला असतो', 'जे स्पष्ट नाही, तक्रार किंवा पैशाचा प्रश्न, ते एखाद्या व्यक्तीची वाट पाहते', 'एका व्यक्तीला दिवसात जास्तीत जास्त तीन आपोआप उत्तरे, आणि स्टाफने उत्तर दिल्यानंतर एकही नाही'],
    repliesCaption: 'डेमो सलूनवर एक Instagram मेसेज, मंजूर दराच्या उत्तरासह, मग एक थांबवणारे उत्तर.',
    whyHeading: 'तुमच्या मार्केटिंगचा पैसा इथे का लावावा.',
    whyLede: 'आम्ही तुम्हाला इतर व्यवसायांचे निकाल दाखवू शकत नाही, कारण अजून कोणी नाही. आम्ही हे दाखवू शकतो की पैसा आणि नियंत्रण कसे ठेवले आहे, जे तुम्ही काहीही देण्यापूर्वी तपासू शकता.',
    why: [
      { t: 'सगळे तुमचे आहे', d: 'जाहिरात अकाउंट, पेज, ग्राहकांची यादी आणि तयार व्हिडिओ तुमच्या नावावर आहेत. आम्ही तुमच्या अकाउंटमध्ये पाहुण्यासारखे काम करतो, आणि तुम्ही एका टॅपमध्ये आम्हाला काढू शकता.' },
      { t: 'जाहिरातीचा पैसा आमच्या हातून जात नाही', d: 'तुम्ही एक नेमकी रक्कम मंजूर करता. तीच Meta वर खर्चाची मर्यादा बनते, म्हणून आमच्या बाजूच्या चुकीने जास्त खर्च होऊ शकत नाही.' },
      { t: 'तुम्ही निकाल पाहता, किंवा काहीच झाले नाही हे', d: 'एखाद्या महिन्यात काही परत आले नाही, तर तीच स्क्रीन ते सांगते. हे तुमच्या बुकिंगवरून मोजले जाते, ज्यांची फी यावर अवलंबून आहे त्यांनी लिहिलेले नाही.' },
      { t: 'तुमचे नाव खराब होणार नाही', d: 'कोणतीही हमी नाही, "शहरात सर्वोत्तम" नाही, थांबायला सांगितलेल्याला मेसेज नाही. नंबर स्पॅम यादीपासून दूर ठेवणारे नियम आधीच बनलेले आहेत.' },
      { t: 'ग्राहकांची माहिती खासगी राहते', d: 'नावे, नंबर आणि मेसेज एन्क्रिप्ट करून ठेवले जातात. तुम्ही एखाद्या ग्राहकाची सगळी माहिती डाउनलोड करू शकता, किंवा कायमची पुसू शकता.' },
      { t: 'सुरुवात तुम्हाला ओळखणाऱ्यांपासून', d: 'अनोळखी लोकांपर्यंत पोहोचण्यासाठी पैसे देण्यापूर्वी, ग्रोथ तुमच्याकडे आधीच असलेल्या यादीवर काम करते. पहिला रुपया साधारणपणे तिथूनच सर्वात लवकर परत येतो.' },
    ],
    priceNote: 'मोठ्या व्यवसायांची किंमत वेगळी सांगितली जाते. पहिले व्यवसाय पायलट म्हणून जोडले जातात, आणि किंमत प्रत्येकाशी ठरवली जाते.',
    seePricing: 'किंमत पाहा',
    standingHeading: 'हे कुठपर्यंत पोहोचले आहे, स्पष्टपणे.',
    standing: [
      { t: 'बनलेले, आमच्या मशीनवर चालणारे', d: 'व्हिडिओ स्टुडिओ, तुमच्या अकाउंटवरून जाहिराती, ऑफर आणि आपोआप जाणारे मेसेज, आपोआप उत्तरे, वगळलेल्या लोकांशी तुलना, आठवड्याचा अहवाल, डाउनलोड आणि पुसणे.' },
      { t: 'खऱ्या अकाउंटवर अजून चाललेले नाही', d: 'खऱ्या Meta जाहिरात अकाउंटवर जाहिराती, WhatsApp Business सेवेतून पाठवणे, Instagram आणि Messenger वरची उत्तरे, आणि पैसे घेणे. प्रत्येक फक्त टेस्ट मोडमध्ये चालले आहे.' },
      { t: 'कोणत्याही व्यवसायाने वापरलेले नाही', d: 'म्हणून सांगायला कोणताही निकाल नाही, बोलायला कोणताही मालक नाही. पहिले व्यवसाय पायलट आहेत, आणि आम्ही प्रत्येकासोबत त्याचा पहिला महिना बसतो.' },
    ],
    pilotHeading: 'हे चालवणाऱ्या पहिल्या लोकांपैकी व्हा.',
    pilotLede: 'एक पायलट, आपण मिळून ठरवलेल्या अटींवर. स्वतः चालवा किंवा आमच्याकडून चालवून घ्या. दोन्ही प्रकारे आम्ही पहिला महिना तुमच्यासोबत बसतो आणि निकाल तुमच्यासोबत वाचतो.',
  },
  pricing: {
    title: 'याची किंमत.',
    lede: 'दरमहा, एका सुरुवातीच्या किमतीपासून, तुमच्या कामाच्या आकारानुसार. नेमकी रक्कम डेमोनंतर सांगितली जाते आणि करारात लिहिली जाते. तुमच्या नोंदी पहिल्या दिवसापासून पूर्ण डाउनलोड होतात.',
    clinicHeading: 'Nayaversse क्लिनिक',
    clinicLede: 'एकाच सिस्टिमच्या चार श्रेणी. पुढे जाणारे क्लिनिक एक सेटिंग बदलते, आपल्या नोंदी नाही.',
    customFor: 'अनेक शाखा, किंवा अशी गरज जी कोणत्याही श्रेणीत बसत नाही.',
    growthHeading: 'Nayaversse ग्रोथ',
    growthLede: 'मार्केटिंग फर्मचे काम, तुम्ही चालवा किंवा आम्ही, प्रत्येक रुपयाचा हिशोब दाखवून.',
    growthPlans: 'प्लॅन',
    growthModules: 'किंवा फक्त एक भाग',
    growthPoints: ['दर महिन्याला बनणारे व्हिडिओ आणि पोस्ट', 'तुमच्या स्वतःच्या Meta अकाउंटवरून जाहिराती, तुमच्या परिसरात किंवा पूर्ण भारतात', 'WhatsApp, Instagram आणि Messenger वर ऑफर आणि आपोआप उत्तरे', 'काय गेले आणि काय परत आले, याचा हिशोब'],
    howHeading: 'पैसे कसे दिले जातात',
    how: [
      { t: 'दरमहा', d: 'दर महिन्याला बिल. इथे लिहिलेल्या सुरुवातीच्या किमती प्रत्येक श्रेणीची सुरुवात आहेत; तुमची किंमत तुमच्या कामानुसार सांगितली जाते.' },
      { t: 'जाहिरातीचा पैसा वेगळा', d: 'ग्रोथमध्ये जाहिरातीचा पैसा तुमच्या स्वतःच्या अकाउंटमधून Meta ला जातो. तो कधीच आम्हाला दिला जात नाही.' },
      { t: 'आधी पाहून घ्या', d: 'डेमो काल्पनिक नोंदींवर चालतो, म्हणून काहीही खरे स्क्रीनवर येत नाही.' },
      { t: 'सोडणे', d: 'तुमच्या नोंदी पहिल्या दिवसापासून पूर्ण डाउनलोड होतात, आम्हाला न विचारता.' },
    ],
    platformHeading: 'दुकाने, सलून, जिम आणि खाद्य',
    platformLede: 'अजून बनलेले नाही. आम्ही किती घेण्याची अपेक्षा करतो, आणि प्रत्येक व्यवसाय कुठपर्यंत पोहोचला आहे, हे पुढच्या योजनेच्या पानावर आहे.',
    platformLink: 'पुढची योजना वाचा',
  },
};

export const siteCopy: Record<Locale, SiteCopy> = { en, hi, mr };

/** ₹ in the Indian grouping every visitor reads: ₹10,000, ₹1,00,000. */
export function rupees(n: number): string {
  return '₹' + n.toLocaleString('en-IN');
}
