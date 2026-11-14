import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

const yearlyActivities = [
  [
    '01',
    'shankaraJayanti',
    'https://www.divyakshetrahariharapura.com/web/assets/img/activities/narasimha-sahasranama.jpg',
  ],
  [
    '02',
    'vardhanthi',
    'https://www.divyakshetrahariharapura.com/web/assets/img/activities/vardhanti.jpg',
  ],
  [
    '03',
    'navaratri',
    'https://www.divyakshetrahariharapura.com/web/assets/img/activities/narasimha-kutumba.jpg',
  ],
  [
    '04',
    'narasimhaJayanti',
    'https://www.divyakshetrahariharapura.com/web/assets/img/activities/narasimha-anugraha-sanchara.jpg',
  ],
  [
    '05',
    'chaturmasa',
    'https://www.divyakshetrahariharapura.com/web/assets/img/activities/chaturmasa.jpg',
  ],
  [
    '06',
    'brahmotsava',
    'https://www.divyakshetrahariharapura.com/web/assets/img/activities/bhramho.jpg',
  ],
];

export default function CategoryScreen() {

  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>
            ‹ {t('activitySection.back')}
          </Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>
          {t('activitySection.templeActivities')}
        </Text>

        <Text style={styles.title}>
          {t('activityCategories.yearly.title')}
        </Text>

        <Text style={styles.subtitle}>
          {t('activityCategories.yearly.subtitle')}
        </Text>

        {yearlyActivities.map(([number, title, image]) => (

          <View key={number} style={styles.itemCard}>

            <Text style={styles.number}>
              {number}
            </Text>

            <Text style={styles.itemTitle}>
              {t(`activityCategories.yearly.${title}`)}
            </Text>

            <Image
              source={{ uri: image }}
              style={styles.itemImage}
              resizeMode="contain"
            />

          </View>

        ))}

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

  backButton: {
    marginBottom: 14,
    alignSelf: 'flex-start',
  },

  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B66A2C',
  },

  eyebrow: {
    fontSize: 9,
    color: '#B66A2C',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 5,
  },

  title: {
    fontSize: 25,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 7,
  },

  subtitle: {
    fontSize: 11,
    lineHeight: 17,
    color: '#777',
    marginBottom: 20,
  },

  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    elevation: 2,
  },

  number: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B66A2C',
    marginBottom: 5,
  },

  itemTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 11,
  },

  itemImage: {
    width: '100%',
    height: 210,
    borderRadius: 12,
    backgroundColor: '#F8EFE5',
    marginBottom: 13,
  },

});