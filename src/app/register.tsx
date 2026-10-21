
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
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '@/services/api';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const handleRegister = async () => {
    const name = fullName.trim();
    const mobile = phone.trim();
    const emailAddress = email.trim().toLowerCase();

    if (name.length < 2 || name.length > 100) {
      Alert.alert(
        'Invalid Name',
        'Enter your full name (2–100 characters).'
      );
      return;
    }

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      Alert.alert(
        'Invalid Mobile Number',
        'Enter a valid 10-digit Indian mobile number.'
      );
      return;
    }

    if (
      emailAddress &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)
    ) {
      Alert.alert(
        'Invalid Email',
        'Enter a valid email address or leave it blank.'
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        'Invalid Password',
        'Password must contain at least 8 characters.'
      );
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      Alert.alert(
        'Invalid Password',
        'Password must not exceed 72 UTF-8 bytes.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        'Password Mismatch',
        'Password and confirm password do not match.'
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
          email: emailAddress || null,
          password,
        },
      });

      if (response.success) {
        Alert.alert(
          'Registration Successful',
          'Your devotee account has been created. Please login to continue.',
          [
            {
              text: 'Login',
              onPress: () => router.replace('/login'),
            },
          ]
        );
        return;
      }

      Alert.alert(
        'Registration Failed',
        response.message || 'Unable to create your account.'
      );
    } catch (error: any) {
      Alert.alert(
        'Registration Failed',
        error?.message || 'Unable to connect to the server.'
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
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.form}>
            <Text style={styles.label}>HARIHARIPURA TEMPLE</Text>

            <Text style={styles.title}>Create Account</Text>

            <Text style={styles.subtitle}>
              Register as a devotee to access temple services,
              bookings and activities.
            </Text>

            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor="#999"
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              editable={!loading}
            />

            <Text style={styles.inputLabel}>Mobile Number *</Text>
            <TextInput
              ref={phoneRef}
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              maxLength={10}
              autoComplete="tel"
              editable={!loading}
            />

            <Text style={styles.inputLabel}>Email (Optional)</Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email if available"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!loading}
            />

            <Text style={styles.inputLabel}>Password *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                ref={passwordRef}
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 8 characters"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.showButton}
                onPress={() => setShowPassword(!showPassword)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Text style={styles.showText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, styles.confirmLabel]}>
              Confirm Password *
            </Text>
            <TextInput
              ref={confirmRef}
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your password"
              placeholderTextColor="#999"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              editable={!loading}
            />

            <Text style={styles.note}>
              * Required fields. Email is optional, but is currently
              needed for password recovery.
            </Text>

            <TouchableOpacity
              style={[
                styles.registerButton,
                loading && styles.disabledButton,
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.registerButtonText}>
                  Create Account
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>
                Already have an account?
              </Text>
              <TouchableOpacity
                onPress={() => router.replace('/login')}
                disabled={loading}
              >
                <Text style={styles.loginLink}> Login</Text>
              </TouchableOpacity>
            </View>
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
    paddingTop: 30,
    paddingBottom: 45,
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
    marginBottom: 8,
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
    marginBottom: 25,
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
    marginBottom: 18,
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
    height: '100%',
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  showText: {
    color: '#B66A2C',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmLabel: {
    marginTop: 18,
  },
  note: {
    color: '#777',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
  },
  registerButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: '#B66A2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loginRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  loginText: {
    color: '#777',
    fontSize: 14,
  },
  loginLink: {
    color: '#B66A2C',
    fontSize: 14,
    fontWeight: '700',
  },
});
