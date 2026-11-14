import { useTranslation } from 'react-i18next';

import React, {
  useCallback,
  useRef,
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
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import { apiRequest } from '@/services/api';

// ========================================
// TYPES
// ========================================

type Publication = {
  id: number;
  category_id: number;
  category_name: string;
  title: string;
  description: string | null;
  image_url: string | null;
  author: string | null;
  publication_date: string | null;
  document_url: string | null;
  is_active: boolean;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

// ========================================
// SCREEN
// ========================================

export default function PublicationCategoryScreen() {
  // PUBLICATIONS_LANGUAGE_V1
  const { t, i18n } = useTranslation();
  const language =
    (i18n.resolvedLanguage ||
      i18n.language ||
      'en').split('-')[0];
  const requestIdRef = useRef(0);
  const localizeError = (value: string) => {
    const key = value.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const translationKey = 'publicationsLocal.' + key;
    return i18n.exists(translationKey)
      ? String(t(translationKey))
      : String(t(
          'publicationsLocal.something_went_wrong_please_try_again'
        ));
  };

  const { id, name } = useLocalSearchParams<{
    id: string;
    name?: string;
  }>();

  const [publications, setPublications] =
    useState<Publication[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const categoryName =
    publications[0]?.category_name ||
    (typeof name === 'string'
      ? name
      : t('publicationsLocal.publications'));

  // ========================================
  // LOAD PUBLICATIONS
  // ========================================

  const loadPublications = useCallback(
    async (showLoading = true) => {
      const currentRequest = ++requestIdRef.current;
    try {
        if (showLoading) {
          setLoading(true);
        }

        setError('');

        const categoryId = Number(id);

        if (
          !Number.isSafeInteger(categoryId) ||
          categoryId <= 0
        ) {
          throw new Error('Invalid publication category');
        }

        const response = await apiRequest<
          ApiResponse<Publication[]>
        >(
          `/publications?category_id=${categoryId}&lang=${encodeURIComponent(language)}`
        );

        if (currentRequest !== requestIdRef.current) {
          return;
        }
        if (!response.success) {
          throw new Error(
            response.message ||
              'Failed to load publications'
          );
        }

        setPublications(response.data || []);
      } catch (err) {
        if (currentRequest !== requestIdRef.current) {
          return;
        }

        console.error(
          'Load category publications:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load publications'
        );
      } finally {
        if (currentRequest === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [id, language]
  );

  useFocusEffect(
    useCallback(() => {
      void loadPublications();
      return () => {
        requestIdRef.current++;
      };
    }, [loadPublications])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void loadPublications(false);
  };

  // ========================================
  // FORMAT DATE
  // ========================================

  const formatDate = (value: string | null) => {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleDateString(language + '-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // ========================================
  // OPEN DETAILS
  // ========================================

  const openDetails = (item: Publication) => {
    router.push({
      pathname: '/publications/details/[id]',
      params: {
        id: String(item.id),
        category_id: String(item.category_id),
      },
    });
  };

  // ========================================
  // UI
  // ========================================

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#B66A2C']}
          />
        }
      >
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>{t('publicationsLocal.back_to_publications')}</Text>
        </TouchableOpacity>

        <Text style={styles.smallTitle}>{t('publicationsLocal.temple_resources')}</Text>

        <Text style={styles.title}>
          {categoryName}
        </Text>

        <Text style={styles.subtitle}>{t('publicationsLocal.explore_spiritual_publications_and_devotional_reading_material')}</Text>

        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>
            📚
          </Text>

          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>
              {categoryName}
            </Text>

            <Text style={styles.bannerText}>{t('publicationsLocal.discover_resources_shared_by_the_temple_administration')}</Text>
          </View>
        </View>

        {!loading && !error && (
          <Text style={styles.sectionTitle}>
            {t('publicationsLocal.available_publications_count', { count: publications.length })}
          </Text>
        )}

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator
              size="large"
              color="#B66A2C"
            />

            <Text style={styles.message}>{t('publicationsLocal.loading_publications')}</Text>
          </View>
        )}

        {!loading && !!error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>
              {localizeError(error)}
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void loadPublications()}
            >
              <Text style={styles.retryText}>{t('publicationsLocal.try_again')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading &&
          !error &&
          publications.length === 0 && (
            <View style={styles.centerBox}>
              <Text style={styles.emptyIcon}>
                📖
              </Text>

              <Text style={styles.emptyTitle}>{t('publicationsLocal.no_publications_yet')}</Text>

              <Text style={styles.message}>{t('publicationsLocal.there_are_currently_no_publications_available_in_this_category')}</Text>
            </View>
          )}

        {!loading && !error && (
          <View style={styles.cardContainer}>
            {publications.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => openDetails(item)}
              >
                <View style={styles.coverBox}>
                  {item.image_url ? (
                    <Image
                      source={{
                        uri: item.image_url,
                      }}
                      style={styles.coverImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.coverIcon}>
                      📖
                    </Text>
                  )}
                </View>

                <View style={styles.cardContent}>
                  <Text
                    style={styles.cardTitle}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>

                  {!!item.author && (
                    <Text style={styles.authorText}>
                      {t('publicationsLocal.by_author', { author: item.author })}
                    </Text>
                  )}

                  {!!item.description && (
                    <Text
                      style={styles.cardText}
                      numberOfLines={3}
                    >
                      {item.description}
                    </Text>
                  )}

                  {!!formatDate(
                    item.publication_date
                  ) && (
                    <Text style={styles.dateText}>
                      {formatDate(
                        item.publication_date
                      )}
                    </Text>
                  )}

                  <Text style={styles.viewText}>{t('publicationsLocal.view_details')}</Text>
                </View>
              </TouchableOpacity>
            ))}
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
    paddingBottom: 45,
  },

  backRow: {
    marginBottom: 20,
  },

  backText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B66A2C',
  },

  smallTitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#B66A2C',
    marginBottom: 4,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#4A2C18',
  },

  subtitle: {
    fontSize: 11,
    color: '#777',
    marginTop: 5,
    marginBottom: 20,
    lineHeight: 17,
  },

  banner: {
    backgroundColor: '#F3DEC5',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },

  bannerIcon: {
    fontSize: 32,
    marginRight: 14,
  },

  bannerContent: {
    flex: 1,
  },

  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 4,
  },

  bannerText: {
    fontSize: 10,
    lineHeight: 15,
    color: '#777',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 14,
  },

  cardContainer: {
    gap: 14,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 13,
    flexDirection: 'row',
    elevation: 2,
  },

  coverBox: {
    width: 100,
    height: 135,
    borderRadius: 12,
    backgroundColor: '#F3DEC5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 14,
  },

  coverImage: {
    width: '100%',
    height: '100%',
  },

  coverIcon: {
    fontSize: 38,
  },

  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 5,
  },

  authorText: {
    fontSize: 11,
    color: '#B66A2C',
    marginBottom: 6,
  },

  cardText: {
    fontSize: 11,
    color: '#777',
    lineHeight: 17,
    marginBottom: 7,
  },

  dateText: {
    fontSize: 10,
    color: '#888',
    marginBottom: 7,
  },

  viewText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B66A2C',
  },

  centerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  message: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 19,
  },

  errorText: {
    fontSize: 12,
    color: '#B42318',
    textAlign: 'center',
    marginBottom: 15,
  },

  retryButton: {
    backgroundColor: '#B66A2C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },

  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  emptyIcon: {
    fontSize: 38,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A2C18',
    marginTop: 12,
  },
});
