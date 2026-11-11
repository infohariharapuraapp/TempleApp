import AutoTranslatedText from '@/components/AutoTranslatedText';

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiRequest } from '@/services/api';

type Tab = 'All' | 'Pravachanas' | 'Guru Vani' | 'Quotes';

type Pravachana = {
  id: number;
  title: string;
  description: string | null;
  youtube_url: string;
  youtube_video_id: string;
  language: string;
  published_at: string | null;
  created_at: string;
};

type GuruVani = {
  id: number;
  title: string;
  sloka: string;
  transliteration: string | null;
  meaning: string | null;
  guru_name: string | null;
  published_at: string;
  is_active: boolean;
};

type Quote = {
  id: number;
  title: string | null;
  quote_text: string;
  author: string | null;
  language: string;
  published_at: string | null;
  created_at: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T[];
  message?: string;
};

type FeedItem =
  | { kind: 'video'; item: Pravachana; date: number }
  | { kind: 'guru'; item: GuruVani; date: number }
  | { kind: 'quote'; item: Quote; date: number };

const C = {
  bg: '#FFF9F0',
  maroon: '#741521',
  dark: '#4F1019',
  gold: '#D6A65B',
  cream: '#FFF2DF',
  white: '#FFFFFF',
  text: '#3F251D',
  muted: '#927D70',
  border: '#EAD9C5',
};

function timestamp(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatDate(value?: string | null) {
  const time = timestamp(value);
  if (!time) return '';

  return new Date(time).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function VideoCard({
  item,
  latest,
}: {
  item: Pravachana;
  latest?: boolean;
}) {
  const [playing, setPlaying] = useState(false);

  const thumbnail =
    `https://img.youtube.com/vi/${item.youtube_video_id}/hqdefault.jpg`;

  const embed =
    `https://www.youtube.com/embed/${item.youtube_video_id}?playsinline=1&rel=0`;

  return (
    <View style={styles.videoCard}>
      <View style={styles.videoFrame}>
        {playing ? (
          <WebView
            key={item.youtube_video_id}
            source={{
              uri: embed,
              headers: {
                Referer:
                  'https://www.divyakshetrahariharapura.com/',
              },
            }}
            originWhitelist={['https://*']}
            style={styles.player}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction
            startInLoadingState
            renderLoading={() => (
              <View style={styles.playerLoading}>
                <ActivityIndicator color={C.gold} size="large" />
              </View>
            )}
          />
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.thumbnailTouch}
            onPress={() => setPlaying(true)}
          >
            <ImageBackground
              source={{ uri: thumbnail }}
              style={styles.thumbnail}
              resizeMode="cover"
            >
              <View style={styles.thumbnailShade} />

              <View style={styles.playCircle}>
                <Ionicons
                  name="play"
                  size={29}
                  color={C.white}
                  style={{ marginLeft: 4 }}
                />
              </View>

              {latest && (
                <View style={styles.latestTag}>
                  <AutoTranslatedText style={styles.latestTagText}>LATEST</AutoTranslatedText>
                </View>
              )}
            </ImageBackground>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle}>{item.title}</Text>

        {!!item.description && (
          <Text
            style={styles.videoDescription}
            numberOfLines={2}
          >
            {item.description}
          </Text>
        )}

        <View style={styles.videoBottom}>
          <View style={styles.dateRow}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={C.gold}
            />
            <Text style={styles.dateText}>
              {formatDate(item.published_at)}
            </Text>
          </View>

          <View style={styles.watchIndicator}>
            <Ionicons
              name="play-circle-outline"
              size={19}
              color={C.maroon}
            />
            <AutoTranslatedText style={styles.watchText}>Watch</AutoTranslatedText>
          </View>
        </View>
      </View>
    </View>
  );
}

function GuruCard({ item }: { item: GuruVani }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.guruCard}
      onPress={() =>
        router.push({
          pathname: '/guru-vani/[id]',
          params: { id: String(item.id) },
        })
      }
    >
      <View style={styles.guruTop}>
        <View style={styles.guruIcon}>
          <Text style={styles.guruOm}>ॐ</Text>
        </View>

        <View style={styles.guruTopText}>
          <AutoTranslatedText style={styles.guruLabel}>GURU VANI</AutoTranslatedText>
          <Text style={styles.guruDate}>
            {formatDate(item.published_at)}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={19}
          color={C.gold}
        />
      </View>

      <Text style={styles.guruTitle}>{item.title}</Text>

      <Text style={styles.guruSloka} numberOfLines={4}>
        {item.sloka}
      </Text>

      {!!item.guru_name && (
        <Text style={styles.guruAuthor}>
          — {item.guru_name}
        </Text>
      )}

      <View style={styles.guruFooter}>
        <AutoTranslatedText style={styles.readTeaching}>Read Teaching</AutoTranslatedText>
        <Ionicons
          name="arrow-forward"
          size={17}
          color={C.maroon}
        />
      </View>
    </TouchableOpacity>
  );
}

function QuoteCard({ item }: { item: Quote }) {
  const quote = item.quote_text.trim();

  const shareQuote = async () => {
    if (!quote) return;

    try {
      await Share.share({
        message:
          `"${quote}"\n\n` +
          `— ${item.author || 'Temple Teachings'}\n\n` +
          'Divyakshetra Hariharapura',
      });
    } catch (error) {
      console.error('Quote sharing error:', error);
    }
  };

  return (
    <LinearGradient
      colors={['#71321F', '#9B512B', '#63251E']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.quoteCard}
    >
      <View style={styles.quoteDecorationTop}>
        <Text style={styles.quoteMark}>“</Text>
        <Text style={styles.quoteSymbol}>ॐ</Text>
      </View>

      <Text style={styles.quoteText}>“{quote}”</Text>

      <Text style={styles.quoteAuthor}>
        — {item.author || 'Temple Teachings'}
      </Text>

      <View style={styles.quoteFooter}>
        <View style={styles.quoteDateRow}>
          <Ionicons
            name="calendar-outline"
            size={13}
            color="#F4D18D"
          />
          <Text style={styles.quoteDate}>
            {formatDate(item.published_at)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={shareQuote}
          style={styles.shareButton}
          accessibilityLabel="Share quote"
        >
          <Ionicons
            name="share-social-outline"
            size={23}
            color="#F7CE83"
          />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

export default function PravachanasScreen() {
  const [tab, setTab] = useState<Tab>('All');
  const [videos, setVideos] = useState<Pravachana[]>([]);
  const [guruVani, setGuruVani] = useState<GuruVani[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      const results = await Promise.allSettled([
        apiRequest<ApiResponse<Pravachana>>('/pravachanas'),
        apiRequest<ApiResponse<GuruVani>>('/guru-vani'),
        apiRequest<ApiResponse<Quote>>('/quotes'),
      ]);

      let successful = 0;

      if (
        results[0].status === 'fulfilled' &&
        results[0].value.success &&
        Array.isArray(results[0].value.data)
      ) {
        setVideos(
          [...results[0].value.data].sort(
            (a, b) =>
              timestamp(b.published_at) -
                timestamp(a.published_at) ||
              b.id - a.id
          )
        );
        successful++;
      } else {
        setVideos([]);
      }

      if (
        results[1].status === 'fulfilled' &&
        results[1].value.success &&
        Array.isArray(results[1].value.data)
      ) {
        setGuruVani(
          [...results[1].value.data].sort(
            (a, b) =>
              timestamp(b.published_at) -
                timestamp(a.published_at) ||
              b.id - a.id
          )
        );
        successful++;
      } else {
        setGuruVani([]);
      }

      if (
        results[2].status === 'fulfilled' &&
        results[2].value.success &&
        Array.isArray(results[2].value.data)
      ) {
        setQuotes(
          [...results[2].value.data].sort(
            (a, b) =>
              timestamp(b.published_at) -
                timestamp(a.published_at) ||
              b.id - a.id
          )
        );
        successful++;
      } else {
        setQuotes([]);
      }

      if (successful === 0) {
        setError('Unable to load content. Please try again.');
      } else if (successful < 3) {
        setError('Some content could not be loaded.');
      }
    } catch (err) {
      console.error('Pravachana & Quotes error:', err);
      setError('Unable to load content. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const feed: FeedItem[] = [
    ...videos.map(
      (item): FeedItem => ({
        kind: 'video',
        item,
        date: timestamp(item.published_at),
      })
    ),
    ...guruVani.map(
      (item): FeedItem => ({
        kind: 'guru',
        item,
        date: timestamp(item.published_at),
      })
    ),
    ...quotes.map(
      (item): FeedItem => ({
        kind: 'quote',
        item,
        date: timestamp(item.published_at),
      })
    ),
  ].sort((a, b) => b.date - a.date);

  const tabs: Tab[] = [
    'All',
    'Pravachanas',
    'Guru Vani',
    'Quotes',
  ];

  const showEmpty =
    tab === 'All'
      ? feed.length === 0
      : tab === 'Pravachanas'
        ? videos.length === 0
        : tab === 'Guru Vani'
          ? guruVani.length === 0
          : quotes.length === 0;

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'bottom']}
    >
      <LinearGradient
        colors={[C.maroon, C.dark]}
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#F9D99B"
          />
        </TouchableOpacity>

        <AutoTranslatedText style={styles.headerTitle}>
          Pravachana & Quotes
        </AutoTranslatedText>

        <View style={styles.headerRight}>
          <Text style={styles.headerOm}>ॐ</Text>
        </View>
      </LinearGradient>

      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {tabs.map((name) => (
            <TouchableOpacity
              key={name}
              activeOpacity={0.8}
              onPress={() => setTab(name)}
              style={[
                styles.tabButton,
                tab === name && styles.activeTab,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === name && styles.activeTabText,
                ]}
              >
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={C.maroon}
          />
          <AutoTranslatedText style={styles.loadingText}>
            Loading divine teachings...
          </AutoTranslatedText>
        </View>
      ) : (
        <ScrollView
          key={tab}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              colors={[C.maroon]}
            />
          }
        >
          {!!error && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{error}</Text>
              <TouchableOpacity onPress={() => loadData()}>
                <AutoTranslatedText style={styles.retryText}>Retry</AutoTranslatedText>
              </TouchableOpacity>
            </View>
          )}

          {showEmpty ? (
            <View style={styles.emptyCard}>
              <Ionicons
                name="book-outline"
                size={42}
                color={C.gold}
              />
              <AutoTranslatedText style={styles.emptyTitle}>
                No content available yet
              </AutoTranslatedText>
              <AutoTranslatedText style={styles.emptyText}>
                New spiritual teachings will appear here
                when published.
              </AutoTranslatedText>
            </View>
          ) : tab === 'All' ? (
            feed.map((entry) => {
              if (entry.kind === 'video') {
                return (
                  <VideoCard
                    key={`video-${entry.item.id}`}
                    item={entry.item}
                    latest={
                      videos.length > 0 &&
                      entry.item.id === videos[0].id
                    }
                  />
                );
              }

              if (entry.kind === 'guru') {
                return (
                  <GuruCard
                    key={`guru-${entry.item.id}`}
                    item={entry.item}
                  />
                );
              }

              return (
                <QuoteCard
                  key={`quote-${entry.item.id}`}
                  item={entry.item}
                />
              );
            })
          ) : tab === 'Pravachanas' ? (
            videos.map((video, index) => (
              <VideoCard
                key={video.id}
                item={video}
                latest={index === 0}
              />
            ))
          ) : tab === 'Guru Vani' ? (
            guruVani.map((item) => (
              <GuruCard key={item.id} item={item} />
            ))
          ) : (
            quotes.map((item) => (
              <QuoteCard key={item.id} item={item} />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 38,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: C.white,
  },
  headerRight: {
    width: 35,
    alignItems: 'flex-end',
  },
  headerOm: {
    fontSize: 24,
    color: '#F4D18D',
  },
  tabsContainer: {
    backgroundColor: C.cream,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tabsRow: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 7,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
  },
  activeTab: {
    backgroundColor: C.maroon,
    borderColor: C.maroon,
    elevation: 3,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.maroon,
  },
  activeTabText: {
    color: C.white,
  },
  content: {
    paddingHorizontal: 13,
    paddingTop: 16,
    paddingBottom: 50,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: C.muted,
    fontSize: 13,
  },
  videoCard: {
    backgroundColor: C.white,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 17,
    elevation: 3,
  },
  videoFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  thumbnailTouch: {
    flex: 1,
  },
  thumbnail: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  playCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: C.white,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  latestTag: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: C.maroon,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  latestTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.white,
  },
  player: {
    flex: 1,
    backgroundColor: '#000',
  },
  playerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  videoInfo: {
    padding: 15,
  },
  videoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.dark,
    lineHeight: 23,
  },
  videoDescription: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 18,
    marginTop: 7,
  },
  videoBottom: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '600',
  },
  watchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  watchText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.maroon,
  },
  guruCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 17,
    marginBottom: 16,
    elevation: 2,
  },
  guruTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guruIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: C.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },
  guruOm: {
    fontSize: 24,
    color: C.maroon,
  },
  guruTopText: {
    flex: 1,
  },
  guruLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '800',
    color: C.gold,
  },
  guruDate: {
    marginTop: 4,
    fontSize: 11,
    color: C.muted,
  },
  guruTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.dark,
    marginTop: 14,
  },
  guruSloka: {
    fontSize: 14,
    lineHeight: 23,
    color: C.text,
    marginTop: 10,
  },
  guruAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: C.maroon,
    marginTop: 12,
  },
  guruFooter: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readTeaching: {
    fontSize: 12,
    fontWeight: '800',
    color: C.maroon,
  },
  quoteCard: {
    borderRadius: 19,
    paddingHorizontal: 21,
    paddingTop: 18,
    paddingBottom: 15,
    marginBottom: 17,
    borderWidth: 1,
    borderColor: '#D5A05C',
    elevation: 4,
  },
  quoteDecorationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  quoteMark: {
    fontSize: 64,
    lineHeight: 65,
    fontWeight: '800',
    color: '#E9BA6C',
  },
  quoteSymbol: {
    fontSize: 25,
    color: '#E9BA6C',
    opacity: 0.7,
  },
  quoteText: {
    fontSize: 18,
    lineHeight: 29,
    fontWeight: '600',
    textAlign: 'center',
    color: C.white,
    marginTop: -8,
  },
  quoteAuthor: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    color: '#F4D18D',
    marginTop: 17,
  },
  quoteFooter: {
    marginTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quoteDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quoteDate: {
    fontSize: 11,
    color: '#F4D18D',
  },
  shareButton: {
    padding: 4,
  },
  notice: {
    backgroundColor: '#FFF0DD',
    padding: 13,
    borderRadius: 12,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: C.dark,
  },
  retryText: {
    fontWeight: '800',
    color: C.maroon,
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 25,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.maroon,
    marginTop: 13,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 9,
  },
});
