import React, {
  useCallback,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  getMyVolunteerReporting,
  confirmVolunteerReporting,
  getVolunteerError,
  formatVolunteerDate,
  formatVolunteerTime,
} from '@/services/volunteerApi';

import type {
  VolunteerDailyReporting,
} from '@/services/volunteerApi';

import {
  VOLUNTEER_COLORS as C,
  VolunteerButton,
  VolunteerInfo,
  VolunteerLoading,
  VolunteerError,
  VolunteerEmpty,
} from '@/components/volunteer/VolunteerUI';

interface Props {
  registrationId: number;
  memberId: number;
  programmeName: string;
  registrationStatus: string;
}

export default function VolunteerReporting({
  registrationId,
  memberId,
  programmeName,
  registrationStatus,
}: Props) {
  const { t, i18n } = useTranslation();

  const [items, setItems] =
    useState<VolunteerDailyReporting[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const version = useRef(0);
  const mutationLock = useRef(false);

  const load = useCallback(async () => {
    const current = ++version.current;

    setLoading(true);
    setError('');
    setItems([]);

    try {
      const result =
        await getMyVolunteerReporting(
          registrationId
        );

      if (current !== version.current) {
        return;
      }

      setItems(result);
    } catch (err) {
      if (current === version.current) {
        setError(getVolunteerError(err));
      }
    } finally {
      if (current === version.current) {
        setLoading(false);
      }
    }
  }, [registrationId]);

  useFocusEffect(
    useCallback(() => {
      void load();

      return () => {
        version.current++;
      };
    }, [load, i18n.language])
  );

  async function confirm(
    item: VolunteerDailyReporting
  ) {
    if (
      mutationLock.current ||
      !item.can_confirm ||
      !item.reporting_id ||
      !item.revision ||
      item.reporting_status !== 'awaiting_response'
    ) {
      return;
    }

    mutationLock.current = true;
    setBusy(true);

    const current = version.current;

    try {
      await confirmVolunteerReporting(
        item.reporting_id,
        item.revision
      );

      if (current === version.current) {
        await load();
      }
    } catch (err) {
      if (current === version.current) {
        Alert.alert(
          t(
            'volunteer.confirmationUnverified',
            'Unable to verify confirmation'
          ),
          getVolunteerError(err)
        );

        await load();
      }
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  function requestConfirmation(
    item: VolunteerDailyReporting
  ) {
    Alert.alert(
      t(
        'volunteer.confirmAvailability',
        'Confirm Availability'
      ),
      t(
        'volunteer.confirmAvailabilityMessage',
        'Are you available at the scheduled reporting time?'
      ),
      [
        {
          text: t('common.cancel', 'Cancel'),
          style: 'cancel',
        },
        {
          text: t('volunteer.confirm', 'Confirm'),
          onPress: () => void confirm(item),
        },
      ]
    );
  }

  function normalizePhone(
    phone: string | null
  ): string | null {
    if (!phone) return null;

    const value = phone.replace(
      /[\s()-]/g,
      ''
    );

    if (/^[6-9]\d{9}$/.test(value)) {
      return `+91${value}`;
    }

    if (/^91[6-9]\d{9}$/.test(value)) {
      return `+${value}`;
    }

    if (/^\+[1-9]\d{6,14}$/.test(value)) {
      return value;
    }

    return null;
  }

  async function contactCoordinator(
    item: VolunteerDailyReporting,
    method: 'whatsapp' | 'call'
  ) {
    const phone = normalizePhone(
      item.coordinator_phone
    );

    if (!phone) {
      Alert.alert(
        t(
          'volunteer.contactUnavailable',
          'Contact unavailable'
        )
      );
      return;
    }

    try {
      if (method === 'call') {
        await Linking.openURL(`tel:${phone}`);
        return;
      }

      const message = [
        'Namaskara,',
        '',
        `Programme: ${programmeName}`,
        `Volunteer: ${item.full_name}`,
        `Volunteer ID: ${item.member_code}`,
        `Service Date: ${formatVolunteerDate(
          item.service_date
        )}`,
        `Reporting Time: ${formatVolunteerTime(
          item.reporting_time
        )} IST`,
        '',
        'I would like to discuss my availability or reporting time with you.',
        '',
        'Thank you.',
      ].join('\n');

      const url =
        `https://wa.me/${phone.replace('+', '')}` +
        `?text=${encodeURIComponent(message)}`;

      await Linking.openURL(url);
    } catch {
      Alert.alert(
        t(
          'volunteer.contactUnavailable',
          'Unable to open contact'
        ),
        phone
      );
    }
  }

  function statusLabel(status: string) {
    switch (status) {
      case 'not_sent':
        return t(
          'volunteer.reportingNotSent',
          'Awaiting Reporting Instructions'
        );

      case 'awaiting_response':
        return t(
          'volunteer.awaitingConfirmation',
          'Awaiting Confirmation'
        );

      case 'confirmed':
        return t(
          'volunteer.availabilityConfirmed',
          'Availability Confirmed'
        );

      case 'cancelled':
        return t(
          'volunteer.reportingCancelled',
          'Reporting Cancelled'
        );

      case 'reported':
        return t(
          'volunteer.reported',
          'Reported'
        );

      default:
        return status.replace(/_/g, ' ');
    }
  }

  const memberItems = items
    .filter(item => item.member_id === memberId)
    .sort((a, b) =>
      a.service_date.localeCompare(b.service_date)
    );

  const activeRegistration = [
    'approved',
    'assigned',
    'in_progress',
  ].includes(registrationStatus);

  if (loading) {
    return <VolunteerLoading />;
  }

  if (error) {
    return (
      <VolunteerError
        message={error}
        onRetry={() => void load()}
      />
    );
  }

  if (registrationStatus === 'pending') {
    return (
      <VolunteerEmpty
        title={t(
          'volunteer.awaitingApproval',
          'Awaiting Admin Approval'
        )}
        message={t(
          'volunteer.reportingAfterApproval',
          'Reporting instructions will be available after approval.'
        )}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        {t(
          'volunteer.dailyReporting',
          'Daily Reporting'
        )}
      </Text>

      <Text style={styles.description}>
        {t(
          'volunteer.dailyReportingDescription',
          'View your selected service dates and reporting instructions from the temple administration.'
        )}
      </Text>

      <VolunteerButton
        title={t(
          'volunteer.refreshReporting',
          'Refresh Reporting'
        )}
        secondary
        disabled={busy}
        onPress={() => void load()}
      />

      {memberItems.length === 0 ? (
        <VolunteerEmpty
          title={t(
            'volunteer.noReportingDetails',
            'No Reporting Details'
          )}
          message={t(
            'volunteer.noReportingDescription',
            'Reporting information will appear here when available.'
          )}
        />
      ) : (
        memberItems.map(item => {
          const cancelled =
            item.reporting_status === 'cancelled';

          const confirmed =
            item.reporting_status === 'confirmed';

          const sent =
            !!item.reporting_id &&
            item.reporting_status !== 'not_sent';

          const reportingAt =
            item.reporting_time
              ? Date.parse(
                  `${item.service_date.slice(0, 10)}T${item.reporting_time.slice(0, 8)}+05:30`
                )
              : NaN;

          const future =
            Number.isFinite(reportingAt) &&
            reportingAt > Date.now();

          const contactAllowed =
            sent &&
            !cancelled &&
            activeRegistration;

          return (
            <View
              key={item.service_date_id}
              style={styles.card}
            >
              <Text style={styles.date}>
                {formatVolunteerDate(
                  item.service_date
                )}
              </Text>

              <View style={[
                styles.badge,
                {
                  backgroundColor: cancelled
                    ? C.lightRed
                    : confirmed
                      ? C.lightGreen
                      : C.lightWarning,
                },
              ]}>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: cancelled
                    ? C.red
                    : confirmed
                      ? C.green
                      : C.warning,
                }}>
                  {statusLabel(
                    item.reporting_status
                  )}
                </Text>
              </View>

              {!sent ? (
                <Text style={styles.description}>
                  {t(
                    'volunteer.reportingPendingMessage',
                    'The administration has not yet communicated the reporting time for this date.'
                  )}
                </Text>
              ) : (
                <>
                  <VolunteerInfo
                    label={t(
                      'volunteer.reportingTime',
                      'Reporting Time'
                    )}
                    value={
                      item.reporting_time
                        ? `${formatVolunteerTime(
                            item.reporting_time
                          )} IST`
                        : '-'
                    }
                  />

                  <VolunteerInfo
                    label={t(
                      'volunteer.reportingLocation',
                      'Reporting Location'
                    )}
                    value={
                      item.reporting_location
                    }
                  />

                  <VolunteerInfo
                    label={t(
                      'volunteer.coordinator',
                      'Coordinator'
                    )}
                    value={item.coordinator_name}
                  />

                  <VolunteerInfo
                    label={t(
                      'volunteer.coordinatorPhone',
                      'Coordinator Phone'
                    )}
                    value={
                      item.coordinator_phone
                    }
                  />

                  {!!item.special_instructions && (
                    <View style={styles.instructions}>
                      <Text style={styles.label}>
                        {t(
                          'volunteer.specialInstructions',
                          'Special Instructions'
                        )}
                      </Text>

                      <Text style={styles.description}>
                        {item.special_instructions}
                      </Text>
                    </View>
                  )}

                  {activeRegistration &&
                    item.can_confirm &&
                    future &&
                    item.reporting_status ===
                      'awaiting_response' && (
                      <VolunteerButton
                        title={t(
                          'volunteer.confirmAvailability',
                          'Confirm Availability'
                        )}
                        disabled={busy}
                        onPress={() =>
                          requestConfirmation(item)
                        }
                      />
                    )}

                  {contactAllowed && (
                    <View style={styles.contact}>
                      <Text style={styles.label}>
                        {t(
                          'volunteer.needReportingChange',
                          'Unable to attend or need a different reporting time?'
                        )}
                      </Text>

                      <VolunteerButton
                        title={t(
                          'volunteer.whatsappCoordinator',
                          'WhatsApp Coordinator'
                        )}
                        secondary
                        disabled={
                          busy ||
                          !normalizePhone(
                            item.coordinator_phone
                          )
                        }
                        onPress={() =>
                          void contactCoordinator(
                            item,
                            'whatsapp'
                          )
                        }
                      />

                      <VolunteerButton
                        title={t(
                          'volunteer.callCoordinator',
                          'Call Coordinator'
                        )}
                        secondary
                        disabled={
                          busy ||
                          !normalizePhone(
                            item.coordinator_phone
                          )
                        }
                        onPress={() =>
                          void contactCoordinator(
                            item,
                            'call'
                          )
                        }
                      />

                      <Text style={styles.note}>
                        {t(
                          'volunteer.coordinatorChangeNote',
                          'Contacting the coordinator does not automatically change your reporting schedule. Check here for updated instructions.'
                        )}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.white,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    gap: 14,
    marginBottom: 16,
  },

  heading: {
    color: C.maroon,
    fontSize: 21,
    fontWeight: '800',
  },

  description: {
    color: C.text,
    fontSize: 13,
    lineHeight: 21,
  },

  card: {
    backgroundColor: C.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 15,
    gap: 10,
  },

  date: {
    color: C.maroon,
    fontSize: 18,
    fontWeight: '800',
  },

  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },

  instructions: {
    backgroundColor: C.lightGold,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: C.maroon,
  },

  contact: {
    gap: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 14,
  },

  note: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
  },
});