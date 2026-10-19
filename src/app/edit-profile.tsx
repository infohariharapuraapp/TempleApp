
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
        Alert.alert(
          'Error',
          error?.message || 'Unable to load profile'
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
      Alert.alert(
        'Invalid Name',
        'Enter a name between 2 and 100 characters.'
      );
      return;
    }

    if (
      cleanPhone !== '' &&
      !/^[6-9]\d{9}$/.test(cleanPhone)
    ) {
      Alert.alert(
        'Invalid Phone',
        'Enter a valid 10-digit Indian mobile number.'
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

      Alert.alert(
        'Success',
        'Your profile has been updated successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Update Failed',
        error?.message || 'Please try again.'
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
          <Text style={styles.loadingText}>
            Loading your details...
          </Text>
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
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>Edit Profile</Text>
          <Text style={styles.subtitle}>
            Update your devotee account information.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              maxLength={100}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={email}
              editable={false}
              selectTextOnFocus={false}
            />
            <Text style={styles.hint}>
              Your registered email cannot be changed.
            </Text>

            <Text style={styles.label}>Mobile Number</Text>
           <TextInput
  style={[styles.input, styles.readOnlyInput]}
  value={phone}
  editable={false}
  selectTextOnFocus={false}
/>

<Text style={styles.hint}>
  Mobile number changes will require OTP verification.
</Text>
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
              <Text style={styles.saveText}>
                Save Changes
              </Text>
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
