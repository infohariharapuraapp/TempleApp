import { useTranslation } from 'react-i18next';

import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PURPLE = '#6A35A0';
const BG = '#FFF4F8';
const TEXT = '#102B3A';
const MUTED = '#71808B';

const MOCK_MY_SEVAS = [
  {
    id: 'SR-1001',
    type: 'Individual Seva',
    name: 'Ravi Kumar',
    date: '10 Sep 2026',
    time: '08:00 AM',
    assignedSeva: '',
    status: 'Pending Admin Assignment',
  },
  {
    id: 'SR-1002',
    type: 'Group Seva',
    name: 'Sri Lakshmi Group',
    members: 10,
    date: '12 Sep 2026',
    time: '06:00 PM',
    assignedSeva: 'Annadanam Seva',
    status: 'Seva Assigned',
  },
];

export default function MySevasScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('bookingScreens.sevaRegistrations')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('bookingScreens.mySevas')}</Text>
        <Text style={styles.subtitle}>{t('bookingScreens.sevaSubtitle')}</Text>

        {MOCK_MY_SEVAS.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.top}>
              <View>
                <Text style={styles.id}>{item.id}</Text>
                <Text style={styles.type}>{t(item.type === 'Individual Seva' ? 'bookingScreens.individualSeva' : 'bookingScreens.groupSeva')}</Text>
              </View>
              <View style={styles.status}><Text style={styles.statusText}>{t(item.status === 'Seva Assigned' ? 'bookingScreens.sevaAssigned' : 'bookingScreens.pendingAssignment')}</Text></View>
            </View>

            <Text style={styles.name}>{item.name}</Text>

            <View style={styles.infoBox}>
              <Info label={t('bookingScreens.date')} value={item.date} />
              <Info label={t('bookingScreens.time')} value={item.time} />
              {item.members ? <Info label={t('bookingScreens.members')} value={String(item.members)} /> : <Info label={t('bookingScreens.type')} value={t('bookingScreens.individual')} />}
            </View>

            <TouchableOpacity style={styles.details}>
              <Text style={styles.detailsText}>{t('bookingScreens.registrationDetails')}</Text>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.button} onPress={() => router.push('/seva-registration')}>
          <Text style={styles.buttonText}>{t('bookingScreens.registerNewSeva')}</Text>
        </TouchableOpacity>

        <Text style={styles.note}>{t('bookingScreens.mockNote')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { height: 78, backgroundColor: PURPLE, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  back: { color: '#FFF', fontSize: 42, lineHeight: 42, marginRight: 4 },
  title: { color: '#FFF', fontSize: 21, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 50 },
  heading: { color: TEXT, fontSize: 26, fontWeight: '800', marginTop: 8 },
  subtitle: { color: MUTED, fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 18 },
  card: { backgroundColor: '#FFF', borderRadius: 22, padding: 16, marginBottom: 13, borderWidth: 1, borderColor: '#E8DDE8' },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  id: { color: PURPLE, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  type: { color: TEXT, fontSize: 17, fontWeight: '800', marginTop: 3 },
  status: { backgroundColor: '#E5F3E9', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { color: '#2F7D4A', fontSize: 9, fontWeight: '800' },
  name: { color: TEXT, fontSize: 15, fontWeight: '700', marginTop: 13, marginBottom: 10 },
  infoBox: { flexDirection: 'row', backgroundColor: '#F2E2F7', borderRadius: 14, paddingVertical: 11 },
  infoItem: { flex: 1, alignItems: 'center' },
  infoLabel: { color: MUTED, fontSize: 7, fontWeight: '800' },
  infoValue: { color: TEXT, fontSize: 10, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  assignmentBox: { backgroundColor: '#FFF7FB', borderWidth: 1, borderColor: '#E5D4E8', borderRadius: 14, padding: 12, marginTop: 11 },
  assignmentLabel: { color: MUTED, fontSize: 8, fontWeight: '800' },
  assignmentValue: { color: TEXT, fontSize: 13, fontWeight: '800', marginTop: 4 },
  details: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 12 },
  detailsText: { color: PURPLE, fontSize: 11, fontWeight: '800' },
  arrow: { color: PURPLE, fontSize: 17, marginLeft: 5 },
  button: { backgroundColor: PURPLE, height: 54, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  note: { textAlign: 'center', color: '#A48BAE', fontSize: 8, letterSpacing: 0.8, marginTop: 13 },
});
