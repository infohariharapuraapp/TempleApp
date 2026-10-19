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

type User = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  role?: string;
  created_at?: string;
};

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  useFocusEffect(
  useCallback(() => {
    loadProfile();
  }, [])
);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#B66A2C" />
          <Text style={styles.loadingText}>
            Loading your profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = user?.full_name || 'Devotee';
  const firstLetter = displayName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.smallText}>
              Temple Account
            </Text>

            <Text style={styles.title}>
              My Profile
            </Text>

            <Text style={styles.subtitle}>
              Manage your temple activities and account
            </Text>
          </View>

          <View style={styles.profileCircle}>
            <Text style={styles.profileIcon}>🙏</Text>
          </View>
        </View>

        {/* Devotee Card */}
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
              {user?.email || 'No email available'}
            </Text>

            {user?.phone ? (
              <Text style={styles.devoteeText}>
                {user.phone}
              </Text>
            ) : null}
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

        {/* My Temple Activities */}
        <Text style={styles.sectionTitle}>
          My Temple Activities
        </Text>

        <View style={styles.menuCard}>
          <ProfileRow
            icon="🎫"
            title="My Bookings"
            subtitle="View your temple bookings"
            onPress={() => router.push('/website-bookings')}
          />

          <ProfileRow
            icon="💰"
            title="My Donations"
            subtitle="View your donation history"
            onPress={() => router.push('/donations')}
          />

          <ProfileRow
            icon="🛕"
            title="Deities"
            subtitle="Explore temple deities"
            onPress={() => router.push('/deities')}
          />

          <ProfileRow
            icon="📅"
            title="Temple Events"
            subtitle="View upcoming events"
            onPress={() => router.push('/events')}
            last
          />
        </View>

        {/* Temple Information */}
        <Text style={styles.sectionTitle}>
          Temple Information
        </Text>

        <View style={styles.menuCard}>
          <ProfileRow
            icon="🛕"
            title="About Temple"
            subtitle="Learn about our temple"
            onPress={() => router.push('/about')}
          />

          <ProfileRow
            icon="📍"
            title="Temple Location"
            subtitle="Find the temple and directions"
            onPress={() => router.push('/nearby')}
          />

          <ProfileRow
            icon="☎️"
            title="Contact Temple"
            subtitle="Get in touch with the temple"
            onPress={() => router.push('/contact')}
            last
          />
        </View>

        {/* Settings */}
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

        {/* Footer */}
        <Text style={styles.footerText}>
          May the divine blessings be with you always.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9F0',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 12,
    color: '#777',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },

  smallText: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 5,
  },

  subtitle: {
    fontSize: 12,
    color: '#777',
  },

  profileCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },

  profileIcon: {
    fontSize: 24,
  },

  devoteeCard: {
    backgroundColor: '#F3DEC5',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#B66A2C',
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
    color: '#4A2C18',
    marginBottom: 4,
  },

  devoteeText: {
    fontSize: 11,
    color: '#6D5140',
    marginBottom: 2,
  },

  editButton: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },

  editText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B66A2C',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 12,
    marginTop: 4,
  },

  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 22,
    paddingHorizontal: 15,
    elevation: 2,
  },

  profileRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
  },

  profileRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0E7DD',
  },

  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F8EBDD',
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
    color: '#888',
  },

  arrow: {
    fontSize: 25,
    color: '#B66A2C',
    marginLeft: 8,
  },

  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 18,
  },
});