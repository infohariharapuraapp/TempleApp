
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
  useLocalSearchParams,
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
  data: GuruVani | null;
};

// ========================================
// COLORS
// ========================================

const COLORS = {
  background: '#FBF7F0',
  white: '#FFFFFF',
  maroon: '#6B1720',
  maroonDark: '#541018',
  gold: '#C88A32',
  text: '#352218',
  muted: '#76665D',
  border: '#E9DED2',
};

// ========================================
// GURU VANI DETAILS SCREEN
// ========================================

export default function GuruVaniDetailsScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const [item, setItem] =
    useState<GuruVani | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const loadDetails = useCallback(async () => {
    if (!id || !/^\d+$/.test(id)) {
      setItem(null);
      setError('Invalid Guru Vani ID.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response =
        await apiRequest<GuruVaniResponse>(
          `/guru-vani/${id}`
        );

      if (response.success && response.data) {
        setItem(response.data);
      } else {
        setItem(null);
        setError('Guru Vani not found.');
      }
    } catch (err) {
      console.error(
        'Guru Vani details error:',
        err
      );

      setItem(null);
      setError(
        'Unable to load Guru Vani details.'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadDetails();
    }, [loadDetails])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* BACK BUTTON */}

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>
            ← Back to Guru Vani
          </Text>
        </Pressable>

        {/* HEADER */}

        <LinearGradient
          colors={[
            COLORS.maroonDark,
            COLORS.maroon,
            '#9B4B1E',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroPattern}>
            <Text style={styles.heroPatternText}>
              ॐ
            </Text>
          </View>

          <Text style={styles.heroIcon}>
            ॐ
          </Text>

          <Text style={styles.heroEyebrow}>
            SACRED TEACHINGS
          </Text>

          <Text style={styles.heroTitle}>
            Guru Vani
          </Text>

          <Text style={styles.heroSubtitle}>
            Timeless wisdom for the spiritual journey
          </Text>
        </LinearGradient>

        {/* LOADING */}

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator
              size="large"
              color={COLORS.maroon}
            />

            <Text style={styles.stateText}>
              Loading teaching...
            </Text>
          </View>
        ) : error || !item ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateIcon}>
              🙏
            </Text>

            <Text style={styles.stateText}>
              {error || 'Teaching not found.'}
            </Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => void loadDetails()}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* MAIN SLOKA CARD */}

            <View style={styles.mainCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardEyebrow}>
                  GURU VANI
                </Text>

                <Text style={styles.date}>
                  {new Date(
                    item.published_at
                  ).toLocaleDateString()}
                </Text>
              </View>

              <Text style={styles.title}>
                {item.title}
              </Text>

              <View style={styles.divider} />

              <Text style={styles.sloka}>
                {item.sloka}
              </Text>

              {item.guru_name ? (
                <Text style={styles.guruName}>
                  — {item.guru_name}
                </Text>
              ) : null}
            </View>

            {/* TRANSLITERATION */}

            {item.transliteration?.trim() ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoEyebrow}>
                  PRONUNCIATION
                </Text>

                <Text style={styles.infoTitle}>
                  Transliteration
                </Text>

                <Text style={styles.infoText}>
                  {item.transliteration}
                </Text>
              </View>
            ) : null}

            {/* MEANING - OPTIONAL */}

            {item.meaning?.trim() ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoEyebrow}>
                  SPIRITUAL UNDERSTANDING
                </Text>

                <Text style={styles.infoTitle}>
                  Meaning
                </Text>

                <Text style={styles.infoText}>
                  {item.meaning}
                </Text>
              </View>
            ) : null}

            {/* FOOTER */}

            <View style={styles.footer}>
              <Text style={styles.footerIcon}>
                ✦
              </Text>

              <Text style={styles.footerText}>
                May these sacred teachings guide
                your spiritual journey.
              </Text>
            </View>
          </>
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
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.maroon,
  },

  hero: {
    borderRadius: 26,
    padding: 25,
    marginBottom: 22,
    overflow: 'hidden',
  },

  heroPattern: {
    position: 'absolute',
    right: -20,
    bottom: -40,
    opacity: 0.08,
  },

  heroPatternText: {
    fontSize: 160,
    color: COLORS.white,
  },

  heroIcon: {
    fontSize: 36,
    color: '#F4D18D',
    marginBottom: 17,
  },

  heroEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#F4D18D',
  },

  heroTitle: {
    fontSize: 31,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 7,
  },

  heroSubtitle: {
    fontSize: 12,
    lineHeight: 19,
    color: '#F7E3D9',
    marginTop: 9,
  },

  mainCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 23,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    elevation: 2,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: COLORS.gold,
  },

  date: {
    fontSize: 10,
    color: COLORS.muted,
  },

  title: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 17,
  },

  divider: {
    width: 55,
    height: 3,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
    marginVertical: 19,
  },

  sloka: {
    fontSize: 20,
    lineHeight: 35,
    color: COLORS.maroonDark,
    fontWeight: '600',
  },

  guruName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gold,
    marginTop: 20,
    textAlign: 'right',
  },

  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 21,
    padding: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 15,
  },

  infoEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 1.1,
  },

  infoTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 7,
  },

  infoText: {
    fontSize: 15,
    lineHeight: 26,
    color: COLORS.muted,
    marginTop: 12,
  },

  footer: {
    alignItems: 'center',
    padding: 25,
  },

  footerIcon: {
    fontSize: 22,
    color: COLORS.gold,
    marginBottom: 10,
  },

  footerText: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.muted,
    textAlign: 'center',
  },

  stateCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 30,
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  stateIcon: {
    fontSize: 32,
    marginBottom: 12,
  },

  stateText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 12,
  },

  retryButton: {
    marginTop: 18,
    backgroundColor: COLORS.maroon,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },

  retryText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
});
