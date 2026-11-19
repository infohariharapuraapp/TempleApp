import React from 'react';

import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

import { useTranslation } from 'react-i18next';

import {
  type VolunteerSevaMember,
  formatVolunteerDate,
  formatVolunteerDateTime,
} from '@/services/volunteerApi';

const COLORS = {
  maroon: '#6B1720',
  gold: '#C69A3A',
  background: '#FFFDF8',
  ivory: '#F7EBD7',
  text: '#302820',
  muted: '#786C61',
  border: '#E8DFCF',
  green: '#15803D',
  greenLight: '#ECFDF3',
  red: '#B91C1C',
  redLight: '#FEF2F2',
  amber: '#A16207',
  amberLight: '#FFFBEB',
};

interface Props {
  member: VolunteerSevaMember;
  section: 'availability' | 'attendance';
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>
        {label}
      </Text>

      <Text style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

function AttendanceBadge({
  label,
  status,
}: {
  label: string;
  status: string;
}) {
  const palette =
    status === 'present'
      ? {
          color: COLORS.green,
          backgroundColor: COLORS.greenLight,
        }
      : status === 'absent'
        ? {
            color: COLORS.red,
            backgroundColor: COLORS.redLight,
          }
        : {
            color: COLORS.amber,
            backgroundColor: COLORS.amberLight,
          };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.backgroundColor,
        },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          { color: palette.color },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function VolunteerDailyService({
  member,
  section,
}: Props) {
  const { t } = useTranslation();

  const translate = (
    key: string,
    fallback: string
  ): string =>
    t(`volunteer.${key}`, {
      defaultValue: fallback,
    });

  const mode =
    member.attendance_mode ?? 'legacy';

  const serviceDates = Array.isArray(
    member.service_dates
  )
    ? member.service_dates
    : [];

  const attendance = Array.isArray(
    member.daily_attendance
  )
    ? member.daily_attendance
    : [];

  const summary =
    member.daily_service_summary;

  const completed =
    member.status === 'completed';

  function statusLabel(status: string) {
    switch (status) {
      case 'present':
        return translate(
          'dailyPresent',
          'Present'
        );

      case 'absent':
        return translate(
          'dailyAbsent',
          'Absent'
        );

      case 'excused':
        return translate(
          'dailyExcused',
          'Excused'
        );

      default:
        return translate(
          'dailyAwaitingAttendance',
          'Awaiting attendance'
        );
    }
  }

  // ========================================
  // SELECTED SERVICE DATES
  // ========================================

  if (section === 'availability') {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>
          {translate(
            'selectedServiceDates',
            'Selected Service Dates'
          )}
        </Text>

        <Text style={styles.description}>
          {translate(
            'selectedServiceDatesDescription',
            'These are the dates selected for your volunteer service.'
          )}
        </Text>

        <View style={styles.summaryBanner}>
          <Text style={styles.summaryLabel}>
            {translate(
              'totalSelectedDates',
              'Total selected dates'
            )}
          </Text>

          <Text style={styles.summaryValue}>
            {serviceDates.length}
          </Text>
        </View>

        {serviceDates.map(date => (
          <View
            key={date}
            style={styles.dateCard}
          >
            <View style={styles.calendarIcon}>
              <Text style={styles.calendarText}>
                {date.slice(8, 10)}
              </Text>
            </View>

            <View style={styles.flex}>
              <Text style={styles.dateTitle}>
                {formatVolunteerDate(date)}
              </Text>

              <Text style={styles.description}>
                {translate(
                  'selectedServiceDate',
                  'Selected service date'
                )}
              </Text>
            </View>
          </View>
        ))}

        {serviceDates.length === 0 && (
          <Text style={styles.description}>
            {translate(
              'noSelectedServiceDates',
              'No selected service dates are available.'
            )}
          </Text>
        )}
      </View>
    );
  }

  // ========================================
  // SERVICE COMPLETION
  // ========================================

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>
        {translate(
          'dailyServiceProgress',
          'Service Progress'
        )}
      </Text>

      <View
        style={[
          styles.completionBanner,
          completed &&
            styles.completedBanner,
        ]}
      >
        <Text
          style={[
            styles.completionTitle,
            completed && {
              color: COLORS.green,
            },
          ]}
        >
          {completed
            ? translate(
                'dailyServiceCompleted',
                'Service Completed'
              )
            : translate(
                'dailyCompletionPending',
                'Service Completion Pending'
              )}
        </Text>

        <Text style={styles.description}>
          {completed
            ? translate(
                'dailyCompletionVerified',
                'Your service has been verified by the temple administration.'
              )
            : translate(
                'dailyCompletionDescription',
                'Service completion will be updated by the temple administration.'
              )}
        </Text>
      </View>

      <View style={styles.statGrid}>
        <StatCard
          label={translate(
            'totalSelectedDates',
            'Selected dates'
          )}
          value={
            summary?.total_selected_dates ??
            serviceDates.length
          }
        />

        {summary &&
          mode !== 'none' && (
            <>
              <StatCard
                label={translate(
                  'verifiedServiceDays',
                  'Verified service days'
                )}
                value={
                  summary.total_service_days ??
                  '—'
                }
              />

              <StatCard
                label={translate(
                  'finalizedServiceDates',
                  'Finalized dates'
                )}
                value={
                  `${summary.finalized_dates ?? 0} / ${summary.total_selected_dates}`
                }
              />

              <StatCard
                label={translate(
                  'dailyPresent',
                  'Present'
                )}
                value={summary.present ?? '—'}
              />

              <StatCard
                label={translate(
                  'dailyAbsent',
                  'Absent'
                )}
                value={summary.absent ?? '—'}
              />

              <StatCard
                label={translate(
                  'dailyExcused',
                  'Excused'
                )}
                value={summary.excused ?? '—'}
              />

              {summary.attendance_percentage != null && (
                <StatCard
                  label={translate(
                    'dailyAttendancePercentage',
                    'Attendance'
                  )}
                  value={
                    `${summary.attendance_percentage}%`
                  }
                />
              )}

              {mode === 'detailed' &&
                summary.total_service_hours != null && (
                  <StatCard
                    label={translate(
                      'actualServiceHours',
                      'Actual service hours'
                    )}
                    value={
                      summary.total_service_hours
                    }
                  />
                )}
            </>
          )}
      </View>

      {mode === 'none' ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            {translate(
              'dailyManualVerification',
              'Manual Service Verification'
            )}
          </Text>

          <Text style={styles.description}>
            {translate(
              'dailyAttendanceDisabled',
              'Attendance and service hours are not recorded for this programme. Completion is verified by the temple administration.'
            )}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.subheading}>
            {translate(
              'dailyAttendanceTitle',
              'Daily Attendance'
            )}
          </Text>

          {attendance.map(item => {
            const status =
              item.is_finalized
                ? item.attendance_status
                : 'not_marked';

            return (
              <View
                key={item.service_date_id}
                style={styles.attendanceCard}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.dateTitle}>
                    {formatVolunteerDate(
                      item.service_date
                    )}
                  </Text>

                  <AttendanceBadge
                    status={status}
                    label={statusLabel(status)}
                  />
                </View>

                {mode === 'detailed' &&
                  item.is_finalized &&
                  status === 'present' && (
                    <View style={styles.timeDetails}>
                      {item.check_in_at && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>
                            {translate(
                              'dailyCheckIn',
                              'Check-in'
                            )}
                          </Text>

                          <Text style={styles.infoValue}>
                            {formatVolunteerDateTime(
                              item.check_in_at
                            )} IST
                          </Text>
                        </View>
                      )}

                      {item.check_out_at && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>
                            {translate(
                              'dailyCheckOut',
                              'Check-out'
                            )}
                          </Text>

                          <Text style={styles.infoValue}>
                            {formatVolunteerDateTime(
                              item.check_out_at
                            )} IST
                          </Text>
                        </View>
                      )}

                      {item.service_hours != null && (
                        <View style={styles.hoursBanner}>
                          <Text style={styles.hoursText}>
                            {translate(
                              'actualServiceHours',
                              'Actual service hours'
                            )}
                            {': '}
                            {item.service_hours}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
              </View>
            );
          })}

          {attendance.length === 0 && (
            <Text style={styles.description}>
              {translate(
                'noDailyAttendance',
                'No daily attendance information is available yet.'
              )}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },

  title: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.maroon,
  },

  subheading: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.maroon,
    marginTop: 6,
  },

  description: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
  },

  summaryBanner: {
    backgroundColor: COLORS.maroon,
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  summaryLabel: {
    color: COLORS.ivory,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },

  summaryValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },

  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },

  calendarIcon: {
    width: 45,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.ivory,
  },

  calendarText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.maroon,
  },

  dateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    flexShrink: 1,
  },

  completionBanner: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: COLORS.ivory,
    gap: 6,
  },

  completedBanner: {
    backgroundColor: COLORS.greenLight,
  },

  completionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.maroon,
  },

  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 7,
  },

  statLabel: {
    fontSize: 12,
    color: COLORS.muted,
  },

  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.maroon,
  },

  attendanceCard: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    backgroundColor: COLORS.background,
    gap: 12,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },

  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  timeDetails: {
    gap: 10,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    flexWrap: 'wrap',
  },

  infoLabel: {
    fontSize: 13,
    color: COLORS.muted,
  },

  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    flexShrink: 1,
  },

  hoursBanner: {
    borderRadius: 9,
    padding: 10,
    backgroundColor: COLORS.ivory,
  },

  hoursText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.maroon,
  },

  notice: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    backgroundColor: COLORS.background,
    gap: 7,
  },

  noticeTitle: {
    color: COLORS.maroon,
    fontWeight: '700',
    fontSize: 15,
  },
});