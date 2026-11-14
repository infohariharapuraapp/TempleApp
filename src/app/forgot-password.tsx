import { useTranslation } from 'react-i18next';

import React, { useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '@/services/api';

type Step = 'identifier' | 'otp' | 'password';

export default function ForgotPasswordScreen() {
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

  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [loading, setLoading] = useState(false);

  const cleanIdentifier = identifier.trim();
  const isMobile = /^[6-9]\d{9}$/.test(cleanIdentifier);

  const validIdentifier = () => {
    if (!cleanIdentifier) {
      Alert.alert(t('authLocal.required'),
        t('authLocal.enter_your_registered_email_or_mobile_number')
      );
      return false;
    }

    if (
      !isMobile &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanIdentifier)
    ) {
      Alert.alert(t('authLocal.invalid_details'),
        t('authLocal.enter_a_valid_email_address_or_10_digit_mobile_number')
      );
      return false;
    }

    return true;
  };

  const handleSendOtp = async () => {
    if (loading || !validIdentifier()) return;

    Keyboard.dismiss();
    setLoading(true);

    try {
      const response = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: {
          identifier: cleanIdentifier,
        },
      });

      if (response.success) {
        setOtp('');
        setResetToken('');
        setStep('otp');

        Alert.alert(t('authLocal.check_your_email'),
          t('authLocal.if_your_account_has_a_registered_email_address_a_6_digit_password_reset_otp_will_be_sent_there')
        );
      } else {
        Alert.alert(t('authLocal.unable_to_send_otp'),
          localizeAuthError(response.message, t('authLocal.please_try_again'))
        );
      }
    } catch (error: any) {
      Alert.alert(t('authLocal.unable_to_send_otp'),
        localizeAuthError(error?.message, t('authLocal.unable_to_connect_to_the_server'))
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (loading) return;

    if (!/^\d{6}$/.test(otp.trim())) {
      Alert.alert(t('authLocal.invalid_otp'),
        t('authLocal.enter_the_complete_6_digit_otp')
      );
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    try {
      const response = await apiRequest('/auth/verify-reset-otp', {
        method: 'POST',
        body: {
          identifier: cleanIdentifier,
          otp: otp.trim(),
        },
      });

      if (
        response.success &&
        typeof response.data?.resetToken === 'string' &&
        response.data.resetToken
      ) {
        setResetToken(response.data.resetToken);
        setStep('password');
      } else {
        Alert.alert(t('authLocal.verification_failed'),
          localizeAuthError(response.message, t('authLocal.invalid_or_expired_otp_please_request_a_new_otp'))
        );
      }
    } catch (error: any) {
      Alert.alert(t('authLocal.verification_failed'),
        localizeAuthError(error?.message, t('authLocal.unable_to_verify_otp'))
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (loading) return;

    if (
      newPassword.length < 8 ||
      new TextEncoder().encode(newPassword).length > 72
    ) {
      Alert.alert(t('authLocal.invalid_password'),
        t('authLocal.use_at_least_8_characters_and_no_more_than_72_utf_8_bytes')
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('authLocal.password_mismatch'),
        t('authLocal.both_passwords_must_match')
      );
      return;
    }

    if (!resetToken) {
      Alert.alert(t('authLocal.session_expired'),
        t('authLocal.please_verify_a_new_otp')
      );
      setStep('identifier');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    try {
      const response = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: {
          identifier: cleanIdentifier,
          resetToken,
          newPassword,
        },
      });

      if (response.success) {
        setOtp('');
        setResetToken('');
        setNewPassword('');
        setConfirmPassword('');

        Alert.alert(t('authLocal.password_reset_successful'),
          t('authLocal.your_password_has_been_changed_login_with_your_new_password'),
          [
            {
              text: t('authLocal.go_to_login'),
              onPress: () => router.replace('/login'),
            },
          ],
          { cancelable: false }
        );
      } else {
        Alert.alert(t('authLocal.reset_failed'),
          localizeAuthError(response.message, t('authLocal.unable_to_reset_password'))
        );
      }
    } catch (error: any) {
      Alert.alert(t('authLocal.reset_failed'),
        localizeAuthError(error?.message, t('authLocal.unable_to_reset_password'))
      );
    } finally {
      setLoading(false);
    }
  };

  const renderIdentifierStep = () => (
    <>
      <Text style={styles.title}>{t('authLocal.forgot_password_title')}</Text>

      <Text style={styles.subtitle}>{t('authLocal.enter_your_registered_email_address_or_mobile_number_we_will_send_a_verification_code_to_your_registered_email')}</Text>

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
        returnKeyType="done"
        onSubmitEditing={handleSendOtp}
        editable={!loading}
      />

      <Text style={styles.helperText}>{t('authLocal.otp_will_be_delivered_only_to_your_registered_email')}</Text>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          loading && styles.disabledButton,
        ]}
        onPress={handleSendOtp}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>{t('authLocal.send_otp')}</Text>
        )}
      </TouchableOpacity>
    </>
  );

  const renderOtpStep = () => (
    <>
      <Text style={styles.title}>{t('authLocal.check_your_email')}</Text>

      <Text style={styles.subtitle}>{t('authLocal.enter_the_6_digit_verification_code_sent_to_the_registered_email_address_associated_with_your_account')}</Text>

      <Text style={styles.inputLabel}>{t('authLocal.verification_code')}</Text>

      <TextInput
        style={[styles.input, styles.otpInput]}
        value={otp}
        onChangeText={(value) =>
          setOtp(value.replace(/\D/g, '').slice(0, 6))
        }
        placeholder="000000"
        placeholderTextColor="#999"
        keyboardType="number-pad"
        maxLength={6}
        editable={!loading}
      />

      <Text style={styles.helperText}>{t('authLocal.otp_expires_after_5_minutes')}</Text>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          loading && styles.disabledButton,
        ]}
        onPress={handleVerifyOtp}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>{t('authLocal.verify_otp')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryAction}
        onPress={() => {
          setOtp('');
          setResetToken('');
          setStep('identifier');
        }}
        disabled={loading}
      >
        <Text style={styles.secondaryActionText}>{t('authLocal.change_email_mobile_number')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryAction}
        onPress={handleSendOtp}
        disabled={loading}
      >
        <Text style={styles.secondaryActionText}>{t('authLocal.resend_otp')}</Text>
      </TouchableOpacity>
    </>
  );

  const renderPasswordStep = () => (
    <>
      <Text style={styles.title}>{t('authLocal.create_new_password')}</Text>

      <Text style={styles.subtitle}>{t('authLocal.your_otp_has_been_verified_create_a_new_password_to_secure_your_account')}</Text>

      <Text style={styles.inputLabel}>{t('authLocal.new_password')}</Text>

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder={t('authLocal.minimum_8_characters')}
          placeholderTextColor="#999"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="new-password"
          editable={!loading}
        />

        <TouchableOpacity
          style={styles.showButton}
          onPress={() => setShowPassword(!showPassword)}
          accessibilityRole="button"
          accessibilityLabel={
            showPassword
              ? t('authLocal.hide_password')
              : t('authLocal.show_password')
          }
        >
          <Text style={styles.showText}>
            {showPassword ? t('authLocal.hide') : t('authLocal.show')}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.helperText}>{t('authLocal.use_at_least_8_characters')}</Text>

      <Text style={styles.inputLabel}>{t('authLocal.confirm_password')}</Text>

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder={t('authLocal.re_enter_your_new_password')}
          placeholderTextColor="#999"
          secureTextEntry={!showConfirmPassword}
          autoCapitalize="none"
          autoComplete="new-password"
          editable={!loading}
        />

        <TouchableOpacity
          style={styles.showButton}
          onPress={() =>
            setShowConfirmPassword(!showConfirmPassword)
          }
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

      <Text style={styles.helperText}>{t('authLocal.re_enter_the_same_password_to_confirm')}</Text>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          loading && styles.disabledButton,
        ]}
        onPress={handleResetPassword}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>{t('authLocal.reset_password')}</Text>
        )}
      </TouchableOpacity>
    </>
  );

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
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <View style={styles.form}>
            <Text style={styles.label}>{t('authLocal.temple')}</Text>

            {step === 'identifier' && renderIdentifierStep()}
            {step === 'otp' && renderOtpStep()}
            {step === 'password' && renderPasswordStep()}

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace('/login')}
              disabled={loading}
            >
              <Text style={styles.backButtonText}>{t('authLocal.back_to_login')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#B66A2C',
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#4A2C18',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#777',
    marginTop: 6,
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 7,
  },
  input: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 13,
    color: '#333',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#EEE3D8',
  },
  helperText: {
    fontSize: 11,
    color: '#777',
    marginBottom: 18,
    marginLeft: 3,
  },
  otpInput: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  passwordContainer: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEE3D8',
    marginBottom: 6,
  },
  passwordInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    paddingHorizontal: 15,
    fontSize: 13,
    color: '#333',
  },
  showButton: {
    paddingHorizontal: 15,
    height: '100%',
    justifyContent: 'center',
  },
  showText: {
    color: '#B66A2C',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryButton: {
    height: 50,
    borderRadius: 15,
    backgroundColor: '#B66A2C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  secondaryAction: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  secondaryActionText: {
    color: '#B66A2C',
    fontSize: 12,
    fontWeight: '700',
  },
  backButton: {
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  backButtonText: {
    color: '#B66A2C',
    fontSize: 13,
    fontWeight: '600',
  },
});
