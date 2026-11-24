
import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { apiRequest } from '@/services/api';
import { useTranslation } from 'react-i18next';

// ========================================
// TYPES
// ========================================

type WelcomeSettings = {
  title: string;
  image_url: string;
  is_enabled: boolean;
  display_duration: number;
};

type Props = {
  onFinish: () => void;
};

// ========================================
// PREMIUM THEME
// ========================================

const C = {
  maroon: '#641923',
  deepMaroon: '#451019',
  gold: '#C6A15B',
  lightGold: '#E7D5A9',
  ivory: '#FFFDF7',
  warmIvory: '#F8F3E9',
  text: '#451019',
  muted: '#8B765E',
  white: '#FFFFFF',
};

const API_TIMEOUT_MS = 5000;
const MIN_DISPLAY_SECONDS = 2;
const MAX_DISPLAY_SECONDS = 10;
const DEFAULT_DISPLAY_SECONDS = 3;

// ========================================
// DYNAMIC WELCOME SCREEN
// ========================================

export default function DynamicWelcomeScreen({
  onFinish,
}: Props) {
  const { i18n } = useTranslation();

  const language = (
    i18n.resolvedLanguage ||
    i18n.language ||
    'en'
  ).split('-')[0].toLowerCase();

  const [settings, setSettings] =
    useState<WelcomeSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);

  const [displayDurationMs, setDisplayDurationMs] =
    useState(DEFAULT_DISPLAY_SECONDS * 1000);

  const displayTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const welcomeFinishedRef = useRef(false);
  const mountedRef = useRef(true);

  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // ========================================
  // LOAD WELCOME SETTINGS
  // ========================================

  useEffect(() => {
    let active = true;
    let finished = false;
    mountedRef.current = true;

    setLoading(true);
    setSettings(null);

    let apiTimer: ReturnType<typeof setTimeout> | null = null;

    const finishWelcome = () => {
      if (!active || finished) {
        return;
      }

      finished = true;
      welcomeFinishedRef.current = true;

      if (displayTimerRef.current !== null) {
        clearTimeout(displayTimerRef.current);
        displayTimerRef.current = null;
      }

      onFinishRef.current();
    };

    const clearApiTimer = () => {
      if (apiTimer !== null) {
        clearTimeout(apiTimer);
        apiTimer = null;
      }
    };

    const loadWelcomeScreen = async () => {
      try {
        const timeoutPromise = new Promise<never>(
          (_, reject) => {
            apiTimer = setTimeout(() => {
              reject(new Error('Welcome API timeout'));
            }, API_TIMEOUT_MS);
          }
        );

        const response = (await Promise.race([
          apiRequest(
            '/welcome-screen?lang=' +
            encodeURIComponent(language),
            {
              timeoutMs: API_TIMEOUT_MS,
            }
          ),
          timeoutPromise,
        ])) as {
          success: boolean;
          data: WelcomeSettings | null;
        };

        if (!active || finished) {
          return;
        }

        clearApiTimer();

        if (
          !response?.success ||
          !response.data?.is_enabled ||
          !response.data.image_url
        ) {
          finishWelcome();
          return;
        }

        const welcome = response.data;

        setSettings(welcome);
        setImageLoading(true);
        setLoading(false);

        const requestedDuration =
          Number(welcome.display_duration);

        const durationSeconds =
          Number.isFinite(requestedDuration) &&
          requestedDuration > 0
            ? requestedDuration
            : DEFAULT_DISPLAY_SECONDS;

        const safeDuration = Math.max(
          MIN_DISPLAY_SECONDS,
          Math.min(MAX_DISPLAY_SECONDS, durationSeconds)
        );

        setDisplayDurationMs(safeDuration * 1000);

      } catch (error) {
        if (!active || finished) {
          return;
        }

        console.log(
          'Welcome screen unavailable:',
          error
        );

        finishWelcome();

      } finally {
        clearApiTimer();
      }
    };

    void loadWelcomeScreen();

    return () => {
      active = false;
      mountedRef.current = false;

      clearApiTimer();

      if (displayTimerRef.current !== null) {
        clearTimeout(displayTimerRef.current);
        displayTimerRef.current = null;
      }
    };
  }, [language]);

  // ========================================
  // IMAGE LOADED
  // ========================================

  const handleImageLoaded = () => {
    if (!mountedRef.current) return;
    setImageLoading(false);

    if (welcomeFinishedRef.current) {
      return;
    }

    if (displayTimerRef.current !== null) {
      clearTimeout(displayTimerRef.current);
    }

    displayTimerRef.current = setTimeout(() => {
      if (welcomeFinishedRef.current) {
        return;
      }

      welcomeFinishedRef.current = true;
      onFinishRef.current();
    }, displayDurationMs);
  };

  // ========================================
  // IMAGE ERROR
  // ========================================

  const handleImageError = (error: any) => {
    if (!mountedRef.current) return;
    console.warn(
      'Welcome image failed to load:',
      error.nativeEvent.error
    );

    setImageLoading(false);

    if (welcomeFinishedRef.current) {
      return;
    }

    welcomeFinishedRef.current = true;
    onFinishRef.current();
  };

  // ========================================
  // PREMIUM LOADING SCREEN
  // ========================================

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar
          backgroundColor={C.deepMaroon}
          barStyle="light-content"
        />

        <View style={styles.topAccent} />

        <View style={styles.loadingCard}>
          <View style={styles.goldCircle}>
            <ActivityIndicator
              size="large"
              color={C.maroon}
            />
          </View>

          <View style={styles.goldDivider} />

          <Text style={styles.loadingTitle}>
            Divyakshetra Hariharapura
          </Text>

          <Text style={styles.loadingSubtitle}>
            Preparing your welcome experience
          </Text>
        </View>

        <View style={styles.bottomAccent} />
      </View>
    );
  }

  // ========================================
  // PREMIUM WELCOME UI
  // ========================================

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor={C.deepMaroon}
        barStyle="light-content"
      />

      {/* Decorative top accent */}

      <View style={styles.topAccent} />

      {/* Background decoration */}

      <View style={styles.backgroundDecoration} />

      {/* Main content */}

      <View style={styles.content}>

        {/* Welcome image frame */}

        {Boolean(settings?.image_url) && (
          <View style={styles.imageOuterFrame}>

            <View style={styles.imageInnerFrame}>
              <Image
                source={{
                  uri: settings!.image_url,
                }}
                style={styles.image}
                resizeMode="contain"
                onLoad={handleImageLoaded}
                onError={handleImageError}
              />

              {/* Image loading overlay */}

              {imageLoading && (
                <View style={styles.imageLoadingOverlay}>
                  <ActivityIndicator
                    size="large"
                    color={C.maroon}
                  />

                  <Text style={styles.loadingText}>
                    Loading welcome screen...
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Admin-managed welcome title */}

        {Boolean(settings?.title) && (
          <View style={styles.titleContainer}>

            <Text style={styles.title}>
              {settings?.title}
            </Text>
          </View>
        )}

      </View>

      {/* Bottom accent */}

      <View style={styles.bottomAccent} />
    </View>
  );
}

// ========================================
// PREMIUM STYLES
// ========================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: C.warmIvory,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // --------------------------------------
  // Decorative accents
  // --------------------------------------

  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 7,
    backgroundColor: C.maroon,
    borderBottomWidth: 2,
    borderBottomColor: C.gold,
  },

  bottomAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 7,
    backgroundColor: C.maroon,
    borderTopWidth: 2,
    borderTopColor: C.gold,
  },

  backgroundDecoration: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 1,
    borderColor: 'rgba(198,161,91,0.13)',
    top: '50%',
    left: '50%',
    marginLeft: -145,
    marginTop: -145,
  },

  // --------------------------------------
  // Main layout
  // --------------------------------------

  content: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 19,
    paddingVertical: 14,
  },

  // --------------------------------------
  // Header ornament
  // --------------------------------------

  headerDecoration: {
    width: '65%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 12,
  },

  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.gold,
  },

  headerDiamond: {
    width: 10,
    height: 10,
    backgroundColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },

  // --------------------------------------
  // Image frame
  // --------------------------------------

  imageOuterFrame: {
    width: '100%',
    flex: 1,
    minHeight: 0,
    maxWidth: 560,
    padding: 5,
    backgroundColor: C.white,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.gold,
    shadowColor: C.deepMaroon,
    shadowOffset: {
      width: 0,
      height: 9,
    },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },

  imageInnerFrame: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: C.ivory,
    borderWidth: 1,
    borderColor: C.lightGold,
    position: 'relative',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  // --------------------------------------
  // Image loading
  // --------------------------------------

  imageLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.ivory,
    gap: 14,
  },

  loadingText: {
    color: C.maroon,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // --------------------------------------
  // Admin title
  // --------------------------------------

  titleContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },

  title: {
    color: C.maroon,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: 0.3,
  },

  titleDivider: {
    width: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginBottom: 10,
  },

  titleLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.gold,
  },

  titleDiamond: {
    width: 7,
    height: 7,
    backgroundColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },

  // --------------------------------------
  // Footer ornament
  // --------------------------------------

  footerDecoration: {
    width: '40%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 9,
  },

  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.lightGold,
  },

  footerDiamond: {
    width: 7,
    height: 7,
    backgroundColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },

  // --------------------------------------
  // Premium loading screen
  // --------------------------------------

  loadingCard: {
    width: '88%',
    maxWidth: 360,
    paddingVertical: 42,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.ivory,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: C.gold,
    elevation: 6,
  },

  goldCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3EAD7',
    borderWidth: 1.5,
    borderColor: C.gold,
  },

  goldDivider: {
    width: 65,
    height: 2,
    backgroundColor: C.gold,
    marginTop: 25,
    marginBottom: 19,
  },

  loadingTitle: {
    color: C.maroon,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },

  loadingSubtitle: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 9,
  },

});
