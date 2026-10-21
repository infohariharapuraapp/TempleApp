
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
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    if (deleting) return;

    try {
      setDeleting(true);

      const token = await getToken();

      if (!token) {
        Alert.alert(
          'Session Expired',
          'Please log in again.'
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

      Alert.alert(
        'Account Deleted',
        'Your temple app account has been deleted.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Deletion Failed',
        error?.message || 'Please try again.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeletion = () => {
    if (!password.trim()) {
      Alert.alert(
        'Password Required',
        'Enter your account password to continue.'
      );
      return;
    }

    Alert.alert(
      'Permanently Delete Account?',
      'This action cannot be undone. Your temple app login and profile will be deleted. Separate website bookings are managed through the temple website.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
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
        <Text style={styles.label}>ACCOUNT SETTINGS</Text>

        <Text style={styles.title}>Delete My Account</Text>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>
            Permanent Account Deletion
          </Text>

          <Text style={styles.warningText}>
            Deleting your account is permanent and cannot be undone.
          </Text>

          <Text style={styles.warningText}>
            Your temple app profile and login credentials will be removed.
            Some community contributions may remain without your name.
          </Text>

          <Text style={styles.warningText}>
            Room and seva bookings made through the separate temple website
            are managed by that website.
          </Text>
        </View>

        <Text style={styles.inputLabel}>
          Confirm your password
        </Text>

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
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
            <Text style={styles.deleteButtonText}>
              Delete My Account Permanently
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={deleting}
        >
          <Text style={styles.cancelButtonText}>
            Cancel — Keep My Account
          </Text>
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
