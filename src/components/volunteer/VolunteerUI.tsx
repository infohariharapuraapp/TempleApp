import React, {
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { router } from 'expo-router';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import { useTranslation } from 'react-i18next';

// ========================================
// THEME
// ========================================

export const VOLUNTEER_COLORS = {
  background: '#FFF9F0',
  white: '#FFFFFF',
  maroon: '#6B1720',
  maroonDark: '#541018',
  gold: '#C69A3A',
  lightGold: '#F7EBD7',
  text: '#38251C',
  muted: '#85756A',
  border: '#EADFCC',
  green: '#267448',
  lightGreen: '#E8F5EC',
  warning: '#956413',
  lightWarning: '#FFF2D5',
  red: '#B42318',
  lightRed: '#FDECE9',
};

// ========================================
// SCREEN
// ========================================

export function VolunteerScreen({
  title,
  children,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
          style={styles.backButton}
          onPress={() => {
            if (onBack) {
              onBack();
              return;
            }
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
        >
          <Text style={styles.backText}>
            ‹
          </Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {title}
        </Text>
      </View>

      <View style={styles.body}>
        {children}
      </View>
    </SafeAreaView>
  );
}

// ========================================
// BUTTON
// ========================================

export function VolunteerButton({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondaryButton,
        disabled && styles.disabledButton,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.secondaryText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

// ========================================
// LOADING
// ========================================

export function VolunteerLoading() {
  const { t } = useTranslation();

  return (
    <View style={styles.center}>
      <ActivityIndicator
        size="large"
        color={VOLUNTEER_COLORS.maroon}
      />

      <Text style={styles.message}>
        {t(
          'volunteer.loading',
          'Loading Seva information...'
        )}
      </Text>
    </View>
  );
}

// ========================================
// EMPTY STATE
// ========================================

export function VolunteerEmpty({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyIcon}>
        🙏
      </Text>

      <Text style={styles.emptyTitle}>
        {title}
      </Text>

      <Text style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

// ========================================
// ERROR STATE
// ========================================

export function VolunteerError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>
        {t(
          'volunteer.unableToLoad',
          'Unable to load information'
        )}
      </Text>

      <Text style={styles.message}>
        {message}
      </Text>

      <View style={styles.retryButton}>
        <VolunteerButton
          title={t(
            'volunteer.retry',
            'Try Again'
          )}
          onPress={onRetry}
        />
      </View>
    </View>
  );
}

// ========================================
// COVER IMAGE WITH FALLBACK
// ========================================

export function VolunteerCover({
  uri,
}: {
  uri?: string | null;
}) {
  const [failed, setFailed] =
    useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (
    !uri ||
    !uri.startsWith('https://') ||
    failed
  ) {
    return (
      <View style={styles.imageFallback}>
        <Text style={styles.fallbackIcon}>
          🙏
        </Text>

        <Text style={styles.fallbackTitle}>
          DIVYAKSHETRA HARIHARAPURA
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.cover}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

// ========================================
// STATUS
// ========================================

export function VolunteerStatusBadge({
  status,
}: {
  status: string;
}) {
  const { t } = useTranslation();

  const labels: Record<string, string> = {
    open: 'Registration Open',
    upcoming: 'Opening Soon',
    closed: 'Registration Closed',
    pending: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    assigned: 'Duty Assigned',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  const positive = [
    'open',
    'approved',
    'assigned',
    'completed',
    'in_progress',
  ].includes(status);

  const negative = [
    'closed',
    'rejected',
    'cancelled',
  ].includes(status);

  const background = positive
    ? VOLUNTEER_COLORS.lightGreen
    : negative
      ? VOLUNTEER_COLORS.lightRed
      : VOLUNTEER_COLORS.lightWarning;

  const color = positive
    ? VOLUNTEER_COLORS.green
    : negative
      ? VOLUNTEER_COLORS.red
      : VOLUNTEER_COLORS.warning;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: background },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          { color },
        ]}
      >
        {t(
          `volunteer.status.${status}`,
          labels[status] || status
        )}
      </Text>
    </View>
  );
}

// ========================================
// INFORMATION ROW
// ========================================

export function VolunteerInfo({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {value ?? '—'}
      </Text>
    </View>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VOLUNTEER_COLORS.maroon,
  },

  body: {
    flex: 1,
    backgroundColor: VOLUNTEER_COLORS.background,
  },

  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VOLUNTEER_COLORS.maroon,
    paddingHorizontal: 12,
  },

  backButton: {
    width: 44,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },

  backText: {
    fontSize: 38,
    color: '#FFFFFF',
  },

  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    marginLeft: 8,
  },

  button: {
    backgroundColor: VOLUNTEER_COLORS.maroon,
    minHeight: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },

  secondaryButton: {
    backgroundColor: VOLUNTEER_COLORS.lightGold,
    borderWidth: 1,
    borderColor: VOLUNTEER_COLORS.border,
  },

  secondaryText: {
    color: VOLUNTEER_COLORS.maroon,
  },

  disabledButton: {
    opacity: 0.45,
  },

  center: {
    paddingHorizontal: 25,
    paddingVertical: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },

  message: {
    color: VOLUNTEER_COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
  },

  emptyIcon: {
    fontSize: 42,
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: VOLUNTEER_COLORS.maroon,
    textAlign: 'center',
  },

  retryButton: {
    marginTop: 20,
    width: '100%',
    maxWidth: 260,
  },

  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: VOLUNTEER_COLORS.lightGold,
  },

  imageFallback: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: VOLUNTEER_COLORS.maroonDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },

  fallbackIcon: {
    fontSize: 42,
  },

  fallbackTitle: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: VOLUNTEER_COLORS.gold,
    textAlign: 'center',
  },

  badge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  infoRow: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: VOLUNTEER_COLORS.border,
  },

  infoLabel: {
    fontSize: 12,
    color: VOLUNTEER_COLORS.muted,
    marginBottom: 5,
  },

  infoValue: {
    fontSize: 14,
    color: VOLUNTEER_COLORS.text,
    fontWeight: '600',
    lineHeight: 21,
  },
});