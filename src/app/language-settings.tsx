
import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import {
  AppLanguage,
  changeAppLanguage,
} from '@/localization/i18n';

// ========================================
// COLORS
// ========================================

const COLORS = {
  background: '#FFFDF8',
  white: '#FFFFFF',
  maroon: '#6B1720',
  maroonDark: '#541018',
  gold: '#C69A3A',
  goldSoft: '#F7EBD7',
  border: '#E8DCCB',
  text: '#30241F',
  muted: '#8E8175',
};

// ========================================
// LANGUAGE TRANSLATIONS
// ========================================

const LANGUAGE_LABELS = {
  en: {
    header: 'Select Language',
    title: 'Choose Your Language',
    subtitle:
      'Select your preferred language to use the Hariharapura Temple App.',
    info:
      'Your selected language will be remembered the next time you open the app.',
    errorTitle: 'Language Error',
    error:
      'Unable to change language. Please try again.',
    back: 'Go back',
  },

  te: {
    header: 'భాషను ఎంచుకోండి',
    title: 'మీ భాషను ఎంచుకోండి',
    subtitle:
      'హరిహరపుర ఆలయ యాప్‌ను ఉపయోగించడానికి మీకు ఇష్టమైన భాషను ఎంచుకోండి.',
    info:
      'మీరు ఎంచుకున్న భాషను యాప్ తదుపరిసారి తెరిచినప్పుడు కూడా గుర్తుంచుకుంటుంది.',
    errorTitle: 'భాష లోపం',
    error:
      'భాషను మార్చలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.',
    back: 'వెనక్కి వెళ్లండి',
  },

  kn: {
    header: 'ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    title: 'ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    subtitle:
      'ಹರಿಹರಪುರ ದೇವಾಲಯದ ಆ್ಯಪ್ ಬಳಸಲು ನಿಮ್ಮ ಆದ್ಯತೆಯ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.',
    info:
      'ನೀವು ಆಯ್ಕೆಮಾಡಿದ ಭಾಷೆಯನ್ನು ಮುಂದಿನ ಬಾರಿ ಆ್ಯಪ್ ತೆರೆದಾಗಲೂ ನೆನಪಿಡಲಾಗುತ್ತದೆ.',
    errorTitle: 'ಭಾಷೆಯ ದೋಷ',
    error:
      'ಭಾಷೆಯನ್ನು ಬದಲಾಯಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    back: 'ಹಿಂದಕ್ಕೆ ಹೋಗಿ',
  },

  hi: {
    header: 'भाषा चुनें',
    title: 'अपनी भाषा चुनें',
    subtitle:
      'हरिहरपुर मंदिर ऐप का उपयोग करने के लिए अपनी पसंदीदा भाषा चुनें।',
    info:
      'आपकी चुनी हुई भाषा अगली बार ऐप खोलने पर भी याद रखी जाएगी।',
    errorTitle: 'भाषा त्रुटि',
    error:
      'भाषा बदल नहीं सकी। कृपया फिर से प्रयास करें।',
    back: 'वापस जाएँ',
  },

  ta: {
    header: 'மொழியைத் தேர்ந்தெடுக்கவும்',
    title: 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்',
    subtitle:
      'ஹரிஹரபுர கோயில் செயலியைப் பயன்படுத்த விருப்பமான மொழியைத் தேர்ந்தெடுக்கவும்.',
    info:
      'நீங்கள் தேர்ந்தெடுத்த மொழி அடுத்த முறை செயலியைத் திறக்கும்போதும் நினைவில் வைக்கப்படும்.',
    errorTitle: 'மொழிப் பிழை',
    error:
      'மொழியை மாற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    back: 'பின்செல்லவும்',
  },
} as const;

// ========================================
// SUPPORTED LANGUAGES
// ========================================

const LANGUAGES: {
  code: AppLanguage;
  nativeName: string;
  englishName: string;
}[] = [
  {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
  },
  {
    code: 'te',
    nativeName: 'తెలుగు',
    englishName: 'Telugu',
  },
  {
    code: 'kn',
    nativeName: 'ಕನ್ನಡ',
    englishName: 'Kannada',
  },
  {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
  },
  {
    code: 'ta',
    nativeName: 'தமிழ்',
    englishName: 'Tamil',
  },
];

// ========================================
// LANGUAGE HELPER
// ========================================

function normalizeLanguage(
  language: string
): AppLanguage {
  const normalized =
    language.toLowerCase().split('-')[0];

  if (
    normalized === 'en' ||
    normalized === 'te' ||
    normalized === 'kn' ||
    normalized === 'hi' ||
    normalized === 'ta'
  ) {
    return normalized;
  }

  return 'en';
}

// ========================================
// LANGUAGE SCREEN
// ========================================

export default function LanguageSettingsScreen() {
  const { i18n } = useTranslation();

  const selectedLanguage = normalizeLanguage(
    i18n.resolvedLanguage ||
      i18n.language ||
      'en'
  );

  const [saving, setSaving] =
    useState(false);

  const labels =
    LANGUAGE_LABELS[selectedLanguage];

  // ========================================
  // CHANGE LANGUAGE
  // ========================================

  const handleLanguageChange = async (
    language: AppLanguage
  ) => {
    if (
      saving ||
      selectedLanguage === language
    ) {
      return;
    }

    try {
      setSaving(true);

      await changeAppLanguage(language);

      console.log(
        'App language changed to:',
        language
      );
    } catch (error) {
      console.error(
        'Failed to change language:',
        error
      );

      Alert.alert(
        labels.errorTitle,
        labels.error
      );
    } finally {
      setSaving(false);
    }
  };

  // ========================================
  // SCREEN
  // ========================================

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'bottom']}
    >
      {/* HEADER */}

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel={labels.back}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={COLORS.maroon}
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {labels.header}
        </Text>

        <View style={{ width: 42 }} />
      </View>

      {/* CONTENT */}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* LANGUAGE ICON */}

        <View style={styles.iconContainer}>
          <Ionicons
            name="language-outline"
            size={40}
            color={COLORS.maroon}
          />
        </View>

        {/* TITLE */}

        <Text style={styles.title}>
          {labels.title}
        </Text>

        <Text style={styles.subtitle}>
          {labels.subtitle}
        </Text>

        {/* LANGUAGE OPTIONS */}

        <View style={styles.languageList}>
          {LANGUAGES.map((language) => {
            const isSelected =
              selectedLanguage === language.code;

            return (
              <TouchableOpacity
                key={language.code}
                style={[
                  styles.languageCard,
                  isSelected &&
                    styles.selectedLanguageCard,
                ]}
                activeOpacity={0.8}
                disabled={saving}
                onPress={() =>
                  handleLanguageChange(
                    language.code
                  )
                }
                accessibilityRole="radio"
                accessibilityState={{
                  selected: isSelected,
                }}
              >
                <View style={styles.languageInfo}>
                  <Text style={styles.nativeName}>
                    {language.nativeName}
                  </Text>

                  <Text style={styles.englishName}>
                    {language.englishName}
                  </Text>
                </View>

                <Ionicons
                  name={
                    isSelected
                      ? 'checkmark-circle'
                      : 'ellipse-outline'
                  }
                  size={26}
                  color={
                    isSelected
                      ? COLORS.maroon
                      : COLORS.border
                  }
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* LOADING INDICATOR */}

        {saving && (
          <ActivityIndicator
            size="small"
            color={COLORS.maroon}
            style={styles.loader}
          />
        )}

        {/* INFORMATION */}

        <View style={styles.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={21}
            color={COLORS.gold}
          />

          <Text style={styles.infoText}>
            {labels.info}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  backButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.maroon,
  },

  content: {
    padding: 22,
    paddingBottom: 40,
  },

  iconContainer: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: COLORS.goldSoft,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 22,
  },

  title: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.maroonDark,
    textAlign: 'center',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 30,
  },

  languageList: {
    gap: 12,
  },

  languageCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  selectedLanguageCard: {
    borderColor: COLORS.gold,
    borderWidth: 2,
    backgroundColor: '#FFFAF0',
  },

  languageInfo: {
    flex: 1,
  },

  nativeName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },

  englishName: {
    fontSize: 12,
    color: COLORS.muted,
  },

  loader: {
    marginTop: 18,
  },

  infoBox: {
    marginTop: 30,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.goldSoft,
    padding: 16,
    borderRadius: 14,
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.maroonDark,
  },
});
