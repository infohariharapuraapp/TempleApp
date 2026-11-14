import { useTranslation } from 'react-i18next';

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '@/services/api';

export default function RegisterScreen() {
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

  const { width } = useWindowDimensions();
  const small = width < 360;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  React.useEffect(() => {
    const show = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handleRegister = async () => {
    if (loading) return;

    const name = fullName.trim();
    const mobile = phone.trim();
    const emailAddress = email.trim().toLowerCase();

    if (name.length < 2 || name.length > 100) {
      Alert.alert(t('authLocal.invalid_name'),
        t('authLocal.enter_your_full_name_2_100_characters')
      );
      return;
    }

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      Alert.alert(t('authLocal.invalid_mobile_number'),
        t('authLocal.enter_a_valid_10_digit_indian_mobile_number')
      );
      return;
    }

    if (!emailAddress) {
      Alert.alert(t('authLocal.email_required'),
        t('authLocal.please_enter_your_email_address_it_is_required_for_password_recovery')
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      Alert.alert(t('authLocal.invalid_email'),
        t('authLocal.please_enter_a_valid_email_address')
      );
      return;
    }

    if (
      password.length < 8 ||
      new TextEncoder().encode(password).length > 72
    ) {
      Alert.alert(t('authLocal.invalid_password'),
        t('authLocal.password_must_be_at_least_8_characters_and_no_more_than_72_utf_8_bytes')
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('authLocal.password_mismatch'),
        t('authLocal.password_and_confirm_password_do_not_match')
      );
      return;
    }

    Keyboard.dismiss();

    try {
      setLoading(true);

      const response = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          full_name: name,
          phone: mobile,
          email: emailAddress,
          password,
        },
      });

      if (response.success) {
        Alert.alert(t('authLocal.registration_successful'),
          t('authLocal.your_devotee_account_has_been_created_please_login_to_continue'),
          [{
            text: t('authLocal.login'),
            onPress: () => router.replace('/login'),
          }]
        );
        return;
      }

      Alert.alert(t('authLocal.registration_failed'),
        localizeAuthError(response.message, t('authLocal.unable_to_create_your_account'))
      );
    } catch (error: any) {
      Alert.alert(t('authLocal.registration_failed'),
        localizeAuthError(error?.message, t('authLocal.unable_to_connect_to_the_server'))
      );
    } finally {
      setLoading(false);
    }
  };

  const focusNext = (
    ref: React.RefObject<TextInput | null>
  ) => {
    ref.current?.focus();
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            small && styles.smallContent,
            keyboardVisible && styles.keyboardContent,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <View style={[
            styles.form,
            small && styles.smallForm,
          ]}>
            <View style={styles.header}>
              <View style={styles.templeIcon}>
                <Text style={styles.templeEmoji}>🙏</Text>
              </View>

              <Text style={styles.label}>{t('authLocal.hariharipura_temple')}</Text>

              <Text style={[
                styles.title,
                small && { fontSize: 25 },
              ]}>{t('authLocal.create_account')}</Text>

              <Text style={styles.subtitle}>{t('authLocal.join_our_devotee_community_and_stay_connected_with_temple_services_and_activities')}</Text>
            </View>

            <Text style={styles.inputLabel}>
              {t('authLocal.full_name')}{' '}<Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder={t('authLocal.enter_your_full_name')}
              placeholderTextColor="#9B9188"
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => focusNext(phoneRef)}
              editable={!loading}
            />

            <Text style={styles.inputLabel}>
              {t('authLocal.mobile_number')}{' '}<Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              ref={phoneRef}
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('authLocal.10_digit_mobile_number')}
              placeholderTextColor="#9B9188"
              keyboardType="phone-pad"
              maxLength={10}
              autoComplete="tel"
              editable={!loading}
            />

            <Text style={styles.inputLabel}>
              {t('authLocal.email_address')}{' '}<Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('authLocal.enter_your_email_address')}
              placeholderTextColor="#9B9188"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => focusNext(passwordRef)}
              editable={!loading}
            />

            <Text style={styles.inputLabel}>
              {t('authLocal.password')}{' '}<Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.passwordContainer}>
              <TextInput
                ref={passwordRef}
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder={t('authLocal.minimum_8_characters')}
                placeholderTextColor="#9B9188"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                returnKeyType="next"
                onSubmitEditing={() => focusNext(confirmRef)}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.showButton}
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? t('authLocal.hide_password') : t('authLocal.show_password')
                }
              >
                <Text style={styles.showText}>
                  {showPassword ? t('authLocal.hide') : t('authLocal.show')}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.passwordHint}>{t('authLocal.use_at_least_8_characters')}</Text>

            <Text style={styles.inputLabel}>
              {t('authLocal.confirm_password')}{' '}<Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.passwordContainer}>
              <TextInput
                ref={confirmRef}
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('authLocal.re_enter_your_password')}
                placeholderTextColor="#9B9188"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.showButton}
                onPress={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={
                  showConfirmPassword
                    ? t('authLocal.hide_confirmation_password')
                    : t('authLocal.show_confirmation_password')
                }
              >
                <Text style={styles.showText}>
                  {showConfirmPassword ? t('authLocal.hide') : t('authLocal.show')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{t('authLocal.fields_marked_are_required_your_email_address_is_used_for_password_recovery')}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.registerButton,
                loading && styles.disabledButton,
              ]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.registerButtonText}>{t('authLocal.create_account')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>{t('authLocal.already_have_an_account')}</Text>
              <TouchableOpacity
                onPress={() => router.replace('/login')}
                disabled={loading}
              >
                <Text style={styles.loginLink}>{' ' + t('authLocal.login')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('authLocal.stay_connected_with_hariharipura_temple')}</Text>
            </View>
          </View>
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
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  smallContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 24,
  },
  keyboardContent: {
    justifyContent: 'flex-start',
    paddingBottom: 90,
  },
  form: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },
  smallForm: {
    padding: 15,
    borderRadius: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  templeIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#F7EBD7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  templeEmoji: { fontSize: 30 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#C69A3A',
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#6B1720',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#8E8175',
    textAlign: 'center',
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 8,
  },
  required: { color: '#B42318' },
  input: {
    width: '100%',
    minHeight: 52,
    backgroundColor: '#FFFDFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333333',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },
  passwordContainer: {
    width: '100%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8DCCB',
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333333',
  },
  showButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showText: {
    color: '#6B1720',
    fontSize: 12,
    fontWeight: '700',
  },
  passwordHint: {
    fontSize: 11,
    color: '#8E8175',
    marginTop: -8,
    marginBottom: 18,
  },
  infoBox: {
    backgroundColor: '#F7EBD7',
    borderRadius: 12,
    padding: 13,
    marginTop: 4,
    marginBottom: 22,
  },
  infoText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#6B5440',
  },
  registerButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: '#6B1720',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  disabledButton: { opacity: 0.6 },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  loginRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  loginText: {
    color: '#8E8175',
    fontSize: 13,
  },
  loginLink: {
    color: '#6B1720',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    marginTop: 26,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0E7DD',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#8E8175',
    textAlign: 'center',
    lineHeight: 18,
  },
});
