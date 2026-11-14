import { useTranslation } from 'react-i18next';

import React, { useState } from 'react';
import { notifyAuthChanged } from '@/services/authSession';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '@/services/api';
import { saveToken } from '@/services/authStorage';
import { registerForPushNotificationsAsync } from '@/services/notifications';

export default function LoginScreen() {
  // AUTH_LANGUAGE_V1
  const { t } = useTranslation();
  // Only known, static authentication messages
  // are translated. No external translation requests.
  const localizeAuthError = (
    message: unknown,
    fallback: string
  ): string => {
    if (typeof message !== 'string') {
      return fallback;
    }
    const knownMessages: Record<string, string> = {
      "HARIHARIPURA TEMPLE": "authLocal.hariharipura_temple",
      "TEMPLE": "authLocal.temple",
      "Welcome Back": "authLocal.welcome_back",
      "Login to access temple services, bookings and activities.": "authLocal.login_to_access_temple_services_bookings_and_activities",
      "Mobile Number or Email": "authLocal.mobile_number_or_email",
      "Enter mobile number or email": "authLocal.enter_mobile_number_or_email",
      "Password": "authLocal.password",
      "Enter your password": "authLocal.enter_your_password",
      "Show": "authLocal.show",
      "Hide": "authLocal.hide",
      "Show password": "authLocal.show_password",
      "Hide password": "authLocal.hide_password",
      "Forgot Password?": "authLocal.forgot_password_link",
      "Login": "authLocal.login",
      "New devotee?": "authLocal.new_devotee",
      "Create Account": "authLocal.create_account",
      "Login Required": "authLocal.login_required",
      "Please enter your mobile number or email and password.": "authLocal.please_enter_your_mobile_number_or_email_and_password",
      "Login Failed": "authLocal.login_failed",
      "Invalid login credentials.": "authLocal.invalid_login_credentials",
      "Unable to connect to the server.": "authLocal.unable_to_connect_to_the_server",
      "Join our devotee community and stay connected with temple services and activities.": "authLocal.join_our_devotee_community_and_stay_connected_with_temple_services_and_activities",
      "Full Name": "authLocal.full_name",
      "Enter your full name": "authLocal.enter_your_full_name",
      "Mobile Number": "authLocal.mobile_number",
      "10-digit mobile number": "authLocal.10_digit_mobile_number",
      "Email Address": "authLocal.email_address",
      "Enter your email address": "authLocal.enter_your_email_address",
      "Minimum 8 characters": "authLocal.minimum_8_characters",
      "Use at least 8 characters.": "authLocal.use_at_least_8_characters",
      "Confirm Password": "authLocal.confirm_password",
      "Re-enter your password": "authLocal.re_enter_your_password",
      "Hide confirmation password": "authLocal.hide_confirmation_password",
      "Show confirmation password": "authLocal.show_confirmation_password",
      "Fields marked * are required. Your email address is used for password recovery.": "authLocal.fields_marked_are_required_your_email_address_is_used_for_password_recovery",
      "Already have an account?": "authLocal.already_have_an_account",
      "🙏 Stay connected with Hariharipura Temple": "authLocal.stay_connected_with_hariharipura_temple",
      "Invalid Name": "authLocal.invalid_name",
      "Enter your full name (2–100 characters).": "authLocal.enter_your_full_name_2_100_characters",
      "Invalid Mobile Number": "authLocal.invalid_mobile_number",
      "Enter a valid 10-digit Indian mobile number.": "authLocal.enter_a_valid_10_digit_indian_mobile_number",
      "Email Required": "authLocal.email_required",
      "Please enter your email address. It is required for password recovery.": "authLocal.please_enter_your_email_address_it_is_required_for_password_recovery",
      "Invalid Email": "authLocal.invalid_email",
      "Please enter a valid email address.": "authLocal.please_enter_a_valid_email_address",
      "Invalid Password": "authLocal.invalid_password",
      "Password must be at least 8 characters and no more than 72 UTF-8 bytes.": "authLocal.password_must_be_at_least_8_characters_and_no_more_than_72_utf_8_bytes",
      "Password Mismatch": "authLocal.password_mismatch",
      "Password and confirm password do not match.": "authLocal.password_and_confirm_password_do_not_match",
      "Registration Successful": "authLocal.registration_successful",
      "Your devotee account has been created. Please login to continue.": "authLocal.your_devotee_account_has_been_created_please_login_to_continue",
      "Registration Failed": "authLocal.registration_failed",
      "Unable to create your account.": "authLocal.unable_to_create_your_account",
      "Forgot Password": "authLocal.forgot_password_title",
      "Enter your registered email address or mobile number. We will send a verification code to your registered email.": "authLocal.enter_your_registered_email_address_or_mobile_number_we_will_send_a_verification_code_to_your_registered_email",
      "OTP will be delivered only to your registered email.": "authLocal.otp_will_be_delivered_only_to_your_registered_email",
      "Send OTP": "authLocal.send_otp",
      "Check Your Email": "authLocal.check_your_email",
      "Enter the 6-digit verification code sent to the registered email address associated with your account.": "authLocal.enter_the_6_digit_verification_code_sent_to_the_registered_email_address_associated_with_your_account",
      "Verification Code": "authLocal.verification_code",
      "OTP expires after 5 minutes.": "authLocal.otp_expires_after_5_minutes",
      "Verify OTP": "authLocal.verify_otp",
      "Change Email / Mobile Number": "authLocal.change_email_mobile_number",
      "Resend OTP": "authLocal.resend_otp",
      "Create New Password": "authLocal.create_new_password",
      "Your OTP has been verified. Create a new password to secure your account.": "authLocal.your_otp_has_been_verified_create_a_new_password_to_secure_your_account",
      "New Password": "authLocal.new_password",
      "Re-enter your new password": "authLocal.re_enter_your_new_password",
      "Re-enter the same password to confirm.": "authLocal.re_enter_the_same_password_to_confirm",
      "Reset Password": "authLocal.reset_password",
      "Back to Login": "authLocal.back_to_login",
      "Required": "authLocal.required",
      "Enter your registered email or mobile number.": "authLocal.enter_your_registered_email_or_mobile_number",
      "Invalid Details": "authLocal.invalid_details",
      "Enter a valid email address or 10-digit mobile number.": "authLocal.enter_a_valid_email_address_or_10_digit_mobile_number",
      "If your account has a registered email address, a 6-digit password reset OTP will be sent there.": "authLocal.if_your_account_has_a_registered_email_address_a_6_digit_password_reset_otp_will_be_sent_there",
      "Unable to Send OTP": "authLocal.unable_to_send_otp",
      "Please try again.": "authLocal.please_try_again",
      "Invalid OTP": "authLocal.invalid_otp",
      "Enter the complete 6-digit OTP.": "authLocal.enter_the_complete_6_digit_otp",
      "Verification Failed": "authLocal.verification_failed",
      "Invalid or expired OTP. Please request a new OTP.": "authLocal.invalid_or_expired_otp_please_request_a_new_otp",
      "Unable to verify OTP.": "authLocal.unable_to_verify_otp",
      "Use at least 8 characters and no more than 72 UTF-8 bytes.": "authLocal.use_at_least_8_characters_and_no_more_than_72_utf_8_bytes",
      "Both passwords must match.": "authLocal.both_passwords_must_match",
      "Session Expired": "authLocal.session_expired",
      "Please verify a new OTP.": "authLocal.please_verify_a_new_otp",
      "Password Reset Successful": "authLocal.password_reset_successful",
      "Your password has been changed. Login with your new password.": "authLocal.your_password_has_been_changed_login_with_your_new_password",
      "Go to Login": "authLocal.go_to_login",
      "Reset Failed": "authLocal.reset_failed",
      "Unable to reset password.": "authLocal.unable_to_reset_password",
      "Something went wrong. Please try again.": "authLocal.something_went_wrong_please_try_again"
    };
    const key = Object.prototype.hasOwnProperty.call(
      knownMessages,
      message.trim()
    )
      ? knownMessages[message.trim()]
      : null;
    return key ? String(t(key)) : fallback;
  };

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const loginId = identifier.trim();

    if (!loginId || !password) {
      Alert.alert(t('authLocal.login_required'),
        t('authLocal.please_enter_your_mobile_number_or_email_and_password')
      );
      return;
    }

    Keyboard.dismiss();

    try {
      setLoading(true);

      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: {
          email: loginId,
          password,
        },
      });

     if (response.success && response.data?.token) {

  // Save JWT token
  await saveToken(response.data.token);

  // Notify root layout that user is logged in
  notifyAuthChanged(true);

  // Register push notifications
  try {
    await registerForPushNotificationsAsync();
  } catch (pushError) {
    console.warn('Push registration:', pushError);
  }

  // Navigate to Home
  router.replace('/(tabs)');

  return;
}

      Alert.alert(t('authLocal.login_failed'),
        localizeAuthError(response.message, t('authLocal.invalid_login_credentials'))
      );
    } catch (error: any) {
      Alert.alert(t('authLocal.login_failed'),
        localizeAuthError(error?.message, t('authLocal.unable_to_connect_to_the_server'))
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.form}>
              <Text style={styles.label}>{t('authLocal.hariharipura_temple')}</Text>

              <Text style={styles.title}>{t('authLocal.welcome_back')}</Text>

              <Text style={styles.subtitle}>{t('authLocal.login_to_access_temple_services_bookings_and_activities')}</Text>

              <Text style={styles.inputLabel}>{t('authLocal.mobile_number_or_email')}</Text>

              <TextInput
                style={styles.input}
                value={identifier}
                onChangeText={setIdentifier}
                placeholder={t('authLocal.enter_mobile_number_or_email')}
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                returnKeyType="next"
                editable={!loading}
              />

              <Text style={styles.inputLabel}>{t('authLocal.password')}</Text>

              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('authLocal.enter_your_password')}
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  editable={!loading}
                />

                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.showButton}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? t('authLocal.hide_password') : t('authLocal.show_password')}
                >
                  <Text style={styles.showText}>
                    {showPassword ? t('authLocal.hide') : t('authLocal.show')}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => router.push('/forgot-password')}
                disabled={loading}
              >
                <Text style={styles.forgotText}>{t('authLocal.forgot_password_link')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  loading && styles.disabledButton,
                ]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>{t('authLocal.login')}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.registerRow}>
                <Text style={styles.secondaryText}>{t('authLocal.new_devotee')}</Text>

                <TouchableOpacity
                  onPress={() => router.push('/register')}
                  disabled={loading}
                >
                  <Text style={styles.linkText}>{' ' + t('authLocal.create_account')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF9F0',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: '#B66A2C',
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#4A2C18',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#777',
    marginTop: 8,
    marginBottom: 28,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 8,
  },
  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#333',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEE3D8',
  },
  passwordContainer: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEE3D8',
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#333',
  },
  showButton: {
    paddingHorizontal: 15,
    justifyContent: 'center',
    height: '100%',
  },
  showText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B66A2C',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    marginBottom: 24,
    paddingVertical: 6,
  },
  forgotText: {
    color: '#B66A2C',
    fontSize: 13,
    fontWeight: '700',
  },
  loginButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: '#B66A2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  registerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  secondaryText: {
    color: '#777',
    fontSize: 14,
  },
  linkText: {
    color: '#B66A2C',
    fontSize: 14,
    fontWeight: '700',
  },
});
