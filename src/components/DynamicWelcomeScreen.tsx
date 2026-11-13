
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
// CONFIGURATION
// ========================================

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
  const [settings, setSettings] =
    useState<WelcomeSettings | null>(null);

  const [loading, setLoading] = useState(true);

  // Keep the latest callback without restarting
  // the welcome API request on parent re-renders.
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    let active = true;
    let finished = false;

    let apiTimer: ReturnType<typeof setTimeout> | null = null;
    let displayTimer: ReturnType<typeof setTimeout> | null = null;

    // ========================================
    // FINISH WELCOME SCREEN SAFELY
    // ========================================

    const finishWelcome = () => {
      if (!active || finished) {
        return;
      }

      finished = true;
      onFinishRef.current();
    };

    // ========================================
    // CLEAR API TIMEOUT
    // ========================================

    const clearApiTimer = () => {
      if (apiTimer !== null) {
        clearTimeout(apiTimer);
        apiTimer = null;
      }
    };

    // ========================================
    // LOAD WELCOME SETTINGS
    // ========================================

    const loadWelcomeScreen = async () => {
      try {
        const timeoutPromise = new Promise<never>(
          (_, reject) => {
            apiTimer = setTimeout(() => {
              reject(
                new Error('Welcome API timeout')
              );
            }, API_TIMEOUT_MS);
          }
        );

        const response = (await Promise.race([
          apiRequest('/welcome-screen'),
          timeoutPromise,
        ])) as {
          success: boolean;
          data: WelcomeSettings | null;
        };

        if (!active || finished) {
          return;
        }

        clearApiTimer();

        // ========================================
        // WELCOME SCREEN DISABLED OR UNAVAILABLE
        // ========================================

        if (
          !response?.success ||
          !response.data?.is_enabled ||
          !response.data.image_url
        ) {
          finishWelcome();
          return;
        }

        const welcome = response.data;

        // ========================================
        // DISPLAY WELCOME SCREEN
        // ========================================

        setSettings(welcome);
        setLoading(false);

        const requestedDuration =
          Number(welcome.display_duration);

        const durationSeconds = Number.isFinite(
          requestedDuration
        ) && requestedDuration > 0
          ? requestedDuration
          : DEFAULT_DISPLAY_SECONDS;

        const safeDuration = Math.max(
          MIN_DISPLAY_SECONDS,
          Math.min(
            MAX_DISPLAY_SECONDS,
            durationSeconds
          )
        );

        displayTimer = setTimeout(() => {
          finishWelcome();
        }, safeDuration * 1000);

      } catch (error) {
        if (!active || finished) {
          return;
        }

        console.log(
          'Welcome screen unavailable:',
          error
        );

        // Continue into the app if the API fails.
        finishWelcome();

      } finally {
        clearApiTimer();
      }
    };

    void loadWelcomeScreen();

    // ========================================
    // CLEANUP
    // ========================================

    return () => {
      active = false;

      clearApiTimer();

      if (displayTimer !== null) {
        clearTimeout(displayTimer);
        displayTimer = null;
      }
    };
  }, []);

  // ========================================
  // UI
  // ========================================

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="#FFFDF8"
        barStyle="dark-content"
      />

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#6B1720"
        />
      ) : (
        <>
          {settings?.image_url ? (
            <Image
              source={{
                uri: settings.image_url,
              }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : null}

          {Boolean(settings?.title) && (
            <Text style={styles.title}>
              {settings?.title}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 30,
  },

  image: {
    width: '100%',
    height: '75%',
  },

  title: {
    color: '#6B1720',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 32,
  },
});
