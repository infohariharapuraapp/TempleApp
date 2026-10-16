
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

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import {
  apiRequest,
} from '@/services/api';

// ========================================
// TYPES
// ========================================

type Pooja = {
  id: number;
  section_id: number;
  name: string;
  description: string | null;
  price: string | number;
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
  maroonDark: '#541018',
  gold: '#C69A3A',
  cream: '#F8EBD8',
  border: '#E8DCCB',
  text: '#4A2C18',
  muted: '#8E8175',
};

// ========================================
// SCREEN
// ========================================

export default function PoojaDetailsScreen() {
  const { id, name } = useLocalSearchParams<{
    id: string;
    name?: string;
  }>();

  const [poojas, setPoojas] = useState<Pooja[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadPoojas = useCallback(
    async (isRefresh = false) => {
      const sectionId = Number(id);

      if (!Number.isSafeInteger(sectionId) || sectionId <= 0) {
        setError('Invalid pooja section.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const response = await apiRequest<
          ApiResponse<Pooja[]>
        >(`/poojas?section_id=${sectionId}`);

        if (!response.success) {
          throw new Error(
            response.message || 'Unable to load poojas'
          );
        }

      const activePoojas = Array.isArray(response.data)
  ? response.data
  : [];

        setPoojas(
          activePoojas.sort(
            (a, b) =>
              a.display_order - b.display_order ||
              a.id - b.id
          )
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load poojas'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      void loadPoojas();
    }, [loadPoojas])
  );

  const formatPrice = (value: string | number) => {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return 'Price unavailable';
    }

    return `₹${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const openBooking = () => {
    router.push('/pooja-services/booking' as any);
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
              void loadPoojas(true);
            }}
            colors={[COLORS.maroon]}
            tintColor={COLORS.maroon}
          />
        }
      >
        {/* BACK */}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>
            ‹ Back to Pooja Services
          </Text>
        </TouchableOpacity>

        {/* HEADER */}

        <Text style={styles.label}>
          SACRED OFFERINGS
        </Text>

        <Text style={styles.title}>
          {name || 'Temple Poojas'}
        </Text>

        <Text style={styles.subtitle}>
          Explore available poojas and their
          offerings at the temple.
        </Text>

        {/* DIVIDER */}

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.om}>ॐ</Text>
          <View style={styles.divider} />
        </View>

        {/* CONTENT */}

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator
              size="large"
              color={COLORS.maroon}
            />
            <Text style={styles.infoText}>
              Loading poojas...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>
              Unable to load poojas
            </Text>

            <Text style={styles.infoText}>
              {error}
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                void loadPoojas();
              }}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        ) : poojas.length === 0 ? (
          <View style={styles.messageCard}>
            <Text style={styles.emptyIcon}>
              🪔
            </Text>

            <Text style={styles.messageTitle}>
              No Poojas Available
            </Text>

            <Text style={styles.infoText}>
              Poojas for this section will
              be available soon.
            </Text>
          </View>
        ) : (
          <View>
            <Text style={styles.countText}>
              {poojas.length} Pooja
              {poojas.length === 1 ? '' : 's'} Available
            </Text>

            {poojas.map(pooja => (
              <View
                key={pooja.id}
                style={styles.poojaCard}
              >
                <View style={styles.cardTop}>
                  <View style={styles.iconCircle}>
                    <Text style={styles.poojaIcon}>
                      🪔
                    </Text>
                  </View>

                  <View style={styles.cardHeader}>
                    <Text style={styles.poojaName}>
                      {pooja.name}
                    </Text>

                    <Text style={styles.price}>
                      {formatPrice(pooja.price)}
                    </Text>
                  </View>
                </View>

                {pooja.description ? (
                  <Text style={styles.description}>
                    {pooja.description}
                  </Text>
                ) : null}

                <View style={styles.cardDivider} />

                <TouchableOpacity
                  style={styles.bookButton}
                  activeOpacity={0.85}
                  onPress={openBooking}
                >
                  <Text style={styles.bookButtonText}>
                    Book Pooja
                  </Text>

                  <Text style={styles.bookArrow}>
                    →
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* OFFLINE BOOKING */}

        <View style={styles.offlineCard}>
          <Text style={styles.offlineTitle}>
            🛕 Offline Booking Available
          </Text>

          <Text style={styles.offlineText}>
            Devotees can book poojas directly
            at the temple Seva Counter.
            Please contact the counter for
            availability and assistance.
          </Text>
        </View>

        {/* ONLINE BOOKING */}

        <View style={styles.onlineCard}>
          <Text style={styles.onlineTitle}>
            Online Pooja Booking
          </Text>

          <Text style={styles.onlineText}>
            Continue to the official temple
            booking website to select your
            pooja and complete the booking.
          </Text>

          <TouchableOpacity
            style={styles.onlineButton}
            onPress={openBooking}
          >
            <Text style={styles.onlineButtonText}>
              Proceed to Booking
            </Text>

            <Text style={styles.onlineArrow}>
              →
            </Text>
          </TouchableOpacity>
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
    alignSelf: 'flex-start',
    marginBottom: 20,
  },

  backText: {
    fontSize: 14,
    color: COLORS.maroon,
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
    fontSize: 28,
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

  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    marginBottom: 15,
  },

  poojaCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 3,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  poojaIcon: {
    fontSize: 25,
  },

  cardHeader: {
    flex: 1,
  },

  poojaName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },

  price: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.maroon,
    marginTop: 5,
  },

  description: {
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.muted,
    marginTop: 14,
  },

  cardDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },

  bookButton: {
    backgroundColor: COLORS.maroon,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  bookButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },

  bookArrow: {
    color: COLORS.white,
    fontSize: 20,
  },

  offlineCard: {
    backgroundColor: COLORS.cream,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 15,
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

  onlineCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 16,
  },

  onlineTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.maroon,
  },

  onlineText: {
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.muted,
    marginTop: 8,
    marginBottom: 15,
  },

  onlineButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  onlineButtonText: {
    color: COLORS.maroonDark,
    fontSize: 13,
    fontWeight: '800',
  },

  onlineArrow: {
    color: COLORS.maroonDark,
    fontSize: 20,
  },
});
