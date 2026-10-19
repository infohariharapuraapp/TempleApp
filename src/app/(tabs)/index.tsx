import { API_BASE_URL, apiRequest } from '@/services/api';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { router, useFocusEffect } from 'expo-router';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  bg: '#FFFCF7',
  brown: '#5A1820',
  darkBrown: '#741B22',
  gold: '#B8872E',
  goldLight: '#F1D58A',
  cream: '#F8EBD8',
  white: '#FFFFFF',
  muted: '#7D6B60',
  line: '#E9DCCB',
  soft: '#FFFDF9',
  peach: '#F4E0C8',
  green: '#61734A',
};


const FONTS = {
  display: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'serif',
  }),
  body: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'sans-serif',
  }),
  medium: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    default: 'sans-serif',
  }),
};

type Guru = {
  id: number;
  name: string;
  title: string | null;
  image_url: string | null;
  verse: string | null;
  transliteration: string | null;
  translation: string | null;
  display_order: number;
  is_active: boolean;
};

const QUICK_ACTIONS = [
  { icon: '🙏', titleKey: 'home.quickDarshan', route: '/darshan' },
  { icon: '📅', titleKey: 'home.quickEvents', route: '/events' },
  { icon: '💰', titleKey: 'home.quickDonations', route: '/donations' },
  { icon: '🖼️', titleKey: 'Gallery', route: '/gallery' },
{ icon: '🪔', titleKey: 'home.quickSeva', route: '/seva-registration', comingSoon: true },

 {
    icon: '🛕',
    titleKey: 'home.poojaServices',
    route: '/pooja-services',
  },
];

type DarshanVideo = {
  id: number;
  title: string;
  description?: string | null;
  label: 'live' | 'watch';
  url: string;
  thumbnail_url?: string | null;
  is_active: boolean;
};

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  useFocusEffect(
    useCallback(() => {
      loadUnreadNotificationCount();
    }, [])
  );
  const { width } = useWindowDimensions();
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [gurusLoading, setGurusLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [darshanVideos, setDarshanVideos] = useState<DarshanVideo[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Keep the player stable; fetch and load the admin audio only once.
  const player = useAudioPlayer(
    require('@/assets/audio/home-welcome.mp3'),
    { downloadFirst: true }
  );
  const playerStatus = useAudioPlayerStatus(player);
  const [welcomeAudioReady, setWelcomeAudioReady] = useState(false);
  const welcomeFocusedRef = useRef(false);
  const [welcomeVisit, setWelcomeVisit] = useState(0);
  const welcomeStartedRef = useRef(false);
  const welcomePlaybackTokenRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const loadWelcomeSlokam = async () => {
      try {
        const response = await apiRequest<{
          success: boolean;
          data: {
            id: number;
            title: string;
            audio_url: string;
          } | null;
        }>('/welcome-slokams/active');

        if (cancelled) return;

        if (
          response.success &&
          response.data?.audio_url?.startsWith('https://')
        ) {
          // Replace only when the admin URL is fetched, not on every focus.
          player.replace({ uri: response.data.audio_url });
          console.log('Active Welcome Slokam:', response.data.title);
        }
      } catch (error) {
        console.warn('Welcome Slokam API unavailable. Using bundled audio.', error);
      } finally {
        if (!cancelled) setWelcomeAudioReady(true);
      }
    };

    void loadWelcomeSlokam();
    return () => {
      cancelled = true;
    };
  }, [player]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const pageFade = useRef(new Animated.Value(0)).current;
  const pageSlide = useRef(new Animated.Value(24)).current;
  const heroPulse = useRef(new Animated.Value(0)).current;
  const omRotate = useRef(new Animated.Value(0)).current;
  const notificationScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(pageFade, {
        toValue: 1,
        duration: 750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(pageSlide, {
        toValue: 0,
        tension: 45,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pageFade, pageSlide]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(heroPulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(heroPulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const rotate = Animated.loop(
      Animated.sequence([
        Animated.timing(omRotate, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(omRotate, {
          toValue: -1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();
    rotate.start();

    return () => {
      pulse.stop();
      rotate.stop();
    };
  }, [heroPulse, omRotate]);

  // A new Home visit permits exactly one playback start.
  useFocusEffect(
    useCallback(() => {
      welcomeFocusedRef.current = true;
      welcomeStartedRef.current = false;
      welcomePlaybackTokenRef.current += 1;
      setWelcomeVisit(visit => visit + 1);

      return () => {
        welcomeFocusedRef.current = false;
        welcomeStartedRef.current = false;
        welcomePlaybackTokenRef.current += 1;
        try {
          player.pause();
        } catch (error) {
          console.warn('Welcome Slokam pause error:', error);
        }
      };
    }, [player])
  );

  // Wait until the selected audio is loaded before starting playback.
  // Player status updates must not restart audio while it is already playing.
  useEffect(() => {
    if (
      !welcomeFocusedRef.current ||
      welcomeStartedRef.current ||
      !welcomeAudioReady ||
      !playerStatus.isLoaded
    ) {
      return;
    }

    welcomeStartedRef.current = true;
    const token = welcomePlaybackTokenRef.current;

    const playWelcomeSlokam = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'doNotMix',
        });

        if (
          !welcomeFocusedRef.current ||
          welcomePlaybackTokenRef.current !== token
        ) return;

        player.volume = 1;
        await player.seekTo(0);

        if (
          !welcomeFocusedRef.current ||
          welcomePlaybackTokenRef.current !== token
        ) return;

        player.play();
        console.log('Welcome Slokam started for this Home visit');
      } catch (error) {
        console.error('Welcome Slokam playback error:', error);
      }
    };

    void playWelcomeSlokam();
  }, [player, playerStatus.isLoaded, welcomeAudioReady, welcomeVisit]);

  useEffect(() => {
    loadEvents();
    loadDarshanVideos();
    void loadGurus();

  }, []);

  const loadGurus = async () => {
    try {
      setGurusLoading(true);
      const response = await apiRequest<{
        success: boolean;
        data: Guru[];
      }>('/guru-parampara');

      if (response.success && Array.isArray(response.data)) {
        setGurus(response.data);
      } else {
        setGurus([]);
      }
    } catch (error) {
      console.error('Home Guru Parampara error:', error);
      setGurus([]);
    } finally {
      setGurusLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      setEventsLoading(true);
      const response = await apiRequest('/events');

      if (response.success && Array.isArray(response.data)) {
        setEvents(response.data.slice(0, 2));
      }
    } catch (error) {
      console.error('Home events error:', error);
    } finally {
      setEventsLoading(false);
    }
  };

  const loadUnreadNotificationCount = async () => {
    try {
      const response = await apiRequest(
        '/notifications/unread-count'
      );

      if (response.success) {
        setUnreadNotificationCount(
          response.data?.unreadCount || 0
        );
      }
    } catch (error) {
      console.error(
        'Unread notification count error:',
        error
      );

      setUnreadNotificationCount(0);
    }
  };
  const loadDarshanVideos = async () => {
    try {
      const response = await apiRequest<{
        success: boolean;
        data: DarshanVideo[];
      }>('/darshan-videos');

      if (response.success && Array.isArray(response.data)) {
        setDarshanVideos(response.data);
      } else {
        setDarshanVideos([]);
      }
    } catch (error) {
      console.error('Home Darshan Videos error:', error);
      setDarshanVideos([]);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrolled(event.nativeEvent.contentOffset.y > 55);
  };

  const heroScale = scrollY.interpolate({
    inputRange: [-100, 0, 180],
    outputRange: [1.08, 1, 0.96],
    extrapolate: 'clamp',
  });

  const heroTranslateY = scrollY.interpolate({
    inputRange: [-100, 0, 180],
    outputRange: [-18, 0, 24],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const omScale = heroPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.09],
  });

  const omTranslateY = heroPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  const omTilt = omRotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-3deg', '3deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.floatingHeader,
          {
            opacity: headerOpacity,
            transform: [
              {
                translateY: headerOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.floatingHeaderLine} />
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: handleScroll,
          },
        )}
      >
        <Animated.View
          style={{
            opacity: pageFade,
            transform: [{ translateY: pageSlide }],
          }}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.greeting}>{t('home.greeting')}</Text>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{t('home.brand')}</Text>
                <View style={styles.titleDot} />
              </View>
              <Text style={styles.subtitle}>{t('home.place')}</Text>
            </View>

            <AnimatedTouchable
              style={[
                styles.notificationButton,
                {
                  transform: [{ scale: notificationScale }],
                },
              ]}
              onPress={() => router.push('/notifications')}
              onPressIn={() => animatePress(notificationScale, 0.9)}
              onPressOut={() => animatePress(notificationScale, 1)}
            >
              <Text style={styles.notificationIcon}>🔔</Text>

              {unreadNotificationCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadNotificationCount > 99
                      ? '99+'
                      : unreadNotificationCount}
                  </Text>
                </View>
              )}
            </AnimatedTouchable>
          </View>

          {/* Hero */}
          <Animated.View
            style={[
              styles.banner,
              {
                width: width - 40,
                transform: [
                  { translateY: heroTranslateY },
                  { scale: heroScale },
                ],
              },
            ]}
          >
            <Image
              source={{
                uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/guru-parampara/narashimha.jpg',
              }}
              style={styles.bannerBackground}
              resizeMode="cover"
            />

            <View style={styles.bannerTint} />
            <View style={styles.bannerGlow} />
            <View style={styles.bannerBorder} />

            <View style={styles.bannerDecorTop}>
              <View style={styles.decorLine} />
              <Text style={styles.decorDiamond}>◆</Text>
              <View style={styles.decorLine} />
            </View>

            <View style={styles.bannerContent}>
              <Animated.Text
                style={[
                  styles.om,
                  {
                    transform: [
                      { translateY: omTranslateY },
                      { scale: omScale },
                      { rotate: omTilt },
                    ],
                  },
                ]}
              >
                ॐ
              </Animated.Text>

              <Text style={styles.bannerEyebrow}>
                {t('home.heroEyebrow')}
              </Text>

              <Text style={styles.bannerTitle}>
                {t('home.heroTitle')}
              </Text>

              <Text style={styles.bannerText}>
                {t('home.heroDescription')}
              </Text>

              <AnimatedTouchable
                style={styles.bannerButton}
                onPress={() => router.push('/darshan')}
              >
                <Text style={styles.bannerButtonText}>{t('home.exploreTemple')}</Text>
                <Text style={styles.bannerButtonArrow}>→</Text>
              </AnimatedTouchable>
            </View>

            <View style={styles.bannerBottomBadge}>
              <Text style={styles.bannerBottomBadgeText}>हरिः ॐ</Text>
            </View>
          </Animated.View>



          {/* Quick Access */}
          <SectionHeading
            title={t('home.quickAccess')}
            subtitle={t('home.quickSubtitle')}
          />

         <View style={styles.grid}>
  {QUICK_ACTIONS.map((item, index) => {
    const comingSoon = 'comingSoon' in item && item.comingSoon;

    return (
      <AnimatedQuickAction
        key={item.titleKey}
        icon={item.icon}
        title={
          comingSoon
            ? `${t(item.titleKey)} (Coming Soon)`
            : t(item.titleKey)
        }
        index={index}
        onPress={
          comingSoon
            ? () => {}
            : () => router.push(item.route as any)
        }
      />
    );
  })}
</View>

          {/* Dharma Sandeham */}
          <TouchableOpacity
            style={styles.dharmaCard}
            activeOpacity={0.85}
            onPress={() => router.push('/dharma' as any)}
          >
            <View style={styles.dharmaIconCircle}>
              <Text style={styles.dharmaIcon}>ॐ</Text>
            </View>

            <View style={styles.dharmaContent}>
              <Text style={styles.dharmaTag}>
                DEVOTEE COMMUNITY
              </Text>

              <Text style={styles.dharmaTitle}>
                Dharma Sandeham
              </Text>

              <Text style={styles.dharmaDescription}>
                Ask questions about temple traditions,
                pooja rituals and spiritual practices.
                Share knowledge with fellow devotees.
              </Text>

              <View style={styles.dharmaAction}>
                <Text style={styles.dharmaActionText}>
                  Explore Questions
                </Text>
                <Text style={styles.dharmaActionArrow}>
                  →
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Watch & Experience */}
          <View style={styles.videoSectionHeader}>
            <View>
              <Text style={styles.videoEyebrow}>{t('home.watchExperience')}</Text>
              <Text style={styles.videoSectionTitle}>{t('home.darshanVideos')}</Text>
              <Text style={styles.videoSectionSubtitle}>{t('home.videoSubtitle')}</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/darshan-videos')}
              activeOpacity={0.7}
              style={styles.videoViewAll}
            >
              <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
              <Text style={styles.viewAllArrow}>→</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.videoList}
          >
            {darshanVideos.map((video, index) => {
              const openVideo = () => {
                if (video.url) {
                  Linking.openURL(video.url);
                }
              };

              const thumbnail = video.thumbnail_url
                ? video.thumbnail_url.startsWith('http')
                  ? video.thumbnail_url
                  : `${API_BASE_URL.replace(/\/api\/?$/, '')}${video.thumbnail_url.startsWith('/') ? '' : '/'
                  }${video.thumbnail_url}`
                : '';

              return (
                <TouchableOpacity
                  key={video.id}
                  activeOpacity={video.url ? 0.82 : 1}
                  onPress={openVideo}
                  style={[styles.videoCard, index === darshanVideos.length - 1 && styles.videoCardLast]}
                >
                  <View style={styles.videoThumbnailWrap}>
                    <Image
                      source={{ uri: thumbnail }}
                      style={styles.videoThumbnail}
                      resizeMode="cover"
                    />
                    <View style={styles.videoThumbnailShade} />

                    <View style={styles.videoPlayButton}>
                      <Text style={styles.videoPlayIcon}>▶</Text>
                    </View>

                    {video.label === 'live' ? (
                      <View style={styles.videoLiveBadge}>
                        <View style={styles.videoLiveDot} />
                        <Text style={styles.videoLiveText}>{t('home.live')}</Text>
                      </View>
                    ) : null}

                  </View>

                  <View style={styles.videoCardBody}>
                    <Text style={styles.videoCardLabel}>
                      {video.label === 'live' ? t('home.live') : t('home.watch')}
                    </Text>
                    <Text style={styles.videoCardTitle} numberOfLines={1}>{video.title}</Text>
                    <Text style={styles.videoCardDescription} numberOfLines={2}>
                      {video.description}
                    </Text>
                    <Text style={styles.videoWatchNow}>{t('home.watchNow')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* About Sreemath */}
          <SectionHeading
            title={t('home.aboutSreemath')}
            subtitle={t('home.heritageSubtitle')}
          />

          <AnimatedTouchable
            style={styles.aboutCard}
            onPress={() => router.push('/about-sreemath')}
          >
            <Image
              source={{
                uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/guru-parampara/narashimha.jpg',
              }}
              style={styles.aboutImage}
              resizeMode="cover"
            />
            <View style={styles.aboutImageShade} />
            <View style={styles.aboutOverlay}>
              <View style={styles.imageBadge}>
                <Text style={styles.imageBadgeText}>{t('home.sacredHeritage')}</Text>
              </View>

              <Text style={styles.aboutLabel}>{t('home.ourHeritage')}</Text>
              <Text style={styles.aboutTitle}>{t('home.sreemath')}</Text>
              <Text style={styles.aboutText}>
                {t('home.peetam')}
              </Text>

              <View style={styles.readMore}>
                <Text style={styles.readMoreText}>{t('home.readFullStory')}</Text>
                <Text style={styles.readMoreArrow}>→</Text>
              </View>
            </View>
          </AnimatedTouchable>



          {/* Guru Parampara */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{t('home.guruParampara')}</Text>
              <Text style={styles.sectionMini}>{t('home.sacredLineage')}</Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/guru-parampara')}
              activeOpacity={0.7}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
              <Text style={styles.viewAllArrow}>→</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionIntro}>
            {t('home.guruIntro')}
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.guruScroll}
          >
            {gurusLoading ? (
              <Text style={styles.sectionIntro}>Loading Guru Parampara...</Text>
            ) : gurus.length > 0 ? (
              gurus.map((guru, index) => (
                <AnimatedGuruCard
                  key={guru.id}
                  guru={guru}
                  index={index}
                  onPress={() => router.push('/guru-parampara')}
                />
              ))
            ) : (
              <Text style={styles.sectionIntro}>
                Guru Parampara information will be available soon.
              </Text>
            )}
          </ScrollView>

          {/* Room Booking */}
          {/* Room Booking */}
          <AnimatedTouchable
            style={styles.roomBookingCard}
            onPress={() => router.push('/room-booking')}
          >
            <View style={styles.roomGlow} />
            <View style={styles.roomBookingContent}>
              <View style={styles.stayBadge}>
                <Text style={styles.stayBadgeText}>{t('home.stayBadge')}</Text>
              </View>

              <Text style={styles.roomBookingTitle}>{t('home.roomBooking')}</Text>

              <Text style={styles.roomBookingText}>
                {t('home.roomDescription')}
              </Text>

              <View style={styles.roomBookingButton}>
                <Text style={styles.roomBookingButtonText}>{t('home.bookRoom')}</Text>
                <Text style={styles.roomBookingButtonArrow}>→</Text>
              </View>
            </View>

            <View style={styles.roomIconOrb}>
              <Text style={styles.roomBookingIcon}>🏨</Text>
            </View>
          </AnimatedTouchable>

          {/* Upcoming Events */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{t('home.upcomingEvents')}</Text>
              <Text style={styles.sectionMini}>{t('home.joinCelebrations')}</Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/events')}
              activeOpacity={0.7}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
              <Text style={styles.viewAllArrow}>→</Text>
            </TouchableOpacity>
          </View>

          {eventsLoading ? (
            <EventsSkeleton />
          ) : events.length > 0 ? (
            events.map((event, index) => (
              <AnimatedEventCard
                key={event.id}
                index={index}
                date={
                  event.event_date
                    ? new Date(event.event_date)
                      .toLocaleDateString(({ en: 'en-US', te: 'te-IN', kn: 'kn-IN', hi: 'hi-IN', ta: 'ta-IN' } as Record<string, string>)[i18n.language] || 'en-US', {
                        month: 'short',
                        day: '2-digit',
                      })
                      .toUpperCase()
                    : t('home.date')
                }
                title={event.title}
                description={
                  event.description || t('home.eventFallback')
                }
                onPress={() => router.push('/events')}
              />
            ))
          ) : (
            <View style={styles.emptyEventCard}>
              <Text style={styles.emptyEventIcon}>🪔</Text>
              <Text style={styles.emptyEventTitle}>{t('home.noEvents')}</Text>
              <Text style={styles.emptyEventText}>
                {t('home.noEventsDescription')}
              </Text>
            </View>
          )}



          {/* About Us */}
          <SectionHeading
            title={t('home.aboutUs')}
            subtitle={t('home.aboutUsSubtitle')}
          />

          <AnimatedTouchable
            style={styles.aboutUsCard}
            onPress={() => router.push('/about')}
          >
            {/* Full temple image behind the complete About Us section */}
            <Image
              source={{
                uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/normal/about-img.jpg',
              }}
              style={styles.aboutUsFullImage}
              resizeMode="cover"
            />

            {/* Warm light-brown overlay covers the entire image */}
            <View style={styles.aboutUsFullOverlay} />

            {/* All About Us content sits above the background image */}
            <View style={styles.aboutUsContent}>
              <Text style={styles.aboutUsImageCaptionSmall}>
                DIVYAKSHETRA HARIHARAPURA
              </Text>

              <Text style={styles.aboutUsImageCaptionTitle}>
                {t('home.dharmapeetam')}
              </Text>

              <View style={styles.aboutUsDivider} />

              <Text style={styles.aboutUsText}>
                {t('home.aboutParagraph1')}
              </Text>

              <Text style={styles.aboutUsText}>
                {t('home.aboutParagraph2')}
              </Text>

              <Text style={styles.aboutUsText}>
                {t('home.aboutParagraph3')}
              </Text>

              <View style={styles.aboutUsReadMore}>
                <Text style={styles.aboutUsReadMoreText}>{t('home.readMore')}</Text>
                <Text style={styles.aboutUsReadMoreArrow}>→</Text>
              </View>
            </View>
          </AnimatedTouchable>

          {/* Temple Services */}
          <SectionHeading
            title={t('home.templeServices')}
            subtitle={t('home.servicesSubtitle')}
          />

          <View style={styles.serviceCard}>
          
            
            {/* POOJA SERVICES */}

<ServiceRow
  icon="🙏"
  title={t('home.poojaServices', 'Pooja Services')}
  subtitle={t(
    'home.poojaServicesSubtitle',
    'Explore temple poojas and booking options'
  )}
  onPress={() => router.push('/pooja-services' as any)}
/>
            <ServiceRow
              icon="📍"
              title={t('home.templeLocation')}
              subtitle={t('home.planJourney')}
              onPress={() => router.push('/temple-location')}
            />
            <ServiceRow
              icon="☎️"
              title={t('home.contactTemple')}
              subtitle={t('home.reachTeam')}
              onPress={() => router.push('/contact')}
              last
            />
          </View>

          <View style={styles.footerBlessing}>
            <View style={styles.footerLine} />
            <Text style={styles.footerOm}>ॐ</Text>
            <Text style={styles.footerText}>{t('home.footer')}</Text>
            <Text style={styles.footerSubtext}>हरिः ॐ तत् सत्</Text>
            <View style={styles.footerLine} />
          </View>
        </Animated.View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

function animatePress(value: Animated.Value, toValue: number) {
  Animated.spring(value, {
    toValue,
    tension: 120,
    friction: 7,
    useNativeDriver: true,
  }).start();
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeadingWrap}>
      <View style={styles.sectionTitleAccent} />
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function AnimatedTouchable({
  children,
  style,
  onPress,
  onPressIn,
  onPressOut,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.975,
      tension: 180,
      friction: 8,
      useNativeDriver: true,
    }).start();
    onPressIn?.();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 180,
      friction: 8,
      useNativeDriver: true,
    }).start();
    onPressOut?.();
  };

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function AnimatedQuickAction({
  icon,
  title,
  index,
  onPress,
}: {
  icon: string;
  title: string;
  index: number;
  onPress: () => void;
}) {
  const entrance = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(entrance, {
          toValue: 1,
          tension: 55,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, index * 70);

    return () => clearTimeout(timer);
  }, [entrance, index]);

  const pressIn = () => animatePress(scale, 0.93);
  const pressOut = () => animatePress(scale, 1);

  return (
    <Animated.View
      style={[
        styles.actionCard,
        {
          opacity: entrance,
          transform: [
            { scale: Animated.multiply(entrance, scale) },
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
        style={styles.actionTouchable}
      >
        <View style={styles.actionShine} />
        <View style={styles.actionIconWrap}>
          <Text style={styles.actionIcon}>{icon}</Text>
        </View>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function AnimatedGuruCard({
  guru,
  index,
  onPress,
}: {
  guru: Guru;
  index: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();

  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      delay: 100 + index * 90,
      tension: 55,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          {
            translateX: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [42, 0],
            }),
          },
        ],
      }}
    >
      <AnimatedTouchable
        style={styles.guruCard}
        onPress={onPress}
      >
        <View>
          <Image
            source={guru.image_url ? { uri: guru.image_url } : require('@/assets/images/icon.png')}
            style={styles.guruImage}
            resizeMode="contain"
          />
          <View style={styles.guruImageOverlay} />
          <View style={styles.guruImageBadge}>
            <Text style={styles.guruImageBadgeText}>{t('home.guru')}</Text>
          </View>
        </View>

        <View style={styles.guruBody}>
          <Text style={styles.guruTitle}>{guru.title === 'GURU' ? t('home.guru') : guru.title === 'MAHASWAMIJI' ? t('home.mahaswamiji') : guru.title === 'BHAGAVATPĀDA' ? t('home.bhagavatpada') : guru.title || ''}</Text>
          <Text style={styles.guruName} numberOfLines={3}>{guru.name}</Text>
          <Text style={styles.guruVerse} numberOfLines={3}>
            {guru.verse}
          </Text>
          <Text style={styles.guruTranslation} numberOfLines={3}>
            “{guru.translation || ''}”
          </Text>

          <View style={styles.guruReadRow}>
            <Text style={styles.guruRead}>{t('home.viewGuru')}</Text>
            <Text style={styles.guruReadArrow}>→</Text>
          </View>
        </View>
      </AnimatedTouchable>
    </Animated.View>
  );
}

function AnimatedEventCard({
  date,
  title,
  description,
  index,
  onPress,
}: {
  date: string;
  title: string;
  description: string;
  index: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();

  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      delay: index * 80,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          {
            translateX: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [-32, 0],
            }),
          },
        ],
      }}
    >
      <AnimatedTouchable style={styles.eventCard} onPress={onPress}>
        <View style={styles.dateBox}>
          <Text style={styles.dateMonth}>{date.split(' ')[0]}</Text>
          <Text style={styles.dateDay}>{date.split(' ')[1]}</Text>
        </View>

        <View style={styles.eventContent}>
          <View style={styles.eventTagRow}>
            <View style={styles.eventTagDot} />
            <Text style={styles.eventTag}>{t('home.eventTag')}</Text>
          </View>
          <Text style={styles.eventTitle}>{title}</Text>
          <Text style={styles.eventDescription} numberOfLines={2}>
            {description}
          </Text>
        </View>

        <View style={styles.eventArrowCircle}>
          <Text style={styles.arrowSmall}>›</Text>
        </View>
      </AnimatedTouchable>
    </Animated.View>
  );
}

function EventsSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1].map((item) => (
        <View key={item} style={styles.eventSkeleton}>
          <View style={styles.skeletonDate} />
          <View style={styles.skeletonTextWrap}>
            <View style={styles.skeletonLineShort} />
            <View style={styles.skeletonLineLong} />
            <View style={styles.skeletonLineMedium} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ServiceRow({
  icon,
  title,
  subtitle,
  onPress,
  last,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.serviceRow, last && styles.lastServiceRow]}
        onPress={onPress}
        onPressIn={() => animatePress(scale, 0.985)}
        onPressOut={() => animatePress(scale, 1)}
        activeOpacity={1}
      >
        <View style={styles.serviceIconCircle}>
          <Text style={styles.serviceIcon}>{icon}</Text>
        </View>

        <View style={styles.serviceTextWrap}>
          <Text style={styles.serviceTitle}>{title}</Text>
          <Text style={styles.serviceSubtitle}>{subtitle}</Text>
        </View>

        <View style={styles.serviceArrowCircle}>
          <Text style={styles.arrowSmall}>›</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF7E8',
  },

  dharmaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#641B27',
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#C69A3A',
    elevation: 6,
  },

  dharmaIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#F8EBD8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#C69A3A',
  },

  dharmaIcon: {
    fontSize: 31,
    color: '#741B22',
    fontWeight: '700',
  },

  dharmaContent: {
    flex: 1,
  },

  dharmaTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#F1D58A',
    marginBottom: 5,
  },

  dharmaTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 7,
  },

  dharmaDescription: {
    fontSize: 11.5,
    lineHeight: 18,
    color: '#F8EBD8',
    marginBottom: 12,
  },

  dharmaAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  dharmaActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F1D58A',
  },

  dharmaActionArrow: {
    fontSize: 19,
    color: '#F1D58A',
    marginLeft: 8,
  },

  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 70,
  },

  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    zIndex: 20,
    backgroundColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },

  floatingHeaderLine: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingHorizontal: 2,
  },

  headerTextWrap: {
    flex: 1,
    paddingRight: 14,
  },

  greeting: {
    fontFamily: FONTS.medium,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.4,
    color: COLORS.gold,
    marginBottom: 5,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  title: {
    fontFamily: FONTS.display,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '700',
    color: COLORS.brown,
    letterSpacing: -0.6,
  },

  titleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
    marginLeft: 8,
    marginTop: 11,
  },

  subtitle: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: COLORS.darkBrown,
    letterSpacing: 0.4,
    marginTop: 1,
  },

  notificationButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8D8C3',
    shadowColor: COLORS.brown,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },

  notificationIcon: {
    fontSize: 19,
  },

  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C64732',
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },

  banner: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#65151F',
    borderRadius: 30,
    marginBottom: 31,
    minHeight: 405,
    shadowColor: '#5B1620',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.23,
    shadowRadius: 26,
    elevation: 11,
  },

  bannerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.52,
  },

  bannerTint: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(70, 8, 18, 0.57)',
  },

  bannerGlow: {
    position: 'absolute',
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: 'rgba(255, 218, 145, 0.13)',
    top: -145,
    right: -105,
  },

  bannerBorder: {
    position: 'absolute',
    top: 9,
    left: 9,
    right: 9,
    bottom: 9,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 158, 0.38)',
  },

  bannerDecorTop: {
    position: 'absolute',
    top: 22,
    left: 28,
    right: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  decorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 218, 145, 0.30)',
  },

  decorDiamond: {
    color: COLORS.goldLight,
    fontSize: 8,
    marginHorizontal: 12,
  },

  bannerContent: {
    position: 'relative',
    zIndex: 2,
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 38,
    alignItems: 'center',
  },

  om: {
    fontFamily: FONTS.display,
    fontSize: 64,
    lineHeight: 76,
    color: '#FFD98A',
    textShadowColor: 'rgba(255, 214, 119, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    marginBottom: 5,
  },

  bannerEyebrow: {
    fontFamily: FONTS.medium,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 2.2,
    color: '#EBCB9C',
    marginBottom: 12,
    textAlign: 'center',
  },

  bannerTitle: {
    fontFamily: FONTS.display,
    fontSize: 33,
    lineHeight: 38,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 13,
    letterSpacing: -0.35,
  },

  bannerText: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: '#F9E9D5',
    textAlign: 'center',
    maxWidth: 330,
    marginBottom: 24,
  },

  bannerButton: {
    backgroundColor: '#FFF8ED',
    paddingLeft: 21,
    paddingRight: 14,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },

  bannerButtonText: {
    fontFamily: FONTS.medium,
    color: COLORS.darkBrown,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.15,
  },

  bannerButtonArrow: {
    color: COLORS.gold,
    fontSize: 20,
    marginLeft: 10,
    fontWeight: '800',
  },

  bannerBottomBadge: {
    position: 'absolute',
    bottom: 15,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(91,18,27,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,218,145,0.28)',
  },

  bannerBottomBadgeText: {
    fontFamily: FONTS.display,
    color: '#F8D99B',
    fontSize: 10,
    fontWeight: '700',
  },

  sectionHeadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
    marginBottom: 15,
  },

  sectionTitleAccent: {
    width: 4,
    height: 34,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
    marginRight: 11,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 7,
    elevation: 3,
  },

  sectionTitle: {
    fontFamily: FONTS.display,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '700',
    color: COLORS.brown,
    letterSpacing: -0.15,
  },

  sectionSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 10.5,
    lineHeight: 16,
    color: COLORS.muted,
    marginTop: 2,
  },

  sectionMini: {
    fontFamily: FONTS.medium,
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 1.7,
    color: COLORS.gold,
    marginTop: 3,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
    marginBottom: 5,
  },

  sectionIntro: {
    fontFamily: FONTS.body,
    color: COLORS.muted,
    fontSize: 11.5,
    lineHeight: 18,
    marginBottom: 14,
  },

  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
  },

  viewAll: {
    fontFamily: FONTS.medium,
    color: COLORS.darkBrown,
    fontWeight: '800',
    fontSize: 10.5,
  },

  viewAllArrow: {
    color: COLORS.gold,
    fontSize: 18,
    marginLeft: 5,
    fontWeight: '800',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },

  actionCard: {
    width: '48.4%',
    minHeight: 132,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9DAC6',
    overflow: 'hidden',
    shadowColor: '#6D3D29',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
    elevation: 4,
  },

  actionTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    paddingHorizontal: 9,
  },

  actionShine: {
    position: 'absolute',
    top: -45,
    right: -45,
    width: 115,
    height: 115,
    borderRadius: 58,
    backgroundColor: 'rgba(184, 135, 46, 0.08)',
  },

  actionIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#FBF0DE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5C99F',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 7,
    elevation: 3,
    transform: [{ rotate: '2deg' }],
  },

  actionIcon: {
    fontSize: 25,
  },

  actionTitle: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.brown,
    textAlign: 'center',
    letterSpacing: 0.05,
  },

  actionArrow: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 23,
    height: 23,
    textAlign: 'center',
    color: COLORS.gold,
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '800',
  },

  videoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 13,
  },

  videoEyebrow: {
    fontFamily: FONTS.medium,
    color: COLORS.gold,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 3,
  },

  videoSectionTitle: {
    fontFamily: FONTS.display,
    color: COLORS.brown,
    fontSize: 23,
    fontWeight: '700',
  },

  videoSectionSubtitle: {
    fontFamily: FONTS.body,
    color: COLORS.muted,
    fontSize: 10.5,
    marginTop: 3,
    maxWidth: 235,
  },

  videoViewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 2,
    paddingLeft: 8,
  },

  videoList: {
    paddingBottom: 25,
  },

  videoCard: {
    width: 285,
    marginRight: 13,
    backgroundColor: COLORS.white,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: 'hidden',
    shadowColor: COLORS.brown,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 4,
  },

  videoCardLast: {
    marginRight: 18,
  },

  videoThumbnailWrap: {
    height: 158,
    backgroundColor: COLORS.cream,
    position: 'relative',
    overflow: 'hidden',
  },

  videoThumbnail: {
    width: '100%',
    height: '100%',
  },

  videoThumbnailShade: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(55, 18, 18, 0.28)',
  },

  videoPlayButton: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -25,
    marginTop: -25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,248,237,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.20,
    shadowRadius: 9,
    elevation: 5,
  },

  videoPlayIcon: {
    color: COLORS.darkBrown,
    fontSize: 19,
    marginLeft: 3,
  },

  videoLiveBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 13,
    backgroundColor: 'rgba(116,27,34,0.94)',
  },

  videoLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 5,
  },

  videoLiveText: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },

  videoComingBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 13,
    backgroundColor: 'rgba(255,248,237,0.94)',
  },

  videoComingText: {
    color: COLORS.darkBrown,
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  videoCardBody: {
    padding: 14,
    paddingBottom: 16,
  },

  videoCardLabel: {
    fontFamily: FONTS.medium,
    color: COLORS.gold,
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 5,
  },

  videoCardTitle: {
    fontFamily: FONTS.display,
    color: COLORS.brown,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 5,
  },

  videoCardDescription: {
    fontFamily: FONTS.body,
    color: COLORS.muted,
    fontSize: 10.5,
    lineHeight: 15,
    minHeight: 30,
  },

  videoWatchNow: {
    fontFamily: FONTS.medium,
    color: COLORS.darkBrown,
    fontSize: 9.5,
    fontWeight: '900',
    marginTop: 10,
  },

  videoWatchSoon: {
    fontFamily: FONTS.medium,
    color: COLORS.muted,
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: 10,
  },

  aboutCard: {
    height: 305,
    borderRadius: 27,
    overflow: 'hidden',
    marginBottom: 26,
    backgroundColor: '#6E4025',
    shadowColor: COLORS.brown,
    shadowOffset: { width: 0, height: 11 },
    shadowOpacity: 0.20,
    shadowRadius: 19,
    elevation: 8,
  },

  aboutImage: {
    width: '100%',
    height: '100%',
  },

  aboutImageShade: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(70, 19, 18, 0.22)',
  },

  aboutOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingTop: 200,
    backgroundColor: 'rgba(67, 24, 21, 0.72)',
  },

  imageBadge: {
    position: 'absolute',
    right: 18,
    top: -31,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255,248,237,0.95)',
    borderWidth: 1,
    borderColor: '#E9D2B0',
    shadowColor: COLORS.brown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },

  imageBadgeText: {
    fontFamily: FONTS.medium,
    color: COLORS.darkBrown,
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  aboutLabel: {
    fontFamily: FONTS.medium,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.7,
    color: '#F2D29D',
    marginBottom: 5,
  },

  aboutTitle: {
    fontFamily: FONTS.display,
    fontSize: 29,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 5,
  },

  aboutText: {
    fontFamily: FONTS.body,
    fontSize: 11.5,
    lineHeight: 18,
    color: '#FFF3E5',
    marginBottom: 11,
  },

  readMore: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  readMoreText: {
    fontFamily: FONTS.medium,
    color: '#FFD98A',
    fontWeight: '800',
    fontSize: 11.5,
  },

  readMoreArrow: {
    color: '#FFD98A',
    fontSize: 18,
    marginLeft: 7,
  },


  cardEyebrow: {
    fontFamily: FONTS.medium,
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: COLORS.gold,
    marginBottom: 4,
  },


  smallLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
  },

  smallLinkText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.darkBrown,
  },

  smallLinkArrow: {
    fontSize: 20,
    color: COLORS.gold,
    marginLeft: 5,
  },

  guruScroll: {
    paddingRight: 8,
    paddingBottom: 10,
    marginBottom: 23,
  },

  guruCard: {
    width: 244,
    backgroundColor: COLORS.white,
    borderRadius: 25,
    overflow: 'hidden',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#E8D8C4',
    shadowColor: COLORS.brown,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 5,
  },

  guruImage: {
    width: '100%',
    height: 158,
    backgroundColor: COLORS.cream,
  },

  guruImageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    backgroundColor: 'rgba(86, 31, 25, 0.22)',
  },

  guruImageBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,248,237,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },

  guruImageBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.25,
    color: COLORS.darkBrown,
  },

  guruBody: {
    padding: 15,
  },

  guruTitle: {
    fontFamily: FONTS.medium,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.25,
    color: COLORS.gold,
    marginBottom: 3,
  },

  guruName: {
    fontFamily: FONTS.display,
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.brown,
    marginBottom: 6,
  },

  guruVerse: {
    fontFamily: FONTS.body,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.brown,
    marginTop: 6,
  },

  guruTranslation: {
    fontFamily: FONTS.body,
    fontSize: 10,
    lineHeight: 15,
    color: COLORS.muted,
    marginTop: 5,
  },

  guruBio: {
    fontFamily: FONTS.body,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.muted,
    minHeight: 51,
  },

  guruReadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 11,
  },

  guruRead: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.darkBrown,
  },

  guruReadArrow: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.gold,
    marginLeft: 5,
  },

  roomBookingCard: {
    position: 'relative',
    backgroundColor: '#F2DDC4',
    borderRadius: 25,
    padding: 19,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E3C5A0',
    shadowColor: COLORS.brown,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.10,
    shadowRadius: 17,
    elevation: 5,
  },

  roomGlow: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    right: -110,
    top: -90,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },

  roomBookingContent: {
    flex: 1,
    zIndex: 2,
  },

  stayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 7,
  },

  stayBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#9B6338',
  },

  roomBookingTitle: {
    fontFamily: FONTS.display,
    fontSize: 23,
    fontWeight: '700',
    color: COLORS.brown,
    marginBottom: 5,
  },

  roomBookingText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.muted,
    marginBottom: 12,
    maxWidth: 250,
  },

  roomBookingButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.darkBrown,
    borderRadius: 20,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.darkBrown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 7,
    elevation: 4,
  },

  roomBookingButtonText: {
    fontFamily: FONTS.medium,
    color: COLORS.white,
    fontSize: 10.5,
    fontWeight: '800',
  },

  roomBookingButtonArrow: {
    color: '#FFD98A',
    fontSize: 15,
    marginLeft: 7,
    fontWeight: '800',
  },

  roomIconOrb: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
  },

  roomBookingIcon: {
    fontSize: 42,
  },

  skeletonWrap: {
    marginBottom: 20,
  },

  eventSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 14,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: '#F0E5D8',
  },

  skeletonDate: {
    width: 60,
    height: 62,
    borderRadius: 16,
    backgroundColor: '#F1E5D6',
    marginRight: 13,
  },

  skeletonTextWrap: {
    flex: 1,
  },

  skeletonLineShort: {
    width: '30%',
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F1E5D6',
    marginBottom: 8,
  },

  skeletonLineLong: {
    width: '82%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F1E5D6',
    marginBottom: 8,
  },

  skeletonLineMedium: {
    width: '62%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1E5D6',
  },

  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 21,
    padding: 13,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: '#EADFD2',
    shadowColor: COLORS.brown,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.075,
    shadowRadius: 13,
    elevation: 3,
  },

  dateBox: {
    width: 61,
    height: 64,
    borderRadius: 17,
    backgroundColor: COLORS.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
    borderWidth: 1,
    borderColor: '#E6CAA2',
  },

  dateMonth: {
    fontFamily: FONTS.medium,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.gold,
  },

  dateDay: {
    fontFamily: FONTS.display,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '700',
    color: COLORS.darkBrown,
  },

  eventContent: {
    flex: 1,
    paddingRight: 7,
  },

  eventTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },

  eventTagDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
    marginRight: 5,
  },

  eventTag: {
    fontFamily: FONTS.medium,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.gold,
  },

  eventTitle: {
    fontFamily: FONTS.display,
    fontSize: 16.5,
    fontWeight: '700',
    color: COLORS.brown,
    marginBottom: 3,
  },

  eventDescription: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 16,
  },

  eventArrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF8ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ECDCC8',
  },

  arrowSmall: {
    fontSize: 22,
    lineHeight: 23,
    color: COLORS.darkBrown,
    fontWeight: '500',
  },

  emptyEventCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 21,
    padding: 26,
    marginBottom: 23,
    borderWidth: 1,
    borderColor: COLORS.line,
  },

  emptyEventIcon: {
    fontSize: 28,
    marginBottom: 7,
  },

  emptyEventTitle: {
    fontFamily: FONTS.display,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.brown,
  },

  emptyEventText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
  },

  devotionalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8EA',
    borderRadius: 25,
    padding: 16,
    marginBottom: 27,
    borderWidth: 1,
    borderColor: '#E7CFAB',
    shadowColor: '#8A5A2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },

  devotionalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#E3C18E',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.17,
    shadowRadius: 8,
    elevation: 3,
    transform: [{ rotate: '2deg' }],
  },

  devotionalIcon: {
    fontSize: 28,
  },

  devotionalContent: {
    flex: 1,
  },

  devotionalTag: {
    fontFamily: FONTS.medium,
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: COLORS.gold,
    marginBottom: 4,
  },

  devotionalTitle: {
    fontFamily: FONTS.display,
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.brown,
    marginBottom: 4,
  },

  devotionalText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#6E5542',
  },

  devotionalArrowCircle: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8D5B7',
  },
  aboutUsCard: {
    position: 'relative',
    minHeight: 515,
    borderRadius: 26,
    overflow: 'hidden',
    marginBottom: 30,

    backgroundColor: '#8A5A38',

    borderWidth: 1,
    borderColor: '#D8B982',

    shadowColor: '#4A2417',
    shadowOffset: { width: 0, height: 11 },
    shadowOpacity: 0.20,
    shadowRadius: 20,
    elevation: 7,
  },

  aboutUsFullImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    width: '100%',
    height: '100%',
  },

  aboutUsFullOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    // Light-brown transparent layer over the COMPLETE image.
    backgroundColor: 'rgba(105, 65, 40, 0.70)',
  },

  aboutUsContent: {
    position: 'relative',
    zIndex: 2,

    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 25,
  },

  aboutUsImageCaptionSmall: {
    fontFamily: FONTS.medium,
    color: '#F4D99A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  aboutUsImageCaptionTitle: {
    fontFamily: FONTS.display,
    color: COLORS.white,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: 0.2,

    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },

  aboutUsDivider: {
    width: 55,
    height: 3,
    borderRadius: 10,
    backgroundColor: '#E7C477',
    marginTop: 13,
    marginBottom: 18,
  },

  aboutUsText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 22.5,
    fontWeight: '500',
    color: '#FFF8EC',
    marginBottom: 15,
    letterSpacing: 0.1,

    textShadowColor: 'rgba(0,0,0,0.20)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  aboutUsReadMore: {
    alignSelf: 'flex-start',

    flexDirection: 'row',
    alignItems: 'center',

    marginTop: 4,

    paddingHorizontal: 17,
    paddingVertical: 10,

    borderRadius: 24,

    backgroundColor: '#7A1F27',

    borderWidth: 1,
    borderColor: '#E7C477',

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 4,
  },

  aboutUsReadMoreText: {
    fontFamily: FONTS.medium,
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
  },

  aboutUsReadMoreArrow: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F4D38A',
    marginLeft: 8,
  },

  serviceCard: {
    backgroundColor: '#FFFEFC',
    borderRadius: 25,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E8D8C4',
    shadowColor: '#75462F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.075,
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },

  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F1E9DF',
  },

  lastServiceRow: {
    borderBottomWidth: 0,
  },

  serviceIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: '#FBF0DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
    borderWidth: 1,
    borderColor: '#E6CDA8',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 2,
  },

  serviceIcon: {
    fontSize: 20,
  },

  serviceTextWrap: {
    flex: 1,
  },

  serviceTitle: {
    fontFamily: FONTS.medium,
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.brown,
  },

  serviceSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 9.5,
    color: COLORS.muted,
    marginTop: 2,
  },

  serviceArrowCircle: {
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: '#FFF8EC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EBD9BD',
  },

  footerBlessing: {
    alignItems: 'center',
    marginTop: 38,
    marginBottom: 10,
  },

  footerLine: {
    width: 78,
    height: 1,
    backgroundColor: '#E3CCAE',
    marginVertical: 8,
  },

  footerOm: {
    fontFamily: FONTS.display,
    fontSize: 32,
    color: COLORS.gold,
    marginBottom: 2,
  },

  footerText: {
    fontFamily: FONTS.medium,
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: COLORS.muted,
  },

  footerSubtext: {
    fontFamily: FONTS.display,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.darkBrown,
    marginTop: 7,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#C64732',
    borderWidth: 1.5,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationBadgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
  },
});
