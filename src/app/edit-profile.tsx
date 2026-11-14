import { useTranslation } from 'react-i18next';

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { apiRequest } from '@/services/api';
import { getToken } from '@/services/authStorage';

type Profile = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
};

export default function EditProfileScreen() {
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

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const token = await getToken();

        if (!token) {
          router.replace('/login');
          return;
        }

        const response = await apiRequest('/auth/me', {
          method: 'GET',
          token,
        });

        if (!response.success || !response.data) {
          throw new Error(
            response.message || 'Unable to load profile'
          );
        }

        const profile = response.data as Profile;

        if (active) {
          setName(profile.full_name || '');
          setEmail(profile.email || '');
          setPhone(profile.phone || '');
        }
      } catch (error: any) {
        if (!active) return;
        Alert.alert(t('accountLocal.error'),
          localizeAccountError(error?.message, t('accountLocal.unable_to_load_profile'))
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const saveProfile = async () => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (cleanName.length < 2 || cleanName.length > 100) {
      Alert.alert(t('accountLocal.invalid_name'),
        t('accountLocal.enter_a_name_between_2_and_100_characters')
      );
      return;
    }

    if (
      cleanPhone !== '' &&
      !/^[6-9]\d{9}$/.test(cleanPhone)
    ) {
      Alert.alert(t('accountLocal.invalid_phone'),
        t('accountLocal.enter_a_valid_10_digit_indian_mobile_number')
      );
      return;
    }

    if (saving) return;

    try {
      setSaving(true);

      const token = await getToken();

      if (!token) {
        router.replace('/login');
        return;
      }

     const response = await apiRequest('/auth/profile', {
  method: 'PUT',
  token,
  body: {
    full_name: cleanName,
  },
});

      if (!response.success) {
        throw new Error(
          response.message || 'Unable to update profile'
        );
      }

      Alert.alert(t('accountLocal.success'),
        t('accountLocal.your_profile_has_been_updated_successfully'),
        [
          {
            text: t('accountLocal.ok'),
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(t('accountLocal.update_failed'),
        localizeAccountError(error?.message, t('accountLocal.please_try_again'))
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6B1720" />
          <Text style={styles.loadingText}>{t('accountLocal.loading_your_details')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>{t('accountLocal.back')}</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>{t('accountLocal.edit_profile')}</Text>
          <Text style={styles.subtitle}>{t('accountLocal.update_your_devotee_account_information')}</Text>

          <View style={styles.card}>
            <Text style={styles.label}>{t('accountLocal.full_name')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('accountLocal.enter_your_full_name')}
              maxLength={100}
              autoCapitalize="words"
            />

            <Text style={styles.label}>{t('accountLocal.email_address')}</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={email}
              editable={false}
              selectTextOnFocus={false}
            />
            <Text style={styles.hint}>{t('accountLocal.your_registered_email_cannot_be_changed')}</Text>

            <Text style={styles.label}>{t('accountLocal.mobile_number')}</Text>
           <TextInput
  style={[styles.input, styles.readOnlyInput]}
  value={phone}
  editable={false}
  selectTextOnFocus={false}
/>

<Text style={styles.hint}>{t('accountLocal.mobile_number_changes_will_require_otp_verification')}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={saveProfile}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>{t('accountLocal.save_changes')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#FFFDF8',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#8E8175',
  },
  content: {
    padding: 22,
    paddingBottom: 45,
  },
  backButton: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 17,
    color: '#6B1720',
    fontWeight: '600',
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4A2C18',
  },
  subtitle: {
    fontSize: 13,
    color: '#8E8175',
    marginTop: 6,
    marginBottom: 26,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A2C18',
    marginBottom: 9,
    marginTop: 12,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E8DCCB',
    borderRadius: 11,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#4A2C18',
    backgroundColor: '#FFFFFF',
  },
  readOnlyInput: {
    backgroundColor: '#F5F1EB',
    color: '#8E8175',
  },
  hint: {
    fontSize: 11,
    color: '#8E8175',
    marginTop: 7,
  },
  saveButton: {
    marginTop: 28,
    height: 52,
    backgroundColor: '#6B1720',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
