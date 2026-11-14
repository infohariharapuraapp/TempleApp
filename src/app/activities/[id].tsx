
import React, {
  useEffect,
  useState,
} from 'react';

import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  useTranslation,
} from 'react-i18next';

import { apiRequest } from '@/services/api';

// ========================================
// TYPES
// ========================================

type Activity = {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  activity_date: string | null;
  location: string | null;
  section_id: number;
  section_name: string | null;
  section_description: string | null;
  section_icon: string | null;
  section_image_url: string | null;
  display_order: number;
  is_active: boolean;
};

// ========================================
// DATE LOCALES
// ========================================

const DATE_LOCALES: Record<string, string> = {
  en: 'en-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
};

// ========================================
// ACTIVITY DETAILS SCREEN
// ========================================

export default function ActivityDetailsScreen() {

  const { t, i18n } = useTranslation();

  const { id } =
    useLocalSearchParams<{ id: string }>();

  const [activity, setActivity] =
    useState<Activity | null>(null);

  const [loading, setLoading] =
    useState(true);

  const language = (
    i18n.resolvedLanguage || i18n.language || 'en'
  ).split('-')[0].toLowerCase();

  const dateLocale =
    DATE_LOCALES[language] || 'en-IN';

  // ========================================
  // LOAD ACTIVITY DETAILS
  // ========================================

  useEffect(() => {
    let active = true;
    loadActivity(() => active);
    return () => {
      active = false;
    };
  }, [id, language]);

  const loadActivity = async (isActive: () => boolean) => {

    try {

      setLoading(true);
      setActivity(null);

      const response = await apiRequest<{
        success: boolean;
        data: Activity;
      }>(
        `/activities/${encodeURIComponent(id)}?lang=${encodeURIComponent(language)}`
      );

      if (!isActive()) return;
      if (response.success && response.data) {
        setActivity(response.data);
      }

    } catch (error) {

      console.error(
        'Activity details loading error:',
        error
      );

    } finally {
      if (isActive()) setLoading(false);

    }

  };

  // ========================================
  // LOADING SCREEN
  // ========================================

  if (loading) {

    return (

      <SafeAreaView style={styles.container}>

        <View style={styles.center}>

          <Text style={styles.icon}>
            🙏
          </Text>

          <Text style={styles.loadingText}>
            {t('activityDetails.loading')}
          </Text>

        </View>

      </SafeAreaView>

    );

  }

  // ========================================
  // ACTIVITY NOT FOUND
  // ========================================

  if (!activity) {

    return (

      <SafeAreaView style={styles.container}>

        <View style={styles.center}>

          <Text style={styles.icon}>
            🙏
          </Text>

          <Text style={styles.notFoundTitle}>
            {t('activityDetails.notFound')}
          </Text>

          <Text style={styles.notFoundText}>
            {t('activityDetails.notFoundText')}
          </Text>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >

            <Text style={styles.backButtonText}>
              {t('activityDetails.goBack')}
            </Text>

          </TouchableOpacity>

        </View>

      </SafeAreaView>

    );

  }

  // ========================================
  // FORMAT DATE
  // ========================================

  const formattedDate = (() => {

    if (!activity.activity_date) {
      return null;
    }

    const date = new Date(
      activity.activity_date
    );

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleDateString(
      dateLocale,
      {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }
    );

  })();

  // ========================================
  // MAIN SCREEN
  // ========================================

  return (

    <SafeAreaView style={styles.container}>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

        {/* HEADER */}

        <View style={styles.header}>

          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => router.back()}
          >

            <Text style={styles.backIcon}>
              ‹
            </Text>

          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            {t('activityDetails.title')}
          </Text>

          <View style={styles.headerSpacer} />

        </View>

        {/* IMAGE */}

        {activity.image_url ? (

          <Image
            source={{
              uri: activity.image_url,
            }}
            style={styles.image}
          />

        ) : (

          <View style={styles.imagePlaceholder}>

            <Text style={styles.placeholderIcon}>
              🛕
            </Text>

          </View>

        )}

        {/* ACTIVITY TITLE */}

        <View style={styles.titleSection}>

          <Text style={styles.title}>
            {activity.title}
          </Text>

          <View style={styles.divider} />

        </View>

        {/* DATE */}

        {formattedDate ? (

          <View style={styles.infoCard}>

            <Text style={styles.infoIcon}>
              📅
            </Text>

            <View style={styles.infoContent}>

              <Text style={styles.infoLabel}>
                {t('activityDetails.date')}
              </Text>

              <Text style={styles.infoValue}>
                {formattedDate}
              </Text>

            </View>

          </View>

        ) : null}

        {/* LOCATION */}

        {activity.location ? (

          <View style={styles.infoCard}>

            <Text style={styles.infoIcon}>
              📍
            </Text>

            <View style={styles.infoContent}>

              <Text style={styles.infoLabel}>
                {t('activityDetails.location')}
              </Text>

              <Text style={styles.infoValue}>
                {activity.location}
              </Text>

            </View>

          </View>

        ) : null}

        {/* DESCRIPTION */}

        <View style={styles.sectionCard}>

          <Text style={styles.sectionTitle}>
            {t('activityDetails.about')}
          </Text>

          <Text style={styles.description}>
            {activity.description ||
              t('activityDetails.descriptionFallback')}
          </Text>

        </View>

        {/* DEVOTIONAL MESSAGE */}

        <View style={styles.messageCard}>

          <Text style={styles.messageIcon}>
            🪔
          </Text>

          <Text style={styles.messageText}>
            {t('activityDetails.blessing')}
          </Text>

        </View>

        {/* BACK TO ACTIVITIES */}

        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => router.back()}
        >

          <Text style={styles.bottomButtonText}>
            {t('activityDetails.backToActivities')}
          </Text>

        </TouchableOpacity>

      </ScrollView>

    </SafeAreaView>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#FFF9F0',
  },

  content: {
    paddingBottom: 40,
  },

  header: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },

  backIcon: {
    fontSize: 32,
    color: '#4A2C18',
    marginTop: -3,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4A2C18',
  },

  headerSpacer: {
    width: 40,
  },

  image: {
    width: '100%',
    height: 280,
    backgroundColor: '#F0E6DA',
  },

  imagePlaceholder: {
    width: '100%',
    height: 280,
    backgroundColor: '#F0E6DA',
    justifyContent: 'center',
    alignItems: 'center',
  },

  placeholderIcon: {
    fontSize: 60,
  },

  titleSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 10,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#4A2C18',
    textAlign: 'center',
  },

  divider: {
    width: 55,
    height: 2,
    backgroundColor: '#C98A4A',
    marginTop: 12,
  },

  infoCard: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },

  infoIcon: {
    fontSize: 24,
    marginRight: 13,
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B66A2C',
    letterSpacing: 1,
    marginBottom: 3,
  },

  infoValue: {
    fontSize: 13,
    color: '#4A2C18',
    fontWeight: '600',
  },

  sectionCard: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 9,
  },

  description: {
    fontSize: 13,
    lineHeight: 21,
    color: '#6F6259',
  },

  messageCard: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: '#F3DEC5',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },

  messageIcon: {
    fontSize: 30,
    marginBottom: 8,
  },

  messageText: {
    fontSize: 12,
    lineHeight: 19,
    color: '#6D5140',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  bottomButton: {
    marginHorizontal: 20,
    marginTop: 22,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#B66A2C',
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottomButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  icon: {
    fontSize: 45,
    marginBottom: 12,
  },

  loadingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A2C18',
  },

  notFoundTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 8,
  },

  notFoundText: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    marginBottom: 20,
  },

  backButton: {
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#B66A2C',
  },

  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

});
