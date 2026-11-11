import AutoTranslatedText from '@/components/AutoTranslatedText';
import { router } from 'expo-router';
import { Linking, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const openDirections = async () => {
  const url =
    'https://www.google.com/maps/dir/?api=1&destination=Shri+Adi+Shankaracharya+Sharada+Lakshminarasimha+Peta+Hariharapura+Karnataka';

  try {
    await Linking.openURL(url);
  } catch (error) {
    console.log('Unable to open Google Maps:', error);
  }
};

export default function TempleLocationScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* ================= HEADER ================= */}

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <AutoTranslatedText style={styles.headerTitle}>
              Temple Location
            </AutoTranslatedText>

            <AutoTranslatedText style={styles.headerSubtitle}>
              Divyakshetra Hariharapura
            </AutoTranslatedText>
          </View>
        </View>

        {/* ================= TEMPLE ADDRESS ================= */}

        <View style={styles.sectionHeader}>
          <AutoTranslatedText style={styles.sectionTitle}>
            Temple Address
          </AutoTranslatedText>
        </View>

        <View style={styles.addressCard}>
          <View style={styles.addressIconCircle}>
            <Text style={styles.addressPin}>
              📍
            </Text>
          </View>

          <View style={styles.addressContent}>
            <AutoTranslatedText style={styles.addressTitle}>
              Temple Address
            </AutoTranslatedText>

            <AutoTranslatedText style={styles.addressLine}>
              Hariharapura, Chikmagalur District,
            </AutoTranslatedText>

            <AutoTranslatedText style={styles.addressLine}>
              Karnataka, India - 577120
            </AutoTranslatedText>

            <AutoTranslatedText style={styles.addressLine}>
              Hariharapura, Karnataka 577120
            </AutoTranslatedText>
          </View>
        </View>

        {/* ================= TEMPLE LOCATION ================= */}

        <View style={styles.sectionHeader}>
          <AutoTranslatedText style={styles.sectionTitle}>
            Temple Location
          </AutoTranslatedText>
        </View>

        <View style={styles.googleMapsCard}>

          <View style={styles.googleMapsIconContainer}>
            <Text style={styles.googleMapsIcon}>
              🗺️
            </Text>
          </View>

          <AutoTranslatedText style={styles.googleMapsTitle}>
            Find Us on Google Maps
          </AutoTranslatedText>

          <AutoTranslatedText style={styles.googleMapsSubtitle}>
            Open the temple location and get directions
            from your current location.
          </AutoTranslatedText>

          <TouchableOpacity
            style={styles.googleMapsButton}
            onPress={openDirections}
            activeOpacity={0.85}
          >
            <AutoTranslatedText style={styles.googleMapsButtonText}>
              Open Google Maps
            </AutoTranslatedText>
          </TouchableOpacity>

        </View>

        {/* ================= HOW TO REACH ================= */}

        <View style={styles.howToReachHeader}>
          <AutoTranslatedText style={styles.howToReachTitle}>
            How to Reach
          </AutoTranslatedText>

          <AutoTranslatedText style={styles.howToReachSubtitle}>
            Plan your journey to Divyakshetra Hariharapura
          </AutoTranslatedText>
        </View>

        {/* ================= BY AIR ================= */}

        <View style={styles.travelCard}>

          <View style={styles.travelIconCircle}>
            <Image
              source={{
                uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/contact/air.png',
              }}
              style={styles.travelIcon}
              resizeMode="contain"
            />
          </View>

          <View style={styles.travelContent}>
            <AutoTranslatedText style={styles.travelTitle}>
              By Air
            </AutoTranslatedText>

            <Text style={styles.travelText}>
              The closest major airports are Bangalore,
              Mangalore and Shivamogga. Divyakshetra
              Hariharapura is reachable by road from
              all these airports.
            </Text>
          </View>

        </View>

        {/* ================= BY ROAD ================= */}

        <View style={styles.travelCard}>

          <View style={styles.travelIconCircle}>
            <Image
              source={{
                uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/contact/road.png',
              }}
              style={styles.travelIcon}
              resizeMode="contain"
            />
          </View>

          <View style={styles.travelContent}>
            <AutoTranslatedText style={styles.travelTitle}>
              By Road
            </AutoTranslatedText>

            <AutoTranslatedText style={styles.travelText}>
              Bangalore is about 280 Kms and Mangalore
              is about 125 Kms from Divyakshetra
              Hariharapura.
            </AutoTranslatedText>

            <AutoTranslatedText style={styles.travelText}>
              Buses, private or state, run day and night
              with regular frequency from both these
              cities.
            </AutoTranslatedText>

            <AutoTranslatedText style={styles.travelText}>
              There are also night sleeper buses
              operating from Bangalore to Hariharapura.
            </AutoTranslatedText>
          </View>

        </View>

        {/* ================= BY TRAIN ================= */}

        <View style={styles.travelCard}>

          <View style={styles.travelIconCircle}>
            <Image
              source={{
                uri: 'https://www.divyakshetrahariharapura.com/web/assets/img/contact/train.png',
              }}
              style={styles.travelIcon}
              resizeMode="contain"
            />
          </View>

          <View style={styles.travelContent}>
            <AutoTranslatedText style={styles.travelTitle}>
              By Train
            </AutoTranslatedText>

            <AutoTranslatedText style={styles.travelText}>
              Disembark at Shimoga if traveling from
              Bangalore. It is a 3-hour bus trip from
              there.
            </AutoTranslatedText>

            <Text style={styles.travelText}>
              If traveling from Mumbai by Konkan Rail,
              disembark at Udupi or Mangalore. It is
              again about a 3-hour drive from these
              cities.
            </Text>
          </View>

        </View>

        {/* ================= PLACES CLOSE BY ================= */}

        <View style={styles.nearbyCard}>

          <View style={styles.nearbyHeader}>

            <View style={styles.nearbyIconCircle}>
              <Text style={styles.nearbyIcon}>
                🛕
              </Text>
            </View>

            <View style={styles.nearbyHeaderContent}>
              <AutoTranslatedText style={styles.nearbyTitle}>
                Places Close By
              </AutoTranslatedText>

              <AutoTranslatedText style={styles.nearbySubtitle}>
                Nearby pilgrim centres
              </AutoTranslatedText>
            </View>

          </View>

          <AutoTranslatedText style={styles.nearbyDescription}>
            The famous pilgrim centres of Sringeri and
            Shakatapura are located close to
            Divyakshetra Hariharapura.
          </AutoTranslatedText>

          {/* SRINGERI */}

          <View style={styles.placeRow}>
            <View style={styles.placeDot} />

            <View style={styles.placeTextContainer}>
              <AutoTranslatedText style={styles.placeName}>
                Sringeri
              </AutoTranslatedText>

              <AutoTranslatedText style={styles.placeDistance}>
                20 Kms
              </AutoTranslatedText>
            </View>
          </View>

          {/* SHAKATAPURA */}

          <View style={styles.placeRow}>
            <View style={styles.placeDot} />

            <View style={styles.placeTextContainer}>
              <AutoTranslatedText style={styles.placeName}>
                Shakatapura
              </AutoTranslatedText>

              <AutoTranslatedText style={styles.placeDistance}>
                8 Kms
              </AutoTranslatedText>
            </View>
          </View>

          {/* KOPPA */}

          <View style={styles.placeRow}>
            <View style={styles.placeDot} />

            <View style={styles.placeTextContainer}>
              <AutoTranslatedText style={styles.placeName}>
                Koppa
              </AutoTranslatedText>

              <AutoTranslatedText style={styles.placeDistance}>
                About 15 mins to Hariharapura
              </AutoTranslatedText>
            </View>
          </View>

        </View>

        <View style={styles.bottomSpace} />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  /* =========================================================
     MAIN
  ========================================================= */

  container: {
    flex: 1,
    backgroundColor: '#FBF7F1',
  },

  scrollContent: {
    paddingBottom: 32,
  },

  /* =========================================================
     HEADER
  ========================================================= */

  header: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFDF9',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE4D6',
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2E5D1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  backText: {
    fontSize: 29,
    lineHeight: 32,
    color: '#8B0000',
    fontWeight: '400',
    marginTop: -2,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: '#760000',
    fontFamily: 'sans-serif',
  },

  headerSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    color: '#9A918A',
    marginTop: 1,
    fontFamily: 'sans-serif',
  },

  /* =========================================================
     SECTION HEADER
  ========================================================= */

  sectionHeader: {
    marginHorizontal: 12,
    marginTop: 18,
    marginBottom: 8,
  },

  sectionTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: '#4D372C',
    fontFamily: 'sans-serif',
  },

  /* =========================================================
     TEMPLE ADDRESS
  ========================================================= */

  addressCard: {
    marginHorizontal: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
    minHeight: 86,
    borderRadius: 13,
    backgroundColor: '#F2DEC2',
    flexDirection: 'row',
    alignItems: 'center',
  },

  addressIconCircle: {
    width: 43,
    height: 43,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },

  addressPin: {
    fontSize: 19,
  },

  addressContent: {
    flex: 1,
    minWidth: 0,
  },

  addressTitle: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    color: '#654A3A',
    marginBottom: 3,
    fontFamily: 'sans-serif-medium',
  },

  addressLine: {
    fontSize: 10,
    lineHeight: 14,
    color: '#806B5E',
    fontFamily: 'sans-serif',
  },

  /* =========================================================
     GOOGLE MAPS
  ========================================================= */

  googleMapsCard: {
    marginHorizontal: 10,
    minHeight: 170,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 3,
  },

  googleMapsIconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },

  googleMapsIcon: {
    fontSize: 32,
  },

  googleMapsTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#4B3428',
    textAlign: 'center',
    fontFamily: 'sans-serif-medium',
  },

  googleMapsSubtitle: {
    fontSize: 9.5,
    lineHeight: 14,
    color: '#99918B',
    textAlign: 'center',
    marginTop: 5,
    maxWidth: 285,
    fontFamily: 'sans-serif',
  },

  googleMapsButton: {
    minWidth: 145,
    marginTop: 13,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#B86629',

    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 2,
  },

  googleMapsButtonText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'sans-serif-medium',
  },

  /* =========================================================
     HOW TO REACH
  ========================================================= */

  howToReachHeader: {
    marginHorizontal: 12,
    marginTop: 25,
    marginBottom: 11,
  },

  howToReachTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    color: '#780000',
    fontFamily: 'sans-serif',
  },

  howToReachSubtitle: {
    fontSize: 10,
    lineHeight: 14,
    color: '#9A918A',
    marginTop: 3,
    fontFamily: 'sans-serif',
  },

  /* =========================================================
     TRAVEL CARDS
  ========================================================= */

  travelCard: {
    marginHorizontal: 10,
    marginBottom: 12,
    paddingHorizontal: 13,
    paddingVertical: 15,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',

    borderWidth: 1,
    borderColor: '#F0E5D7',

    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 2,
  },

  travelIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFF1D5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },

  travelIcon: {
    width: 30,
    height: 30,
  },

  travelContent: {
    flex: 1,
    minWidth: 0,
  },

  travelTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: '#850000',
    marginBottom: 5,
    fontFamily: 'sans-serif-medium',
  },

  travelText: {
    fontSize: 10.5,
    lineHeight: 16,
    color: '#615A55',
    fontFamily: 'sans-serif',
    marginBottom: 5,
  },

  /* =========================================================
     PLACES CLOSE BY
  ========================================================= */

  nearbyCard: {
    marginHorizontal: 10,
    marginTop: 5,
    paddingHorizontal: 15,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: '#E9DDCC',
  },

  nearbyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  nearbyIconCircle: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#F3E5CD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  nearbyIcon: {
    fontSize: 21,
  },

  nearbyHeaderContent: {
    flex: 1,
  },

  nearbyTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: '#780000',
    fontFamily: 'sans-serif-medium',
  },

  nearbySubtitle: {
    fontSize: 9.5,
    lineHeight: 13,
    color: '#99918B',
    marginTop: 2,
    fontFamily: 'sans-serif',
  },

  nearbyDescription: {
    fontSize: 10.5,
    lineHeight: 16,
    color: '#68615C',
    marginTop: 14,
    marginBottom: 5,
    fontFamily: 'sans-serif',
  },

  /* =========================================================
     PLACES
  ========================================================= */

  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#EFE6DA',
  },

  placeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#B87928',
    marginRight: 11,
  },

  placeTextContainer: {
    flex: 1,
    minWidth: 0,
  },

  placeName: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#4D4038',
    fontFamily: 'sans-serif-medium',
  },

  placeDistance: {
    fontSize: 10,
    lineHeight: 14,
    color: '#918982',
    marginTop: 1,
    fontFamily: 'sans-serif',
  },

  /* =========================================================
     BOTTOM
  ========================================================= */

  bottomSpace: {
    height: 20,
  },
});