/**
 * The words for the home page as a page about Nayaversse, the company.
 *
 * The home page introduces who makes this, shows its two products at work
 * on film, and then says plainly who stands behind them: the clinic that
 * runs on it, the person who builds it, and the things a buyer can check.
 * Those three are the only trust this company has to offer, so they are
 * stated as facts and nothing is added to them: no customer count, no
 * testimonial, no logo wall, no percentage (see en.ts for the rules).
 *
 * The clinic is named because its pages on this site already name it, and
 * the owner confirmed it for the home page on 2026-11-25. A reader who
 * wants to speak to the clinic is told the truth: we ask the doctor first.
 */
import type { Locale } from './index';

export interface HomeCopy {
  hero: { route: string[]; headline: string[]; lede: string };
  screening: {
    heading: string;
    lede: string;
    /** The switch between the two films. */
    switchLabel: string;
    recorded: string;
    englishOnly: string;
    visionLine: string;
  };
  standing: {
    bandTitle: string;
    band: string;
    heading: string;
    lede: string;
    clinic: { label: string; name: string; place: string; lines: string[]; ask: string };
    founder: { label: string; name: string; lines: string[]; call: string; more: string };
    checks: { label: string; lines: string[]; more: string };
  };
}

const en: HomeCopy = {
  hero: {
    route: ['Made in Sangli', 'One founder', 'No outside money'],
    headline: ['Software a', 'business runs', 'its day on'],
    lede:
      'Nayaversse is a small software company from Sangli. Our first product runs a clinic there every working day. Our second brings back the customers a business has lost. Both are on film below, recorded from the real thing.',
  },
  screening: {
    heading: 'See them work',
    lede: 'Two products, two films. Nothing here is a mock-up: each film was recorded from the product itself, on made-up people.',
    switchLabel: 'Which film',
    recorded: 'Recorded from the product',
    englishOnly: 'Narrated in English',
    visionLine: 'After these two: shops, salons, gyms and food, on the same records. None of it is built yet.',
  },
  standing: {
    bandTitle: 'Particulars',
    band: 'Three things you can check before you call',
    heading: 'Who stands behind it',
    lede: 'We have one customer, so there is no wall of logos to show you. There is a clinic you can ask about, a person you can call, and a few facts you can verify.',
    clinic: {
      label: 'The clinic that runs on it',
      name: 'Vadgaonkar Clinic',
      place: 'Walwa, Sangli district',
      lines: [
        'Dr Asif Momin and two staff',
        'Every working day since October 2026',
        'Their queue, records, prescriptions, billing and website',
      ],
      ask: 'Want to speak to them? Say so when you enquire. We ask Dr Momin first, and the answer is his to give.',
    },
    founder: {
      label: 'The person who builds it',
      name: 'Suhelali Pakjade',
      lines: [
        'Writes it, deploys it and supports it',
        'From Sangli, working in Bengaluru',
        'The same person answers the phone',
      ],
      call: 'Call or WhatsApp',
      more: 'About the founder',
    },
    checks: {
      label: 'What you can verify',
      lines: [
        'Each clinic has its own database, never a shared one',
        'Every look at a patient record is logged, and the log cannot be edited',
        'Your records export in full from the first day',
        'No investor decides what gets built',
      ],
      more: 'Security and data',
    },
  },
};

const hi: HomeCopy = {
  hero: {
    route: ['सांगली में बना', 'एक संस्थापक', 'बाहर का पैसा नहीं'],
    headline: ['वह सॉफ़्टवेयर', 'जिस पर धंधा', 'दिन भर चलता है'],
    lede:
      'Nayaversse सांगली की एक छोटी सॉफ़्टवेयर कंपनी है। हमारा पहला प्रोडक्ट वहाँ के एक क्लिनिक को हर कामकाजी दिन चलाता है। दूसरा उन ग्राहकों को वापस लाता है जो धंधे से छूट गए। दोनों नीचे वीडियो में हैं, असली प्रोडक्ट से रिकॉर्ड किए हुए।',
  },
  screening: {
    heading: 'इन्हें काम करते देखिए',
    lede: 'दो प्रोडक्ट, दो फ़िल्में। यहाँ कुछ भी नक़ली नहीं है: हर फ़िल्म ख़ुद प्रोडक्ट से रिकॉर्ड की गई है, काल्पनिक लोगों पर।',
    switchLabel: 'कौन-सी फ़िल्म',
    recorded: 'प्रोडक्ट से रिकॉर्ड किया गया',
    englishOnly: 'आवाज़ अंग्रेज़ी में',
    visionLine: 'इन दोनों के बाद: दुकान, सैलून, जिम और खाना-पीना, उन्हीं रिकॉर्ड पर। इनमें से अभी कुछ बना नहीं है।',
  },
  standing: {
    bandTitle: 'ब्योरा',
    band: 'तीन बातें जो आप फ़ोन करने से पहले जाँच सकते हैं',
    heading: 'इसके पीछे कौन खड़ा है',
    lede: 'हमारा एक ही ग्राहक है, इसलिए दिखाने को लोगो की दीवार नहीं है। एक क्लिनिक है जिसके बारे में आप पूछ सकते हैं, एक इंसान है जिसे फ़ोन कर सकते हैं, और कुछ तथ्य हैं जो आप ख़ुद जाँच सकते हैं।',
    clinic: {
      label: 'जो क्लिनिक इस पर चलता है',
      name: 'वडगांवकर क्लिनिक',
      place: 'वालवा, सांगली ज़िला',
      lines: [
        'डॉ. आसिफ़ मोमिन और दो स्टाफ़',
        'अक्टूबर 2026 से हर कामकाजी दिन',
        'उनकी कतार, रिकॉर्ड, प्रिस्क्रिप्शन, बिलिंग और वेबसाइट',
      ],
      ask: 'उनसे बात करना चाहते हैं? पूछताछ करते समय बता दीजिए। हम पहले डॉ. मोमिन से पूछते हैं, और जवाब देना उन्हीं का हक़ है।',
    },
    founder: {
      label: 'जो इंसान इसे बनाता है',
      name: 'Suhelali Pakjade',
      lines: [
        'ख़ुद लिखता है, चालू करता है और सपोर्ट देता है',
        'सांगली से, बेंगलुरु में काम करता है',
        'फ़ोन भी वही उठाता है',
      ],
      call: 'फ़ोन या WhatsApp',
      more: 'संस्थापक के बारे में',
    },
    checks: {
      label: 'जो आप जाँच सकते हैं',
      lines: [
        'हर क्लिनिक का अपना डेटाबेस, कभी साझा नहीं',
        'मरीज़ के रिकॉर्ड को हर बार देखना दर्ज होता है, और वह दर्ज बदली नहीं जा सकती',
        'आपके रिकॉर्ड पहले दिन से पूरे निकाले जा सकते हैं',
        'क्या बनेगा यह कोई निवेशक तय नहीं करता',
      ],
      more: 'सुरक्षा और डेटा',
    },
  },
};

const mr: HomeCopy = {
  hero: {
    route: ['सांगलीत बनलेलं', 'एक संस्थापक', 'बाहेरचा पैसा नाही'],
    headline: ['ते सॉफ्टवेअर', 'ज्यावर धंदा', 'दिवसभर चालतो'],
    lede:
      'Nayaversse ही सांगलीतली एक छोटी सॉफ्टवेअर कंपनी आहे. आमचं पहिलं प्रॉडक्ट तिथलं एक क्लिनिक रोज चालवतं. दुसरं धंद्यापासून तुटलेल्या ग्राहकांना परत आणतं. दोन्ही खाली व्हिडिओमध्ये आहेत, खऱ्या प्रॉडक्टमधून रेकॉर्ड केलेले.',
  },
  screening: {
    heading: 'त्यांना काम करताना पाहा',
    lede: 'दोन प्रॉडक्ट, दोन फिल्म्स. इथे काहीही बनावट नाही: प्रत्येक फिल्म स्वतः प्रॉडक्टमधून रेकॉर्ड केली आहे, काल्पनिक लोकांवर.',
    switchLabel: 'कोणती फिल्म',
    recorded: 'प्रॉडक्टमधून रेकॉर्ड केलेलं',
    englishOnly: 'निवेदन इंग्रजीत',
    visionLine: 'या दोघांनंतर: दुकान, सलून, जिम आणि खाद्य, त्याच नोंदींवर. यातलं अजून काहीही बनलेलं नाही.',
  },
  standing: {
    bandTitle: 'तपशील',
    band: 'फोन करण्याआधी तपासता येतील अशा तीन गोष्टी',
    heading: 'यामागे कोण उभं आहे',
    lede: 'आमचा एकच ग्राहक आहे, म्हणून दाखवायला लोगोंची भिंत नाही. एक क्लिनिक आहे ज्याबद्दल तुम्ही विचारू शकता, एक माणूस आहे ज्याला फोन करू शकता, आणि काही गोष्टी आहेत ज्या तुम्ही स्वतः तपासू शकता.',
    clinic: {
      label: 'यावर चालणारं क्लिनिक',
      name: 'वडगांवकर क्लिनिक',
      place: 'वाळवा, सांगली जिल्हा',
      lines: [
        'डॉ. आसिफ मोमीन आणि दोन स्टाफ',
        'ऑक्टोबर 2026 पासून रोज',
        'त्यांची रांग, नोंदी, प्रिस्क्रिप्शन, बिलिंग आणि वेबसाइट',
      ],
      ask: 'त्यांच्याशी बोलायचं आहे? चौकशी करताना सांगा. आम्ही आधी डॉ. मोमीन यांना विचारतो, आणि उत्तर देणं त्यांचाच हक्क आहे.',
    },
    founder: {
      label: 'हे बनवणारा माणूस',
      name: 'Suhelali Pakjade',
      lines: [
        'स्वतः लिहितो, सुरू करतो आणि सपोर्ट देतो',
        'सांगलीचा, बेंगळुरूत काम करतो',
        'फोनही तोच उचलतो',
      ],
      call: 'फोन किंवा WhatsApp',
      more: 'संस्थापकाबद्दल',
    },
    checks: {
      label: 'तुम्ही तपासू शकता',
      lines: [
        'प्रत्येक क्लिनिकचा स्वतःचा डेटाबेस, कधीही सामायिक नाही',
        'रुग्णाची नोंद प्रत्येक वेळी पाहिली की नोंदवली जाते, आणि ती नोंद बदलता येत नाही',
        'तुमच्या नोंदी पहिल्या दिवसापासून पूर्ण काढून घेता येतात',
        'काय बनवायचं हे कोणताही गुंतवणूकदार ठरवत नाही',
      ],
      more: 'सुरक्षा आणि डेटा',
    },
  },
};

export const homeCopy: Record<Locale, HomeCopy> = { en, hi, mr };
