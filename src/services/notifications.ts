import * as Device from 'expo-device';
import Constants from 'expo-constants';

import {
  Platform,
} from 'react-native';

import {
  router,
} from 'expo-router';

import {
  getToken,
} from './authStorage';

// ========================================
// EXPO GO DETECTION
// ========================================

const IS_EXPO_GO =
  Constants.executionEnvironment === 'storeClient';

// ========================================
// BACKEND URL
// ========================================

// LOCAL TESTING
const API_BASE_URL =
 'https://templeapp-s96e.onrender.com/api';

 //'http://192.168.0.122:5000/api';
// PRODUCTION: Switch before building
// const API_BASE_URL =
   //'https://templeapp-s96e.onrender.com/api';

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
// REGISTER PUSH NOTIFICATIONS
// ========================================

let registrationPromise:
  Promise<string | null> | null = null;

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

  // Prevent overlapping registration requests.
  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise = performPushRegistration();

  try {
    return await registrationPromise;
  } finally {
    registrationPromise = null;
  }
}

async function performPushRegistration():
  Promise<string | null> {

  try {
    const Notifications =
      await import('expo-notifications');

    await initializeNotificationHandler();

    // ====================================
    // ANDROID NOTIFICATION CHANNEL
    // ====================================

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(
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
      );
    }

    // ====================================
    // PERMISSIONS
    // ====================================

    const existingPermissions =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingPermissions.status;

    if (finalStatus !== 'granted') {
      const requestedPermissions =
        await Notifications.requestPermissionsAsync();

      finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== 'granted') {
      console.warn(
        'Notification permission not granted.'
      );
      return null;
    }

    // ====================================
    // EAS PROJECT ID
    // ====================================

    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.error(
        'Missing EAS project ID.'
      );
      return null;
    }

    // ====================================
    // GET EXPO PUSH TOKEN
    // ====================================

    const pushToken =
      await Notifications.getExpoPushTokenAsync({
        projectId,
      });

    const expoPushToken = pushToken.data;

    console.log(
      'Expo push token generated successfully.'
    );

    // ====================================
    // REGISTER TOKEN WITH BACKEND
    // ====================================

    const jwtToken = await getToken();

    if (!jwtToken) {
      console.warn(
        'No login token. Push registration deferred.'
      );
      return expoPushToken;
    }

    const response = await fetch(
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
          deviceName: Device.deviceName ?? null,
        }),
      }
    );

    const responseText = await response.text();

    let responseData: any = null;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.warn(
        'Device registration returned a non-JSON response.'
      );
    }

    if (!response.ok || responseData?.success === false) {
      console.error(
        'Push device registration failed:',
        response.status,
        responseData ?? responseText
      );
      return expoPushToken;
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
      handledNotificationResponses.has(notificationId)
    ) {
      return;
    }

    const data =
      response?.notification?.request?.content?.data;

    if (!data || typeof data !== 'object') {
      return;
    }

    if (notificationId) {
      handledNotificationResponses.add(notificationId);

      // Bound memory use.
      if (handledNotificationResponses.size > 100) {
        const oldest =
          handledNotificationResponses.values().next().value;

        if (oldest) {
          handledNotificationResponses.delete(oldest);
        }
      }
    }

    console.log(
      'Notification tapped:',
      data.type
    );

    // ====================================
    // ANNOUNCEMENT
    // ====================================

    if (data.type === 'announcement') {
      router.push({
        pathname: '/announcements' as any,
        params: {
          id: String(data.announcementId ?? ''),
        },
      });
      return;
    }

    // ====================================
    // DARSHAN VIDEO
    // ====================================

    if (data.type === 'darshan_video') {
      router.push('/darshan-videos' as any);
      return;
    }

    // ====================================
    // TODAY'S DARSHAN
    // ====================================

    if (data.type === 'today_darshan') {
      router.push('/darshan' as any);
      return;
    }

    // ====================================
    // DEITY
    // ====================================

    if (data.type === 'deity') {
      router.push({
        pathname: '/deity/[id]' as any,
        params: {
          id: String(data.deityId ?? ''),
        },
      });
      return;
    }

    // ====================================
    // TEST NOTIFICATION
    // ====================================

    if (data.type === 'test') {
      router.push('/(tabs)');
      return;
    }

    // ====================================
    // OTHER NOTIFICATIONS
    // ====================================

    if (
      typeof data.screen === 'string' &&
      data.screen.startsWith('/') &&
      !data.screen.startsWith('//')
    ) {
      router.push(data.screen as any);
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
      await Notifications.getLastNotificationResponseAsync();

    if (response) {
      handleNotificationResponse(response);

      await Notifications.clearLastNotificationResponseAsync();
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
      Notifications.addNotificationResponseReceivedListener(
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