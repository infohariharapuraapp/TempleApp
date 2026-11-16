import React, {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from 'react-native';

import {
  useLocalSearchParams,
} from 'expo-router';

import { useTranslation } from 'react-i18next';

import {
  DarshanVideo,
  DarshanVideoCategory,
  fetchDarshanVideoData,
  getDarshanVideoLabels,
  buildDarshanVideoFilters,
  filterDarshanVideos,
  getDarshanVideoThumbnail,
  getYoutubeThumbnail,
} from '@/services/darshanVideos';

// ========================================
// COLORS
// ========================================

const COLORS = {
  background: '#FFFDF8',
  maroon: '#6B1720',
  gold: '#C69A3A',
  cream: '#F7EBD7',
  white: '#FFFFFF',
  text: '#3E2925',
  muted: '#8E8175',
  border: '#E8DCCB',
  live: '#B3261E',
};

// ========================================
// VIDEO THUMBNAIL COMPONENT
// ========================================

function VideoThumbnail({
  video,
}: {
  video: DarshanVideo;
}) {
  const primaryThumbnail =
    getDarshanVideoThumbnail(video);

  const fallbackThumbnail =
    getYoutubeThumbnail(video.url);

  const [uri, setUri] = useState(
    primaryThumbnail
  );

  useEffect(() => {
    setUri(primaryThumbnail);
  }, [primaryThumbnail, video.id]);

  function handleImageError() {
    if (
      fallbackThumbnail &&
      uri !== fallbackThumbnail
    ) {
      setUri(fallbackThumbnail);
    } else {
      setUri('');
    }
  }

  if (!uri) {
    return (
      <View style={styles.noImage}>
        <Text style={styles.noImageIcon}>
          ▶
        </Text>

        <Text style={styles.noImageText}>
          YouTube
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.thumbnail}
      resizeMode="cover"
      onError={handleImageError}
    />
  );
}

// ========================================
// MAIN SCREEN
// ========================================

export default function DarshanVideosScreen() {
  const { t, i18n } = useTranslation();

  const params = useLocalSearchParams<{
    category?: string;
  }>();

  // ========================================
  // LANGUAGE
  // ========================================

  const language = (
    i18n.resolvedLanguage ||
    i18n.language ||
    'en'
  ).split('-')[0];

  const labels =
    getDarshanVideoLabels(language);

  const requestId = useRef(0);

  // ========================================
  // STATES
  // ========================================

  const [videos, setVideos] =
    useState<DarshanVideo[]>([]);

  const [categories, setCategories] =
    useState<DarshanVideoCategory[]>([]);

  const [selectedCategory, setSelectedCategory] =
    useState(params.category || 'all');

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState(false);

  // ========================================
  // RECEIVE CATEGORY FROM HOME SCREEN
  // ========================================

  useEffect(() => {
    setSelectedCategory(
      params.category || 'all'
    );
  }, [params.category]);

  // ========================================
  // LOAD DATA
  // ========================================

  const loadVideos = useCallback(
    async (isRefresh = false) => {
      const currentRequest =
        ++requestId.current;

      try {
        setError(false);

        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const result =
          await fetchDarshanVideoData(
            language
          );

        if (
          currentRequest !==
          requestId.current
        ) {
          return;
        }

        setVideos(result.videos);

        setCategories(result.categories);
      } catch (err) {
        if (
          currentRequest !==
          requestId.current
        ) {
          return;
        }

        console.error(
          'Darshan Videos error:',
          err
        );

        setError(true);

        // Keep previously loaded videos
        // when a refresh request fails.

        if (!isRefresh) {
          setVideos([]);
          setCategories([]);
        }
      } finally {
        if (
          currentRequest ===
          requestId.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [language]
  );

  useEffect(() => {
    void loadVideos();

    return () => {
      requestId.current++;
    };
  }, [loadVideos]);

  // ========================================
  // DYNAMIC CATEGORY FILTERS
  // ========================================

  const filters = useMemo(
    () =>
      buildDarshanVideoFilters(
        videos,
        categories,
        language
      ),
    [videos, categories, language]
  );

  // Reset invalid category selection after
  // category deletion or deactivation.

  useEffect(() => {
    if (loading || refreshing) {
      return;
    }

    const exists = filters.some(
      (filter) =>
        filter.id === selectedCategory
    );

    if (!exists) {
      setSelectedCategory('all');
    }
  }, [
    filters,
    selectedCategory,
    loading,
    refreshing,
  ]);

  // ========================================
  // FILTER VIDEOS
  // ========================================

  const filteredVideos = useMemo(
    () =>
      filterDarshanVideos(
        videos,
        selectedCategory
      ),
    [videos, selectedCategory]
  );

  const selectedCategoryName =
    selectedCategory === 'all'
      ? labels.allVideos
      : filters.find(
          (filter) =>
            filter.id === selectedCategory
        )?.name || labels.allVideos;

  // ========================================
  // OPEN VIDEO
  // ========================================

  const openVideo = async (url: string) => {
    try {
      if (!/^https?:\/\//i.test(url)) {
        throw new Error('Invalid video URL');
      }

      await Linking.openURL(url);
    } catch (err) {
      console.error(
        'Unable to open video:',
        err
      );

      Alert.alert(labels.openError);
    }
  };

  // ========================================
  // RENDER VIDEO CARD
  // ========================================

  const renderVideo = ({
    item,
  }: {
    item: DarshanVideo;
  }) => {
    const isLive = item.label === 'live';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => openVideo(item.url)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        {/* VIDEO THUMBNAIL */}

        <View style={styles.imageContainer}>
          <VideoThumbnail video={item} />

          {/* VIDEO LABEL */}

          <View
            style={[
              styles.label,
              isLive && styles.liveLabel,
            ]}
          >
            {isLive && (
              <View style={styles.liveDot} />
            )}

            <Text style={styles.labelText}>
              {isLive
                ? t('darshanVideos.live')
                : t('darshanVideos.watch')}
            </Text>
          </View>

          {/* PLAY BUTTON */}

          <View style={styles.playButton}>
            <Text style={styles.playIcon}>
              ▶
            </Text>
          </View>
        </View>

        {/* VIDEO CONTENT */}

        <View style={styles.content}>

          {/* CATEGORY NAME */}

          {!!item.category_name && (
            <View style={styles.categoryBadge}>
              <View
                style={styles.categoryBadgeDot}
              />

              <Text
                style={styles.categoryBadgeText}
              >
                {item.category_name}
              </Text>
            </View>
          )}

          {/* VIDEO TITLE */}

          <Text
            style={styles.title}
            numberOfLines={2}
          >
            {item.title}
          </Text>

          {/* DESCRIPTION */}

          {!!item.description && (
            <Text
              style={styles.description}
              numberOfLines={3}
            >
              {item.description}
            </Text>
          )}

          {/* WATCH BUTTON */}

          <View style={styles.watchButton}>
            <Text style={styles.watchIcon}>
              ▶
            </Text>

            <Text style={styles.watchNow}>
              {t('darshanVideos.watchNow')}
            </Text>

            <Text style={styles.watchArrow}>
              →
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ========================================
  // LOADING SCREEN
  // ========================================

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.maroon}
        />

        <Text style={styles.loadingText}>
          {t('darshanVideos.loading')}
        </Text>
      </View>
    );
  }

  // ========================================
  // MAIN UI
  // ========================================

  return (
    <View style={styles.container}>

      {/* HEADER */}

      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {t('darshanVideos.title')}
        </Text>

        <Text style={styles.headerSubtitle}>
          {t('darshanVideos.subtitle')}
        </Text>

        <View style={styles.goldLine} />
      </View>

      {/* CATEGORY FILTERS */}

      <View style={styles.categorySection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={
            styles.categoryList
          }
        >
          {filters.map((filter) => {
            const active =
              selectedCategory === filter.id;

            const isLive =
              filter.id === 'live';

            return (
              <TouchableOpacity
                key={filter.id}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{
                  selected: active,
                }}
                onPress={() =>
                  setSelectedCategory(filter.id)
                }
                style={[
                  styles.categoryChip,

                  active &&
                    styles.categoryChipActive,
                ]}
              >
                {isLive && (
                  <View
                    style={[
                      styles.filterLiveDot,

                      active && {
                        backgroundColor:
                          COLORS.white,
                      },
                    ]}
                  />
                )}

                <Text
                  style={[
                    styles.categoryChipText,

                    active &&
                      styles.categoryChipTextActive,
                  ]}
                >
                  {filter.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* CATEGORY HEADING */}

      <View style={styles.resultsHeader}>
        <Text
          style={styles.resultsTitle}
          numberOfLines={2}
        >
          {selectedCategoryName}
        </Text>

        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {filteredVideos.length}{' '}
            {labels.videos}
          </Text>
        </View>
      </View>

      {/* ERROR MESSAGE */}

      {error && videos.length > 0 && (
        <TouchableOpacity
          style={styles.errorBanner}
          onPress={() => loadVideos(true)}
        >
          <Text style={styles.errorBannerText}>
            {labels.error} {labels.retry} ↻
          </Text>
        </TouchableOpacity>
      )}

      {/* VIDEOS LIST */}

      <FlatList
        data={filteredVideos}
        extraData={language}
        keyExtractor={(item) =>
          String(item.id)
        }
        renderItem={renderVideo}
        contentContainerStyle={[
          styles.list,

          filteredVideos.length === 0 &&
            styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadVideos(true)}
            colors={[COLORS.maroon]}
            tintColor={COLORS.maroon}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>
                {error ? '↻' : '▶'}
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              {error
                ? labels.error
                : t('darshanVideos.emptyTitle')}
            </Text>

            {!error && (
              <Text style={styles.emptyText}>
                {selectedCategory === 'all'
                  ? t(
                      'darshanVideos.emptyText'
                    )
                  : labels.noCategoryVideos}
              </Text>
            )}

            {error && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() =>
                  loadVideos(true)
                }
              >
                <Text
                  style={styles.retryButtonText}
                >
                  {labels.retry}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
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
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 16,
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.maroon,
  },

  headerSubtitle: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
  },

  goldLine: {
    marginTop: 14,
    width: 46,
    height: 3,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
  },

  // CATEGORY FILTERS

  categorySection: {
    paddingBottom: 12,
  },

  categoryList: {
    paddingHorizontal: 16,
    gap: 9,
    alignItems: 'center',
  },

  categoryChip: {
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: '#EAD9BA',
    borderRadius: 24,
    paddingHorizontal: 17,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  categoryChipActive: {
    backgroundColor: COLORS.maroon,
    borderColor: COLORS.maroon,
  },

  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.maroon,
  },

  categoryChipTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },

  filterLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.live,
  },

  // RESULTS HEADING

  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 7,
    paddingBottom: 15,
  },

  resultsTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.maroon,
  },

  countBadge: {
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  countText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.maroon,
  },

  // VIDEO LIST

  list: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  emptyList: {
    flexGrow: 1,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginBottom: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.cream,
  },

  noImageIcon: {
    color: COLORS.maroon,
    fontSize: 30,
    marginBottom: 8,
  },

  noImageText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.maroon,
  },

  // VIDEO LABEL

  label: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  liveLabel: {
    backgroundColor: COLORS.live,
  },

  liveDot: {
    width: 6,
    height: 6,
    backgroundColor: COLORS.white,
    borderRadius: 3,
  },

  labelText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },

  // PLAY BUTTON

  playButton: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 54,
    height: 54,
    marginLeft: -27,
    marginTop: -27,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(107,23,32,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  playIcon: {
    color: COLORS.white,
    fontSize: 21,
    marginLeft: 3,
  },

  // VIDEO CONTENT

  content: {
    padding: 16,
  },

  categoryBadge: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: COLORS.cream,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },

  categoryBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
  },

  categoryBadgeText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.maroon,
  },

  title: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
    color: COLORS.text,
  },

  description: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    color: '#766860',
  },

  // WATCH BUTTON

  watchButton: {
    marginTop: 15,
    backgroundColor: COLORS.maroon,
    borderRadius: 11,
    paddingVertical: 13,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  watchIcon: {
    color: COLORS.white,
    fontSize: 13,
  },

  watchNow: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },

  watchArrow: {
    fontSize: 18,
    color: COLORS.white,
  },

  // LOADING

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.maroon,
    fontSize: 14,
  },

  // EMPTY STATE

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingVertical: 45,
  },

  emptyIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  emptyIconText: {
    fontSize: 27,
    color: COLORS.maroon,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.maroon,
    textAlign: 'center',
  },

  emptyText: {
    marginTop: 9,
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
  },

  // ERROR AND RETRY

  retryButton: {
    backgroundColor: COLORS.maroon,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 20,
  },

  retryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },

  errorBanner: {
    backgroundColor: '#FDECEC',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    padding: 12,
  },

  errorBannerText: {
    color: COLORS.live,
    fontSize: 13,
    textAlign: 'center',
  },
});