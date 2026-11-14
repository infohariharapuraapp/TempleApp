
import {
  translatePanchangamValue,
  translatePanchangamTime,
  translatePanchangamLocation,
  translatePanchangamObservance,
  translateObservanceName,
  translateObservanceDescription,
} from '@/localization/panchangamTranslator';
import type {
  PanchangamField,
  PanchangamObservance,
} from '@/localization/panchangamTranslator';
// PANCHANGAM_DYNAMIC_V2

import panchangamI18n from '@/localization/i18n';
import { useTranslation } from 'react-i18next';
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
import {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
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
  };
};

type PanchangamData = {
  date: string;
  latitude: number;
  longitude: number;
  timezone: string;
  sunrise: string | null;
  sunset: string | null;
  vara: string | null;
  rahuKalam: string | null;
  yamaganda: string | null;
  gulikaKalam: string | null;
  abhijitMuhurtham: string | null;
  tithi: string | null;
  nakshatra: string | null;
  yoga: string | null;
  karana: string | null;
  samvatsara: string | null;
  masa: string | null;
  paksha: string | null;
  ayana: string | null;
  ritu: string | null;
  observances?: Array<string | PanchangamObservance>;
  calculationStatus?: string;
  calculationNote?: string;
};

const API =
  'https://hariharapura-temple-api.onrender.com/api/panchangam';

const DEFAULT_PLACE: Place = {
  id: 'current-location',
  name: 'Current Location',
  state: 'GPS',
  latitude: null,
  longitude: null,
  source: 'default',
};

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

function normalizeDate(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0,
    0,
  );
}

function indiaToday(): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type: string) =>
    Number(parts.find(p => p.type === type)?.value ?? 0);

  return new Date(
    get('year'),
    get('month') - 1,
    get('day'),
    12,
  );
}

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function validDate(date: Date): boolean {
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() >= 1900 &&
    date.getFullYear() <= 2100
  );
}

function displayValue(
    value?: string | null,
    field?: PanchangamField,
  ): string {
    return translatePanchangamValue(value, field);
  }

function DetailCard({
    icon,
    label,
    value,
    field,
  }: {
  icon: string;
  label: string;
  value?: string | null;
  field: PanchangamField;
}) {
  return (
    <View style={styles.detailCard}>
      <Text style={styles.detailIcon}>{icon}</Text>
      <Text style={styles.detailLabel}>{trPanchangam(label)}</Text>
      <Text style={styles.detailValue}>
        {displayValue(value, field)}
      </Text>
    </View>
  );
}

function TimingRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: string;
  label: string;
  value?: string | null;
  last?: boolean;
}) {
  // TIMING_LANGUAGE_FIX
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.timingRow,
        last && { borderBottomWidth: 0 },
      ]}
    >
      <View style={styles.timingLeft}>
        <Text style={styles.timingIcon}>{icon}</Text>
        <Text style={styles.timingLabel}>
    {t('dailyPanchangam.' +
      label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      { defaultValue: label }
    )}
  </Text>
      </View>
      <Text style={styles.timingValue}>
        {value
    ? translatePanchangamTime(value)
    : trPanchangam("Not available")}
      </Text>
    </View>
  );
}


// PANCHANGAM_LOCALIZATION_V1
function trPanchangam(text: string): string {
  const key = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return panchangamI18n.t(
    'dailyPanchangam.' + key,
    { defaultValue: text }
  );
}
function panchangamLocale(): string {
  const lang = (
    panchangamI18n.resolvedLanguage ||
    panchangamI18n.language ||
    'en'
  ).split('-')[0];
  const locales: Record<string, string> = {
    en: 'en-IN',
    te: 'te-IN',
    kn: 'kn-IN',
    hi: 'hi-IN',
    ta: 'ta-IN'
  };
  return locales[lang] || 'en-IN';
}
export default function PanchangamScreen() {
  const { i18n } = useTranslation();
  const language =
    i18n.resolvedLanguage ||
    i18n.language ||
    'en';




  const [selectedDate, setSelectedDate] =
    useState<Date>(indiaToday);

  const openCalendar = () => {
    DateTimePickerAndroid.open({
      value: normalizeDate(selectedDate),
      mode: 'date',
      display: 'calendar',
      minimumDate: new Date(1900, 0, 1, 12),
      maximumDate: new Date(2100, 11, 31, 12),
      onChange: (event, pickedDate) => {
        if (event.type === 'set' && pickedDate) {
          setSelectedDate(normalizeDate(pickedDate));
        }
      },
    });
  };

  const [selectedPlace, setSelectedPlace] =
    useState<Place>(DEFAULT_PLACE);

  const [locationVisible, setLocationVisible] =
    useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState('');
  const [clock, setClock] = useState('');

  const [panchangam, setPanchangam] =
    useState<PanchangamData | null>(null);

  const [panchangamLoading, setPanchangamLoading] =
    useState(false);

  const [panchangamError, setPanchangamError] =
    useState('');

  const [retryCount, setRetryCount] = useState(0);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(25)).current;

  const mounted = useRef(false);
  const manualLocationSelected = useRef(false);
  const gpsRequestId = useRef(0);
  const searchRequestId = useRef(0);
  const lastSearchAt = useRef(0);

  const latitude = selectedPlace.latitude;
  const longitude = selectedPlace.longitude;
  const selectedDateKey = dateKey(selectedDate);

  const hasLocation =
    latitude !== null && longitude !== null;

  const isToday =
    selectedDateKey === dateKey(indiaToday());

  const locationLabel =
    selectedPlace.source === 'gps'
      ? trPanchangam("My Current Location (GPS)")
      : selectedPlace.source === 'default'
        ? locating
          ? trPanchangam("Detecting Current Location...")
          : trPanchangam("Select Current Location")
        : translatePanchangamLocation(`${selectedPlace.name}, ${selectedPlace.state}`);

  const dateText = selectedDate.toLocaleDateString(panchangamLocale(),
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  );

  // Screen animation and cleanup.
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
      gpsRequestId.current += 1;
      searchRequestId.current += 1;
    };
  }, [fade, slide]);

  // Indian Standard Time clock.
  useEffect(() => {
    const updateClock = () => {
      setClock(
        new Intl.DateTimeFormat(panchangamLocale(), {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(new Date()),
      );
    };

    updateClock();

    const timer = setInterval(updateClock, 1000);

    return () => clearInterval(timer);
  }, [language]);

  // Get GPS coordinates.
  const detectLocation = async (
    automatic: boolean = false,
  ) => {
    const id = ++gpsRequestId.current;

    if (!automatic) {
      manualLocationSelected.current = false;
    }

    setLocating(true);
    setLocationError('');

    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (!mounted.current || id !== gpsRequestId.current) {
        return;
      }

      if (automatic && manualLocationSelected.current) {
        return;
      }

      if (permission.status !== 'granted') {
        throw new Error(
          'Location permission denied. Please allow GPS access or select a city manually.',
        );
      }

      const enabled =
        await Location.hasServicesEnabledAsync();

      if (!enabled) {
        throw new Error(
          'Location services are disabled. Enable GPS or select a city manually.',
        );
      }

      let position =
        await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
          requiredAccuracy: 5000,
        });

      if (!position) {
        position =
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
      }

      if (!mounted.current || id !== gpsRequestId.current) {
        return;
      }

      if (automatic && manualLocationSelected.current) {
        return;
      }

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        throw new Error('Invalid GPS coordinates.');
      }

      // Backend currently supports Indian coordinates.
      if (
        lat < 6 ||
        lat > 38 ||
        lon < 68 ||
        lon > 98
      ) {
        throw new Error(
          'Current Panchangam service supports locations in India. Please select an Indian city.',
        );
      }

      setSelectedPlace({
        id: 'gps',
        name: 'My Current Location',
        state: 'GPS',
        latitude: lat,
        longitude: lon,
        source: 'gps',
      });

      setPanchangamError('');
      setLocationVisible(false);
    } catch (error) {
      if (!mounted.current || id !== gpsRequestId.current) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to detect your location. Select a city manually.';

      setLocationError(message);

      if (!automatic) {
        Alert.alert(
    trPanchangam("Location Unavailable"),
    trPanchangam(message)
  );
      }
    } finally {
      if (mounted.current && id === gpsRequestId.current) {
        setLocating(false);
      }
    }
  };

  // Automatically detect location on first opening.
  useEffect(() => {
    detectLocation(true);
  }, []);

  // Load Panchangam whenever date/location changes.
  useEffect(() => {
    if (!hasLocation) {
      setPanchangam(null);
      setPanchangamLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    const load = async () => {
      setPanchangam(null);
      setPanchangamLoading(true);
      setPanchangamError('');

      const timeout = setTimeout(
        () => controller.abort(),
        30000,
      );

      try {
        const url =
          `${API}?date=${encodeURIComponent(selectedDateKey)}` +
          `&lat=${encodeURIComponent(String(latitude))}` +
          `&lon=${encodeURIComponent(String(longitude))}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        const result = await response.json();

        if (
          !response.ok ||
          result.success !== true ||
          !result.data
        ) {
          throw new Error(
            result.message ||
            'Panchangam API request failed.',
          );
        }

        if (!active) return;

        setPanchangam(result.data as PanchangamData);
      } catch (error) {
        if (!active) return;

        console.error('Panchangam API error:', error);

        setPanchangamError(
          'Unable to load Panchangam. Check your internet connection and tap Retry.',
        );
      } finally {
        clearTimeout(timeout);

        if (active) {
          setPanchangamLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    hasLocation,
    latitude,
    longitude,
    selectedDateKey,
    retryCount,
  ]);

  const selectPlace = (place: Place) => {
    manualLocationSelected.current = true;
    gpsRequestId.current += 1;

    setLocating(false);
    setLocationError('');
    setPanchangamError('');
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
        trPanchangam("Enter Location"),
        trPanchangam("Please enter at least 2 characters."),
      );
      return;
    }

    if (searching) return;

    if (Date.now() - lastSearchAt.current < 1200) {
      Alert.alert(
        trPanchangam("Please Wait"),
        trPanchangam("Wait a moment before searching again."),
      );
      return;
    }

    lastSearchAt.current = Date.now();
    const id = ++searchRequestId.current;

    setQuery(term);
    setSearching(true);
    setSearched(false);
    setResults([]);

    Keyboard.dismiss();

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      12000,
    );

    try {
      const params = new URLSearchParams({
        q: term,
        countrycodes: 'in',
        format: 'jsonv2',
        addressdetails: '1',
        limit: '15',
        dedupe: '1',
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent':
              'DivyakshetraHariharapura/1.0',
          },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error('Location search unavailable.');
      }

      const data: NominatimResult[] =
        await response.json();

      if (
        !mounted.current ||
        searchRequestId.current !== id
      ) {
        return;
      }

      const places: Place[] = data
        .map(item => {
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
              .filter(
                (value, index, array) =>
                  array.indexOf(value) === index,
              )
              .join(', ') || 'India';

          return {
            id: String(item.place_id),
            name,
            state,
            latitude: Number(item.lat),
            longitude: Number(item.lon),
            source: 'search' as const,
          };
        })
        .filter(
          place =>
            place.latitude !== null &&
            place.longitude !== null &&
            Number.isFinite(place.latitude) &&
            Number.isFinite(place.longitude) &&
            place.latitude >= 6 &&
            place.latitude <= 38 &&
            place.longitude >= 68 &&
            place.longitude <= 98,
        );

      setResults(places);
      setSearched(true);
    } catch (error) {
      if (
        mounted.current &&
        searchRequestId.current === id
      ) {
        Alert.alert(
          trPanchangam("Search Unavailable"),
          trPanchangam("Could not search locations. Check your internet connection."),
        );
      }
    } finally {
      clearTimeout(timeout);

      if (
        mounted.current &&
        searchRequestId.current === id
      ) {
        setSearching(false);
      }
    }
  };

  const changeDate = (days: number) => {
    setSelectedDate(previous => {
      const next = normalizeDate(previous);
      next.setDate(next.getDate() + days);

      return validDate(next)
        ? normalizeDate(next)
        : previous;
    });
  };

 

  const renderNotice = () => {
    if (locating && !hasLocation) {
      return (
        <>
          <ActivityIndicator color={C.maroon} />
          <Text style={styles.noticeText}>
            {'  '}{trPanchangam("Detecting your current location...")}
          </Text>
        </>
      );
    }

    if (panchangamLoading) {
      return (
        <>
          <ActivityIndicator color={C.maroon} />
          <Text style={styles.noticeText}>
            {'  '}{trPanchangam("Calculating Panchangam for the selected date and location...")}
          </Text>
        </>
      );
    }

    if (panchangamError) {
      return (
        <View style={{ flex: 1 }}>
          <Text style={styles.noticeText}>
            {trPanchangam(panchangamError)}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 10 }}
            onPress={() =>
              setRetryCount(count => count + 1)
            }
          >
            <Text style={styles.retryText}>{"↻ " + trPanchangam("Retry Calculation")}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (panchangam) {
      return (
        <>
          <Text style={styles.noticeIcon}>✓</Text>
          <Text style={styles.noticeText}>
            {panchangamI18n.t(
    'dailyPanchangam.loaded_notice',
    { date: dateText }
  )}
          </Text>
        </>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <Text style={styles.noticeText}>
          {(locationError && trPanchangam(locationError)) ||
            trPanchangam("Select a city or use GPS to calculate Panchangam.")}
        </Text>
        <TouchableOpacity
          style={{ marginTop: 10 }}
          onPress={() => setLocationVisible(true)}
        >
          <Text style={styles.retryText}>{"📍 " + trPanchangam("Select Location")}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={C.cream}
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
          <Text style={styles.backText}>{"‹ " + trPanchangam("Back")}</Text>
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
      {panchangamI18n.t('dailyPanchangam.divyakshetra_hariharapura')}
    </Text>

            <Text style={styles.title}>{trPanchangam("Daily Panchangam")}</Text>

            <Text style={styles.subtitle}>{trPanchangam("Sacred Time • Traditional Wisdom")}</Text>

            <View style={styles.headerDivider} />

            <Text style={styles.dateText}>
              {dateText}
            </Text>

            <Text style={styles.clockText}>
              {clock
                ? `${clock} IST`
                : trPanchangam("Indian Standard Time")}
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

              <Text style={styles.locationChange}>{trPanchangam("Change") + " ›"}</Text>
            </TouchableOpacity>

            {hasLocation && (
              <Text style={styles.coordinates}>
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </Text>
            )}
          </View>

          <View style={styles.dateNavigator}>
            <TouchableOpacity
              style={styles.dateArrow}
              onPress={() => changeDate(-1)}
            >
              <Text style={styles.dateArrowText}>
                ‹
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateCenter}
              onPress={openCalendar}
            >
              <Text style={styles.dateNavigatorLabel}>
                {isToday
                  ? trPanchangam("Today's Panchangam")
                  : trPanchangam("SELECTED DATE")}
              </Text>

              <Text style={styles.dateNavigatorValue}>
                {selectedDate.toLocaleDateString(panchangamLocale(),
                  {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  },
                )}
              </Text>

              <Text style={styles.calendarHint}>{"📅 " + trPanchangam("Tap to choose date")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateArrow}
              onPress={() => changeDate(1)}
            >
              <Text style={styles.dateArrowText}>
                ›
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.calendarButton}
            onPress={openCalendar}
          >
            <Text style={styles.calendarButtonText}>{"📅 " + trPanchangam("Open Calendar")}</Text>
          </TouchableOpacity>

          {!isToday && (
            <TouchableOpacity
              style={styles.todayButton}
              onPress={() =>
                setSelectedDate(indiaToday())
              }
            >
              <Text style={styles.todayButtonText}>{trPanchangam("Return to Today")}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.notice}>
            {renderNotice()}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{"✦ " + trPanchangam("Hindu Calendar")}</Text>
            <Text style={styles.sectionSubtitle}>{trPanchangam("Traditional calendar details")}</Text>

            <View style={styles.calendarCard}>
              {(
                [
                  ['Samvatsara', 'samvatsara'],
                  ['Masa', 'masa'],
                  ['Paksha', 'paksha'],
                  ['Ayana', 'ayana'],
                  ['Ritu', 'ritu'],
                ] as const
              ).map(([label, key], index) => (
                <View
                  key={key}
                  style={[
                    styles.calendarRow,
                    index === 4 && styles.lastRow,
                  ]}
                >
                  <Text style={styles.calendarLabel}>
                    {trPanchangam(label)}
                  </Text>

                  <Text style={styles.calendarValue}>
                    {displayValue(panchangam?.[key], key)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{"☀️ " + trPanchangam("Sun Timings")}</Text>

            <Text style={styles.sectionSubtitle}>{trPanchangam("Based on selected date and location")}</Text>

            <View style={styles.sunRow}>
              <View style={styles.sunCard}>
                <Text style={styles.sunIcon}>🌅</Text>
                <Text style={styles.sunLabel}>{trPanchangam("SUNRISE")}</Text>
                <Text style={styles.sunValue}>
                  {translatePanchangamTime(panchangam?.sunrise)}
                </Text>
              </View>

              <View style={styles.sunCard}>
                <Text style={styles.sunIcon}>🌇</Text>
                <Text style={styles.sunLabel}>{trPanchangam("SUNSET")}</Text>
                <Text style={styles.sunValue}>
                  {translatePanchangamTime(panchangam?.sunset)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{"🪷 " + trPanchangam("Panchanga")}</Text>

            <Text style={styles.sectionSubtitle}>{trPanchangam("The five traditional elements")}</Text>

            <View style={styles.detailsGrid}>
              <DetailCard
                icon="🌙"
                label="TITHI"
                field="tithi"
                value={panchangam?.tithi}
              />
              <DetailCard
                icon="⭐"
                label="NAKSHATRA"
                field="nakshatra"
                value={panchangam?.nakshatra}
              />
              <DetailCard
                icon="☀️"
                label="VARA"
                field="vara"
                value={panchangam?.vara}
              />
              <DetailCard
                icon="✨"
                label="YOGA"
                field="yoga"
                value={panchangam?.yoga}
              />
              <DetailCard
                icon="🪔"
                label="KARANA"
                field="karana"
                value={panchangam?.karana}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{"⏳ " + trPanchangam("Daily Timings")}</Text>

            <Text style={styles.sectionSubtitle}>{trPanchangam("Auspicious and inauspicious periods")}</Text>

            <View style={styles.timingsCard}>
              <TimingRow
                icon="✨"
                label="Abhijit Muhurtham"
                value={panchangam?.abhijitMuhurtham}
              />
              <TimingRow
                icon="🔴"
                label="Rahu Kalam"
                value={panchangam?.rahuKalam}
              />
              <TimingRow
                icon="🌙"
                label="Yamaganda"
                value={panchangam?.yamaganda}
              />
              <TimingRow
                icon="🪔"
                label="Gulika Kalam"
                value={panchangam?.gulikaKalam}
                last
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{"🙏 " + trPanchangam("Special Observances")}</Text>

            <View style={styles.observanceCard}>
              <Text style={styles.observanceIcon}>
                🛕
              </Text>

              <Text style={styles.observanceTitle}>{trPanchangam("Temple Festivals & Observances")}</Text>

              {panchangam?.observances?.length ? (
                <>
                  {panchangam.observances.map((item, index) => {
    if (typeof item === 'string') {
      return (
        <Text
          key={index}
          style={styles.observanceDescription}
        >
          • {translateObservanceDescription(
            translateObservanceName(item)
          )}
        </Text>
      );
    }
    if (!item || typeof item !== 'object') {
      return null;
    }
    const translated =
      translatePanchangamObservance(item);
    return (
      <View key={index}>
        <Text
          style={[
            styles.observanceDescription,
            {
              fontWeight: '700',
              color: C.maroon,
            },
          ]}
        >
          • {translated.name}
        </Text>
        {!!translated.description && (
          <Text style={styles.observanceDescription}>
            {translated.description}
          </Text>
        )}
      </View>
    );
  })}
                  <Text style={styles.observanceDescription}>{trPanchangam("Preliminary observances. Confirm fasting and festival dates with the temple calendar.")}</Text>
                </>
              ) : (
                <Text
                  style={styles.observanceDescription}
                >{trPanchangam("No preliminary observances available for the selected date. Temple-specific festivals require confirmation.")}</Text>
              )}
            </View>
          </View>

          <Text style={styles.footer}>
            हरिः ॐ तत् सत्
          </Text>

          <Text style={styles.footerNote}>
      {panchangamI18n.t('dailyPanchangam.divyakshetra_hariharapura')}
    </Text>
        </Animated.View>
      </ScrollView>

      {/* Location selection modal */}
      <Modal
        visible={locationVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setLocationVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{trPanchangam("Select Panchangam Location")}</Text>

              <TouchableOpacity
                onPress={() =>
                  setLocationVisible(false)
                }
              >
                <Text style={styles.closeText}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>{trPanchangam("Search across India or use your GPS location.")}</Text>

            <TouchableOpacity
              style={[
                styles.gpsButton,
                locating && { opacity: 0.65 },
              ]}
              onPress={() => detectLocation(false)}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.gpsIcon}>
                  📍
                </Text>
              )}

              <View style={styles.gpsContent}>
                <Text style={styles.gpsTitle}>
                  {locating
                    ? trPanchangam("Detecting location...")
                    : trPanchangam("Use My Current Location")}
                </Text>

                <Text style={styles.gpsSubtitle}>
                  {locating
                    ? trPanchangam("Waiting for GPS...")
                    : trPanchangam("Use phone location with permission")}
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.orText}>{trPanchangam("OR SEARCH ANYWHERE IN INDIA")}</Text>

            <View style={styles.searchBar}>
              <TextInput
                style={styles.searchInput}
                placeholder={trPanchangam("City, village, town or district")}
                placeholderTextColor="#9D8B7C"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() =>
                  searchPlaces()
                }
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
                  <ActivityIndicator
                    color={C.white}
                  />
                ) : (
                  <Text
                    style={styles.searchButtonText}
                  >{trPanchangam("Search")}</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {!searched && !searching && (
                <>
                  <Text style={styles.resultsHeading}>{trPanchangam("POPULAR LOCATIONS")}</Text>

                  {POPULAR_PLACES.map(place => (
                    <TouchableOpacity
                      key={place}
                      style={styles.cityRow}
                      onPress={() =>
                        searchPlaces(place)
                      }
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cityName}>
                          {translatePanchangamLocation(place.split(',')[0])}
                        </Text>

                        <Text style={styles.cityState}>
                          {translatePanchangamLocation(place.split(',').slice(1).join(',').trim())}
                        </Text>
                      </View>

                      <Text style={styles.resultArrow}>
                        ›
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {searching && (
                <View style={styles.loadingBox}>
                  <ActivityIndicator
                    color={C.maroon}
                  />
                  <Text style={styles.loadingText}>{trPanchangam("Searching Indian locations...")}</Text>
                </View>
              )}

              {searched && !searching && (
                <>
                  <Text style={styles.resultsHeading}>
                    {panchangamI18n.t(
    'dailyPanchangam.location_results',
    { count: results.length }
  )}
                  </Text>

                  {results.map(place => {
                    const selected =
                      selectedPlace.id === place.id;

                    return (
                      <TouchableOpacity
                        key={place.id}
                        style={[
                          styles.cityRow,
                          selected &&
                            styles.selectedCityRow,
                        ]}
                        onPress={() =>
                          selectPlace(place)
                        }
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cityName}>
                            📍 {translatePanchangamLocation(place.name)}
                          </Text>

                          <Text style={styles.cityState}>
                            {translatePanchangamLocation(place.state)}
                          </Text>

                          {place.latitude !== null &&
                            place.longitude !== null && (
                              <Text
                                style={
                                  styles.resultCoordinates
                                }
                              >
                                {place.latitude.toFixed(4)}
                                {', '}
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
                      <Text style={styles.emptyIcon}>
                        🔎
                      </Text>
                      <Text style={styles.emptyTitle}>{trPanchangam("No matching places found")}</Text>
                      <Text
                        style={styles.emptyDescription}
                      >{trPanchangam("Try adding the state name or searching a nearby town.")}</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <Text style={styles.modalFootnote}>
      {panchangamI18n.t('dailyPanchangam.osm_notice')}
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
  retryText: {
    color: C.maroon,
    fontWeight: '800',
    fontSize: 13,
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
