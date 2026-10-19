
import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/services/api';

type Announcement = {
  id?: number;
  title: string;
  message: string;
  image_url?: string | null;
};

export default function AnnouncementsScreen() {
  const { t } = useTranslation();

  const { id } = useLocalSearchParams<{
    id?: string;
  }>();

  const [announcement, setAnnouncement] =
    useState<Announcement | null>(null);

  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    loadAnnouncement();
  }, [id]);

  async function loadAnnouncement() {
    try {
      setLoading(true);
      setAnnouncement(null);
      setImageError(false);

      if (id) {
        const response = await apiRequest<{
          success: boolean;
          data: Announcement;
        }>(
          `/announcements/${encodeURIComponent(id)}`
        );

        if (response.success) {
          setAnnouncement(response.data);
        }
      }
    } catch (error) {
      console.error(
        'Load announcement error:',
        error
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#6B1720"
        />

        <Text style={styles.statusText}>
          {t('announcements.loading')}
        </Text>
      </View>
    );
  }

  if (!announcement) {
    return (
      <View style={styles.center}>
        <Text style={styles.statusText}>
          {t('announcements.notFound')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>
        {announcement.title}
      </Text>

      {announcement.image_url && !imageError && (
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri: announcement.image_url,
            }}
            style={styles.image}
            resizeMode="contain"
            onError={(event) => {
              console.error(
                'Announcement image loading failed:',
                event.nativeEvent.error
              );
              setImageError(true);
            }}
          />
        </View>
      )}

      <Text style={styles.message}>
        {announcement.message}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFDF8',
  },

  container: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFFDF8',
  },

  statusText: {
    fontSize: 15,
    color: '#6B1720',
    textAlign: 'center',
    marginTop: 12,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 20,
  },

  imageContainer: {
    width: '100%',
    height: 240,
    backgroundColor: '#F7EBD7',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 22,
  },

  image: {
    width: '100%',
    height: '100%',
  },

  message: {
    fontSize: 17,
    lineHeight: 27,
    color: '#3D332D',
  },
});
