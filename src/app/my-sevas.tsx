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
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import { useTranslation } from 'react-i18next';

import {
  getMyVolunteerRegistrations,
  getVolunteerError,
  formatVolunteerDate,
  formatVolunteerDateTime,
} from '@/services/volunteerApi';

import type {
  MyVolunteerRegistration,
} from '@/services/volunteerApi';

import { ApiError } from '@/services/api';

import {
  VOLUNTEER_COLORS as C,
  VolunteerScreen,
  VolunteerCover,
  VolunteerStatusBadge,
  VolunteerLoading,
  VolunteerError,
  VolunteerEmpty,
  VolunteerButton,
  VolunteerInfo,
} from '@/components/volunteer/VolunteerUI';

type Filter =
  | 'all'
  | 'active'
  | 'completed'
  | 'closed';

export default function MySevasScreen() {
  const { t, i18n } = useTranslation();

  const [items, setItems] =
    useState<MyVolunteerRegistration[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [loginRequired, setLoginRequired] =
    useState(false);

  const [filter, setFilter] =
    useState<Filter>('all');

  const version = useRef(0);

  const load = useCallback(
    async (refresh = false) => {
      const requestVersion = ++version.current;

      setError('');
      setLoginRequired(false);

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setItems([]);
      }

      try {
        const data =
          await getMyVolunteerRegistrations();

        if (requestVersion !== version.current) {
          return;
        }

        setItems(data);
      } catch (err) {
        if (requestVersion !== version.current) {
          return;
        }

        setItems([]);

        setLoginRequired(
          err instanceof ApiError &&
          err.status === 401
        );

        setError(getVolunteerError(err));
      } finally {
        if (requestVersion === version.current) {
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
        version.current++;
      };
    }, [load, i18n.language])
  );

  const activeStatuses = [
    'pending',
    'approved',
    'assigned',
    'in_progress',
  ];

  const activeCount = items.filter(
    item => activeStatuses.includes(item.status)
  ).length;

  const completedCount = items.filter(
    item => item.status === 'completed'
  ).length;

  const filtered = items.filter(item => {
    if (filter === 'active') {
      return activeStatuses.includes(item.status);
    }

    if (filter === 'completed') {
      return item.status === 'completed';
    }

    if (filter === 'closed') {
      return (
        item.status === 'rejected' ||
        item.status === 'cancelled'
      );
    }

    return true;
  });

  const filters: {
    value: Filter;
    label: string;
  }[] = [
    {
      value: 'all',
      label: t('volunteer.all', 'All'),
    },
    {
      value: 'active',
      label: t('volunteer.active', 'Active'),
    },
    {
      value: 'completed',
      label: t('volunteer.completed', 'Completed'),
    },
    {
      value: 'closed',
      label: t('volunteer.closed', 'Closed'),
    },
  ];

  return (
    <VolunteerScreen
      title={t('bookingScreens.mySevas', 'My Sevas')}
    >
      {loading ? (
        <VolunteerLoading />
      ) : error ? (
        <View style={styles.content}>
          <VolunteerError
            message={error}
            onRetry={() => void load()}
          />

          {loginRequired && (
            <VolunteerButton
              title={t('common.login', 'Login')}
              onPress={() => router.push('/login')}
            />
          )}
        </View>
      ) : (
        <ScrollView
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
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>
              {t(
                'volunteer.myServiceJourney',
                'MY SERVICE JOURNEY'
              )}
            </Text>

            <Text style={styles.heroTitle}>
              {t(
                'volunteer.sevaRegistrations',
                'My Volunteer Sevas'
              )}
            </Text>

            <Text style={styles.heroDescription}>
              {t(
                'volunteer.mySevasDescription',
                'Track your registrations and service progress.'
              )}
            </Text>

            <View style={styles.stats}>
              <Stat
                label={t('volunteer.total', 'Total')}
                value={items.length}
              />

              <Stat
                label={t('volunteer.active', 'Active')}
                value={activeCount}
              />

              <Stat
                label={t(
                  'volunteer.completed',
                  'Completed'
                )}
                value={completedCount}
              />
            </View>
          </View>

          <View style={styles.filters}>
            {filters.map(option => (
              <View
                key={option.value}
                style={styles.filter}
              >
                <VolunteerButton
                  title={option.label}
                  secondary={filter !== option.value}
                  onPress={() => setFilter(option.value)}
                />
              </View>
            ))}
          </View>

          {filtered.length === 0 ? (
            <VolunteerEmpty
              title={t(
                'volunteer.noRegistrations',
                'No Registrations'
              )}
              message={t(
                'volunteer.noRegistrationsDescription',
                'There are no volunteer registrations in this category.'
              )}
            />
          ) : (
            filtered.map(item => (
              <View
                key={item.id}
                style={styles.card}
              >
                <VolunteerCover uri={item.image_url} />

                <View style={styles.cardBody}>
                  <VolunteerStatusBadge
                    status={item.status}
                  />

                  <Text style={styles.title}>
                    {item.opportunity_title}
                  </Text>

                  <Text
                    selectable
                    style={styles.code}
                  >
                    {item.registration_code}
                  </Text>

                  <Text style={styles.type}>
                    {item.registration_type === 'group'
                      ? t(
                          'bookingScreens.groupSeva',
                          'Group Seva'
                        )
                      : t(
                          'bookingScreens.individualSeva',
                          'Individual Seva'
                        )}
                  </Text>

                  {!!item.group_name && (
                    <Text style={styles.description}>
                      {item.group_name}
                    </Text>
                  )}

                  <View style={styles.info}>
                    <VolunteerInfo
                      label={t(
                        'volunteer.serviceStart',
                        'Service Start'
                      )}
                      value={formatVolunteerDate(
                        item.service_start_date
                      )}
                    />

                    <VolunteerInfo
                      label={t(
                        'volunteer.serviceEnd',
                        'Service End'
                      )}
                      value={formatVolunteerDate(
                        item.service_end_date
                      )}
                    />

                    <VolunteerInfo
                      label={t(
                        'volunteer.totalMembers',
                        'Total Volunteers'
                      )}
                      value={item.total_members}
                    />

                    <VolunteerInfo
                      label={t(
                        'volunteer.assignedDuties',
                        'Assigned Duties'
                      )}
                      value={item.total_assignments}
                    />

                    <VolunteerInfo
                      label={t(
                        'volunteer.registeredOn',
                        'Registered On'
                      )}
                      value={formatVolunteerDateTime(
                        item.created_at
                      )}
                    />
                  </View>

                  {item.status === 'rejected' &&
                    !!item.rejection_reason && (
                      <View style={styles.rejection}>
                        <Text style={styles.rejectionTitle}>
                          {t(
                            'volunteer.rejectionReason',
                            'Rejection Reason'
                          )}
                        </Text>

                        <Text style={styles.description}>
                          {item.rejection_reason}
                        </Text>
                      </View>
                    )}

                  <VolunteerButton
                    title={t(
                      'bookingScreens.registrationDetails',
                      'View Registration Details'
                    )}
                    disabled={refreshing}
                    onPress={() =>
                      router.push({
                        pathname:
                          '/volunteer/registration-details',
                        params: {
                          registrationId: String(item.id),
                        },
                      })
                    }
                  />
                </View>
              </View>
            ))
          )}

          <View style={styles.bottom}>
            <VolunteerButton
              title={t(
                'bookingScreens.registerNewSeva',
                'Explore Volunteer Sevas'
              )}
              onPress={() =>
                router.push('/seva-registration')
              }
            />
          </View>
        </ScrollView>
      )}
    </VolunteerScreen>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNumber}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  hero: {
    backgroundColor: C.maroon,
    borderRadius: 22,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: C.gold,
  },

  heroLabel: {
    color: '#EAD19A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 25,
    marginTop: 10,
  },

  heroDescription: {
    color: '#F7EBD7',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 7,
  },

  stats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },

  stat: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },

  statNumber: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
  },

  statLabel: {
    color: '#F7EBD7',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },

  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },

  filter: {
    width: '48%',
  },

  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },

  cardBody: {
    padding: 18,
  },

  title: {
    color: C.maroon,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 12,
  },

  code: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 7,
  },

  type: {
    color: C.maroon,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },

  description: {
    color: C.text,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 6,
  },

  info: {
    backgroundColor: C.background,
    borderRadius: 14,
    padding: 14,
    marginVertical: 15,
  },

  rejection: {
    backgroundColor: C.lightRed,
    padding: 13,
    borderRadius: 12,
    marginBottom: 14,
  },

  rejectionTitle: {
    color: C.red,
    fontSize: 14,
    fontWeight: '700',
  },

  bottom: {
    marginTop: 12,
  },
});