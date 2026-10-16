import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '@/services/api';
import { removeToken } from '@/services/authStorage';

type User = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  role?: string;
};

export default function AccountScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      setLoading(true);

      const response = await apiRequest('/auth/me');

      if (response.success && response.data) {
        setUser(response.data);
        return;
      }

      throw new Error(
        response.message || 'Unable to load account'
      );
    } catch (error: any) {
      console.error('Failed to load account:', error);

      await removeToken();

      Alert.alert(
        'Session Expired',
        'Please login again to continue.',
        [
          {
            text: 'Login',
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [])
  );

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeToken();

              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);

              Alert.alert(
                'Logout Failed',
                'Unable to logout. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.label}>DEVOTEE</Text>

        <Text style={styles.title}>
          My Account
        </Text>

        <Text style={styles.subtitle}>
          Manage your devotee profile and temple activities.
        </Text>

        {/* Profile */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>🙏</Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.name}>
              {loading
                ? 'Loading...'
                : user?.full_name || 'Devotee'}
            </Text>

            <Text style={styles.email}>
              {loading
                ? 'Loading account details...'
                : user?.email || ''}
            </Text>

            {!!user?.phone && (
              <Text style={styles.phone}>
                {user.phone}
              </Text>
            )}
          </View>
        </View>

        {/* Account options */}
        <Text style={styles.sectionTitle}>
          Account
        </Text>

        <View style={styles.card}>
          <AccountItem
            icon="👤"
            title="Profile Details"
            description="View and update your personal information"
          />

          <AccountItem
            icon="📋"
            title="My Bookings"
            description="View your room and seva bookings"
          onPress={() => router.push('/website-bookings')}
          />

          <AccountItem
            icon="🙏"
            title="My Seva History"
            description="View your previous seva bookings"
          />

          <AccountItem
            icon="❤️"
            title="Saved Preferences"
            description="Manage your temple preferences"
          />
        </View>

        {/* Support */}
        <Text style={styles.sectionTitle}>
          Support
        </Text>

        <View style={styles.card}>
          <AccountItem
            icon="📞"
            title="Contact Temple"
            description="Get in touch with the temple"
          />

          <AccountItem
            icon="🔒"
            title="Privacy & Security"
            description="Manage privacy and security settings"
          />
        </View>

        {/* Spiritual Journey */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>🙏</Text>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              Your Spiritual Journey
            </Text>

            <Text style={styles.infoText}>
              Your profile, bookings and devotional
              activities will be connected after the
              backend and authentication system are added.
            </Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutIcon}>↪</Text>

          <Text style={styles.logoutButtonText}>
            Logout
          </Text>
        </TouchableOpacity>

        {/* Back to Home */}
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.homeButtonText}>
            Back to Home
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function AccountItem({
  icon,
  title,
  description,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.itemIcon}>
        <Text style={styles.itemIconText}>
          {icon}
        </Text>
      </View>

      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>
          {title}
        </Text>

        <Text style={styles.itemDescription}>
          {description}
        </Text>
      </View>

      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9F0',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#B66A2C',
    marginBottom: 5,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#4A2C18',
  },

  subtitle: {
    fontSize: 11,
    color: '#777',
    marginTop: 5,
    marginBottom: 20,
  },

  profileCard: {
    backgroundColor: '#F3DEC5',
    borderRadius: 18,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  avatarText: {
    fontSize: 27,
  },

  profileInfo: {
    flex: 1,
  },

  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 4,
  },

  email: {
    fontSize: 10,
    color: '#777',
  },

  phone: {
    fontSize: 10,
    color: '#777',
    marginTop: 3,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 12,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    elevation: 2,
    marginBottom: 23,
  },

  item: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE3D8',
  },

  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F8EBDD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  itemIconText: {
    fontSize: 20,
  },

  itemContent: {
    flex: 1,
  },

  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 3,
  },

  itemDescription: {
    fontSize: 9,
    lineHeight: 14,
    color: '#777',
  },

  arrow: {
    fontSize: 22,
    color: '#B66A2C',
    marginLeft: 8,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    marginBottom: 20,
  },

  infoIcon: {
    fontSize: 27,
    marginRight: 12,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 4,
  },

  infoText: {
    fontSize: 10,
    lineHeight: 15,
    color: '#777',
  },

  logoutButton: {
    height: 48,
    borderRadius: 15,
    backgroundColor: '#F4E0C5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  logoutIcon: {
    fontSize: 20,
    color: '#8B4513',
    marginRight: 8,
  },

  logoutButtonText: {
    color: '#8B4513',
    fontSize: 13,
    fontWeight: '700',
  },

  homeButton: {
    height: 48,
    borderRadius: 15,
    backgroundColor: '#B66A2C',
    alignItems: 'center',
    justifyContent: 'center',
  },

  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});