import AutoTranslatedText from '@/components/AutoTranslatedText';
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
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <AutoTranslatedText style={styles.title}>My Seva Registrations</AutoTranslatedText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <AutoTranslatedText style={styles.heading}>My Sevas</AutoTranslatedText>
        <AutoTranslatedText style={styles.subtitle}>View registrations and the seva assigned by temple admin.</AutoTranslatedText>

        {MOCK_MY_SEVAS.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.top}>
              <View>
                <Text style={styles.id}>{item.id}</Text>
                <Text style={styles.type}>{item.type}</Text>
              </View>
              <View style={styles.status}><Text style={styles.statusText}>{item.status}</Text></View>
            </View>

            <Text style={styles.name}>{item.name}</Text>

            <View style={styles.infoBox}>
              <Info label="DATE" value={item.date} />
              <Info label="TIME" value={item.time} />
              {item.members ? <Info label="MEMBERS" value={String(item.members)} /> : <Info label="TYPE" value="Individual" />}
            </View>

            <TouchableOpacity style={styles.details}>
              <AutoTranslatedText style={styles.detailsText}>Registration Details</AutoTranslatedText>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.button} onPress={() => router.push('/seva-registration')}>
          <AutoTranslatedText style={styles.buttonText}>Register New Seva</AutoTranslatedText>
        </TouchableOpacity>

        <AutoTranslatedText style={styles.note}>MOCK DATA • BACKEND WILL BE CONNECTED LATER</AutoTranslatedText>
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
