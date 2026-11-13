
import AutoTranslatedText from '@/components/AutoTranslatedText';
import { apiRequest } from '@/services/api';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState,  useEffect, } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
    BackHandler,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  background: '#FFFDF8',
  white: '#FFFFFF',
  maroon: '#6B1720',
  gold: '#C69A3A',
  paleGold: '#F7EBD7',
  text: '#342B26',
  muted: '#82776D',
  border: '#EEE5D8',
};

const SCREEN_WIDTH = Dimensions.get('window').width;

type Category = {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  display_order: number;
};

type Place = {
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

type PlaceImage = {
  id: number;
  place_id: number;
  image_url: string;
  display_order: number;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type ScreenMode = 'categories' | 'places' | 'details';

function getMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

function validImageUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validMapsUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      [
        'google.com',
        'www.google.com',
        'maps.google.com',
        'maps.app.goo.gl',
        'goo.gl',
      ].includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

async function openDirections(url: string | null) {
  if (!url || !validMapsUrl(url)) {
    Alert.alert('Directions', 'A valid Google Maps link is unavailable.');
    return;
  }

  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Directions', 'Unable to open Google Maps.');
  }
}

async function callPlace(phone: string | null) {
  if (!phone) return;

  const cleaned = phone.replace(/[^\d+]/g, '');

  if (!cleaned) return;

  try {
    await Linking.openURL(`tel:${cleaned}`);
  } catch {
    Alert.alert('Phone', 'Unable to open the phone dialer.');
  }
}

function SectionLoading({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={C.maroon} size="large" />
      <AutoTranslatedText style={styles.helper}>
        {message}
      </AutoTranslatedText>
    </View>
  );
}

function EmptyState({
  emoji,
  title,
  message,
  onRetry,
}: {
  emoji: string;
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <AutoTranslatedText style={styles.emptyTitle}>
        {title}
      </AutoTranslatedText>
      <AutoTranslatedText style={styles.helper}>
        {message}
      </AutoTranslatedText>
      {onRetry && (
        <TouchableOpacity style={styles.retry} onPress={onRetry}>
          <AutoTranslatedText style={styles.retryText}>
            Try Again
          </AutoTranslatedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function NearbyScreen() {
  const [mode, setMode] = useState<ScreenMode>('categories');

  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);

  const [category, setCategory] = useState<Category | null>(null);
  const [place, setPlace] = useState<Place | null>(null);

  const [loading, setLoading] = useState(true);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState('');
  const [placesError, setPlacesError] = useState('');
  const [galleryError, setGalleryError] = useState('');

  const [imageIndex, setImageIndex] = useState(0);

  const galleryRef = useRef<ScrollView>(null);
  const requestId = useRef(0);
  const galleryRequestId = useRef(0);

  const loadCategories = useCallback(async () => {
    try {
      setError('');

      const response = await apiRequest<ApiResponse<Category[]>>(
        '/nearby/categories'
      );

      if (!response.success) {
        throw new Error(response.message || 'Unable to load categories');
      }

      setCategories(response.data || []);
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlaces = useCallback(async (categoryId: number) => {
    const currentRequest = ++requestId.current;

    setPlacesLoading(true);
    setPlacesError('');

    try {
      const response = await apiRequest<ApiResponse<Place[]>>(
        `/nearby/places?category_id=${categoryId}`
      );

      if (currentRequest !== requestId.current) return;

      if (!response.success) {
        throw new Error(response.message || 'Unable to load places');
      }

      setPlaces(response.data || []);
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      setPlaces([]);
      setPlacesError(getMessage(err));
    } finally {
      if (currentRequest === requestId.current) {
        setPlacesLoading(false);
      }
    }
  }, []);

  const loadGallery = useCallback(async (selectedPlace: Place) => {
    const currentRequest = ++galleryRequestId.current;

    setGalleryLoading(true);
    setGalleryError('');
    setImageIndex(0);

    try {
      const response = await apiRequest<ApiResponse<PlaceImage[]>>(
        `/nearby/places/${selectedPlace.id}/images`
      );

      if (currentRequest !== galleryRequestId.current) return;

      if (!response.success) {
        throw new Error(response.message || 'Unable to load photos');
      }

      const urls: string[] = [];

      // Preserve the original image_url as the first photo.
      if (validImageUrl(selectedPlace.image_url)) {
        urls.push(selectedPlace.image_url!);
      }

      for (const item of response.data || []) {
        if (
          validImageUrl(item.image_url) &&
          !urls.includes(item.image_url)
        ) {
          urls.push(item.image_url);
        }
      }

      setGallery(urls);
    } catch (err) {
      if (currentRequest !== galleryRequestId.current) return;

      setGalleryError(getMessage(err));

      setGallery(
        validImageUrl(selectedPlace.image_url)
          ? [selectedPlace.image_url!]
          : []
      );
    } finally {
      if (currentRequest === galleryRequestId.current) {
        setGalleryLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadCategories();

      return () => {
        requestId.current++;
        galleryRequestId.current++;
      };
    }, [loadCategories])
  );

  const selectCategory = (item: Category) => {
    setCategory(item);
    setPlace(null);
    setPlaces([]);
    setMode('places');
    void loadPlaces(item.id);
  };

  const selectPlace = (item: Place) => {
    setPlace(item);
    setGallery(
      validImageUrl(item.image_url)
        ? [item.image_url!]
        : []
    );
    setMode('details');
    void loadGallery(item);
  };

  const goBack = () => {
    if (mode === 'details') {
      galleryRequestId.current++;
      setPlace(null);
      setGallery([]);
      setMode('places');
    } else if (mode === 'places') {
      requestId.current++;
      setCategory(null);
      setPlaces([]);
      setMode('categories');
    } else {
      router.back();
    }
  };
  useEffect(() => {
  if (mode === 'categories') {
    return;
  }

  const subscription = BackHandler.addEventListener(
    'hardwareBackPress',
    () => {
      if (mode === 'details') {
        galleryRequestId.current++;
        setPlace(null);
        setGallery([]);
        setMode('places');
        return true;
      }

      if (mode === 'places') {
        requestId.current++;
        setCategory(null);
        setPlaces([]);
        setMode('categories');
        return true;
      }

      return false;
    }
  );

  return () => subscription.remove();
}, [mode]);

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      if (mode === 'categories') {
        await loadCategories();
      } else if (mode === 'places' && category) {
        await loadPlaces(category.id);
      } else if (mode === 'details' && place) {
        await loadGallery(place);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const galleryWidth = SCREEN_WIDTH - 40;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={goBack}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        <View style={styles.topTitleWrap}>
          <AutoTranslatedText style={styles.topEyebrow}>
            DIVYAKSHETRA HARIHARAPURA
          </AutoTranslatedText>
          <AutoTranslatedText style={styles.topTitle}>
            Nearby Places
          </AutoTranslatedText>
        </View>

        <View style={styles.topRight}>
          <Text style={{ fontSize: 21 }}>📍</Text>
        </View>
      </View>

      <ScrollView
        key={mode}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={C.maroon}
          />
        }
      >
        {mode === 'categories' && (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroEmoji}>🛕</Text>

              <AutoTranslatedText style={styles.heroLabel}>
                YOUR TEMPLE TRAVEL COMPANION
              </AutoTranslatedText>

              <AutoTranslatedText style={styles.heroTitle}>
                Explore Around Hariharapura
              </AutoTranslatedText>

              <AutoTranslatedText style={styles.heroDescription}>
                Discover beautiful destinations and useful services
                near the temple.
              </AutoTranslatedText>

              <View style={styles.heroDecoration} />
            </View>

            <View style={styles.sectionHeading}>
              <View>
                <AutoTranslatedText style={styles.sectionEyebrow}>
                  DISCOVER
                </AutoTranslatedText>
                <AutoTranslatedText style={styles.sectionTitle}>
                  Explore Categories
                </AutoTranslatedText>
              </View>
              <Text style={styles.countBadge}>
                {categories.length}
              </Text>
            </View>

            {loading ? (
              <SectionLoading message="Loading nearby categories..." />
            ) : error ? (
              <EmptyState
                emoji="⚠️"
                title="Unable to Load"
                message={error}
                onRetry={() => {
                  setLoading(true);
                  void loadCategories();
                }}
              />
            ) : categories.length === 0 ? (
              <EmptyState
                emoji="🗺️"
                title="No Categories Available"
                message="Nearby places will appear here when added by the temple."
              />
            ) : (
              <View style={styles.categoryGrid}>
                {categories.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.categoryCard}
                    activeOpacity={0.85}
                    onPress={() => selectCategory(item)}
                  >
                    <View style={styles.categoryIcon}>
                      <Text style={styles.categoryEmoji}>
                        {item.icon || '📍'}
                      </Text>
                    </View>

                    <Text style={styles.categoryName} numberOfLines={2}>
                      {item.name}
                    </Text>

                    <Text
                      style={styles.categoryDescription}
                      numberOfLines={3}
                    >
                      {item.description || 'Explore nearby places'}
                    </Text>

                    <View style={styles.categoryFooter}>
                      <AutoTranslatedText style={styles.exploreText}>
                        Explore
                      </AutoTranslatedText>
                      <Text style={styles.smallArrow}>→</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {mode === 'places' && category && (
          <>
            <View style={styles.categoryBanner}>
              <View style={styles.bannerIcon}>
                <Text style={{ fontSize: 35 }}>
                  {category.icon || '📍'}
                </Text>
              </View>

              <Text style={styles.bannerTitle}>{category.name}</Text>

              {category.description && (
                <Text style={styles.bannerDescription}>
                  {category.description}
                </Text>
              )}
            </View>

            <View style={styles.sectionHeading}>
              <View>
                <AutoTranslatedText style={styles.sectionEyebrow}>
                  EXPLORE DESTINATIONS
                </AutoTranslatedText>
                <AutoTranslatedText style={styles.sectionTitle}>
                  Places to Discover
                </AutoTranslatedText>
              </View>

              {!placesLoading && (
                <Text style={styles.countBadge}>{places.length}</Text>
              )}
            </View>

            {placesLoading ? (
              <SectionLoading message="Loading places..." />
            ) : placesError ? (
              <EmptyState
                emoji="⚠️"
                title="Unable to Load Places"
                message={placesError}
                onRetry={() => void loadPlaces(category.id)}
              />
            ) : places.length === 0 ? (
              <EmptyState
                emoji="🏞️"
                title="No Places Available"
                message="Places in this category will be added soon."
              />
            ) : (
              places.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.placeCard}
                  activeOpacity={0.88}
                  onPress={() => selectPlace(item)}
                >
                  <View style={styles.placeCover}>
                    {validImageUrl(item.image_url) ? (
                      <Image
                        source={{ uri: item.image_url! }}
                        style={styles.coverImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Text style={{ fontSize: 45 }}>🏞️</Text>
                      </View>
                    )}

                    <View style={styles.imageBadge}>
                      <AutoTranslatedText style={styles.imageBadgeText}>
                        EXPLORE
                      </AutoTranslatedText>
                    </View>
                  </View>

                  <View style={styles.placeBody}>
                    <Text style={styles.placeName}>
                      {item.name}
                    </Text>

                    {item.description && (
                      <Text
                        style={styles.placeDescription}
                        numberOfLines={2}
                      >
                        {item.description}
                      </Text>
                    )}

                    {item.address && (
                      <View style={styles.addressRow}>
                        <Text style={styles.addressIcon}>📍</Text>
                        <Text style={styles.addressText} numberOfLines={2}>
                          {item.address}
                        </Text>
                      </View>
                    )}

                    <View style={styles.placeFooter}>
                      <AutoTranslatedText style={styles.detailsLink}>
                        View Details
                      </AutoTranslatedText>
                      <Text style={styles.detailsArrow}>→</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {mode === 'details' && place && (
          <>
            <View style={styles.galleryContainer}>
              {gallery.length > 0 ? (
                <>
                  <ScrollView
                    ref={galleryRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={event => {
                      const index = Math.round(
                        event.nativeEvent.contentOffset.x / galleryWidth
                      );
                      setImageIndex(
                        Math.max(0, Math.min(index, gallery.length - 1))
                      );
                    }}
                  >
                    {gallery.map((url, index) => (
                      <Image
                        key={`${url}-${index}`}
                        source={{ uri: url }}
                        style={{
                          width: galleryWidth,
                          height: 270,
                        }}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>

                  <View style={styles.galleryCounter}>
                    <Text style={styles.galleryCounterText}>
                      {imageIndex + 1} / {gallery.length}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.detailPlaceholder}>
                  <Text style={{ fontSize: 65 }}>🏞️</Text>
                  <AutoTranslatedText style={styles.helper}>
                    Photos coming soon
                  </AutoTranslatedText>
                </View>
              )}
            </View>

            {gallery.length > 1 && (
              <View style={styles.dots}>
                {gallery.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      galleryRef.current?.scrollTo({
                        x: index * galleryWidth,
                        animated: true,
                      });
                      setImageIndex(index);
                    }}
                    style={[
                      styles.dot,
                      imageIndex === index && styles.activeDot,
                    ]}
                  />
                ))}
              </View>
            )}

            {galleryLoading && (
              <View style={styles.galleryLoading}>
                <ActivityIndicator color={C.maroon} size="small" />
                <AutoTranslatedText style={styles.helper}>
                  Loading photos...
                </AutoTranslatedText>
              </View>
            )}

            {galleryError && (
              <TouchableOpacity
                style={styles.galleryError}
                onPress={() => void loadGallery(place)}
              >
                <Text style={styles.galleryErrorText}>
                  Gallery unavailable. Tap to retry.
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.detailsHeader}>
              <Text style={styles.detailsCategory}>
                {category?.icon || '📍'} {place.category_name || category?.name}
              </Text>
              <Text style={styles.detailsTitle}>{place.name}</Text>
            </View>

            {place.description && (
              <View style={styles.infoCard}>
                <AutoTranslatedText style={styles.infoHeading}>
                  About This Place
                </AutoTranslatedText>
                <Text style={styles.fullDescription}>
                  {place.description}
                </Text>
              </View>
            )}

            {place.address && (
              <View style={styles.infoCard}>
                <AutoTranslatedText style={styles.infoHeading}>
                  Location & Address
                </AutoTranslatedText>
                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>📍</Text>
                  <Text style={styles.infoValue}>
                    {place.address}
                  </Text>
                </View>
              </View>
            )}

            {place.phone && (
              <View style={styles.infoCard}>
                <AutoTranslatedText style={styles.infoHeading}>
                  Contact Information
                </AutoTranslatedText>
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={() => void callPlace(place.phone)}
                >
                  <Text style={styles.infoEmoji}>📞</Text>
                  <Text style={styles.phoneValue}>{place.phone}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.actionRow}>
              {place.google_maps_url && (
                <TouchableOpacity
                  style={styles.directionsButton}
                  activeOpacity={0.85}
                  onPress={() => void openDirections(place.google_maps_url)}
                >
                  <AutoTranslatedText style={styles.directionsText}>
                    🗺️ Get Directions
                  </AutoTranslatedText>
                </TouchableOpacity>
              )}

              {place.phone && (
                <TouchableOpacity
                  style={styles.callButton}
                  activeOpacity={0.85}
                  onPress={() => void callPlace(place.phone)}
                >
                  <Text style={styles.callText}>📞</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.morePlaces}
              onPress={goBack}
            >
              <AutoTranslatedText style={styles.morePlacesText}>
                ← Explore More Places
              </AutoTranslatedText>
            </TouchableOpacity>
          </>
        )}

        {mode === 'categories' && (
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <AutoTranslatedText style={styles.homeText}>
              Back to Home
            </AutoTranslatedText>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 55,
  },
  topBar: {
    height: 65,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.paleGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 30,
    color: C.maroon,
    marginTop: -4,
  },
  topTitleWrap: {
    flex: 1,
    marginLeft: 13,
  },
  topEyebrow: {
    fontSize: 8,
    color: C.gold,
    fontWeight: '800',
    letterSpacing: 1,
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.maroon,
    marginTop: 3,
  },
  topRight: {
    width: 36,
    alignItems: 'center',
  },
  hero: {
    minHeight: 220,
    borderRadius: 24,
    backgroundColor: C.maroon,
    padding: 25,
    marginBottom: 28,
    overflow: 'hidden',
  },
  heroEmoji: {
    fontSize: 35,
    marginBottom: 14,
  },
  heroLabel: {
    color: '#F1CD83',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 9,
  },
  heroTitle: {
    color: C.white,
    fontSize: 25,
    lineHeight: 33,
    fontWeight: '800',
    maxWidth: 270,
  },
  heroDescription: {
    color: '#F3DDE0',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
    maxWidth: 270,
  },
  heroDecoration: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 25,
    borderColor: '#FFFFFF12',
    right: -75,
    bottom: -65,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 17,
  },
  sectionEyebrow: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: C.text,
  },
  countBadge: {
    color: C.maroon,
    backgroundColor: C.paleGold,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    fontWeight: '800',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    minHeight: 190,
    padding: 16,
    marginBottom: 15,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    elevation: 2,
  },
  categoryIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: C.paleGold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryEmoji: {
    fontSize: 27,
  },
  categoryName: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    color: C.text,
    marginBottom: 5,
  },
  categoryDescription: {
    fontSize: 10,
    lineHeight: 15,
    color: C.muted,
    flexGrow: 1,
  },
  categoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  exploreText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.maroon,
  },
  smallArrow: {
    color: C.maroon,
    fontSize: 18,
  },
  categoryBanner: {
    padding: 23,
    backgroundColor: C.paleGold,
    borderRadius: 23,
    marginBottom: 27,
    alignItems: 'center',
  },
  bannerIcon: {
    width: 72,
    height: 72,
    backgroundColor: C.white,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  bannerTitle: {
    color: C.maroon,
    fontSize: 23,
    fontWeight: '800',
    textAlign: 'center',
  },
  bannerDescription: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 9,
  },
  placeCard: {
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 3,
  },
  placeCover: {
    height: 200,
    backgroundColor: C.paleGold,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageBadge: {
    position: 'absolute',
    right: 13,
    top: 13,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: C.maroon,
  },
  imageBadgeText: {
    color: C.white,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  placeBody: {
    padding: 18,
  },
  placeName: {
    fontSize: 19,
    fontWeight: '800',
    color: C.text,
    marginBottom: 7,
  },
  placeDescription: {
    fontSize: 12,
    lineHeight: 20,
    color: C.muted,
    marginBottom: 13,
  },
  addressRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  addressIcon: {
    fontSize: 13,
    marginRight: 7,
  },
  addressText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: C.muted,
  },
  placeFooter: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailsLink: {
    color: C.maroon,
    fontWeight: '800',
    fontSize: 12,
  },
  detailsArrow: {
    color: C.maroon,
    fontSize: 18,
  },
  galleryContainer: {
    height: 270,
    backgroundColor: C.paleGold,
    borderRadius: 22,
    overflow: 'hidden',
  },
  detailPlaceholder: {
    height: 270,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryCounter: {
    position: 'absolute',
    bottom: 13,
    right: 13,
    backgroundColor: '#241B1BCC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  galleryCounterText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '800',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 15,
    marginBottom: 8,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 5,
    backgroundColor: '#DDCDB7',
  },
  activeDot: {
    width: 20,
    backgroundColor: C.maroon,
  },
  galleryLoading: {
    alignItems: 'center',
    marginTop: 12,
  },
  galleryError: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFF1EF',
  },
  galleryErrorText: {
    color: '#B42318',
    fontSize: 11,
    textAlign: 'center',
  },
  detailsHeader: {
    marginTop: 24,
    marginBottom: 20,
  },
  detailsCategory: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 9,
  },
  detailsTitle: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '800',
    color: C.maroon,
  },
  infoCard: {
    backgroundColor: C.white,
    borderRadius: 17,
    padding: 19,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
    marginBottom: 13,
  },
  fullDescription: {
    fontSize: 13,
    lineHeight: 23,
    color: '#655B52',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoEmoji: {
    fontSize: 17,
    marginRight: 11,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 21,
    color: '#655B52',
  },
  phoneValue: {
    color: C.maroon,
    fontSize: 14,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 11,
    marginTop: 10,
  },
  directionsButton: {
    flex: 1,
    height: 54,
    backgroundColor: C.maroon,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  directionsText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '800',
  },
  callButton: {
    width: 55,
    height: 54,
    backgroundColor: C.paleGold,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callText: {
    fontSize: 22,
  },
  morePlaces: {
    alignItems: 'center',
    marginTop: 25,
    padding: 15,
  },
  morePlacesText: {
    color: C.maroon,
    fontSize: 13,
    fontWeight: '700',
  },
  center: {
    minHeight: 185,
    padding: 22,
    backgroundColor: C.white,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helper: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
  },
  emptyEmoji: {
    fontSize: 34,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
  },
  retry: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 11,
    backgroundColor: C.paleGold,
    borderRadius: 11,
  },
  retryText: {
    color: C.maroon,
    fontWeight: '800',
    fontSize: 12,
  },
  homeButton: {
    marginTop: 25,
    height: 49,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeText: {
    color: C.maroon,
    fontSize: 13,
    fontWeight: '700',
  },
});
