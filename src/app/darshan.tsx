
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
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

import { Ionicons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';

import { apiRequest } from '@/services/api';

// ========================================
// TYPES
// ========================================

type TodayDarshan = {
  id: number;
  name: string;
  youtube_url: string;
  youtube_video_id: string;
  darshan_date: string;
  published_at: string;
  updated_at: string;
};

type ApiResponse = {
  success: boolean;
  data: TodayDarshan[];
  message?: string;
};

// ========================================
// COLORS
// ========================================

const COLORS = {
  background: '#FFFDF8',
  white: '#FFFFFF',
  maroon: '#6B1720',
  maroonDark: '#541018',
  gold: '#C69A3A',
  goldSoft: '#F7EBD7',
  border: '#E8DCCB',
  text: '#30241F',
  muted: '#8E8175',
};

// ========================================
// FORMAT DATE BASED ON APP LANGUAGE
// ========================================

function formatDarshanDate(
  dateString: string,
  language: string = 'en'
): string {
  if (!dateString) {
    return '';
  }

  const datePart = dateString.slice(0, 10);

  const date = new Date(
    `${datePart}T12:00:00+05:30`
  );

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const locales: Record<string, string> = {
    en: 'en-IN',
    te: 'te-IN',
    kn: 'kn-IN',
    hi: 'hi-IN',
    ta: 'ta-IN',
  };

  const selectedLanguage =
    language.split('-')[0];

  return date.toLocaleDateString(
    locales[selectedLanguage] || 'en-IN',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }
  );
}

// ========================================
// DARSHAN VIDEO CARD
// ========================================

function DarshanVideoCard({
  darshan,
}: {
  darshan: TodayDarshan;
}) {
  const { t, i18n } = useTranslation();

  const videoUrl =
    `https://www.youtube.com/embed/${darshan.youtube_video_id}?playsinline=1&rel=0`;

  return (
    <View style={styles.videoCard}>
      <View style={styles.videoHeader}>
        <Text style={styles.videoTitle}>
          {darshan.name}
        </Text>

        <Text style={styles.videoDate}>
          {formatDarshanDate(
            darshan.darshan_date,
            i18n.resolvedLanguage || i18n.language
          )}
        </Text>
      </View>

      <View style={styles.videoContainer}>
        <WebView
          key={darshan.youtube_video_id}
          source={{
            uri: videoUrl,
            headers: {
              Referer:
                'https://www.divyakshetrahariharapura.com/',
            },
          }}
          originWhitelist={['https://*']}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsFullscreenVideo={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.videoLoading}>
              <ActivityIndicator
                color={COLORS.gold}
                size="large"
              />
            </View>
          )}
          onError={(event) => {
            console.log(
              'Darshan WebView Error:',
              darshan.id,
              event.nativeEvent
            );
          }}
          onHttpError={(event) => {
            console.log(
              'Darshan HTTP Error:',
              darshan.id,
              event.nativeEvent.statusCode
            );
          }}
        />
      </View>

      <View style={styles.videoFooter}>
        <Ionicons
          name="play-circle-outline"
          size={19}
          color={COLORS.maroon}
        />

        <Text style={styles.videoFooterText}>
          {t('darshan.videoWatch')}
        </Text>
      </View>
    </View>
  );
}

// ========================================
// TODAY'S DARSHAN SCREEN
// ========================================

export default function TodayDarshanScreen() {
  const { t } = useTranslation();

  const [videos, setVideos] =
    useState<TodayDarshan[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  // ========================================
  // FETCH TODAY'S DARSHAN
  // ========================================

  const loadDarshan = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError('');

        const response =
          await apiRequest<ApiResponse>(
            '/darshan/today'
          );

        if (!response.success) {
          throw new Error(
            t('darshan.videoLoadError')
          );
        }

        setVideos(
          Array.isArray(response.data)
            ? response.data
            : []
        );
      } catch (err) {
        console.error(
          'Failed to load Darshan:',
          err
        );

        setError(
          t('darshan.videoLoadError')
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t]
  );

  // ========================================
  // REFRESH WHEN SCREEN OPENS
  // ========================================

  useFocusEffect(
    useCallback(() => {
      loadDarshan();
    }, [loadDarshan])
  );

  // ========================================
  // RENDER SCREEN
  // ========================================

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'bottom']}
    >
      {/* HEADER */}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color={COLORS.maroon}
          />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>
            {t('darshan.videoTitle')}
          </Text>

          <Text style={styles.headerSubtitle}>
            {t('darshan.videoSubtitle')}
          </Text>
        </View>
      </View>

      {/* LOADING */}

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={COLORS.maroon}
          />

          <Text style={styles.statusText}>
            {t('darshan.videoLoading')}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() =>
                loadDarshan(true)
              }
              colors={[COLORS.maroon]}
            />
          }
        >
          {/* ERROR */}

          {error ? (
            <View style={styles.emptyCard}>
              <Ionicons
                name="cloud-offline-outline"
                size={42}
                color={COLORS.muted}
              />

              <Text style={styles.emptyTitle}>
                {t('darshan.videoLoadError')}
              </Text>

              <Text style={styles.emptyDescription}>
                {error}
              </Text>

              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => loadDarshan()}
              >
                <Text style={styles.retryText}>
                  {t('darshan.videoTryAgain')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : videos.length > 0 ? (
            <>
              {/* INTRODUCTION */}

              <View style={styles.introCard}>
                <View style={styles.iconCircle}>
                  <Ionicons
                    name="flower-outline"
                    size={25}
                    color={COLORS.gold}
                  />
                </View>

                <Text style={styles.introTitle}>
                  {t('darshan.videoIntroTitle')}
                </Text>

                <Text style={styles.introDescription}>
                  {t('darshan.videoIntroDescription')}
                </Text>

                <Text style={styles.videoCount}>
                  {videos.length}{' '}
                  {videos.length === 1
                    ? t('darshan.videoSingular')
                    : t('darshan.videoPlural')}
                </Text>
              </View>

              {/* DARSHAN VIDEOS */}

              {videos.map((darshan) => (
                <DarshanVideoCard
                  key={darshan.id}
                  darshan={darshan}
                />
              ))}

              {/* NOTIFICATION INFORMATION */}

              <View style={styles.infoCard}>
                <Ionicons
                  name="notifications-outline"
                  size={21}
                  color={COLORS.gold}
                />

                <Text style={styles.infoText}>
                  {t('darshan.videoNotification')}
                </Text>
              </View>
            </>
          ) : (
            /* EMPTY STATE */

            <View style={styles.emptyCard}>
              <Ionicons
                name="videocam-outline"
                size={46}
                color={COLORS.gold}
              />

              <Text style={styles.emptyTitle}>
                {t('darshan.videoEmptyTitle')}
              </Text>

              <Text style={styles.emptyDescription}>
                {t('darshan.videoEmptyDescription')}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  backButton: {
    marginRight: 14,
    padding: 5,
  },

  headerText: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.maroon,
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.muted,
  },

  content: {
    padding: 18,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  statusText: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 14,
  },

  introCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 18,
    backgroundColor: COLORS.goldSoft,
    marginBottom: 20,
  },

  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  introTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.maroon,
    textAlign: 'center',
  },

  introDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
  },

  videoCount: {
    marginTop: 12,
    color: COLORS.maroon,
    fontSize: 13,
    fontWeight: '700',
  },

  videoCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },

  videoHeader: {
    padding: 18,
  },

  videoTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.maroonDark,
    flexShrink: 1,
  },

  videoDate: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.muted,
  },

  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },

  webview: {
    flex: 1,
    backgroundColor: '#000',
  },

  videoLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },

  videoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 8,
  },

  videoFooterText: {
    color: COLORS.maroon,
    fontSize: 13,
    fontWeight: '600',
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.goldSoft,
    gap: 12,
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.text,
  },

  emptyCard: {
    padding: 30,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    marginTop: 30,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.maroon,
    marginTop: 16,
    textAlign: 'center',
  },

  emptyDescription: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 12,
  },

  retryButton: {
    marginTop: 20,
    backgroundColor: COLORS.maroon,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },

  retryText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});
