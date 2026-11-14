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

export default function CategoryScreen() {

  const { t } = useTranslation();

  const prefix = 'activityCategories.social';

  const socialActivities = [
    {
      number: '01',

      title: t(`${prefix}.shivaTitle`),

      image:
        'https://www.divyakshetrahariharapura.com/web/assets/img/event/social-activities/1.jpg',

      paragraphs: [
        t(`${prefix}.shivaParagraph1`),
        t(`${prefix}.shivaParagraph2`),
        t(`${prefix}.shivaParagraph3`),
        t(`${prefix}.shivaParagraph4`),
      ],
    },

    {
      number: '02',

      title: t(`${prefix}.gayatriTitle`),

      image:
        'https://www.divyakshetrahariharapura.com/web/assets/img/event/social-activities/2.jpg',

      paragraphs: [
        t(`${prefix}.gayatriDescription`),
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

        {/* BACK BUTTON */}

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >

          <Text style={styles.backText}>
            ‹ {t('activitySection.back')}
          </Text>

        </TouchableOpacity>

        {/* HEADER */}

        <Text style={styles.eyebrow}>
          {t('activitySection.templeActivities')}
        </Text>

        <Text style={styles.title}>
          {t(`${prefix}.title`)}
        </Text>

        <Text style={styles.subtitle}>
          {t(`${prefix}.subtitle`)}
        </Text>

        {/* SOCIAL ACTIVITY CARDS */}

        {socialActivities.map((activity) => (

          <View
            key={activity.number}
            style={styles.itemCard}
          >

            <Text style={styles.number}>
              {activity.number}
            </Text>

            <Text style={styles.itemTitle}>
              {activity.title}
            </Text>

            <Image
              source={{ uri: activity.image }}
              style={styles.itemImage}
              resizeMode="contain"
            />

            {activity.paragraphs.map((paragraph, index) => (

              <Text
                key={index}
                style={styles.itemText}
              >
                {paragraph}
              </Text>

            ))}

          </View>

        ))}

      </ScrollView>

    </SafeAreaView>
  );
}

// ========================================
// EXISTING DESIGN
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

  itemText: {
    fontSize: 11,
    lineHeight: 18,
    color: '#555',
    marginBottom: 10,
  },

});