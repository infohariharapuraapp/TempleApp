
import React, {
  useEffect,
  useCallback,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTranslation } from 'react-i18next';

import {
  apiRequest,
  API_BASE_URL,
} from '@/services/api';

type DarshanVideo = {
  id: number;
  title: string;
  description?: string | null;
  label: 'live' | 'watch';
  url: string;
  thumbnail_url?: string | null;
  is_active: boolean;
};

export default function DarshanVideosScreen() {

  const { t, i18n } = useTranslation();
  // DARSHAN_VIDEOS_LANGUAGE_V2
  const language = (
    i18n.resolvedLanguage ||
    i18n.language ||
    'en'
  ).split('-')[0];
  const requestId = useRef(0);

  const [videos, setVideos] =
    useState<DarshanVideo[]>([]);

  const [loading, setLoading] =
    useState(true);


  const loadVideos = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      setLoading(true);
      const response = await apiRequest<{
        success: boolean;
        data: DarshanVideo[];
      }>(
        `/darshan-videos?lang=${encodeURIComponent(language)}`
      );
      if (currentRequest !== requestId.current) {
        return;
      }
      if (
        response.success &&
        Array.isArray(response.data)
      ) {
        setVideos(response.data);
      } else {
        setVideos([]);
      }
    } catch (error) {
      if (currentRequest !== requestId.current) {
        return;
      }
      console.error(
        'Darshan Videos error:',
        error
      );
      setVideos([]);
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, [language]);
  useEffect(() => {
    void loadVideos();
    return () => {
      requestId.current++;
    };
  }, [loadVideos]);
  const getYoutubeThumbnail = (url: string) => {

    try {

      const match = url.match(
        /(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/)|youtu\.be\/)([^&?/]+)/i
      );

      if (match?.[1]) {
        return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
      }

    } catch (error) {

      console.error(
        'YouTube thumbnail error:',
        error
      );

    }

    return '';

  };

  const getThumbnail = (video: DarshanVideo) => {

    if (video.thumbnail_url) {

      if (
        video.thumbnail_url.startsWith('http')
      ) {
        return video.thumbnail_url;
      }

      return `${API_BASE_URL.replace(/\/api\/?$/, '')}${
        video.thumbnail_url.startsWith('/') ? '' : '/'
      }${video.thumbnail_url}`;

    }

    return getYoutubeThumbnail(video.url);

  };

  const openVideo = async (url: string) => {

    try {

      await Linking.openURL(url);

    } catch (error) {

      console.error(
        'Unable to open YouTube video:',
        error
      );

    }

  };

  const renderVideo = ({
    item,
  }: {
    item: DarshanVideo;
  }) => {

    const thumbnail = getThumbnail(item);

    return (

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => openVideo(item.url)}
      >

        <View style={styles.imageContainer}>

          {thumbnail ? (

            <Image
              source={{ uri: thumbnail }}
              style={styles.thumbnail}
              resizeMode="cover"
            />

          ) : (

            <View style={styles.noImage}>

              <Text style={styles.noImageText}>
                YouTube
              </Text>

            </View>

          )}

          <View
            style={[
              styles.label,
              item.label === 'live' &&
                styles.liveLabel,
            ]}
          >

            <Text style={styles.labelText}>
              {item.label === 'live'
                ? t('darshanVideos.live')
                : t('darshanVideos.watch')}
            </Text>

          </View>

          <View style={styles.playButton}>

            <Text style={styles.playIcon}>
              ▶
            </Text>

          </View>

        </View>

        <View style={styles.content}>

          <Text
            style={styles.title}
            numberOfLines={2}
          >
            {item.title}
          </Text>

          {item.description ? (

            <Text
              style={styles.description}
              numberOfLines={3}
            >
              {item.description}
            </Text>

          ) : null}

          <Text style={styles.watchNow}>
            {t('darshanVideos.watchNow')} →
          </Text>

        </View>

      </TouchableOpacity>

    );

  };

  if (loading) {

    return (

      <View style={styles.center}>

        <ActivityIndicator
          size="large"
          color="#6B1720"
        />

        <Text style={styles.loadingText}>
          {t('darshanVideos.loading')}
        </Text>

      </View>

    );

  }

  return (

    <View style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.headerTitle}>
          {t('darshanVideos.title')}
        </Text>

        <Text style={styles.headerSubtitle}>
          {t('darshanVideos.subtitle')}
        </Text>

      </View>

      {videos.length === 0 ? (

        <View style={styles.empty}>

          <Text style={styles.emptyTitle}>
            {t('darshanVideos.emptyTitle')}
          </Text>

          <Text style={styles.emptyText}>
            {t('darshanVideos.emptyText')}
          </Text>

        </View>

      ) : (

        <FlatList
          data={videos}
          extraData={language}
          keyExtractor={(item) =>
            String(item.id)
          }
          renderItem={renderVideo}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />

      )}

    </View>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#FFFDF8',
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 18,
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#6B1720',
  },

  headerSubtitle: {
    marginTop: 5,
    fontSize: 14,
    color: '#8E8175',
  },

  list: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },

  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#EEE5D8',
    position: 'relative',
  },

  thumbnail: {
    width: '100%',
    height: '100%',
  },

  noImage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8DCCB',
  },

  noImageText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6B1720',
  },

  label: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#6B1720',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  liveLabel: {
    backgroundColor: '#B3261E',
  },

  labelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  playButton: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 52,
    height: 52,
    marginLeft: -26,
    marginTop: -26,
    borderRadius: 26,
    backgroundColor: 'rgba(107, 23, 32, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  playIcon: {
    color: '#FFFFFF',
    fontSize: 21,
    marginLeft: 3,
  },

  content: {
    padding: 15,
  },

  title: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    color: '#3E2925',
  },

  description: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: '#766860',
  },

  watchNow: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '800',
    color: '#6B1720',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF8',
  },

  loadingText: {
    marginTop: 12,
    color: '#6B1720',
    fontSize: 14,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6B1720',
    textAlign: 'center',
  },

  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#8E8175',
    fontSize: 14,
    lineHeight: 20,
  },

});
