import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
} from 'react-native';

import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';

// ========================================
// TYPES
// ========================================

export type EventVideo = {
  id: number;
  title?: string | null;
  youtube_url: string;
  youtube_video_id: string;
  display_order: number;
};

type Props = {
  videos?: EventVideo[];
};

// ========================================
// MULTILINGUAL LABELS
// ========================================

const LABELS = {
  en: {
    heading: 'Event Videos',
    video: 'Video',
    play: 'Watch Video',
    close: 'Close Video',
    loading: 'Loading video...',
    error: 'Unable to load video',
    retry: 'Try Again',
    youtube: 'Watch on YouTube',
  },

  te: {
    heading: 'కార్యక్రమ వీడియోలు',
    video: 'వీడియో',
    play: 'వీడియో చూడండి',
    close: 'వీడియో మూసివేయండి',
    loading: 'వీడియో లోడ్ అవుతోంది...',
    error: 'వీడియోను లోడ్ చేయలేకపోయాము',
    retry: 'మళ్లీ ప్రయత్నించండి',
    youtube: 'యూట్యూబ్‌లో చూడండి',
  },

  kn: {
    heading: 'ಕಾರ್ಯಕ್ರಮದ ವೀಡಿಯೊಗಳು',
    video: 'ವೀಡಿಯೊ',
    play: 'ವೀಡಿಯೊ ವೀಕ್ಷಿಸಿ',
    close: 'ವೀಡಿಯೊ ಮುಚ್ಚಿ',
    loading: 'ವೀಡಿಯೊ ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
    error: 'ವೀಡಿಯೊ ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ',
    retry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
    youtube: 'ಯೂಟ್ಯೂಬ್‌ನಲ್ಲಿ ವೀಕ್ಷಿಸಿ',
  },

  hi: {
    heading: 'कार्यक्रम के वीडियो',
    video: 'वीडियो',
    play: 'वीडियो देखें',
    close: 'वीडियो बंद करें',
    loading: 'वीडियो लोड हो रहा है...',
    error: 'वीडियो लोड नहीं हो सका',
    retry: 'पुनः प्रयास करें',
    youtube: 'यूट्यूब पर देखें',
  },

  ta: {
    heading: 'நிகழ்ச்சி வீடியோக்கள்',
    video: 'வீடியோ',
    play: 'வீடியோ பார்க்கவும்',
    close: 'வீடியோவை மூடவும்',
    loading: 'வீடியோ ஏற்றப்படுகிறது...',
    error: 'வீடியோவை ஏற்ற முடியவில்லை',
    retry: 'மீண்டும் முயற்சிக்கவும்',
    youtube: 'யூடியூபில் பார்க்கவும்',
  },
};

type SupportedLanguage = keyof typeof LABELS;

// ========================================
// VALIDATION
// ========================================

function isValidVideoId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    /^[A-Za-z0-9_-]{11}$/.test(id)
  );
}

// ========================================
// COMPONENT
// ========================================

export default function EventVideos({
  videos,
}: Props) {
  const { i18n } = useTranslation();

  const language = (
    i18n.resolvedLanguage ||
    i18n.language ||
    'en'
  ).split('-')[0] as SupportedLanguage;

  const labels = LABELS[language] || LABELS.en;

  const [activeVideoId, setActiveVideoId] =
    useState<number | null>(null);

  const [playerLoading, setPlayerLoading] =
    useState(false);

  const [playerError, setPlayerError] =
    useState(false);

  const [playerKey, setPlayerKey] =
    useState(0);

  const validVideos = Array.isArray(videos)
    ? [...videos]
        .filter(video =>
          isValidVideoId(video.youtube_video_id)
        )
        .sort(
          (a, b) =>
            a.display_order - b.display_order ||
            a.id - b.id
        )
    : [];

  // Stop playback if event videos change.
  useEffect(() => {
    setActiveVideoId(null);
    setPlayerLoading(false);
    setPlayerError(false);
  }, [videos]);

  if (validVideos.length === 0) {
    return null;
  }

  function playVideo(videoId: number) {
    setPlayerError(false);
    setPlayerLoading(true);
    setPlayerKey(previous => previous + 1);
    setActiveVideoId(videoId);
  }

  function closeVideo() {
    setActiveVideoId(null);
    setPlayerLoading(false);
    setPlayerError(false);
  }

  function retryVideo() {
    setPlayerError(false);
    setPlayerLoading(true);
    setPlayerKey(previous => previous + 1);
  }

  async function openYouTube(videoId: string) {
    closeVideo();

    try {
      await Linking.openURL(
        `https://www.youtube.com/watch?v=${videoId}`
      );
    } catch (error) {
      console.warn(
        'Unable to open YouTube:',
        error
      );
    }
  }

  return (
    <View style={styles.section}>
      {/* SECTION HEADER */}

      <View style={styles.sectionHeader}>
        <View style={styles.headingRow}>
          <View style={styles.headingIcon}>
            <Text style={styles.headingIconText}>
              ▶
            </Text>
          </View>

          <Text style={styles.heading}>
            {labels.heading}
          </Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {validVideos.length}
          </Text>
        </View>
      </View>

      {/* VIDEO CARDS */}

      {validVideos.map((video, index) => {
        const isPlaying =
          activeVideoId === video.id;

        const videoTitle =
          video.title?.trim() ||
          `${labels.video} ${index + 1}`;

        const thumbnail =
          `https://i.ytimg.com/vi/` +
          `${video.youtube_video_id}/hqdefault.jpg`;

        const embedUrl =
          `https://www.youtube.com/embed/` +
          `${video.youtube_video_id}` +
          `?playsinline=1&rel=0`;

        return (
          <View
            key={video.id}
            style={styles.videoCard}
          >
            {/* THUMBNAIL OR PLAYER */}

            {isPlaying ? (
              <View style={styles.playerContainer}>
                {playerError ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorIcon}>
                      !
                    </Text>

                    <Text style={styles.errorText}>
                      {labels.error}
                    </Text>

                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={retryVideo}
                    >
                      <Text style={styles.retryText}>
                        {labels.retry}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <WebView
                      key={
                        `${video.id}-${playerKey}`
                      }
                      source={{
                        uri: embedUrl,
                        headers: {
                          Referer: 'https://hariharapura-temple-admin.onrender.com/',
                        },
                      }}
                      style={styles.webView}
                      javaScriptEnabled
                      domStorageEnabled
                      allowsFullscreenVideo
                      allowsInlineMediaPlayback
                      mediaPlaybackRequiresUserAction
                      onLoadStart={() =>
                        setPlayerLoading(true)
                      }
                      onLoadEnd={() =>
                        setPlayerLoading(false)
                      }
                      onError={() => {
                        setPlayerLoading(false);
                        setPlayerError(true);
                      }}
                      onHttpError={({ nativeEvent }) => {
                        if (
                          nativeEvent.url === embedUrl
                        ) {
                          setPlayerLoading(false);
                          setPlayerError(true);
                        }
                      }}
                    />

                    {playerLoading && (
                      <View
                        pointerEvents="none"
                        style={styles.loadingOverlay}
                      >
                        <ActivityIndicator
                          size="large"
                          color="#C69A3A"
                        />

                        <Text
                          style={styles.loadingText}
                        >
                          {labels.loading}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() =>
                  playVideo(video.id)
                }
                accessibilityRole="button"
                accessibilityLabel={
                  `${labels.play}: ${videoTitle}`
                }
                style={styles.thumbnailContainer}
              >
                <Image
                  source={{ uri: thumbnail }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />

                <View style={styles.thumbnailOverlay} />

                <View style={styles.playButton}>
                  <Text style={styles.playIcon}>
                    ▶
                  </Text>
                </View>

                <View style={styles.youtubeBadge}>
                  <Text
                    style={styles.youtubeBadgeText}
                  >
                    YouTube
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* VIDEO TITLE AND BUTTONS */}

            <View style={styles.videoBody}>
              <Text style={styles.videoTitle}>
                {videoTitle}
              </Text>

              {isPlaying ? (
                <>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={closeVideo}
                  >
                    <Text style={styles.closeText}>
                      ■  {labels.close}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() =>
                      void openYouTube(
                        video.youtube_video_id
                      )
                    }
                    style={styles.externalButton}
                  >
                    <Text style={styles.externalText}>
                      {labels.youtube} ↗
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.watchButton}
                  onPress={() =>
                    playVideo(video.id)
                  }
                >
                  <Text style={styles.watchText}>
                    ▶  {labels.play}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  section: {
    marginTop: 26,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 10,
  },

  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 9,
  },

  headingIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#F8EBDC',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headingIconText: {
    color: '#8B4513',
    fontSize: 15,
  },

  heading: {
    color: '#4A2C18',
    fontSize: 18,
    fontWeight: '800',
    flexShrink: 1,
  },

  countBadge: {
    backgroundColor: '#F8EBDC',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 15,
  },

  countText: {
    color: '#8B4513',
    fontWeight: '700',
    fontSize: 12,
  },

  videoCard: {
    borderWidth: 1,
    borderColor: '#E8DCCB',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFDF8',
    marginBottom: 16,
  },

  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#251C17',
    justifyContent: 'center',
    alignItems: 'center',
  },

  thumbnail: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },

  thumbnailOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  playButton: {
    backgroundColor: '#E62117',
    width: 66,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },

  playIcon: {
    color: '#FFFFFF',
    fontSize: 24,
    marginLeft: 3,
  },

  youtubeBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },

  youtubeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  playerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
  },

  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#171717',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 12,
  },

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },

  errorIcon: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
  },

  errorText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 8,
  },

  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#8B4513',
  },

  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  videoBody: {
    padding: 14,
  },

  videoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A2C18',
    lineHeight: 23,
    marginBottom: 12,
  },

  watchButton: {
    backgroundColor: '#8B4513',
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: 9,
    alignItems: 'center',
  },

  watchText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },

  closeButton: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#D9C7B5',
    alignItems: 'center',
    backgroundColor: '#FFF8EC',
  },

  closeText: {
    color: '#8B4513',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },

  externalButton: {
    alignItems: 'center',
    paddingTop: 13,
    paddingBottom: 3,
  },

  externalText: {
    color: '#8B4513',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});