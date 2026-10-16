
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Linking,
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

import {
  apiRequest,
} from '@/services/api';

// ========================================
// TYPES
// ========================================

type NearbyCategory = {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  display_order: number;
};

type NearbyPlace = {
  id: number;
  category_id: number;
  category_name: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  google_maps_url: string | null;
  image_url: string | null;
  display_order: number;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

// ========================================
// SCREEN
// ========================================

export default function NearbyScreen() {
  const [categories, setCategories] = useState<
    NearbyCategory[]
  >([]);

  const [places, setPlaces] = useState<
    NearbyPlace[]
  >([]);

  const [selectedCategory, setSelectedCategory] =
    useState<NearbyCategory | null>(null);

  const [loading, setLoading] = useState(true);
  const [placesLoading, setPlacesLoading] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState('');
  const [placesError, setPlacesError] =
    useState('');

  // ========================================
  // FETCH CATEGORIES
  // ========================================

  const loadCategories = useCallback(async () => {
    try {
      setError('');

      const response = await apiRequest<
        ApiResponse<NearbyCategory[]>
      >('/nearby/categories');

      if (!response.success) {
        throw new Error(
          response.message ||
          'Unable to load categories'
        );
      }

      const items = response.data || [];

      setCategories(items);

      setSelectedCategory((current) => {
        if (!current) {
          return null;
        }

        return (
          items.find(
            (item) => item.id === current.id
          ) || null
        );
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load nearby categories'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ========================================
  // FETCH PLACES
  // ========================================

  const loadPlaces = useCallback(
    async (categoryId: number) => {
      try {
        setPlacesLoading(true);
        setPlacesError('');

        const response = await apiRequest<
          ApiResponse<NearbyPlace[]>
        >(
          `/nearby/places?category_id=${categoryId}`
        );

        if (!response.success) {
          throw new Error(
            response.message ||
            'Unable to load places'
          );
        }

        setPlaces(response.data || []);
      } catch (err) {
        setPlaces([]);

        setPlacesError(
          err instanceof Error
            ? err.message
            : 'Unable to load places'
        );
      } finally {
        setPlacesLoading(false);
      }
    },
    []
  );

  // ========================================
  // LOAD ON SCREEN FOCUS
  // ========================================

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadCategories();
    }, [loadCategories])
  );

  // ========================================
  // CATEGORY SELECTION
  // ========================================

  const selectCategory = async (
    category: NearbyCategory
  ) => {
    setSelectedCategory(category);
    setPlaces([]);
    await loadPlaces(category.id);
  };

  // ========================================
  // REFRESH
  // ========================================

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      await loadCategories();

      if (selectedCategory) {
        await loadPlaces(selectedCategory.id);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // ========================================
  // OPEN GOOGLE MAPS
  // ========================================

  const openDirections = async (
    url: string | null
  ) => {
    if (!url) {
      return;
    }

    try {
      const parsed = new URL(url);

      if (parsed.protocol !== 'https:') {
        throw new Error('Invalid maps URL');
      }

      const supportedHosts = [
        'www.google.com',
        'google.com',
        'maps.google.com',
        'maps.app.goo.gl',
        'goo.gl',
      ];

      if (
        !supportedHosts.includes(
          parsed.hostname.toLowerCase()
        )
      ) {
        throw new Error('Unsupported maps URL');
      }

      await Linking.openURL(url);
    } catch (err) {
      setPlacesError(
        'Unable to open Google Maps. Please check the link.'
      );
    }
  };

  // ========================================
  // CALL PLACE
  // ========================================

  const callPlace = async (
    phone: string | null
  ) => {
    if (!phone) {
      return;
    }

    try {
      await Linking.openURL(
        `tel:${phone.replace(/[^\d+]/g, '')}`
      );
    } catch {
      setPlacesError(
        'Unable to open the phone dialer.'
      );
    }
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
            tintColor="#B66A2C"
          />
        }
      >
        <Text style={styles.label}>
          TRAVEL INFORMATION
        </Text>

        <Text style={styles.title}>
          Nearby Places
        </Text>

        <Text style={styles.subtitle}>
          Helpful places and services around
          the temple.
        </Text>

        {/* TEMPLE LOCATION */}

        <View style={styles.locationCard}>
          <View style={styles.locationIcon}>
            <Text style={styles.locationEmoji}>
              📍
            </Text>
          </View>

          <View style={styles.locationContent}>
            <Text style={styles.locationTitle}>
              Temple Location
            </Text>

            <Text style={styles.locationText}>
              Explore useful places and services
              near the temple.
            </Text>
          </View>
        </View>

        {/* CATEGORIES */}

        <Text style={styles.sectionTitle}>
          Explore Nearby
        </Text>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator
              size="large"
              color="#B66A2C"
            />

            <Text style={styles.helperText}>
              Loading nearby categories...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setLoading(true);
                void loadCategories();
              }}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        ) : categories.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyEmoji}>
              📍
            </Text>

            <Text style={styles.emptyTitle}>
              No Nearby Categories
            </Text>

            <Text style={styles.helperText}>
              Nearby places will appear here
              when added by the temple.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {categories.map((category, index) => {
              const isSelected =
                selectedCategory?.id ===
                category.id;

              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.item,
                    index ===
                      categories.length - 1 &&
                      styles.lastItem,
                    isSelected &&
                      styles.selectedItem,
                  ]}
                  activeOpacity={0.8}
                  onPress={() =>
                    void selectCategory(category)
                  }
                >
                  <View style={styles.itemIcon}>
                    <Text style={styles.itemEmoji}>
                      {category.icon || '📍'}
                    </Text>
                  </View>

                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle}>
                      {category.name}
                    </Text>

                    {category.description ? (
                      <Text
                        style={
                          styles.itemDescription
                        }
                      >
                        {category.description}
                      </Text>
                    ) : null}
                  </View>

                  <Text style={styles.arrow}>
                    {isSelected ? '⌄' : '›'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* SELECTED CATEGORY PLACES */}

        {selectedCategory && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {selectedCategory.icon || '📍'}{' '}
                {selectedCategory.name}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setSelectedCategory(null);
                  setPlaces([]);
                  setPlacesError('');
                }}
              >
                <Text style={styles.closeText}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>

            {placesLoading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator
                  color="#B66A2C"
                  size="large"
                />

                <Text style={styles.helperText}>
                  Loading places...
                </Text>
              </View>
            ) : placesError ? (
              <View style={styles.centerBox}>
                <Text style={styles.errorText}>
                  {placesError}
                </Text>

                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() =>
                    void loadPlaces(
                      selectedCategory.id
                    )
                  }
                >
                  <Text style={styles.retryText}>
                    Retry
                  </Text>
                </TouchableOpacity>
              </View>
            ) : places.length === 0 ? (
              <View style={styles.centerBox}>
                <Text style={styles.emptyEmoji}>
                  🗺️
                </Text>

                <Text style={styles.emptyTitle}>
                  No Places Available
                </Text>

                <Text style={styles.helperText}>
                  Places in this category will
                  be added soon.
                </Text>
              </View>
            ) : (
              places.map((place) => (
                <View
                  key={place.id}
                  style={styles.placeCard}
                >
                  <Text style={styles.placeName}>
                    {place.name}
                  </Text>

                  {place.description ? (
                    <Text
                      style={
                        styles.placeDescription
                      }
                    >
                      {place.description}
                    </Text>
                  ) : null}

                  {place.address ? (
                    <View style={styles.infoRow}>
                      <Text
                        style={styles.infoIcon}
                      >
                        📍
                      </Text>

                      <Text
                        style={styles.infoText}
                      >
                        {place.address}
                      </Text>
                    </View>
                  ) : null}

                  {place.phone ? (
                    <TouchableOpacity
                      style={styles.infoRow}
                      onPress={() =>
                        void callPlace(place.phone)
                      }
                    >
                      <Text
                        style={styles.infoIcon}
                      >
                        📞
                      </Text>

                      <Text
                        style={styles.phoneText}
                      >
                        {place.phone}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {place.google_maps_url ? (
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={() =>
                        void openDirections(
                          place.google_maps_url
                        )
                      }
                    >
                      <Text
                        style={
                          styles.primaryButtonText
                        }
                      >
                        🗺️ Get Directions
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
          </View>
        )}

        {/* HOME */}

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

  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#B66A2C',
    marginBottom: 5,
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

  locationCard: {
    backgroundColor: '#F3DEC5',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },

  locationIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  locationEmoji: {
    fontSize: 23,
  },

  locationContent: {
    flex: 1,
  },

  locationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 4,
  },

  locationText: {
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

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    elevation: 2,
    marginBottom: 25,
  },

  item: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE3D8',
  },

  lastItem: {
    borderBottomWidth: 0,
  },

  selectedItem: {
    backgroundColor: '#FFF4E8',
  },

  itemIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: '#F8EBDD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  itemEmoji: {
    fontSize: 20,
  },

  itemContent: {
    flex: 1,
    paddingVertical: 12,
  },

  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 3,
  },

  itemDescription: {
    fontSize: 9,
    lineHeight: 14,
    color: '#777',
  },

  arrow: {
    fontSize: 22,
    color: '#B66A2C',
    marginLeft: 8,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  closeText: {
    color: '#B66A2C',
    fontSize: 12,
    fontWeight: '700',
  },

  placeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 17,
    marginBottom: 15,
    elevation: 2,
  },

  placeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 7,
  },

  placeDescription: {
    fontSize: 11,
    lineHeight: 18,
    color: '#777',
    marginBottom: 12,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },

  infoIcon: {
    fontSize: 15,
    marginRight: 9,
  },

  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 18,
    color: '#66594F',
  },

  phoneText: {
    fontSize: 12,
    color: '#B66A2C',
    fontWeight: '600',
  },

  primaryButton: {
    minHeight: 45,
    borderRadius: 13,
    backgroundColor: '#B66A2C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  homeButton: {
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D5C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },

  homeButtonText: {
    color: '#4A2C18',
    fontSize: 13,
    fontWeight: '600',
  },

  centerBox: {
    minHeight: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
  },

  helperText: {
    fontSize: 11,
    color: '#777',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 10,
  },

  errorText: {
    fontSize: 12,
    color: '#B42318',
    textAlign: 'center',
    marginBottom: 12,
  },

  retryButton: {
    backgroundColor: '#F8EBDD',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  retryText: {
    color: '#4A2C18',
    fontWeight: '700',
    fontSize: 12,
  },

  emptyEmoji: {
    fontSize: 30,
    marginBottom: 10,
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A2C18',
  },
});
