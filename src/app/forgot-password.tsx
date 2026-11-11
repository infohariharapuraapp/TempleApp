
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
      Alert.alert(
        'Required',
        'Enter your registered email or mobile number.'
      );
      return false;
    }

    if (
      !isMobile &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanIdentifier)
    ) {
      Alert.alert(
        'Invalid Details',
        'Enter a valid email address or 10-digit mobile number.'
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

        Alert.alert(
          'Check Your Email',
          'If your account has a registered email address, a 6-digit password reset OTP will be sent there.'
        );
      } else {
        Alert.alert(
          'Unable to Send OTP',
          response.message || 'Please try again.'
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Unable to Send OTP',
        error?.message || 'Unable to connect to the server.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (loading) return;

    if (!/^\d{6}$/.test(otp.trim())) {
      Alert.alert(
        'Invalid OTP',
        'Enter the complete 6-digit OTP.'
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
        Alert.alert(
          'Verification Failed',
          response.message ||
            'Invalid or expired OTP. Please request a new OTP.'
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Verification Failed',
        error?.message || 'Unable to verify OTP.'
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
      Alert.alert(
        'Invalid Password',
        'Use at least 8 characters and no more than 72 UTF-8 bytes.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        'Password Mismatch',
        'Both passwords must match.'
      );
      return;
    }

    if (!resetToken) {
      Alert.alert(
        'Session Expired',
        'Please verify a new OTP.'
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

        Alert.alert(
          'Password Reset Successful',
          'Your password has been changed. Login with your new password.',
          [
            {
              text: 'Go to Login',
              onPress: () => router.replace('/login'),
            },
          ],
          { cancelable: false }
        );
      } else {
        Alert.alert(
          'Reset Failed',
          response.message || 'Unable to reset password.'
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Reset Failed',
        error?.message || 'Unable to reset password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderIdentifierStep = () => (
    <>
      <Text style={styles.title}>Forgot Password</Text>

      <Text style={styles.subtitle}>
        Enter your registered email address or mobile number.
        We will send a verification code to your registered email.
      </Text>

      <Text style={styles.inputLabel}>
        Mobile Number or Email
      </Text>

      <TextInput
        style={styles.input}
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="Enter mobile number or email"
        placeholderTextColor="#999"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        returnKeyType="done"
        onSubmitEditing={handleSendOtp}
        editable={!loading}
      />

      <Text style={styles.helperText}>
        OTP will be delivered only to your registered email.
      </Text>

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
          <Text style={styles.primaryButtonText}>
            Send OTP
          </Text>
        )}
      </TouchableOpacity>
    </>
  );

  const renderOtpStep = () => (
    <>
      <Text style={styles.title}>Check Your Email</Text>

      <Text style={styles.subtitle}>
        Enter the 6-digit verification code sent to the
        registered email address associated with your account.
      </Text>

      <Text style={styles.inputLabel}>
        Verification Code
      </Text>

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

      <Text style={styles.helperText}>
        OTP expires after 5 minutes.
      </Text>

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
          <Text style={styles.primaryButtonText}>
            Verify OTP
          </Text>
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
        <Text style={styles.secondaryActionText}>
          Change Email / Mobile Number
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryAction}
        onPress={handleSendOtp}
        disabled={loading}
      >
        <Text style={styles.secondaryActionText}>
          Resend OTP
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderPasswordStep = () => (
    <>
      <Text style={styles.title}>Create New Password</Text>

      <Text style={styles.subtitle}>
        Your OTP has been verified. Create a new password
        to secure your account.
      </Text>

      <Text style={styles.inputLabel}>New Password</Text>

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Minimum 8 characters"
          placeholderTextColor="#999"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="new-password"
          editable={!loading}
        />

        <TouchableOpacity
          style={styles.showButton}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Text style={styles.showText}>
            {showPassword ? 'Hide' : 'Show'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.helperText}>
        Use at least 8 characters.
      </Text>

      <Text style={styles.inputLabel}>
        Confirm Password
      </Text>

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter your new password"
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
        >
          <Text style={styles.showText}>
            {showConfirmPassword ? 'Hide' : 'Show'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.helperText}>
        Re-enter the same password to confirm.
      </Text>

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
          <Text style={styles.primaryButtonText}>
            Reset Password
          </Text>
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
            <Text style={styles.label}>TEMPLE</Text>

            {step === 'identifier' && renderIdentifierStep()}
            {step === 'otp' && renderOtpStep()}
            {step === 'password' && renderPasswordStep()}

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace('/login')}
              disabled={loading}
            >
              <Text style={styles.backButtonText}>
                Back to Login
              </Text>
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
