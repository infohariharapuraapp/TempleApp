
import {
  Stack,
  router,
  useSegments,
  useRootNavigationState,
} from 'expo-router';

import '@/localization/i18n';

import {
  View,
  StyleSheet,
} from 'react-native';

import {
  loadSavedLanguage,
} from '@/localization/i18n';

import * as SplashScreen from 'expo-splash-screen';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import Constants from 'expo-constants';

import {
  AnimatedSplashOverlay,
} from '@/components/animated-icon';

import DynamicWelcomeScreen from '@/components/DynamicWelcomeScreen';

import {
  getToken,
  removeToken,
} from '@/services/authStorage';

import {
  apiRequest,
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

void SplashScreen.preventAutoHideAsync().catch(() => {});

type AuthStatus = 'checking' | 'authenticated' | 'guest';

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

  const notificationRegistrationStarted =
    useRef(false);

  const initialNotificationHandled =
    useRef(false);

  const authStatusRef = useRef<AuthStatus>('checking');

  const setSessionStatus = (status: AuthStatus) => {
    authStatusRef.current = status;
    setAuthStatus(status);
  };

  const authenticated = authStatus === 'authenticated';

  const appReady =
    authStatus !== 'checking' &&
    !languageChecking;

  // ========================================
  // LANGUAGE INITIALIZATION
  // ========================================

  useEffect(() => {
    let mounted = true;

    const initializeLanguage = async () => {
      try {
        await loadSavedLanguage();

        console.log('App language initialized.');
      } catch (error) {
        console.error(
          'Language initialization failed:',
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
        isAuthenticated ? 'authenticated' : 'guest'
      );

      if (!isAuthenticated) {
        notificationRegistrationStarted.current = false;
        initialNotificationHandled.current = false;
      }

      setAuthVersion((version) => version + 1);
    });
  }, []);

  // ========================================
  // VALIDATE SAVED SESSION
  // ========================================

  useEffect(() => {
    let cancelled = false;

    const validateSession = async () => {
      try {
        const token = await getToken();

        if (cancelled) return;

        if (!token) {
          setSessionStatus('guest');
          return;
        }

        const response = await apiRequest('/auth/me', {
          method: 'GET',
          token,
        });

        if (cancelled) return;

        if (response.success && response.data) {
          setSessionStatus('authenticated');
          return;
        }

        // An explicit unsuccessful authentication response
        // means the saved session is not accepted.
        await removeToken();

        if (cancelled) return;

        setSessionStatus('guest');
      } catch (error) {
        if (cancelled) return;

        console.error(
          'Session validation error:',
          error
        );

        // Preserve the token on an uncertain network error.
        // The app remains locked until validation succeeds.
        setSessionStatus('checking');
      }
    };

    void validateSession();

    return () => {
      cancelled = true;
    };
  }, [authVersion]);

  // ========================================
  // INITIALIZE NOTIFICATION HANDLER
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
  // LOADING SCREEN
  // ========================================

  if (!appReady) {
    return <AnimatedSplashOverlay />;
  }

  // ========================================
  // APPLICATION
  // ========================================

  return (
    <View style={styles.root}>
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

        <Stack.Screen name="pooja-details" />
        <Stack.Screen name="pooja-date" />
        <Stack.Screen name="pooja-devotee" />
        <Stack.Screen name="pooja-payment" />
        <Stack.Screen name="pooja-confirmation" />

        <Stack.Screen name="darshan" />
        <Stack.Screen name="darshan-videos" />

        <Stack.Screen name="guru-vani/index" />
        <Stack.Screen name="guru-vani/[id]" />

        <Stack.Screen name="events" />
        <Stack.Screen name="events/[id]" />

        <Stack.Screen name="announcements" />

        <Stack.Screen name="bookings" />
        <Stack.Screen name="donations" />

        <Stack.Screen name="about" />
        <Stack.Screen name="publications" />
        <Stack.Screen name="gallery" />
        <Stack.Screen name="rooms" />

        <Stack.Screen name="profile" />
        <Stack.Screen name="account" />
        <Stack.Screen name="my-bookings" />

        <Stack.Screen name="nearby" />
        <Stack.Screen name="contact" />
        <Stack.Screen name="policies" />
        <Stack.Screen name="language-settings" />
      </Stack>

      {!welcomeFinished && (
        <View style={styles.welcomeOverlay}>
          <DynamicWelcomeScreen
            onFinish={() => setWelcomeFinished(true)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

 welcomeOverlay: {
  ...StyleSheet.absoluteFill,
  zIndex: 9999,
  elevation: 9999,
  backgroundColor: '#FFFDF8',
},
});
