
import React, { useCallback, useRef, useState } from 'react';

import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';

const DONATION_URL =
  'https://www.divyakshetrahariharapura.com/web/bookingdonation';

const COLORS = {
  background: '#FFFDF8',
  maroon: '#6B1720',
  gold: '#C69A3A',
  text: '#4A2C18',
  muted: '#8E8175',
  border: '#E8DCCB',
};

export default function DonationsScreen() {
  const webViewRef = useRef<WebView>(null);

  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (canGoBack && !hasError) {
          webViewRef.current?.goBack();
          return true;
        }

        return false;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      return () => subscription.remove();
    }, [canGoBack, hasError])
  );

  const retry = () => {
    setLoading(true);
    setHasError(false);
    setCanGoBack(false);
    setReloadKey((value) => value + 1);
  };

  const openInBrowser = async () => {
    try {
      await Linking.openURL(DONATION_URL);
    } catch (error) {
      console.warn('Unable to open donation website:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons
            name="heart-outline"
            size={23}
            color={COLORS.maroon}
          />
        </View>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Donations</Text>
          <Text style={styles.headerSubtitle}>
            Support our temple with devotion
          </Text>
        </View>

        <TouchableOpacity
          style={styles.browserButton}
          onPress={openInBrowser}
          accessibilityLabel="Open donations in browser"
        >
          <Ionicons
            name="open-outline"
            size={22}
            color={COLORS.maroon}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.webContainer}>
        {!hasError ? (
          <WebView
            key={reloadKey}
            ref={webViewRef}
            source={{ uri: DONATION_URL }}
            style={styles.webview}
            originWhitelist={['http://*', 'https://*']}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically={false}
            startInLoadingState
            mixedContentMode="never"
            allowsBackForwardNavigationGestures
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack);
            }}
            onLoadStart={() => {
              setLoading(true);
            }}
            onLoadEnd={() => {
              setLoading(false);
            }}
            onError={(event) => {
              console.warn(
                'Donation WebView error:',
                event.nativeEvent.description
              );
              setLoading(false);
              setHasError(true);
            }}
            onHttpError={(event) => {
              const status = event.nativeEvent.statusCode;

              console.warn(
                'Donation HTTP error:',
                status
              );

              if (
                status >= 400 &&
                event.nativeEvent.url === DONATION_URL
              ) {
                setHasError(true);
                setLoading(false);
              }
            }}
            onShouldStartLoadWithRequest={(request) => {
              const url = request.url;

              if (
                url.startsWith('http://') ||
                url.startsWith('https://') ||
                url === 'about:blank'
              ) {
                return true;
              }

              if (
                Platform.OS === 'android' &&
                url.startsWith('intent://')
              ) {
                // Intent links need dedicated Android handling.
                // Avoid passing unsupported URLs to WebView.
                console.warn('External payment intent:', url);
                return false;
              }

              Linking.openURL(url).catch((error) => {
                console.warn(
                  'Unable to open external link:',
                  error
                );
              });

              return false;
            }}
          />
        ) : (
          <View style={styles.errorContainer}>
            <Ionicons
              name="cloud-offline-outline"
              size={52}
              color={COLORS.gold}
            />

            <Text style={styles.errorTitle}>
              Unable to load Donations
            </Text>

            <Text style={styles.errorText}>
              Please check your internet connection
              and try again.
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={retry}
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={openInBrowser}>
              <Text style={styles.browserText}>
                Open in Browser
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && !hasError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator
              size="large"
              color={COLORS.maroon}
            />
            <Text style={styles.loadingText}>
              Loading donation services...
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F7EBD7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  headerContent: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.maroon,
  },

  headerSubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 3,
  },

  browserButton: {
    padding: 8,
  },

  webContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  webview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

loadingOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: '#FFFFFF',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 10,
},
  loadingText: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 15,
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },

  errorTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.maroon,
    marginTop: 18,
    textAlign: 'center',
  },

  errorText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 24,
  },

  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
  },

  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  browserText: {
    color: COLORS.maroon,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 22,
    textDecorationLine: 'underline',
  },
});
