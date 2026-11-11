
import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { apiRequest } from '@/services/api';

// ========================================
// TYPES
// ========================================

type Announcement = {
  id: number;
  title: string;
  message: string;
  image_url?: string | null;
  category?: string | null;
  is_pinned?: boolean;
  attachment_url?: string | null;
  publish_at?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

const COLORS = {
  maroon: '#6B1720',
  dark: '#541018',
  gold: '#C69A3A',
  goldSoft: '#D8B766',
  cream: '#FFFDF8',
  paleGold: '#F7EBD7',
  border: '#E8DCCB',
  text: '#342725',
  muted: '#88766B',
  white: '#FFFFFF',
};

const CATEGORIES = [
  'All',
  'General',
  'Festivals',
  'Poojas',
  'Sevas',
  'Important Notices',
  'Special Events',
];

// ========================================
// HELPERS
// ========================================

function formatDate(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isValidHttpUrl(value?: string | null) {
  if (!value) return false;

  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' ||
      url.protocol === 'http:'
    );
  } catch {
    return false;
  }
}

function announcementDate(item: Announcement) {
  return formatDate(
    item.publish_at || item.created_at
  );
}

// ========================================
// MAIN SCREEN
// ========================================

export default function AnnouncementsScreen() {
  const { t } = useTranslation();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const id = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const detailMode = Boolean(id);

  const [items, setItems] = useState<Announcement[]>([]);
  const [announcement, setAnnouncement] =
    useState<Announcement | null>(null);

  const [category, setCategory] = useState('All');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [error, setError] = useState('');

  // ========================================
  // LOAD ANNOUNCEMENTS
  // ========================================

  const loadData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError('');
        setImageError(false);

        if (id) {
          // Existing push-notification detail route.
          const response = await apiRequest<
            ApiResponse<Announcement>
          >(
            `/announcements/${encodeURIComponent(id)}`
          );

          if (response.success && response.data) {
            setAnnouncement(response.data);
          } else {
            setAnnouncement(null);
            setError('Announcement not found.');
          }
        } else {
          // New Divyakshetra Updates listing.
          const response = await apiRequest<
            ApiResponse<Announcement[]>
          >('/announcements');

          if (response.success) {
            setItems(
              Array.isArray(response.data)
                ? response.data
                : []
            );
          } else {
            setError(
              response.message ||
              'Unable to load updates.'
            );
          }
        }
      } catch (err) {
        console.error(
          'Load Divyakshetra Updates error:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load temple updates.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ========================================
  // NAVIGATION
  // ========================================

  function openAnnouncement(item: Announcement) {
    router.push({
      pathname: '/announcements',
      params: {
        id: String(item.id),
      },
    });
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  // ========================================
  // OPEN PDF
  // ========================================

  async function openAttachment(url: string) {
    if (!isValidHttpUrl(url)) {
      setError('Invalid attachment URL.');
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error('Open PDF error:', err);
      setError('Unable to open PDF attachment.');
    }
  }

  // ========================================
  // SHARE ANNOUNCEMENT
  // ========================================

  async function shareAnnouncement(item: Announcement) {
    try {
      const text = [
        item.title,
        '',
        item.message,
        '',
        item.attachment_url || '',
        '',
        'Divyakshetra Hariharapura',
      ]
        .filter(Boolean)
        .join('\n');

      await Share.share({
        message: text,
        title: item.title,
      });
    } catch (err) {
      console.error('Share announcement error:', err);
    }
  }

  // ========================================
  // FILTER
  // ========================================

  const filteredItems = items
    .filter(item => {
      return (
        category === 'All' ||
        (item.category || 'General') === category
      );
    })
    .sort((a, b) => {
      if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) {
        return a.is_pinned ? -1 : 1;
      }

      const aDate = new Date(
        a.publish_at || a.created_at || 0
      ).getTime();

      const bDate = new Date(
        b.publish_at || b.created_at || 0
      ).getTime();

      return bDate - aDate;
    });

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.maroon}
        />

        <Text style={styles.statusText}>
          {t('announcements.loading', {
            defaultValue: 'Loading temple updates...',
          })}
        </Text>
      </View>
    );
  }

  // ========================================
  // DETAIL VIEW
  // ========================================

  if (detailMode) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={COLORS.white}
            />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.headerEyebrow}>
              DIVYAKSHETRA HARIHARAPURA
            </Text>

            <Text style={styles.headerTitle}>
              Update Details
            </Text>
          </View>
        </View>

        {!announcement ? (
          <View style={styles.center}>
            <Ionicons
              name="document-text-outline"
              size={46}
              color={COLORS.gold}
            />

            <Text style={styles.statusText}>
              {error ||
                t('announcements.notFound', {
                  defaultValue:
                    'Announcement not found.',
                })}
            </Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => void loadData()}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={styles.screen}
            contentContainerStyle={
              styles.detailContainer
            }
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void loadData(true)}
                tintColor={COLORS.maroon}
              />
            }
          >
            <View style={styles.detailCard}>
              <View style={styles.badgeRow}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>
                    {announcement.category || 'General'}
                  </Text>
                </View>

                {announcement.is_pinned && (
                  <View style={styles.pinnedBadge}>
                    <Ionicons
                      name="pin"
                      size={12}
                      color="#8A5A11"
                    />

                    <Text style={styles.pinnedText}>
                      Important
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.detailTitle}>
                {announcement.title}
              </Text>

              {!!announcementDate(announcement) && (
                <View style={styles.dateRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color={COLORS.muted}
                  />

                  <Text style={styles.dateText}>
                    {announcementDate(announcement)}
                  </Text>
                </View>
              )}

              {isValidHttpUrl(
                announcement.image_url
              ) &&
                !imageError && (
                  <View style={styles.detailImageBox}>
                    <Image
                      source={{
                        uri: announcement.image_url!,
                      }}
                      style={styles.detailImage}
                      resizeMode="contain"
                      onError={() =>
                        setImageError(true)
                      }
                    />
                  </View>
                )}

              <View style={styles.goldDivider} />

              <Text style={styles.sectionHeading}>
                Announcement Details
              </Text>

              <Text style={styles.detailMessage}>
                {announcement.message}
              </Text>

              {isValidHttpUrl(
                announcement.attachment_url
              ) && (
                <Pressable
                  style={styles.pdfButton}
                  onPress={() =>
                    void openAttachment(
                      announcement.attachment_url!
                    )
                  }
                >
                  <Ionicons
                    name="document-text-outline"
                    size={21}
                    color={COLORS.white}
                  />

                  <Text style={styles.pdfButtonText}>
                    View PDF Attachment
                  </Text>

                  <Ionicons
                    name="open-outline"
                    size={18}
                    color={COLORS.white}
                  />
                </Pressable>
              )}

              <Pressable
                style={styles.shareButton}
                onPress={() =>
                  void shareAnnouncement(announcement)
                }
              >
                <Ionicons
                  name="share-social-outline"
                  size={20}
                  color={COLORS.maroon}
                />

                <Text style={styles.shareButtonText}>
                  Share Update
                </Text>
              </Pressable>
            </View>

            <Text style={styles.footerText}>
              Divyakshetra Hariharapura
            </Text>
          </ScrollView>
        )}
      </View>
    );
  }

  // ========================================
  // LIST VIEW
  // ========================================

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={COLORS.white}
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerEyebrow}>
            DIVYAKSHETRA HARIHARAPURA
          </Text>

          <Text style={styles.headerTitle}>
            Divyakshetra Updates
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadData(true)}
            tintColor={COLORS.maroon}
          />
        }
      >
        {/* INTRODUCTION */}

        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons
              name="megaphone-outline"
              size={25}
              color={COLORS.goldSoft}
            />
          </View>

          <Text style={styles.introTitle}>
            Temple News & Announcements
          </Text>

          <Text style={styles.introDescription}>
            Stay connected with festivals, poojas,
            sevas, special programmes and important
            updates from Divyakshetra Hariharapura.
          </Text>
        </View>

        {/* CATEGORY FILTERS */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryList}
        >
          {CATEGORIES.map(item => {
            const selected = category === item;

            return (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={[
                  styles.categoryChip,
                  selected &&
                    styles.categoryChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selected &&
                      styles.categoryChipTextSelected,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.listHeadingRow}>
          <Text style={styles.listHeading}>
            {category === 'All'
              ? 'Latest Updates'
              : category}
          </Text>

          <Text style={styles.resultCount}>
            {filteredItems.length} updates
          </Text>
        </View>

        {error ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="alert-circle-outline"
              size={38}
              color={COLORS.maroon}
            />

            <Text style={styles.emptyText}>
              {error}
            </Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => void loadData()}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="newspaper-outline"
              size={42}
              color={COLORS.gold}
            />

            <Text style={styles.emptyTitle}>
              No Updates Available
            </Text>

            <Text style={styles.emptyText}>
              New temple announcements will appear
              here when published.
            </Text>
          </View>
        ) : (
          filteredItems.map(item => (
            <Pressable
              key={item.id}
              style={styles.updateCard}
              onPress={() => openAnnouncement(item)}
            >
              {isValidHttpUrl(item.image_url) ? (
                <Image
                  source={{
                    uri: item.image_url!,
                  }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons
                    name="notifications-outline"
                    size={40}
                    color={COLORS.goldSoft}
                  />

                  <Text style={styles.placeholderText}>
                    DIVYAKSHETRA
                  </Text>
                </View>
              )}

              <View style={styles.cardContent}>
                <View style={styles.badgeRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>
                      {item.category || 'General'}
                    </Text>
                  </View>

                  {item.is_pinned && (
                    <View style={styles.pinnedBadge}>
                      <Ionicons
                        name="pin"
                        size={12}
                        color="#8A5A11"
                      />

                      <Text style={styles.pinnedText}>
                        Pinned
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  style={styles.cardTitle}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>

                <Text
                  style={styles.cardMessage}
                  numberOfLines={3}
                >
                  {item.message}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.dateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={COLORS.muted}
                    />

                    <Text style={styles.dateText}>
                      {announcementDate(item)}
                    </Text>
                  </View>

                  <View style={styles.readMore}>
                    <Text style={styles.readMoreText}>
                      Read More
                    </Text>

                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color={COLORS.maroon}
                    />
                  </View>
                </View>
              </View>
            </Pressable>
          ))
        )}

        <Text style={styles.footerText}>
          Divyakshetra Hariharapura
        </Text>
      </ScrollView>
    </View>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.cream,
  },

  statusText: {
    marginTop: 12,
    color: COLORS.maroon,
    fontSize: 15,
    textAlign: 'center',
  },

  header: {
    backgroundColor: COLORS.maroon,
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerText: {
    flex: 1,
  },

  headerEyebrow: {
    color: '#E8C980',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 5,
  },

  headerTitle: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: '800',
  },

  listContainer: {
    paddingBottom: 35,
  },

  introCard: {
    backgroundColor: COLORS.dark,
    margin: 16,
    padding: 22,
    borderRadius: 20,
    alignItems: 'flex-start',
  },

  introIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  introTitle: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 9,
  },

  introDescription: {
    color: '#F0DDD7',
    fontSize: 13,
    lineHeight: 21,
  },

  categoryScroll: {
    marginBottom: 20,
  },

  categoryList: {
    paddingHorizontal: 16,
    gap: 9,
  },

  categoryChip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },

  categoryChipSelected: {
    backgroundColor: COLORS.maroon,
    borderColor: COLORS.maroon,
  },

  categoryChipText: {
    color: COLORS.maroon,
    fontSize: 12,
    fontWeight: '700',
  },

  categoryChipTextSelected: {
    color: COLORS.white,
  },

  listHeadingRow: {
    paddingHorizontal: 17,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  listHeading: {
    color: COLORS.maroon,
    fontSize: 19,
    fontWeight: '800',
  },

  resultCount: {
    color: COLORS.muted,
    fontSize: 12,
  },

  updateCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 17,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#321B12',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  cardImage: {
    width: '100%',
    height: 190,
    backgroundColor: COLORS.paleGold,
  },

  placeholderImage: {
    height: 130,
    backgroundColor: COLORS.dark,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  placeholderText: {
    color: COLORS.goldSoft,
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 12,
  },

  cardContent: {
    padding: 17,
  },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 13,
  },

  categoryBadge: {
    backgroundColor: COLORS.paleGold,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  categoryBadgeText: {
    color: '#80591C',
    fontSize: 11,
    fontWeight: '800',
  },

  pinnedBadge: {
    backgroundColor: '#FFF0D1',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  pinnedText: {
    color: '#8A5A11',
    fontSize: 11,
    fontWeight: '700',
  },

  cardTitle: {
    color: COLORS.maroon,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 25,
    marginBottom: 9,
  },

  cardMessage: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 15,
  },

  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },

  dateText: {
    color: COLORS.muted,
    fontSize: 12,
  },

  readMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  readMoreText: {
    color: COLORS.maroon,
    fontWeight: '800',
    fontSize: 12,
  },

  detailContainer: {
    padding: 16,
    paddingBottom: 36,
  },

  detailCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 19,
  },

  detailTitle: {
    color: COLORS.maroon,
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: 12,
  },

  detailImageBox: {
    width: '100%',
    height: 280,
    backgroundColor: COLORS.paleGold,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 20,
  },

  detailImage: {
    width: '100%',
    height: '100%',
  },

  goldDivider: {
    width: 55,
    height: 3,
    backgroundColor: COLORS.gold,
    borderRadius: 4,
    marginBottom: 18,
  },

  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.maroon,
    marginBottom: 12,
  },

  detailMessage: {
    fontSize: 16,
    lineHeight: 27,
    color: COLORS.text,
    marginBottom: 24,
  },

  pdfButton: {
    backgroundColor: COLORS.maroon,
    padding: 16,
    borderRadius: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },

  pdfButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },

  shareButton: {
    backgroundColor: COLORS.paleGold,
    padding: 15,
    borderRadius: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
  },

  shareButtonText: {
    color: COLORS.maroon,
    fontSize: 14,
    fontWeight: '800',
  },

  emptyCard: {
    marginHorizontal: 16,
    padding: 30,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.maroon,
    marginTop: 13,
  },

  emptyText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 10,
  },

  retryButton: {
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 18,
  },

  retryText: {
    color: COLORS.white,
    fontWeight: '700',
  },

  footerText: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
