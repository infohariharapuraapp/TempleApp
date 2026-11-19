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
  Text,
  TouchableOpacity,
  StatusBar as AndroidStatusBar,
  Platform,
  AppState,
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

import { useTranslation } from 'react-i18next';

import Constants from 'expo-constants';

import {
  AnimatedIcon,
} from '@/components/animated-icon';

import DynamicWelcomeScreen from '@/components/DynamicWelcomeScreen';

import {
  getToken,
  removeTokenIfMatches,
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
  pausePushRegistration,
  resumePushRegistration,
} from '@/services/notifications';

// ========================================
// CONFIGURATION
// ========================================

void SplashScreen.preventAutoHideAsync()
  .catch(() => {});

const LANGUAGE_TIMEOUT_MS = 3000;
const STORAGE_TIMEOUT_MS = 5000;
const SESSION_TIMEOUT_MS = 15000;

const SPLASH_HIDE_TIMEOUT_MS = 3000;
const WELCOME_TIMEOUT_MS = 12000;

// Avoid repeated session validation whenever
// the application changes state rapidly.

const SESSION_RECHECK_INTERVAL_MS = 60000;

type AuthStatus =
  | 'checking'
  | 'authenticated'
  | 'guest'
  | 'unavailable';

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
          reject(
            new Error('Startup operation timed out')
          );
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
  const { t } = useTranslation();

  const segments = useSegments();

  const rootNavigationState =
    useRootNavigationState();

  // ========================================
  // APPLICATION STATE
  // ========================================

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

  const [retryingSession, setRetryingSession] =
    useState(false);

  // ========================================
  // REFERENCES
  // ========================================

  const notificationRegistrationStarted =
    useRef(false);

  const initialNotificationHandled =
    useRef(false);

  const nativeSplashHideStarted =
    useRef(false);

  const validationGeneration =
    useRef(0);

  const validationInProgress =
    useRef(false);

  const lastValidationAt =
    useRef(0);

  const authStatusRef =
    useRef<AuthStatus>('checking');

  // ========================================
  // AUTH STATUS
  // ========================================

  const setSessionStatus = useCallback(
    (status: AuthStatus) => {
      authStatusRef.current = status;

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

    void withTimeout(
      SplashScreen.hideAsync(),
      SPLASH_HIDE_TIMEOUT_MS
    )
      .catch((error) => {
        console.warn(
          'Native splash hide error:',
          error
        );
      })
      .finally(() => {
        setNativeSplashHidden(true);
      });

  }, []);

  // Backup attempt if the initial layout callback
  // is delayed.

  useEffect(() => {
    const timer = setTimeout(() => {
      hideNativeSplash();
    }, 1500);

    return () => {
      clearTimeout(timer);
    };

  }, [hideNativeSplash]);

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

        console.log(
          'App language initialized.'
        );

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
  // RESET NOTIFICATION SESSION
  // ========================================

  const resetNotificationSession =
    useCallback(() => {
      notificationRegistrationStarted.current = false;
      initialNotificationHandled.current = false;
    }, []);

  // ========================================
  // AUTHENTICATION SESSION LISTENER
  // ========================================

  useEffect(() => {
    return subscribeAuth((isAuthenticated) => {
      // Invalidate older session checks immediately.

      validationGeneration.current += 1;
      validationInProgress.current = false;

      setRetryingSession(false);

      resetNotificationSession();

      lastValidationAt.current = Date.now();

      if (isAuthenticated) {
        setSessionStatus('authenticated');

      } else {
        setSessionStatus('guest');
      }

      // The notifications service also subscribes
      // to auth events and manages pause/resume.
      //
      // Do not start another immediate /auth/me
      // request after a confirmed login or logout.
    });

  }, [
    resetNotificationSession,
    setSessionStatus,
  ]);

  // ========================================
  // VALIDATE SAVED SESSION
  // ========================================

  useEffect(() => {
    let cancelled = false;

    const generation =
      ++validationGeneration.current;

    const isCurrentValidation = () => {
      return (
        !cancelled &&
        generation === validationGeneration.current
      );
    };

    const validateSession = async () => {
      let validatedToken: string | null = null;

      validationInProgress.current = true;

      try {
        // Read the existing SecureStore token.

        validatedToken = await withTimeout(
          getToken(),
          STORAGE_TIMEOUT_MS
        );

        if (!isCurrentValidation()) {
          return;
        }

        // First-time installation or logged-out user.

        if (!validatedToken) {
          pausePushRegistration();

          resetNotificationSession();

          setSessionStatus('guest');

          return;
        }

        // Validate the saved token using the existing
        // production Render API configuration.

        const response = await withTimeout(
          apiRequest('/auth/me', {
            method: 'GET',
            token: validatedToken,
            timeoutMs: SESSION_TIMEOUT_MS,
          }),
          SESSION_TIMEOUT_MS + 1000
        );

        if (!isCurrentValidation()) {
          return;
        }

        // Confirm that the session did not change
        // while the API request was running.

        const currentToken = await withTimeout(
          getToken(),
          STORAGE_TIMEOUT_MS
        );

        if (!isCurrentValidation()) {
          return;
        }

        if (currentToken !== validatedToken) {
          if (!currentToken) {
            pausePushRegistration();

            resetNotificationSession();

            setSessionStatus('guest');

          } else {
            // A different token exists.
            // Validate the new session instead.

            setAuthVersion(
              (version) => version + 1
            );
          }

          return;
        }

        // Session successfully verified.

        if (
          response.success &&
          response.data
        ) {
          if (
            authStatusRef.current !==
            'authenticated'
          ) {
            resumePushRegistration();

            resetNotificationSession();
          }

          lastValidationAt.current = Date.now();

          setSessionStatus('authenticated');

          return;
        }

        // Unexpected server response:
        // retain the saved credentials.

        pausePushRegistration();

        resetNotificationSession();

        setSessionStatus('unavailable');

      } catch (error) {
        if (!isCurrentValidation()) {
          return;
        }

        console.warn(
          'Session validation error:',
          error
        );

        // ========================================
        // CONFIRMED INVALID / EXPIRED SESSION
        // ========================================

        if (
          error instanceof ApiError &&
          error.status === 401 &&
          validatedToken
        ) {
          try {
            const removed = await withTimeout(
              removeTokenIfMatches(
                validatedToken
              ),
              STORAGE_TIMEOUT_MS
            );

            if (!isCurrentValidation()) {
              return;
            }

            if (!removed) {
              const currentToken =
                await withTimeout(
                  getToken(),
                  STORAGE_TIMEOUT_MS
                );

              if (!isCurrentValidation()) {
                return;
              }

              if (currentToken) {
                setAuthVersion(
                  (version) => version + 1
                );

                return;
              }
            }

          } catch (storageError) {
            if (!isCurrentValidation()) {
              return;
            }

            console.warn(
              'Unable to remove invalid token:',
              storageError
            );

            pausePushRegistration();

            resetNotificationSession();

            setSessionStatus('unavailable');

            return;
          }

          if (!isCurrentValidation()) {
            return;
          }

          pausePushRegistration();

          resetNotificationSession();

          setSessionStatus('guest');

          return;
        }

        // ========================================
        // TEMPORARY NETWORK / SERVER FAILURE
        // ========================================

        // Do not delete saved credentials for:
        //
        // - Internet unavailable
        // - API timeout
        // - Render cold start
        // - Neon connection failure
        // - HTTP 403
        // - HTTP 503
        // - Unexpected API responses

        pausePushRegistration();

        resetNotificationSession();

        setSessionStatus('unavailable');

      } finally {
        if (isCurrentValidation()) {
          validationInProgress.current = false;

          setRetryingSession(false);
        }
      }
    };

    void validateSession();

    return () => {
      cancelled = true;

      if (
        generation === validationGeneration.current
      ) {
        validationInProgress.current = false;
      }
    };

  }, [
    authVersion,
    resetNotificationSession,
    setSessionStatus,
  ]);

  // ========================================
  // RETRY SESSION VALIDATION
  // ========================================

  const retrySession = useCallback(() => {
    if (validationInProgress.current) {
      return;
    }

    validationInProgress.current = true;

    setRetryingSession(true);

    setAuthVersion(
      (version) => version + 1
    );

  }, []);

  // ========================================
  // RECOVER SESSION WHEN APP RETURNS
  // TO FOREGROUND
  // ========================================

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState !== 'active') {
          return;
        }

        if (validationInProgress.current) {
          return;
        }

        // Automatically retry connectivity failures
        // when the app returns to the foreground.

        if (
          authStatusRef.current === 'unavailable'
        ) {
          retrySession();

          return;
        }

        // Revalidate older authenticated sessions
        // when the application returns to foreground.

        if (
          authStatusRef.current === 'authenticated' &&
          Date.now() - lastValidationAt.current >=
          SESSION_RECHECK_INTERVAL_MS
        ) {
          retrySession();
        }
      }
    );

    return () => {
      subscription.remove();
    };

  }, [retrySession]);

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

    let cleanup:
      | (() => void)
      | undefined;

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
        console.warn(
          'Notification initialization failed:',
          error
        );
      }
    };

    // Notification initialization is independent
    // from app startup and must not block it.

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
    if (
      !authenticated ||
      languageChecking
    ) {
      return;
    }

    if (
      notificationRegistrationStarted.current
    ) {
      return;
    }

    notificationRegistrationStarted.current = true;

    let cancelled = false;

    const registerDevice = async () => {
      try {
        const token =
          await registerForPushNotificationsAsync();

        if (
          !cancelled &&
          token
        ) {
          console.log(
            'Push token registration completed.'
          );
        }

      } catch (error) {
        console.warn(
          'Push registration error:',
          error
        );
      }
    };

    // Push registration must not block navigation.

    void registerDevice();

    return () => {
      cancelled = true;
    };

  }, [
    authenticated,
    languageChecking,
  ]);

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

    if (
      initialNotificationHandled.current
    ) {
      return;
    }

    initialNotificationHandled.current = true;

    const processInitialNotification = async () => {
      try {
        await handleInitialNotification();

      } catch (error) {
        console.warn(
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

  // Fail-safe: if the dynamic welcome screen
  // cannot load or never completes, continue
  // after a bounded waiting period.

  useEffect(() => {
    if (
      !appReady ||
      !nativeSplashHidden ||
      welcomeFinished ||
      authStatus === 'unavailable'
    ) {
      return;
    }

    const timer = setTimeout(() => {
      console.warn(
        'Welcome screen timeout. Continuing startup.'
      );

      finishWelcome();

    }, WELCOME_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
    };

  }, [
    appReady,
    nativeSplashHidden,
    welcomeFinished,
    authStatus,
    finishWelcome,
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

    // A temporary server failure is not a logout.
    // Show the retry screen without deleting the
    // session or forcing a new login.

    if (authStatus === 'unavailable') {
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
    authStatus,
    authenticated,
    segments,
  ]);

  // ========================================
  // APPLICATION ROOT
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

      {/* ========================================
          STARTUP LOADING OVERLAY
          ======================================== */}

      {!appReady || !nativeSplashHidden ? (
        <View style={styles.loadingOverlay}>
          <AnimatedIcon />

          <ActivityIndicator
            size="small"
            color="#6B1720"
            style={styles.loadingIndicator}
          />
        </View>

      ) : authStatus === 'unavailable' ? (

        /* ========================================
           CONNECTION RECOVERY OVERLAY
           ======================================== */

        <View style={styles.connectionOverlay}>
          <AnimatedIcon />

          <Text style={styles.connectionTitle}>
            {t('startup.connection_unavailable', {
              defaultValue: 'Connection Unavailable',
            })}
          </Text>

          <Text style={styles.connectionMessage}>
            {t('startup.connection_message', {
              defaultValue:
                'We are unable to connect to the temple services at the moment. Please check your internet connection and try again.',
            })}
          </Text>

          <TouchableOpacity
            style={[
              styles.retryButton,

              retryingSession &&
              styles.disabledButton,
            ]}
            onPress={retrySession}
            disabled={retryingSession}
            activeOpacity={0.8}
          >
            {retryingSession ? (
              <ActivityIndicator
                color="#FFFFFF"
                size="small"
              />

            ) : (
              <Text style={styles.retryButtonText}>
                {t('startup.try_again', {
                  defaultValue: 'Try Again',
                })}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.sessionNotice}>
            {t('startup.session_preserved', {
              defaultValue:
                'Your saved login is not deleted because of connection issues.',
            })}
          </Text>
        </View>

      ) : !welcomeFinished ? (

        /* ========================================
           DYNAMIC WELCOME SCREEN
           ======================================== */

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

  connectionOverlay: {
    ...StyleSheet.absoluteFill,

    zIndex: 9999,
    elevation: 9999,

    backgroundColor: '#FFFDF8',

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 30,
    paddingVertical: 40,
  },

  connectionTitle: {
    fontSize: 23,

    fontWeight: '700',

    color: '#6B1720',

    textAlign: 'center',

    marginTop: 28,
    marginBottom: 12,
  },

  connectionMessage: {
    fontSize: 14,

    lineHeight: 23,

    color: '#786659',

    textAlign: 'center',

    maxWidth: 350,
  },

  retryButton: {
    minHeight: 50,
    minWidth: 190,

    borderRadius: 14,

    backgroundColor: '#6B1720',

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 25,

    marginTop: 26,

    borderWidth: 1,
    borderColor: '#C69A3A',
  },

  retryButtonText: {
    color: '#FFFFFF',

    fontSize: 15,
    fontWeight: '700',
  },

  disabledButton: {
    opacity: 0.6,
  },

  sessionNotice: {
    fontSize: 12,

    lineHeight: 19,

    color: '#8E8175',

    textAlign: 'center',

    maxWidth: 300,

    marginTop: 18,
  },
});