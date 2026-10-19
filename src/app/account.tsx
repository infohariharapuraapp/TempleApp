
import React, { useCallback, useState } from 'react';

import {
  ActivityIndicator,
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

import {
  getToken,
  removeToken,
} from '@/services/authStorage';

// ========================================
// TYPES
// ========================================

type User = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  role?: string;
};

// ========================================
// ACCOUNT SCREEN
// ========================================

export default function AccountScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ========================================
  // LOAD LOGGED-IN USER
  // ========================================

  const loadUser = async () => {
    try {
      setLoading(true);

      const token = await getToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await apiRequest('/auth/me', {
        method: 'GET',
        token,
      });

      if (response.success && response.data) {
        setUser(response.data);
        return;
      }

      throw new Error(
        response.message || 'Unable to load account'
      );
    } catch (error: any) {
      console.error('Failed to load account:', error);

      Alert.alert(
        'Account Error',
        error?.message || 'Unable to load your account details.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Reload profile when returning from Edit Profile
  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [])
  );

  // ========================================
  // LOGOUT
  // ========================================

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

  const displayName = user?.full_name || 'Devotee';
  const firstLetter = displayName.charAt(0).toUpperCase();

  // ========================================
  // SCREEN
  // ========================================

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.label}>
              TEMPLE ACCOUNT
            </Text>

            <Text style={styles.title}>
              My Account
            </Text>

            <Text style={styles.subtitle}>
              Your personal information and temple services
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Text style={styles.headerEmoji}>
              🙏
            </Text>
          </View>
        </View>

        {/* PROFILE CARD */}

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {loading ? '🙏' : firstLetter}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.name}>
              {loading ? 'Loading...' : displayName}
            </Text>

            <Text style={styles.profileSubtitle}>
              Temple Devotee
            </Text>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.editButtonText}>
              Edit
            </Text>
          </TouchableOpacity>
        </View>

        {/* PROFILE DETAILS */}

        <Text style={styles.sectionTitle}>
          Profile Details
        </Text>

        <View style={styles.detailsCard}>
          {loading ? (
            <View style={styles.loadingDetails}>
              <ActivityIndicator
                size="small"
                color="#6B1720"
              />

              <Text style={styles.loadingText}>
                Loading your details...
              </Text>
            </View>
          ) : (
            <>
              <DetailRow
                icon="👤"
                label="Full Name"
                value={user?.full_name || 'Not available'}
              />

              <View style={styles.divider} />

              <DetailRow
                icon="✉️"
                label="Email Address"
                value={user?.email || 'Not available'}
              />

              <View style={styles.divider} />

              <DetailRow
                icon="📱"
                label="Phone Number"
                value={user?.phone || 'Not available'}
              />
            </>
          )}
        </View>

        {/* ACCOUNT OPTIONS */}

        <Text style={styles.sectionTitle}>
          Account
        </Text>

        <View style={styles.card}>
          <AccountItem
            icon="👤"
            title="Edit Profile"
            description="Update your personal information"
            onPress={() => router.push('/edit-profile')}
          />

          {/* KEEP EXISTING MY BOOKINGS WEBVIEW */}

          <AccountItem
            icon="🎫"
            title="My Bookings"
            description="View your room and seva bookings"
            onPress={() => router.push('/website-bookings')}
            last
          />
        </View>

        {/* SPIRITUAL JOURNEY */}

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>
            🙏
          </Text>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              Your Spiritual Journey
            </Text>

            <Text style={styles.infoText}>
              Stay connected with the temple through
              your bookings, prayers and devotional
              activities.
            </Text>
          </View>
        </View>

        {/* LOGOUT */}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutIcon}>
            ↪
          </Text>

          <Text style={styles.logoutButtonText}>
            Logout
          </Text>
        </TouchableOpacity>

        {/* BACK TO HOME */}

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={styles.homeButtonText}>
            Back to Home
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ========================================
// DETAIL ROW
// ========================================

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Text style={styles.detailIconText}>
          {icon}
        </Text>
      </View>

      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>
          {label}
        </Text>

        <Text
          style={styles.detailValue}
          selectable
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

// ========================================
// ACCOUNT ITEM
// ========================================

function AccountItem({
  icon,
  title,
  description,
  onPress,
  last = false,
}: {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.item,
        !last && styles.itemBorder,
      ]}
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

      <Text style={styles.arrow}>
        ›
      </Text>
    </TouchableOpacity>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF8',
  },

  content: {
    padding: 20,
    paddingBottom: 45,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },

  headerText: {
    flex: 1,
    paddingRight: 12,
  },

  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#C69A3A',
    marginBottom: 5,
  },

  title: {
    fontSize: 27,
    fontWeight: '700',
    color: '#6B1720',
  },

  subtitle: {
    fontSize: 12,
    color: '#8E8175',
    marginTop: 5,
    lineHeight: 18,
  },

  headerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F7EBD7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerEmoji: {
    fontSize: 24,
  },

  profileCard: {
    backgroundColor: '#F7EBD7',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#6B1720',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  avatarText: {
    fontSize: 23,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  profileInfo: {
    flex: 1,
  },

  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 4,
  },

  profileSubtitle: {
    fontSize: 12,
    color: '#8E8175',
  },

  editButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },

  editButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B1720',
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 12,
  },

  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },

  loadingDetails: {
    paddingVertical: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginLeft: 10,
    fontSize: 12,
    color: '#8E8175',
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },

  detailIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F7EBD7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailIconText: {
    fontSize: 19,
  },

  detailContent: {
    flex: 1,
    marginLeft: 13,
  },

  detailLabel: {
    fontSize: 11,
    color: '#8E8175',
    marginBottom: 5,
  },

  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A2C18',
    lineHeight: 20,
  },

  divider: {
    height: 1,
    backgroundColor: '#F0E7DD',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E8DCCB',
    marginBottom: 23,
  },

  item: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0E7DD',
  },

  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F7EBD7',
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
    fontSize: 14,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 3,
  },

  itemDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: '#8E8175',
  },

  arrow: {
    fontSize: 24,
    color: '#C69A3A',
    marginLeft: 8,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8DCCB',
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
    color: '#6B1720',
    marginBottom: 4,
  },

  infoText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#8E8175',
  },

  logoutButton: {
    height: 48,
    borderRadius: 15,
    backgroundColor: '#F7EBD7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  logoutIcon: {
    fontSize: 20,
    color: '#6B1720',
    marginRight: 8,
  },

  logoutButtonText: {
    color: '#6B1720',
    fontSize: 13,
    fontWeight: '700',
  },

  homeButton: {
    height: 48,
    borderRadius: 15,
    backgroundColor: '#6B1720',
    alignItems: 'center',
    justifyContent: 'center',
  },

  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
