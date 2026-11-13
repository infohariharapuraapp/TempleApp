
import {
  Stack,
  router,
  useSegments,
  useRootNavigationState,
} from 'expo-router';

import '@/localization/i18n';

import { StatusBar } from 'expo-status-bar';

import {
  ActivityIndicator,
  StyleSheet,
  View,
  StatusBar as AndroidStatusBar,
  Platform,
} from 'react-native';

import {
  loadSavedLanguage,
} from '@/localization/i18n';

import * as SplashScreen from 'expo-splash-screen';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import Constants from 'expo-constants';

import {
  AnimatedIcon,
} from '@/components/animated-icon';

import DynamicWelcomeScreen from '@/components/DynamicWelcomeScreen';

import {
  getToken,
  removeToken,
} from '@/services/authStorage';

import {
  apiRequest,
  ApiError,
} from '@/services/api';

import {
  subscribeAuth,
} from '@/services/authSession';

import {
  registerForPushNotificationsAsync,
  initializeNotificationHandler,
  initializeNotificationListener,
  handleInitialNotification,
} from '@/services/notifications';

// ========================================
// CONFIGURATION
// ========================================

void SplashScreen.preventAutoHideAsync().catch(() => {});

const LANGUAGE_TIMEOUT_MS = 3000;
const SESSION_TIMEOUT_MS = 8000;

type AuthStatus =
  | 'checking'
  | 'authenticated'
  | 'guest';

// ========================================
// TIMEOUT HELPER
// ========================================

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Startup operation timed out'));
        }, milliseconds);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

// ========================================
// ROOT LAYOUT
// ========================================

export default function RootLayout() {
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  const [authStatus, setAuthStatus] =
    useState<AuthStatus>('checking');

  const [languageChecking, setLanguageChecking] =
    useState(true);

  const [welcomeFinished, setWelcomeFinished] =
    useState(false);

  const [authVersion, setAuthVersion] =
    useState(0);

  const [nativeSplashHidden, setNativeSplashHidden] =
    useState(false);

  const notificationRegistrationStarted =
    useRef(false);

  const initialNotificationHandled =
    useRef(false);

  const nativeSplashHideStarted =
    useRef(false);

  const setSessionStatus = useCallback(
    (status: AuthStatus) => {
      setAuthStatus(status);
    },
    []
  );

  const authenticated =
    authStatus === 'authenticated';

  const appReady =
    authStatus !== 'checking' &&
    !languageChecking;

  // ========================================
  // HIDE NATIVE SPLASH
  // ========================================

  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHideStarted.current) {
      return;
    }

    nativeSplashHideStarted.current = true;

    void SplashScreen.hideAsync()
      .catch((error) => {
        console.error(
          'Native splash hide error:',
          error
        );
      })
      .finally(() => {
        setNativeSplashHidden(true);
      });
  }, []);

  // ========================================
  // INITIALIZE LANGUAGE
  // ========================================

  useEffect(() => {
    let mounted = true;

    const initializeLanguage = async () => {
      try {
        await withTimeout(
          loadSavedLanguage(),
          LANGUAGE_TIMEOUT_MS
        );

        console.log('App language initialized.');
      } catch (error) {
        console.warn(
          'Language initialization unavailable:',
          error
        );
      } finally {
        if (mounted) {
          setLanguageChecking(false);
        }
      }
    };

    void initializeLanguage();

    return () => {
      mounted = false;
    };
  }, []);

  // ========================================
  // AUTHENTICATION SESSION LISTENER
  // ========================================

  useEffect(() => {
    return subscribeAuth((isAuthenticated) => {
      setSessionStatus(
        isAuthenticated
          ? 'authenticated'
          : 'guest'
      );

      if (!isAuthenticated) {
        notificationRegistrationStarted.current = false;
        initialNotificationHandled.current = false;
      }

      setAuthVersion((version) => version + 1);
    });
  }, [setSessionStatus]);

  // ========================================
  // VALIDATE SAVED SESSION
  // ========================================


useEffect(() => {
  let cancelled = false;

  const validateSession = async () => {
    try {
      const token = await withTimeout(
        getToken(),
        SESSION_TIMEOUT_MS
      );

      if (cancelled) return;

      // First-time users or users who logged out.
      if (!token) {
        setSessionStatus('guest');
        return;
      }

      const response = await withTimeout(
        apiRequest('/auth/me', {
          method: 'GET',
          token,
          timeoutMs: SESSION_TIMEOUT_MS,
        }),
        SESSION_TIMEOUT_MS + 1000
      );

      if (cancelled) return;

      if (response.success && response.data) {
        setSessionStatus('authenticated');
        return;
      }

      // Unexpected response: keep the token.
      setSessionStatus('guest');

    } catch (error) {
      if (cancelled) return;

      console.warn(
        'Session validation error:',
        error
      );

      // Confirmed expired or unauthorized token.
      if (
        error instanceof ApiError &&
        (error.status === 401 ||
         error.status === 403)
      ) {
        try {
          await withTimeout(
            removeToken(),
            SESSION_TIMEOUT_MS
          );
        } catch (storageError) {
          console.warn(
            'Unable to remove invalid token:',
            storageError
          );
        }

        if (!cancelled) {
          setSessionStatus('guest');
        }

        return;
      }

      // Network failures and timeouts are uncertain.
      // Preserve the saved token for the next launch.
      setSessionStatus('guest');
    }
  };

  void validateSession();

  return () => {
    cancelled = true;
  };
}, [authVersion, setSessionStatus]);


  // ========================================
  // INITIALIZE NOTIFICATIONS
  // ========================================

  useEffect(() => {
    const isExpoGo =
      Constants.executionEnvironment === 'storeClient';

    if (isExpoGo) {
      console.log(
        'Expo Go: remote push notifications disabled.'
      );
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const initializeNotifications = async () => {
      try {
        await initializeNotificationHandler();

        const cleanupFunction =
          await initializeNotificationListener();

        if (cancelled) {
          cleanupFunction();
          return;
        }

        cleanup = cleanupFunction;

        console.log(
          'Notification listener initialized.'
        );
      } catch (error) {
        console.error(
          'Notification initialization failed:',
          error
        );
      }
    };

    void initializeNotifications();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  // ========================================
  // REGISTER PUSH TOKEN
  // ========================================

  useEffect(() => {
    if (!authenticated || languageChecking) {
      return;
    }

    if (notificationRegistrationStarted.current) {
      return;
    }

    notificationRegistrationStarted.current = true;

    const registerDevice = async () => {
      try {
        const token =
          await registerForPushNotificationsAsync();

        if (token) {
          console.log(
            'Push token registration attempted.'
          );
        }
      } catch (error) {
        console.error(
          'Push registration error:',
          error
        );
      }
    };

    void registerDevice();
  }, [authenticated, languageChecking]);

  // ========================================
  // HANDLE INITIAL NOTIFICATION
  // ========================================

  useEffect(() => {
    if (
      !authenticated ||
      languageChecking ||
      !welcomeFinished ||
      !rootNavigationState?.key
    ) {
      return;
    }

    if (initialNotificationHandled.current) {
      return;
    }

    initialNotificationHandled.current = true;

    const processInitialNotification = async () => {
      try {
        await handleInitialNotification();
      } catch (error) {
        console.error(
          'Initial notification error:',
          error
        );
      }
    };

    void processInitialNotification();
  }, [
    authenticated,
    languageChecking,
    welcomeFinished,
    rootNavigationState?.key,
  ]);

  // ========================================
  // WELCOME SCREEN
  // ========================================

  const finishWelcome = useCallback(() => {
    setWelcomeFinished(true);
  }, []);

  // ========================================
  // AUTHENTICATION NAVIGATION
  // ========================================

  useEffect(() => {
    if (
      !rootNavigationState?.key ||
      !appReady ||
      !welcomeFinished
    ) {
      return;
    }

    const firstSegment = segments[0];

    const isAuthScreen =
      firstSegment === 'login' ||
      firstSegment === 'register' ||
      firstSegment === 'forgot-password';

    if (!authenticated) {
      if (!isAuthScreen) {
        router.replace('/login');
      }
      return;
    }

    if (isAuthScreen) {
      router.replace('/(tabs)');
    }
  }, [
    rootNavigationState?.key,
    appReady,
    welcomeFinished,
    authenticated,
    segments,
  ]);

  // ========================================
  // APPLICATION
  // ========================================

  return (
    <View
      style={styles.root}
      onLayout={hideNativeSplash}
    >
     <StatusBar style="dark" />

{Platform.OS === 'android' && (
  <AndroidStatusBar
    barStyle="dark-content"
    backgroundColor="#FFFDF8"
    translucent={false}
  />
)}

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />

        <Stack.Screen name="(tabs)" />

        <Stack.Screen name="deity/[id]" />



        <Stack.Screen name="darshan" />
        <Stack.Screen name="darshan-videos" />

        <Stack.Screen name="guru-vani/index" />
        <Stack.Screen name="guru-vani/[id]" />

        <Stack.Screen name="events" />
        <Stack.Screen name="events/[id]" />

        <Stack.Screen name="announcements" />


        <Stack.Screen name="donations" />

        <Stack.Screen name="about" />
        <Stack.Screen name="publications" />
        <Stack.Screen name="gallery" />


        <Stack.Screen name="profile" />
        <Stack.Screen name="account" />
        <Stack.Screen name="my-bookings" />

        <Stack.Screen name="nearby" />
        <Stack.Screen name="contact" />
        <Stack.Screen name="policies" />
        <Stack.Screen name="language-settings" />
      </Stack>

      {!appReady || !nativeSplashHidden ? (
        <View style={styles.loadingOverlay}>
          <AnimatedIcon />
          <ActivityIndicator
            size="small"
            color="#6B1720"
            style={styles.loadingIndicator}
          />
        </View>
      ) : !welcomeFinished ? (
        <View style={styles.welcomeOverlay}>
          <DynamicWelcomeScreen
            onFinish={finishWelcome}
          />
        </View>
      ) : null}
    </View>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFDF8',
  },

  loadingOverlay: {
  ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingIndicator: {
    marginTop: 30,
  },

  welcomeOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: '#FFFDF8',
  },
});
