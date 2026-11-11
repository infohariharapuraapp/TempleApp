import AutoTranslatedText from '@/components/AutoTranslatedText';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const yearlyActivities = [
  ['01', 'SHANKARA JAYANTI', 'https://www.divyakshetrahariharapura.com/web/assets/img/activities/narasimha-sahasranama.jpg'],
  ['02', 'VARDHANTHI MAHOTSAVA', 'https://www.divyakshetrahariharapura.com/web/assets/img/activities/vardhanti.jpg'],
  ['03', 'NAVARATHIRI', 'https://www.divyakshetrahariharapura.com/web/assets/img/activities/narasimha-kutumba.jpg'],
  ['04', 'NARASIMHA JAYANTI', 'https://www.divyakshetrahariharapura.com/web/assets/img/activities/narasimha-anugraha-sanchara.jpg'],
  ['05', 'CHATHURMASA', 'https://www.divyakshetrahariharapura.com/web/assets/img/activities/chaturmasa.jpg'],
  ['06', 'BRAHMOTSAVA', 'https://www.divyakshetrahariharapura.com/web/assets/img/activities/bhramho.jpg'],
];

export default function CategoryScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <AutoTranslatedText style={styles.backText}>‹ Back</AutoTranslatedText>
        </TouchableOpacity>

        <AutoTranslatedText style={styles.eyebrow}>TEMPLE ACTIVITIES</AutoTranslatedText>
        <AutoTranslatedText style={styles.title}>Yearly Activities</AutoTranslatedText>
        <AutoTranslatedText style={styles.subtitle}>
          Annual festivals and important celebrations of Sri Adi Shankaracharya Sharada Lakshminarasimha Peetam.
        </AutoTranslatedText>

        {yearlyActivities.map(([number, title, image]) => (
          <View key={number} style={styles.itemCard}>
            <Text style={styles.number}>{number}</Text>
            <Text style={styles.itemTitle}>{title}</Text>
            <Image source={{ uri: image }} style={styles.itemImage} resizeMode="contain" />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9F0' },
  content: { padding: 20, paddingBottom: 40 },
  backButton: { marginBottom: 14, alignSelf: 'flex-start' },
  backText: { fontSize: 14, fontWeight: '700', color: '#B66A2C' },
  eyebrow: { fontSize: 9, color: '#B66A2C', fontWeight: '700', letterSpacing: 1, marginBottom: 5 },
  title: { fontSize: 25, fontWeight: '700', color: '#4A2C18', marginBottom: 7 },
  subtitle: { fontSize: 11, lineHeight: 17, color: '#777', marginBottom: 20 },
  itemCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, marginBottom: 16, elevation: 2 },
  number: { fontSize: 11, fontWeight: '700', color: '#B66A2C', marginBottom: 5 },
  itemTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700', color: '#4A2C18', marginBottom: 11 },
  itemImage: { width: '100%', height: 210, borderRadius: 12, backgroundColor: '#F8EFE5', marginBottom: 13 },
});
