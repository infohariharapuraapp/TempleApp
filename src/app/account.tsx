import { useTranslation } from 'react-i18next';

import React, { useCallback, useState } from 'react';
import { notifyAuthChanged } from '@/services/authSession';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '@/services/api';

import {
  getToken,
  removeToken,
} from '@/services/authStorage';

// ========================================
// TYPES
// ========================================

type User = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  role?: string;
};

// ========================================
// ACCOUNT SCREEN
// ========================================

export default function AccountScreen() {
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
  // LOAD LOGGED-IN USER
  // ========================================

  const loadUser = async () => {
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
        return;
      }

      throw new Error(
        response.message || 'Unable to load account'
      );
    } catch (error: any) {
      console.error('Failed to load account:', error);

      Alert.alert(t('accountLocal.account_error'),
        localizeAccountError(error?.message, t('accountLocal.unable_to_load_your_account_details'))
      );
    } finally {
      setLoading(false);
    }
  };

  // Reload profile when returning from Edit Profile
  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [t])
  );

  // ========================================
  // LOGOUT
  // ========================================

  const handleLogout = () => {
  Alert.alert(t('accountLocal.logout'),
    t('accountLocal.are_you_sure_you_want_to_logout'),
    [
      {
        text: t('accountLocal.cancel'),
        style: 'cancel',
      },
      {
        text: t('accountLocal.logout'),
        style: 'destructive',
        onPress: async () => {
          try {
            // Remove saved JWT
            await removeToken();

            // Update authentication state
            notifyAuthChanged(false);

            // Navigate to Login
            router.replace('/login');
          } catch (error) {
            console.error('Logout error:', error);

            Alert.alert(t('accountLocal.logout_failed'),
              t('accountLocal.unable_to_logout_please_try_again')
            );
          }
        },
      },
    ]
  );
};
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
            <Text style={styles.label}>{t('accountLocal.temple_account')}</Text>

            <Text style={styles.title}>{t('accountLocal.my_account')}</Text>

            <Text style={styles.subtitle}>{t('accountLocal.your_personal_information_and_temple_services')}</Text>
          </View>

          <View style={styles.headerIcon}>
            <Text style={styles.headerEmoji}>
              🙏
            </Text>
          </View>
        </View>

        {/* PROFILE CARD */}

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {loading ? '🙏' : firstLetter}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.name}>
              {loading ? t('accountLocal.loading') : displayName}
            </Text>

            <Text style={styles.profileSubtitle}>{t('accountLocal.temple_devotee')}</Text>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.editButtonText}>{t('accountLocal.edit')}</Text>
          </TouchableOpacity>
        </View>

        {/* PROFILE DETAILS */}

        <Text style={styles.sectionTitle}>{t('accountLocal.profile_details')}</Text>

        <View style={styles.detailsCard}>
          {loading ? (
            <View style={styles.loadingDetails}>
              <ActivityIndicator
                size="small"
                color="#6B1720"
              />

              <Text style={styles.loadingText}>{t('accountLocal.loading_your_details')}</Text>
            </View>
          ) : (
            <>
              <DetailRow
                icon="👤"
                label={t('accountLocal.full_name')}
                value={user?.full_name || t('accountLocal.not_available')}
              />

              <View style={styles.divider} />

              <DetailRow
                icon="✉️"
                label={t('accountLocal.email_address')}
                value={user?.email || t('accountLocal.not_available')}
              />

              <View style={styles.divider} />

              <DetailRow
                icon="📱"
                label={t('accountLocal.phone_number')}
                value={user?.phone || t('accountLocal.not_available')}
              />
            </>
          )}
        </View>

        {/* ACCOUNT OPTIONS */}

        <Text style={styles.sectionTitle}>{t('accountLocal.account')}</Text>

        <View style={styles.card}>
          <AccountItem
            icon="👤"
            title={t('accountLocal.edit_profile')}
            description={t('accountLocal.update_your_personal_information')}
            onPress={() => router.push('/edit-profile')}
          />

          {/* KEEP EXISTING MY BOOKINGS WEBVIEW */}

          <AccountItem
            icon="🎫"
            title={t('accountLocal.my_bookings')}
            description={t('accountLocal.view_your_room_and_seva_bookings')}
            onPress={() => router.push('/website-bookings')}
            last
          />
        </View>

        {/* SPIRITUAL JOURNEY */}

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>
            🙏
          </Text>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>{t('accountLocal.your_spiritual_journey')}</Text>

            <Text style={styles.infoText}>{t('accountLocal.stay_connected_with_the_temple_through_your_bookings_prayers_and_devotional_activities')}</Text>
          </View>
        </View>

        {/* LOGOUT */}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutIcon}>
            ↪
          </Text>

          <Text style={styles.logoutButtonText}>{t('accountLocal.logout')}</Text>
        </TouchableOpacity>


{/* DELETE ACCOUNT */}

<TouchableOpacity
  style={styles.deleteAccountButton}
  onPress={() => router.push('/delete-account' as any)}
  activeOpacity={0.8}
>
  <Text style={styles.deleteAccountButtonText}>{t('accountLocal.delete_my_account')}</Text>
</TouchableOpacity>




        {/* BACK TO HOME */}

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={styles.homeButtonText}>{t('accountLocal.back_to_home')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ========================================
// DETAIL ROW
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
// ACCOUNT ITEM
// ========================================

function AccountItem({
  icon,
  title,
  description,
  onPress,
  last = false,
}: {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.item,
        !last && styles.itemBorder,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.itemIcon}>
        <Text style={styles.itemIconText}>
          {icon}
        </Text>
      </View>

      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>
          {title}
        </Text>

        <Text style={styles.itemDescription}>
          {description}
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

  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#C69A3A',
    marginBottom: 5,
  },

  title: {
    fontSize: 27,
    fontWeight: '700',
    color: '#6B1720',
  },

  subtitle: {
    fontSize: 12,
    color: '#8E8175',
    marginTop: 5,
    lineHeight: 18,
  },

  headerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F7EBD7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerEmoji: {
    fontSize: 24,
  },

  profileCard: {
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  avatarText: {
    fontSize: 23,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  profileInfo: {
    flex: 1,
  },

  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 4,
  },

  profileSubtitle: {
    fontSize: 12,
    color: '#8E8175',
  },

  editButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },

  editButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B1720',
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 12,
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

  loadingDetails: {
    paddingVertical: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginLeft: 10,
    fontSize: 12,
    color: '#8E8175',
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
    alignItems: 'center',
    justifyContent: 'center',
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

  divider: {
    height: 1,
    backgroundColor: '#F0E7DD',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E8DCCB',
    marginBottom: 23,
  },

  item: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0E7DD',
  },

  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F7EBD7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  itemIconText: {
    fontSize: 20,
  },

  itemContent: {
    flex: 1,
  },

  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 3,
  },

  itemDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: '#8E8175',
  },

  arrow: {
    fontSize: 24,
    color: '#C69A3A',
    marginLeft: 8,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8DCCB',
    marginBottom: 20,
  },

  infoIcon: {
    fontSize: 27,
    marginRight: 12,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 4,
  },

  infoText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#8E8175',
  },

  logoutButton: {
    height: 48,
    borderRadius: 15,
    backgroundColor: '#F7EBD7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  logoutIcon: {
    fontSize: 20,
    color: '#6B1720',
    marginRight: 8,
  },

  logoutButtonText: {
    color: '#6B1720',
    fontSize: 13,
    fontWeight: '700',
  },

deleteAccountButton: {
  height: 48,
  borderRadius: 15,
  backgroundColor: '#FFF1F0',
  borderWidth: 1,
  borderColor: '#D9534F',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 10,
},

deleteAccountButtonText: {
  color: '#B42318',
  fontSize: 13,
  fontWeight: '700',
},


  homeButton: {
    height: 48,
    borderRadius: 15,
    backgroundColor: '#6B1720',
    alignItems: 'center',
    justifyContent: 'center',
  },

  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
