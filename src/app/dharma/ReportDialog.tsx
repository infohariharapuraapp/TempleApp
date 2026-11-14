import { useTranslation } from 'react-i18next';
import dharmaI18n from '@/localization/i18n';

import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  reportDharmaContent,
} from '@/services/dharmaApi';


function localizeDharmaError(value: string): string {
  const key = value.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const translationKey = 'dharmaLocal.' + key;
  return dharmaI18n.exists(translationKey)
    ? String(dharmaI18n.t(translationKey))
    : String(dharmaI18n.t(
        'dharmaLocal.something_went_wrong_please_try_again'
      ));
}

const COLORS = {
  background: '#FFFDF8',
  white: '#FFFFFF',
  maroon: '#6B1720',
  gold: '#C69A3A',
  cream: '#F7EBD7',
  text: '#30241F',
  muted: '#8E8175',
  border: '#E8DCCB',
};

const REPORT_REASONS = [
  'Inappropriate or offensive content',
  'Incorrect or misleading information',
  'Spam or promotional content',
  'Disrespectful towards religious traditions',
  'Unrelated to temple or Dharma',
  'Other concern',
];

type ReportDialogProps = {
  visible: boolean;
  target:
    | { type: 'question'; id: number }
    | { type: 'answer'; id: number }
    | null;
  onClose: () => void;
};

export default function ReportDialog({
  visible,
  target,
  onClose,
}: ReportDialogProps) {
  // DHARMA_LANGUAGE_V1
  const { t } = useTranslation();

  const [selectedReason, setSelectedReason] =
    useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;

    setSelectedReason(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!target || submitting) return;

    if (!selectedReason) {
      Alert.alert(t('dharmaLocal.select_reason'), t('dharmaLocal.please_select_a_reason_for_reporting')
      );
      return;
    }

    setSubmitting(true);

    try {
      const payload =
        target.type === 'question'
          ? {
              question_id: target.id,
              reason: selectedReason,
            }
          : {
              answer_id: target.id,
              reason: selectedReason,
            };

      const response = await reportDharmaContent(
        payload
      ) as {
        success: boolean;
        message?: string;
      };

      if (!response.success) {
        throw new Error(
          response.message || 'Unable to submit report.'
        );
      }

      setSelectedReason(null);
      onClose();

      Alert.alert(t('dharmaLocal.report_submitted'), t('dharmaLocal.your_report_has_been_submitted_to_the_temple_administration_for_review')
      );
    } catch (error) {
      Alert.alert(t('dharmaLocal.report_failed'),
        error instanceof Error
        ? localizeDharmaError(error.message)
        : t('dharmaLocal.unable_to_submit_your_report_please_try_again')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
        />

        <View style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons
                name="flag-outline"
                size={22}
                color={COLORS.maroon}
              />
            </View>

            <View style={styles.headerText}>
              <Text style={styles.title}>
                {target?.type === 'question'
        ? t('dharmaLocal.report_question')
        : t('dharmaLocal.report_answer')}
              </Text>

              <Text style={styles.subtitle}>{t('dharmaLocal.help_keep_dharma_sandeham_respectful')}</Text>
            </View>

            <TouchableOpacity
              onPress={handleClose}
              disabled={submitting}
            >
              <Ionicons
                name="close"
                size={23}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>{t('dharmaLocal.why_are_you_reporting_this')}</Text>

          <ScrollView
            style={styles.reasonsScroll}
            showsVerticalScrollIndicator={false}
          >
            {REPORT_REASONS.map((reason) => {
              const selected =
                selectedReason === reason;

              return (
                <TouchableOpacity
                  key={reason}
                  onPress={() =>
                    setSelectedReason(reason)
                  }
                  disabled={submitting}
                  style={[
                    styles.reasonItem,
                    selected && styles.reasonSelected,
                  ]}
                >
                  <Ionicons
                    name={
                      selected
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={20}
                    color={
                      selected
                        ? COLORS.maroon
                        : COLORS.muted
                    }
                  />

                  <Text style={styles.reasonText}>
                    {t('dharmaLocal.' + reason.toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, ''))}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.infoBox}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={COLORS.maroon}
            />

            <Text style={styles.infoText}>{t('dharmaLocal.reports_are_reviewed_by_temple_admins_reporting_does_not_automatically_remove_content')}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedReason || submitting) &&
                styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={!selectedReason || submitting}
          >
            {submitting ? (
              <ActivityIndicator
                color={COLORS.white}
              />
            ) : (
              <Ionicons
                name="flag-outline"
                size={18}
                color={COLORS.white}
              />
            )}

            <Text style={styles.submitText}>
              {submitting
                ? t('dharmaLocal.submitting_report')
                : t('dharmaLocal.submit_report')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClose}
            disabled={submitting}
          >
            <Text style={styles.cancelText}>{t('dharmaLocal.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: COLORS.background,
    borderRadius: 22,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 23,
  },
  headerIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: COLORS.maroon,
    fontSize: 19,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },
  sectionLabel: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 12,
  },
  reasonsScroll: {
    flexGrow: 0,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 9,
  },
  reasonSelected: {
    borderColor: COLORS.maroon,
    backgroundColor: COLORS.cream,
  },
  reasonText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 9,
    padding: 12,
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.maroon,
  },
  submitButton: {
    backgroundColor: COLORS.maroon,
    paddingVertical: 15,
    borderRadius: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 13,
  },
  cancelText: {
    color: COLORS.muted,
    fontWeight: '700',
    fontSize: 13,
  },
});
