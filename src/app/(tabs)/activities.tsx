
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '@/services/api';
// ========================================
// COLORS
// ========================================
const COLORS = {
  background: '#FBF7F0',
  surface: '#FFFFFF',
  surfaceSoft: '#F7EFE5',
  primary: '#9B4B1E',
  primaryDark: '#713315',
  gold: '#C88A32',
  goldSoft: '#E9C98D',
  text: '#352218',
  textSoft: '#76665D',
  border: '#E9DED2',
  white: '#FFFFFF',
};
// ========================================
// TYPES
// ========================================
type ActivitySection = {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
};
type GuruVani = {
  id: number;
  title: string;
  sloka: string;
  transliteration: string | null;
  meaning: string | null;
  guru_name: string | null;
  published_at: string;
};

// ========================================
// FADE-IN ANIMATION
// ========================================
function FadeIn({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const opacity = useRef(
    new Animated.Value(0)
  ).current;
  const translateY = useRef(
    new Animated.Value(16)
  ).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);
  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
      }}
    >
      {children}
    </Animated.View>
  );
}
// ========================================
// SECTION HEADING
// ========================================
function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingLeft}>
        {eyebrow ? (
          <Text style={styles.sectionEyebrow}>
            {eyebrow}
          </Text>
        ) : null}
        <Text style={styles.sectionTitle}>
          {title}
        </Text>
      </View>
      {action ? (
        <Text style={styles.sectionAction}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}
// ========================================
// ACTIVITIES SCREEN
// ========================================
export default function ActivitiesScreen() {
  const { t } = useTranslation();
  // Language-dependent content is defined
  // inside the component so it updates
  // immediately when the language changes.
  const programs = [
    {
      icon: 'ॐ',
      title: t('activities.dharmayatra'),
      description: t(
        'activities.dharmayatraDescription'
      ),
      meta: t('activities.spiritualJourney'),
    },
    {
      icon: '✦',
      title: t('activities.specialPrograms'),
      description: t(
        'activities.specialProgramsDescription'
      ),
      meta: t('activities.upcoming'),
    },
  ];
  const insights = [
    t('activities.insight1'),
    t('activities.insight2'),
    t('activities.insight3'),
  ];
  const [sections, setSections] =
    useState<ActivitySection[]>([]);
  const [loadingSections, setLoadingSections] =
    useState(true);
  const [sectionError, setSectionError] =
    useState(false);
  useEffect(() => {
    loadActivitySections();
  }, []);
  const [latestGuruVani, setLatestGuruVani] =
    useState<GuruVani | null>(null);
  const [loadingGuruVani, setLoadingGuruVani] = useState(true);
  const [guruVaniError, setGuruVaniError] = useState(false);

  const loadLatestGuruVani = useCallback(async () => {
    try {
      setLoadingGuruVani(true);
      setGuruVaniError(false);
      const response = await apiRequest('/guru-vani/latest');
      if (response.success) {
        setLatestGuruVani((response.data as GuruVani | null) ?? null);
      } else {
        setGuruVaniError(true);
      }
    } catch (error) {
      console.error('Guru Vani loading error:', error);
      setGuruVaniError(true);
    } finally {
      setLoadingGuruVani(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadLatestGuruVani();
    }, [loadLatestGuruVani])
  );

  // ========================================
  // LOAD ACTIVITY SECTIONS
  // ========================================
  const loadActivitySections = async () => {
    try {
      setLoadingSections(true);
      setSectionError(false);
      const response = await apiRequest(
        '/activity-sections'
      );
      if (
        response.success &&
        Array.isArray(response.data)
      ) {
        setSections(response.data);
      } else {
        setSections([]);
        setSectionError(true);
      }
    } catch (error) {
      console.error(
        'Activity sections loading error:',
        error
      );
      setSections([]);
      setSectionError(true);
    } finally {
      setLoadingSections(false);
    }
  };
  // ========================================
  // OPEN ACTIVITY SECTION
  // ========================================
  const openSection = (sectionId: number) => {
    router.push({
      pathname: '/activities/section/[id]',
      params: {
        id: String(sectionId),
      },
    });
  };
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ========================================
            PREMIUM HERO
        ======================================== */}
        <FadeIn>
          <LinearGradient
            colors={[
              '#7A3516',
              '#A65321',
              '#C27B31',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />
            <View style={styles.heroTopRow}>
              <View style={styles.heroPill}>
                <View style={styles.liveDot} />
                <Text style={styles.heroPillText}>
                  {t('activities.heroPill')}
                </Text>
              </View>
              <View style={styles.omBadge}>
                <Text style={styles.omText}>
                  ॐ
                </Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>
              {t('activities.title')}
            </Text>
            <Text style={styles.heroSubtitle}>
              {t('activities.subtitle')}
            </Text>
            <View style={styles.heroBottom}>
              <View>
                <Text style={styles.heroSmallLabel}>
                  {t('activities.spaceTo')}
                </Text>
                <Text style={styles.heroSmallValue}>
                  {t('activities.connectLearnServe')}
                </Text>
              </View>
              <Text style={styles.heroSparkle}>
                ✦
              </Text>
            </View>
          </LinearGradient>
        </FadeIn>
        {/* ========================================
            INTRODUCTION
        ======================================== */}
        <FadeIn delay={80}>
          <View style={styles.introCard}>
            <View style={styles.introIconWrap}>
              <Text style={styles.introIcon}>
                ॐ
              </Text>
            </View>
            <View style={styles.introCopy}>
              <Text style={styles.introTitle}>
                {t('activities.livingTradition')}
              </Text>
              <Text style={styles.introText}>
                {t('activities.introText')}
              </Text>
            </View>
            <Text style={styles.introArrow}>
              ↗
            </Text>
          </View>
        </FadeIn>
        {/* ========================================
            DYNAMIC ACTIVITY SECTIONS
        ======================================== */}
        <FadeIn delay={140}>
          <SectionHeading
            eyebrow={t('activities.explore')}
            title={t('activities.spiritualActivities')}
          />
          {loadingSections ? (
            <View style={styles.loadingCard}>
              <Text style={styles.loadingIcon}>
                ॐ
              </Text>
              <Text style={styles.loadingText}>
                {t('activities.loading')}
              </Text>
            </View>
          ) : sectionError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorIcon}>
                ⚠️
              </Text>
              <Text style={styles.errorTitle}>
                {t('activities.loadError')}
              </Text>
              <Text style={styles.errorText}>
                {t('activities.connectionError')}
              </Text>
              <Pressable
                style={styles.retryButton}
                onPress={loadActivitySections}
              >
                <Text style={styles.retryButtonText}>
                  {t('activities.retry')}
                </Text>
              </Pressable>
            </View>
          ) : sections.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>
                🙏
              </Text>
              <Text style={styles.emptyTitle}>
                {t('activities.noActivities')}
              </Text>
              <Text style={styles.emptyText}>
                {t('activities.emptyText')}
              </Text>
            </View>
          ) : (
            sections.map((section, index) => (
              <Pressable
                key={section.id}
                style={({ pressed }) => [
                  styles.featureCard,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  openSection(section.id)
                }
              >
                <LinearGradient
                  colors={
                    index % 3 === 0
                      ? ['#FFF9F1', '#F5E4D0']
                      : index % 3 === 1
                        ? ['#FFFFFF', '#F6EBD9']
                        : ['#FDF7EE', '#F1DDC7']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.featureGradient}
                >
                  <View
                    style={[
                      styles.featureIcon,
                      index % 3 === 1 &&
                      styles.featureIconGold,
                      index % 3 === 2 &&
                      styles.featureIconDark,
                    ]}
                  >
                    <Text style={styles.featureIconText}>
                      {section.icon || '✦'}
                    </Text>
                  </View>
                  <View style={styles.featureContent}>
                    <View style={styles.featureTitleRow}>
                      <Text
                        style={styles.featureTitle}
                        numberOfLines={2}
                      >
                        {section.name}
                      </Text>
                      <Text style={styles.featureArrow}>
                        →
                      </Text>
                    </View>
                    <Text style={styles.featureDescription}>
                      {section.description ||
                        t('activities.descriptionFallback')}
                    </Text>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>
                        {t('activities.explore')}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </Pressable>
            ))
          )}
        </FadeIn>
        {/* ========================================
            GURU VANI — DYNAMIC
        ======================================== */}


{/* ========================================
    GURU VANI — DYNAMIC & TRANSLATED
======================================== */}

<FadeIn delay={260}>
  <SectionHeading
    eyebrow={t('activities.dailyReflection')}
    title={t('activities.guruVani')}
  />

  <LinearGradient
    colors={['#2F2018', '#503225']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.vaniCard}
  >
    <View style={styles.vaniPattern}>
      <Text style={styles.vaniPatternText}>
        ॐ
      </Text>
    </View>

    <View style={styles.vaniTop}>
      <View style={styles.vaniBadge}>
        <Text style={styles.vaniBadgeText}>
          {t('activities.guruVani')}
        </Text>
      </View>

      <Text style={styles.vaniMark}>
        ✦
      </Text>
    </View>

    {/* LOADING */}

    {loadingGuruVani ? (
      <Text style={styles.vaniDescription}>
        {t('activities.loading')}
      </Text>
    ) : guruVaniError ? (
      /* ERROR */

      <View>
        <Text style={styles.vaniDescription}>
          {t('activities.guruVaniLoadError')}
        </Text>

        <Pressable
          onPress={() => void loadLatestGuruVani()}
        >
          <Text style={styles.vaniExploreText}>
            {t('activities.retry')} ↻
          </Text>
        </Pressable>
      </View>
    ) : latestGuruVani ? (
      /* GURU VANI CONTENT */

      <>
        <Text style={styles.vaniTitle}>
          {latestGuruVani.title}
        </Text>

        <Text style={styles.vaniQuote}>
          {latestGuruVani.sloka}
        </Text>

        {Boolean(
          latestGuruVani.transliteration?.trim()
        ) && (
          <Text style={styles.vaniDescription}>
            {latestGuruVani.transliteration}
          </Text>
        )}

        {Boolean(latestGuruVani.meaning?.trim()) && (
          <>
            <View style={styles.vaniDivider} />

            <Text style={styles.vaniDescription}>
              {latestGuruVani.meaning}
            </Text>
          </>
        )}

        {Boolean(latestGuruVani.guru_name?.trim()) && (
          <Text style={styles.vaniGuruName}>
            — {latestGuruVani.guru_name}
          </Text>
        )}
      </>
    ) : (
      /* EMPTY STATE */

      <Text style={styles.vaniDescription}>
        {t('activities.guruVaniEmpty')}
      </Text>
    )}

    {/* EXPLORE ALL */}

    <Pressable
      style={({ pressed }) => [
        styles.vaniExploreButton,
        pressed && styles.buttonPressed,
      ]}
      onPress={() =>
        router.push('/guru-vani' as any)
      }
      accessibilityRole="button"
      accessibilityLabel={t(
        'activities.guruVaniExploreAccessibility'
      )}
    >
      <Text style={styles.vaniExploreText}>
        {t('activities.guruVaniExploreAll')} →
      </Text>
    </Pressable>
  </LinearGradient>
</FadeIn>

        {/* ========================================
            INSIGHTS
        ======================================== */}
        <FadeIn delay={440}>
          <SectionHeading
            eyebrow={t('activities.stayConnected')}
            title={t('activities.insights')}
          />
          <View style={styles.insightsCard}>
            {insights.map((item, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.insightRow,
                  index !== insights.length - 1 &&
                  styles.insightBorder,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.insightNumber}>
                  <Text style={styles.insightNumberText}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                </View>
                <Text style={styles.insightText}>
                  {item}
                </Text>
                <Text style={styles.insightArrow}>
                  ↗
                </Text>
              </Pressable>
            ))}
          </View>
        </FadeIn>
        {/* ========================================
            BOTTOM NOTE
        ======================================== */}
        <Text style={styles.bottomNote}>
          {t('activities.bottomNote')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 44,
  },
  // ========================================
  // HERO
  // ========================================
  hero: {
    minHeight: 285,
    borderRadius: 30,
    padding: 22,
    overflow: 'hidden',
    marginBottom: 18,
  },
  heroGlowOne: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -60,
    top: -70,
    backgroundColor:
      'rgba(255,255,255,0.08)',
  },
  heroGlowTwo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    left: -80,
    bottom: -70,
    backgroundColor:
      'rgba(255,255,255,0.06)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor:
      'rgba(255,255,255,0.12)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F5D49A',
    marginRight: 7,
  },
  heroPillText: {
    fontSize: 8,
    color: '#FFF8ED',
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  omBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.35)',
    backgroundColor:
      'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  omText: {
    color: '#FFF7E9',
    fontSize: 27,
  },
  heroTitle: {
    marginTop: 42,
    fontSize: 38,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 20,
    color: '#F9EBDD',
    maxWidth: '90%',
  },
  heroBottom: {
    marginTop: 30,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroSmallLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#F3D8B5',
    letterSpacing: 1,
  },
  heroSmallValue: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  heroSparkle: {
    fontSize: 26,
    color: '#F4D18D',
  },
  // ========================================
  // INTRO
  // ========================================
  introCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  introIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  introIcon: {
    fontSize: 23,
    color: COLORS.primary,
  },
  introCopy: {
    flex: 1,
  },
  introTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  introText: {
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSoft,
  },
  introArrow: {
    fontSize: 22,
    color: COLORS.gold,
    marginLeft: 8,
  },
  // ========================================
  // SECTION HEADING
  // ========================================
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
    marginTop: 5,
  },
  sectionHeadingLeft: {
    flex: 1,
  },
  sectionEyebrow: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.text,
  },
  sectionAction: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  // ========================================
  // DYNAMIC ACTIVITY SECTIONS
  // ========================================
  featureCard: {
    borderRadius: 22,
    marginBottom: 13,
    overflow: 'hidden',
    elevation: 2,
  },
  featureGradient: {
    minHeight: 145,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: '#EFD4B4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  featureIconGold: {
    backgroundColor: '#F0D69F',
  },
  featureIconDark: {
    backgroundColor: '#E5C5A4',
  },
  featureIconText: {
    fontSize: 28,
    color: COLORS.primaryDark,
  },
  featureContent: {
    flex: 1,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  featureArrow: {
    fontSize: 21,
    color: COLORS.primary,
    marginLeft: 8,
  },
  featureDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSoft,
    marginTop: 6,
  },
  chip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor:
      'rgba(155,75,30,0.09)',
  },
  chipText: {
    fontSize: 7,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  loadingCard: {
    minHeight: 145,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 13,
  },
  loadingIcon: {
    fontSize: 32,
    color: COLORS.primary,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSoft,
  },
  errorCard: {
    borderRadius: 22,
    padding: 25,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8C9C0',
    marginBottom: 13,
  },
  errorIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  errorText: {
    marginTop: 5,
    fontSize: 11,
    color: COLORS.textSoft,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 22,
    padding: 28,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 13,
  },
  emptyIcon: {
    fontSize: 35,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSoft,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  // ========================================
  // GURU VANI
  // ========================================
  vaniCard: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  vaniPattern: {
    position: 'absolute',
    right: -20,
    bottom: -30,
    opacity: 0.08,
  },
  vaniPatternText: {
    fontSize: 130,
    color: '#FFFFFF',
  },
  vaniTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vaniBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor:
      'rgba(255,255,255,0.10)',
  },
  vaniBadgeText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#EBCB9D',
    letterSpacing: 1,
  },
  vaniMark: {
    color: '#EBCB9D',
    fontSize: 20,
  },
  vaniTitle: {
    marginTop: 20,
    fontSize: 13,
    fontWeight: '800',
    color: '#EBCB9D',
  },
  vaniExploreButton: {
    alignSelf: 'flex-start',
    marginTop: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(235,203,157,0.55)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  vaniExploreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F3D49F',
  },
  vaniGuruName: {
    marginTop: 13,
    fontSize: 11,
    fontWeight: '700',
    color: '#EBCB9D',
  },
  vaniQuote: {
    marginTop: 22,
    fontSize: 20,
    lineHeight: 29,
    color: '#FFF8ED',
    fontWeight: '700',
  },
  vaniDivider: {
    width: 50,
    height: 2,
    backgroundColor: '#C88A32',
    marginTop: 17,
    marginBottom: 13,
  },
  vaniDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: '#D8C7BA',
  },
  // ========================================
  // PROGRAMS
  // ========================================
  horizontalList: {
    paddingBottom: 5,
  },
  programCard: {
    width: 230,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 13,
    marginRight: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  programVisual: {
    height: 115,
    borderRadius: 15,
    backgroundColor: '#F4E4D0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  programOrbLarge: {
    position: 'absolute',
    width: 125,
    height: 125,
    borderRadius: 63,
    backgroundColor:
      'rgba(200,138,50,0.12)',
  },
  programOrbSmall: {
    position: 'absolute',
    width: 75,
    height: 75,
    borderRadius: 38,
    backgroundColor:
      'rgba(155,75,30,0.08)',
  },
  programIcon: {
    fontSize: 38,
    color: COLORS.primary,
  },
  programMeta: {
    fontSize: 7,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 1,
  },
  programTitle: {
    marginTop: 5,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  programDescription: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 16,
    color: COLORS.textSoft,
  },
  programFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  programLink: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
  },
  programArrow: {
    fontSize: 16,
    color: COLORS.gold,
  },
  // ========================================
  // SEVA
  // ========================================
  sevaCard: {
    marginTop: 22,
    borderRadius: 25,
    padding: 22,
    overflow: 'hidden',
  },
  sevaDecorOne: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    right: -50,
    top: -55,
    backgroundColor:
      'rgba(255,255,255,0.07)',
  },
  sevaDecorTwo: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    left: -55,
    bottom: -55,
    backgroundColor:
      'rgba(255,255,255,0.05)',
  },
  sevaIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor:
      'rgba(255,255,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sevaIcon: {
    fontSize: 24,
    color: '#F4D18D',
  },
  sevaEyebrow: {
    marginTop: 18,
    fontSize: 8,
    fontWeight: '800',
    color: '#F0D0A5',
    letterSpacing: 1.1,
  },
  sevaTitle: {
    marginTop: 5,
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
  },
  sevaText: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 18,
    color: '#F3DED0',
    maxWidth: '90%',
  },
  sevaButton: {
    marginTop: 17,
    alignSelf: 'flex-start',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 13,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  sevaButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  sevaButtonArrow: {
    marginLeft: 8,
    fontSize: 16,
    color: COLORS.primary,
  },
  // ========================================
  // INSIGHTS
  // ========================================
  insightsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  insightRow: {
    minHeight: 58,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowPressed: {
    backgroundColor: '#FBF3E8',
  },
  insightNumber: {
    width: 34,
  },
  insightNumberText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.gold,
  },
  insightText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.text,
    fontWeight: '600',
  },
  insightArrow: {
    fontSize: 17,
    color: COLORS.primary,
    marginLeft: 8,
  },
  // ========================================
  // BOTTOM
  // ========================================
  bottomNote: {
    marginTop: 25,
    fontSize: 10,
    lineHeight: 16,
    color: COLORS.textSoft,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
