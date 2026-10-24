import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
export default function AboutSreemathScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image
            source={{
              uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/normal/about-img.jpg',
            }}
            style={styles.hero}
            resizeMode="cover"
          />
        </View>
        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.eyebrow}>
            {t('aboutSreemath.eyebrow')}
          </Text>
          <Text style={styles.title}>
            {t('aboutSreemath.title')}
          </Text>
          <Text style={styles.body}>
            {t('aboutSreemath.paragraph1')}
          </Text>
          <Text style={styles.body}>
            {t('aboutSreemath.paragraph2')}
          </Text>
          <Text style={styles.body}>
            {t('aboutSreemath.paragraph3')}
          </Text>
          {/* Heritage Card */}
          <View style={styles.heritageCard}>
            <Text style={styles.cardTitle}>
              {t('aboutSreemath.cardTitle')}
            </Text>
            <Text style={styles.cardText}>
              {t('aboutSreemath.cardText')}
            </Text>
          </View>
          <Text style={styles.heading}>
            {t('aboutSreemath.heading')}
          </Text>
          <Text style={styles.body}>
            {t('aboutSreemath.paragraph4')}
          </Text>
        </View>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.back}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>
            {t('aboutSreemath.back')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9F0',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  heroContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#4A2C18',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  hero: {
    width: '100%',
    height: 270,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#C58A2A',
    marginBottom: 8,
  },
  title: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '800',
    color: '#4A2C18',
    marginBottom: 16,
  },
  body: {
    fontSize: 14,
    lineHeight: 23,
    color: '#6E5A49',
    marginBottom: 16,
  },
  heritageCard: {
    backgroundColor: '#F3DEC5',
    borderRadius: 18,
    padding: 20,
    marginTop: 6,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: '#E6C89F',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6F3518',
    marginBottom: 9,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6E5A49',
  },
  heading: {
    fontSize: 21,
    fontWeight: '800',
    color: '#4A2C18',
    marginBottom: 9,
  },
  back: {
    marginHorizontal: 22,
    marginBottom: 30,
    marginTop: 4,
    paddingVertical: 13,
  },
  backText: {
    color: '#8B4513',
    fontWeight: '800',
    fontSize: 14,
  },
});
