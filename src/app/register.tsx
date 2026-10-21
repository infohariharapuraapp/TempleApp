
import React, {
  useRef,
  useState,
  useEffect,
} from 'react';

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

// ========================================
// REGISTER SCREEN
// ========================================

export default function RegisterScreen() {
  const { width } = useWindowDimensions();

  const isSmallScreen = width < 360;

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

  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // ========================================
  // KEYBOARD HANDLING
  // ========================================

  useEffect(() => {
    const showListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );

    const hideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showListener.remove();
      hideListener.remove();

      if (scrollTimer.current) {
        clearTimeout(scrollTimer.current);
      }
    };
  }, []);

  const scrollToConfirmPassword = () => {
    if (scrollTimer.current) {
      clearTimeout(scrollTimer.current);
    }

    scrollTimer.current = setTimeout(() => {
      scrollRef.current?.scrollToEnd({
        animated: true,
      });
    }, 350);
  };

  // ========================================
  // REGISTER DEVOTEE
  // ========================================

  const handleRegister = async () => {
    if (loading) return;

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

  // ========================================
  // SCREEN
  // ========================================

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
            isSmallScreen && styles.smallScreenContent,
            keyboardVisible && styles.keyboardContent,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <View
            style={[
              styles.form,
              isSmallScreen && styles.smallScreenForm,
            ]}
          >
            {/* HEADER */}

            <View style={styles.header}>
              <View style={styles.templeIcon}>
                <Text style={styles.templeEmoji}>
                  🙏
                </Text>
              </View>

              <Text style={styles.label}>
                HARIHARIPURA TEMPLE
              </Text>

              <Text
                style={[
                  styles.title,
                  isSmallScreen && styles.smallTitle,
                ]}
              >
                Create Account
              </Text>

              <Text style={styles.subtitle}>
                Join our devotee community and stay
                connected with temple services and activities.
              </Text>
            </View>

            {/* FULL NAME */}

            <Text style={styles.inputLabel}>
              Full Name <Text style={styles.required}>*</Text>
            </Text>

            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor="#9B9188"
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              editable={!loading}
            />

            {/* MOBILE NUMBER */}

            <Text style={styles.inputLabel}>
              Mobile Number <Text style={styles.required}>*</Text>
            </Text>

            <TextInput
              ref={phoneRef}
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor="#9B9188"
              keyboardType="phone-pad"
              maxLength={10}
              autoComplete="tel"
              editable={!loading}
            />

            {/* EMAIL */}

            <Text style={styles.inputLabel}>
              Email Address
              <Text style={styles.optional}> (Optional)</Text>
            </Text>

            <TextInput
              ref={emailRef}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email address"
              placeholderTextColor="#9B9188"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!loading}
            />

            {/* PASSWORD */}

            <Text style={styles.inputLabel}>
              Password <Text style={styles.required}>*</Text>
            </Text>

            <View style={styles.passwordContainer}>
              <TextInput
                ref={passwordRef}
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 8 characters"
                placeholderTextColor="#9B9188"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                editable={!loading}
              />

              <TouchableOpacity
                style={styles.showButton}
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? 'Hide password' : 'Show password'
                }
              >
                <Text style={styles.showText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.passwordHint}>
              Use at least 8 characters.
            </Text>

            {/* CONFIRM PASSWORD */}

            <Text style={styles.inputLabel}>
              Confirm Password{' '}
              <Text style={styles.required}>*</Text>
            </Text>

            <View style={styles.passwordContainer}>
              <TextInput
                ref={confirmRef}
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor="#9B9188"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                returnKeyType="done"
                onFocus={scrollToConfirmPassword}
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
                    ? 'Hide confirmation password'
                    : 'Show confirmation password'
                }
              >
                <Text style={styles.showText}>
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* INFORMATION */}

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Fields marked * are required. Email is optional,
                but currently needed for password recovery.
              </Text>
            </View>

            {/* REGISTER BUTTON */}

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
                <Text style={styles.registerButtonText}>
                  Create Account
                </Text>
              )}
            </TouchableOpacity>

            {/* LOGIN */}

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>
                Already have an account?
              </Text>

              <TouchableOpacity
                onPress={() => router.replace('/login')}
                disabled={loading}
                accessibilityRole="button"
              >
                <Text style={styles.loginLink}>
                  {' '}Login
                </Text>
              </TouchableOpacity>
            </View>

            {/* FOOTER */}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                🙏 Stay connected with Hariharipura Temple
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

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

  smallScreenContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 24,
  },

  keyboardContent: {
    justifyContent: 'flex-start',
    paddingBottom: 150,
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

  smallScreenForm: {
    padding: 15,
    borderRadius: 16,
  },

  // HEADER

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

  templeEmoji: {
    fontSize: 30,
  },

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

  smallTitle: {
    fontSize: 25,
  },

  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#8E8175',
    textAlign: 'center',
    marginTop: 10,
  },

  // INPUTS

  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 8,
  },

  required: {
    color: '#B42318',
  },

  optional: {
    color: '#8E8175',
    fontWeight: '400',
    fontSize: 12,
  },

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

  // PASSWORD

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

  // INFORMATION

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

  // REGISTER BUTTON

  registerButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: '#6B1720',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  disabledButton: {
    opacity: 0.6,
  },

  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },

  // LOGIN

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

  // FOOTER

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
