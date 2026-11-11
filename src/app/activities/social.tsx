import AutoTranslatedText from '@/components/AutoTranslatedText';
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

export default function CategoryScreen() {
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
          <AutoTranslatedText style={styles.backText}>‹ Back</AutoTranslatedText>
        </TouchableOpacity>

        <AutoTranslatedText style={styles.eyebrow}>TEMPLE ACTIVITIES</AutoTranslatedText>

        <AutoTranslatedText style={styles.title}>Social Activities</AutoTranslatedText>

        <AutoTranslatedText style={styles.subtitle}>
          Initiatives that promote Sanatana Dharma, spiritual learning and
          community participation.
        </AutoTranslatedText>

        {/* 01 - Shiva Deeksha */}
        <View style={styles.itemCard}>
          <Text style={styles.number}>01</Text>

          <AutoTranslatedText style={styles.itemTitle}>
            SHIVA DEEKSHA PROGRAMME
          </AutoTranslatedText>

          <Image
            source={{
              uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/event/social-activities/1.jpg',
            }}
            style={styles.itemImage}
            resizeMode="contain"
          />

          <Text style={styles.itemText}>
            The Glories of Guru Upadesha are boundless. Initiation from a
            Sadguru is a very rare treasure and indeed the greatest boon of
            life. Guru Upadesha becomes the best Saadhana to achieve Chittha
            Shudhhi (internal purity). It breaks the cage of worldliness and
            leads to the Supreme Atma Gnyaana.
          </Text>

          <Text style={styles.itemText}>
            The Shiva Deeksha program is a unique initiative that reveals
            MahaSwamiji’s compassion and care to enlighten individuals and
            nurture his/her sense of belonging to Sanatana Dharma. In the
            ShivaDeeksha Programme, MahaSwamiji blesses people with the sacred
            ‘Shiva Panchakshari Mantra’ initiation - as per Sastras,
            irrespective of caste, creed, age or sex. This Mantra Deeksha stays
            lifelong and grants spiritual & materialistic welfare.
          </Text>

          <Text style={styles.itemText}>
            The Shiva Deeksha programme does not end at a mere one day
            celebration. Sreemath Hariharapura ensures an all time bond with
            the devotees who take part in this programme. Every year, for the
            Shivarathri Pooja, Mruthika Lingas are sent to the all the
            locations where the Shiva Deeksha programme had been conducted.
            Devotees at the locality perform Pooja to this Shiva Linga with
            their own hands on the auspicious Shivarathri night.
          </Text>

          <Text style={styles.itemText}>
            The Shiva Deeksha Program brings together people from innumerable
            walks of life in understanding and practicing Sanatana Dharma.
            This also plants the sense of equanimity and unity in people.
            Presently, the Shiva Deeksha programme has been conducted at about
            1000 centres across the four Indian states of Karnataka, Andhra,
            Tamil Nadu and Maharashtra, and around 10,00,000 people have
            benefitted due to this.
          </Text>
        </View>

        {/* 02 - Vishwa Gayatri */}
        <View style={styles.itemCard}>
          <Text style={styles.number}>02</Text>

          <AutoTranslatedText style={styles.itemTitle}>
            VISHWA GAYATRI UPASAK PARISHAT
          </AutoTranslatedText>

          <Image
            source={{
              uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/event/social-activities/2.jpg',
            }}
            style={styles.itemImage}
            resizeMode="contain"
          />

          <Text style={styles.itemText}>
            Gayatri Upasana is a very ancient worship that is said to bestow
            prosperity, courage and harmony. It is also believed that this
            Upasana improves the memory power, grasping capacity, brilliance
            and intellect of an individual. The Vishwa Gayatri Upaasak Parishat
            is a scheme in which women are taught to perform the Gayathri
            Upasana, by worshipping Vedamatha Gayathri Devi based on Sastras,
            with Gayathri Sahasranama. Presently around 1,00,000 women in and
            around South India have learnt this Upaasana.
          </Text>
        </View>
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

  itemText: {
    fontSize: 11,
    lineHeight: 18,
    color: '#555',
    marginBottom: 10,
  },
});