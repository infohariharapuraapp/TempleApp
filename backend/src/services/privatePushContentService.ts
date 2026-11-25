type PrivatePushLanguage =
  | 'en'
  | 'te'
  | 'kn'
  | 'hi'
  | 'ta';
const PRIVATE_PUSH_MESSAGES: Record<
  PrivatePushLanguage,
  string
> = {
  en: 'You have a new update. Open the app to view details.',
  te: 'మీకు కొత్త సమాచారం ఉంది. వివరాలను చూడటానికి యాప్‌ను తెరవండి.',
  kn: 'ನಿಮಗೆ ಹೊಸ ಮಾಹಿತಿ ಇದೆ. ವಿವರಗಳನ್ನು ನೋಡಲು ಆ್ಯಪ್ ತೆರೆಯಿರಿ.',
  hi: 'आपके लिए नई सूचना है। विवरण देखने के लिए ऐप खोलें।',
  ta: 'உங்களுக்குப் புதிய தகவல் உள்ளது. விவரங்களைக் காண செயலியைத் திறக்கவும்.',
};
export function getPrivatePushContent(
  preferredLanguage: unknown
) {
  const normalized =
    typeof preferredLanguage === 'string'
      ? preferredLanguage
          .trim()
          .toLowerCase()
          .split(/[-_]/)[0]
      : 'en';
  const language: PrivatePushLanguage =
    Object.prototype.hasOwnProperty.call(
      PRIVATE_PUSH_MESSAGES,
      normalized
    )
      ? normalized as PrivatePushLanguage
      : 'en';
  return {
    title: 'Temple App',
    body: PRIVATE_PUSH_MESSAGES[language],
    data: {
      type: 'private_update',
      screen: '/notifications',
    },
  };
}