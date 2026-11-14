import { useTranslation } from 'react-i18next';
import React, {
  useCallback,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import { WebView } from 'react-native-webview';

// ========================================
// TEMPLE WEBSITE ROOM BOOKING URL
// ========================================

const ROOM_BOOKING_URL =
  'https://www.divyakshetrahariharapura.com/web/bookingroom';

// ========================================
// ROOM BOOKING SCREEN
// ========================================

export default function RoomBookingScreen() {
  const { t } = useTranslation();
  const webViewRef = useRef<WebView>(null);
  const loadStartedAt = useRef<number>(0);

  const [canGoBack, setCanGoBack] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [hasError, setHasError] =
    useState(false);

  // ========================================
  // HANDLE BACK NAVIGATION
  // ========================================

  const handleBack = useCallback(() => {
    if (canGoBack && !hasError) {
      webViewRef.current?.goBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [canGoBack, hasError]);

  // ========================================
  // ANDROID HARDWARE BACK BUTTON
  // ========================================

  useFocusEffect(
    useCallback(() => {
      const subscription =
        BackHandler.addEventListener(
          'hardwareBackPress',
          () => {
            handleBack();
            return true;
          }
        );

      return () => {
        subscription.remove();
      };
    }, [handleBack])
  );

  // ========================================
  // RETRY WEBVIEW
  // ========================================

  const handleRetry = () => {
    setHasError(false);
    setLoading(true);

    webViewRef.current?.reload();
  };

  // ========================================
  // UI
  // ========================================

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'bottom']}
    >
      {/* HEADER */}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('bookingScreens.back')}
        >
          <Text style={styles.backText}>
            â€¹
          </Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('bookingScreens.roomTitle')}</Text>

        <View style={styles.headerSpacer} />
      </View>

      {/* WEBVIEW */}

      
<View style={styles.webContainer}>
  <WebView
    ref={webViewRef}
    source={{
      uri: ROOM_BOOKING_URL,
    }}
    style={styles.webview}

    // WEBSITE SUPPORT
    javaScriptEnabled={true}
    domStorageEnabled={true}
    sharedCookiesEnabled={true}
    thirdPartyCookiesEnabled={true}

    // KEEP LINKS IN SAME WEBVIEW
    setSupportMultipleWindows={false}

    // LOADING
    startInLoadingState={true}

    onLoadStart={(event) => {
      loadStartedAt.current = Date.now();

      console.log(
        'Room WebView: loading started',
        event.nativeEvent.url
      );

      setLoading(true);
      setHasError(false);
    }}

    // TRACK LOADING PROGRESS
    onLoadProgress={({ nativeEvent }) => {
      console.log(
        'Room WebView progress:',
        Math.round(nativeEvent.progress * 100) + '%'
      );
    }}

    // TRACK LOAD COMPLETION
    onLoadEnd={(event) => {
      const duration =
        (Date.now() - loadStartedAt.current) / 1000;

      console.log(
        'Room WebView load completed in:',
        duration,
        'seconds'
      );

      console.log(
        'Loaded URL:',
        event.nativeEvent.url
      );

      setLoading(false);
    }}

    // NAVIGATION
    onNavigationStateChange={(navState) => {
      setCanGoBack(navState.canGoBack);
    }}

    // ERROR HANDLING
    onError={(event) => {
      console.error(
        'Room Booking WebView Error:',
        event.nativeEvent.description
      );

      setLoading(false);
      setHasError(true);
    }}

    onHttpError={(event) => {
      console.warn(
        'Room Booking HTTP Error:',
        event.nativeEvent.statusCode
      );
    }}
  />

  {/* TEMPORARILY DISABLED LOADING OVERLAY */}

  {false && loading && !hasError && (
    <View style={styles.loader}>
      <ActivityIndicator
        size="large"
        color="#8B0000"
      />

      <Text style={styles.loaderText}>{t('bookingScreens.roomLoading')}</Text>
    </View>
  )}

  {/* ERROR SCREEN */}

  {hasError && (
    <View style={styles.errorContainer}>
      <Text style={styles.errorIcon}>
        âš ï¸
      </Text>

      <Text style={styles.errorTitle}>{t('bookingScreens.roomError')}</Text>

      <Text style={styles.errorText}>{t('bookingScreens.connectionError')}</Text>

      <TouchableOpacity
        style={styles.retryButton}
        onPress={handleRetry}
        activeOpacity={0.8}
      >
        <Text style={styles.retryText}>{t('bookingScreens.retry')}</Text>
      </TouchableOpacity>
    </View>
  )}
</View>

    </SafeAreaView>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  header: {
    height: 56,
    backgroundColor: '#8B0000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },

  backButton: {
    width: 40,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  backText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '400',
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  headerSpacer: {
    width: 40,
  },

  webContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  webview: {
    flex: 1,
  },

  // FIXED: StyleSheet.absoluteFill
  loader: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },

  loaderText: {
    color: '#666666',
    fontSize: 13,
    fontWeight: '500',
  },

  // FIXED: StyleSheet.absoluteFill
  errorContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },

  errorIcon: {
    fontSize: 40,
    marginBottom: 8,
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B0000',
    textAlign: 'center',
  },

  errorText: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },

  retryButton: {
    backgroundColor: '#8B0000',
    paddingHorizontal: 30,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 12,
  },

  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

