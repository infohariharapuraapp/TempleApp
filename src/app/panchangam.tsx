
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Animated,
  StatusBar,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';

const C = {
  maroon: '#641B27',
  dark: '#48111B',
  gold: '#C69A3A',
  lightGold: '#F4D995',
  cream: '#FFF7E8',
  white: '#FFFFFF',
  muted: '#7D6B60',
  border: '#E9DCCB',
};

type Place = {
  id: string;
  name: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  source: 'default' | 'search' | 'gps';
};

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state_district?: string;
    state?: string;
    country?: string;
  };
};

const DEFAULT_PLACE: Place = {
  id: 'hariharapura',
  name: 'Hariharapura',
  state: 'Karnataka',
  latitude: null,
  longitude: null,
  source: 'default',
};

const PENDING = 'Awaiting calculation';

const POPULAR_PLACES = [
  'Hariharapura, Karnataka',
  'Bengaluru, Karnataka',
  'Hyderabad, Telangana',
  'Guntur, Andhra Pradesh',
  'Vijayawada, Andhra Pradesh',
  'Chennai, Tamil Nadu',
  'Mysuru, Karnataka',
  'Shivamogga, Karnataka',
];

function indiaToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const part = (type: string) =>
    Number(parts.find(p => p.type === type)?.value ?? 0);

  return new Date(
    part('year'),
    part('month') - 1,
    part('day'),
    12,
  );
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function DetailCard({
  icon,
  label,
}: {
  icon: string;
  label: string;
}) {
  return (
    <View style={styles.detailCard}>
      <Text style={styles.detailIcon}>{icon}</Text>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{PENDING}</Text>
    </View>
  );
}

function TimingRow({
  icon,
  label,
  last = false,
}: {
  icon: string;
  label: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.timingRow,
        last && { borderBottomWidth: 0 },
      ]}
    >
      <View style={styles.timingLeft}>
        <Text style={styles.timingIcon}>{icon}</Text>
        <Text style={styles.timingLabel}>{label}</Text>
      </View>

      <Text style={styles.timingValue}>Not available yet</Text>
    </View>
  );
}

export default function PanchangamScreen() {
  const [selectedDate, setSelectedDate] =
    useState<Date>(indiaToday);

  const [selectedPlace, setSelectedPlace] =
    useState<Place>(DEFAULT_PLACE);

  const [calendarVisible, setCalendarVisible] = useState(false);
  const [locationVisible, setLocationVisible] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [clock, setClock] = useState('');

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(25)).current;
  const mounted = useRef(true);
  const requestId = useRef(0);
  const lastSearchAt = useRef(0);
  const gpsSubscription =
    useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    mounted.current = true;

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      mounted.current = false;
      requestId.current += 1;
      gpsSubscription.current?.remove();
      gpsSubscription.current = null;
    };
  }, [fade, slide]);

  useEffect(() => {
    const update = () => {
      setClock(
        new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(new Date()),
      );
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const isToday =
    dateKey(selectedDate) === dateKey(indiaToday());

  const changeDate = (days: number) => {
    setSelectedDate(previous => {
      const next = new Date(previous);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  const selectPlace = (place: Place) => {
    setSelectedPlace(place);
    setLocationVisible(false);
    setQuery('');
    setResults([]);
    setSearched(false);
    Keyboard.dismiss();
  };

  const searchPlaces = async (text?: string) => {
    const term = (text ?? query).trim();

    if (term.length < 2) {
      Alert.alert(
        'Enter Location',
        'Please enter at least 2 characters.',
      );
      return;
    }

    if (searching) return;

    // Public Nominatim usage: maximum one request per second.
    if (Date.now() - lastSearchAt.current < 1200) {
      Alert.alert(
        'Please Wait',
        'Wait a moment before searching again.',
      );
      return;
    }

    lastSearchAt.current = Date.now();
    const id = ++requestId.current;

    setQuery(term);
    setSearching(true);
    setSearched(false);
    setResults([]);
    Keyboard.dismiss();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const url =
        'https://nominatim.openstreetmap.org/search?' +
        new URLSearchParams({
          q: term,
          countrycodes: 'in',
          format: 'jsonv2',
          addressdetails: '1',
          limit: '15',
          dedupe: '1',
        }).toString();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DivyakshetraHariharapura/1.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Search service: ${response.status}`);
      }

      const data: NominatimResult[] = await response.json();

      if (!mounted.current || requestId.current !== id) {
        return;
      }

      const places: Place[] = data
        .map(item => {
          const latitude = Number(item.lat);
          const longitude = Number(item.lon);

          const address = item.address ?? {};

          const name =
            address.city ||
            address.town ||
            address.village ||
            address.municipality ||
            address.county ||
            address.state_district ||
            item.display_name.split(',')[0].trim();

          const state =
            [
              address.state_district,
              address.state,
            ]
              .filter(Boolean)
              .filter((value, index, array) =>
                array.indexOf(value) === index,
              )
              .join(', ') || 'India';

          return {
            id: String(item.place_id),
            name,
            state,
            latitude,
            longitude,
            source: 'search' as const,
          };
        })
        .filter(
          place =>
            Number.isFinite(place.latitude) &&
            Number.isFinite(place.longitude),
        );

      setResults(places);
      setSearched(true);
    } catch (error) {
      if (mounted.current && requestId.current === id) {
        Alert.alert(
          'Search Unavailable',
          'Could not search locations right now. Check your internet connection and try again.',
        );
      }
    } finally {
      clearTimeout(timeout);

      if (mounted.current && requestId.current === id) {
        setSearching(false);
      }
    }
  };

  const useMyLocation = async () => {
    if (locating) return;

    setLocating(true);

    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Allow location access or search for your city manually.',
        );
        return;
      }

      const enabled =
        await Location.hasServicesEnabledAsync();

      if (!enabled) {
        Alert.alert(
          'Location Disabled',
          'Please enable location services on your phone.',
        );
        return;
      }

      // Fast path: use a recent, reasonably accurate reading.
      const cached =
        await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
          requiredAccuracy: 5000,
        });

      if (cached) {
        selectPlace({
          id: 'gps',
          name: 'My Current Location',
          state: 'GPS',
          latitude: cached.coords.latitude,
          longitude: cached.coords.longitude,
          source: 'gps',
        });
        return;
      }

      // Wait up to 12 seconds for a fresh location update.
      const position =
        await new Promise<Location.LocationObject>(
          (resolve, reject) => {
            let finished = false;
            let timer: ReturnType<typeof setTimeout> | null =
              null;
            let subscription:
              | Location.LocationSubscription
              | null = null;

            const cleanup = () => {
              if (timer) clearTimeout(timer);
              subscription?.remove();
              gpsSubscription.current?.remove();
              gpsSubscription.current = null;
            };

            const succeed = (
              value: Location.LocationObject,
            ) => {
              if (finished) return;
              finished = true;
              cleanup();
              resolve(value);
            };

            const fail = () => {
              if (finished) return;
              finished = true;
              cleanup();
              reject(new Error('Location timed out'));
            };

            timer = setTimeout(fail, 12000);

            Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.Low,
                timeInterval: 1000,
                distanceInterval: 0,
              },
              succeed,
            )
              .then(sub => {
                if (finished || !mounted.current) {
                  sub.remove();
                  return;
                }
                subscription = sub;
                gpsSubscription.current = sub;
              })
              .catch(fail);
          },
        );

      if (!mounted.current) return;

      selectPlace({
        id: 'gps',
        name: 'My Current Location',
        state: 'GPS',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        source: 'gps',
      });
    } catch (error) {
      if (mounted.current) {
        Alert.alert(
          'Location Unavailable',
          'GPS did not respond quickly. Please try outdoors or select your city manually.',
        );
      }
    } finally {
      if (mounted.current) setLocating(false);
    }
  };

  const dateText = selectedDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const locationLabel =
    selectedPlace.source === 'gps'
      ? 'My Current Location (GPS)'
      : `${selectedPlace.name}, ${selectedPlace.state}`;

  return (
    <SafeAreaView style={styles.container}>
  <StatusBar
  barStyle="dark-content"
  backgroundColor="#FFF7E8"
  translucent={false}
/>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <Animated.View
          style={{
            opacity: fade,
            transform: [{ translateY: slide }],
          }}
        >
          <View style={styles.header}>
            <Text style={styles.headerSymbol}>ॐ</Text>

            <Text style={styles.eyebrow}>
              DIVYAKSHETRA HARIHARAPURA
            </Text>

            <Text style={styles.title}>
              Daily Panchangam
            </Text>

            <Text style={styles.subtitle}>
              Sacred Time • Traditional Wisdom
            </Text>

            <View style={styles.headerDivider} />

            <Text style={styles.dateText}>{dateText}</Text>

            <Text style={styles.clockText}>
              {clock ? `${clock} IST` : 'Indian Standard Time'}
            </Text>

            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => setLocationVisible(true)}
            >
              <Text
                style={styles.locationText}
                numberOfLines={2}
              >
                📍 {locationLabel}
              </Text>

              <Text style={styles.locationChange}>
                Change ›
              </Text>
            </TouchableOpacity>

            {selectedPlace.latitude !== null &&
              selectedPlace.longitude !== null && (
                <Text style={styles.coordinates}>
                  {selectedPlace.latitude.toFixed(4)},
                  {' '}
                  {selectedPlace.longitude.toFixed(4)}
                </Text>
              )}
          </View>

          <View style={styles.dateNavigator}>
            <TouchableOpacity
              style={styles.dateArrow}
              onPress={() => changeDate(-1)}
            >
              <Text style={styles.dateArrowText}>‹</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateCenter}
              onPress={() => setCalendarVisible(true)}
            >
              <Text style={styles.dateNavigatorLabel}>
                {isToday
                  ? "TODAY'S PANCHANGAM"
                  : 'SELECTED DATE'}
              </Text>

              <Text style={styles.dateNavigatorValue}>
                {selectedDate.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>

              <Text style={styles.calendarHint}>
                📅 Tap to choose date
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateArrow}
              onPress={() => changeDate(1)}
            >
              <Text style={styles.dateArrowText}>›</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => setCalendarVisible(true)}
          >
            <Text style={styles.calendarButtonText}>
              📅 Open Calendar
            </Text>
          </TouchableOpacity>

          {!isToday && (
            <TouchableOpacity
              style={styles.todayButton}
              onPress={() => setSelectedDate(indiaToday())}
            >
              <Text style={styles.todayButtonText}>
                Return to Today
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.notice}>
            <Text style={styles.noticeIcon}>ℹ️</Text>
            <Text style={styles.noticeText}>
              Date and location selection are available.
              Actual Panchangam calculations are not
              connected yet. Timings will be shown only
              after the calculation engine is validated.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              ✦ Hindu Calendar
            </Text>
            <Text style={styles.sectionSubtitle}>
              Traditional calendar details
            </Text>

            <View style={styles.calendarCard}>
              {[
                'Samvatsara',
                'Masa',
                'Paksha',
                'Ayana',
                'Ritu',
              ].map((label, index) => (
                <View
                  key={label}
                  style={[
                    styles.calendarRow,
                    index === 4 && styles.lastRow,
                  ]}
                >
                  <Text style={styles.calendarLabel}>
                    {label}
                  </Text>
                  <Text style={styles.calendarValue}>
                    {PENDING}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              ☀️ Sun Timings
            </Text>
            <Text style={styles.sectionSubtitle}>
              Based on selected date and location
            </Text>

            <View style={styles.sunRow}>
              <View style={styles.sunCard}>
                <Text style={styles.sunIcon}>🌅</Text>
                <Text style={styles.sunLabel}>SUNRISE</Text>
                <Text style={styles.sunValue}>--:--</Text>
              </View>

              <View style={styles.sunCard}>
                <Text style={styles.sunIcon}>🌇</Text>
                <Text style={styles.sunLabel}>SUNSET</Text>
                <Text style={styles.sunValue}>--:--</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              🪷 Panchanga
            </Text>
            <Text style={styles.sectionSubtitle}>
              The five traditional elements
            </Text>

            <View style={styles.detailsGrid}>
              <DetailCard icon="🌙" label="TITHI" />
              <DetailCard icon="⭐" label="NAKSHATRA" />
              <DetailCard icon="☀️" label="VARA" />
              <DetailCard icon="✨" label="YOGA" />
              <DetailCard icon="🪔" label="KARANA" />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              ⏳ Daily Timings
            </Text>
            <Text style={styles.sectionSubtitle}>
              Auspicious and inauspicious periods
            </Text>

            <View style={styles.timingsCard}>
              <TimingRow
                icon="✨"
                label="Abhijit Muhurtham"
              />
              <TimingRow
                icon="🔴"
                label="Rahu Kalam"
              />
              <TimingRow
                icon="🌙"
                label="Yamaganda"
              />
              <TimingRow
                icon="🪔"
                label="Gulika Kalam"
                last
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              🙏 Special Observances
            </Text>

            <View style={styles.observanceCard}>
              <Text style={styles.observanceIcon}>🛕</Text>
              <Text style={styles.observanceTitle}>
                Temple Festivals & Observances
              </Text>
              <Text style={styles.observanceDescription}>
                Special occasions and temple observances
                will appear here after the festival
                calendar is connected.
              </Text>
            </View>
          </View>

          <Text style={styles.footer}>हरिः ॐ तत् सत्</Text>
          <Text style={styles.footerNote}>
            Divyakshetra Hariharapura
          </Text>
        </Animated.View>
      </ScrollView>

      {calendarVisible && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setCalendarVisible(false);

            if (event.type === 'set' && date) {
              setSelectedDate(date);
            }
          }}
        />
      )}

      <Modal
        visible={locationVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setLocationVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select Panchangam Location
              </Text>

              <TouchableOpacity
                onPress={() => setLocationVisible(false)}
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Search across India or use your GPS location.
            </Text>

            <TouchableOpacity
              style={[
                styles.gpsButton,
                locating && { opacity: 0.65 },
              ]}
              onPress={useMyLocation}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.gpsIcon}>📍</Text>
              )}

              <View style={styles.gpsContent}>
                <Text style={styles.gpsTitle}>
                  {locating
                    ? 'Detecting location...'
                    : 'Use My Current Location'}
                </Text>

                <Text style={styles.gpsSubtitle}>
                  {locating
                    ? 'Waiting for GPS (up to 12 seconds)'
                    : 'Use phone location with permission'}
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.orText}>
              OR SEARCH ANYWHERE IN INDIA
            </Text>

            <View style={styles.searchBar}>
              <TextInput
                style={styles.searchInput}
                placeholder="City, village, town or district"
                placeholderTextColor="#9D8B7C"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => searchPlaces()}
              />

              <TouchableOpacity
                style={[
                  styles.searchButton,
                  searching && { opacity: 0.65 },
                ]}
                disabled={searching}
                onPress={() => searchPlaces()}
              >
                {searching ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <Text style={styles.searchButtonText}>
                    Search
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {!searched && !searching && (
                <>
                  <Text style={styles.resultsHeading}>
                    POPULAR LOCATIONS
                  </Text>

                  {POPULAR_PLACES.map(place => (
                    <TouchableOpacity
                      key={place}
                      style={styles.cityRow}
                      onPress={() => searchPlaces(place)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cityName}>
                          {place.split(',')[0]}
                        </Text>
                        <Text style={styles.cityState}>
                          {place.split(',').slice(1).join(',').trim()}
                        </Text>
                      </View>

                      <Text style={styles.resultArrow}>›</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {searching && (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={C.maroon} />
                  <Text style={styles.loadingText}>
                    Searching Indian locations...
                  </Text>
                </View>
              )}

              {searched && !searching && (
                <>
                  <Text style={styles.resultsHeading}>
                    {results.length} LOCATION RESULTS
                  </Text>

                  {results.map(place => {
                    const selected =
                      selectedPlace.id === place.id;

                    return (
                      <TouchableOpacity
                        key={place.id}
                        style={[
                          styles.cityRow,
                          selected && styles.selectedCityRow,
                        ]}
                        onPress={() => selectPlace(place)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cityName}>
                            📍 {place.name}
                          </Text>

                          <Text style={styles.cityState}>
                            {place.state}
                          </Text>

                          {place.latitude !== null &&
                            place.longitude !== null && (
                              <Text style={styles.resultCoordinates}>
                                {place.latitude.toFixed(4)},
                                {' '}
                                {place.longitude.toFixed(4)}
                              </Text>
                            )}
                        </View>

                        <Text style={styles.resultArrow}>
                          {selected ? '✓' : '›'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {results.length === 0 && (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyIcon}>🔎</Text>
                      <Text style={styles.emptyTitle}>
                        No matching places found
                      </Text>
                      <Text style={styles.emptyDescription}>
                        Try adding the state name or
                        searching a nearby town.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <Text style={styles.modalFootnote}>
              Search data © OpenStreetMap contributors.
              Public search service for testing;
              subject to usage limits.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  content: {
    padding: 18,
    paddingBottom: 55,
  },
  backButton: {
    paddingVertical: 12,
    marginBottom: 12,
  },
  backText: {
    color: C.maroon,
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    backgroundColor: C.maroon,
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.gold,
    marginBottom: 18,
  },
  headerSymbol: {
    color: C.lightGold,
    fontSize: 42,
    marginBottom: 8,
  },
  eyebrow: {
    color: C.lightGold,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '800',
    textAlign: 'center',
  },
  title: {
    color: C.white,
    fontSize: 27,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: '#F5E4D2',
    fontSize: 12,
    marginTop: 7,
    textAlign: 'center',
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#995663',
    width: '90%',
    marginVertical: 20,
  },
  dateText: {
    color: C.white,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  clockText: {
    color: C.lightGold,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  locationButton: {
    backgroundColor: C.dark,
    borderWidth: 1,
    borderColor: '#A36B57',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginTop: 18,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  locationChange: {
    color: C.lightGold,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
  },
  coordinates: {
    color: C.lightGold,
    fontSize: 11,
    marginTop: 9,
    textAlign: 'center',
  },
  dateNavigator: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateArrow: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateArrowText: {
    color: C.maroon,
    fontSize: 30,
    fontWeight: '600',
    marginTop: -4,
  },
  dateCenter: {
    alignItems: 'center',
    flex: 1,
  },
  dateNavigatorLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  dateNavigatorValue: {
    color: C.maroon,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 4,
  },
  calendarHint: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  calendarButton: {
    backgroundColor: C.maroon,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  calendarButtonText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '800',
  },
  todayButton: {
    alignSelf: 'center',
    padding: 12,
  },
  todayButtonText: {
    color: C.maroon,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  notice: {
    flexDirection: 'row',
    backgroundColor: '#FFF0D3',
    borderRadius: 14,
    padding: 13,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#EED7A5',
  },
  noticeIcon: {
    fontSize: 16,
    marginRight: 9,
  },
  noticeText: {
    flex: 1,
    color: '#795B35',
    fontSize: 12,
    lineHeight: 19,
  },
  section: {
    marginTop: 25,
  },
  sectionTitle: {
    color: C.maroon,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: C.muted,
    fontSize: 12,
    marginTop: 5,
    marginBottom: 14,
  },
  calendarCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: C.border,
    elevation: 2,
  },
  calendarRow: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1E8DC',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  calendarLabel: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  calendarValue: {
    color: C.maroon,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: 10,
  },
  sunRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sunCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
  },
  sunIcon: {
    fontSize: 30,
    marginBottom: 9,
  },
  sunLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sunValue: {
    color: C.maroon,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 9,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  detailCard: {
    width: '48%',
    minHeight: 140,
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  detailIcon: {
    fontSize: 27,
    marginBottom: 10,
  },
  detailLabel: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  detailValue: {
    color: C.maroon,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 9,
    textAlign: 'center',
  },
  timingsCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    elevation: 2,
  },
  timingRow: {
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#F1E8DC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timingIcon: {
    fontSize: 19,
    marginRight: 10,
  },
  timingLabel: {
    color: C.maroon,
    fontSize: 13,
    fontWeight: '700',
  },
  timingValue: {
    color: C.muted,
    fontSize: 11,
    marginLeft: 10,
    textAlign: 'right',
    flexShrink: 1,
  },
  observanceCard: {
    backgroundColor: '#F9EBD4',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5C995',
    padding: 23,
    alignItems: 'center',
  },
  observanceIcon: {
    fontSize: 35,
    marginBottom: 10,
  },
  observanceTitle: {
    color: C.maroon,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  observanceDescription: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  footer: {
    textAlign: 'center',
    marginTop: 35,
    color: C.gold,
    fontSize: 18,
    fontWeight: '700',
  },
  footerNote: {
    color: C.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: C.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '85%',
    minHeight: '60%',
  },
  modalHandle: {
    width: 45,
    height: 5,
    backgroundColor: '#D9C7B4',
    borderRadius: 10,
    alignSelf: 'center',
    marginBottom: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: C.maroon,
    fontSize: 19,
    fontWeight: '800',
    flex: 1,
  },
  closeText: {
    color: C.maroon,
    fontSize: 20,
    padding: 5,
  },
  modalSubtitle: {
    color: C.muted,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 18,
  },
  gpsButton: {
    backgroundColor: C.maroon,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsIcon: {
    fontSize: 27,
    marginRight: 12,
  },
  gpsContent: {
    flex: 1,
    marginLeft: 5,
  },
  gpsTitle: {
    color: C.white,
    fontSize: 15,
    fontWeight: '800',
  },
  gpsSubtitle: {
    color: '#F2D9C4',
    fontSize: 11,
    marginTop: 5,
  },
  orText: {
    color: C.muted,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    marginVertical: 17,
    letterSpacing: 1,
  },
  searchBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: C.maroon,
    fontSize: 13,
  },
  searchButton: {
    backgroundColor: C.maroon,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 75,
  },
  searchButtonText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '800',
  },
  resultsHeading: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginVertical: 10,
  },
  cityRow: {
    backgroundColor: C.white,
    padding: 15,
    marginBottom: 8,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedCityRow: {
    borderColor: C.gold,
    backgroundColor: '#FFF0D3',
  },
  cityName: {
    color: C.maroon,
    fontSize: 14,
    fontWeight: '700',
  },
  cityState: {
    color: C.muted,
    fontSize: 11,
    marginTop: 4,
  },
  resultCoordinates: {
    color: C.gold,
    fontSize: 10,
    marginTop: 5,
  },
  resultArrow: {
    color: C.maroon,
    fontSize: 23,
    fontWeight: '800',
    marginLeft: 12,
  },
  loadingBox: {
    alignItems: 'center',
    padding: 30,
    gap: 12,
  },
  loadingText: {
    color: C.muted,
    fontSize: 12,
  },
  emptyBox: {
    alignItems: 'center',
    padding: 25,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  emptyTitle: {
    color: C.maroon,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyDescription: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 7,
  },
  modalFootnote: {
    color: C.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
  },
});
