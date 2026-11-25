/**
 * The words for the site's product structure: Clinic (the one live product),
 * Growth (built, not yet used by a business) and the Vision page (everything
 * planned after them).
 *
 * In its own file, like simple-pages.ts, and for the same reason: it is a lot
 * of prose in three languages, and en.ts, hi.ts and mr.ts are long enough.
 * The interface below does the job `Content = typeof en` does there: a
 * translation with a key missing does not compile.
 *
 * Held to the same rules as the rest of the content (see en.ts): one live
 * business, no percentage, no testimonial, and a status on everything. Two
 * of those bite here in particular:
 *   - Growth is BUILT, not live. Nobody uses it yet, and every mention says so.
 *   - The assistant is IN TRIAL. It is not switched on at the paying clinic,
 *     so it never carries the Live stamp. And it can mishear: the copy must
 *     not say or imply it is always right.
 */
import type { Locale } from './index';

export type FilmKey = 'whole' | 'say' | 'language' | 'yes' | 'limits' | 'room';

/** The films, in the order they are listed. `src` is under /public/video. */
export const assistantFilms: { key: FilmKey; src: string; poster: string; seconds: number }[] = [
  { key: 'whole', src: '/video/assistant.mp4', poster: '/video/assistant.jpg', seconds: 100 },
  { key: 'say', src: '/video/assistant-say.mp4', poster: '/video/assistant-say.jpg', seconds: 25 },
  { key: 'language', src: '/video/assistant-language.mp4', poster: '/video/assistant-language.jpg', seconds: 6 },
  { key: 'yes', src: '/video/assistant-yes.mp4', poster: '/video/assistant-yes.jpg', seconds: 13 },
  { key: 'limits', src: '/video/assistant-limits.mp4', poster: '/video/assistant-limits.jpg', seconds: 7 },
  { key: 'room', src: '/video/assistant-room.mp4', poster: '/video/assistant-room.jpg', seconds: 19 },
];

/** The clinic film exists in all three languages; each page plays its own. */
export const clinicFilm: Record<Locale, { src: string; poster: string }> = {
  en: { src: '/video/clinic-en.mp4', poster: '/video/clinic.jpg' },
  hi: { src: '/video/clinic-hi.mp4', poster: '/video/clinic.jpg' },
  mr: { src: '/video/clinic-mr.mp4', poster: '/video/clinic.jpg' },
};

export interface ProductsCopy {
  nav: { clinic: string; growth: string; vision: string };
  /** The three words a stamp can carry besides the chart's own. */
  status: { built: string; trial: string; planned: string };
  hero: {
    route: string[];
    headline: string[];
    lede: string;
    /** One line each under the product's name on the board. */
    clinicNote: string;
    growthNote: string;
    visionNote: string;
    action: string;
    secondary: string;
  };
  lineup: {
    bandTitle: string;
    band: string;
    heading: string;
    lede: string;
    clinic: { name: string; forWhom: string; body: string; points: string[]; stands: string; link: string };
    growth: { name: string; forWhom: string; body: string; points: string[]; stands: string; link: string };
    vision: { name: string; body: string; link: string };
  };
  film: {
    bandTitle: string;
    band: string;
    play: string;
    /** "Plays with sound", said before anyone presses play. */
    sound: string;
    clinicHeading: string;
    clinicLede: string;
    assistantHeading: string;
    assistantLede: string;
    trialNote: string;
    items: Record<FilmKey, { title: string; detail: string }>;
    honesty: string;
    /** Shown beside the assistant films on a page not in English. */
    englishOnly: string;
  };
  queue: { heading: string; lede: string };
  clinicPage: {
    title: string;
    lede: string;
    liveNote: string;
    getsHeading: string;
    demoHeading: string;
    demoBody: string;
    action: string;
  };
  growthPage: {
    title: string;
    lede: string;
    statusNote: string;
    sectionsBand: string;
    sections: { heading: string; body: string[] }[];
    filmHeading: string;
    filmNote: string;
    action: string;
  };
  visionPage: { title: string; lede: string; note: string };
  /** Search titles and descriptions for the three new pages. */
  seo: Record<'clinic' | 'growth' | 'vision', { title: string; description: string }>;
}

const en: ProductsCopy = {
  nav: { clinic: 'Clinic', growth: 'Growth', vision: 'Vision' },
  status: { built: 'Built', trial: 'In trial', planned: 'Planned' },
  hero: {
    route: ['Queue', 'Patient file', 'Prescription', 'Billing', 'Stock', 'The clinic’s website'],
    headline: ['Software for', 'the working day', 'of a clinic'],
    lede:
      'Nayaversse Clinic runs a clinic in Sangli today: the queue, the patient file, prescriptions, billing, stock and the clinic’s own website. Nayaversse Growth, which brings back customers who stopped coming, is built and waiting for its first business. Everything planned after these is on the Vision page, and says it is not built.',
    clinicNote: 'Running at a clinic in Sangli, every day',
    growthNote: 'Built. No business uses it yet',
    visionNote: 'Shops, salons, gyms, food. Not built',
    action: 'Book a walkthrough',
    secondary: 'See the clinic software',
  },
  lineup: {
    bandTitle: 'Products',
    band: 'One live · one built · the rest planned',
    heading: 'What we make',
    lede: 'Two products, each with its status on it. A third list, the Vision, is what comes after and is not for sale.',
    clinic: {
      name: 'Nayaversse Clinic',
      forWhom: 'For a doctor’s clinic, a polyclinic or a small hospital.',
      body: 'The whole day of a clinic in one place, from the first token to the day’s close.',
      points: [
        'A queue that puts emergencies, pregnant patients, seniors and children ahead by itself',
        'The patient file, case sheets and prescriptions off a 2,46,000-medicine Indian database',
        'Billing in cash, UPI and card, pharmacy stock, lab orders and the day’s close',
        'The clinic’s own website, in up to twelve Indian languages',
      ],
      stands: 'Running at Vadgaonkar Clinic in Walwa, Sangli, since October 2026.',
      link: 'All about Clinic',
    },
    growth: {
      name: 'Nayaversse Growth',
      forWhom: 'For any local business with customers who used to come.',
      body: 'Finds the customers who stopped coming, writes to them on WhatsApp with the owner’s approval, and shows how many came back.',
      points: [
        'Nobody is messaged until they have agreed, and the agreement is on record',
        'The owner approves every campaign before it is sent',
        'A share of people is deliberately not messaged, so you can see what the message changed',
        'A booking is counted only when it can be traced to a message',
      ],
      stands: 'Built and working end to end. No business uses it yet.',
      link: 'All about Growth',
    },
    vision: {
      name: 'The Vision',
      body: 'Shops, salons, gyms, restaurants and more on the same records as the clinic. None of it is built for those trades yet, and the page says so row by row.',
      link: 'Read the Vision',
    },
  },
  film: {
    bandTitle: 'On film',
    band: 'Recorded from the product · every patient is made up',
    play: 'Play',
    sound: 'Plays with sound',
    clinicHeading: 'The clinic software in four minutes',
    clinicLede: 'The morning rush on paper, and then the same morning on the real screens: front desk, doctor, pharmacy, counter.',
    assistantHeading: 'The clinic’s assistant, one feature at a time',
    assistantLede:
      'An assistant inside the clinic software. Say what you need, or type it. It shows what it understood and waits for a yes before anything is saved.',
    trialNote: 'The assistant is built and in trial. It is not switched on at a paying clinic yet, which is why it is not stamped Live.',
    items: {
      whole: { title: 'The whole film', detail: 'The typing a clinic does all day, and the five things the assistant does about it.' },
      say: { title: 'Say it', detail: 'One tap and it listens. A patient is registered by voice, a mistake is corrected in one sentence, and nothing is saved until the doctor says yes.' },
      language: { title: 'Any language', detail: 'English, Hindi or Marathi, mixed the way people speak at a desk.' },
      yes: { title: 'One sentence, one yes', detail: 'A payment taken in one sentence. The bill changes only when somebody confirms it.' },
      limits: { title: 'Everyone’s own limits', detail: 'Each login can do only what that person is allowed to. The pharmacist cannot take payments.' },
      room: { title: 'In the consulting room', detail: 'It listens to the visit and drafts the note, the medicines, the tests and the follow-up for the doctor to check.' },
    },
    honesty:
      'It can mishear, most often a name or a number. That is why it shows what it understood and saves nothing without a yes. The sound of a visit is sent to a speech service to be written down, and the recording is not kept.',
    englishOnly: 'These films are narrated in English.',
  },
  queue: {
    heading: 'A queue that sorts itself',
    lede: 'The live product’s own sort order, on sample rows. Watch what happens when an emergency walks in.',
  },
  clinicPage: {
    title: 'Nayaversse Clinic',
    lede: 'Clinic software that is running today. The queue, the patient file, prescriptions, billing, the pharmacy shelf and the clinic’s own website, in one system the front desk can use between patients.',
    liveNote: 'Running at Vadgaonkar Clinic in Walwa, Sangli, since October 2026: one doctor and two staff, booking, prescribing, billing and closing their day on it.',
    getsHeading: 'What a clinic gets',
    demoHeading: 'See it on a demo clinic',
    demoBody: 'A walkthrough is twenty minutes, your screen and mine, on a demo clinic where every patient is made up. Ask for the class you are looking at: clinic, polyclinic or hospital.',
    action: 'Book a walkthrough',
  },
  growthPage: {
    title: 'Nayaversse Growth',
    lede: 'Brings back the customers who stopped coming, and shows you whether it worked. For a salon, a clinic, a gym, a shop: any business that has a list of people who used to come.',
    statusNote: 'Built and working end to end on our own machines. No business uses it yet, so nothing here is a result. The first businesses will be pilots.',
    sectionsBand: 'What it does',
    sections: [
      {
        heading: 'The customers who stopped coming',
        body: [
          'You bring your customer list and your bookings, from a file or straight from your booking or billing software. Growth works out who has not been in for as long as you say: six weeks, three months.',
          'You type the offer. The message is written for you in your own language, and checked before it can be saved: no guarantees, no “best in town”, and a line telling people how to stop that cannot be removed.',
        ],
      },
      {
        heading: 'Nobody is messaged without agreeing',
        body: [
          'A customer can be messaged only after they have agreed, and how they agreed is recorded: at the counter, on a call, in writing, or by themselves on your opt-in page, which has a QR code for the counter in English, Hindi and Marathi.',
          'A reply of STOP withdraws it at once. Nobody is messaged more often than the limit you set, across every campaign, and never in quiet hours.',
        ],
      },
      {
        heading: 'The owner approves, then it sends',
        body: [
          'Staff can draft a campaign. Only the owner can approve it. It then goes out either from your own WhatsApp, one tap for each person on a send list, or automatically from your WhatsApp Business number.',
          'Delivered and read ticks come back on each person, and what customers write back collects in one place to be answered.',
        ],
      },
      {
        heading: 'Proof instead of impressions',
        body: [
          'A booking counts for a campaign only when the same phone number booked after getting the message, within the window you set. Everything else is shown as untraced, not claimed.',
          'Every campaign to twenty or more people also holds back a share and does not message them. You then see, side by side, how many of the messaged came back and how many of the held-back came back anyway. A small group is called a first sign, not proof.',
          'Every Monday the owner gets the week in one report: who was messaged, who came back, what it brought in.',
        ],
      },
      {
        heading: 'Finding new customers online',
        body: [
          'For a product or a startup, Growth also reads public conversations where people are asking for what you sell, and drafts a reply to each in your voice.',
          'It never posts by itself. A person reads each draft and posts it from their own account, saying who they are. That is slower than a bot, and it is the difference between being helpful and being banned.',
        ],
      },
      {
        heading: 'Your customers’ details',
        body: [
          'Customer details are kept encrypted. You can download everything held about one customer, or erase it for good, from the same screen.',
        ],
      },
      {
        heading: 'Where it stands',
        body: [
          'Everything above is built and tested. Sending through the WhatsApp Business service and taking payments have not yet been run with live accounts, and no business has used it for real customers.',
          'So the first businesses will be pilots, on terms agreed with each one, and we will sit with them through it. If you want to be one, say so below.',
        ],
      },
    ],
    filmHeading: 'On film',
    filmNote: 'There is no film of Growth yet. One is being recorded from the product itself, on made-up customers, and will be here when it is done. Until then, a walkthrough shows it running.',
    action: 'Ask about a pilot',
  },
  visionPage: {
    title: 'The Vision',
    lede: 'What we mean to build after the clinic, and how far each part has got. The records underneath are shared with the clinic product; the screens for each trade are not built.',
    note: 'Nothing on this page is for sale unless its row says Live. Prices on it are what we expect to charge, shown so you can judge it, and whoever is first on a row shapes it.',
  },
  seo: {
    clinic: {
      title: 'Nayaversse Clinic: Clinic Management Software, Live in Sangli',
      description: 'Clinic software running today at a clinic in Sangli: queue, patient records, prescriptions, billing, pharmacy stock and the clinic’s own website. Watch it on film.',
    },
    growth: {
      title: 'Nayaversse Growth: Win Back Customers on WhatsApp, with Proof',
      description: 'Brings back customers who stopped coming, with their consent and the owner’s approval, and shows how many returned. Built; not yet used by a business.',
    },
    vision: {
      title: 'The Vision: What Nayaversse Is Building Next',
      description: 'Shops, salons, gyms, restaurants and more on one set of records. Every row carries its true status: one is live, the rest are being built or not planned.',
    },
  },
};

const hi: ProductsCopy = {
  nav: { clinic: 'क्लिनिक', growth: 'ग्रोथ', vision: 'आगे की योजना' },
  status: { built: 'बन चुका', trial: 'परीक्षण में', planned: 'योजना में' },
  hero: {
    route: ['कतार', 'मरीज़ की फ़ाइल', 'प्रिस्क्रिप्शन', 'बिलिंग', 'स्टॉक', 'क्लिनिक की वेबसाइट'],
    headline: ['क्लिनिक के', 'पूरे दिन का', 'सॉफ़्टवेयर'],
    lede:
      'Nayaversse Clinic आज सांगली के एक क्लिनिक में चल रहा है: कतार, मरीज़ की फ़ाइल, प्रिस्क्रिप्शन, बिलिंग, स्टॉक और क्लिनिक की अपनी वेबसाइट। Nayaversse Growth, जो आना बंद कर चुके ग्राहकों को वापस लाता है, बन चुका है और अपने पहले धंधे का इंतज़ार कर रहा है। इनके बाद जो बनाना है वह “आगे की योजना” पेज पर है, और वहाँ साफ़ लिखा है कि वह अभी बना नहीं है।',
    clinicNote: 'सांगली के एक क्लिनिक में रोज़ चल रहा है',
    growthNote: 'बन चुका। अभी कोई धंधा इस्तेमाल नहीं करता',
    visionNote: 'दुकान, सैलून, जिम, खाना-पीना। अभी बना नहीं',
    action: 'डेमो बुक करें',
    secondary: 'क्लिनिक सॉफ़्टवेयर देखें',
  },
  lineup: {
    bandTitle: 'प्रोडक्ट',
    band: 'एक चालू · एक बन चुका · बाक़ी योजना में',
    heading: 'हम क्या बनाते हैं',
    lede: 'दो प्रोडक्ट, और हर एक पर उसकी असली स्थिति लिखी है। तीसरी सूची, आगे की योजना, इनके बाद की है और बिक्री के लिए नहीं है।',
    clinic: {
      name: 'Nayaversse Clinic',
      forWhom: 'डॉक्टर के क्लिनिक, पॉलीक्लिनिक या छोटे अस्पताल के लिए।',
      body: 'क्लिनिक का पूरा दिन एक जगह, पहले टोकन से दिन के हिसाब तक।',
      points: [
        'कतार जो इमरजेंसी, गर्भवती, बुज़ुर्ग और बच्चों को अपने आप आगे रखती है',
        'मरीज़ की फ़ाइल, केस शीट और 2,46,000 भारतीय दवाओं की सूची से प्रिस्क्रिप्शन',
        'नकद, UPI और कार्ड में बिलिंग, दवा का स्टॉक, लैब ऑर्डर और दिन का हिसाब',
        'क्लिनिक की अपनी वेबसाइट, बारह भारतीय भाषाओं तक',
      ],
      stands: 'अक्टूबर 2026 से वालवा, सांगली के वडगांवकर क्लिनिक में चल रहा है।',
      link: 'Clinic के बारे में सब कुछ',
    },
    growth: {
      name: 'Nayaversse Growth',
      forWhom: 'किसी भी स्थानीय धंधे के लिए, जिसके ग्राहक पहले आते थे।',
      body: 'जो ग्राहक आना बंद कर चुके हैं उन्हें ढूँढता है, मालिक की मंज़ूरी से उन्हें WhatsApp पर लिखता है, और दिखाता है कि कितने वापस आए।',
      points: [
        'जब तक ग्राहक ने हाँ नहीं कही, उसे संदेश नहीं जाता, और वह हाँ दर्ज रहती है',
        'हर कैंपेन भेजने से पहले मालिक मंज़ूर करता है',
        'कुछ लोगों को जान-बूझकर संदेश नहीं भेजा जाता, ताकि दिखे कि संदेश से क्या बदला',
        'बुकिंग तभी गिनी जाती है जब वह किसी संदेश से जोड़ी जा सके',
      ],
      stands: 'बन चुका है और शुरू से आख़िर तक चलता है। अभी कोई धंधा इसे इस्तेमाल नहीं करता।',
      link: 'Growth के बारे में सब कुछ',
    },
    vision: {
      name: 'आगे की योजना',
      body: 'दुकान, सैलून, जिम, रेस्टोरेंट और बाक़ी, क्लिनिक वाले ही रिकॉर्ड पर। इन धंधों के लिए अभी कुछ बना नहीं है, और पेज पर हर पंक्ति यही बताती है।',
      link: 'योजना पढ़ें',
    },
  },
  film: {
    bandTitle: 'वीडियो में',
    band: 'असली प्रोडक्ट से रिकॉर्ड किया गया · हर मरीज़ काल्पनिक है',
    play: 'चलाएँ',
    sound: 'आवाज़ के साथ चलता है',
    clinicHeading: 'क्लिनिक सॉफ़्टवेयर, चार मिनट में',
    clinicLede: 'काग़ज़ पर सुबह की भीड़, और फिर वही सुबह असली स्क्रीन पर: रिसेप्शन, डॉक्टर, फ़ार्मेसी, काउंटर।',
    assistantHeading: 'क्लिनिक का असिस्टेंट, एक-एक फ़ीचर',
    assistantLede:
      'क्लिनिक सॉफ़्टवेयर के अंदर एक असिस्टेंट। जो चाहिए वह बोलिए या टाइप कीजिए। वह दिखाता है कि उसने क्या समझा, और हाँ कहने से पहले कुछ सेव नहीं करता।',
    trialNote: 'असिस्टेंट बन चुका है और परीक्षण में है। अभी किसी भुगतान करने वाले क्लिनिक में चालू नहीं है, इसलिए इस पर “चालू” की मुहर नहीं है।',
    items: {
      whole: { title: 'पूरी फ़िल्म', detail: 'क्लिनिक में दिन भर की टाइपिंग, और असिस्टेंट उसके बारे में जो पाँच काम करता है।' },
      say: { title: 'बोल दीजिए', detail: 'एक बार दबाइए और वह सुनता है। मरीज़ बोलकर रजिस्टर होता है, ग़लती एक वाक्य में ठीक होती है, और डॉक्टर के हाँ कहने तक कुछ सेव नहीं होता।' },
      language: { title: 'कोई भी भाषा', detail: 'अंग्रेज़ी, हिंदी या मराठी, वैसे ही मिलाकर जैसे लोग काउंटर पर बोलते हैं।' },
      yes: { title: 'एक वाक्य, एक हाँ', detail: 'भुगतान एक वाक्य में। बिल तभी बदलता है जब कोई पुष्टि करता है।' },
      limits: { title: 'हर किसी की अपनी सीमा', detail: 'हर लॉगिन वही कर सकता है जिसकी उस व्यक्ति को इजाज़त है। फ़ार्मासिस्ट भुगतान नहीं ले सकता।' },
      room: { title: 'डॉक्टर के कमरे में', detail: 'वह मरीज़ से बातचीत सुनता है और नोट, दवाएँ, जाँचें और अगली तारीख़ का मसौदा बनाता है, जिसे डॉक्टर जाँचता है।' },
    },
    honesty:
      'वह ग़लत सुन सकता है, सबसे ज़्यादा कोई नाम या संख्या। इसीलिए वह पहले दिखाता है कि क्या समझा, और हाँ के बिना कुछ सेव नहीं करता। बातचीत की आवाज़ लिखने के लिए एक स्पीच सेवा को भेजी जाती है, और रिकॉर्डिंग रखी नहीं जाती।',
    englishOnly: 'इन फ़िल्मों की आवाज़ अंग्रेज़ी में है।',
  },
  queue: {
    heading: 'कतार जो ख़ुद क्रम लगाती है',
    lede: 'चालू प्रोडक्ट का अपना क्रम, नमूने की पंक्तियों पर। देखिए जब कोई इमरजेंसी आती है तो क्या होता है।',
  },
  clinicPage: {
    title: 'Nayaversse Clinic',
    lede: 'क्लिनिक सॉफ़्टवेयर जो आज चल रहा है। कतार, मरीज़ की फ़ाइल, प्रिस्क्रिप्शन, बिलिंग, दवा का स्टॉक और क्लिनिक की अपनी वेबसाइट, एक ही सिस्टम में जिसे रिसेप्शन दो मरीज़ों के बीच चला सके।',
    liveNote: 'अक्टूबर 2026 से वालवा, सांगली के वडगांवकर क्लिनिक में चल रहा है: एक डॉक्टर और दो कर्मचारी इसी पर बुकिंग, प्रिस्क्रिप्शन, बिलिंग और दिन का हिसाब करते हैं।',
    getsHeading: 'क्लिनिक को क्या मिलता है',
    demoHeading: 'डेमो क्लिनिक पर देखिए',
    demoBody: 'डेमो बीस मिनट का है, आपकी स्क्रीन और मेरी, एक डेमो क्लिनिक पर जहाँ हर मरीज़ काल्पनिक है। जो श्रेणी देखनी हो वह बताइए: क्लिनिक, पॉलीक्लिनिक या अस्पताल।',
    action: 'डेमो बुक करें',
  },
  growthPage: {
    title: 'Nayaversse Growth',
    lede: 'जो ग्राहक आना बंद कर चुके हैं उन्हें वापस लाता है, और दिखाता है कि यह काम आया या नहीं। सैलून, क्लिनिक, जिम, दुकान: कोई भी धंधा जिसके पास उन लोगों की सूची है जो पहले आते थे।',
    statusNote: 'बन चुका है और हमारी अपनी मशीनों पर शुरू से आख़िर तक चलता है। अभी कोई धंधा इसे इस्तेमाल नहीं करता, इसलिए यहाँ कुछ भी नतीजा नहीं है। पहले धंधे पायलट होंगे।',
    sectionsBand: 'यह क्या करता है',
    sections: [
      {
        heading: 'जो ग्राहक आना बंद कर चुके हैं',
        body: [
          'आप अपने ग्राहकों की सूची और बुकिंग लाते हैं, फ़ाइल से या सीधे अपने बुकिंग या बिलिंग सॉफ़्टवेयर से। Growth निकालता है कि कौन उतने समय से नहीं आया जितना आप कहें: छह हफ़्ते, तीन महीने।',
          'ऑफ़र आप लिखते हैं। संदेश आपकी भाषा में आपके लिए लिखा जाता है, और सेव होने से पहले जाँचा जाता है: कोई गारंटी नहीं, “शहर में सबसे अच्छा” नहीं, और संदेश बंद करने का तरीक़ा बताने वाली पंक्ति जिसे हटाया नहीं जा सकता।',
        ],
      },
      {
        heading: 'बिना हाँ के किसी को संदेश नहीं',
        body: [
          'ग्राहक को संदेश तभी जा सकता है जब उसने हाँ कही हो, और हाँ कैसे कही यह दर्ज होता है: काउंटर पर, फ़ोन पर, लिखकर, या ख़ुद आपके ऑप्ट-इन पेज पर, जिसका QR कोड काउंटर के लिए अंग्रेज़ी, हिंदी और मराठी में है।',
          'STOP लिखते ही हाँ वापस हो जाती है। आपकी तय सीमा से ज़्यादा बार किसी को संदेश नहीं जाता, सारे कैंपेन मिलाकर, और शांत घंटों में कभी नहीं।',
        ],
      },
      {
        heading: 'मालिक मंज़ूर करता है, तब जाता है',
        body: [
          'कर्मचारी कैंपेन का मसौदा बना सकते हैं। मंज़ूर सिर्फ़ मालिक कर सकता है। फिर वह या तो आपके अपने WhatsApp से जाता है, सूची के हर व्यक्ति के लिए एक टैप, या आपके WhatsApp Business नंबर से अपने आप।',
          'हर व्यक्ति पर पहुँचने और पढ़े जाने के निशान लौटते हैं, और ग्राहक जो जवाब लिखते हैं वह एक जगह जमा होता है।',
        ],
      },
      {
        heading: 'इंप्रेशन नहीं, सबूत',
        body: [
          'बुकिंग किसी कैंपेन की तभी गिनी जाती है जब उसी फ़ोन नंबर ने संदेश मिलने के बाद, आपकी तय अवधि में, बुकिंग की हो। बाक़ी सब “जोड़ा नहीं जा सका” दिखता है, दावा नहीं किया जाता।',
          'बीस या ज़्यादा लोगों के हर कैंपेन में कुछ लोगों को रोककर रखा जाता है और संदेश नहीं भेजा जाता। फिर आप साथ-साथ देखते हैं कि संदेश पाने वालों में से कितने लौटे और रोके गए लोगों में से कितने वैसे ही लौट आए। छोटे समूह को पहला संकेत कहा जाता है, सबूत नहीं।',
          'हर सोमवार मालिक को हफ़्ते की एक रिपोर्ट मिलती है: किसे संदेश गया, कौन लौटा, कितनी कमाई हुई।',
        ],
      },
      {
        heading: 'ऑनलाइन नए ग्राहक ढूँढना',
        body: [
          'किसी प्रोडक्ट या स्टार्टअप के लिए Growth वे सार्वजनिक बातचीत भी पढ़ता है जहाँ लोग वही माँग रहे हैं जो आप बेचते हैं, और हर एक के लिए आपकी आवाज़ में जवाब का मसौदा बनाता है।',
          'वह ख़ुद कभी पोस्ट नहीं करता। हर मसौदा एक इंसान पढ़ता है और अपने खाते से, अपना परिचय देकर, पोस्ट करता है। यह बॉट से धीमा है, और मदद करने और बैन होने के बीच का फ़र्क़ यही है।',
        ],
      },
      {
        heading: 'आपके ग्राहकों की जानकारी',
        body: [
          'ग्राहकों की जानकारी एन्क्रिप्ट करके रखी जाती है। किसी एक ग्राहक के बारे में रखी हर चीज़ आप डाउनलोड कर सकते हैं, या हमेशा के लिए मिटा सकते हैं, उसी स्क्रीन से।',
        ],
      },
      {
        heading: 'यह कहाँ खड़ा है',
        body: [
          'ऊपर लिखा सब बन चुका है और जाँचा जा चुका है। WhatsApp Business सेवा से भेजना और भुगतान लेना अभी असली खातों के साथ नहीं चला है, और किसी धंधे ने इसे असली ग्राहकों के लिए इस्तेमाल नहीं किया है।',
          'इसलिए पहले धंधे पायलट होंगे, हर एक के साथ तय शर्तों पर, और हम पूरे समय उनके साथ बैठेंगे। अगर आप उनमें से एक बनना चाहते हैं तो नीचे बताइए।',
        ],
      },
    ],
    filmHeading: 'वीडियो में',
    filmNote: 'Growth की अभी कोई फ़िल्म नहीं है। एक फ़िल्म असली प्रोडक्ट से, काल्पनिक ग्राहकों पर, रिकॉर्ड हो रही है और बनते ही यहाँ होगी। तब तक डेमो में इसे चलते हुए देखा जा सकता है।',
    action: 'पायलट के बारे में पूछें',
  },
  visionPage: {
    title: 'आगे की योजना',
    lede: 'क्लिनिक के बाद हम क्या बनाना चाहते हैं, और हर हिस्सा कहाँ तक पहुँचा है। नीचे के रिकॉर्ड क्लिनिक प्रोडक्ट के साथ साझा हैं; हर धंधे की स्क्रीन अभी बनी नहीं हैं।',
    note: 'इस पेज पर कुछ भी बिक्री के लिए नहीं है, जब तक उसकी पंक्ति पर “चालू” न लिखा हो। यहाँ की कीमतें वे हैं जो हम लेने की सोचते हैं, ताकि आप अंदाज़ा लगा सकें, और किसी पंक्ति पर जो पहले आता है वही उसे आकार देता है।',
  },
  seo: {
    clinic: {
      title: 'Nayaversse Clinic: क्लिनिक मैनेजमेंट सॉफ़्टवेयर, सांगली में चालू',
      description: 'क्लिनिक सॉफ़्टवेयर जो आज सांगली के एक क्लिनिक में चल रहा है: कतार, मरीज़ों के रिकॉर्ड, प्रिस्क्रिप्शन, बिलिंग, दवा का स्टॉक और क्लिनिक की अपनी वेबसाइट। वीडियो में देखिए।',
    },
    growth: {
      title: 'Nayaversse Growth: WhatsApp पर पुराने ग्राहक वापस, सबूत के साथ',
      description: 'आना बंद कर चुके ग्राहकों को उनकी सहमति और मालिक की मंज़ूरी से वापस लाता है, और दिखाता है कितने लौटे। बन चुका है; अभी कोई धंधा इस्तेमाल नहीं करता।',
    },
    vision: {
      title: 'आगे की योजना: Nayaversse आगे क्या बना रहा है',
      description: 'दुकान, सैलून, जिम, रेस्टोरेंट और बाक़ी, एक ही रिकॉर्ड पर। हर पंक्ति पर उसकी असली स्थिति: एक चालू है, बाक़ी बन रहे हैं या योजना में नहीं हैं।',
    },
  },
};

const mr: ProductsCopy = {
  nav: { clinic: 'क्लिनिक', growth: 'ग्रोथ', vision: 'पुढची योजना' },
  status: { built: 'तयार', trial: 'चाचणीत', planned: 'योजनेत' },
  hero: {
    route: ['रांग', 'रुग्णाची फाइल', 'प्रिस्क्रिप्शन', 'बिलिंग', 'स्टॉक', 'क्लिनिकची वेबसाइट'],
    headline: ['क्लिनिकच्या', 'पूर्ण दिवसाचं', 'सॉफ्टवेअर'],
    lede:
      'Nayaversse Clinic आज सांगलीतल्या एका क्लिनिकमध्ये चालू आहे: रांग, रुग्णाची फाइल, प्रिस्क्रिप्शन, बिलिंग, स्टॉक आणि क्लिनिकची स्वतःची वेबसाइट. Nayaversse Growth, जे यायचं थांबलेल्या ग्राहकांना परत आणतं, तयार आहे आणि पहिल्या धंद्याची वाट पाहत आहे. यानंतर जे बनवायचं आहे ते “पुढची योजना” पानावर आहे, आणि ते अजून बनलेलं नाही असं तिथे स्पष्ट लिहिलं आहे.',
    clinicNote: 'सांगलीतल्या एका क्लिनिकमध्ये रोज चालू आहे',
    growthNote: 'तयार. अजून कोणताही धंदा वापरत नाही',
    visionNote: 'दुकान, सलून, जिम, खाद्य. अजून बनलेलं नाही',
    action: 'डेमो ठरवा',
    secondary: 'क्लिनिक सॉफ्टवेअर पाहा',
  },
  lineup: {
    bandTitle: 'प्रॉडक्ट',
    band: 'एक सुरू · एक तयार · बाकी योजनेत',
    heading: 'आम्ही काय बनवतो',
    lede: 'दोन प्रॉडक्ट, आणि प्रत्येकावर त्याची खरी स्थिती लिहिली आहे. तिसरी यादी, पुढची योजना, यानंतरची आहे आणि विक्रीसाठी नाही.',
    clinic: {
      name: 'Nayaversse Clinic',
      forWhom: 'डॉक्टरचं क्लिनिक, पॉलिक्लिनिक किंवा लहान रुग्णालयासाठी.',
      body: 'क्लिनिकचा पूर्ण दिवस एका ठिकाणी, पहिल्या टोकनपासून दिवसाच्या हिशोबापर्यंत.',
      points: [
        'रांग जी इमर्जन्सी, गरोदर, ज्येष्ठ आणि लहान मुलांना आपोआप पुढे ठेवते',
        'रुग्णाची फाइल, केस शीट आणि 2,46,000 भारतीय औषधांच्या यादीतून प्रिस्क्रिप्शन',
        'रोख, UPI आणि कार्डमध्ये बिलिंग, औषधांचा स्टॉक, लॅब ऑर्डर आणि दिवसाचा हिशोब',
        'क्लिनिकची स्वतःची वेबसाइट, बारा भारतीय भाषांपर्यंत',
      ],
      stands: 'ऑक्टोबर 2026 पासून वाळवा, सांगली इथल्या वडगांवकर क्लिनिकमध्ये चालू आहे.',
      link: 'Clinic बद्दल सगळं',
    },
    growth: {
      name: 'Nayaversse Growth',
      forWhom: 'कोणत्याही स्थानिक धंद्यासाठी, ज्याचे ग्राहक आधी यायचे.',
      body: 'यायचं थांबलेले ग्राहक शोधतं, मालकाच्या मंजुरीने त्यांना WhatsApp वर लिहितं, आणि किती परत आले ते दाखवतं.',
      points: [
        'ग्राहकाने होकार दिल्याशिवाय त्याला संदेश जात नाही, आणि तो होकार नोंदलेला राहतो',
        'प्रत्येक कॅम्पेन पाठवण्याआधी मालक मंजूर करतो',
        'काही लोकांना मुद्दाम संदेश पाठवला जात नाही, म्हणजे संदेशामुळे काय बदललं ते दिसतं',
        'बुकिंग तेव्हाच मोजली जाते जेव्हा ती एखाद्या संदेशाशी जोडता येते',
      ],
      stands: 'तयार आहे आणि सुरुवातीपासून शेवटपर्यंत चालतं. अजून कोणताही धंदा ते वापरत नाही.',
      link: 'Growth बद्दल सगळं',
    },
    vision: {
      name: 'पुढची योजना',
      body: 'दुकान, सलून, जिम, रेस्टॉरंट आणि बाकी, क्लिनिकच्याच नोंदींवर. या धंद्यांसाठी अजून काही बनलेलं नाही, आणि पानावर प्रत्येक ओळ तेच सांगते.',
      link: 'योजना वाचा',
    },
  },
  film: {
    bandTitle: 'व्हिडिओमध्ये',
    band: 'खऱ्या प्रॉडक्टमधून रेकॉर्ड केलेलं · प्रत्येक रुग्ण काल्पनिक आहे',
    play: 'चालू करा',
    sound: 'आवाजासह चालतं',
    clinicHeading: 'क्लिनिक सॉफ्टवेअर, चार मिनिटांत',
    clinicLede: 'कागदावरची सकाळची गर्दी, आणि मग तीच सकाळ खऱ्या स्क्रीनवर: रिसेप्शन, डॉक्टर, फार्मसी, काउंटर.',
    assistantHeading: 'क्लिनिकचा असिस्टंट, एक-एक फीचर',
    assistantLede:
      'क्लिनिक सॉफ्टवेअरच्या आत एक असिस्टंट. काय हवं ते बोला किंवा टाइप करा. त्याने काय समजलं ते तो दाखवतो, आणि हो म्हणेपर्यंत काहीही सेव्ह करत नाही.',
    trialNote: 'असिस्टंट तयार आहे आणि चाचणीत आहे. अजून पैसे देणाऱ्या कोणत्याही क्लिनिकमध्ये सुरू केलेला नाही, म्हणून त्यावर “सुरू” चा शिक्का नाही.',
    items: {
      whole: { title: 'पूर्ण फिल्म', detail: 'क्लिनिकमधलं दिवसभराचं टायपिंग, आणि असिस्टंट त्याबद्दल करतो त्या पाच गोष्टी.' },
      say: { title: 'फक्त बोला', detail: 'एकदा दाबा आणि तो ऐकतो. रुग्णाची नोंद बोलून होते, चूक एका वाक्यात दुरुस्त होते, आणि डॉक्टर हो म्हणेपर्यंत काहीही सेव्ह होत नाही.' },
      language: { title: 'कोणतीही भाषा', detail: 'इंग्रजी, हिंदी किंवा मराठी, लोक काउंटरवर जसं मिसळून बोलतात तसं.' },
      yes: { title: 'एक वाक्य, एक हो', detail: 'पेमेंट एका वाक्यात. कोणी खात्री केल्यावरच बिल बदलतं.' },
      limits: { title: 'प्रत्येकाची स्वतःची मर्यादा', detail: 'प्रत्येक लॉगिन तेवढंच करू शकतं जेवढी त्या व्यक्तीला परवानगी आहे. फार्मासिस्ट पेमेंट घेऊ शकत नाही.' },
      room: { title: 'डॉक्टरच्या खोलीत', detail: 'तो रुग्णाशी झालेलं बोलणं ऐकतो आणि नोट, औषधं, तपासण्या आणि पुढच्या तारखेचा मसुदा बनवतो, जो डॉक्टर तपासतो.' },
    },
    honesty:
      'तो चुकीचं ऐकू शकतो, बहुतेकदा एखादं नाव किंवा आकडा. म्हणूनच तो आधी दाखवतो की काय समजलं, आणि हो म्हटल्याशिवाय काहीही सेव्ह करत नाही. बोलण्याचा आवाज लिहून काढण्यासाठी एका स्पीच सेवेकडे पाठवला जातो, आणि रेकॉर्डिंग ठेवलं जात नाही.',
    englishOnly: 'या फिल्म्सचं निवेदन इंग्रजीत आहे.',
  },
  queue: {
    heading: 'रांग जी स्वतः क्रम लावते',
    lede: 'सुरू असलेल्या प्रॉडक्टचा स्वतःचा क्रम, नमुन्याच्या ओळींवर. इमर्जन्सी आल्यावर काय होतं ते पाहा.',
  },
  clinicPage: {
    title: 'Nayaversse Clinic',
    lede: 'क्लिनिक सॉफ्टवेअर जे आज चालू आहे. रांग, रुग्णाची फाइल, प्रिस्क्रिप्शन, बिलिंग, औषधांचा स्टॉक आणि क्लिनिकची स्वतःची वेबसाइट, एकाच सिस्टिममध्ये जी रिसेप्शन दोन रुग्णांच्या मध्ये वापरू शकेल.',
    liveNote: 'ऑक्टोबर 2026 पासून वाळवा, सांगली इथल्या वडगांवकर क्लिनिकमध्ये चालू आहे: एक डॉक्टर आणि दोन कर्मचारी यावरच बुकिंग, प्रिस्क्रिप्शन, बिलिंग आणि दिवसाचा हिशोब करतात.',
    getsHeading: 'क्लिनिकला काय मिळतं',
    demoHeading: 'डेमो क्लिनिकवर पाहा',
    demoBody: 'डेमो वीस मिनिटांचा आहे, तुमची स्क्रीन आणि माझी, एका डेमो क्लिनिकवर जिथे प्रत्येक रुग्ण काल्पनिक आहे. कोणता वर्ग पाहायचा ते सांगा: क्लिनिक, पॉलिक्लिनिक किंवा रुग्णालय.',
    action: 'डेमो ठरवा',
  },
  growthPage: {
    title: 'Nayaversse Growth',
    lede: 'यायचं थांबलेल्या ग्राहकांना परत आणतं, आणि ते कामी आलं की नाही ते दाखवतं. सलून, क्लिनिक, जिम, दुकान: कोणताही धंदा ज्याच्याकडे आधी येणाऱ्या लोकांची यादी आहे.',
    statusNote: 'तयार आहे आणि आमच्या स्वतःच्या मशीनवर सुरुवातीपासून शेवटपर्यंत चालतं. अजून कोणताही धंदा ते वापरत नाही, म्हणून इथे काहीही निकाल नाही. पहिले धंदे पायलट असतील.',
    sectionsBand: 'हे काय करतं',
    sections: [
      {
        heading: 'यायचं थांबलेले ग्राहक',
        body: [
          'तुम्ही तुमच्या ग्राहकांची यादी आणि बुकिंग आणता, फाइलमधून किंवा थेट तुमच्या बुकिंग किंवा बिलिंग सॉफ्टवेअरमधून. Growth शोधून काढतं की तुम्ही सांगाल तेवढ्या काळात कोण आलेलं नाही: सहा आठवडे, तीन महिने.',
          'ऑफर तुम्ही लिहिता. संदेश तुमच्या भाषेत तुमच्यासाठी लिहिला जातो, आणि सेव्ह होण्याआधी तपासला जातो: कोणतीही हमी नाही, “शहरात सर्वोत्तम” नाही, आणि संदेश थांबवण्याची पद्धत सांगणारी ओळ जी काढता येत नाही.',
        ],
      },
      {
        heading: 'होकाराशिवाय कोणालाही संदेश नाही',
        body: [
          'ग्राहकाला संदेश तेव्हाच जाऊ शकतो जेव्हा त्याने होकार दिला आहे, आणि तो कसा दिला हे नोंदलं जातं: काउंटरवर, फोनवर, लिहून, किंवा स्वतः तुमच्या ऑप्ट-इन पानावर, ज्याचा QR कोड काउंटरसाठी इंग्रजी, हिंदी आणि मराठीत आहे.',
          'STOP लिहिताच होकार मागे घेतला जातो. तुम्ही ठरवलेल्या मर्यादेपेक्षा जास्त वेळा कोणालाही संदेश जात नाही, सगळे कॅम्पेन मिळून, आणि शांततेच्या तासांत कधीच नाही.',
        ],
      },
      {
        heading: 'मालक मंजूर करतो, मग जातं',
        body: [
          'कर्मचारी कॅम्पेनचा मसुदा बनवू शकतात. मंजूर फक्त मालक करू शकतो. मग ते एकतर तुमच्या स्वतःच्या WhatsApp वरून जातं, यादीतल्या प्रत्येक व्यक्तीसाठी एक टॅप, किंवा तुमच्या WhatsApp Business नंबरवरून आपोआप.',
          'प्रत्येक व्यक्तीवर पोहोचल्याच्या आणि वाचल्याच्या खुणा परत येतात, आणि ग्राहक जे उत्तर लिहितात ते एका ठिकाणी जमा होतं.',
        ],
      },
      {
        heading: 'इम्प्रेशन नाही, पुरावा',
        body: [
          'बुकिंग एखाद्या कॅम्पेनची तेव्हाच मोजली जाते जेव्हा त्याच फोन नंबरने संदेश मिळाल्यानंतर, तुम्ही ठरवलेल्या मुदतीत, बुकिंग केली आहे. बाकी सगळं “जोडता आलं नाही” असं दिसतं, त्यावर दावा केला जात नाही.',
          'वीस किंवा जास्त लोकांच्या प्रत्येक कॅम्पेनमध्ये काही लोकांना बाजूला ठेवलं जातं आणि संदेश पाठवला जात नाही. मग तुम्ही शेजारी-शेजारी पाहता की संदेश मिळालेल्यांपैकी किती परत आले आणि बाजूला ठेवलेल्यांपैकी किती तसेच परत आले. लहान गटाला पहिली खूण म्हटलं जातं, पुरावा नाही.',
          'दर सोमवारी मालकाला आठवड्याचा एक अहवाल मिळतो: कोणाला संदेश गेला, कोण परत आलं, किती कमाई झाली.',
        ],
      },
      {
        heading: 'ऑनलाइन नवे ग्राहक शोधणं',
        body: [
          'एखाद्या प्रॉडक्ट किंवा स्टार्टअपसाठी Growth त्या सार्वजनिक चर्चाही वाचतं जिथे लोक तुम्ही विकता तेच मागत आहेत, आणि प्रत्येकासाठी तुमच्या आवाजात उत्तराचा मसुदा बनवतं.',
          'ते स्वतः कधीच पोस्ट करत नाही. प्रत्येक मसुदा एक माणूस वाचतो आणि स्वतःच्या खात्यावरून, स्वतःची ओळख सांगून, पोस्ट करतो. हे बॉटपेक्षा हळू आहे, आणि मदत करणं आणि बॅन होणं यातला फरक हाच आहे.',
        ],
      },
      {
        heading: 'तुमच्या ग्राहकांची माहिती',
        body: [
          'ग्राहकांची माहिती एन्क्रिप्ट करून ठेवली जाते. एखाद्या ग्राहकाबद्दल ठेवलेलं सगळं तुम्ही डाउनलोड करू शकता, किंवा कायमचं पुसू शकता, त्याच स्क्रीनवरून.',
        ],
      },
      {
        heading: 'हे कुठे उभं आहे',
        body: [
          'वर लिहिलेलं सगळं तयार आहे आणि तपासलेलं आहे. WhatsApp Business सेवेतून पाठवणं आणि पेमेंट घेणं अजून खऱ्या खात्यांसह चाललेलं नाही, आणि कोणत्याही धंद्याने ते खऱ्या ग्राहकांसाठी वापरलेलं नाही.',
          'म्हणून पहिले धंदे पायलट असतील, प्रत्येकाशी ठरलेल्या अटींवर, आणि आम्ही पूर्ण वेळ त्यांच्यासोबत बसू. तुम्हाला त्यातला एक व्हायचं असेल तर खाली सांगा.',
        ],
      },
    ],
    filmHeading: 'व्हिडिओमध्ये',
    filmNote: 'Growth ची अजून फिल्म नाही. एक फिल्म खऱ्या प्रॉडक्टमधून, काल्पनिक ग्राहकांवर, रेकॉर्ड होत आहे आणि तयार झाल्यावर इथे असेल. तोपर्यंत डेमोमध्ये ते चालताना पाहता येतं.',
    action: 'पायलटबद्दल विचारा',
  },
  visionPage: {
    title: 'पुढची योजना',
    lede: 'क्लिनिकनंतर आम्हाला काय बनवायचं आहे, आणि प्रत्येक भाग कुठपर्यंत आला आहे. खालच्या नोंदी क्लिनिक प्रॉडक्टसोबत सामायिक आहेत; प्रत्येक धंद्याच्या स्क्रीन अजून बनलेल्या नाहीत.',
    note: 'या पानावर काहीही विक्रीसाठी नाही, जोपर्यंत त्याच्या ओळीवर “सुरू” लिहिलेलं नाही. इथल्या किमती आम्ही घ्यायचा विचार करतो त्या आहेत, तुम्हाला अंदाज यावा म्हणून, आणि एखाद्या ओळीवर जो पहिला येतो तोच तिला आकार देतो.',
  },
  seo: {
    clinic: {
      title: 'Nayaversse Clinic: क्लिनिक व्यवस्थापन सॉफ्टवेअर, सांगलीत सुरू',
      description: 'क्लिनिक सॉफ्टवेअर जे आज सांगलीतल्या एका क्लिनिकमध्ये चालू आहे: रांग, रुग्णांच्या नोंदी, प्रिस्क्रिप्शन, बिलिंग, औषधांचा स्टॉक आणि क्लिनिकची स्वतःची वेबसाइट. व्हिडिओमध्ये पाहा.',
    },
    growth: {
      title: 'Nayaversse Growth: WhatsApp वर जुने ग्राहक परत, पुराव्यासह',
      description: 'यायचं थांबलेल्या ग्राहकांना त्यांच्या संमतीने आणि मालकाच्या मंजुरीने परत आणतं, आणि किती परत आले ते दाखवतं. तयार आहे; अजून कोणताही धंदा वापरत नाही.',
    },
    vision: {
      title: 'पुढची योजना: Nayaversse पुढे काय बनवत आहे',
      description: 'दुकान, सलून, जिम, रेस्टॉरंट आणि बाकी, एकाच नोंदींवर. प्रत्येक ओळीवर तिची खरी स्थिती: एक सुरू आहे, बाकी तयार होत आहेत किंवा योजनेत नाहीत.',
    },
  },
};

export const productsCopy: Record<Locale, ProductsCopy> = { en, hi, mr };
