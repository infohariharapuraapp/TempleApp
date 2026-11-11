import AutoTranslatedText from '@/components/AutoTranslatedText';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function CategoryScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <AutoTranslatedText style={styles.backText}>‹ Back</AutoTranslatedText>
        </TouchableOpacity>

        <AutoTranslatedText style={styles.eyebrow}>TEMPLE ACTIVITIES</AutoTranslatedText>
        <AutoTranslatedText style={styles.title}>Services</AutoTranslatedText>
        <AutoTranslatedText style={styles.subtitle}>
          Educational, charitable and community-service initiatives of Sreemath Hariharapura.
        </AutoTranslatedText>

        <View style={styles.itemCard}>
          <Text style={styles.number}>01</Text>
          <AutoTranslatedText style={styles.itemTitle}>GOSAMRAKSHANA (COW PROTECTION PROGRAM)</AutoTranslatedText>
          <Image
            source={{ uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/event/services/1.jpg' }}
            style={styles.itemImage}
            resizeMode="contain"
          />
          <Text style={styles.itemText}>
            The Vedic tradition respects and worships every cow as the universal Mother Goddess. Taking good care of cows is believed to immensely please the Supreme. Moreover, every product from the cow - the Go-Mutra (cow’s urine), cow dung, cow milk, etc possess religious significance as well as high medicinal properties. But, sadly, in recent times, cows that are meant to be worshipped and revered are cruelly slaughtered. The increasing rate of cow slaughter and beef export is a very depressing and shocking truth prevailing in the present days. Hence, to protect and nourish cows, Sreemath Hariharapura conducts Cow Protection Programmes at many places in and around South India. Volunteers from Sreemath campaign against cow slaughter, creating awareness among people about the need to protect cows. Plans are on to set up Goshalas at various locations, where cows can be protected and nourished in the best possible manner. Presently, there is a Goshala at Hariharapura, called the “Brindaavana Goshaala”, where cows whether barren or old, young or milking, calves or infants - ALL are nourished and taken care under best medical facilities. Presently there are about 100 cows in this Goshala.
          </Text>
        </View>

        <View style={styles.itemCard}>
          <Text style={styles.number}>02</Text>
          <AutoTranslatedText style={styles.itemTitle}>VEDA PATASHALA</AutoTranslatedText>
          <Image
            source={{ uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/event/services/2.jpg' }}
            style={styles.itemImage}
            resizeMode="contain"
          />
          <Text style={styles.itemText}>
            Preserving Vedic knowledge is very important in securing universal welfare and peace. The Vedapatashala at Hariharapura, an exclusive residential school with modern amenities, educates young Brahmacharis in Sanskrit, Veda-Sastras along with basic-modern education/computer skills.
          </Text>
        </View>

        <View style={styles.itemCard}>
          <Text style={styles.number}>03</Text>
          <AutoTranslatedText style={styles.itemTitle}>EDUCATIONAL INSTITUTIONS</AutoTranslatedText>
          <Image
            source={{ uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/event/services/3.jpg' }}
            style={styles.itemImage}
            resizeMode="contain"
          />
          <Text style={styles.itemText}>
            Sreemath runs schools and colleges at many villages in Karnataka. Very nominal fee is charged in these institutions. Free education is also provided to children who are from financially backward families.
            {'\n'}-SRI SACHIDANANDA SARAWATHI INSTITUTION, a High school at Hariharapura, Karnataka
            {'\n'}-SRI RAMANANDA SARASWATHI PU COLLEGE (Pre-University College) at Hariharapura, Karnataka
            {'\n'}-SWAYAMPRAKASHA SAMSTE, a school at Narve, Karnataka
            {'\n'}-SRI RAMANANDA SARASWATHI HIGH SCHOOL at Kigga, Karnataka
            {'\n'}are few education institutions run by Sreemath for the past 60 Years.
          </Text>
        </View>

        <View style={styles.itemCard}>
          <Text style={styles.number}>04</Text>
          <AutoTranslatedText style={styles.itemTitle}>ANNADANAM (FREE FOOD FOR ALL)</AutoTranslatedText>
          <Image
            source={{ uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/event/services/4.jpg' }}
            style={styles.itemImage}
            resizeMode="contain"
          />
          <Text style={styles.itemText}>
            Everyday, Annadanam (free food) is provided for around 500 and more people at the premises of Sreemath Hariharapura. To feed more and more people in future, “Sri Lakshmi Narasimha Prasada Mandiram” – a large modern kitchen with dining facility to accommodate around 2000 people at a time is presently on construction.
          </Text>
        </View>
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
  itemText: { fontSize: 11, lineHeight: 18, color: '#555', marginBottom: 8 },
});
