
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage } from '@/localization/i18n';
import type { AppLanguage } from '@/localization/i18n';

const LANGUAGES: {
  code: AppLanguage;
  nativeName: string;
  englishName: string;
}[] = [
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentCode = (
    i18n.resolvedLanguage || i18n.language || 'en'
  ).split('-')[0] as AppLanguage;

  const selected =
    LANGUAGES.find(item => item.code === currentCode) ||
    LANGUAGES[0];

  const selectLanguage = async (language: AppLanguage) => {
    if (saving || language === currentCode) {
      setVisible(false);
      return;
    }

    try {
      setSaving(true);
      await changeAppLanguage(language);
      setVisible(false);
    } catch (error) {
      console.error('Language change failed:', error);
      Alert.alert(
        'Language Error',
        'Unable to change language. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Change language"
      >
        <Ionicons name="language-outline" size={19} color="#6B1720" />
        <Text style={styles.selectedText}>
          {selected.nativeName}
        </Text>
        <Ionicons name="chevron-down" size={17} color="#6B1720" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => !saving && setVisible(false)}
        >
          <Pressable
            style={styles.modal}
            onPress={event => event.stopPropagation()}
          >
            <View style={styles.heading}>
              <Text style={styles.title}>Select Language</Text>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                disabled={saving}
              >
                <Ionicons name="close" size={24} color="#6B1720" />
              </TouchableOpacity>
            </View>

            {LANGUAGES.map(language => {
              const active = language.code === currentCode;

              return (
                <TouchableOpacity
                  key={language.code}
                  style={[
                    styles.language,
                    active && styles.activeLanguage,
                  ]}
                  disabled={saving}
                  onPress={() => selectLanguage(language.code)}
                >
                  <View>
                    <Text style={styles.nativeName}>
                      {language.nativeName}
                    </Text>
                    <Text style={styles.englishName}>
                      {language.englishName}
                    </Text>
                  </View>

                  <Ionicons
                    name={active ? 'checkmark-circle' : 'ellipse-outline'}
                    size={23}
                    color={active ? '#6B1720' : '#C9BDB0'}
                  />
                </TouchableOpacity>
              );
            })}

            {saving && (
              <ActivityIndicator color="#6B1720" />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCCB',
    borderRadius: 12,
    marginBottom: 20,
  },
  selectedText: {
    color: '#6B1720',
    fontWeight: '700',
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6B1720',
  },
  language: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },
  activeLanguage: {
    borderColor: '#C69A3A',
    backgroundColor: '#FFFAF0',
  },
  nativeName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#30241F',
  },
  englishName: {
    fontSize: 12,
    color: '#8E8175',
    marginTop: 3,
  },
});
