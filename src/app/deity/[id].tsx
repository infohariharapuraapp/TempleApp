
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

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
import { useTranslation } from 'react-i18next';

import { apiRequest } from '@/services/api';

// ========================================
// TYPES
// ========================================

type Deity = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  deity_type?: 'individual' | 'group';
  parent_deity_id?: number | null;
  display_order?: number;
  sub_deities?: Deity[];
  significance?: string | null;
  devotional?: string | null;
};

type DeityResponse = {
  success: boolean;
  data: Deity;
};

// ========================================
// DEITY DETAILS SCREEN
// ========================================

export default function DeityDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { t } = useTranslation();

  const [deity, setDeity] = useState<Deity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isGroup = deity?.deity_type === 'group';

  // ========================================
  // LOAD DEITY DETAILS
  // ========================================

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError(t('deities.detailsNotFoundMessage'));
      return;
    }

    let active = true;

    async function loadDeity() {
      try {
        setLoading(true);
        setError('');
        setDeity(null);

        const result = await apiRequest<DeityResponse>(
          `/deities/${id}`
        );

        if (!active) return;

        if (result.success && result.data) {
          setDeity(result.data);
        } else {
          setError(t('deities.detailsNotFoundMessage'));
        }
      } catch (err) {
        console.error('Deity details API error:', err);

        if (active) {
          setError(t('deities.detailsLoadError'));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDeity();

    return () => {
      active = false;
    };
  }, [id, t]);

  // ========================================
  // LOADING SCREEN
  // ========================================

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator
            size="large"
            color="#8B4513"
          />

          <Text style={styles.loadingText}>
            {t('deities.detailsLoading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ========================================
  // NOT FOUND SCREEN
  // ========================================

  if (error || !deity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundIcon}>
            🙏
          </Text>

          <Text style={styles.notFoundTitle}>
            {t('deities.detailsNotFound')}
          </Text>

          <Text style={styles.notFoundText}>
            {error || t('deities.detailsNotFoundMessage')}
          </Text>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>
              {t('deities.detailsGoBack')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ========================================
  // MAIN SCREEN
  // ========================================

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* TOP BAR */}

        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('deities.detailsGoBack')}
          >
            <Text style={styles.backIcon}>
              ‹
            </Text>
          </TouchableOpacity>

          <Text style={styles.topBarTitle}>
            {isGroup
              ? t('deities.groupLabel')
              : t('deities.detailsTitle')}
          </Text>

          <View style={styles.topBarSpacer} />
        </View>

        {/* DEITY IMAGE */}

        <View style={styles.imageContainer}>
          {deity.image_url ? (
            <Image
              source={{ uri: deity.image_url }}
              style={styles.deityImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderIcon}>
                🛕
              </Text>
            </View>
          )}

          <View style={styles.imageOverlay}>
            <Text style={styles.overlayOm}>
              ॐ
            </Text>
          </View>
        </View>

        {/* DEITY NAME */}

        <View style={styles.titleContainer}>
          <Text style={styles.deityName}>
            {deity.name}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.subtitle}>
            {isGroup
              ? t('deities.detailsGroupSubtitle')
              : t('deities.detailsIndividualSubtitle')}
          </Text>
        </View>

        {/* ABOUT */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('deities.detailsAbout')}
          </Text>

          <Text style={styles.sectionText}>
            {deity.description?.trim() ||
              t('deities.detailsDescriptionFallback')}
          </Text>
        </View>

        {/* SUB-DEITIES FOR GROUPS */}

        {isGroup ? (
          <View style={styles.childrenSection}>
            <Text style={styles.childrenHeading}>
              {t('deities.detailsExploreHeading')}
            </Text>

            <Text style={styles.childrenIntro}>
              {t('deities.detailsExploreIntro')}
            </Text>

            {deity.sub_deities?.length ? (
              <View style={styles.childrenGrid}>
                {deity.sub_deities.map((child) => (
                  <TouchableOpacity
                    key={child.id}
                    style={styles.childCard}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      'deities.detailsChildAccessibility',
                      { name: child.name }
                    )}
                    onPress={() =>
                      router.push({
                        pathname: '/deity/[id]',
                        params: {
                          id: String(child.id),
                        },
                      })
                    }
                  >
                    {child.image_url ? (
                      <Image
                        source={{
                          uri: child.image_url,
                        }}
                        style={styles.childImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.childPlaceholder}>
                        <Text style={styles.childPlaceholderIcon}>
                          🛕
                        </Text>
                      </View>
                    )}

                    <Text
                      style={styles.childName}
                      numberOfLines={2}
                    >
                      {child.name}
                    </Text>

                    <Text style={styles.childAction}>
                      {t('deities.detailsChildAction')} ›
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.childrenEmpty}>
                {t('deities.detailsNoChildren')}
              </Text>
            )}
          </View>
        ) : null}

        {/* SPIRITUAL SIGNIFICANCE */}

        {deity.significance ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('deities.detailsSignificance')}
            </Text>

            <Text style={styles.sectionText}>
              {deity.significance}
            </Text>
          </View>
        ) : null}

        {/* DEVOTIONAL PRACTICE */}

        {deity.devotional ? (
          <View style={styles.devotionalCard}>
            <Text style={styles.devotionalIcon}>
              🪔
            </Text>

            <View style={styles.devotionalContent}>
              <Text style={styles.devotionalTitle}>
                {t('deities.detailsDevotional')}
              </Text>

              <Text style={styles.devotionalText}>
                {deity.devotional}
              </Text>
            </View>
          </View>
        ) : null}

        {/* PRAYER */}

        <View style={styles.prayerCard}>
          <Text style={styles.prayerOm}>
            ॐ
          </Text>

          <Text style={styles.prayerText}>
            {t('deities.detailsPrayer', {
              name: deity.name,
            })}
          </Text>
        </View>

        {/* BACK BUTTON */}

        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => router.back()}
        >
          <Text style={styles.bottomButtonText}>
            {deity.parent_deity_id
              ? t('deities.detailsBackToGroup')
              : t('deities.detailsBackToDeities')}
          </Text>
        </TouchableOpacity>
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
    backgroundColor: '#FFF9F0',
  },

  content: {
    paddingBottom: 40,
  },

  topBar: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },

  backIcon: {
    fontSize: 32,
    lineHeight: 34,
    color: '#4A2C18',
    marginTop: -3,
  },

  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4A2C18',
  },

  topBarSpacer: {
    width: 40,
  },

  imageContainer: {
    marginHorizontal: 20,
    height: 330,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFF9F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  deityImage: {
    width: '100%',
    height: '100%',
  },

  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E9D8C6',
  },

  placeholderIcon: {
    fontSize: 60,
  },

  imageOverlay: {
    position: 'absolute',
    right: 15,
    top: 15,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  overlayOm: {
    fontSize: 27,
    color: '#9A5726',
    fontWeight: '700',
  },

  titleContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 10,
  },

  deityName: {
    fontSize: 27,
    fontWeight: '700',
    color: '#4A2C18',
    textAlign: 'center',
  },

  divider: {
    width: 55,
    height: 2,
    backgroundColor: '#C98A4A',
    marginVertical: 10,
  },

  subtitle: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },

  section: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 9,
  },

  sectionText: {
    fontSize: 13,
    color: '#6F6259',
    lineHeight: 21,
  },

  devotionalCard: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: '#F3DEC5',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
  },

  devotionalIcon: {
    fontSize: 28,
    marginRight: 14,
  },

  devotionalContent: {
    flex: 1,
  },

  devotionalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 6,
  },

  devotionalText: {
    fontSize: 12,
    color: '#6D5140',
    lineHeight: 19,
  },

  prayerCard: {
    marginHorizontal: 20,
    marginTop: 18,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#F7E8D4',
    alignItems: 'center',
  },

  prayerOm: {
    fontSize: 32,
    color: '#9A5726',
    marginBottom: 8,
  },

  prayerText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#6D5140',
    fontStyle: 'italic',
  },

  bottomButton: {
    marginHorizontal: 20,
    marginTop: 22,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#B66A2C',
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottomButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  childrenSection: {
    marginHorizontal: 20,
    marginTop: 22,
  },

  childrenHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 6,
  },

  childrenIntro: {
    fontSize: 13,
    color: '#6F6259',
    marginBottom: 15,
  },

  childrenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  childCard: {
    width: '48%',
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    paddingBottom: 13,
    elevation: 2,
  },

  childImage: {
    width: '100%',
    height: 145,
  },

  childPlaceholder: {
    height: 145,
    backgroundColor: '#E9D8C6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  childPlaceholderIcon: {
    fontSize: 42,
  },

  childName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A2C18',
    textAlign: 'center',
    marginHorizontal: 8,
    marginTop: 11,
    minHeight: 38,
  },

  childAction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B66A2C',
    textAlign: 'center',
    marginTop: 5,
  },

  childrenEmpty: {
    fontSize: 13,
    color: '#777',
    paddingVertical: 14,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#777',
  },

  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  notFoundIcon: {
    fontSize: 45,
    marginBottom: 15,
  },

  notFoundTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 8,
  },

  notFoundText: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    marginBottom: 20,
  },

  backButton: {
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#B66A2C',
  },

  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
