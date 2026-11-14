import { useTranslation } from 'react-i18next';

import React, { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { apiRequest } from '@/services/api';
import { getToken } from '@/services/authStorage';

// ========================================
// TYPES
// ========================================

type User = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  role?: string;
  created_at?: string;
};

// ========================================
// PROFILE SCREEN
// ========================================

export default function ProfileScreen() {
  // ACCOUNT_LANGUAGE_V1
  const { t, i18n } = useTranslation();
  const localizeAccountError = (
    message: unknown,
    fallback: string
  ): string => {
    if (typeof message !== 'string') {
      return fallback;
    }
    const knownMessages: Record<string, string> = {
      "TEMPLE ACCOUNT": "accountLocal.temple_account",
      "My Account": "accountLocal.my_account",
      "My Profile": "accountLocal.my_profile",
      "Your personal information and temple services": "accountLocal.your_personal_information_and_temple_services",
      "Devotee": "accountLocal.devotee",
      "Temple Devotee": "accountLocal.temple_devotee",
      "Edit": "accountLocal.edit",
      "Profile Details": "accountLocal.profile_details",
      "Loading...": "accountLocal.loading",
      "Loading your details...": "accountLocal.loading_your_details",
      "Loading your profile...": "accountLocal.loading_your_profile",
      "Full Name": "accountLocal.full_name",
      "Email Address": "accountLocal.email_address",
      "Phone Number": "accountLocal.phone_number",
      "Mobile Number": "accountLocal.mobile_number",
      "Not available": "accountLocal.not_available",
      "Account": "accountLocal.account",
      "Edit Profile": "accountLocal.edit_profile",
      "Update your personal information": "accountLocal.update_your_personal_information",
      "My Bookings": "accountLocal.my_bookings",
      "View your room and seva bookings": "accountLocal.view_your_room_and_seva_bookings",
      "Your Spiritual Journey": "accountLocal.your_spiritual_journey",
      "Stay connected with the temple through your bookings, prayers and devotional activities.": "accountLocal.stay_connected_with_the_temple_through_your_bookings_prayers_and_devotional_activities",
      "Logout": "accountLocal.logout",
      "Delete My Account": "accountLocal.delete_my_account",
      "Back to Home": "accountLocal.back_to_home",
      "Account Error": "accountLocal.account_error",
      "Unable to load account": "accountLocal.unable_to_load_account",
      "Unable to load your account details.": "accountLocal.unable_to_load_your_account_details",
      "Are you sure you want to logout?": "accountLocal.are_you_sure_you_want_to_logout",
      "Cancel": "accountLocal.cancel",
      "Logout Failed": "accountLocal.logout_failed",
      "Unable to logout. Please try again.": "accountLocal.unable_to_logout_please_try_again",
      "Failed to load profile": "accountLocal.failed_to_load_profile",
      "Profile Error": "accountLocal.profile_error",
      "Unable to load profile": "accountLocal.unable_to_load_profile",
      "My Temple Activities": "accountLocal.my_temple_activities",
      "View your temple bookings": "accountLocal.view_your_temple_bookings",
      "My Donations": "accountLocal.my_donations",
      "View your donation history": "accountLocal.view_your_donation_history",
      "Deities": "accountLocal.deities",
      "Explore temple deities": "accountLocal.explore_temple_deities",
      "Temple Events": "accountLocal.temple_events",
      "View upcoming events": "accountLocal.view_upcoming_events",
      "Temple Information": "accountLocal.temple_information",
      "About Temple": "accountLocal.about_temple",
      "Learn about our temple": "accountLocal.learn_about_our_temple",
      "Temple Location": "accountLocal.temple_location",
      "Find the temple and directions": "accountLocal.find_the_temple_and_directions",
      "Settings": "accountLocal.settings",
      "Notifications": "accountLocal.notifications",
      "Manage notification preferences": "accountLocal.manage_notification_preferences",
      "App Settings": "accountLocal.app_settings",
      "Manage your app preferences": "accountLocal.manage_your_app_preferences",
      "About App": "accountLocal.about_app",
      "Temple App information": "accountLocal.temple_app_information",
      "May the divine blessings be with you always.": "accountLocal.may_the_divine_blessings_be_with_you_always",
      "Error": "accountLocal.error",
      "Invalid Name": "accountLocal.invalid_name",
      "Enter a name between 2 and 100 characters.": "accountLocal.enter_a_name_between_2_and_100_characters",
      "Invalid Phone": "accountLocal.invalid_phone",
      "Enter a valid 10-digit Indian mobile number.": "accountLocal.enter_a_valid_10_digit_indian_mobile_number",
      "Unable to update profile": "accountLocal.unable_to_update_profile",
      "Success": "accountLocal.success",
      "Your profile has been updated successfully.": "accountLocal.your_profile_has_been_updated_successfully",
      "OK": "accountLocal.ok",
      "Update Failed": "accountLocal.update_failed",
      "Please try again.": "accountLocal.please_try_again",
      "‹ Back": "accountLocal.back",
      "Update your devotee account information.": "accountLocal.update_your_devotee_account_information",
      "Enter your full name": "accountLocal.enter_your_full_name",
      "Your registered email cannot be changed.": "accountLocal.your_registered_email_cannot_be_changed",
      "Mobile number changes will require OTP verification.": "accountLocal.mobile_number_changes_will_require_otp_verification",
      "Save Changes": "accountLocal.save_changes",
      "Session Expired": "accountLocal.session_expired",
      "Please log in again.": "accountLocal.please_log_in_again",
      "Unable to delete account.": "accountLocal.unable_to_delete_account",
      "Account Deleted": "accountLocal.account_deleted",
      "Your temple app account has been deleted.": "accountLocal.your_temple_app_account_has_been_deleted",
      "Deletion Failed": "accountLocal.deletion_failed",
      "Password Required": "accountLocal.password_required",
      "Enter your account password to continue.": "accountLocal.enter_your_account_password_to_continue",
      "Permanently Delete Account?": "accountLocal.permanently_delete_account",
      "This action cannot be undone. Your temple app login and profile will be deleted. Separate website bookings are managed through the temple website.": "accountLocal.this_action_cannot_be_undone_your_temple_app_login_and_profile_will_be_deleted_separate_website_bookings_are_managed_through_the_temple_website",
      "Delete Permanently": "accountLocal.delete_permanently",
      "ACCOUNT SETTINGS": "accountLocal.account_settings",
      "Permanent Account Deletion": "accountLocal.permanent_account_deletion",
      "Deleting your account is permanent and cannot be undone.": "accountLocal.deleting_your_account_is_permanent_and_cannot_be_undone",
      "Your temple app profile and login credentials will be removed. Some community contributions may remain without your name.": "accountLocal.your_temple_app_profile_and_login_credentials_will_be_removed_some_community_contributions_may_remain_without_your_name",
      "Room and seva bookings made through the separate temple website are managed by that website.": "accountLocal.room_and_seva_bookings_made_through_the_separate_temple_website_are_managed_by_that_website",
      "Confirm your password": "accountLocal.confirm_your_password",
      "Enter your password": "accountLocal.enter_your_password",
      "Delete My Account Permanently": "accountLocal.delete_my_account_permanently",
      "Cancel — Keep My Account": "accountLocal.cancel_keep_my_account"
    };
    const clean = message.trim();
    const key = Object.prototype.hasOwnProperty.call(
      knownMessages,
      clean
    )
      ? knownMessages[clean]
      : null;
    return key
      ? String(i18n.t(key))
      : fallback;
  };

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ========================================
  // LOAD PROFILE
  // ========================================

  const loadProfile = async () => {
    try {
      setLoading(true);

      const token = await getToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await apiRequest('/auth/me', {
        method: 'GET',
        token,
      });

      if (response.success && response.data) {
        setUser(response.data);
      } else {
        throw new Error(
          response.message || 'Failed to load profile'
        );
      }
    } catch (error: any) {
      console.error('Profile error:', error);

      Alert.alert(t('accountLocal.profile_error'),
        localizeAccountError(error?.message, t('accountLocal.unable_to_load_profile'))
      );
    } finally {
      setLoading(false);
    }
  };

  // Refresh profile when returning from Edit Profile
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [t])
  );

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#6B1720"
          />

          <Text style={styles.loadingText}>{t('accountLocal.loading_your_profile')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = user?.full_name || t('accountLocal.devotee');
  const firstLetter = displayName.charAt(0).toUpperCase();

  // ========================================
  // SCREEN
  // ========================================

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.smallText}>{t('accountLocal.temple_account')}</Text>

            <Text style={styles.title}>{t('accountLocal.my_profile')}</Text>

            <Text style={styles.subtitle}>{t('accountLocal.your_personal_information_and_temple_services')}</Text>
          </View>

          <View style={styles.profileCircle}>
            <Text style={styles.profileIcon}>
              🙏
            </Text>
          </View>
        </View>

        {/* DEVOTEE CARD */}

        <View style={styles.devoteeCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {firstLetter}
            </Text>
          </View>

          <View style={styles.devoteeInfo}>
            <Text style={styles.devoteeName}>
              {displayName}
            </Text>

            <Text style={styles.devoteeText}>{t('accountLocal.temple_devotee')}</Text>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.editText}>{t('accountLocal.edit')}</Text>
          </TouchableOpacity>
        </View>

        {/* PROFILE DETAILS */}

        <Text style={styles.sectionTitle}>{t('accountLocal.profile_details')}</Text>

        <View style={styles.detailsCard}>
          <DetailRow
            icon="👤"
            label={t('accountLocal.full_name')}
            value={user?.full_name || t('accountLocal.not_available')}
          />

          <View style={styles.detailDivider} />

          <DetailRow
            icon="✉️"
            label={t('accountLocal.email_address')}
            value={user?.email || t('accountLocal.not_available')}
          />

          <View style={styles.detailDivider} />

          <DetailRow
            icon="📱"
            label={t('accountLocal.phone_number')}
            value={user?.phone || t('accountLocal.not_available')}
          />
        </View>

        {/* MY TEMPLE ACTIVITIES */}

        <Text style={styles.sectionTitle}>{t('accountLocal.my_temple_activities')}</Text>

        <View style={styles.menuCard}>
          {/* MY BOOKINGS - EXISTING WEBVIEW */}

          <ProfileRow
            icon="🎫"
            title={t('accountLocal.my_bookings')}
            subtitle={t('accountLocal.view_your_temple_bookings')}
            onPress={() =>
              router.push('/website-bookings')
            }
          />

          <ProfileRow
            icon="💰"
            title={t('accountLocal.my_donations')}
            subtitle={t('accountLocal.view_your_donation_history')}
            onPress={() =>
              router.push('/donations')
            }
          />

          <ProfileRow
            icon="🛕"
            title={t('accountLocal.deities')}
            subtitle={t('accountLocal.explore_temple_deities')}
            onPress={() =>
              router.push('/deities')
            }
          />

          <ProfileRow
            icon="📅"
            title={t('accountLocal.temple_events')}
            subtitle={t('accountLocal.view_upcoming_events')}
            onPress={() =>
              router.push('/events')
            }
            last
          />
        </View>

        {/* TEMPLE INFORMATION */}

        <Text style={styles.sectionTitle}>{t('accountLocal.temple_information')}</Text>

        <View style={styles.menuCard}>
          <ProfileRow
            icon="🛕"
            title={t('accountLocal.about_temple')}
            subtitle={t('accountLocal.learn_about_our_temple')}
            onPress={() =>
              router.push('/about')
            }
          />

          <ProfileRow
            icon="📍"
            title={t('accountLocal.temple_location')}
            subtitle={t('accountLocal.find_the_temple_and_directions')}
            onPress={() =>
              router.push('/nearby')
            }
            last
          />
        </View>

        {/* SETTINGS */}

        <Text style={styles.sectionTitle}>{t('accountLocal.settings')}</Text>

        <View style={styles.menuCard}>
          <ProfileRow
            icon="🔔"
            title={t('accountLocal.notifications')}
            subtitle={t('accountLocal.manage_notification_preferences')}
            onPress={() => {}}
          />

          <ProfileRow
            icon="⚙️"
            title={t('accountLocal.app_settings')}
            subtitle={t('accountLocal.manage_your_app_preferences')}
            onPress={() => {}}
          />

          <ProfileRow
            icon="ℹ️"
            title={t('accountLocal.about_app')}
            subtitle={t('accountLocal.temple_app_information')}
            onPress={() => {}}
            last
          />
        </View>

        {/* FOOTER */}

        <Text style={styles.footerText}>{t('accountLocal.may_the_divine_blessings_be_with_you_always')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ========================================
// PROFILE DETAIL ROW
// ========================================

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Text style={styles.detailIconText}>
          {icon}
        </Text>
      </View>

      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>
          {label}
        </Text>

        <Text
          style={styles.detailValue}
          selectable
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

// ========================================
// PROFILE MENU ROW
// ========================================

function ProfileRow({
  icon,
  title,
  subtitle,
  onPress,
  last = false,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.profileRow,
        !last && styles.profileRowBorder,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowIcon}>
        <Text style={styles.rowIconText}>
          {icon}
        </Text>
      </View>

      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>
          {title}
        </Text>

        <Text style={styles.rowSubtitle}>
          {subtitle}
        </Text>
      </View>

      <Text style={styles.arrow}>
        ›
      </Text>
    </TouchableOpacity>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF8',
  },

  content: {
    padding: 20,
    paddingBottom: 45,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#8E8175',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },

  headerText: {
    flex: 1,
    paddingRight: 12,
  },

  smallText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: '#C69A3A',
    marginBottom: 5,
  },

  title: {
    fontSize: 27,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 5,
  },

  subtitle: {
    fontSize: 12,
    color: '#8E8175',
    lineHeight: 18,
  },

  profileCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F7EBD7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileIcon: {
    fontSize: 25,
  },

  devoteeCard: {
    backgroundColor: '#F7EBD7',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#6B1720',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 23,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  devoteeInfo: {
    flex: 1,
    marginLeft: 14,
  },

  devoteeName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 5,
  },

  devoteeText: {
    fontSize: 12,
    color: '#8E8175',
  },

  editButton: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },

  editText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B1720',
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 12,
    marginTop: 4,
  },

  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },

  detailIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F7EBD7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  detailIconText: {
    fontSize: 19,
  },

  detailContent: {
    flex: 1,
    marginLeft: 13,
  },

  detailLabel: {
    fontSize: 11,
    color: '#8E8175',
    marginBottom: 5,
  },

  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A2C18',
    lineHeight: 20,
  },

  detailDivider: {
    height: 1,
    backgroundColor: '#F0E7DD',
  },

  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 22,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },

  profileRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  profileRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0E7DD',
  },

  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F7EBD7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  rowIconText: {
    fontSize: 19,
  },

  rowContent: {
    flex: 1,
    marginLeft: 13,
  },

  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 3,
  },

  rowSubtitle: {
    fontSize: 11,
    color: '#8E8175',
  },

  arrow: {
    fontSize: 25,
    color: '#C69A3A',
    marginLeft: 8,
  },

  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#8E8175',
    fontStyle: 'italic',
    marginTop: 18,
  },
});
