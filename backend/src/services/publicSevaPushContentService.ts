type PublicEvent =
  | 'registration_opened'
  | 'registration_extended'
  | 'registration_closing_reminder';
type Language = 'en' | 'te' | 'kn' | 'hi' | 'ta';
type Content = {
  title: string;
  body: string;
};
type Template = (
  name: string,
  deadline: string
) => Content;
const templates: Record<
  Language,
  Record<PublicEvent, Template>
> = {
  en: {
    registration_opened: (name, date) => ({
      title: 'Volunteer Seva Registrations Open',
      body: `Registrations for ${name} are now open until ${date} IST. Register through the temple app.`,
    }),
    registration_extended: (name, date) => ({
      title: 'Seva Registration Deadline Extended',
      body: `The registration deadline for ${name} has been extended until ${date} IST.`,
    }),
    registration_closing_reminder: (name, date) => ({
      title: 'Volunteer Seva Registrations Closing Soon',
      body: `Registrations for ${name} will close on ${date} IST. Complete your registration before the deadline.`,
    }),
  },
  te: {
    registration_opened: (name, date) => ({
      title: 'సేవా నమోదు ప్రారంభమైంది',
      body: `${name} సేవకు ${date} IST వరకు నమోదు చేసుకోవచ్చు. ఆలయ యాప్ ద్వారా నమోదు చేసుకోండి.`,
    }),
    registration_extended: (name, date) => ({
      title: 'సేవా నమోదు గడువు పొడిగింపు',
      body: `${name} సేవకు నమోదు గడువు ${date} IST వరకు పొడిగించబడింది.`,
    }),
    registration_closing_reminder: (name, date) => ({
      title: 'సేవా నమోదు గడువు త్వరలో ముగియనుంది',
      body: `${name} సేవకు నమోదు గడువు ${date} IST న ముగుస్తుంది. గడువులోగా నమోదు చేసుకోండి.`,
    }),
  },
  kn: {
    registration_opened: (name, date) => ({
      title: 'ಸೇವಾ ನೋಂದಣಿ ಪ್ರಾರಂಭವಾಗಿದೆ',
      body: `${name} ಸೇವೆಗೆ ${date} IST ವರೆಗೆ ನೋಂದಾಯಿಸಬಹುದು. ದೇವಾಲಯದ ಆ್ಯಪ್ ಮೂಲಕ ನೋಂದಾಯಿಸಿ.`,
    }),
    registration_extended: (name, date) => ({
      title: 'ಸೇವಾ ನೋಂದಣಿ ಅವಧಿ ವಿಸ್ತರಣೆ',
      body: `${name} ಸೇವೆಯ ನೋಂದಣಿ ಅವಧಿಯನ್ನು ${date} IST ವರೆಗೆ ವಿಸ್ತರಿಸಲಾಗಿದೆ.`,
    }),
    registration_closing_reminder: (name, date) => ({
      title: 'ಸೇವಾ ನೋಂದಣಿ ಶೀಘ್ರದಲ್ಲೇ ಮುಕ್ತಾಯ',
      body: `${name} ಸೇವೆಯ ನೋಂದಣಿ ${date} IST ರಂದು ಮುಕ್ತಾಯಗೊಳ್ಳುತ್ತದೆ. ಅವಧಿಯೊಳಗೆ ನೋಂದಾಯಿಸಿ.`,
    }),
  },
  hi: {
    registration_opened: (name, date) => ({
      title: 'सेवा पंजीकरण प्रारंभ',
      body: `${name} सेवा के लिए ${date} IST तक पंजीकरण खुला है। मंदिर ऐप के माध्यम से पंजीकरण करें।`,
    }),
    registration_extended: (name, date) => ({
      title: 'सेवा पंजीकरण की समय सीमा बढ़ी',
      body: `${name} सेवा के पंजीकरण की समय सीमा ${date} IST तक बढ़ा दी गई है।`,
    }),
    registration_closing_reminder: (name, date) => ({
      title: 'सेवा पंजीकरण शीघ्र समाप्त होगा',
      body: `${name} सेवा का पंजीकरण ${date} IST को समाप्त होगा। समय सीमा से पहले पंजीकरण करें।`,
    }),
  },
  ta: {
    registration_opened: (name, date) => ({
      title: 'சேவைப் பதிவு தொடங்கியது',
      body: `${name} சேவைக்கு ${date} IST வரை பதிவு செய்யலாம். கோயில் செயலி மூலம் பதிவு செய்யுங்கள்.`,
    }),
    registration_extended: (name, date) => ({
      title: 'சேவைப் பதிவு காலக்கெடு நீட்டிப்பு',
      body: `${name} சேவைக்கான பதிவு காலக்கெடு ${date} IST வரை நீட்டிக்கப்பட்டுள்ளது.`,
    }),
    registration_closing_reminder: (name, date) => ({
      title: 'சேவைப் பதிவு விரைவில் முடிவடையும்',
      body: `${name} சேவைக்கான பதிவு ${date} IST அன்று முடிவடையும். காலக்கெடுவிற்குள் பதிவு செய்யுங்கள்.`,
    }),
  },
};
export function getPublicSevaPushContent(
  event: unknown,
  opportunityTitle: unknown,
  registrationDeadline: unknown,
  preferredLanguage: unknown
): Content | null {
  if (
    typeof event !== 'string' ||
    !Object.prototype.hasOwnProperty.call(
      templates.en,
      event
    )
  ) {
    return null;
  }
  if (
    typeof opportunityTitle !== 'string' ||
    typeof registrationDeadline !== 'string'
  ) {
    return null;
  }
  const name = opportunityTitle.trim();
  const deadline = registrationDeadline.trim();
  if (
    !name ||
    name.length > 255 ||
    !deadline ||
    deadline.length > 100 ||
    /[\u0000-\u001F\u007F]/.test(name) ||
    /[\u0000-\u001F\u007F]/.test(deadline)
  ) {
    return null;
  }
  const normalized =
    typeof preferredLanguage === 'string'
      ? preferredLanguage
          .trim()
          .toLowerCase()
          .split(/[-_]/)[0]
      : 'en';
  const language: Language =
    Object.prototype.hasOwnProperty.call(
      templates,
      normalized
    )
      ? normalized as Language
      : 'en';
  return templates[language][event as PublicEvent](
    name,
    deadline
  );
}