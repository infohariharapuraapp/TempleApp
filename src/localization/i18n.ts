
import i18n from 'i18next';
import aboutTa from './about.ta.json';
import aboutHi from './about.hi.json';
import aboutKn from './about.kn.json';
import aboutTe from './about.te.json';
import aboutEn from './about.en.json';

import {
  initReactI18next,
} from 'react-i18next';

import {
  getLocales,
} from 'expo-localization';

import AsyncStorage from '@react-native-async-storage/async-storage';


// ========================================
// MAIN TRANSLATIONS
// ========================================

import en from './en.json';
import te from './te.json';
import kn from './kn.json';
import hi from './hi.json';
import ta from './ta.json';


// ========================================
// HOME TRANSLATIONS
// ========================================

import homeEn from './home.en.json';
import homeTe from './home.te.json';
import homeKn from './home.kn.json';
import homeHi from './home.hi.json';
import homeTa from './home.ta.json';


// ========================================
// EVENTS TRANSLATIONS
// ========================================

import eventsEn from './events.en.json';
import eventsTe from './events.te.json';
import eventsKn from './events.kn.json';
import eventsHi from './events.hi.json';
import eventsTa from './events.ta.json';

// ========================================
// DEITIES TRANSLATIONS
// ========================================

import deitiesEn from './deities.en.json';
import deitiesTe from './deities.te.json';
import deitiesKn from './deities.kn.json';
import deitiesHi from './deities.hi.json';
import deitiesTa from './deities.ta.json';
// ========================================
// GALLERY TRANSLATIONS
// ========================================

import galleryEn from './gallery.en.json';
import galleryTe from './gallery.te.json';
import galleryKn from './gallery.kn.json';
import galleryHi from './gallery.hi.json';
import galleryTa from './gallery.ta.json';

//Darshan
import activitiesEn from './activities.en.json';
import activitiesTe from './activities.te.json';
import activitiesKn from './activities.kn.json';
import activitiesHi from './activities.hi.json';
import activitiesTa from './activities.ta.json';
import poojaEn from './pooja.en.json';
import poojaTe from './pooja.te.json';
import poojaKn from './pooja.kn.json';
import poojaHi from './pooja.hi.json';
import poojaTa from './pooja.ta.json';

//Activites
import communityEn from './community.en.json';
import communityTe from './community.te.json';
import communityKn from './community.kn.json';
import communityHi from './community.hi.json';
import communityTa from './community.ta.json';

import sreemathEn from './sreemath.en.json';
import sreemathTe from './sreemath.te.json';
import sreemathKn from './sreemath.kn.json';
import sreemathHi from './sreemath.hi.json';
import sreemathTa from './sreemath.ta.json';

// ========================================
// LANGUAGE STORAGE
// ========================================

import guruParamparaEn from './guru-parampara.en.json';
import guruParamparaTe from './guru-parampara.te.json';
import guruParamparaKn from './guru-parampara.kn.json';
import guruParamparaHi from './guru-parampara.hi.json';
import guruParamparaTa from './guru-parampara.ta.json';

export const LANGUAGE_STORAGE_KEY =
  'temple_app_language';


// ========================================
// SUPPORTED LANGUAGES
// ========================================

export const SUPPORTED_LANGUAGES = [
  'en',
  'te',
  'kn',
  'hi',
  'ta',
] as const;

export type AppLanguage =
  (typeof SUPPORTED_LANGUAGES)[number];


// ========================================
// TRANSLATION RESOURCES
// ========================================
type TranslationObject = {
  [key: string]: string | TranslationObject;
};

function mergeTranslations(
  ...sources: TranslationObject[]
): TranslationObject {
  const result: TranslationObject = {};

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      const existing = result[key];

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        result[key] = mergeTranslations(
          typeof existing === 'object' &&
            existing !== null &&
            !Array.isArray(existing)
            ? existing
            : {},
          value
        );
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}
const resources = {
  en: {
    translation: mergeTranslations(
      en,
      homeEn,
      deitiesEn,
      activitiesEn,
      communityEn,
      eventsEn,
      poojaEn,
      galleryEn,
      sreemathEn,
      guruParamparaEn,
      aboutEn
    ),
  },

  te: {
    translation: mergeTranslations(
      te,
      homeTe,
      deitiesTe,
      activitiesTe,
      communityTe,
      eventsTe,
      poojaTe,
      galleryTe,
      sreemathTe,
      guruParamparaTe,
      aboutTe
    ),
  },

  kn: {
    translation: mergeTranslations(
      kn,
      homeKn,
      deitiesKn,
      activitiesKn,
      communityKn,
      eventsKn,
      poojaKn,
      galleryKn,
      sreemathKn,
      guruParamparaKn,
      aboutKn
    ),
  },

  hi: {
    translation: mergeTranslations(
      hi,
      homeHi,
      deitiesHi,
      activitiesHi,
      communityHi,
      eventsHi,
      poojaHi,
      galleryHi,
      sreemathHi,
      guruParamparaHi,
      aboutHi
    ),
  },

  ta: {
    translation: mergeTranslations(
      ta,
      homeTa,
      deitiesTa,
      activitiesTa,
      communityTa,
      eventsTa,
      poojaTa,
      galleryTa,
      sreemathTa,
      guruParamparaTa,
      aboutTa
    ),
  },
};

// ========================================
// DEVICE LANGUAGE
// ========================================

const deviceLanguage =
  getLocales()[0]?.languageCode ?? 'en';

const initialLanguage =
  SUPPORTED_LANGUAGES.includes(
    deviceLanguage as AppLanguage
  )
    ? deviceLanguage
    : 'en';


// ========================================
// INITIALIZE I18NEXT
// ========================================

i18n
  .use(initReactI18next)
  .init({

    resources,

    lng: initialLanguage,

    fallbackLng: 'en',

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false,
    },

  });


// ========================================
// LOAD SAVED LANGUAGE
// ========================================

export async function loadSavedLanguage() {

  try {

    const savedLanguage =
      await AsyncStorage.getItem(
        LANGUAGE_STORAGE_KEY
      );

    if (
      savedLanguage &&
      SUPPORTED_LANGUAGES.includes(
        savedLanguage as AppLanguage
      )
    ) {

      await i18n.changeLanguage(
        savedLanguage
      );

    }

  } catch (error) {

    console.error(
      'Failed to load language:',
      error
    );

  }

}



// ========================================
// CHANGE APP LANGUAGE
// ========================================

export async function changeAppLanguage(
  language: AppLanguage
) {

  await i18n.changeLanguage(language);

  try {

    await AsyncStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      language
    );

  } catch (error) {

    console.error(
      'Failed to save language:',
      error
    );

  }

}



// ========================================
// EXPORT I18NEXT
// ========================================

export default i18n;
