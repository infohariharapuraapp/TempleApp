
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { apiRequest } from '@/services/api';

type Status = 'upcoming' | 'ongoing' | 'completed';

type Programme = {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  youtube_url: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  venue: string | null;
  status: Status;
  is_published: boolean;
  created_at: string;
};

const COLORS = {
  background: '#FBF7F0',
  white: '#FFFFFF',
  maroon: '#6B1720',
  gold: '#C69A3A',
  text: '#352218',
  muted: '#76665D',
  border: '#E9DED2',
  cream: '#F8EBD8',
};

const TABS: { key: Status; title: string }[] = [
  { key: 'upcoming', title: 'Upcoming' },
  { key: 'ongoing', title: 'Ongoing' },
  { key: 'completed', title: 'Completed' },
];

function getYouTubeId(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    let id: string | null | undefined = null;

    if (host === 'youtu.be' || host === 'www.youtu.be') {
      id = parsed.pathname.split('/')[1];
    } else if (
      ['youtube.com', 'www.youtube.com', 'm.youtube.com']
        .includes(host)
    ) {
      id = parsed.pathname === '/watch'
        ? parsed.searchParams.get('v')
        : parsed.pathname.match(
            /^\/(?:embed|shorts|live)\/([^/]+)/
          )?.[1];
    }

    return id && /^[a-zA-Z0-9_-]{11}$/.test(id)
      ? id
      : null;
  } catch {
    return null;
  }
}

function formatDate(date: string | null) {
  if (!date) return '';

  const value = date.slice(0, 10);
  const parts = value.split('-');

  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}


function formatTime(time: string | null) {
  if (!time) return '';

  const parts = time.split(':');
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return '';
  }

  // Do not display 00:00 or 00:00:00.
  if (hour === 0 && minute === 0) {
    return '';
  }

  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;

  return `${h}:${String(minute).padStart(2, '0')} ${suffix}`;
}


// ========================================
// PROGRAMME CARD
// ========================================

function ProgrammeCard({ item }: { item: Programme }) {
  const [expanded, setExpanded] = useState(false);

  const videoId = getYouTubeId(item.youtube_url);

  // Uploaded image has priority over YouTube thumbnail.
  const thumbnail =
    item.image_url?.trim() ||
    (videoId
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : null);

  const hasSchedule =
    item.start_date ||
    item.start_time ||
    item.end_date ||
    item.end_time;

  const openDetails = () => {
    router.push({
      pathname: '/mahaswamiji-programmes/[id]',
      params: { id: String(item.id) },
    });
  };

  return (
    <View style={styles.card}>
      {/* Clickable programme poster */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={openDetails}
        accessibilityRole="button"
        accessibilityLabel={`View ${item.title} details`}
      >
        {thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={['#6B1720', '#9B4B1E']}
            style={styles.posterPlaceholder}
          >
            <Text style={styles.placeholderOm}>ॐ</Text>
            <Text style={styles.placeholderText}>
              MAHASWAMIJI PROGRAMMES
            </Text>
          </LinearGradient>
        )}
      </TouchableOpacity>

      <View style={styles.cardBody}>
        <View style={styles.badgeRow}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {item.status.toUpperCase()}
            </Text>
          </View>

          {videoId && (
            <View style={styles.videoBadge}>
              <Text style={styles.videoBadgeText}>
                ▶ VIDEO
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={openDetails}
        >
          <Text style={styles.cardTitle}>
            {item.title}
          </Text>
        </TouchableOpacity>

        <Text
          style={styles.description}
          numberOfLines={expanded ? undefined : 4}
        >
          {item.description}
        </Text>

        {item.description.length > 150 && (
          <TouchableOpacity
            onPress={() => setExpanded(!expanded)}
            style={styles.readMoreButton}
          >
            <Text style={styles.readMore}>
              {expanded ? 'Show Less' : 'Read More'}
            </Text>
          </TouchableOpacity>
        )}

        {hasSchedule && (
          <View style={styles.infoSection}>
            <Text style={styles.infoHeading}>
              PROGRAMME SCHEDULE
            </Text>

            {(item.start_date || item.start_time) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📅</Text>

                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>
                    Starts
                  </Text>

                  <Text style={styles.infoValue}>
                    {[
                      formatDate(item.start_date),
                      formatTime(item.start_time),
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </Text>
                </View>
              </View>
            )}

            {(item.end_date || item.end_time) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>🕒</Text>

                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>
                    Ends
                  </Text>

                  <Text style={styles.infoValue}>
                    {[
                      formatDate(item.end_date),
                      formatTime(item.end_time),
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {item.venue && (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>

            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                Venue
              </Text>

              <Text style={styles.infoValue}>
                {item.venue}
              </Text>
            </View>
          </View>
        )}

        {/* Every programme opens the details screen */}
        <View style={styles.detailsSection}>
          <TouchableOpacity
            style={styles.videoButton}
            onPress={openDetails}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.videoButtonText}>
              View Programme Details
            </Text>

            <Text style={styles.buttonArrow}>
              →
            </Text>
          </TouchableOpacity>

          {videoId && (
            <Text style={styles.videoHint}>
              Programme video available in details
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ========================================
// MAIN SCREEN
// ========================================

export default function MahaswamijiProgrammesScreen() {
  const [items, setItems] = useState<Programme[]>([]);
  const [activeTab, setActiveTab] =
    useState<Status>('upcoming');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadProgrammes = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(false);

        const response = await apiRequest<{
          success: boolean;
          data: Programme[];
        }>('/mahaswamiji-programmes');

        if (
          !response.success ||
          !Array.isArray(response.data)
        ) {
          throw new Error('Invalid programme response');
        }

        setItems(
          response.data.filter(
            (item) => item.is_published
          )
        );
      } catch (err) {
        console.error(
          'Mahaswamiji Programmes error:',
          err
        );
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void loadProgrammes();
    }, [loadProgrammes])
  );

  const filtered = items
    .filter((item) => item.status === activeTab)
    .sort((a, b) => {
      const aDate = a.start_date?.slice(0, 10) || '';
      const bDate = b.start_date?.slice(0, 10) || '';

      if (aDate && bDate && aDate !== bDate) {
        return activeTab === 'completed'
          ? bDate.localeCompare(aDate)
          : aDate.localeCompare(bDate);
      }

      if (aDate && !bDate) return -1;
      if (!aDate && bDate) return 1;

      return b.id - a.id;
    });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              void loadProgrammes(true)
            }
            colors={[COLORS.maroon]}
            tintColor={COLORS.maroon}
          />
        }
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>
            ← Back
          </Text>
        </TouchableOpacity>

        {/* Hero banner */}
        <LinearGradient
          colors={['#6B1720', '#9B4B1E']}
          style={styles.hero}
        >
          <Text style={styles.heroIcon}>ॐ</Text>

          <Text style={styles.heroEyebrow}>
            DIVINE PROGRAMMES
          </Text>

          <Text style={styles.heroTitle}>
            Mahaswamiji{'\n'}Programmes
          </Text>

          <Text style={styles.heroSubtitle}>
            Stay connected with sacred gatherings,
            spiritual discourses and programmes
            of Mahaswamiji.
          </Text>

          <View style={styles.heroLine} />
        </LinearGradient>

        {/* Programme status tabs */}
        <View style={styles.tabs}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                activeTab === tab.key &&
                  styles.activeTab,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key &&
                    styles.activeTabText,
                ]}
              >
                {tab.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.headingRow}>
          <View>
            <Text style={styles.sectionEyebrow}>
              SPIRITUAL GATHERINGS
            </Text>

            <Text style={styles.sectionTitle}>
              {TABS.find(
                (tab) => tab.key === activeTab
              )?.title}{' '}
              Programmes
            </Text>
          </View>

          {!loading && !error && (
            <Text style={styles.count}>
              {filtered.length}
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator
              size="large"
              color={COLORS.maroon}
            />

            <Text style={styles.stateText}>
              Loading programmes...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateIcon}>
              ⚠️
            </Text>

            <Text style={styles.stateText}>
              Unable to load programmes.
              Please try again.
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() =>
                void loadProgrammes()
              }
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateIcon}>
              🙏
            </Text>

            <Text style={styles.emptyTitle}>
              No {activeTab} programmes
            </Text>

            <Text style={styles.stateText}>
              Programme information will appear here
              when published by the temple administration.
            </Text>
          </View>
        ) : (
          filtered.map((item) => (
            <ProgrammeCard
              key={item.id}
              item={item}
            />
          ))
        )}
      </ScrollView>
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
  content: {
    padding: 18,
    paddingBottom: 50,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 9,
    marginBottom: 12,
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.maroon,
  },
  hero: {
    borderRadius: 26,
    padding: 25,
    marginBottom: 24,
    overflow: 'hidden',
  },
  heroIcon: {
    fontSize: 40,
    color: '#F4D18D',
    marginBottom: 15,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F4D18D',
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontSize: 29,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 9,
    lineHeight: 38,
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 21,
    color: '#F7E3D9',
    marginTop: 12,
  },
  heroLine: {
    width: 65,
    height: 3,
    backgroundColor: COLORS.gold,
    borderRadius: 5,
    marginTop: 22,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F1E7DA',
    padding: 5,
    borderRadius: 16,
    marginBottom: 25,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: COLORS.maroon,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },
  activeTabText: {
    color: COLORS.white,
  },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sectionEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: COLORS.gold,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 6,
  },
  count: {
    color: COLORS.maroon,
    fontWeight: '800',
    fontSize: 13,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    elevation: 3,
  },
  poster: {
    width: '100%',
    height: 210,
  },
  posterPlaceholder: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderOm: {
    fontSize: 48,
    color: '#F4D18D',
  },
  placeholderText: {
    color: '#F4D18D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 10,
  },
  cardBody: {
    padding: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    backgroundColor: COLORS.cream,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.maroon,
  },
  videoBadge: {
    backgroundColor: '#FDEAE8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  videoBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B52B2B',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 28,
  },
  description: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 22,
    marginTop: 10,
  },
  readMoreButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  readMore: {
    color: COLORS.maroon,
    fontSize: 12,
    fontWeight: '800',
  },
  infoSection: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  infoHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 1,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 20,
  },
  detailsSection: {
    marginTop: 12,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  videoButton: {
    backgroundColor: COLORS.maroon,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  videoButtonText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
  },
  buttonArrow: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
  },
  videoHint: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 10,
  },
  stateCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 30,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stateIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  stateText: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 18,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});
