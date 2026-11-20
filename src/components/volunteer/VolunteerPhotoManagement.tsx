import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTranslation } from 'react-i18next';

import VolunteerPhotoPicker, {
  type VolunteerPhotoSelection,
} from '@/components/volunteer/VolunteerPhotoPicker';

import {
  resubmitVolunteerPhoto,
  getVolunteerError,
  formatVolunteerDateTime,
  type VolunteerSevaMember,
} from '@/services/volunteerApi';

import {
  VOLUNTEER_COLORS as C,
  VolunteerButton,
} from '@/components/volunteer/VolunteerUI';

interface Props {
  registrationId: number;
  opportunityId: number;
  member: VolunteerSevaMember;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
  onRefresh: () => Promise<void>;
}

export default function VolunteerPhotoManagement({
  registrationId,
  opportunityId,
  member,
  disabled = false,
  onBusyChange,
  onRefresh,
}: Props) {
  const { t } = useTranslation();

  const [selection, setSelection] =
    useState<VolunteerPhotoSelection>();

  const [pickerBusy, setPickerBusy] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [uncertain, setUncertain] =
    useState(false);

  const [error, setError] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [expanded, setExpanded] =
    useState(false);

  const mounted = useRef(false);
  const pickerLock = useRef(false);
  const submissionLock = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const status = member.photo_status;

  const revision = member.photo_revision;

  const canResubmit =
    member.can_resubmit_photo === true &&
    typeof revision === 'number' &&
    Number.isSafeInteger(revision) &&
    revision >= 0 &&
    (
      status === 'missing' ||
      status === 'correction_required'
    );

  const busy = pickerBusy || submitting;

  const expired = Boolean(
    selection &&
    !(Date.parse(selection.expiresAt) >
      Date.now() + 60000)
  );

  function handlePickerBusy(value: boolean) {
    pickerLock.current = value;
    setPickerBusy(value);
    onBusyChange(value);
  }

  async function refreshStatus() {
    if (
      disabled ||
      pickerLock.current ||
      submissionLock.current
    ) {
      return;
    }

    submissionLock.current = true;
    setSubmitting(true);
    onBusyChange(true);

    try {
      await onRefresh();

    } catch (err) {
      if (mounted.current) {
        setError(getVolunteerError(err));
      }

    } finally {
      submissionLock.current = false;

      if (mounted.current) {
        setSubmitting(false);
      }

      onBusyChange(false);
    }
  }

  async function submitPhoto() {
    if (
      !mounted.current ||
      disabled ||
      pickerLock.current ||
      submissionLock.current ||
      uncertain ||
      !canResubmit ||
      !selection ||
      revision === undefined
    ) {
      return;
    }

    if (
      !(Date.parse(selection.expiresAt) >
        Date.now() + 60000)
    ) {
      setError(
        t(
          'volunteer.photoExpired',
          'Photograph upload expired. Please upload it again.'
        )
      );

      return;
    }

    submissionLock.current = true;

    setSubmitting(true);
    setError('');
    setMessage('');

    onBusyChange(true);

    try {
      await resubmitVolunteerPhoto(
        registrationId,
        member.id,
        selection.uploadId,
        revision
      );

      if (!mounted.current) return;

      setSelection(undefined);
      setExpanded(false);
      setUncertain(true);

      setMessage(
        t(
          'volunteer.photoSubmittedForReview',
          'Photograph submitted successfully. Awaiting administrator verification.'
        )
      );

      await onRefresh();

    } catch (err) {
      if (!mounted.current) return;

      setUncertain(true);

      setError(
        getVolunteerError(err) +
        '\n\n' +
        t(
          'volunteer.refreshPhotoBeforeRetry',
          'Refresh My Sevas to confirm the latest photograph status before retrying.'
        )
      );

    } finally {
      submissionLock.current = false;

      if (mounted.current) {
        setSubmitting(false);
      }

      onBusyChange(false);
    }
  }

  function confirmSubmission() {
    if (
      disabled ||
      busy ||
      uncertain ||
      !selection ||
      expired ||
      !canResubmit
    ) {
      return;
    }

    Alert.alert(
      t(
        'volunteer.confirmPhotoSubmission',
        'Confirm Photograph'
      ),
      t(
        'volunteer.confirmPhotoMember',
        'Submit this photograph for'
      ) +
        ' ' +
        member.full_name +
        '?',
      [
        {
          text: t(
            'volunteer.cancel',
            'Cancel'
          ),
          style: 'cancel',
        },
        {
          text: t(
            'volunteer.submit',
            'Submit'
          ),
          onPress: () => void submitPhoto(),
        },
      ]
    );
  }

  if (!status) {
    // Compatibility with older API responses.
    // Do not enable modifications without
    // backend-provided permissions.
    return null;
  }

  // Hide completed photograph processing after ID card issuance.
  // Keep correction and replacement workflows available.
  if (
    status === 'verified' &&
    !!member.id_card &&
    !busy &&
    !uncertain
  ) {
    return null;
  }
  const statusLabels = {
    missing: t(
      'volunteer.photoMissing',
      'Photograph required'
    ),

    pending: t(
      'volunteer.photoPending',
      'Awaiting verification'
    ),

    correction_required: t(
      'volunteer.photoCorrectionRequired',
      'Correction required'
    ),

    resubmitted: t(
      'volunteer.photoResubmitted',
      'Resubmitted — awaiting verification'
    ),

    verified: t(
      'volunteer.photoVerified',
      'Photograph verified'
    ),
  };

  const requiresAttention =
    status === 'missing' ||
    status === 'correction_required';

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>
        {t(
          'volunteer.volunteerPhotograph',
          'Volunteer Photograph'
        )}
      </Text>

      <View
        style={[
          styles.statusBox,
          {
            backgroundColor:
              status === 'verified'
                ? C.lightGreen
                : requiresAttention
                  ? C.lightRed
                  : C.lightGold,
          },
        ]}
      >
        <Text
          style={[
            styles.statusText,
            {
              color:
                status === 'verified'
                  ? C.green
                  : requiresAttention
                    ? C.red
                    : C.maroon,
            },
          ]}
        >
          {statusLabels[status] || status}
        </Text>
      </View>

      {status === 'correction_required' &&
        !!member.photo_review_comment && (
          <View style={styles.commentBox}>
            <Text style={styles.label}>
              {t(
                'volunteer.adminPhotoComment',
                'Administrator Comment'
              )}
            </Text>

            <Text selectable style={styles.comment}>
              {member.photo_review_comment}
            </Text>
          </View>
        )}

      {!!member.photo_uploaded_at && (
        <Text style={styles.description}>
          {t(
            'volunteer.photoUploadedOn',
            'Uploaded on'
          )}
          {': '}
          {formatVolunteerDateTime(
            member.photo_uploaded_at
          )}
          {' IST'}
        </Text>
      )}

      {!!member.photo_reviewed_at && (
        <Text style={styles.description}>
          {t(
            'volunteer.photoReviewedOn',
            'Reviewed on'
          )}
          {': '}
          {formatVolunteerDateTime(
            member.photo_reviewed_at
          )}
          {' IST'}
        </Text>
      )}

      {(status === 'pending' ||
        status === 'resubmitted') && (
        <Text style={styles.description}>
          {t(
            'volunteer.photoAwaitingReviewNote',
            'Your photograph is awaiting administrator verification. Please check this section for updates.'
          )}
        </Text>
      )}

      {status === 'verified' && (
        <Text style={styles.description}>
          {t(
            'volunteer.photoVerifiedNote',
            'Your photograph has been verified for volunteer ID card processing.'
          )}
        </Text>
      )}

      {requiresAttention &&
        !canResubmit && (
          <Text style={styles.description}>
            {t(
              'volunteer.photoReplacementUnavailable',
              'Photograph replacement is currently unavailable. Please contact the temple administrator.'
            )}
          </Text>
        )}

      {canResubmit &&
        !expanded &&
        !uncertain && (
          <View style={styles.buttonGap}>
            <VolunteerButton
              title={
                status === 'missing'
                  ? t(
                      'volunteer.uploadPhoto',
                      'Upload Photograph'
                    )
                  : t(
                      'volunteer.replacePhoto',
                      'Upload New Photograph'
                    )
              }
              disabled={disabled || busy}
              onPress={() =>
                setExpanded(true)
              }
            />
          </View>
        )}

      {canResubmit &&
        expanded &&
        !uncertain && (
          <>
            <VolunteerPhotoPicker
              key={`${member.id}-${revision}`}
              opportunityId={opportunityId}
              value={selection}
              disabled={disabled || submitting}
              onBusyChange={handlePickerBusy}
              onChange={photo => {
                setSelection(photo);
                setError('');
                setMessage('');
              }}
            />

            <VolunteerButton
              title={
                status === 'missing'
                  ? t(
                      'volunteer.submitPhoto',
                      'Submit Photograph'
                    )
                  : t(
                      'volunteer.resubmitPhoto',
                      'Resubmit Photograph'
                    )
              }
              disabled={
                disabled ||
                busy ||
                uncertain ||
                !selection ||
                expired
              }
              onPress={confirmSubmission}
            />

            <View style={styles.buttonGap}>
              <VolunteerButton
                secondary
                title={t(
                  'volunteer.cancel',
                  'Cancel'
                )}
                disabled={busy || disabled}
                onPress={() => {
                  if (
                    pickerLock.current ||
                    submissionLock.current
                  ) {
                    return;
                  }

                  setExpanded(false);
                  setSelection(undefined);
                  setError('');
                }}
              />
            </View>
          </>
        )}

      {submitting && (
        <View style={styles.progress}>
          <ActivityIndicator color={C.maroon} />

          <Text style={styles.description}>
            {t(
              'volunteer.processingPhoto',
              'Processing photograph information...'
            )}
          </Text>
        </View>
      )}

      {!!message && (
        <Text style={styles.success}>
          {message}
        </Text>
      )}

      {!!error && (
        <Text style={styles.error}>
          {error}
        </Text>
      )}

      {uncertain && (
        <View style={styles.buttonGap}>
          <VolunteerButton
            title={t(
              'volunteer.refreshPhotoStatus',
              'Refresh Photograph Status'
            )}
            secondary
            disabled={busy || disabled}
            onPress={() =>
              void refreshStatus()
            }
          />
        </View>
      )}

      {status !== 'verified' && (
        <Text style={styles.note}>
          {t(
            'volunteer.photoApprovalUnaffected',
            'Photograph submission does not change your existing registration approval status.'
          )}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },

  heading: {
    color: C.maroon,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },

  statusBox: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  statusText: {
    fontSize: 14,
    fontWeight: '700',
  },

  description: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 21,
    marginBottom: 7,
  },

  commentBox: {
    backgroundColor: C.lightRed,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  label: {
    color: C.red,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },

  comment: {
    color: C.red,
    fontSize: 14,
    lineHeight: 22,
  },

  buttonGap: {
    marginTop: 10,
  },

  progress: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },

  success: {
    backgroundColor: C.lightGreen,
    color: C.green,
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
    marginTop: 10,
  },

  error: {
    backgroundColor: C.lightRed,
    color: C.red,
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
  },

  note: {
    fontSize: 11,
    lineHeight: 18,
    color: C.muted,
    marginTop: 14,
  },
});