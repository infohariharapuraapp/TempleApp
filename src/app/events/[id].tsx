import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/services/api';

type Category = {
  id: number;
  name: string;
  name_en?: string | null;
  name_te?: string | null;
  name_kn?: string | null;
  name_hi?: string | null;
  name_ta?: string | null;
};

type EventImage = {
  id: number;
  image_url: string;
  display_order: number;
};

type TempleEvent = {
  id: number;
  title: string;
  description?: string | null;
  image_url?: string | null;
  images?: EventImage[];
  event_date?: string | null;
  event_end_date?: string | null;
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
type CategoryLanguage = 'en' | 'te' | 'kn' | 'hi' | 'ta';

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
function validEventTime(value?: string | null): string {
  if (!value) return '';

  const time = value.slice(0, 5);
  return time === '00:00' ? '' : time;
}
export default function EventDetailsScreen() {
  const { id, period } = useLocalSearchParams<{
    id: string;
    period?: string;
  }>();

  const { t, i18n } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();

  const [event, setEvent] = useState<TempleEvent | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);

  const galleryRef = useRef<ScrollView>(null);
  const viewerRef = useRef<ScrollView>(null);

  const galleryWidth = Math.max(screenWidth - 40, 1);

  const currentLanguage = (
    i18n.resolvedLanguage || i18n.language
  ).split('-')[0];

  const locale = LOCALES[currentLanguage] || 'en-IN';

  const galleryImages = event?.images?.length
    ? [...event.images]
        .sort((a, b) => a.display_order - b.display_order)
        .map((image) => image.image_url)
        .filter(Boolean)
    : event?.image_url
      ? [event.image_url]
      : [];

  useEffect(() => {
    if (viewerVisible) {
      const frame = requestAnimationFrame(() => {
        viewerRef.current?.scrollTo({
          x: activeImageIndex * screenWidth,
          animated: false,
        });
      });

      return () => cancelAnimationFrame(frame);
    }
  }, [viewerVisible, screenWidth]);

  const getCategoryName = (eventItem: TempleEvent): string => {
    const category = categories.find(
      (item) => item.id === eventItem.category_id
    );

    if (!category) return eventItem.category_name || '';

    const language: CategoryLanguage =
      CATEGORY_LANGUAGES.includes(
        currentLanguage as CategoryLanguage
      )
        ? (currentLanguage as CategoryLanguage)
        : 'en';

    const translationKey = `name_${language}` as keyof Category;
    const translatedName = category[translationKey];

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

  const loadEvent = useCallback(
    async (showLoader = true) => {
      const eventId = Number(id);

      if (!Number.isSafeInteger(eventId) || eventId <= 0) {
        setEvent(null);
        setError(t('events.invalidEvent'));
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (showLoader) setLoading(true);
      setError('');

      try {
        const firstPeriod: Period =
          period === 'past' ? 'past' : 'upcoming';

        const [firstResponse, categoryResponse] = await Promise.all([
          apiRequest<ApiResponse<TempleEvent[]>>(
            `/events?type=${firstPeriod}`
          ),
          apiRequest<ApiResponse<Category[]>>('/event-categories'),
        ]);

        if (!firstResponse.success || !categoryResponse.success) {
          throw new Error('Failed to load event details');
        }

        const loadedCategories = Array.isArray(categoryResponse.data)
          ? categoryResponse.data
          : [];

        setCategories(loadedCategories);

        const firstEvents = Array.isArray(firstResponse.data)
          ? firstResponse.data
          : [];

        let selected = firstEvents.find(
          (item) => item.id === eventId
        );

        if (!selected) {
          const otherPeriod: Period =
            firstPeriod === 'past' ? 'upcoming' : 'past';

          const otherResponse =
            await apiRequest<ApiResponse<TempleEvent[]>>(
              `/events?type=${otherPeriod}`
            );

          if (!otherResponse.success) {
            throw new Error('Failed to load event');
          }

          const otherEvents = Array.isArray(otherResponse.data)
            ? otherResponse.data
            : [];

          selected = otherEvents.find(
            (item) => item.id === eventId
          );
        }

        setEvent(selected || null);
        setActiveImageIndex(0);
        setViewerVisible(false);
        galleryRef.current?.scrollTo({
          x: 0,
          animated: false,
        });
      } catch (err) {
        console.error('Load event details failed:', err);
        setError(t('events.loadError'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, period, t]
  );

  useFocusEffect(
    useCallback(() => {
      void loadEvent();
    }, [loadEvent])
  );

  function formatDate(value?: string | null): string {
    if (!value) return '—';

    const date = new Date(`${value.slice(0, 10)}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 10);
    }

    return date.toLocaleDateString(locale, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

 function formatDateRange(eventItem: TempleEvent): string {
  const formatShortDate = (value?: string | null): string => {
    if (!value) return '—';

    const date = new Date(`${value.slice(0, 10)}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 10);
    }

    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const start = formatShortDate(eventItem.event_date);
  const end = eventItem.event_end_date;

  if (
    !end ||
    end.slice(0, 10) === eventItem.event_date?.slice(0, 10)
  ) {
    return start;
  }

  return `${start} – ${formatShortDate(end)}`;
}

  function formatTime(value?: string | null): string {
    return value ? value.slice(0, 5) : '';
  }

  const openViewer = (index: number) => {
    setActiveImageIndex(index);
    setViewerVisible(true);
  };

  const onGallerySwipe = (offsetX: number) => {
    const index = Math.round(offsetX / galleryWidth);
    setActiveImageIndex(
      Math.max(0, Math.min(index, galleryImages.length - 1))
    );
  };

  const onViewerSwipe = (offsetX: number) => {
    const index = Math.round(offsetX / screenWidth);
    setActiveImageIndex(
      Math.max(0, Math.min(index, galleryImages.length - 1))
    );
  };

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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>
            ‹ {t('common.back', { defaultValue: 'Back' })}
          </Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#8B4513" />
            <Text style={styles.loadingText}>
              {t('events.detailsLoading')}
            </Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void loadEvent()}
            >
              <Text style={styles.retryText}>
                {t('events.retry')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : !event ? (
          <View style={styles.center}>
            <Text style={styles.empty}>
              {t('events.eventUnavailable')}
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {/* SWIPEABLE EVENT IMAGE GALLERY */}
            {galleryImages.length > 0 ? (
              <View>
                <ScrollView
                  ref={galleryRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) =>
                    onGallerySwipe(
                      e.nativeEvent.contentOffset.x
                    )
                  }
                >
                  {galleryImages.map((uri, index) => (
                    <TouchableOpacity
                      key={`${uri}-${index}`}
                      activeOpacity={0.9}
                      onPress={() => openViewer(index)}
                    >
                      <Image
                        source={{ uri }}
                        style={{
                          width: galleryWidth,
                          height: 260,
                          backgroundColor: '#F8EBDC',
                        }}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {galleryImages.length > 1 && (
                  <View style={styles.galleryCounter}>
                    <Text style={styles.counterText}>
                      {activeImageIndex + 1} / {galleryImages.length}
                    </Text>
                  </View>
                )}

                {galleryImages.length > 1 && (
                  <View style={styles.dotsRow}>
                    {galleryImages.map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.dot,
                          index === activeImageIndex &&
                            styles.activeDot,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderIcon}>🛕</Text>
              </View>
            )}

            <View style={styles.body}>
              <Text style={styles.category}>
                {getCategoryName(event)}
              </Text>

              <Text style={styles.title}>
                {event.title}
              </Text>

              {/* START AND END DATES */}
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>
                  {t('events.detailsDate', { defaultValue: 'Event Dates' })}
                </Text>

                <Text style={styles.infoValue}>
                  📅 {formatDateRange(event)}
                </Text>
              </View>

            {(validEventTime(event.start_time) ||
  validEventTime(event.end_time)) ? (
  <View style={styles.infoBox}>
    <Text style={styles.infoLabel}>
      {t('events.timings')}
    </Text>
    <Text style={styles.infoValue}>
      🕐{' '}
      {validEventTime(event.start_time) &&
      validEventTime(event.end_time)
        ? `${validEventTime(event.start_time)} – ${validEventTime(event.end_time)}`
        : validEventTime(event.start_time)
          ? `Starts at ${validEventTime(event.start_time)}`
          : `Ends at ${validEventTime(event.end_time)}`}
    </Text>
  </View>
) : null}
              {event.location ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>
                    {t('events.location')}
                  </Text>
                  <Text style={styles.infoValue}>
                    📍 {event.location}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>
                {t('events.aboutEvent')}
              </Text>

              <Text style={styles.description}>
                {event.description?.trim() ||
                  t('events.detailsDescriptionFallback')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* FULL-SCREEN IMAGE VIEWER */}
      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerVisible(false)}
        onShow={() => {
          viewerRef.current?.scrollTo({
            x: activeImageIndex * screenWidth,
            animated: false,
          });
        }}
      >
        <View style={styles.viewerContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setViewerVisible(false)}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <ScrollView
            ref={viewerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              onViewerSwipe(e.nativeEvent.contentOffset.x)
            }
          >
            {galleryImages.map((uri, index) => (
              <View
                key={`${uri}-${index}`}
                style={{
                  width: screenWidth,
                  justifyContent: 'center',
                }}
              >
                <Image
                  source={{ uri }}
                  style={{
                    width: screenWidth,
                    height: '75%',
                  }}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          <Text style={styles.viewerCounter}>
            {galleryImages.length
              ? `${activeImageIndex + 1} / ${galleryImages.length}`
              : ''}
          </Text>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
  loadingText: {
    marginTop: 12,
    color: '#776A5D',
    fontSize: 13,
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
  galleryCounter: {
    position: 'absolute',
    bottom: 35,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  counterText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D9C7B5',
  },
  activeDot: {
    width: 17,
    backgroundColor: '#8B4513',
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
    lineHeight: 23,
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
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 45,
    right: 20,
    zIndex: 10,
    padding: 12,
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 26,
  },
  viewerCounter: {
    color: '#FFFFFF',
    textAlign: 'center',
    paddingBottom: 35,
    fontSize: 15,
  },
});
