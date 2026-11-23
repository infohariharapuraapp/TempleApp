import * as Device from 'expo-device';
import i18n from '@/localization/i18n';
import Constants from 'expo-constants';

import { Platform } from 'react-native';
import { router } from 'expo-router';
import { openVolunteerSevaNotification } from './volunteerNotificationNavigation';

import { subscribeAuth } from './authSession';
import { getToken } from './authStorage';

// ========================================
// EXPO GO DETECTION
// ========================================

const IS_EXPO_GO =
  Constants.executionEnvironment === 'storeClient';

// ========================================
// PRODUCTION BACKEND URL
// ========================================

const API_BASE_URL =
  'https://hariharapura-temple-api.onrender.com/api';

// ========================================
// TIMEOUT CONFIGURATION
// ========================================

const AUTH_TOKEN_TIMEOUT_MS = 5000;

const EXPO_TOKEN_TIMEOUT_MS = 10000;

const NOTIFICATION_SETUP_TIMEOUT_MS = 10000;

const PERMISSION_TIMEOUT_MS = 30000;

const PUSH_REGISTRATION_TIMEOUT_MS = 30000;

const PUSH_UNREGISTRATION_TIMEOUT_MS = 15000;

const REGISTRATION_WAIT_TIMEOUT_MS = 8000;

const LOGOUT_DEVICE_TIMEOUT_MS = 40000;

// ========================================
// GENERIC ASYNCHRONOUS TIMEOUT
// ========================================

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {

  let timeoutId:
    ReturnType<typeof setTimeout> | undefined;

  try {

    return await Promise.race([

      operation,

      new Promise<T>((_, reject) => {

        timeoutId = setTimeout(() => {

          reject(
            new Error(
              `${operationName} timed out after ${timeoutMs}ms`
            )
          );

        }, timeoutMs);
      }),
    ]);

  } finally {

    if (timeoutId !== undefined) {

      clearTimeout(timeoutId);
    }
  }
}

// ========================================
// PUSH NETWORK TIMEOUT PROTECTION
// ========================================

async function fetchWithPushTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<{
  response: Response;
  responseText: string;
}> {

  const controller = new AbortController();

  try {

    return await withTimeout(

      (async () => {

        const response = await fetch(url, {

          ...options,

          signal: controller.signal,
        });

        const responseText =
          await response.text();

        return {
          response,
          responseText,
        };

      })(),

      timeoutMs,

      'Push API request'
    );

  } finally {

    controller.abort();
  }
}

// ========================================
// AUTHENTICATION TOKEN RETRIEVAL
// ========================================

async function getAuthTokenWithTimeout():
  Promise<string | null> {

  return withTimeout(

    getToken(),

    AUTH_TOKEN_TIMEOUT_MS,

    'Authentication token retrieval'
  );
}

// ========================================
// NOTIFICATION INITIALIZATION
// ========================================

let notificationHandlerInitialized = false;

export async function initializeNotificationHandler() {

  if (IS_EXPO_GO) {

    console.log(
      'Expo Go: Remote push notifications disabled.'
    );

    return;
  }

  if (notificationHandlerInitialized) {

    return;
  }

  const Notifications =
    await import('expo-notifications');

  Notifications.setNotificationHandler({

    handleNotification: async () => ({

      shouldShowBanner: true,

      shouldShowList: true,

      shouldPlaySound: true,

      shouldSetBadge: true,
    }),
  });

  notificationHandlerInitialized = true;

  console.log(
    'Notification foreground handler initialized.'
  );
}

// ========================================
// PUSH REGISTRATION STATE
// ========================================

type PushRegistrationOperation = {

  sessionVersion: number;

  promise: Promise<string | null>;

};

let registrationOperation:
  PushRegistrationOperation | null = null;

let currentExpoPushToken: string | null = null;

let pushRegistrationPaused = false;

let pushSessionVersion = 0;

// ========================================
// DEVICE UNREGISTRATION STATE
// ========================================

type PushUnregistrationOperation = {

  sessionVersion: number;

  promise: Promise<boolean>;

};

let unregistrationOperation:
  PushUnregistrationOperation | null = null;

// ========================================
// SESSION VALIDATION
// ========================================

function isRegistrationSessionValid(
  sessionVersion: number
): boolean {

  return (

    !pushRegistrationPaused &&

    sessionVersion === pushSessionVersion
  );
}

// ========================================
// PAUSE PUSH REGISTRATION
// ========================================

export function pausePushRegistration(): void {

  pushRegistrationPaused = true;

  pushSessionVersion++;
}

// ========================================
// RESUME PUSH REGISTRATION
// ========================================

export function resumePushRegistration(): void {

  pushRegistrationPaused = false;

  pushSessionVersion++;
}

// ========================================
// AUTHENTICATION LIFECYCLE
// ========================================

subscribeAuth((authenticated) => {

  if (authenticated) {

    resumePushRegistration();

  } else {

    pausePushRegistration();

    currentExpoPushToken = null;
  }
});

// ========================================
// REGISTER PUSH NOTIFICATIONS
// ========================================

export async function registerForPushNotificationsAsync():
  Promise<string | null> {

  if (IS_EXPO_GO) {

    console.log(
      'Push notifications require a development or standalone build.'
    );

    return null;
  }

  if (!Device.isDevice) {

    console.log(
      'Push notifications require a physical device.'
    );

    return null;
  }

  if (pushRegistrationPaused) {

    console.log(
      'Push registration is currently paused.'
    );

    return null;
  }

  const sessionVersion =
    pushSessionVersion;

  // ========================================
  // WAIT FOR PREVIOUS DEVICE UNREGISTRATION
  // ========================================

  const previousUnregistration =
    unregistrationOperation;

  if (previousUnregistration) {

    try {

      await withTimeout(

        previousUnregistration.promise,

        LOGOUT_DEVICE_TIMEOUT_MS,

        'Previous device unregistration'
      );

    } catch (error) {

      console.warn(
        'Unable to confirm previous device unregistration:',
        error
      );

      return null;
    }
  }

  if (!isRegistrationSessionValid(sessionVersion)) {

    return null;
  }

  // ========================================
  // REUSE SAME-SESSION REGISTRATION
  // ========================================

  const existingOperation =
    registrationOperation;

  if (existingOperation) {

    if (
      existingOperation.sessionVersion ===
      sessionVersion
    ) {

      return existingOperation.promise;
    }

    // Wait briefly for an older session operation.

    try {

      await withTimeout(

        existingOperation.promise,

        REGISTRATION_WAIT_TIMEOUT_MS,

        'Previous push registration'
      );

    } catch (error) {

      console.warn(
        'Previous push registration still pending:',
        error
      );
    }
  }

  if (!isRegistrationSessionValid(sessionVersion)) {

    return null;
  }

  // Another caller may have started a registration
  // while this caller was awaiting an older operation.

  if (
    registrationOperation &&
    registrationOperation.sessionVersion ===
      sessionVersion
  ) {

    return registrationOperation.promise;
  }

  // ========================================
  // START CURRENT SESSION REGISTRATION
  // ========================================

  const operation: PushRegistrationOperation = {

    sessionVersion,

    promise: performPushRegistration(
      sessionVersion
    ),
  };

  registrationOperation = operation;

  try {

    return await operation.promise;

  } finally {

    // An older registration must not clear
    // a newer session's registration operation.

    if (registrationOperation === operation) {

      registrationOperation = null;
    }
  }
}

// ========================================
// PERFORM PUSH REGISTRATION
// ========================================

async function performPushRegistration(
  sessionVersion: number
): Promise<string | null> {

  try {

    const initialJwtToken =
      await getAuthTokenWithTimeout();

    if (
      !initialJwtToken ||
      !isRegistrationSessionValid(sessionVersion)
    ) {

      return null;
    }

    // ========================================
    // LOAD EXPO NOTIFICATIONS
    // ========================================

    const Notifications =
      await withTimeout(

        import('expo-notifications'),

        NOTIFICATION_SETUP_TIMEOUT_MS,

        'Notification module initialization'
      );

    await withTimeout(

      initializeNotificationHandler(),

      NOTIFICATION_SETUP_TIMEOUT_MS,

      'Notification handler initialization'
    );

    if (!isRegistrationSessionValid(sessionVersion)) {

      return null;
    }

    // ========================================
    // ANDROID NOTIFICATION CHANNEL
    // ========================================

    if (Platform.OS === 'android') {

      await withTimeout(

        Notifications.setNotificationChannelAsync(

          'default',

          {
            name: 'Temple Notifications',

            importance:
              Notifications.AndroidImportance.MAX,

            vibrationPattern: [
              0,
              250,
              250,
              250,
            ],

            sound: 'default',
          }
        ),

        NOTIFICATION_SETUP_TIMEOUT_MS,

        'Android notification channel setup'
      );
    }

    if (!isRegistrationSessionValid(sessionVersion)) {

      return null;
    }

    // ========================================
    // NOTIFICATION PERMISSIONS
    // ========================================

    const existingPermissions =
      await withTimeout(

        Notifications.getPermissionsAsync(),

        NOTIFICATION_SETUP_TIMEOUT_MS,

        'Notification permission check'
      );

    let finalStatus =
      existingPermissions.status;

    if (!isRegistrationSessionValid(sessionVersion)) {

      return null;
    }

    if (finalStatus !== 'granted') {

      const requestedPermissions =
        await withTimeout(

          Notifications.requestPermissionsAsync(),

          PERMISSION_TIMEOUT_MS,

          'Notification permission request'
        );

      finalStatus =
        requestedPermissions.status;
    }

    if (finalStatus !== 'granted') {

      console.warn(
        'Notification permission not granted.'
      );

      return null;
    }

    if (!isRegistrationSessionValid(sessionVersion)) {

      return null;
    }

    // ========================================
    // EAS PROJECT ID
    // ========================================

    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {

      console.error(
        'Missing EAS project ID.'
      );

      return null;
    }

    // ========================================
    // GET EXPO PUSH TOKEN WITH TIMEOUT
    // ========================================

    const pushToken =
      await withTimeout(

        Notifications.getExpoPushTokenAsync({
          projectId,
        }),

        EXPO_TOKEN_TIMEOUT_MS,

        'Expo push token retrieval'
      );

    const expoPushToken =
      pushToken.data;

    if (
      !expoPushToken ||
      !isRegistrationSessionValid(sessionVersion)
    ) {

      return null;
    }

    // ========================================
    // REVALIDATE AUTHENTICATION SESSION
    // ========================================

    const jwtToken =
      await getAuthTokenWithTimeout();

    if (
      !jwtToken ||
      jwtToken !== initialJwtToken ||
      !isRegistrationSessionValid(sessionVersion)
    ) {

      console.log(
        'Push registration cancelled because the authentication session changed.'
      );

      return null;
    }

    currentExpoPushToken =
      expoPushToken;

    // ========================================
    // REGISTER DEVICE WITH RENDER BACKEND
    // ========================================

    const {
      response,
      responseText,
    } = await fetchWithPushTimeout(

      `${API_BASE_URL}/notifications/register-device`,

      {
        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          Authorization: `Bearer ${jwtToken}`,
        },

        body: JSON.stringify({

          expoPushToken,

          platform: Platform.OS,

          deviceName:
            Device.deviceName ?? null,

          preferredLanguage: (

            i18n.resolvedLanguage ||

            i18n.language ||

            'en'

          ).toLowerCase().split('-')[0],

        }),
      },

      PUSH_REGISTRATION_TIMEOUT_MS
    );

    // ========================================
    // VALIDATE BACKEND RESPONSE
    // ========================================

    let responseData: any = null;

    try {

      responseData =
        JSON.parse(responseText);

    } catch {

      console.warn(
        'Device registration returned a non-JSON response.'
      );
    }

    if (
      !response.ok ||
      responseData?.success !== true
    ) {

      console.error(
        'Push device registration failed:',
        response.status
      );

      return null;
    }

    // ========================================
    // FINAL AUTHENTICATION VALIDATION
    // ========================================

    const finalJwtToken =
      await getAuthTokenWithTimeout();

    if (
      finalJwtToken !== initialJwtToken ||
      !isRegistrationSessionValid(sessionVersion)
    ) {

      console.log(
        'Push registration completed after an authentication session change.'
      );

      return null;
    }

    console.log(
      'Push device successfully registered with backend.'
    );

    return expoPushToken;

  } catch (error) {

    console.error(
      'Push registration failed:',
      error
    );

    return null;
  }
}

// ========================================
// UNREGISTER CURRENT PUSH DEVICE
// ========================================

export async function unregisterCurrentPushDevice():
  Promise<boolean> {

  // Reuse an existing logout operation only
  // when it belongs to the current session.

  if (
    unregistrationOperation &&
    unregistrationOperation.sessionVersion ===
      pushSessionVersion
  ) {

    return unregistrationOperation.promise;
  }

  pausePushRegistration();

  if (IS_EXPO_GO || !Device.isDevice) {

    return true;
  }

  const sessionVersion =
    pushSessionVersion;

  const operation: PushUnregistrationOperation = {

    sessionVersion,

    promise: executeBoundedUnregistration(
      sessionVersion
    ),
  };

  unregistrationOperation =
    operation;

  try {

    return await operation.promise;

  } finally {

    if (
      unregistrationOperation === operation
    ) {

      unregistrationOperation = null;
    }
  }
}

// ========================================
// BOUNDED UNREGISTRATION
// ========================================

async function executeBoundedUnregistration(
  sessionVersion: number
): Promise<boolean> {

  let operationExpired = false;

  const deadline =
    Date.now() + LOGOUT_DEVICE_TIMEOUT_MS;

  const isOperationValid = (): boolean => {

    return (

      !operationExpired &&

      pushRegistrationPaused &&

      sessionVersion === pushSessionVersion &&

      Date.now() < deadline
    );
  };

  try {

    return await withTimeout(

      performPushUnregistration(

        sessionVersion,

        isOperationValid
      ),

      LOGOUT_DEVICE_TIMEOUT_MS,

      'Complete device unregistration'
    );

  } catch (error) {

    console.warn(
      'Bounded device unregistration failed:',
      error
    );

    return false;

  } finally {

    // Prevent a timed-out operation from
    // starting any later backend request.

    operationExpired = true;
  }
}

// ========================================
// PERFORM PUSH DEVICE UNREGISTRATION
// ========================================

async function performPushUnregistration(
  sessionVersion: number,
  isOperationValid: () => boolean
): Promise<boolean> {

  try {

    // Capture JWT before asynchronous waiting.

    const jwtToken =
      await getAuthTokenWithTimeout();

    if (
      !jwtToken ||
      !isOperationValid()
    ) {

      return false;
    }

    // ========================================
    // BOUNDED REGISTRATION WAIT
    // ========================================

    const pendingRegistration =
      registrationOperation;

    if (pendingRegistration) {

      try {

        await withTimeout(

          pendingRegistration.promise,

          REGISTRATION_WAIT_TIMEOUT_MS,

          'Pending push registration during logout'
        );

      } catch (error) {

        console.warn(
          'Pending registration did not finish before logout:',
          error
        );
      }
    }

    if (!isOperationValid()) {

      return false;
    }

    // ========================================
    // RECOVER CACHED EXPO PUSH TOKEN
    // ========================================

    let expoPushToken =
      currentExpoPushToken;

    if (!expoPushToken) {

      const Notifications =
        await withTimeout(

          import('expo-notifications'),

          NOTIFICATION_SETUP_TIMEOUT_MS,

          'Notification module loading'
        );

      if (!isOperationValid()) {

        return false;
      }

      const projectId =
        Constants.easConfig?.projectId ??
        Constants.expoConfig?.extra?.eas?.projectId;

      if (!projectId) {

        return false;
      }

      // Do not request notification permissions
      // during logout.

      const pushToken =
        await withTimeout(

          Notifications.getExpoPushTokenAsync({
            projectId,
          }),

          EXPO_TOKEN_TIMEOUT_MS,

          'Expo token recovery during logout'
        );

      expoPushToken =
        pushToken.data;
    }

    if (
      !expoPushToken ||
      !isOperationValid()
    ) {

      return false;
    }

    // ========================================
    // REVALIDATE CURRENT JWT
    // ========================================

    const currentJwtToken =
      await getAuthTokenWithTimeout();

    if (
      currentJwtToken !== jwtToken ||
      !isOperationValid()
    ) {

      return false;
    }

    // ========================================
    // DEACTIVATE DEVICE THROUGH RENDER
    // ========================================

    const {
      response,
      responseText,
    } = await fetchWithPushTimeout(

      `${API_BASE_URL}/notifications/unregister-device`,

      {
        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          Authorization: `Bearer ${jwtToken}`,
        },

        body: JSON.stringify({

          expoPushToken,
        }),
      },

      PUSH_UNREGISTRATION_TIMEOUT_MS
    );

    if (!isOperationValid()) {

      return false;
    }

    if (!response.ok) {

      console.warn(
        'Device unregistration failed:',
        response.status
      );

      return false;
    }

    // ========================================
    // VALIDATE BACKEND RESPONSE
    // ========================================

    let responseData: any = null;

    try {

      responseData =
        JSON.parse(responseText);

    } catch {

      console.warn(
        'Device unregistration returned a non-JSON response.'
      );

      return false;
    }

    if (responseData?.success !== true) {

      return false;
    }

    // ========================================
    // CLEAR CACHED TOKEN
    // ========================================

    if (
      sessionVersion === pushSessionVersion &&
      isOperationValid()
    ) {

      currentExpoPushToken = null;
    }

    console.log(
      'Push device successfully unregistered.'
    );

    return true;

  } catch (error) {

    console.warn(
      'Push device unregistration error:',
      error
    );

    return false;
  }
}

// ========================================
// NOTIFICATION TAP HANDLING
// ========================================

const handledNotificationResponses =
  new Set<string>();

export function handleNotificationResponse(
  response: any
) {

  try {

    const notificationId =
      response?.notification?.request?.identifier;

    if (
      notificationId &&
      handledNotificationResponses.has(
        notificationId
      )
    ) {

      return;
    }

    const data =
      response?.notification?.request?.content?.data;

    if (
      !data ||
      typeof data !== 'object'
    ) {

      return;
    }

    if (notificationId) {

      handledNotificationResponses.add(
        notificationId
      );

      // Bound memory use.

      if (
        handledNotificationResponses.size > 100
      ) {

        const oldest =
          handledNotificationResponses
            .values()
            .next()
            .value;

        if (oldest) {

          handledNotificationResponses.delete(
            oldest
          );
        }
      }
    }

    console.log(
      'FULL NOTIFICATION DATA:',
      JSON.stringify(data, null, 2)
    );

    // ========================================
    // ANNOUNCEMENT
    // ========================================

    if (data.type === 'volunteer_seva') {
      openVolunteerSevaNotification(data);
      return;
    }
    if (data.type === 'announcement') {

      router.push({

        pathname:
          '/announcements' as any,

        params: {

          id: String(
            data.announcementId ?? ''
          ),
        },
      });

      return;
    }

    // ========================================
    // DARSHAN VIDEO
    // ========================================

    if (data.type === 'darshan_video') {

      router.push(
        '/darshan-videos' as any
      );

      return;
    }

    // ========================================
    // TODAY'S DARSHAN
    // ========================================

    if (data.type === 'today_darshan') {

      router.push(
        '/darshan' as any
      );

      return;
    }

    // ========================================
    // DEITY
    // ========================================

    if (data.type === 'deity') {

      router.push({

        pathname:
          '/deity/[id]' as any,

        params: {

          id: String(
            data.deityId ?? ''
          ),
        },
      });

      return;
    }

    // ========================================
    // TEST NOTIFICATION
    // ========================================

    if (data.type === 'test') {

      router.push('/(tabs)');

      return;
    }

    // ========================================
    // OTHER NOTIFICATIONS
    // VOLUNTEER SEVA NOTIFICATIONS
    // ========================================

    if (
      typeof data.screen === 'string' &&
      data.screen.startsWith('/') &&
      !data.screen.startsWith('//')
    ) {

      router.push(
        data.screen as any
      );
    }

  } catch (error) {

    console.error(
      'Notification tap handling error:',
      error
    );
  }
}

// ========================================
// INITIAL NOTIFICATION CHECK
// ========================================

export async function handleInitialNotification() {

  if (IS_EXPO_GO) {

    return;
  }

  try {

    const Notifications =
      await import('expo-notifications');

    const response =
      await Notifications
        .getLastNotificationResponseAsync();

    if (response) {

      handleNotificationResponse(
        response
      );

      await Notifications
        .clearLastNotificationResponseAsync();
    }

  } catch (error) {

    console.error(
      'Initial notification handling error:',
      error
    );
  }
}

// ========================================
// NOTIFICATION RESPONSE LISTENER
// ========================================

export async function initializeNotificationListener() {

  if (IS_EXPO_GO) {

    return () => {};
  }

  try {

    const Notifications =
      await import('expo-notifications');

    await initializeNotificationHandler();

    const subscription =
      Notifications
        .addNotificationResponseReceivedListener(
          handleNotificationResponse
        );

    return () => {

      subscription.remove();
    };

  } catch (error) {

    console.error(
      'Notification listener initialization failed:',
      error
    );

    return () => {};
  }
}

// ========================================
// PUSH NOTIFICATION LANGUAGE SYNC
// ========================================

export async function syncPushNotificationLanguage():
  Promise<void> {

  if (
    IS_EXPO_GO ||
    !Device.isDevice ||
    pushRegistrationPaused
  ) {

    return;
  }

  const sessionVersion =
    pushSessionVersion;

  try {

    const token =
      await getAuthTokenWithTimeout();

    if (
      !token ||
      !isRegistrationSessionValid(sessionVersion)
    ) {

      return;
    }

    const Notifications =
      await withTimeout(

        import('expo-notifications'),

        NOTIFICATION_SETUP_TIMEOUT_MS,

        'Notification language module loading'
      );

    const permissions =
      await withTimeout(

        Notifications.getPermissionsAsync(),

        NOTIFICATION_SETUP_TIMEOUT_MS,

        'Language synchronization permission check'
      );

    if (permissions.status !== 'granted') {

      return;
    }

    const existingOperation =
      registrationOperation;

    if (existingOperation) {

      try {

        await withTimeout(

          existingOperation.promise,

          PUSH_REGISTRATION_TIMEOUT_MS,

          'Language synchronization registration wait'
        );

      } catch (error) {

        console.warn(
          'Previous notification registration is still pending:',
          error
        );
      }
    }

    const currentToken =
      await getAuthTokenWithTimeout();

    if (
      currentToken !== token ||
      !isRegistrationSessionValid(sessionVersion)
    ) {

      return;
    }

    await registerForPushNotificationsAsync();

  } catch (error) {

    console.warn(
      'Push language synchronization failed:',
      error
    );
  }
}