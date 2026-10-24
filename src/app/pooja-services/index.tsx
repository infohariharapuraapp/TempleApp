
import { useTranslation } from 'react-i18next';

import React, {
  useCallback,
  useState,
} from 'react';
import {
  Image,
  useWindowDimensions,
} from 'react-native';

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  apiRequest,
} from '@/services/api';

// ========================================
// TYPES
// ========================================

type PoojaSection = {
  id: number;
  name: string;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

// ========================================
// COLORS
// ========================================

const COLORS = {
  background: '#FFF9F0',
  white: '#FFFFFF',
  maroon: '#6B1720',
  gold: '#C69A3A',
  cream: '#F8EBD8',
  border: '#E8DCCB',
  text: '#4A2C18',
  muted: '#8E8175',
};

// ========================================
// SCREEN
// ========================================

export default function PoojaServicesScreen() {
  const { t } = useTranslation();
    const { width } = useWindowDimensions();


  const [sections, setSections] =
    useState<PoojaSection[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const loadSections = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const response = await apiRequest<
          ApiResponse<PoojaSection[]>
        >('/poojas/sections');

        if (!response.success) {
          throw new Error(
            response.message ||
              t('poojaServices.loadError')
          );
        }

        setSections(
  Array.isArray(response.data)
    ? response.data
    : []
);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('poojaServices.loadError')
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t]
  );

  useFocusEffect(
    useCallback(() => {
      void loadSections();
    }, [loadSections])
  );

  const openSection = (section: PoojaSection) => {
    router.push({
      pathname: '/pooja-services/[id]',
      params: {
        id: String(section.id),
        name: section.name,
      },
    } as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void loadSections(true);
            }}
            colors={[COLORS.maroon]}
            tintColor={COLORS.maroon}
          />
        }
      >
        {/* HEADER */}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>
            ‹ {t('poojaServices.back')}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>
          {t('poojaServices.templeRituals')}
        </Text>

        <Text style={styles.title}>
          Pooja Services
        </Text>

        <Text style={styles.subtitle}>
          {t('poojaServices.subtitle')}
        </Text>

        {/* DECORATION */}

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.om}>ॐ</Text>
          <View style={styles.divider} />
        </View>

        {/* LOADING */}

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator
              size="large"
              color={COLORS.maroon}
            />
            <Text style={styles.infoText}>
              {t('poojaServices.loading')}
            </Text>
          </View>
        ) : error ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>
              {t('poojaServices.loadErrorTitle')}
            </Text>
            <Text style={styles.infoText}>
              {error}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                void loadSections();
              }}
            >
              <Text style={styles.retryText}>
                {t('poojaServices.retry')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.messageCard}>
            <Text style={styles.emptyIcon}>
              🪔
            </Text>
            <Text style={styles.messageTitle}>
              {t('poojaServices.emptyTitle')}
            </Text>
            <Text style={styles.infoText}>
              {t('poojaServices.emptyText')}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
        {sections.map(section => (
  <TouchableOpacity
    key={section.id}
    style={styles.card}
    activeOpacity={0.85}
    onPress={() => openSection(section)}
  >
    <View style={styles.imageWrap}>
      {section.image_url ? (
        <Image
          source={{ uri: section.image_url }}
          style={styles.image}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.placeholderIcon}>
            🪔
          </Text>
        </View>
      )}
    </View>

    <View style={styles.cardBody}>
      <Text
        style={styles.cardTitle}
        numberOfLines={3}
      >
        {section.name}
      </Text>

      <View style={styles.exploreRow}>
        <Text style={styles.exploreText}>
          {t('poojaServices.explore')}
        </Text>

        <Text style={styles.arrow}>
          →
        </Text>
      </View>
    </View>
  </TouchableOpacity>
))}
          </View>
        )}

        {/* OFFLINE BOOKING INFO */}

        <View style={styles.offlineCard}>
          <Text style={styles.offlineTitle}>
            🛕 {t('poojaServices.offlineTitle')}
          </Text>

          <Text style={styles.offlineText}>
            {t('poojaServices.offlineText')}
          </Text>
        </View>
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
    padding: 20,
    paddingBottom: 45,
  },

  backButton: {
    marginBottom: 18,
    alignSelf: 'flex-start',
  },

  backText: {
    color: COLORS.maroon,
    fontSize: 15,
    fontWeight: '700',
  },

  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: COLORS.gold,
    marginBottom: 8,
  },

  title: {
    fontSize: 29,
    fontWeight: '800',
    color: COLORS.maroon,
  },

  subtitle: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORS.muted,
    marginTop: 8,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },

  om: {
    fontSize: 23,
    color: COLORS.gold,
    marginHorizontal: 15,
  },

  center: {
    alignItems: 'center',
    paddingVertical: 45,
  },

  infoText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 10,
  },

  messageCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  messageTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.maroon,
    textAlign: 'center',
  },

  emptyIcon: {
    fontSize: 38,
    marginBottom: 15,
  },

  retryButton: {
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 18,
  },

  retryText: {
    color: COLORS.white,
    fontWeight: '700',
  },

grid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  gap: 10,
},

 card: {
  width: '48%',
  backgroundColor: '#FFFFFF',
  borderRadius: 18,
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: '#E8DCCB',
  elevation: 3,
  marginBottom: 10,
},

imageWrap: {
  width: '100%',
  aspectRatio: 0.67,
  backgroundColor: '#FFFFFF',
  overflow: 'hidden',
},

image: {
  width: '100%',
  height: '100%',
},

  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderIcon: {
    fontSize: 42,
  },

  cardBody: {
    padding: 12,

     minHeight: 95,
  justifyContent: 'space-between',
  },

 cardTitle: {
  fontSize: 13,
  fontWeight: '800',
  color: '#4A2C18',
  lineHeight: 19,
},
exploreRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 12,
},

  exploreText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.maroon,
  },

  arrow: {
    fontSize: 17,
    color: COLORS.gold,
    fontWeight: '800',
  },

  offlineCard: {
    backgroundColor: '#F8EBD8',
    padding: 18,
    borderRadius: 16,
    marginTop: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  offlineTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.maroon,
  },

  offlineText: {
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.text,
    marginTop: 8,
  },
});
