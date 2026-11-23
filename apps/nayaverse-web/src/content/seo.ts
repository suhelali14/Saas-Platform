/**
 * The <title> each page carries in search results, per language.
 *
 * Kept apart from the page copy on purpose. The heading a visitor reads on
 * the page ("For clinics") is written for someone already here; the title in
 * a results list is written for someone deciding whether to come, and has to
 * carry the words they typed ("clinic management software"). In Hindi and
 * Marathi those are the words people actually search in, which is the whole
 * reason the site exists in three languages.
 *
 * Rules: say what the page is, name the product, no claim the page does not
 * back up, and stay near 60 characters so the results page does not cut it.
 * A page left out here falls back to its heading plus the brand.
 */
import type { Locale, Page } from './index';

export const searchTitles: Record<Locale, Partial<Record<Page, string>>> = {
  en: {
    home: 'Nayaversse: Clinic and Business Software, Built in India',
    pricing: 'Pricing: Clinic and Business Software Plans | Nayaversse',
    about: 'About Nayaversse: Business Software Built in India',
    founder: 'Suhel Ali Pakjade, Founder of Nayaversse',
    features: 'Features: Queue, Prescriptions, Billing, Stock | Nayaversse',
    security: 'Patient Data Security, DPDP and Audit Logs | Nayaversse',
    'why-nayaversse': 'Why Nayaversse: One Product, Not Six Subscriptions',
    'for-clinics': 'Clinic Management Software for Indian Clinics | Nayaversse',
    'for-polyclinics': 'Polyclinic Management Software | Nayaversse',
    'for-hospitals': 'Hospital Management Software for Small Hospitals | Nayaversse',
    'for-multi-specialty': 'Multi-Specialty Clinic Software | Nayaversse',
    stories: 'Clinics Running on Nayaversse | Stories',
    blog: 'Notes on Building Clinic Software in India | Nayaversse',
  },
  hi: {
    home: 'Nayaversse: क्लिनिक और बिज़नेस सॉफ्टवेयर, भारत में बना',
    pricing: 'कीमत: क्लिनिक और बिज़नेस सॉफ्टवेयर के प्लान | Nayaversse',
    about: 'नयावर्स के बारे में: भारत में बना बिज़नेस सॉफ्टवेयर',
    founder: 'Suhel Ali Pakjade: नयावर्स के संस्थापक',
    features: 'फ़ीचर: कतार, प्रिस्क्रिप्शन, बिलिंग, स्टॉक | Nayaversse',
    security: 'मरीज़ों के डेटा की सुरक्षा, DPDP और ऑडिट लॉग | Nayaversse',
    'why-nayaversse': 'नयावर्स क्यों: छह सब्सक्रिप्शन नहीं, एक प्रोडक्ट',
    'for-clinics': 'क्लिनिक मैनेजमेंट सॉफ्टवेयर | Nayaversse',
    'for-polyclinics': 'पॉलीक्लिनिक मैनेजमेंट सॉफ्टवेयर | Nayaversse',
    'for-hospitals': 'छोटे अस्पतालों के लिए हॉस्पिटल मैनेजमेंट सॉफ्टवेयर | Nayaversse',
    'for-multi-specialty': 'मल्टी-स्पेशलिटी क्लिनिक सॉफ्टवेयर | Nayaversse',
    stories: 'Nayaversse पर चल रहे क्लिनिक | कहानियाँ',
    blog: 'भारत में क्लिनिक सॉफ्टवेयर बनाने पर नोट्स | Nayaversse',
  },
  mr: {
    home: 'Nayaversse: क्लिनिक आणि व्यवसायासाठी सॉफ्टवेअर, भारतात बनलेलं',
    pricing: 'किंमत: क्लिनिक आणि व्यवसाय सॉफ्टवेअरचे प्लॅन | Nayaversse',
    about: 'नयावर्सबद्दल: भारतात बनलेलं व्यवसाय सॉफ्टवेअर',
    founder: 'Suhel Ali Pakjade: नयावर्सचे संस्थापक',
    features: 'फीचर्स: रांग, प्रिस्क्रिप्शन, बिलिंग, स्टॉक | Nayaversse',
    security: 'रुग्णांच्या डेटाची सुरक्षा, DPDP आणि ऑडिट लॉग | Nayaversse',
    'why-nayaversse': 'नयावर्स का: सहा सबस्क्रिप्शन नाही, एकच प्रोडक्ट',
    'for-clinics': 'क्लिनिक व्यवस्थापन सॉफ्टवेअर | Nayaversse',
    'for-polyclinics': 'पॉलिक्लिनिक व्यवस्थापन सॉफ्टवेअर | Nayaversse',
    'for-hospitals': 'लहान रुग्णालयांसाठी हॉस्पिटल मॅनेजमेंट सॉफ्टवेअर | Nayaversse',
    'for-multi-specialty': 'मल्टि-स्पेशालिटी क्लिनिक सॉफ्टवेअर | Nayaversse',
    stories: 'Nayaversse वर चालणारी क्लिनिक | कहाण्या',
    blog: 'भारतात क्लिनिक सॉफ्टवेअर बनवतानाच्या नोंदी | Nayaversse',
  },
};
