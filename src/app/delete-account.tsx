import { useTranslation } from 'react-i18next';

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '@/services/api';
import { getToken, removeToken } from '@/services/authStorage';
import { notifyAuthChanged } from '@/services/authSession';

export default function DeleteAccountScreen() {
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

  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    if (deleting) return;

    try {
      setDeleting(true);

      const token = await getToken();

      if (!token) {
        Alert.alert(t('accountLocal.session_expired'),
          t('accountLocal.please_log_in_again')
        );
        router.replace('/login');
        return;
      }

      const response = await apiRequest('/auth/account', {
        method: 'DELETE',
        token,
        body: { password },
      });

      if (!response.success) {
        throw new Error(
          response.message || 'Unable to delete account.'
        );
      }

      await removeToken();
      notifyAuthChanged(false);
      setPassword('');

      Alert.alert(t('accountLocal.account_deleted'),
        t('accountLocal.your_temple_app_account_has_been_deleted'),
        [
          {
            text: t('accountLocal.ok'),
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(t('accountLocal.deletion_failed'),
        localizeAccountError(error?.message, t('accountLocal.please_try_again'))
      );
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeletion = () => {
    if (!password.trim()) {
      Alert.alert(t('accountLocal.password_required'),
        t('accountLocal.enter_your_account_password_to_continue')
      );
      return;
    }

    Alert.alert(t('accountLocal.permanently_delete_account'),
      t('accountLocal.this_action_cannot_be_undone_your_temple_app_login_and_profile_will_be_deleted_separate_website_bookings_are_managed_through_the_temple_website'),
      [
        { text: t('accountLocal.cancel'), style: 'cancel' },
        {
          text: t('accountLocal.delete_permanently'),
          style: 'destructive',
          onPress: deleteAccount,
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>{t('accountLocal.account_settings')}</Text>

        <Text style={styles.title}>{t('accountLocal.delete_my_account')}</Text>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>{t('accountLocal.permanent_account_deletion')}</Text>

          <Text style={styles.warningText}>{t('accountLocal.deleting_your_account_is_permanent_and_cannot_be_undone')}</Text>

          <Text style={styles.warningText}>{t('accountLocal.your_temple_app_profile_and_login_credentials_will_be_removed_some_community_contributions_may_remain_without_your_name')}</Text>

          <Text style={styles.warningText}>{t('accountLocal.room_and_seva_bookings_made_through_the_separate_temple_website_are_managed_by_that_website')}</Text>
        </View>

        <Text style={styles.inputLabel}>{t('accountLocal.confirm_your_password')}</Text>

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t('accountLocal.enter_your_password')}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!deleting}
        />

        <TouchableOpacity
          style={[
            styles.deleteButton,
            deleting && styles.disabledButton,
          ]}
          onPress={confirmDeletion}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.deleteButtonText}>{t('accountLocal.delete_my_account_permanently')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={deleting}
        >
          <Text style={styles.cancelButtonText}>{t('accountLocal.cancel_keep_my_account')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF8',
  },
  content: {
    padding: 22,
    paddingBottom: 40,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C69A3A',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 22,
  },
  warningCard: {
    backgroundColor: '#FFF1F0',
    borderColor: '#F0C3BF',
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 26,
  },
  warningTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#B42318',
    marginBottom: 12,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 21,
    color: '#68413D',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A2C18',
    marginBottom: 10,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E8DCCB',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#4A2C18',
    marginBottom: 24,
  },
  deleteButton: {
    minHeight: 52,
    backgroundColor: '#B42318',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  cancelButton: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    color: '#6B1720',
    fontSize: 14,
    fontWeight: '600',
  },
});
