/**
 * Fixed UI strings for the public clinic website, translated by hand.
 *
 * These need no AI and cost nothing to render: they are a closed set of
 * labels that never change per clinic, so they are written out once per
 * language and are correct by construction. Only the clinic's *own* prose
 * -- tagline, about text, services, FAQs, articles -- needs a translator,
 * machine or human.
 *
 * A missing key falls back to English rather than rendering blank, so a
 * language added later shows a partly-English page instead of a broken one.
 */

export type Locale = 'en' | 'hi' | 'mr' | 'bn' | 'te' | 'ta' | 'gu' | 'kn' | 'ml' | 'pa' | 'or' | 'ur' | 'as';

export interface LocaleMeta { code: Locale; englishName: string; nativeName: string; rtl?: boolean }

export const LOCALES: LocaleMeta[] = [
  { code: 'en', englishName: 'English', nativeName: 'English' },
  { code: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'mr', englishName: 'Marathi', nativeName: 'मराठी' },
  { code: 'bn', englishName: 'Bengali', nativeName: 'বাংলা' },
  { code: 'te', englishName: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ta', englishName: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'gu', englishName: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'kn', englishName: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', englishName: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'pa', englishName: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'or', englishName: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  // Urdu is right-to-left; the page flips direction for it.
  { code: 'ur', englishName: 'Urdu', nativeName: 'اردو', rtl: true },
  { code: 'as', englishName: 'Assamese', nativeName: 'অসমীয়া' },
];

export function localeMeta(code: string): LocaleMeta {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0]!;
}

type StringKey =
  | 'callClinic' | 'bookAppointment' | 'checkLiveQueue' | 'openingHours' | 'closed'
  | 'closedToday' | 'openNow' | 'opensAt' | 'until' | 'today' | 'emergency'
  | 'about' | 'services' | 'whatWeTreat' | 'whyUs' | 'whatMakesUsDifferent'
  | 'ourTeam' | 'meetDoctor' | 'meetDoctors' | 'yearsExperience' | 'speaks'
  | 'ourClinic' | 'lookInside' | 'healthLibrary' | 'articlesFromDoctors'
  | 'allArticles' | 'questions' | 'faq' | 'visitUs' | 'getInTouch'
  | 'address' | 'phone' | 'email' | 'getDirections' | 'servingSince'
  | 'doctor' | 'doctors' | 'registration' | 'knowBeforeYouGo' | 'queueBlurb'
  | 'viewLiveQueue' | 'yourExperience' | 'tellUsHowWeDid' | 'howWasVisit'
  | 'yourNameOptional' | 'anythingToTell' | 'sendFeedback' | 'sending'
  | 'thankYou' | 'feedbackThanks' | 'feedbackPrivate' | 'chooseRating'
  | 'feedbackFailed' | 'language' | 'loading' | 'notPublished'
  | 'medicalDisclaimer' | 'backToClinic' | 'anonymous';

const en: Record<StringKey, string> = {
  callClinic: 'Call Clinic', bookAppointment: 'Book an Appointment', checkLiveQueue: 'Check Live Queue',
  openingHours: 'Opening Hours', closed: 'Closed', closedToday: 'Closed today', openNow: 'Open now',
  opensAt: 'Closed · opens', until: 'until', today: 'Today', emergency: 'Emergency',
  about: 'About the clinic', services: 'Services', whatWeTreat: 'What we treat',
  whyUs: 'Why patients choose us', whatMakesUsDifferent: 'What makes this clinic different',
  ourTeam: 'Our team', meetDoctor: 'Meet your doctor', meetDoctors: 'Meet our doctors',
  yearsExperience: 'years experience', speaks: 'Speaks', ourClinic: 'Our clinic', lookInside: 'A look inside',
  healthLibrary: 'Health library', articlesFromDoctors: 'Articles from our doctors', allArticles: 'All articles',
  questions: 'Questions', faq: 'Frequently asked', visitUs: 'Visit us', getInTouch: 'Get in touch',
  address: 'Address', phone: 'Phone', email: 'Email', getDirections: 'Get directions',
  servingSince: 'Serving since', doctor: 'Doctor', doctors: 'Doctors', registration: 'Registration',
  knowBeforeYouGo: 'Know before you go',
  queueBlurb: "See how many patients are ahead of you in today's queue, live — so you can wait at home instead of the waiting room.",
  viewLiveQueue: 'View live queue', yourExperience: 'Your experience', tellUsHowWeDid: 'Tell us how we did',
  howWasVisit: 'How was your visit?', yourNameOptional: 'Your name (optional)',
  anythingToTell: "Anything you'd like to tell us?", sendFeedback: 'Send Feedback', sending: 'Sending…',
  thankYou: 'Thank you.', feedbackThanks: 'Your feedback goes straight to the clinic and helps us improve.',
  feedbackPrivate: 'Your feedback is sent privately to the clinic. It is not published on this page unless the clinic specifically chooses to publish it.',
  chooseRating: 'Please choose a rating.', feedbackFailed: 'Could not send your feedback. Please try again.',
  language: 'Language', loading: 'Loading…', notPublished: "This clinic hasn't published its details yet.",
  medicalDisclaimer: 'This article is general health information, not a diagnosis or a treatment plan. Please see a doctor about your own symptoms before acting on anything you read here.',
  backToClinic: 'Back to the clinic', anonymous: 'Anonymous',
};

const hi: Partial<Record<StringKey, string>> = {
  callClinic: 'क्लिनिक को कॉल करें', bookAppointment: 'अपॉइंटमेंट बुक करें', checkLiveQueue: 'लाइव कतार देखें',
  openingHours: 'खुलने का समय', closed: 'बंद', closedToday: 'आज बंद है', openNow: 'अभी खुला है',
  opensAt: 'बंद · खुलेगा', until: 'तक', today: 'आज', emergency: 'आपातकाल',
  about: 'क्लिनिक के बारे में', services: 'सेवाएँ', whatWeTreat: 'हम किन बीमारियों का इलाज करते हैं',
  whyUs: 'मरीज़ हमें क्यों चुनते हैं', whatMakesUsDifferent: 'इस क्लिनिक की खास बात',
  ourTeam: 'हमारी टीम', meetDoctor: 'अपने डॉक्टर से मिलिए', meetDoctors: 'हमारे डॉक्टरों से मिलिए',
  yearsExperience: 'साल का अनुभव', speaks: 'भाषाएँ', ourClinic: 'हमारा क्लिनिक', lookInside: 'एक झलक',
  healthLibrary: 'स्वास्थ्य जानकारी', articlesFromDoctors: 'हमारे डॉक्टरों के लेख', allArticles: 'सभी लेख',
  questions: 'सवाल', faq: 'अक्सर पूछे जाने वाले सवाल', visitUs: 'हमसे मिलें', getInTouch: 'संपर्क करें',
  address: 'पता', phone: 'फ़ोन', email: 'ईमेल', getDirections: 'रास्ता देखें',
  servingSince: 'सेवा में', doctor: 'डॉक्टर', doctors: 'डॉक्टर', registration: 'रजिस्ट्रेशन',
  knowBeforeYouGo: 'आने से पहले जान लें',
  queueBlurb: 'देखिए आज की कतार में आपसे पहले कितने मरीज़ हैं — ताकि आप वेटिंग रूम की जगह घर पर इंतज़ार कर सकें।',
  viewLiveQueue: 'लाइव कतार देखें', yourExperience: 'आपका अनुभव', tellUsHowWeDid: 'बताइए हमारा काम कैसा रहा',
  howWasVisit: 'आपकी विज़िट कैसी रही?', yourNameOptional: 'आपका नाम (वैकल्पिक)',
  anythingToTell: 'कुछ और बताना चाहेंगे?', sendFeedback: 'फ़ीडबैक भेजें', sending: 'भेजा जा रहा है…',
  thankYou: 'धन्यवाद।', feedbackThanks: 'आपका फ़ीडबैक सीधे क्लिनिक तक पहुँचता है और हमें बेहतर बनने में मदद करता है।',
  feedbackPrivate: 'आपका फ़ीडबैक क्लिनिक को निजी तौर पर भेजा जाता है। जब तक क्लिनिक खुद न चाहे, इसे इस पेज पर नहीं दिखाया जाता।',
  chooseRating: 'कृपया रेटिंग चुनें।', feedbackFailed: 'फ़ीडबैक भेजा नहीं जा सका। कृपया दोबारा कोशिश करें।',
  language: 'भाषा', loading: 'लोड हो रहा है…', notPublished: 'इस क्लिनिक ने अभी अपनी जानकारी प्रकाशित नहीं की है।',
  medicalDisclaimer: 'यह लेख सामान्य स्वास्थ्य जानकारी है, कोई निदान या इलाज की सलाह नहीं। अपने लक्षणों के बारे में कुछ भी करने से पहले डॉक्टर से मिलें।',
  backToClinic: 'क्लिनिक पर वापस जाएँ', anonymous: 'गुमनाम',
};

const mr: Partial<Record<StringKey, string>> = {
  callClinic: 'क्लिनिकला फोन करा', bookAppointment: 'अपॉइंटमेंट बुक करा', checkLiveQueue: 'लाईव्ह रांग पाहा',
  openingHours: 'उघडण्याची वेळ', closed: 'बंद', closedToday: 'आज बंद', openNow: 'आता उघडे आहे',
  opensAt: 'बंद · उघडेल', until: 'पर्यंत', today: 'आज', emergency: 'आणीबाणी',
  about: 'क्लिनिकविषयी', services: 'सेवा', whatWeTreat: 'आम्ही कशावर उपचार करतो',
  whyUs: 'रुग्ण आम्हाला का निवडतात', whatMakesUsDifferent: 'या क्लिनिकचे वेगळेपण',
  ourTeam: 'आमची टीम', meetDoctor: 'तुमच्या डॉक्टरांना भेटा', meetDoctors: 'आमच्या डॉक्टरांना भेटा',
  yearsExperience: 'वर्षांचा अनुभव', speaks: 'भाषा', ourClinic: 'आमचे क्लिनिक', lookInside: 'एक झलक',
  healthLibrary: 'आरोग्य माहिती', articlesFromDoctors: 'आमच्या डॉक्टरांचे लेख', allArticles: 'सर्व लेख',
  questions: 'प्रश्न', faq: 'नेहमी विचारले जाणारे प्रश्न', visitUs: 'आम्हाला भेट द्या', getInTouch: 'संपर्क साधा',
  address: 'पत्ता', phone: 'फोन', email: 'ईमेल', getDirections: 'रस्ता पाहा',
  servingSince: 'सेवेत', doctor: 'डॉक्टर', doctors: 'डॉक्टर', registration: 'नोंदणी',
  knowBeforeYouGo: 'येण्यापूर्वी जाणून घ्या',
  queueBlurb: 'आजच्या रांगेत तुमच्या आधी किती रुग्ण आहेत ते पाहा — म्हणजे वेटिंग रूमऐवजी घरीच थांबता येईल.',
  viewLiveQueue: 'लाईव्ह रांग पाहा', yourExperience: 'तुमचा अनुभव', tellUsHowWeDid: 'आमचे काम कसे वाटले सांगा',
  howWasVisit: 'तुमची भेट कशी होती?', yourNameOptional: 'तुमचे नाव (ऐच्छिक)',
  anythingToTell: 'आणखी काही सांगायचे आहे का?', sendFeedback: 'अभिप्राय पाठवा', sending: 'पाठवत आहे…',
  thankYou: 'धन्यवाद.', feedbackThanks: 'तुमचा अभिप्राय थेट क्लिनिकपर्यंत पोहोचतो आणि आम्हाला सुधारण्यास मदत करतो.',
  feedbackPrivate: 'तुमचा अभिप्राय क्लिनिकला खाजगीरित्या पाठवला जातो. क्लिनिकने ठरवल्याशिवाय तो या पानावर दाखवला जात नाही.',
  chooseRating: 'कृपया रेटिंग निवडा.', feedbackFailed: 'अभिप्राय पाठवता आला नाही. कृपया पुन्हा प्रयत्न करा.',
  language: 'भाषा', loading: 'लोड होत आहे…', notPublished: 'या क्लिनिकने अद्याप माहिती प्रकाशित केलेली नाही.',
  medicalDisclaimer: 'हा लेख सर्वसाधारण आरोग्य माहिती आहे, निदान किंवा उपचाराचा सल्ला नाही. तुमच्या लक्षणांबाबत काही करण्यापूर्वी डॉक्टरांचा सल्ला घ्या.',
  backToClinic: 'क्लिनिककडे परत', anonymous: 'निनावी',
};

const gu: Partial<Record<StringKey, string>> = {
  callClinic: 'ક્લિનિકને ફોન કરો', bookAppointment: 'એપોઇન્ટમેન્ટ બુક કરો', checkLiveQueue: 'લાઇવ કતાર જુઓ',
  openingHours: 'ખુલવાનો સમય', closed: 'બંધ', closedToday: 'આજે બંધ', openNow: 'અત્યારે ખુલ્લું છે',
  opensAt: 'બંધ · ખુલશે', until: 'સુધી', today: 'આજે', emergency: 'કટોકટી',
  about: 'ક્લિનિક વિશે', services: 'સેવાઓ', whatWeTreat: 'અમે શેની સારવાર કરીએ છીએ',
  whyUs: 'દર્દીઓ અમને કેમ પસંદ કરે છે', whatMakesUsDifferent: 'આ ક્લિનિકની ખાસિયત',
  ourTeam: 'અમારી ટીમ', meetDoctor: 'તમારા ડૉક્ટરને મળો', meetDoctors: 'અમારા ડૉક્ટરોને મળો',
  yearsExperience: 'વર્ષનો અનુભવ', speaks: 'ભાષાઓ', ourClinic: 'અમારું ક્લિનિક', lookInside: 'એક ઝલક',
  healthLibrary: 'આરોગ્ય માહિતી', articlesFromDoctors: 'અમારા ડૉક્ટરોના લેખ', allArticles: 'બધા લેખ',
  questions: 'પ્રશ્નો', faq: 'વારંવાર પૂછાતા પ્રશ્નો', visitUs: 'અમારી મુલાકાત લો', getInTouch: 'સંપર્ક કરો',
  address: 'સરનામું', phone: 'ફોન', email: 'ઈમેલ', getDirections: 'રસ્તો જુઓ',
  servingSince: 'સેવામાં', doctor: 'ડૉક્ટર', doctors: 'ડૉક્ટરો', registration: 'નોંધણી',
  knowBeforeYouGo: 'આવતા પહેલાં જાણી લો',
  queueBlurb: 'આજની કતારમાં તમારી પહેલાં કેટલા દર્દી છે તે જુઓ — જેથી વેઇટિંગ રૂમને બદલે ઘરે રાહ જોઈ શકો.',
  viewLiveQueue: 'લાઇવ કતાર જુઓ', yourExperience: 'તમારો અનુભવ', tellUsHowWeDid: 'અમારું કામ કેવું રહ્યું જણાવો',
  howWasVisit: 'તમારી મુલાકાત કેવી રહી?', yourNameOptional: 'તમારું નામ (વૈકલ્પિક)',
  anythingToTell: 'બીજું કંઈ કહેવું છે?', sendFeedback: 'પ્રતિસાદ મોકલો', sending: 'મોકલાઈ રહ્યું છે…',
  thankYou: 'આભાર.', feedbackThanks: 'તમારો પ્રતિસાદ સીધો ક્લિનિક સુધી પહોંચે છે અને અમને સુધરવામાં મદદ કરે છે.',
  feedbackPrivate: 'તમારો પ્રતિસાદ ક્લિનિકને ખાનગી રીતે મોકલાય છે. ક્લિનિક ખુદ ન ઇચ્છે ત્યાં સુધી તે આ પાના પર દેખાતો નથી.',
  chooseRating: 'કૃપા કરીને રેટિંગ પસંદ કરો.', feedbackFailed: 'પ્રતિસાદ મોકલી શકાયો નહીં. ફરી પ્રયાસ કરો.',
  language: 'ભાષા', loading: 'લોડ થઈ રહ્યું છે…', notPublished: 'આ ક્લિનિકે હજી માહિતી પ્રકાશિત કરી નથી.',
  medicalDisclaimer: 'આ લેખ સામાન્ય આરોગ્ય માહિતી છે, નિદાન કે સારવારની સલાહ નથી. તમારાં લક્ષણો વિશે કંઈ કરતા પહેલાં ડૉક્ટરને મળો.',
  backToClinic: 'ક્લિનિક પર પાછા', anonymous: 'અનામી',
};

const bn: Partial<Record<StringKey, string>> = {
  callClinic: 'ক্লিনিকে ফোন করুন', bookAppointment: 'অ্যাপয়েন্টমেন্ট বুক করুন', checkLiveQueue: 'লাইভ সারি দেখুন',
  openingHours: 'খোলার সময়', closed: 'বন্ধ', closedToday: 'আজ বন্ধ', openNow: 'এখন খোলা',
  opensAt: 'বন্ধ · খুলবে', until: 'পর্যন্ত', today: 'আজ', emergency: 'জরুরি',
  about: 'ক্লিনিক সম্পর্কে', services: 'সেবা', whatWeTreat: 'আমরা কী চিকিৎসা করি',
  whyUs: 'রোগীরা কেন আমাদের বেছে নেন', whatMakesUsDifferent: 'এই ক্লিনিকের বিশেষত্ব',
  ourTeam: 'আমাদের দল', meetDoctor: 'আপনার ডাক্তারের সাথে পরিচিত হন', meetDoctors: 'আমাদের ডাক্তারদের সাথে পরিচিত হন',
  yearsExperience: 'বছরের অভিজ্ঞতা', speaks: 'ভাষা', ourClinic: 'আমাদের ক্লিনিক', lookInside: 'এক ঝলক',
  healthLibrary: 'স্বাস্থ্য তথ্য', articlesFromDoctors: 'আমাদের ডাক্তারদের লেখা', allArticles: 'সব লেখা',
  questions: 'প্রশ্ন', faq: 'সচরাচর জিজ্ঞাসা', visitUs: 'আমাদের কাছে আসুন', getInTouch: 'যোগাযোগ করুন',
  address: 'ঠিকানা', phone: 'ফোন', email: 'ইমেল', getDirections: 'পথ দেখুন',
  servingSince: 'সেবায়', doctor: 'ডাক্তার', doctors: 'ডাক্তার', registration: 'নিবন্ধন',
  knowBeforeYouGo: 'আসার আগে জেনে নিন',
  queueBlurb: 'আজকের সারিতে আপনার আগে কতজন রোগী আছেন দেখুন — যাতে ওয়েটিং রুমের বদলে বাড়িতে অপেক্ষা করতে পারেন।',
  viewLiveQueue: 'লাইভ সারি দেখুন', yourExperience: 'আপনার অভিজ্ঞতা', tellUsHowWeDid: 'আমাদের কাজ কেমন হলো জানান',
  howWasVisit: 'আপনার ভিজিট কেমন ছিল?', yourNameOptional: 'আপনার নাম (ঐচ্ছিক)',
  anythingToTell: 'আর কিছু বলতে চান?', sendFeedback: 'মতামত পাঠান', sending: 'পাঠানো হচ্ছে…',
  thankYou: 'ধন্যবাদ।', feedbackThanks: 'আপনার মতামত সরাসরি ক্লিনিকে পৌঁছায় এবং আমাদের উন্নতি করতে সাহায্য করে।',
  feedbackPrivate: 'আপনার মতামত ক্লিনিকে ব্যক্তিগতভাবে পাঠানো হয়। ক্লিনিক নিজে না চাইলে এটি এই পাতায় দেখানো হয় না।',
  chooseRating: 'অনুগ্রহ করে রেটিং বাছুন।', feedbackFailed: 'মতামত পাঠানো যায়নি। আবার চেষ্টা করুন।',
  language: 'ভাষা', loading: 'লোড হচ্ছে…', notPublished: 'এই ক্লিনিক এখনও তথ্য প্রকাশ করেনি।',
  medicalDisclaimer: 'এই লেখাটি সাধারণ স্বাস্থ্য তথ্য, রোগনির্ণয় বা চিকিৎসার পরামর্শ নয়। নিজের উপসর্গ নিয়ে কিছু করার আগে ডাক্তার দেখান।',
  backToClinic: 'ক্লিনিকে ফিরুন', anonymous: 'নাম প্রকাশে অনিচ্ছুক',
};

const ta: Partial<Record<StringKey, string>> = {
  callClinic: 'கிளினிக்கை அழைக்கவும்', bookAppointment: 'சந்திப்பு பதிவு செய்யவும்', checkLiveQueue: 'நேரடி வரிசையைப் பார்க்கவும்',
  openingHours: 'திறக்கும் நேரம்', closed: 'மூடப்பட்டுள்ளது', closedToday: 'இன்று மூடப்பட்டுள்ளது', openNow: 'இப்போது திறந்திருக்கிறது',
  opensAt: 'மூடப்பட்டுள்ளது · திறக்கும்', until: 'வரை', today: 'இன்று', emergency: 'அவசரம்',
  about: 'கிளினிக் பற்றி', services: 'சேவைகள்', whatWeTreat: 'நாங்கள் எதற்கு சிகிச்சை அளிக்கிறோம்',
  whyUs: 'நோயாளிகள் ஏன் எங்களைத் தேர்வு செய்கிறார்கள்', whatMakesUsDifferent: 'இந்த கிளினிக்கின் சிறப்பு',
  ourTeam: 'எங்கள் குழு', meetDoctor: 'உங்கள் மருத்துவரைச் சந்திக்கவும்', meetDoctors: 'எங்கள் மருத்துவர்களைச் சந்திக்கவும்',
  yearsExperience: 'ஆண்டு அனுபவம்', speaks: 'மொழிகள்', ourClinic: 'எங்கள் கிளினிக்', lookInside: 'ஒரு பார்வை',
  healthLibrary: 'சுகாதாரத் தகவல்', articlesFromDoctors: 'எங்கள் மருத்துவர்களின் கட்டுரைகள்', allArticles: 'அனைத்து கட்டுரைகள்',
  questions: 'கேள்விகள்', faq: 'அடிக்கடி கேட்கப்படும் கேள்விகள்', visitUs: 'எங்களைச் சந்திக்கவும்', getInTouch: 'தொடர்பு கொள்ளவும்',
  address: 'முகவரி', phone: 'தொலைபேசி', email: 'மின்னஞ்சல்', getDirections: 'வழி காட்டு',
  servingSince: 'சேவையில்', doctor: 'மருத்துவர்', doctors: 'மருத்துவர்கள்', registration: 'பதிவு',
  knowBeforeYouGo: 'வருவதற்கு முன் தெரிந்துகொள்ளுங்கள்',
  queueBlurb: 'இன்றைய வரிசையில் உங்களுக்கு முன் எத்தனை நோயாளிகள் என்பதைப் பாருங்கள் — காத்திருப்பு அறைக்குப் பதிலாக வீட்டில் காத்திருக்கலாம்.',
  viewLiveQueue: 'நேரடி வரிசையைப் பார்க்கவும்', yourExperience: 'உங்கள் அனுபவம்', tellUsHowWeDid: 'எங்கள் சேவை எப்படி இருந்தது சொல்லுங்கள்',
  howWasVisit: 'உங்கள் வருகை எப்படி இருந்தது?', yourNameOptional: 'உங்கள் பெயர் (விருப்பத்திற்குரியது)',
  anythingToTell: 'வேறு ஏதும் சொல்ல விரும்புகிறீர்களா?', sendFeedback: 'கருத்தை அனுப்பவும்', sending: 'அனுப்பப்படுகிறது…',
  thankYou: 'நன்றி.', feedbackThanks: 'உங்கள் கருத்து நேரடியாக கிளினிக்கை அடைகிறது, மேம்பட உதவுகிறது.',
  feedbackPrivate: 'உங்கள் கருத்து கிளினிக்கிற்கு தனிப்பட்ட முறையில் அனுப்பப்படுகிறது. கிளினிக் விரும்பினால் ஒழிய இந்தப் பக்கத்தில் காட்டப்படாது.',
  chooseRating: 'தயவுசெய்து மதிப்பீட்டைத் தேர்வு செய்யவும்.', feedbackFailed: 'கருத்தை அனுப்ப முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
  language: 'மொழி', loading: 'ஏற்றுகிறது…', notPublished: 'இந்த கிளினிக் இன்னும் விவரங்களை வெளியிடவில்லை.',
  medicalDisclaimer: 'இந்தக் கட்டுரை பொதுவான சுகாதாரத் தகவல், நோய் கண்டறிதல் அல்லது சிகிச்சை ஆலோசனை அல்ல. உங்கள் அறிகுறிகள் குறித்து ஏதும் செய்வதற்கு முன் மருத்துவரை அணுகவும்.',
  backToClinic: 'கிளினிக்கிற்குத் திரும்பு', anonymous: 'பெயர் குறிப்பிடவில்லை',
};

const te: Partial<Record<StringKey, string>> = {
  callClinic: 'క్లినిక్‌కు కాల్ చేయండి', bookAppointment: 'అపాయింట్‌మెంట్ బుక్ చేయండి', checkLiveQueue: 'లైవ్ క్యూ చూడండి',
  openingHours: 'తెరిచే సమయం', closed: 'మూసివేయబడింది', closedToday: 'ఈరోజు మూసివేయబడింది', openNow: 'ఇప్పుడు తెరిచి ఉంది',
  opensAt: 'మూసివేయబడింది · తెరుచుకుంటుంది', until: 'వరకు', today: 'ఈరోజు', emergency: 'అత్యవసరం',
  about: 'క్లినిక్ గురించి', services: 'సేవలు', whatWeTreat: 'మేము దేనికి చికిత్స చేస్తాము',
  whyUs: 'రోగులు మమ్మల్ని ఎందుకు ఎంచుకుంటారు', whatMakesUsDifferent: 'ఈ క్లినిక్ ప్రత్యేకత',
  ourTeam: 'మా బృందం', meetDoctor: 'మీ వైద్యుడిని కలవండి', meetDoctors: 'మా వైద్యులను కలవండి',
  yearsExperience: 'సంవత్సరాల అనుభవం', speaks: 'భాషలు', ourClinic: 'మా క్లినిక్', lookInside: 'ఒక చూపు',
  healthLibrary: 'ఆరోగ్య సమాచారం', articlesFromDoctors: 'మా వైద్యుల వ్యాసాలు', allArticles: 'అన్ని వ్యాసాలు',
  questions: 'ప్రశ్నలు', faq: 'తరచుగా అడిగే ప్రశ్నలు', visitUs: 'మమ్మల్ని సందర్శించండి', getInTouch: 'సంప్రదించండి',
  address: 'చిరునామా', phone: 'ఫోన్', email: 'ఇమెయిల్', getDirections: 'దారి చూడండి',
  servingSince: 'సేవలో', doctor: 'వైద్యుడు', doctors: 'వైద్యులు', registration: 'నమోదు',
  knowBeforeYouGo: 'రాకముందే తెలుసుకోండి',
  queueBlurb: 'ఈరోజు క్యూలో మీ ముందు ఎంతమంది రోగులు ఉన్నారో చూడండి — వెయిటింగ్ రూమ్‌కు బదులు ఇంట్లోనే వేచి ఉండవచ్చు.',
  viewLiveQueue: 'లైవ్ క్యూ చూడండి', yourExperience: 'మీ అనుభవం', tellUsHowWeDid: 'మా సేవ ఎలా ఉందో చెప్పండి',
  howWasVisit: 'మీ సందర్శన ఎలా ఉంది?', yourNameOptional: 'మీ పేరు (ఐచ్ఛికం)',
  anythingToTell: 'ఇంకేమైనా చెప్పాలనుకుంటున్నారా?', sendFeedback: 'అభిప్రాయం పంపండి', sending: 'పంపుతోంది…',
  thankYou: 'ధన్యవాదాలు.', feedbackThanks: 'మీ అభిప్రాయం నేరుగా క్లినిక్‌కు చేరుతుంది, మెరుగుపడటానికి సహాయపడుతుంది.',
  feedbackPrivate: 'మీ అభిప్రాయం క్లినిక్‌కు ప్రైవేట్‌గా పంపబడుతుంది. క్లినిక్ స్వయంగా కోరితే తప్ప ఈ పేజీలో చూపబడదు.',
  chooseRating: 'దయచేసి రేటింగ్ ఎంచుకోండి.', feedbackFailed: 'అభిప్రాయం పంపలేకపోయాము. మళ్లీ ప్రయత్నించండి.',
  language: 'భాష', loading: 'లోడ్ అవుతోంది…', notPublished: 'ఈ క్లినిక్ ఇంకా వివరాలు ప్రచురించలేదు.',
  medicalDisclaimer: 'ఈ వ్యాసం సాధారణ ఆరోగ్య సమాచారం, రోగనిర్ధారణ లేదా చికిత్స సలహా కాదు. మీ లక్షణాల గురించి ఏదైనా చేసే ముందు వైద్యుడిని సంప్రదించండి.',
  backToClinic: 'క్లినిక్‌కు తిరిగి', anonymous: 'పేరు లేకుండా',
};

const kn: Partial<Record<StringKey, string>> = {
  callClinic: 'ಕ್ಲಿನಿಕ್‌ಗೆ ಕರೆ ಮಾಡಿ', bookAppointment: 'ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕ್ ಮಾಡಿ', checkLiveQueue: 'ಲೈವ್ ಸರತಿ ನೋಡಿ',
  openingHours: 'ತೆರೆಯುವ ಸಮಯ', closed: 'ಮುಚ್ಚಲಾಗಿದೆ', closedToday: 'ಇಂದು ಮುಚ್ಚಲಾಗಿದೆ', openNow: 'ಈಗ ತೆರೆದಿದೆ',
  opensAt: 'ಮುಚ್ಚಲಾಗಿದೆ · ತೆರೆಯುತ್ತದೆ', until: 'ವರೆಗೆ', today: 'ಇಂದು', emergency: 'ತುರ್ತು',
  about: 'ಕ್ಲಿನಿಕ್ ಬಗ್ಗೆ', services: 'ಸೇವೆಗಳು', whatWeTreat: 'ನಾವು ಯಾವುದಕ್ಕೆ ಚಿಕಿತ್ಸೆ ನೀಡುತ್ತೇವೆ',
  whyUs: 'ರೋಗಿಗಳು ನಮ್ಮನ್ನು ಏಕೆ ಆಯ್ಕೆ ಮಾಡುತ್ತಾರೆ', whatMakesUsDifferent: 'ಈ ಕ್ಲಿನಿಕ್‌ನ ವಿಶೇಷತೆ',
  ourTeam: 'ನಮ್ಮ ತಂಡ', meetDoctor: 'ನಿಮ್ಮ ವೈದ್ಯರನ್ನು ಭೇಟಿಯಾಗಿ', meetDoctors: 'ನಮ್ಮ ವೈದ್ಯರನ್ನು ಭೇಟಿಯಾಗಿ',
  yearsExperience: 'ವರ್ಷಗಳ ಅನುಭವ', speaks: 'ಭಾಷೆಗಳು', ourClinic: 'ನಮ್ಮ ಕ್ಲಿನಿಕ್', lookInside: 'ಒಂದು ನೋಟ',
  healthLibrary: 'ಆರೋಗ್ಯ ಮಾಹಿತಿ', articlesFromDoctors: 'ನಮ್ಮ ವೈದ್ಯರ ಲೇಖನಗಳು', allArticles: 'ಎಲ್ಲಾ ಲೇಖನಗಳು',
  questions: 'ಪ್ರಶ್ನೆಗಳು', faq: 'ಪದೇ ಪದೇ ಕೇಳುವ ಪ್ರಶ್ನೆಗಳು', visitUs: 'ನಮ್ಮನ್ನು ಭೇಟಿ ಮಾಡಿ', getInTouch: 'ಸಂಪರ್ಕಿಸಿ',
  address: 'ವಿಳಾಸ', phone: 'ಫೋನ್', email: 'ಇಮೇಲ್', getDirections: 'ದಾರಿ ನೋಡಿ',
  servingSince: 'ಸೇವೆಯಲ್ಲಿ', doctor: 'ವೈದ್ಯರು', doctors: 'ವೈದ್ಯರು', registration: 'ನೋಂದಣಿ',
  knowBeforeYouGo: 'ಬರುವ ಮೊದಲು ತಿಳಿಯಿರಿ',
  queueBlurb: 'ಇಂದಿನ ಸರತಿಯಲ್ಲಿ ನಿಮ್ಮ ಮುಂದೆ ಎಷ್ಟು ರೋಗಿಗಳಿದ್ದಾರೆ ನೋಡಿ — ಕಾಯುವ ಕೋಣೆಯ ಬದಲು ಮನೆಯಲ್ಲೇ ಕಾಯಬಹುದು.',
  viewLiveQueue: 'ಲೈವ್ ಸರತಿ ನೋಡಿ', yourExperience: 'ನಿಮ್ಮ ಅನುಭವ', tellUsHowWeDid: 'ನಮ್ಮ ಸೇವೆ ಹೇಗಿತ್ತು ತಿಳಿಸಿ',
  howWasVisit: 'ನಿಮ್ಮ ಭೇಟಿ ಹೇಗಿತ್ತು?', yourNameOptional: 'ನಿಮ್ಮ ಹೆಸರು (ಐಚ್ಛಿಕ)',
  anythingToTell: 'ಇನ್ನೇನಾದರೂ ಹೇಳಬೇಕೆ?', sendFeedback: 'ಅಭಿಪ್ರಾಯ ಕಳುಹಿಸಿ', sending: 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…',
  thankYou: 'ಧನ್ಯವಾದಗಳು.', feedbackThanks: 'ನಿಮ್ಮ ಅಭಿಪ್ರಾಯ ನೇರವಾಗಿ ಕ್ಲಿನಿಕ್‌ಗೆ ತಲುಪುತ್ತದೆ ಮತ್ತು ಸುಧಾರಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.',
  feedbackPrivate: 'ನಿಮ್ಮ ಅಭಿಪ್ರಾಯ ಕ್ಲಿನಿಕ್‌ಗೆ ಖಾಸಗಿಯಾಗಿ ಕಳುಹಿಸಲಾಗುತ್ತದೆ. ಕ್ಲಿನಿಕ್ ಬಯಸಿದರೆ ಮಾತ್ರ ಈ ಪುಟದಲ್ಲಿ ತೋರಿಸಲಾಗುತ್ತದೆ.',
  chooseRating: 'ದಯವಿಟ್ಟು ರೇಟಿಂಗ್ ಆಯ್ಕೆಮಾಡಿ.', feedbackFailed: 'ಅಭಿಪ್ರಾಯ ಕಳುಹಿಸಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  language: 'ಭಾಷೆ', loading: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…', notPublished: 'ಈ ಕ್ಲಿನಿಕ್ ಇನ್ನೂ ವಿವರಗಳನ್ನು ಪ್ರಕಟಿಸಿಲ್ಲ.',
  medicalDisclaimer: 'ಈ ಲೇಖನ ಸಾಮಾನ್ಯ ಆರೋಗ್ಯ ಮಾಹಿತಿ, ರೋಗನಿರ್ಣಯ ಅಥವಾ ಚಿಕಿತ್ಸಾ ಸಲಹೆಯಲ್ಲ. ನಿಮ್ಮ ಲಕ್ಷಣಗಳ ಬಗ್ಗೆ ಏನಾದರೂ ಮಾಡುವ ಮೊದಲು ವೈದ್ಯರನ್ನು ಭೇಟಿ ಮಾಡಿ.',
  backToClinic: 'ಕ್ಲಿನಿಕ್‌ಗೆ ಹಿಂತಿರುಗಿ', anonymous: 'ಹೆಸರಿಲ್ಲದೆ',
};

const ml: Partial<Record<StringKey, string>> = {
  callClinic: 'ക്ലിനിക്കിൽ വിളിക്കുക', bookAppointment: 'അപ്പോയിന്റ്മെന്റ് ബുക്ക് ചെയ്യുക', checkLiveQueue: 'ലൈവ് ക്യൂ കാണുക',
  openingHours: 'തുറക്കുന്ന സമയം', closed: 'അടച്ചിരിക്കുന്നു', closedToday: 'ഇന്ന് അടച്ചിരിക്കുന്നു', openNow: 'ഇപ്പോൾ തുറന്നിരിക്കുന്നു',
  opensAt: 'അടച്ചിരിക്കുന്നു · തുറക്കും', until: 'വരെ', today: 'ഇന്ന്', emergency: 'അടിയന്തരം',
  about: 'ക്ലിനിക്കിനെക്കുറിച്ച്', services: 'സേവനങ്ങൾ', whatWeTreat: 'ഞങ്ങൾ എന്തിനു ചികിത്സിക്കുന്നു',
  whyUs: 'രോഗികൾ ഞങ്ങളെ തിരഞ്ഞെടുക്കുന്നത് എന്തുകൊണ്ട്', whatMakesUsDifferent: 'ഈ ക്ലിനിക്കിന്റെ പ്രത്യേകത',
  ourTeam: 'ഞങ്ങളുടെ ടീം', meetDoctor: 'നിങ്ങളുടെ ഡോക്ടറെ കാണുക', meetDoctors: 'ഞങ്ങളുടെ ഡോക്ടർമാരെ കാണുക',
  yearsExperience: 'വർഷത്തെ പരിചയം', speaks: 'ഭാഷകൾ', ourClinic: 'ഞങ്ങളുടെ ക്ലിനിക്', lookInside: 'ഒരു നോട്ടം',
  healthLibrary: 'ആരോഗ്യ വിവരങ്ങൾ', articlesFromDoctors: 'ഞങ്ങളുടെ ഡോക്ടർമാരുടെ ലേഖനങ്ങൾ', allArticles: 'എല്ലാ ലേഖനങ്ങളും',
  questions: 'ചോദ്യങ്ങൾ', faq: 'പതിവ് ചോദ്യങ്ങൾ', visitUs: 'ഞങ്ങളെ സന്ദർശിക്കുക', getInTouch: 'ബന്ധപ്പെടുക',
  address: 'വിലാസം', phone: 'ഫോൺ', email: 'ഇമെയിൽ', getDirections: 'വഴി കാണുക',
  servingSince: 'സേവനത്തിൽ', doctor: 'ഡോക്ടർ', doctors: 'ഡോക്ടർമാർ', registration: 'രജിസ്ട്രേഷൻ',
  knowBeforeYouGo: 'വരുന്നതിന് മുമ്പ് അറിയുക',
  queueBlurb: 'ഇന്നത്തെ ക്യൂവിൽ നിങ്ങൾക്ക് മുന്നിൽ എത്ര രോഗികളുണ്ടെന്ന് കാണുക — കാത്തിരിപ്പു മുറിക്കു പകരം വീട്ടിൽ കാത്തിരിക്കാം.',
  viewLiveQueue: 'ലൈവ് ക്യൂ കാണുക', yourExperience: 'നിങ്ങളുടെ അനുഭവം', tellUsHowWeDid: 'ഞങ്ങളുടെ സേവനം എങ്ങനെയുണ്ടായിരുന്നു പറയൂ',
  howWasVisit: 'നിങ്ങളുടെ സന്ദർശനം എങ്ങനെയുണ്ടായിരുന്നു?', yourNameOptional: 'നിങ്ങളുടെ പേര് (നിർബന്ധമല്ല)',
  anythingToTell: 'മറ്റെന്തെങ്കിലും പറയാനുണ്ടോ?', sendFeedback: 'അഭിപ്രായം അയയ്ക്കുക', sending: 'അയയ്ക്കുന്നു…',
  thankYou: 'നന്ദി.', feedbackThanks: 'നിങ്ങളുടെ അഭിപ്രായം നേരിട്ട് ക്ലിനിക്കിൽ എത്തുന്നു, മെച്ചപ്പെടാൻ സഹായിക്കുന്നു.',
  feedbackPrivate: 'നിങ്ങളുടെ അഭിപ്രായം ക്ലിനിക്കിന് സ്വകാര്യമായി അയയ്ക്കുന്നു. ക്ലിനിക് ആഗ്രഹിച്ചാൽ മാത്രമേ ഈ പേജിൽ കാണിക്കൂ.',
  chooseRating: 'ദയവായി റേറ്റിംഗ് തിരഞ്ഞെടുക്കുക.', feedbackFailed: 'അഭിപ്രായം അയയ്ക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.',
  language: 'ഭാഷ', loading: 'ലോഡ് ചെയ്യുന്നു…', notPublished: 'ഈ ക്ലിനിക് ഇതുവരെ വിവരങ്ങൾ പ്രസിദ്ധീകരിച്ചിട്ടില്ല.',
  medicalDisclaimer: 'ഈ ലേഖനം പൊതുവായ ആരോഗ്യ വിവരമാണ്, രോഗനിർണയമോ ചികിത്സാ നിർദ്ദേശമോ അല്ല. നിങ്ങളുടെ ലക്ഷണങ്ങളെക്കുറിച്ച് എന്തെങ്കിലും ചെയ്യുന്നതിന് മുമ്പ് ഡോക്ടറെ കാണുക.',
  backToClinic: 'ക്ലിനിക്കിലേക്ക് മടങ്ങുക', anonymous: 'പേരില്ലാതെ',
};

const pa: Partial<Record<StringKey, string>> = {
  callClinic: 'ਕਲੀਨਿਕ ਨੂੰ ਫ਼ੋਨ ਕਰੋ', bookAppointment: 'ਮੁਲਾਕਾਤ ਬੁੱਕ ਕਰੋ', checkLiveQueue: 'ਲਾਈਵ ਕਤਾਰ ਵੇਖੋ',
  openingHours: 'ਖੁੱਲ੍ਹਣ ਦਾ ਸਮਾਂ', closed: 'ਬੰਦ', closedToday: 'ਅੱਜ ਬੰਦ', openNow: 'ਹੁਣ ਖੁੱਲ੍ਹਾ ਹੈ',
  opensAt: 'ਬੰਦ · ਖੁੱਲ੍ਹੇਗਾ', until: 'ਤੱਕ', today: 'ਅੱਜ', emergency: 'ਐਮਰਜੈਂਸੀ',
  about: 'ਕਲੀਨਿਕ ਬਾਰੇ', services: 'ਸੇਵਾਵਾਂ', whatWeTreat: 'ਅਸੀਂ ਕਿਸ ਦਾ ਇਲਾਜ ਕਰਦੇ ਹਾਂ',
  whyUs: 'ਮਰੀਜ਼ ਸਾਨੂੰ ਕਿਉਂ ਚੁਣਦੇ ਹਨ', whatMakesUsDifferent: 'ਇਸ ਕਲੀਨਿਕ ਦੀ ਖ਼ਾਸੀਅਤ',
  ourTeam: 'ਸਾਡੀ ਟੀਮ', meetDoctor: 'ਆਪਣੇ ਡਾਕਟਰ ਨੂੰ ਮਿਲੋ', meetDoctors: 'ਸਾਡੇ ਡਾਕਟਰਾਂ ਨੂੰ ਮਿਲੋ',
  yearsExperience: 'ਸਾਲਾਂ ਦਾ ਤਜਰਬਾ', speaks: 'ਭਾਸ਼ਾਵਾਂ', ourClinic: 'ਸਾਡਾ ਕਲੀਨਿਕ', lookInside: 'ਇੱਕ ਝਲਕ',
  healthLibrary: 'ਸਿਹਤ ਜਾਣਕਾਰੀ', articlesFromDoctors: 'ਸਾਡੇ ਡਾਕਟਰਾਂ ਦੇ ਲੇਖ', allArticles: 'ਸਾਰੇ ਲੇਖ',
  questions: 'ਸਵਾਲ', faq: 'ਅਕਸਰ ਪੁੱਛੇ ਜਾਂਦੇ ਸਵਾਲ', visitUs: 'ਸਾਡੇ ਕੋਲ ਆਓ', getInTouch: 'ਸੰਪਰਕ ਕਰੋ',
  address: 'ਪਤਾ', phone: 'ਫ਼ੋਨ', email: 'ਈਮੇਲ', getDirections: 'ਰਸਤਾ ਵੇਖੋ',
  servingSince: 'ਸੇਵਾ ਵਿੱਚ', doctor: 'ਡਾਕਟਰ', doctors: 'ਡਾਕਟਰ', registration: 'ਰਜਿਸਟ੍ਰੇਸ਼ਨ',
  knowBeforeYouGo: 'ਆਉਣ ਤੋਂ ਪਹਿਲਾਂ ਜਾਣੋ',
  queueBlurb: 'ਵੇਖੋ ਅੱਜ ਦੀ ਕਤਾਰ ਵਿੱਚ ਤੁਹਾਡੇ ਤੋਂ ਪਹਿਲਾਂ ਕਿੰਨੇ ਮਰੀਜ਼ ਹਨ — ਤਾਂ ਜੋ ਤੁਸੀਂ ਵੇਟਿੰਗ ਰੂਮ ਦੀ ਥਾਂ ਘਰ ਉਡੀਕ ਸਕੋ।',
  viewLiveQueue: 'ਲਾਈਵ ਕਤਾਰ ਵੇਖੋ', yourExperience: 'ਤੁਹਾਡਾ ਤਜਰਬਾ', tellUsHowWeDid: 'ਦੱਸੋ ਸਾਡਾ ਕੰਮ ਕਿਹੋ ਜਿਹਾ ਰਿਹਾ',
  howWasVisit: 'ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਕਿਹੋ ਜਿਹੀ ਰਹੀ?', yourNameOptional: 'ਤੁਹਾਡਾ ਨਾਮ (ਵਿਕਲਪਿਕ)',
  anythingToTell: 'ਹੋਰ ਕੁਝ ਦੱਸਣਾ ਚਾਹੋਗੇ?', sendFeedback: 'ਫੀਡਬੈਕ ਭੇਜੋ', sending: 'ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…',
  thankYou: 'ਧੰਨਵਾਦ।', feedbackThanks: 'ਤੁਹਾਡਾ ਫੀਡਬੈਕ ਸਿੱਧਾ ਕਲੀਨਿਕ ਤੱਕ ਪਹੁੰਚਦਾ ਹੈ ਅਤੇ ਸਾਨੂੰ ਬਿਹਤਰ ਬਣਨ ਵਿੱਚ ਮਦਦ ਕਰਦਾ ਹੈ।',
  feedbackPrivate: 'ਤੁਹਾਡਾ ਫੀਡਬੈਕ ਕਲੀਨਿਕ ਨੂੰ ਨਿੱਜੀ ਤੌਰ ਤੇ ਭੇਜਿਆ ਜਾਂਦਾ ਹੈ। ਜਦ ਤੱਕ ਕਲੀਨਿਕ ਆਪ ਨਾ ਚਾਹੇ, ਇਹ ਇਸ ਪੰਨੇ ਤੇ ਨਹੀਂ ਦਿਖਾਇਆ ਜਾਂਦਾ।',
  chooseRating: 'ਕਿਰਪਾ ਕਰਕੇ ਰੇਟਿੰਗ ਚੁਣੋ।', feedbackFailed: 'ਫੀਡਬੈਕ ਨਹੀਂ ਭੇਜਿਆ ਜਾ ਸਕਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
  language: 'ਭਾਸ਼ਾ', loading: 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…', notPublished: 'ਇਸ ਕਲੀਨਿਕ ਨੇ ਹਾਲੇ ਆਪਣੀ ਜਾਣਕਾਰੀ ਪ੍ਰਕਾਸ਼ਿਤ ਨਹੀਂ ਕੀਤੀ।',
  medicalDisclaimer: 'ਇਹ ਲੇਖ ਆਮ ਸਿਹਤ ਜਾਣਕਾਰੀ ਹੈ, ਕੋਈ ਤਸ਼ਖ਼ੀਸ ਜਾਂ ਇਲਾਜ ਦੀ ਸਲਾਹ ਨਹੀਂ। ਆਪਣੇ ਲੱਛਣਾਂ ਬਾਰੇ ਕੁਝ ਵੀ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਡਾਕਟਰ ਨੂੰ ਮਿਲੋ।',
  backToClinic: 'ਕਲੀਨਿਕ ਤੇ ਵਾਪਸ', anonymous: 'ਗੁਮਨਾਮ',
};

const or: Partial<Record<StringKey, string>> = {
  callClinic: 'କ୍ଲିନିକକୁ ଫୋନ କରନ୍ତୁ', bookAppointment: 'ଅପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍ କରନ୍ତୁ', checkLiveQueue: 'ଲାଇଭ୍ ଧାଡ଼ି ଦେଖନ୍ତୁ',
  openingHours: 'ଖୋଲିବା ସମୟ', closed: 'ବନ୍ଦ', closedToday: 'ଆଜି ବନ୍ଦ', openNow: 'ବର୍ତ୍ତମାନ ଖୋଲା',
  opensAt: 'ବନ୍ଦ · ଖୋଲିବ', until: 'ପର୍ଯ୍ୟନ୍ତ', today: 'ଆଜି', emergency: 'ଜରୁରୀକାଳୀନ',
  about: 'କ୍ଲିନିକ ବିଷୟରେ', services: 'ସେବା', whatWeTreat: 'ଆମେ କ’ଣ ଚିକିତ୍ସା କରୁ',
  whyUs: 'ରୋଗୀମାନେ ଆମକୁ କାହିଁକି ବାଛନ୍ତି', whatMakesUsDifferent: 'ଏହି କ୍ଲିନିକର ବିଶେଷତା',
  ourTeam: 'ଆମ ଦଳ', meetDoctor: 'ଆପଣଙ୍କ ଡାକ୍ତରଙ୍କୁ ଭେଟନ୍ତୁ', meetDoctors: 'ଆମ ଡାକ୍ତରମାନଙ୍କୁ ଭେଟନ୍ତୁ',
  yearsExperience: 'ବର୍ଷର ଅଭିଜ୍ଞତା', speaks: 'ଭାଷା', ourClinic: 'ଆମ କ୍ଲିନିକ', lookInside: 'ଏକ ଝଲକ',
  healthLibrary: 'ସ୍ୱାସ୍ଥ୍ୟ ସୂଚନା', articlesFromDoctors: 'ଆମ ଡାକ୍ତରମାନଙ୍କ ଲେଖା', allArticles: 'ସବୁ ଲେଖା',
  questions: 'ପ୍ରଶ୍ନ', faq: 'ବାରମ୍ବାର ପଚରାଯାଉଥିବା ପ୍ରଶ୍ନ', visitUs: 'ଆମକୁ ଭେଟନ୍ତୁ', getInTouch: 'ଯୋଗାଯୋଗ କରନ୍ତୁ',
  address: 'ଠିକଣା', phone: 'ଫୋନ', email: 'ଇମେଲ', getDirections: 'ରାସ୍ତା ଦେଖନ୍ତୁ',
  servingSince: 'ସେବାରେ', doctor: 'ଡାକ୍ତର', doctors: 'ଡାକ୍ତରମାନେ', registration: 'ପଞ୍ଜୀକରଣ',
  knowBeforeYouGo: 'ଆସିବା ପୂର୍ବରୁ ଜାଣନ୍ତୁ',
  queueBlurb: 'ଆଜିର ଧାଡ଼ିରେ ଆପଣଙ୍କ ଆଗରେ କେତେ ରୋଗୀ ଅଛନ୍ତି ଦେଖନ୍ତୁ — ଯାହାଫଳରେ ଅପେକ୍ଷା କକ୍ଷ ବଦଳରେ ଘରେ ଅପେକ୍ଷା କରିପାରିବେ।',
  viewLiveQueue: 'ଲାଇଭ୍ ଧାଡ଼ି ଦେଖନ୍ତୁ', yourExperience: 'ଆପଣଙ୍କ ଅଭିଜ୍ଞତା', tellUsHowWeDid: 'ଆମ କାମ କେମିତି ଲାଗିଲା କୁହନ୍ତୁ',
  howWasVisit: 'ଆପଣଙ୍କ ଭେଟ କେମିତି ଥିଲା?', yourNameOptional: 'ଆପଣଙ୍କ ନାମ (ଇଚ୍ଛାଧୀନ)',
  anythingToTell: 'ଆଉ କିଛି କହିବାକୁ ଚାହାଁନ୍ତି?', sendFeedback: 'ମତାମତ ପଠାନ୍ତୁ', sending: 'ପଠାଯାଉଛି…',
  thankYou: 'ଧନ୍ୟବାଦ।', feedbackThanks: 'ଆପଣଙ୍କ ମତାମତ ସିଧାସଳଖ କ୍ଲିନିକରେ ପହଞ୍ଚେ ଏବଂ ଆମକୁ ଉନ୍ନତ ହେବାରେ ସାହାଯ୍ୟ କରେ।',
  feedbackPrivate: 'ଆପଣଙ୍କ ମତାମତ କ୍ଲିନିକକୁ ବ୍ୟକ୍ତିଗତ ଭାବେ ପଠାଯାଏ। କ୍ଲିନିକ ନିଜେ ନ ଚାହିଁଲେ ଏହା ଏହି ପୃଷ୍ଠାରେ ଦେଖାଯାଏ ନାହିଁ।',
  chooseRating: 'ଦୟାକରି ରେଟିଂ ବାଛନ୍ତୁ।', feedbackFailed: 'ମତାମତ ପଠାଯାଇପାରିଲା ନାହିଁ। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।',
  language: 'ଭାଷା', loading: 'ଲୋଡ୍ ହେଉଛି…', notPublished: 'ଏହି କ୍ଲିନିକ ଏପର୍ଯ୍ୟନ୍ତ ସୂଚନା ପ୍ରକାଶ କରିନାହିଁ।',
  medicalDisclaimer: 'ଏହି ଲେଖା ସାଧାରଣ ସ୍ୱାସ୍ଥ୍ୟ ସୂଚନା, ରୋଗ ନିର୍ଣ୍ଣୟ କିମ୍ବା ଚିକିତ୍ସା ପରାମର୍ଶ ନୁହେଁ। ନିଜ ଲକ୍ଷଣ ବିଷୟରେ କିଛି କରିବା ପୂର୍ବରୁ ଡାକ୍ତରଙ୍କୁ ଦେଖାନ୍ତୁ।',
  backToClinic: 'କ୍ଲିନିକକୁ ଫେରନ୍ତୁ', anonymous: 'ନାମହୀନ',
};

const ur: Partial<Record<StringKey, string>> = {
  callClinic: 'کلینک کو کال کریں', bookAppointment: 'اپائنٹمنٹ بک کریں', checkLiveQueue: 'لائیو قطار دیکھیں',
  openingHours: 'کھلنے کا وقت', closed: 'بند', closedToday: 'آج بند ہے', openNow: 'ابھی کھلا ہے',
  opensAt: 'بند · کھلے گا', until: 'تک', today: 'آج', emergency: 'ہنگامی',
  about: 'کلینک کے بارے میں', services: 'خدمات', whatWeTreat: 'ہم کس کا علاج کرتے ہیں',
  whyUs: 'مریض ہمیں کیوں منتخب کرتے ہیں', whatMakesUsDifferent: 'اس کلینک کی خاصیت',
  ourTeam: 'ہماری ٹیم', meetDoctor: 'اپنے ڈاکٹر سے ملیں', meetDoctors: 'ہمارے ڈاکٹروں سے ملیں',
  yearsExperience: 'سال کا تجربہ', speaks: 'زبانیں', ourClinic: 'ہمارا کلینک', lookInside: 'ایک جھلک',
  healthLibrary: 'صحت کی معلومات', articlesFromDoctors: 'ہمارے ڈاکٹروں کے مضامین', allArticles: 'تمام مضامین',
  questions: 'سوالات', faq: 'اکثر پوچھے جانے والے سوالات', visitUs: 'ہم سے ملیں', getInTouch: 'رابطہ کریں',
  address: 'پتہ', phone: 'فون', email: 'ای میل', getDirections: 'راستہ دیکھیں',
  servingSince: 'خدمت میں', doctor: 'ڈاکٹر', doctors: 'ڈاکٹر', registration: 'رجسٹریشن',
  knowBeforeYouGo: 'آنے سے پہلے جان لیں',
  queueBlurb: 'دیکھیں آج کی قطار میں آپ سے پہلے کتنے مریض ہیں — تاکہ آپ ویٹنگ روم کے بجائے گھر انتظار کر سکیں۔',
  viewLiveQueue: 'لائیو قطار دیکھیں', yourExperience: 'آپ کا تجربہ', tellUsHowWeDid: 'بتائیں ہمارا کام کیسا رہا',
  howWasVisit: 'آپ کا دورہ کیسا رہا؟', yourNameOptional: 'آپ کا نام (اختیاری)',
  anythingToTell: 'کچھ اور بتانا چاہیں گے؟', sendFeedback: 'رائے بھیجیں', sending: 'بھیجا جا رہا ہے…',
  thankYou: 'شکریہ۔', feedbackThanks: 'آپ کی رائے براہِ راست کلینک تک پہنچتی ہے اور ہمیں بہتر بننے میں مدد دیتی ہے۔',
  feedbackPrivate: 'آپ کی رائے کلینک کو نجی طور پر بھیجی جاتی ہے۔ جب تک کلینک خود نہ چاہے، یہ اس صفحے پر نہیں دکھائی جاتی۔',
  chooseRating: 'براہِ کرم درجہ بندی منتخب کریں۔', feedbackFailed: 'رائے نہیں بھیجی جا سکی۔ دوبارہ کوشش کریں۔',
  language: 'زبان', loading: 'لوڈ ہو رہا ہے…', notPublished: 'اس کلینک نے ابھی اپنی معلومات شائع نہیں کیں۔',
  medicalDisclaimer: 'یہ مضمون عام صحت کی معلومات ہے، کوئی تشخیص یا علاج کا مشورہ نہیں۔ اپنی علامات کے بارے میں کچھ بھی کرنے سے پہلے ڈاکٹر سے ملیں۔',
  backToClinic: 'کلینک پر واپس', anonymous: 'گمنام',
};

const as_: Partial<Record<StringKey, string>> = {
  callClinic: 'ক্লিনিকলৈ ফোন কৰক', bookAppointment: 'এপইণ্টমেণ্ট বুক কৰক', checkLiveQueue: 'লাইভ শাৰী চাওক',
  openingHours: 'খোলা সময়', closed: 'বন্ধ', closedToday: 'আজি বন্ধ', openNow: 'এতিয়া খোলা',
  opensAt: 'বন্ধ · খুলিব', until: 'লৈকে', today: 'আজি', emergency: 'জৰুৰীকালীন',
  about: 'ক্লিনিকৰ বিষয়ে', services: 'সেৱা', whatWeTreat: 'আমি কিহৰ চিকিৎসা কৰোঁ',
  whyUs: 'ৰোগীয়ে আমাক কিয় বাছে', whatMakesUsDifferent: 'এই ক্লিনিকৰ বিশেষত্ব',
  ourTeam: 'আমাৰ দল', meetDoctor: 'আপোনাৰ ডাক্তৰক লগ কৰক', meetDoctors: 'আমাৰ ডাক্তৰসকলক লগ কৰক',
  yearsExperience: 'বছৰৰ অভিজ্ঞতা', speaks: 'ভাষা', ourClinic: 'আমাৰ ক্লিনিক', lookInside: 'এক �লক',
  healthLibrary: 'স্বাস্থ্য তথ্য', articlesFromDoctors: 'আমাৰ ডাক্তৰৰ লেখা', allArticles: 'সকলো লেখা',
  questions: 'প্ৰশ্ন', faq: 'সঘনাই সোধা প্ৰশ্ন', visitUs: 'আমাক লগ কৰক', getInTouch: 'যোগাযোগ কৰক',
  address: 'ঠিকনা', phone: 'ফোন', email: 'ইমেইল', getDirections: 'বাট চাওক',
  servingSince: 'সেৱাত', doctor: 'ডাক্তৰ', doctors: 'ডাক্তৰসকল', registration: 'পঞ্জীয়ন',
  knowBeforeYouGo: 'অহাৰ আগতে জানি লওক',
  queueBlurb: 'আজিৰ শাৰীত আপোনাৰ আগত কিমান ৰোগী আছে চাওক — যাতে অপেক্ষা কোঠাৰ পৰিৱৰ্তে ঘৰতে অপেক্ষা কৰিব পাৰে।',
  viewLiveQueue: 'লাইভ শাৰী চাওক', yourExperience: 'আপোনাৰ অভিজ্ঞতা', tellUsHowWeDid: 'আমাৰ কাম কেনে আছিল কওক',
  howWasVisit: 'আপোনাৰ ভ্ৰমণ কেনে আছিল?', yourNameOptional: 'আপোনাৰ নাম (ঐচ্ছিক)',
  anythingToTell: 'আৰু কিবা ক\'ব বিচাৰে?', sendFeedback: 'মতামত পঠিয়াওক', sending: 'পঠিওৱা হৈছে…',
  thankYou: 'ধন্যবাদ।', feedbackThanks: 'আপোনাৰ মতামত পোনপটীয়াকৈ ক্লিনিকলৈ যায় আৰু আমাক উন্নত হ\'বলৈ সহায় কৰে।',
  feedbackPrivate: 'আপোনাৰ মতামত ক্লিনিকলৈ ব্যক্তিগতভাৱে পঠিওৱা হয়। ক্লিনিকে নিজে নিবিচাৰিলে ই এই পৃষ্ঠাত দেখুৱা নহয়।',
  chooseRating: 'অনুগ্ৰহ কৰি ৰেটিং বাছক।', feedbackFailed: 'মতামত পঠিয়াব পৰা নগ\'ল। পুনৰ চেষ্টা কৰক।',
  language: 'ভাষা', loading: 'ল\'ড হৈ আছে…', notPublished: 'এই ক্লিনিকে এতিয়াও তথ্য প্ৰকাশ কৰা নাই।',
  medicalDisclaimer: 'এই লেখাটো সাধাৰণ স্বাস্থ্য তথ্য, ৰোগ নিৰ্ণয় বা চিকিৎসাৰ পৰামৰ্শ নহয়। নিজৰ লক্ষণৰ বিষয়ে কিবা কৰাৰ আগতে ডাক্তৰক দেখুৱাওক।',
  backToClinic: 'ক্লিনিকলৈ উভতি যাওক', anonymous: 'নামবিহীন',
};

const DICTIONARIES: Record<Locale, Partial<Record<StringKey, string>>> = {
  en, hi, mr, bn, te, ta, gu, kn, ml, pa, or, ur, as: as_,
};

/** Returns a lookup for one locale, falling back to English per key so a
 * partially-filled dictionary degrades to a mixed page, never a blank one. */
export function strings(locale: string): (key: StringKey) => string {
  const dict = DICTIONARIES[locale as Locale] ?? {};
  return (key) => dict[key] ?? en[key];
}

export type { StringKey };
