import AutoTranslatedText from '@/components/AutoTranslatedText';

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
      Alert.alert(
        'Select Reason',
        'Please select a reason for reporting.'
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

      Alert.alert(
        'Report Submitted',
        'Your report has been submitted to the temple administration for review.'
      );
    } catch (error) {
      Alert.alert(
        'Report Failed',
        error instanceof Error
          ? error.message
          : 'Unable to submit your report. Please try again.'
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
                Report {target?.type === 'question'
                  ? 'Question'
                  : 'Answer'}
              </Text>

              <AutoTranslatedText style={styles.subtitle}>
                Help keep Dharma Sandeham respectful.
              </AutoTranslatedText>
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

          <AutoTranslatedText style={styles.sectionLabel}>
            WHY ARE YOU REPORTING THIS?
          </AutoTranslatedText>

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
                    {reason}
                  </Text>
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

            <AutoTranslatedText style={styles.infoText}>
              Reports are reviewed by temple admins.
              Reporting does not automatically remove content.
            </AutoTranslatedText>
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
                ? 'Submitting Report...'
                : 'Submit Report'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClose}
            disabled={submitting}
          >
            <AutoTranslatedText style={styles.cancelText}>
              Cancel
            </AutoTranslatedText>
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
