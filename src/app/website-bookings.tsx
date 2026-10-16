
import React, {
  useCallback,
  useEffect,
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

import {
  router,
  useFocusEffect,
} from 'expo-router';

import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const PROFILE_URL =
  'https://www.divyakshetrahariharapura.com/web/profile';

const LOADING_TIMEOUT = 15000;

export default function WebsiteBookingsScreen() {
  const webViewRef = useRef<WebView>(null);
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const clearLoadingTimer = useCallback(() => {
    if (loadingTimer.current) {
      clearTimeout(loadingTimer.current);
      loadingTimer.current = null;
    }
  }, []);

  const stopLoading = useCallback(() => {
    clearLoadingTimer();
    setLoading(false);
  }, [clearLoadingTimer]);

  const startLoading = useCallback(() => {
    clearLoadingTimer();
    setLoading(true);
    setHasError(false);

    loadingTimer.current = setTimeout(() => {
  setLoading(false);
}, LOADING_TIMEOUT);
  }, [clearLoadingTimer]);

  useEffect(() => {
    return () => clearLoadingTimer();
  }, [clearLoadingTimer]);

  const handleBack = useCallback(() => {
    if (canGoBack && !hasError) {
      webViewRef.current?.goBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [canGoBack, hasError]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          handleBack();
          return true;
        }
      );

      return () => subscription.remove();
    }, [handleBack])
  );

  const handleRetry = () => {
    clearLoadingTimer();
    setHasError(false);
    setCanGoBack(false);
    setLoading(true);
    setRetryKey((value) => value + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.title}>My Bookings</Text>

        <View style={{ width: 30 }} />
      </View>

      <View style={styles.webContainer}>
        <WebView
          key={retryKey}
          ref={webViewRef}
          source={{ uri: PROFILE_URL }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          setSupportMultipleWindows={false}
          startInLoadingState={false}
          onLoadStart={startLoading}
          onLoadEnd={stopLoading}
          onNavigationStateChange={(state) => {
            setCanGoBack(state.canGoBack);
            console.log('Bookings URL:', state.url);
          }}
          onError={(event) => {
            console.error(
              'Profile WebView Error:',
              event.nativeEvent.description
            );
            stopLoading();
            setHasError(true);
          }}
          onHttpError={(event) => {
            console.warn(
              'Profile HTTP Error:',
              event.nativeEvent.statusCode,
              event.nativeEvent.url
            );
          }}
        />

        {loading && !hasError && (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color="#8B0000"
            />
            <Text style={styles.message}>
              Loading your bookings...
            </Text>
          </View>
        )}

        {hasError && (
          <View style={styles.loading}>
            <Text style={styles.message}>
              Unable to load your bookings.
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

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
    paddingHorizontal: 16,
  },
  backText: {
    fontSize: 34,
    color: '#FFFFFF',
    width: 30,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  webContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  message: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#8B0000',
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
