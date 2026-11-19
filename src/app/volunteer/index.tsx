import React, {
  useCallback,
  useRef,
  useState,
} from 'react';

import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import { useTranslation } from 'react-i18next';

import {
  formatVolunteerDate,
  formatVolunteerDateTime,
  getVolunteerError,
  getVolunteerOpportunities,
} from '@/services/volunteerApi';

import type {
  VolunteerOpportunity,
} from '@/services/volunteerApi';

import {
  VOLUNTEER_COLORS as C,
  VolunteerScreen,
  VolunteerCover,
  VolunteerStatusBadge,
  VolunteerLoading,
  VolunteerEmpty,
  VolunteerError,
} from '@/components/volunteer/VolunteerUI';

// ========================================
// SCREEN
// ========================================

export default function VolunteerHomeScreen() {
  const { t, i18n } = useTranslation();

  const [items, setItems] =
    useState<VolunteerOpportunity[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const requestVersion = useRef(0);
  const [filter, setFilter] = useState<
    'all' | 'active' | 'upcoming' | 'closed'
  >('all');

  const load = useCallback(
    async (refresh = false) => {
      const version =
        ++requestVersion.current;

      setError('');

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const data =
          await getVolunteerOpportunities(true);

        if (
          version !== requestVersion.current
        ) {
          return;
        }

        setItems(data);
      } catch (error) {
        if (
          version !== requestVersion.current
        ) {
          return;
        }

        setError(getVolunteerError(error));
      } finally {
        if (
          version === requestVersion.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void load();

      return () => {
        requestVersion.current++;
      };
    }, [load, i18n.language])
  );

  const filtered = items.filter(item => {
    if (filter === 'active') {
      return item.registration_status === 'open';
    }
    if (filter === 'upcoming') {
      return item.registration_status === 'upcoming';
    }
    if (filter === 'closed') {
      return item.registration_status === 'closed';
    }
    return true;
  });
  const filters = [
    {
      value: 'all',
      label: t('volunteer.all', 'All'),
    },
    {
      value: 'active',
      label: t('volunteer.active', 'Active'),
    },
    {
      value: 'upcoming',
      label: t('volunteer.upcoming', 'Upcoming'),
    },
    {
      value: 'closed',
      label: t('volunteer.closed', 'Closed'),
    },
  ] as const;
  return (
    <VolunteerScreen
      title={t(
        'volunteer.title',
        'Volunteer Seva'
      )}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            colors={[C.maroon]}
            tintColor={C.maroon}
          />
        }
      >
        {/* DEVOTIONAL HERO */}

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>
            DIVYAKSHETRA HARIHARAPURA
          </Text>

          <Text style={styles.heroIcon}>
            🙏
          </Text>

          <Text style={styles.heroTitle}>
            {t(
              'volunteer.serveWithDevotion',
              'Serve with Devotion'
            )}
          </Text>

          <Text style={styles.heroDescription}>
            {t(
              'volunteer.heroDescription',
              'Offer your time and service through sacred temple activities.'
            )}
          </Text>

          <View style={styles.goldLine} />
        </View>

        {/* OPPORTUNITY FILTERS */}
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 20,
        }}>
          {filters.map(option => {
            const selected =
              filter === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() =>
                  setFilter(option.value)
                }
                style={{
                  flexGrow: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: selected
                    ? C.maroon
                    : C.border,
                  backgroundColor: selected
                    ? C.maroon
                    : C.lightGold,
                }}
              >
                <Text style={{
                  color: selected
                    ? C.white
                    : C.maroon,
                  fontSize: 13,
                  fontWeight: '700',
                  textAlign: 'center',
                }}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {/* OPPORTUNITIES */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t(
              'volunteer.opportunities',
              'Seva Opportunities'
            )}
          </Text>

          {!loading && !error && (
            <Text style={styles.count}>
              {filtered.length}
            </Text>
          )}
        </View>

        <Text style={styles.subtitle}>
          {t(
            'volunteer.opportunitySubtitle',
            'Explore available opportunities and participate in temple Seva.'
          )}
        </Text>

        {loading ? (
          <VolunteerLoading />
        ) : error ? (
          <VolunteerError
            message={error}
            onRetry={() => void load()}
          />
        ) : filtered.length === 0 ? (
          <VolunteerEmpty
            title={t(
              'volunteer.noOpportunities',
              'No Available Opportunities'
            )}
            message={t(
              'volunteer.noOpportunitiesMessage',
              'New Seva opportunities will appear here when announced by the temple.'
            )}
          />
        ) : (
          filtered.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.9}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/volunteer/[id]',
                  params: {
                    id: String(item.id),
                  },
                } as any)
              }
            >
              <VolunteerCover
                uri={item.image_url}
              />

              <View style={styles.cardBody}>
                <VolunteerStatusBadge
                  status={
                    item.registration_status
                  }
                />

                <Text style={styles.cardTitle}>
                  {item.title}
                </Text>

                {!!item.description && (
                  <Text
                    numberOfLines={3}
                    style={styles.description}
                  >
                    {item.description}
                  </Text>
                )}

                <View style={styles.dateBox}>
                  <Text style={styles.dateLabel}>
                    {t(
                      'volunteer.servicePeriod',
                      'Service Period'
                    )}
                  </Text>

                  <Text style={styles.dateValue}>
                    {formatVolunteerDate(
                      item.service_start_date
                    )}
                    {' – '}
                    {formatVolunteerDate(
                      item.service_end_date
                    )}
                  </Text>
                </View>

                <Text style={styles.deadline}>
                  {item.registration_status ===
                  'upcoming'
                    ? t(
                        'volunteer.opensOn',
                        'Opens on'
                      )
                    : item.registration_status === 'closed'
                      ? t(
                          'volunteer.registrationDeadline',
                          'Registration deadline'
                        )
                      : t(
                          'volunteer.registerBefore',
                          'Register before'
                        )}
                  {': '}
                  {formatVolunteerDateTime(
                    item.registration_status ===
                      'upcoming'
                      ? item.registration_start_at
                      : item.registration_end_at
                  )}
                  {' IST'}
                </Text>

                <View style={styles.tags}>
                  {item.allow_individual && (
                    <Text style={styles.tag}>
                      {t(
                        'volunteer.individual',
                        'Individual'
                      )}
                    </Text>
                  )}

                  {item.allow_group && (
                    <Text style={styles.tag}>
                      {t(
                        'volunteer.group',
                        'Group'
                      )}
                    </Text>
                  )}
                </View>

                <View style={styles.cardButton}>
                  <Text style={styles.cardButtonText}>
                    {t(
                      'volunteer.viewDetails',
                      'View Details'
                    )}
                    {'  ›'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.footer}>
          {t(
            'volunteer.footer',
            'Seva is an offering of devotion.'
          )}
        </Text>
      </ScrollView>
    </VolunteerScreen>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 35,
  },

  hero: {
    backgroundColor: C.maroon,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.gold,
    marginBottom: 26,
  },

  eyebrow: {
    color: '#EAD19A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
  },

  heroIcon: {
    fontSize: 42,
    marginTop: 17,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 13,
  },

  heroDescription: {
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    color: '#F3E5D4',
    marginTop: 9,
  },

  goldLine: {
    width: 55,
    height: 3,
    backgroundColor: C.gold,
    borderRadius: 2,
    marginTop: 19,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    flex: 1,
    color: C.maroon,
    fontSize: 21,
    fontWeight: '800',
  },

  count: {
    color: C.maroon,
    backgroundColor: C.lightGold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    fontWeight: '700',
  },

  subtitle: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 18,
  },

  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 18,
    elevation: 2,
  },

  cardBody: {
    padding: 17,
  },

  cardTitle: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '800',
    color: C.text,
    marginTop: 12,
  },

  description: {
    fontSize: 13,
    lineHeight: 21,
    color: C.muted,
    marginTop: 7,
  },

  dateBox: {
    backgroundColor: C.lightGold,
    borderRadius: 12,
    padding: 13,
    marginTop: 15,
  },

  dateLabel: {
    fontSize: 11,
    color: C.muted,
    marginBottom: 5,
  },

  dateValue: {
    fontSize: 14,
    color: C.maroon,
    fontWeight: '700',
  },

  deadline: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 12,
  },

  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },

  tag: {
    color: C.maroon,
    backgroundColor: '#FAF1E6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 11,
    fontWeight: '600',
  },

  cardButton: {
    marginTop: 17,
    backgroundColor: C.maroon,
    padding: 13,
    borderRadius: 12,
    alignItems: 'center',
  },

  cardButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: C.muted,
    marginVertical: 15,
  },
});