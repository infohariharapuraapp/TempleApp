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
  useLocalSearchParams,
} from 'expo-router';

import { useTranslation } from 'react-i18next';

import {
  getVolunteerOpportunity,
  getVolunteerServiceDates,
  getVolunteerError,
  formatVolunteerDate,
  formatVolunteerDateTime,
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
  VolunteerError,
  VolunteerInfo,
  VolunteerButton,
} from '@/components/volunteer/VolunteerUI';

// ========================================
// OPPORTUNITY DETAILS
// ========================================

export default function VolunteerDetailsScreen() {
  const { t, i18n } = useTranslation();

  const params =
    useLocalSearchParams<{ id: string }>();

  const rawId =
    typeof params.id === 'string'
      ? params.id
      : '';

  const id = Number(rawId);

  const [item, setItem] =
    useState<VolunteerOpportunity | null>(
      null
    );

  const [serviceDates, setServiceDates] =
    useState<string[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const requestVersion = useRef(0);

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
        if (
          !/^[1-9]\d*$/.test(rawId) ||
          !Number.isSafeInteger(id) ||
          id > 2147483647
        ) {
          throw new Error(
            'Invalid opportunity ID'
          );
        }

        const [opportunity, availableShifts] =
          await Promise.all([
            getVolunteerOpportunity(id),
            getVolunteerServiceDates(id),
          ]);

        if (
          version !== requestVersion.current
        ) {
          return;
        }

        setItem(opportunity);
        setServiceDates(availableShifts.registration_open ? availableShifts.service_dates : []);
      } catch (error) {
        if (
          version !== requestVersion.current
        ) {
          return;
        }

        setItem(null);
        setServiceDates([]);
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
    [id, rawId]
  );

  useFocusEffect(
    useCallback(() => {
      void load();

      return () => {
        requestVersion.current++;
      };
    }, [load, i18n.language])
  );

  const registrationOpen =
    item?.registration_status === 'open' &&
    Date.parse(
      item.registration_end_at
    ) > Date.now();

  return (
    <VolunteerScreen
      title={t(
        'volunteer.sevaDetails',
        'Seva Details'
      )}
    >
      {loading ? (
        <VolunteerLoading />
      ) : error || !item ? (
        <VolunteerError
          message={
            error ||
            t(
              'volunteer.notFound',
              'Opportunity not available.'
            )
          }
          onRetry={() => void load()}
        />
      ) : (
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
          {/* COVER AND INTRODUCTION */}

          <View style={styles.card}>
            <VolunteerCover
              uri={item.image_url}
            />

            <View style={styles.cardBody}>
              <VolunteerStatusBadge
                status={
                  item.registration_status
                }
              />

              <Text style={styles.title}>
                {item.title}
              </Text>

              {!!item.description && (
                <Text style={styles.description}>
                  {item.description}
                </Text>
              )}
            </View>
          </View>

          {/* PROGRAMME INFORMATION */}

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>
              {t(
                'volunteer.programmeInformation',
                'Programme Information'
              )}
            </Text>

            <VolunteerInfo
              label={t(
                'volunteer.serviceStart',
                'Service Start Date'
              )}
              value={formatVolunteerDate(
                item.service_start_date
              )}
            />

            <VolunteerInfo
              label={t(
                'volunteer.serviceEnd',
                'Service End Date'
              )}
              value={formatVolunteerDate(
                item.service_end_date
              )}
            />

            <VolunteerInfo
              label={t(
                'volunteer.registrationStart',
                'Registration Opens'
              )}
              value={`${formatVolunteerDateTime(
                item.registration_start_at
              )} IST`}
            />

            <VolunteerInfo
              label={t(
                'volunteer.registrationDeadline',
                'Registration Deadline'
              )}
              value={`${formatVolunteerDateTime(
                item.registration_end_at
              )} IST`}
            />

            <VolunteerInfo
              label={t(
                'volunteer.requiredVolunteers',
                'Required Volunteers'
              )}
              value={item.required_volunteers}
            />
          </View>

          {/* REGISTRATION TYPES */}

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>
              {t(
                'volunteer.registrationTypes',
                'Registration Types'
              )}
            </Text>

            {item.allow_individual && (
              <View style={styles.typeCard}>
                <Text style={styles.typeIcon}>
                  👤
                </Text>

                <View style={styles.flex}>
                  <Text style={styles.typeTitle}>
                    {t(
                      'volunteer.individualRegistration',
                      'Individual Registration'
                    )}
                  </Text>

                  <Text style={styles.description}>
                    {t(
                      'volunteer.individualDescription',
                      'Register yourself as a volunteer.'
                    )}
                  </Text>
                </View>
              </View>
            )}

            {item.allow_group && (
              <View style={styles.typeCard}>
                <Text style={styles.typeIcon}>
                  👥
                </Text>

                <View style={styles.flex}>
                  <Text style={styles.typeTitle}>
                    {t(
                      'volunteer.groupRegistration',
                      'Group Registration'
                    )}
                  </Text>

                  <Text style={styles.description}>
                    {item.minimum_group_size}
                    {' – '}
                    {item.maximum_group_size}
                    {' '}
                    {t(
                      'volunteer.members',
                      'members'
                    )}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* AVAILABLE SERVICE DATES */}
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>
              {t(
                'volunteer.availableServiceDates',
                'Available Service Dates'
              )}
            </Text>
            {serviceDates.length === 0 ? (
              <Text style={styles.description}>
                {t(
                  'volunteer.noServiceDates',
                  'No service dates are currently available for registration.'
                )}
              </Text>
            ) : (
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 12,
              }}>
                {serviceDates.map(date => (
                  <View
                    key={date}
                    style={{
                      backgroundColor: C.lightGold,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: C.border,
                      padding: 12,
                    }}
                  >
                    <Text style={{
                      color: C.maroon,
                      fontWeight: '700',
                    }}>
                      {formatVolunteerDate(date)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.description}>
              {t(
                'volunteer.reportingAfterApproval',
                'Reporting time and coordinator details will be communicated after approval.'
              )}
            </Text>
          </View>
          {/* INSTRUCTIONS */}

          {!!item.instructions && (
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>
                {t(
                  'volunteer.instructions',
                  'Important Instructions'
                )}
              </Text>

              <Text style={styles.description}>
                {item.instructions}
              </Text>
            </View>
          )}

          {/* REGISTRATION ACTION */}

          <View style={styles.actionPanel}>
            <Text style={styles.actionTitle}>
              {t(
                'volunteer.readyToServe',
                'Ready to Serve?'
              )}
            </Text>

            <Text style={styles.actionDescription}>
              {!registrationOpen
                ? t(
                    'volunteer.registrationUnavailable',
                    'Registration is not currently open.'
                  )
                : serviceDates.length === 0
                  ? t(
                      'volunteer.noDateRegistration',
                      'Registration requires at least one available service date.'
                    )
                  : t(
                      'volunteer.dateRegistrationReady',
                      'Complete your volunteer details and select your available service dates.'
                    )}
            </Text>

            <VolunteerButton
              title={t(
                'volunteer.registerNow',
                'Register Now'
              )}
              disabled={
                refreshing ||
                !registrationOpen ||
                serviceDates.length === 0
              }
              onPress={() => {
                router.push({
                  pathname: '/volunteer/register',
                  params: {
                    opportunityId: String(id),
                  },
                });
              }}
            />
          </View>
        </ScrollView>
      )}
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

  card: {
    backgroundColor: '#FFFFFF',
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
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
    marginTop: 13,
  },

  description: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 22,
    marginTop: 7,
  },

  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 15,
  },

  sectionTitle: {
    color: C.maroon,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },

  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    backgroundColor: C.lightGold,
    borderRadius: 13,
    marginTop: 10,
  },

  typeIcon: {
    fontSize: 27,
    marginRight: 13,
  },

  typeTitle: {
    color: C.maroon,
    fontSize: 14,
    fontWeight: '700',
  },

  flex: {
    flex: 1,
  },

  shiftCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFF9F0',
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 10,
  },

  shiftName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.maroon,
  },

  shiftDate: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },

  shiftTime: {
    color: C.muted,
    fontSize: 12,
    marginTop: 5,
  },

  actionPanel: {
    backgroundColor: C.lightGold,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 18,
  },

  actionTitle: {
    color: C.maroon,
    fontSize: 21,
    fontWeight: '800',
  },

  actionDescription: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 16,
  },
});