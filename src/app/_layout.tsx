import {
  Stack,
  router,
  useSegments,
  useRootNavigationState,
} from 'expo-router';

import '@/localization/i18n';

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

import {
  getToken,
  removeToken,
} from '@/services/authStorage';

import {
  apiRequest,
} from '@/services/api';

import {
  registerForPushNotificationsAsync,
  initializeNotificationHandler,
  initializeNotificationListener,
  handleInitialNotification,
} from '@/services/notifications';

SplashScreen.preventAutoHideAsync();

// ========================================
// ROOT LAYOUT
// ========================================

export default function RootLayout() {
  const segments = useSegments();

  const rootNavigationState =
    useRootNavigationState();

  const [authChecking, setAuthChecking] =
    useState(true);

  const [languageChecking, setLanguageChecking] =
    useState(true);

  const [authenticated, setAuthenticated] =
    useState(false);

  const notificationRegistrationStarted =
    useRef(false);

  const initialNotificationHandled =
    useRef(false);

  // ========================================
  // LANGUAGE INITIALIZATION
  // ========================================

  useEffect(() => {
    let mounted = true;

    const initializeLanguage = async () => {
      try {
        await loadSavedLanguage();

        console.log(
          'App language initialized successfully.'
        );
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

    initializeLanguage();

    return () => {
      mounted = false;
    };
  }, []);

  // ========================================
  // AUTHENTICATION CHECK
  // ========================================

  useEffect(() => {
    if (!rootNavigationState?.key) {
      return;
    }

    let cancelled = false;

    const checkAuthentication = async () => {
      try {
        const token = await getToken();

        if (cancelled) {
          return;
        }

        const firstSegment = segments[0];

        const isAuthScreen =
          firstSegment === 'login' ||
          firstSegment === 'register' ||
          firstSegment === 'forgot-password';

        if (!token) {
          setAuthenticated(false);

          if (!isAuthScreen) {
            router.replace('/login');
          }

          return;
        }

        try {
          const response =
            await apiRequest('/auth/me');

          if (cancelled) {
            return;
          }

          if (!response.success) {
            throw new Error(
              'Invalid session'
            );
          }

          setAuthenticated(true);

          if (isAuthScreen) {
            router.replace('/(tabs)');
          }
        } catch (error) {
          if (cancelled) {
            return;
          }

          console.log(
            'Session validation failed:',
            error
          );

          // Existing authentication behavior is
          // preserved for now. We will separately
          // improve network-error handling.
          await removeToken();

          setAuthenticated(false);

          notificationRegistrationStarted.current =
            false;

          router.replace('/login');
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          'Authentication check failed:',
          error
        );

        setAuthenticated(false);

        router.replace('/login');
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    };

    checkAuthentication();

    return () => {
      cancelled = true;
    };
  }, [rootNavigationState?.key]);

  // ========================================
  // INITIALIZE NOTIFICATION HANDLER
  // AND RESPONSE LISTENER
  // ========================================

  useEffect(() => {
    const isExpoGo =
      Constants.executionEnvironment ===
      'storeClient';

    if (isExpoGo) {
      console.log(
        'Expo Go detected. Remote push notifications disabled.'
      );

      return;
    }

    let cancelled = false;

    let cleanup:
      (() => void) | undefined;

    const initializeNotifications =
      async () => {
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

    initializeNotifications();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  // ========================================
  // REGISTER DEVICE FOR RETURNING USERS
  // ========================================

  useEffect(() => {
    if (
      !authenticated ||
      authChecking ||
      languageChecking
    ) {
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
        } else {
          console.warn(
            'Push token registration unavailable.'
          );
        }
      } catch (error) {
        console.error(
          'Push registration error:',
          error
        );
      }
    };

    registerDevice();
  }, [
    authenticated,
    authChecking,
    languageChecking,
  ]);

  // ========================================
  // HANDLE INITIAL NOTIFICATION
  // AFTER AUTHENTICATION
  // ========================================

  useEffect(() => {
    if (
      !authenticated ||
      authChecking ||
      languageChecking ||
      !rootNavigationState?.key
    ) {
      return;
    }

    if (initialNotificationHandled.current) {
      return;
    }

    initialNotificationHandled.current = true;

    const processInitialNotification =
      async () => {
        try {
          await handleInitialNotification();
        } catch (error) {
          console.error(
            'Initial notification error:',
            error
          );
        }
      };

    processInitialNotification();
  }, [
    authenticated,
    authChecking,
    languageChecking,
    rootNavigationState?.key,
  ]);

  // ========================================
  // LOADING
  // ========================================

  if (authChecking || languageChecking) {
    return <AnimatedSplashOverlay />;
  }

  // ========================================
  // APPLICATION
  // ========================================

  return (
    <>
      <AnimatedSplashOverlay />

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* AUTHENTICATION */}

        <Stack.Screen name="login" />

        <Stack.Screen name="register" />

        <Stack.Screen name="forgot-password" />

        {/* MAIN APPLICATION */}

        <Stack.Screen name="(tabs)" />

        {/* DEITIES */}

        <Stack.Screen name="deity/[id]" />

        {/* POOJA / SEVA */}

        <Stack.Screen name="pooja-details" />

        <Stack.Screen name="pooja-date" />

        <Stack.Screen name="pooja-devotee" />

        <Stack.Screen name="pooja-payment" />

        <Stack.Screen name="pooja-confirmation" />

        {/* DARSHAN */}

        <Stack.Screen name="darshan" />

        <Stack.Screen name="darshan-videos" />

        {/* GURU VANI */}

        <Stack.Screen
          name="guru-vani/index"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="guru-vani/[id]"
          options={{
            headerShown: false,
          }}
        />

        {/* EVENTS */}

        <Stack.Screen name="events" />

        <Stack.Screen
          name="events/[id]"
          options={{
            headerShown: false,
          }}
        />

        {/* ANNOUNCEMENTS */}

        <Stack.Screen name="announcements" />

        {/* BOOKINGS */}

        <Stack.Screen name="bookings" />

        <Stack.Screen name="donations" />

        {/* TEMPLE INFORMATION */}

        <Stack.Screen name="about" />

        <Stack.Screen name="publications" />

        <Stack.Screen name="gallery" />

        {/* ROOMS */}

        <Stack.Screen name="rooms" />

        {/* ACCOUNT */}

        <Stack.Screen name="profile" />

        <Stack.Screen name="account" />

        <Stack.Screen name="my-bookings" />

        {/* OTHER */}

        <Stack.Screen name="nearby" />

        <Stack.Screen name="contact" />

        <Stack.Screen name="policies" />

        {/* LANGUAGE SETTINGS */}

        <Stack.Screen name="language-settings" />
      </Stack>
    </>
  );
}