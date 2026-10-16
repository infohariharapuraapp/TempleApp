
import React, {
  useCallback,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  WebView,
} from 'react-native-webview';

// ========================================
// OFFICIAL TEMPLE BOOKING WEBSITE
// ========================================

const POOJA_BOOKING_URL =
  'https://www.divyakshetrahariharapura.com/web/OnlineSevaBooking';

const COLORS = {
  background: '#FFF9F0',
  maroon: '#6B1720',
  gold: '#C69A3A',
  white: '#FFFFFF',
  muted: '#8E8175',
  border: '#E8DCCB',
};

// ========================================
// POOJA BOOKING WEBVIEW
// ========================================

export default function PoojaBookingScreen() {
  const webViewRef = useRef<WebView>(null);

  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleBack = useCallback(() => {
    if (canGoBack && !hasError) {
      webViewRef.current?.goBack();
    } else {
      router.back();
    }

    return true;
  }, [canGoBack, hasError]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return;
      }

      const subscription =
        BackHandler.addEventListener(
          'hardwareBackPress',
          handleBack
        );

      return () => subscription.remove();
    }, [handleBack])
  );

  const reloadPage = () => {
    setHasError(false);
    setLoading(true);
    setCanGoBack(false);
    setReloadKey(previous => previous + 1);
  };

  const openInBrowser = async () => {
    try {
      await Linking.openURL(POOJA_BOOKING_URL);
    } catch (error) {
      console.error(
        'Unable to open pooja booking website:',
        error
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            Online Pooja Booking
          </Text>

          <Text style={styles.headerSubtitle}>
            Official Temple Website
          </Text>
        </View>

        <TouchableOpacity
          style={styles.browserButton}
          onPress={() => {
            void openInBrowser();
          }}
        >
          <Text style={styles.browserText}>↗</Text>
        </TouchableOpacity>
      </View>

      {/* WEBVIEW */}

      <View style={styles.webViewContainer}>
        <WebView
          key={reloadKey}
          ref={webViewRef}
          source={{ uri: POOJA_BOOKING_URL }}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          startInLoadingState
          setSupportMultipleWindows={false}
          onLoadStart={() => {
            setLoading(true);
            setHasError(false);
          }}
          onLoadEnd={() => {
            setLoading(false);
          }}
          onNavigationStateChange={state => {
            setCanGoBack(state.canGoBack);
          }}
          onError={event => {
            console.error(
              'Pooja WebView error:',
              event.nativeEvent
            );

            setHasError(true);
            setLoading(false);
          }}
          onHttpError={event => {
            console.warn(
              'Pooja WebView HTTP error:',
              event.nativeEvent.statusCode
            );

          if (event.nativeEvent.statusCode >= 400) {
  console.warn(
    'Pooja WebView HTTP error:',
    event.nativeEvent.statusCode
  );
}
          }}
          renderError={() => <View />}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color={COLORS.maroon}
              />

              <Text style={styles.loadingText}>
                Connecting to temple booking...
              </Text>

              <Text style={styles.loadingHint}>
                The official website may take a
                little time to load.
              </Text>
            </View>
          )}
        />

        {/* LOADING OVERLAY */}

        {loading && !hasError && (
          <View
            style={styles.loadingOverlay}
            pointerEvents="none"
          >
            <ActivityIndicator
              size="large"
              color={COLORS.maroon}
            />

            <Text style={styles.loadingText}>
              Loading Pooja Booking...
            </Text>
          </View>
        )}

        {/* ERROR STATE */}

        {hasError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>🛕</Text>

            <Text style={styles.errorTitle}>
              Booking Page Unavailable
            </Text>

            <Text style={styles.errorText}>
              We couldn't load the official
              temple booking website.
              Please try again.
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={reloadPage}
            >
              <Text style={styles.retryText}>
                Retry
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.externalButton}
              onPress={() => {
                void openInBrowser();
              }}
            >
              <Text style={styles.externalText}>
                Open in Browser ↗
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* FOOTER */}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🔒 Booking and payment are managed
          by the official temple website.
        </Text>
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
    backgroundColor: COLORS.background,
  },

  header: {
    height: 65,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  backButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#F8EBD8',
    marginRight: 12,
  },

  backText: {
    fontSize: 28,
    color: COLORS.maroon,
    lineHeight: 32,
  },

  headerContent: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.maroon,
  },

  headerSubtitle: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 3,
  },

  browserButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8EBD8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  browserText: {
    fontSize: 23,
    color: COLORS.maroon,
  },

  webViewContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  webView: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },

 loadingOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: COLORS.white,
  alignItems: 'center',
  justifyContent: 'center',
},
  loadingText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.maroon,
    marginTop: 15,
    textAlign: 'center',
  },

  loadingHint: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 25,
  },

errorContainer: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: COLORS.white,
  alignItems: 'center',
  justifyContent: 'center',
  padding: 25,
},

  errorIcon: {
    fontSize: 40,
    marginBottom: 15,
  },

  errorTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.maroon,
    textAlign: 'center',
  },

  errorText: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 22,
  },

  retryButton: {
    backgroundColor: COLORS.maroon,
    paddingVertical: 13,
    paddingHorizontal: 35,
    borderRadius: 12,
  },

  retryText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },

  externalButton: {
    marginTop: 20,
    padding: 10,
  },

  externalText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.maroon,
  },

  footer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },

  footerText: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 17,
  },
});
