
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
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const loginId = identifier.trim();

    if (!loginId || !password) {
      Alert.alert(
        'Login Required',
        'Please enter your mobile number or email and password.'
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

      Alert.alert(
        'Login Failed',
        response.message || 'Invalid login credentials.'
      );
    } catch (error: any) {
      Alert.alert(
        'Login Failed',
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.form}>
              <Text style={styles.label}>HARIHARIPURA TEMPLE</Text>

              <Text style={styles.title}>Welcome Back</Text>

              <Text style={styles.subtitle}>
                Login to access temple services, bookings and activities.
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
                returnKeyType="next"
                editable={!loading}
              />

              <Text style={styles.inputLabel}>Password</Text>

              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
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
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={styles.showText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => router.push('/forgot-password')}
                disabled={loading}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
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
                  <Text style={styles.loginButtonText}>Login</Text>
                )}
              </TouchableOpacity>

              <View style={styles.registerRow}>
                <Text style={styles.secondaryText}>
                  New devotee?
                </Text>

                <TouchableOpacity
                  onPress={() => router.push('/register')}
                  disabled={loading}
                >
                  <Text style={styles.linkText}> Create Account</Text>
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
