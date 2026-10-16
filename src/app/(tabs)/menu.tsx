
import React from 'react';

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  router,
} from 'expo-router';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  useTranslation,
} from 'react-i18next';


// ========================================
// MENU SCREEN
// ========================================

export default function MenuScreen() {

  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

        {/* HEADER */}

        <Text style={styles.title}>
          {t('tabs.menu')}
        </Text>

        <Text style={styles.subtitle}>
          {t(
            'menu.subtitle',
            'Temple services and information'
          )}
        </Text>


        {/* MENU ITEMS */}

        <View style={styles.card}>

          <MenuItem
            title={t('menu.about', 'About Temple')}
            onPress={() => router.push('/about')}
          />

          <MenuItem
            title={t('tabs.deities')}
            onPress={() => router.push('/deities')}
          />

          <MenuItem
            title={t('tabs.activities')}
            onPress={() => router.push('/activities')}
          />

          <MenuItem
            title={t('menu.gallery', 'Gallery')}
            onPress={() => router.push('/gallery')}
          />

          <MenuItem
            title={t('menu.publications', 'Publications')}
            onPress={() => router.push('/publications')}
          />

          <MenuItem
            title={t('features.rooms')}
            onPress={() => router.push('/room-booking')}
          />
          {/* POOJA SERVICES */}

<MenuItem
  title={t('menu.poojaServices', 'Pooja Services')}
  onPress={() => router.push('/pooja-services' as any)}
/>

          <MenuItem
            title={t('menu.account', 'My Account')}
            onPress={() => router.push('/account')}
          />

          <MenuItem
            title={t('features.bookings')}
            onPress={() => router.push('/my-bookings')}
          />

          <MenuItem
            title={t('menu.nearby', 'Nearby Places / Hotels')}
            onPress={() => router.push('/nearby')}
          />

          <MenuItem
            title={t('menu.contact', 'Contact Temple')}
            onPress={() => router.push('/contact')}
          />

          <MenuItem
            title={t('menu.policies', 'Policies')}
            onPress={() => router.push('/policies')}
          />


          {/* LANGUAGE SETTINGS */}

          <MenuItem
            title={t('common.language')}
            onPress={() =>
              router.push('/language-settings')
            }
          />

        </View>

      </ScrollView>

    </SafeAreaView>
  );
}


// ========================================
// MENU ITEM COMPONENT
// ========================================

function MenuItem({
  title,
  onPress,
}: {
  title: string;
  onPress?: () => void;
}) {

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      activeOpacity={0.7}
    >

      <Text style={styles.itemText}>
        {title}
      </Text>

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
    backgroundColor: '#FFF9F0',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
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

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    elevation: 2,
  },

  item: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE3D8',
  },

  itemText: {
    fontSize: 13,
    color: '#4A2C18',
    fontWeight: '600',
    flexShrink: 1,
  },

  arrow: {
    fontSize: 22,
    color: '#B66A2C',
  },

});
