
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  RefreshControl,
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
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import {
  useTranslation,
} from 'react-i18next';

import {
  apiRequest,
} from '@/services/api';


// ========================================
// TYPES
// ========================================

type Category = {
  id: number;
  name: string;
  name_en?: string | null;
  name_te?: string | null;
  name_kn?: string | null;
  name_hi?: string | null;
  name_ta?: string | null;
};

type TempleEvent = {
  id: number;
  title: string;
  description?: string | null;
  image_url?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  category_id: number;
  category_name: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

type Period = 'upcoming' | 'past';

type CategoryLanguage =
  'en' | 'te' | 'kn' | 'hi' | 'ta';


// ========================================
// LANGUAGE CONFIGURATION
// ========================================

const LOCALES: Record<string, string> = {
  en: 'en-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
};

const CATEGORY_LANGUAGES: CategoryLanguage[] = [
  'en',
  'te',
  'kn',
  'hi',
  'ta',
];


// ========================================
// EVENT DETAILS SCREEN
// ========================================

export default function EventDetailsScreen() {

  const { id, period } = useLocalSearchParams<{
    id: string;
    period?: string;
  }>();

  const { t, i18n } = useTranslation();

  const [event, setEvent] =
    useState<TempleEvent | null>(null);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const currentLanguage =
    i18n.language.split('-')[0];

  const locale =
    LOCALES[currentLanguage] || 'en-IN';


  // ========================================
  // GET TRANSLATED CATEGORY NAME
  // ========================================

  const getCategoryName = (
    eventItem: TempleEvent
  ): string => {

    const category = categories.find(
      item => item.id === eventItem.category_id
    );

    if (!category) {
      return eventItem.category_name || '';
    }

    const language: CategoryLanguage =
      CATEGORY_LANGUAGES.includes(
        currentLanguage as CategoryLanguage
      )
        ? currentLanguage as CategoryLanguage
        : 'en';

    const translationKey =
      `name_${language}` as keyof Category;

    const translatedName =
      category[translationKey];

    if (
      typeof translatedName === 'string' &&
      translatedName.trim()
    ) {
      return translatedName.trim();
    }

    return (
      category.name_en?.trim() ||
      category.name ||
      eventItem.category_name ||
      ''
    );
  };


  // ========================================
  // LOAD EVENT DETAILS
  // ========================================

  const loadEvent = useCallback(
    async (showLoader = true) => {

      const eventId = Number(id);

      if (
        !Number.isSafeInteger(eventId) ||
        eventId <= 0
      ) {

        setEvent(null);

        setError(
          t('events.invalidEvent', {
            defaultValue: 'Invalid event.',
          })
        );

        setLoading(false);
        setRefreshing(false);

        return;
      }

      if (showLoader) {
        setLoading(true);
      }

      setError('');

      try {

        const firstPeriod: Period =
          period === 'past'
            ? 'past'
            : 'upcoming';

        // --------------------------------
        // FETCH EVENT AND CATEGORIES
        // --------------------------------

        const [
          firstResponse,
          categoryResponse,
        ] = await Promise.all([

          apiRequest<ApiResponse<TempleEvent[]>>(
            `/events?type=${firstPeriod}`
          ),

          apiRequest<ApiResponse<Category[]>>(
            '/event-categories'
          ),

        ]);

        setCategories(
          categoryResponse.data || []
        );

        let selected =
          (firstResponse.data || []).find(
            item => item.id === eventId
          );


        // --------------------------------
        // CHECK OTHER PERIOD IF NECESSARY
        // --------------------------------

        if (!selected) {

          const otherPeriod: Period =
            firstPeriod === 'past'
              ? 'upcoming'
              : 'past';

          const otherResponse =
            await apiRequest<
              ApiResponse<TempleEvent[]>
            >(
              `/events?type=${otherPeriod}`
            );

          selected =
            (otherResponse.data || []).find(
              item => item.id === eventId
            );
        }

        setEvent(selected || null);

      } catch (err) {

        console.error(
          'Load event details failed:',
          err
        );

        setError(
          t('events.loadError', {
            defaultValue:
              'Unable to load event details. Please try again.',
          })
        );

      } finally {

        setLoading(false);
        setRefreshing(false);

      }

    },
    [id, period, t]
  );


  // ========================================
  // RELOAD WHEN SCREEN IS FOCUSED
  // ========================================

  useFocusEffect(
    useCallback(() => {

      void loadEvent();

    }, [loadEvent])
  );


  // ========================================
  // FORMAT DATE
  // ========================================

  function formatDate(
    value?: string | null
  ) {

    if (!value) {
      return '—';
    }

    const date = new Date(
      `${value.slice(0, 10)}T12:00:00`
    );

    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 10);
    }

    return date.toLocaleDateString(
      locale,
      {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }
    );
  }


  // ========================================
  // FORMAT TIME
  // ========================================

  function formatTime(
    value?: string | null
  ) {

    return value
      ? value.slice(0, 5)
      : '';
  }


  // ========================================
  // UI
  // ========================================

  return (

    <SafeAreaView style={styles.container}>

      <ScrollView

        contentContainerStyle={styles.content}

        showsVerticalScrollIndicator={false}

        refreshControl={

          <RefreshControl

            refreshing={refreshing}

            onRefresh={() => {

              setRefreshing(true);

              void loadEvent(false);

            }}

          />

        }

      >

        {/* BACK BUTTON */}

        <TouchableOpacity

          style={styles.backButton}

          onPress={() => router.back()}

        >

          <Text style={styles.backText}>

            ‹  {t('common.back', {
              defaultValue: 'Back',
            })}

          </Text>

        </TouchableOpacity>


        {/* LOADING */}

        {loading ? (

          <ActivityIndicator

            size="large"

            color="#8B4513"

            style={styles.center}

          />

        ) : error ? (

          // ERROR

          <View style={styles.center}>

            <Text style={styles.error}>
              {error}
            </Text>

            <TouchableOpacity

              style={styles.retryButton}

              onPress={() => void loadEvent()}

            >

              <Text style={styles.retryText}>

                {t('events.retry', {
                  defaultValue: 'Retry',
                })}

              </Text>

            </TouchableOpacity>

          </View>

        ) : !event ? (

          // EVENT NOT AVAILABLE

          <View style={styles.center}>

            <Text style={styles.empty}>

              {t('events.eventUnavailable', {
                defaultValue:
                  'This event is no longer available.',
              })}

            </Text>

          </View>

        ) : (

          // EVENT DETAILS

          <View style={styles.card}>

            {/* EVENT IMAGE */}

            {event.image_url ? (

              <Image

                source={{
                  uri: event.image_url,
                }}

                style={styles.heroImage}

                resizeMode="contain"

              />

            ) : (

              <View style={styles.placeholder}>

                <Text style={styles.placeholderIcon}>
                  🛕
                </Text>

              </View>

            )}


            <View style={styles.body}>

              {/* TRANSLATED CATEGORY */}

              <Text style={styles.category}>

                {getCategoryName(event)}

              </Text>


              {/* EVENT TITLE */}

              <Text style={styles.title}>

                {event.title}

              </Text>


              {/* EVENT DATE */}

              <View style={styles.infoBox}>

                <Text style={styles.infoLabel}>

                  {t('events.date', {
                    defaultValue: 'Event Date',
                  })}

                </Text>

                <Text style={styles.infoValue}>

                  📅  {formatDate(event.event_date)}

                </Text>

              </View>


              {/* EVENT TIMINGS */}

              {(event.start_time || event.end_time) && (

                <View style={styles.infoBox}>

                  <Text style={styles.infoLabel}>

                    {t('events.timings', {
                      defaultValue: 'Timings',
                    })}

                  </Text>

                  <Text style={styles.infoValue}>

                    🕐  {
                      [
                        formatTime(event.start_time),
                        formatTime(event.end_time),
                      ]
                        .filter(Boolean)
                        .join(' – ')
                    }

                  </Text>

                </View>

              )}


              {/* EVENT LOCATION */}

              {event.location ? (

                <View style={styles.infoBox}>

                  <Text style={styles.infoLabel}>

                    {t('events.location', {
                      defaultValue: 'Location',
                    })}

                  </Text>

                  <Text style={styles.infoValue}>

                    📍  {event.location}

                  </Text>

                </View>

              ) : null}


              {/* EVENT DESCRIPTION */}

              <Text style={styles.sectionTitle}>

                {t('events.aboutEvent', {
                  defaultValue: 'About This Event',
                })}

              </Text>

              <Text style={styles.description}>

                {
                  event.description?.trim() ||

                  t('events.descriptionFallback', {
                    defaultValue:
                      'More details will be available soon.',
                  })
                }

              </Text>

            </View>

          </View>

        )}

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
    backgroundColor: '#FFF9F0',
  },

  content: {
    padding: 20,
    paddingBottom: 50,
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    marginBottom: 12,
  },

  backText: {
    color: '#8B4513',
    fontWeight: '700',
    fontSize: 16,
  },

  center: {
    marginTop: 55,
    alignItems: 'center',
  },

  error: {
    color: '#B3261E',
    textAlign: 'center',
    marginBottom: 18,
  },

  empty: {
    color: '#776A5D',
    textAlign: 'center',
    fontSize: 14,
  },

  retryButton: {
    backgroundColor: '#8B4513',
    borderRadius: 20,
    paddingVertical: 11,
    paddingHorizontal: 25,
  },

  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  card: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    elevation: 2,
  },

  heroImage: {
    width: '100%',
    height: 245,
    backgroundColor: '#F8EBDC',
  },

  placeholder: {
    height: 185,
    backgroundColor: '#F4E0C5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  placeholderIcon: {
    fontSize: 52,
  },

  body: {
    padding: 20,
  },

  category: {
    color: '#B56A22',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 7,
  },

  title: {
    color: '#4A2C18',
    fontWeight: '800',
    fontSize: 24,
    lineHeight: 32,
    marginBottom: 18,
  },

  infoBox: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1E6DB',
  },

  infoLabel: {
    color: '#9A806B',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },

  infoValue: {
    color: '#4A2C18',
    fontSize: 14,
    lineHeight: 21,
  },

  sectionTitle: {
    color: '#4A2C18',
    fontWeight: '800',
    fontSize: 18,
    marginTop: 25,
    marginBottom: 10,
  },

  description: {
    color: '#67594D',
    fontSize: 14,
    lineHeight: 24,
  },

});
