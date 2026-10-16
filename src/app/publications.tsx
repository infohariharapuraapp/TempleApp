
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
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
} from 'expo-router';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import { apiRequest } from '@/services/api';

// ========================================
// TYPES
// ========================================

type PublicationCategory = {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  display_order: number;
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

export default function PublicationsScreen() {
  const [categories, setCategories] = useState<
    PublicationCategory[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // ========================================
  // LOAD CATEGORIES
  // ========================================

  const loadCategories = useCallback(async (
    showLoading = true
  ) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      setError('');

      const response = await apiRequest<
        ApiResponse<PublicationCategory[]>
      >('/publications/categories');

      if (!response.success) {
        throw new Error(
          response.message ||
          'Failed to load publication categories'
        );
      }

      setCategories(response.data || []);
    } catch (err) {
      console.error(
        'Publication categories error:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load publications'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh when screen becomes active
  useFocusEffect(
    useCallback(() => {
      void loadCategories();

      return () => {};
    }, [loadCategories])
  );

  // ========================================
  // PULL TO REFRESH
  // ========================================

  const onRefresh = () => {
    setRefreshing(true);
    void loadCategories(false);
  };

  // ========================================
  // CATEGORY ICON
  // ========================================

  const getCategoryIcon = (
    category: PublicationCategory
  ) => {
    if (category.icon?.trim()) {
      return category.icon;
    }

    const name = category.name.toLowerCase();

    if (name.includes('magazine')) {
      return '📰';
    }

    if (name.includes('ebook')) {
      return '📖';
    }

    if (name.includes('book')) {
      return '📚';
    }

    if (
      name.includes('news') ||
      name.includes('update')
    ) {
      return '📢';
    }

    return '📚';
  };

  // ========================================
  // NAVIGATION
  // ========================================

  const openCategory = (
    category: PublicationCategory
  ) => {
    router.push({
      pathname: '/publications/category/[id]',
      params: {
        id: String(category.id),
        name: category.name,
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
        <Text style={styles.smallTitle}>
          TEMPLE RESOURCES
        </Text>

        <Text style={styles.title}>
          Publications 📚
        </Text>

        <Text style={styles.subtitle}>
          Explore books, magazines, news and
          devotional reading material.
        </Text>

        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>
            📖
          </Text>

          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>
              Spiritual Knowledge
            </Text>

            <Text style={styles.bannerText}>
              Discover publications and devotional
              resources from the temple.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Explore Publications
        </Text>

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator
              size="large"
              color="#B66A2C"
            />

            <Text style={styles.message}>
              Loading publications...
            </Text>
          </View>
        )}

        {!loading && error !== '' && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void loadCategories()}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading &&
          !error &&
          categories.length === 0 && (
            <View style={styles.centerBox}>
              <Text style={styles.emptyIcon}>
                📚
              </Text>

              <Text style={styles.emptyTitle}>
                No Publications Available
              </Text>

              <Text style={styles.message}>
                Publication categories will
                appear here once added by
                the temple administration.
              </Text>
            </View>
          )}

        {!loading && !error && (
          <View style={styles.cardContainer}>
            {categories.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => openCategory(item)}
              >
                <View style={styles.iconBox}>
                  <Text style={styles.icon}>
                    {getCategoryIcon(item)}
                  </Text>
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>
                      {item.name}
                    </Text>

                    <Text style={styles.arrow}>
                      ›
                    </Text>
                  </View>

                  {!!item.description && (
                    <Text style={styles.cardText}>
                      {item.description}
                    </Text>
                  )}

                  <Text style={styles.viewText}>
                    Explore ›
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>
            🙏
          </Text>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              Devotional Reading
            </Text>

            <Text style={styles.infoText}>
              Explore spiritual books, magazines,
              articles and downloadable publications
              shared by the temple.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() =>
            router.replace('/(tabs)')
          }
        >
          <Text style={styles.homeButtonText}>
            Back to Home
          </Text>
        </TouchableOpacity>
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
    paddingBottom: 40,
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
    marginBottom: 12,
  },

  cardContainer: {
    gap: 12,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    elevation: 2,
  },

  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F3DEC5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  icon: {
    fontSize: 26,
  },

  cardContent: {
    flex: 1,
  },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A2C18',
    flex: 1,
  },

  arrow: {
    fontSize: 22,
    color: '#B66A2C',
    marginLeft: 8,
  },

  cardText: {
    fontSize: 10,
    lineHeight: 15,
    color: '#777',
    marginTop: 5,
  },

  viewText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B66A2C',
    marginTop: 8,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    elevation: 2,
  },

  infoIcon: {
    fontSize: 27,
    marginRight: 13,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 4,
  },

  infoText: {
    fontSize: 10,
    lineHeight: 15,
    color: '#777',
  },

  homeButton: {
    height: 48,
    borderRadius: 15,
    backgroundColor: '#B66A2C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },

  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  centerBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
    marginBottom: 12,
  },

  retryButton: {
    backgroundColor: '#B66A2C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },

  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  emptyIcon: {
    fontSize: 35,
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A2C18',
    marginTop: 10,
  },
});
