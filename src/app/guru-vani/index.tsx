
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  LinearGradient,
} from 'expo-linear-gradient';

import {
  apiRequest,
} from '@/services/api';

// ========================================
// TYPES
// ========================================

type GuruVani = {
  id: number;
  title: string;
  sloka: string;
  transliteration: string | null;
  meaning: string | null;
  guru_name: string | null;
  published_at: string;
  is_active: boolean;
};

type GuruVaniResponse = {
  success: boolean;
  data: GuruVani[];
};

// ========================================
// COLORS
// ========================================

const COLORS = {
  background: '#FBF7F0',
  white: '#FFFFFF',
  maroon: '#6B1720',
  gold: '#C88A32',
  text: '#352218',
  muted: '#76665D',
  border: '#E9DED2',
};

// ========================================
// SCREEN
// ========================================

export default function GuruVaniScreen() {
  const [items, setItems] = useState<GuruVani[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadGuruVani = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);

      const response =
        await apiRequest<GuruVaniResponse>(
          '/guru-vani'
        );

      if (
        response.success &&
        Array.isArray(response.data)
      ) {
        setItems(
          [...response.data].sort(
            (a, b) =>
              new Date(b.published_at).getTime() -
                new Date(a.published_at).getTime() ||
              b.id - a.id
          )
        );
      } else {
        setItems([]);
        setError(true);
      }
    } catch (err) {
      console.error(
        'Guru Vani loading error:',
        err
      );

      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadGuruVani();
    }, [loadGuruVani])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* HEADER */}

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>
            ← Back
          </Text>
        </Pressable>

        {/* HERO */}

        <LinearGradient
          colors={['#6B1720', '#9B4B1E']}
          style={styles.hero}
        >
          <Text style={styles.heroIcon}>
            ॐ
          </Text>

          <Text style={styles.heroEyebrow}>
            SPIRITUAL WISDOM
          </Text>

          <Text style={styles.heroTitle}>
            Guru Vani
          </Text>

          <Text style={styles.heroSubtitle}>
            Sacred teachings and timeless wisdom
            to inspire your spiritual journey.
          </Text>
        </LinearGradient>

        {/* SECTION TITLE */}

        <View style={styles.headingRow}>
          <View>
            <Text style={styles.sectionEyebrow}>
              DIVINE TEACHINGS
            </Text>

            <Text style={styles.sectionTitle}>
              Explore Guru Vani
            </Text>
          </View>

          {!loading && !error && (
            <Text style={styles.count}>
              {items.length} Slokas
            </Text>
          )}
        </View>

        {/* LOADING */}

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator
              size="large"
              color={COLORS.maroon}
            />

            <Text style={styles.stateText}>
              Loading Guru Vani...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateIcon}>
              ⚠️
            </Text>

            <Text style={styles.stateText}>
              Unable to load Guru Vani.
            </Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => void loadGuruVani()}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateIcon}>
              🙏
            </Text>

            <Text style={styles.stateText}>
              No Guru Vani slokas are
              available yet.
            </Text>
          </View>
        ) : (
          items.map((item, index) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                router.push({
                  pathname: '/guru-vani/[id]',
                  params: {
                    id: String(item.id),
                  },
                })
              }
            >
              <View style={styles.cardTop}>
                <View style={styles.numberBadge}>
                  <Text style={styles.numberText}>
                    {String(index + 1).padStart(
                      2,
                      '0'
                    )}
                  </Text>
                </View>

                <Text style={styles.cardDate}>
                  {new Date(
                    item.published_at
                  ).toLocaleDateString()}
                </Text>
              </View>

              <Text style={styles.cardTitle}>
                {item.title}
              </Text>

              <Text
                style={styles.sloka}
                numberOfLines={3}
              >
                {item.sloka}
              </Text>

              {item.guru_name ? (
                <Text style={styles.guruName}>
                  — {item.guru_name}
                </Text>
              ) : null}

              <View style={styles.cardFooter}>
                <Text style={styles.readMore}>
                  Read Teaching
                </Text>

                <Text style={styles.arrow}>
                  →
                </Text>
              </View>
            </Pressable>
          ))
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
    backgroundColor: COLORS.background,
  },

  content: {
    padding: 18,
    paddingBottom: 45,
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 12,
  },

  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.maroon,
  },

  hero: {
    borderRadius: 26,
    padding: 25,
    marginBottom: 27,
    overflow: 'hidden',
  },

  heroIcon: {
    fontSize: 39,
    color: '#F4D18D',
    marginBottom: 18,
  },

  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F4D18D',
    letterSpacing: 1.5,
  },

  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 7,
  },

  heroSubtitle: {
    fontSize: 12,
    lineHeight: 20,
    color: '#F7E3D9',
    marginTop: 10,
  },

  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },

  sectionEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 1,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 5,
  },

  count: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '700',
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 19,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
  },

  pressed: {
    opacity: 0.8,
  },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  numberBadge: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: '#F7EBD7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  numberText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.maroon,
  },

  cardDate: {
    fontSize: 10,
    color: COLORS.muted,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 16,
  },

  sloka: {
    fontSize: 15,
    lineHeight: 25,
    color: COLORS.text,
    marginTop: 11,
  },

  guruName: {
    fontSize: 11,
    color: COLORS.gold,
    fontWeight: '700',
    marginTop: 12,
  },

  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 17,
    paddingTop: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  readMore: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.maroon,
  },

  arrow: {
    fontSize: 21,
    color: COLORS.gold,
  },

  stateCard: {
    padding: 30,
    minHeight: 180,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  stateIcon: {
    fontSize: 30,
    marginBottom: 12,
  },

  stateText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 12,
  },

  retryButton: {
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 16,
  },

  retryText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 12,
  },
});
