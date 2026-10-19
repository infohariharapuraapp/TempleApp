
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

import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { apiRequest } from '@/services/api';
import { getToken } from '@/services/authStorage';

// ========================================
// TYPES
// ========================================

type User = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  role?: string;
  created_at?: string;
};

// ========================================
// PROFILE SCREEN
// ========================================

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ========================================
  // LOAD PROFILE
  // ========================================

  const loadProfile = async () => {
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
      } else {
        throw new Error(
          response.message || 'Failed to load profile'
        );
      }
    } catch (error: any) {
      console.error('Profile error:', error);

      Alert.alert(
        'Profile Error',
        error?.message || 'Unable to load profile'
      );
    } finally {
      setLoading(false);
    }
  };

  // Refresh profile when returning from Edit Profile
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#6B1720"
          />

          <Text style={styles.loadingText}>
            Loading your profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.smallText}>
              TEMPLE ACCOUNT
            </Text>

            <Text style={styles.title}>
              My Profile
            </Text>

            <Text style={styles.subtitle}>
              Your personal information and temple services
            </Text>
          </View>

          <View style={styles.profileCircle}>
            <Text style={styles.profileIcon}>
              🙏
            </Text>
          </View>
        </View>

        {/* DEVOTEE CARD */}

        <View style={styles.devoteeCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {firstLetter}
            </Text>
          </View>

          <View style={styles.devoteeInfo}>
            <Text style={styles.devoteeName}>
              {displayName}
            </Text>

            <Text style={styles.devoteeText}>
              Temple Devotee
            </Text>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.editText}>
              Edit
            </Text>
          </TouchableOpacity>
        </View>

        {/* PROFILE DETAILS */}

        <Text style={styles.sectionTitle}>
          Profile Details
        </Text>

        <View style={styles.detailsCard}>
          <DetailRow
            icon="👤"
            label="Full Name"
            value={user?.full_name || 'Not available'}
          />

          <View style={styles.detailDivider} />

          <DetailRow
            icon="✉️"
            label="Email Address"
            value={user?.email || 'Not available'}
          />

          <View style={styles.detailDivider} />

          <DetailRow
            icon="📱"
            label="Phone Number"
            value={user?.phone || 'Not available'}
          />
        </View>

        {/* MY TEMPLE ACTIVITIES */}

        <Text style={styles.sectionTitle}>
          My Temple Activities
        </Text>

        <View style={styles.menuCard}>
          {/* MY BOOKINGS - EXISTING WEBVIEW */}

          <ProfileRow
            icon="🎫"
            title="My Bookings"
            subtitle="View your temple bookings"
            onPress={() =>
              router.push('/website-bookings')
            }
          />

          <ProfileRow
            icon="💰"
            title="My Donations"
            subtitle="View your donation history"
            onPress={() =>
              router.push('/donations')
            }
          />

          <ProfileRow
            icon="🛕"
            title="Deities"
            subtitle="Explore temple deities"
            onPress={() =>
              router.push('/deities')
            }
          />

          <ProfileRow
            icon="📅"
            title="Temple Events"
            subtitle="View upcoming events"
            onPress={() =>
              router.push('/events')
            }
            last
          />
        </View>

        {/* TEMPLE INFORMATION */}

        <Text style={styles.sectionTitle}>
          Temple Information
        </Text>

        <View style={styles.menuCard}>
          <ProfileRow
            icon="🛕"
            title="About Temple"
            subtitle="Learn about our temple"
            onPress={() =>
              router.push('/about')
            }
          />

          <ProfileRow
            icon="📍"
            title="Temple Location"
            subtitle="Find the temple and directions"
            onPress={() =>
              router.push('/nearby')
            }
            last
          />
        </View>

        {/* SETTINGS */}

        <Text style={styles.sectionTitle}>
          Settings
        </Text>

        <View style={styles.menuCard}>
          <ProfileRow
            icon="🔔"
            title="Notifications"
            subtitle="Manage notification preferences"
            onPress={() => {}}
          />

          <ProfileRow
            icon="⚙️"
            title="App Settings"
            subtitle="Manage your app preferences"
            onPress={() => {}}
          />

          <ProfileRow
            icon="ℹ️"
            title="About App"
            subtitle="Temple App information"
            onPress={() => {}}
            last
          />
        </View>

        {/* FOOTER */}

        <Text style={styles.footerText}>
          May the divine blessings be with you always.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ========================================
// PROFILE DETAIL ROW
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
// PROFILE MENU ROW
// ========================================

function ProfileRow({
  icon,
  title,
  subtitle,
  onPress,
  last = false,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.profileRow,
        !last && styles.profileRowBorder,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowIcon}>
        <Text style={styles.rowIconText}>
          {icon}
        </Text>
      </View>

      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>
          {title}
        </Text>

        <Text style={styles.rowSubtitle}>
          {subtitle}
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

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#8E8175',
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

  smallText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: '#C69A3A',
    marginBottom: 5,
  },

  title: {
    fontSize: 27,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 5,
  },

  subtitle: {
    fontSize: 12,
    color: '#8E8175',
    lineHeight: 18,
  },

  profileCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F7EBD7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileIcon: {
    fontSize: 25,
  },

  devoteeCard: {
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
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 23,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  devoteeInfo: {
    flex: 1,
    marginLeft: 14,
  },

  devoteeName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 5,
  },

  devoteeText: {
    fontSize: 12,
    color: '#8E8175',
  },

  editButton: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },

  editText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B1720',
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6B1720',
    marginBottom: 12,
    marginTop: 4,
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
    justifyContent: 'center',
    alignItems: 'center',
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

  detailDivider: {
    height: 1,
    backgroundColor: '#F0E7DD',
  },

  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 22,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E8DCCB',
  },

  profileRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  profileRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0E7DD',
  },

  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F7EBD7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  rowIconText: {
    fontSize: 19,
  },

  rowContent: {
    flex: 1,
    marginLeft: 13,
  },

  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 3,
  },

  rowSubtitle: {
    fontSize: 11,
    color: '#8E8175',
  },

  arrow: {
    fontSize: 25,
    color: '#C69A3A',
    marginLeft: 8,
  },

  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#8E8175',
    fontStyle: 'italic',
    marginTop: 18,
  },
});
