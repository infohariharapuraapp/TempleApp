
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
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
};

const C = {
  bg: '#FFF9F0',
  maroon: '#6B1720',
  dark: '#4F1019',
  gold: '#C69A3A',
  text: '#352218',
  muted: '#76665D',
  border: '#E9DED2',
  white: '#FFFFFF',
};

function youtubeId(url: string | null): string | null {
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

function formatDate(value: string | null) {
  if (!value) return '';

  const date = value.slice(0, 10).split('-');

  return date.length === 3
    ? `${date[2]}/${date[1]}/${date[0]}`
    : value;
}

function formatTime(value: string | null) {
  if (!value) return '';

  const [h, m] = value.split(':').map(Number);

  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return value;
  }

  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${
    h >= 12 ? 'PM' : 'AM'
  }`;
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  if (!value) return null;

  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={20} color={C.maroon} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProgrammeDetails() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [programme, setProgramme] =
    useState<Programme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);

  const load = useCallback(async () => {
    if (!id || !/^\d+$/.test(id)) {
      setError('Invalid programme.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      setPlaying(false);

      const response = await apiRequest<{
        success: boolean;
        data: Programme;
      }>(`/mahaswamiji-programmes/${id}`);

      if (!response.success || !response.data) {
        throw new Error('Programme not found');
      }

      setProgramme(response.data);
    } catch (err) {
      console.error('Programme details error:', err);
      setError('Unable to load programme details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => setPlaying(false);
    }, [load])
  );

  const videoId = youtubeId(programme?.youtube_url || null);

  const poster = programme?.image_url ||
    (videoId
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : null);

  const starts = programme
    ? [
        formatDate(programme.start_date),
        formatTime(programme.start_time),
      ].filter(Boolean).join(' • ')
    : '';

  const ends = programme
    ? [
        formatDate(programme.end_date),
        formatTime(programme.end_time),
      ].filter(Boolean).join(' • ')
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={23} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Programme Details</Text>
        <Text style={styles.om}>ॐ</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.maroon} />
          <Text style={styles.muted}>Loading programme...</Text>
        </View>
      ) : error || !programme ? (
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={C.maroon}
          />
          <Text style={styles.muted}>
            {error || 'Programme not found.'}
          </Text>
          <TouchableOpacity onPress={() => void load()}>
            <Text style={styles.retry}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.card}>
            {poster ? (
              <Image
                source={{ uri: poster }}
                style={styles.poster}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={[C.maroon, '#9B4B1E']}
                style={styles.placeholder}
              >
                <Text style={styles.placeholderOm}>ॐ</Text>
                <Text style={styles.placeholderLabel}>
                  MAHASWAMIJI PROGRAMMES
                </Text>
              </LinearGradient>
            )}

            <View style={styles.body}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {programme.status.toUpperCase()}
                </Text>
              </View>

              <Text style={styles.title}>{programme.title}</Text>

              <View style={styles.separator} />

              <Text style={styles.sectionTitle}>
                About the Programme
              </Text>

              <Text style={styles.description}>
                {programme.description}
              </Text>

              {!!(starts || ends || programme.venue) && (
                <>
                  <View style={styles.separator} />
                  <Text style={styles.sectionTitle}>
                    Programme Information
                  </Text>

                  <InfoRow
                    icon="calendar-outline"
                    label="Starts"
                    value={starts}
                  />
                  <InfoRow
                    icon="time-outline"
                    label="Ends"
                    value={ends}
                  />
                  <InfoRow
                    icon="location-outline"
                    label="Venue"
                    value={programme.venue || ''}
                  />
                </>
              )}

              {videoId && (
                <>
                  <View style={styles.separator} />

                  <Text style={styles.sectionTitle}>
                    Watch Programme Video
                  </Text>

                  <Text style={styles.videoHint}>
                    Watch the programme within the app.
                  </Text>

                  <View style={styles.videoFrame}>
                    {playing ? (
                      <WebView
                        key={videoId}
                        source={{
                          uri: `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0`,
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
                          <View style={styles.center}>
                            <ActivityIndicator
                              size="large"
                              color={C.gold}
                            />
                          </View>
                        )}
                      />
                    ) : (
                      <TouchableOpacity
                        style={styles.videoPreview}
                        activeOpacity={0.85}
                        onPress={() => setPlaying(true)}
                      >
                        <Image
                          source={{
                            uri: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                          }}
                          style={styles.videoThumbnail}
                        />
                        <View style={styles.playButton}>
                          <Ionicons
                            name="play"
                            size={30}
                            color={C.white}
                          />
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>

                  {playing && (
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => setPlaying(false)}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={20}
                        color={C.maroon}
                      />
                      <Text style={styles.closeText}>
                        Close Video
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
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
    height: 66,
    backgroundColor: C.maroon,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 42,
  },
  headerTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '800',
    color: C.white,
  },
  om: {
    fontSize: 25,
    color: '#F4D18D',
  },
  content: {
    padding: 16,
    paddingBottom: 50,
  },
  center: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  muted: {
    color: C.muted,
    textAlign: 'center',
  },
  retry: {
    color: C.maroon,
    fontWeight: '800',
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    elevation: 3,
  },
  poster: {
    width: '100%',
    height: 240,
  },
  placeholder: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderOm: {
    fontSize: 55,
    color: '#F4D18D',
  },
  placeholderLabel: {
    color: '#F4D18D',
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '800',
  },
  body: {
    padding: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F8EBD8',
    marginBottom: 15,
  },
  badgeText: {
    color: C.maroon,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 34,
    color: C.text,
  },
  separator: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 22,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.maroon,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 25,
    color: C.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8EBD8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: C.muted,
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    lineHeight: 21,
  },
  videoHint: {
    color: C.muted,
    fontSize: 12,
    marginBottom: 14,
  },
  videoFrame: {
    height: 205,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
 videoThumbnail: {
  ...StyleSheet.absoluteFill,
  width: '100%',
  height: '100%',
},
  playButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  player: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
    padding: 12,
  },
  closeText: {
    color: C.maroon,
    fontWeight: '800',
  },
});
