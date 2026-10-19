import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
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

type NotificationItem = {
  id: number;
  title: string;
  body: string;
  notification_type: string;
  data?: any;
  created_at: string;
  read_at?: string | null;
  is_read: boolean;
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<
    NotificationItem[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async (
    showLoading = true
  ) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const token = await getToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await apiRequest(
        '/notifications',
        {
          method: 'GET',
          token,
        }
      );

      if (response.success) {
        setNotifications(response.data || []);
        return;
      }

      throw new Error(
        response.message ||
          'Unable to load notifications'
      );
    } catch (error: any) {
      console.error(
        'Load notifications error:',
        error
      );

      Alert.alert(
        'Unable to Load Notifications',
        error?.message ||
          'Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications(false);
  };

const handleNotificationPress = async (
  item: NotificationItem
) => {
  try {
    const token = await getToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    // Mark as read only when currently unread
    if (!item.is_read) {
      const response = await apiRequest(
        `/notifications/${item.id}/read`,
        {
          method: 'PATCH',
          token,
        }
      );

      if (!response.success) {
        throw new Error(
          response.message ||
            'Unable to update notification'
        );
      }

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? {
                ...notification,
                is_read: true,
                read_at:
                  response.data?.readAt ||
                  new Date().toISOString(),
              }
            : notification
        )
      );
    }

    // ------------------------------------
    // NOTIFICATION NAVIGATION
    // ------------------------------------




const data =
  typeof item.data === 'string'
    ? JSON.parse(item.data)
    : item.data || {};

const notificationType =
  data.type || item.notification_type;

switch (notificationType) {
  case 'event':
    router.push('/events');
    break;

  case 'deity':
    if (data.deityId) {
      router.push(`/deity/${data.deityId}` as any);
    } else {
      router.push('/(tabs)/deities');
    }
    break;

  case 'gallery':
    router.push('/gallery');
    break;

  case 'darshan':
  case 'today_darshan':
    router.push('/darshan');
    break;

  case 'darshan_video':
    router.push('/darshan-videos');
    break;

  case 'publication':
    router.push('/publications');
    break;

  case 'announcement': {
    const announcementId =
      data.announcementId ??
      data.announcement_id;

    if (announcementId) {
      router.push({
        pathname: '/announcements' as any,
        params: {
          id: String(announcementId),
        },
      });
    } else {
      console.warn(
        'Announcement notification missing announcement ID:',
        item
      );

      Alert.alert(
        'Announcement Unavailable',
        'This notification does not contain an announcement ID.'
      );
    }
    break;
  }

  default:
    console.log(
      'No navigation configured for notification:',
      notificationType
    );
    break;
}

  } catch (error: any) {
    console.error(
      'Notification press error:',
      error
    );

    Alert.alert(
      'Unable to Open Notification',
      error?.message || 'Please try again.'
    );
  }
};

  const handleMarkAllRead = async () => {
    try {
      const token = await getToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await apiRequest(
        '/notifications/read-all',
        {
          method: 'PATCH',
          token,
        }
      );

      if (!response.success) {
        throw new Error(
          response.message ||
            'Unable to mark notifications as read'
        );
      }

      const readTime = new Date().toISOString();

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          is_read: true,
          read_at:
            notification.read_at || readTime,
        }))
      );
    } catch (error: any) {
      console.error(
        'Mark all read error:',
        error
      );

      Alert.alert(
        'Unable to Update',
        error?.message ||
          'Please try again.'
      );
    }
  };

  const unreadCount = notifications.filter(
    (item) => !item.is_read
  ).length;

  const formatDate = (value: string) => {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    return date.toLocaleString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#B66A2C"
          />

          <Text style={styles.loadingText}>
            Loading temple notifications...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.label}>
              TEMPLE UPDATES
            </Text>

            <Text style={styles.title}>
              Notifications
            </Text>

            <Text style={styles.subtitle}>
              Stay updated with temple announcements,
              events and important information.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Text style={styles.closeText}>
              ×
            </Text>
          </TouchableOpacity>
        </View>

        {/* Unread summary */}
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryTitle}>
              {unreadCount > 0
                ? `${unreadCount} unread ${
                    unreadCount === 1
                      ? 'notification'
                      : 'notifications'
                  }`
                : 'You are all caught up'}
            </Text>

            <Text style={styles.summaryText}>
              {unreadCount > 0
                ? 'Open notifications to mark them as read.'
                : 'No unread temple updates.'}
            </Text>
          </View>

          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              style={styles.markAllButton}
            >
              <Text style={styles.markAllText}>
                Mark all read
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Empty state */}
        {notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>
              🔔
            </Text>

            <Text style={styles.emptyTitle}>
              No Notifications Yet
            </Text>

            <Text style={styles.emptyText}>
              Temple announcements and updates
              will appear here.
            </Text>
          </View>
        ) : (
          notifications.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.notificationCard,
                !item.is_read &&
                  styles.unreadCard,
              ]}
              activeOpacity={0.8}
              onPress={() =>
                handleNotificationPress(item)
              }
            >
              <View style={styles.notificationTop}>
                <View style={styles.notificationIcon}>
                  <Text style={styles.iconText}>
                    {item.notification_type ===
                    'announcement'
                      ? '📢'
                      : item.notification_type ===
                          'event'
                        ? '📅'
                        : '🔔'}
                  </Text>
                </View>

                <View style={styles.notificationContent}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[
                        styles.notificationTitle,
                        !item.is_read &&
                          styles.unreadTitle,
                      ]}
                    >
                      {item.title}
                    </Text>

                    {!item.is_read && (
                      <View
                        style={styles.unreadDot}
                      />
                    )}
                  </View>

                  <Text
                    style={styles.notificationBody}
                  >
                    {item.body}
                  </Text>

                  <Text
                    style={styles.notificationDate}
                  >
                    {formatDate(item.created_at)}
                  </Text>
                </View>
              </View>

              <View style={styles.statusRow}>
                <Text
                  style={[
                    styles.statusText,
                    !item.is_read &&
                      styles.unreadStatus,
                  ]}
                >
                  {item.is_read
                    ? 'Viewed'
                    : 'New'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
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
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 12,
    color: '#777',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },

  headerText: {
    flex: 1,
    paddingRight: 15,
  },

  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#B66A2C',
    marginBottom: 5,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4A2C18',
  },

  subtitle: {
    fontSize: 11,
    lineHeight: 17,
    color: '#777',
    marginTop: 6,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },

  closeText: {
    fontSize: 25,
    color: '#B66A2C',
    lineHeight: 27,
  },

  summaryCard: {
    backgroundColor: '#F3DEC5',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A2C18',
  },

  summaryText: {
    fontSize: 9,
    color: '#777',
    marginTop: 4,
  },

  markAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  markAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B66A2C',
  },

  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0E7DD',
    elevation: 1,
  },

  unreadCard: {
    backgroundColor: '#FFF1DF',
    borderColor: '#E6B77A',
  },

  notificationTop: {
    flexDirection: 'row',
  },

  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8EBDD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  iconText: {
    fontSize: 19,
  },

  notificationContent: {
    flex: 1,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  notificationTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#4A2C18',
  },

  unreadTitle: {
    fontWeight: '800',
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#B66A2C',
    marginLeft: 8,
  },

  notificationBody: {
    fontSize: 11,
    lineHeight: 17,
    color: '#6D5140',
    marginTop: 6,
  },

  notificationDate: {
    fontSize: 9,
    color: '#999',
    marginTop: 8,
  },

  statusRow: {
    alignItems: 'flex-end',
    marginTop: 8,
  },

  statusText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#999',
  },

  unreadStatus: {
    color: '#B66A2C',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    marginTop: 15,
  },

  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A2C18',
  },

  emptyText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#777',
    textAlign: 'center',
    marginTop: 6,
  },
});