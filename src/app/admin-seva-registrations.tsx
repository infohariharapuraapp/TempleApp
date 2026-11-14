import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PURPLE = '#6A35A0';
const BG = '#FFF4F8';
const TEXT = '#102B3A';
const MUTED = '#71808B';

const SEVAS = [
  'Archana Seva',
  'Abhishekam Seva',
  'Sahasranama Seva',
  'Special Pooja',
  'Annadanam Seva',
];

type Registration = {
  id: string;
  type: string;
  name: string;
  mobile: string;
  date: string;
  time: string;
  city: string;
  members?: number;
  assignedSeva: string;
  status: 'Pending Admin Assignment' | 'Seva Assigned' | 'Completed';
};

const INITIAL_REGISTRATIONS: Registration[] = [
  {
    id: 'SR-1001',
    type: 'Individual Seva',
    name: 'Ravi Kumar',
    mobile: '9876543210',
    date: '10 Sep 2026',
    time: '08:00 AM',
    city: 'Tenali',
    assignedSeva: '',
    status: 'Pending Admin Assignment',
  },
  {
    id: 'SR-1002',
    type: 'Group Seva',
    name: 'Sri Lakshmi Group',
    mobile: '9123456780',
    date: '12 Sep 2026',
    time: '06:00 PM',
    city: 'Guntur',
    members: 10,
    assignedSeva: 'Annadanam Seva',
    status: 'Seva Assigned',
  },
  {
    id: 'SR-1003',
    type: 'Individual Seva',
    name: 'Priya Sharma',
    mobile: '9988776655',
    date: '13 Sep 2026',
    time: '10:00 AM',
    city: 'Vijayawada',
    assignedSeva: 'Archana Seva',
    status: 'Completed',
  },
];

export default function AdminSevaRegistrationsScreen() {
  // ADMIN_SEVA_LANGUAGE_V1
  const { t, i18n } = useTranslation();
  const language = (
    i18n.resolvedLanguage ||
    i18n.language ||
    'en'
  ).split('-')[0];
  const locales: Record<string, string> = {
    en: 'en-IN',
    te: 'te-IN',
    kn: 'kn-IN',
    hi: 'hi-IN',
    ta: 'ta-IN',
  };
  const locale = locales[language] || 'en-IN';
  const translateLabel = (value: string) => {
    const key = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return t('adminSevaLocal.' + key, {
      defaultValue: value,
    });
  };
  const formatDate = (value: string) => {
    if (language === 'en') return value;
    const match = value.match(
      /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/
    );
    if (!match) return value;
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr',
      'May', 'Jun', 'Jul', 'Aug',
      'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const month = months.indexOf(match[2]);
    if (month < 0) return value;
    const date = new Date(
      Number(match[3]),
      month,
      Number(match[1])
    );
    try {
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date);
    } catch {
      return value;
    }
  };
  const formatTime = (value: string) => {
    if (language === 'en') return value;
    const match = value.match(
      /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
    );
    if (!match) return value;
    let hours = Number(match[1]) % 12;
    if (match[3].toUpperCase() === 'PM') {
      hours += 12;
    }
    const date = new Date(
      2000, 0, 1,
      hours,
      Number(match[2])
    );
    try {
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return value;
    }
  };

  const [registrations, setRegistrations] = useState(INITIAL_REGISTRATIONS);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const list = useMemo(() => {
    return registrations.filter((item) => {
      const matchesFilter = filter === 'All' || item.type === filter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.mobile.includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [registrations, filter, search]);

  const assignSeva = (seva: string) => {
    if (!assigningId) return;

    setRegistrations((old) =>
      old.map((item) =>
        item.id === assigningId
          ? { ...item, assignedSeva: seva, status: 'Seva Assigned' }
          : item
      )
    );

    Alert.alert(
      t('adminSevaLocal.seva_assigned'),
      t('adminSevaLocal.assignment_success', {
        seva: translateLabel(seva),
      })
    );
    setAssigningId(null);
  };

  const markCompleted = (id: string) => {
    setRegistrations((old) =>
      old.map((item) =>
        item.id === id ? { ...item, status: 'Completed' } : item
      )
    );
  };

  const pending = registrations.filter(x => x.status === 'Pending Admin Assignment').length;
  const assigned = registrations.filter(x => x.status === 'Seva Assigned').length;
  const completed = registrations.filter(x => x.status === 'Completed').length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{t('adminSevaLocal.admin_temple_operations')}</Text>
        <Text style={styles.title}>{t('adminSevaLocal.seva_registrations')}</Text>
        <Text style={styles.subtitle}>{t('adminSevaLocal.review_registrations_and_assign_the_seva_after_the_devotee_completes_registration')}</Text>

        <View style={styles.summaryRow}>
          <Summary value={String(pending).padStart(2, '0')} label={t('adminSevaLocal.pending')} />
          <Summary value={String(assigned).padStart(2, '0')} label={t('adminSevaLocal.assigned')} />
          <Summary value={String(completed).padStart(2, '0')} label={t('adminSevaLocal.completed')} />
        </View>

        <TextInput
          style={styles.search}
          placeholder={t('adminSevaLocal.search_registration_name_or_mobile')}
          placeholderTextColor={MUTED}
          value={search}
          onChangeText={setSearch}
        />

        <View style={styles.filters}>
          {['All', 'Individual Seva', 'Group Seva'].map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => setFilter(item)}
              style={[styles.filter, filter === item && styles.filterSelected]}
            >
              <Text style={[styles.filterText, filter === item && styles.filterTextSelected]}>
                {translateLabel(item)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {list.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.top}>
              <View style={{ flex: 1 }}>
                <Text style={styles.id}>{item.id}</Text>
                <Text style={styles.type}>{translateLabel(item.type)}</Text>
              </View>

              <View style={styles.status}>
                <Text style={styles.statusText}>{translateLabel(item.status)}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Row label={t('adminSevaLocal.devotee_group')} value={item.name} />
            <Row label={t('adminSevaLocal.mobile')} value={item.mobile} />
            <Row label={t('adminSevaLocal.city')} value={item.city} />
            {item.members ? <Row label={t('adminSevaLocal.group_members')} value={String(item.members)} /> : null}
            <Row label={t('adminSevaLocal.preferred_date')} value={formatDate(item.date)} />
            <Row label={t('adminSevaLocal.preferred_time')} value={formatTime(item.time)} />
            <Row label={t('adminSevaLocal.assigned_seva')} value={translateLabel(item.assignedSeva || 'Not Assigned')} />

            {item.status === 'Pending Admin Assignment' && (
              <TouchableOpacity
                style={styles.assignButton}
                onPress={() => setAssigningId(item.id)}
              >
                <Text style={styles.assignButtonText}>{t('adminSevaLocal.assign_seva')}</Text>
              </TouchableOpacity>
            )}

            {item.status === 'Seva Assigned' && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={() => setAssigningId(item.id)}
                >
                  <Text style={styles.changeButtonText}>{t('adminSevaLocal.change_seva')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => markCompleted(item.id)}
                >
                  <Text style={styles.completeButtonText}>{t('adminSevaLocal.mark_completed')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.status === 'Completed' && (
              <View style={styles.completedBox}>
                <Text style={styles.completedText}>{t('adminSevaLocal.seva_completed_check')}</Text>
              </View>
            )}
          </View>
        ))}

        <Text style={styles.note}>{t('adminSevaLocal.mock_data_admin_ui_preview')}</Text>
      </ScrollView>

      <Modal
        transparent
        visible={assigningId !== null}
        animationType="slide"
        onRequestClose={() => setAssigningId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('adminSevaLocal.assign_seva')}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('adminSevaLocal.close')}
                onPress={() => setAssigningId(null)}
              >
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHint}>{t('adminSevaLocal.select_the_seva_to_assign_to_this_registration')}</Text>

            {SEVAS.map((seva) => (
              <TouchableOpacity
                key={seva}
                style={styles.sevaOption}
                onPress={() => assignSeva(seva)}
              >
                <Text style={styles.sevaOptionText}>{translateLabel(seva)}</Text>
                <Text style={styles.sevaArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Summary({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 20, paddingBottom: 50 },
  eyebrow: { color: PURPLE, fontSize: 8, fontWeight: '800', letterSpacing: 1.4, marginTop: 7 },
  title: { color: TEXT, fontSize: 27, fontWeight: '800', marginTop: 3 },
  subtitle: { color: MUTED, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 },
  summary: { width: '31.5%', backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#E8DDE8' },
  summaryValue: { color: PURPLE, fontSize: 21, fontWeight: '800' },
  summaryLabel: { color: MUTED, fontSize: 9, marginTop: 3 },
  search: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDD2DE', borderRadius: 15, height: 48, paddingHorizontal: 14, color: TEXT, marginBottom: 10, fontSize: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  filter: { borderWidth: 1, borderColor: '#D6C7DA', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#FFF' },
  filterSelected: { backgroundColor: PURPLE, borderColor: PURPLE },
  filterText: { color: PURPLE, fontSize: 9, fontWeight: '800' },
  filterTextSelected: { color: '#FFF' },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#E8DDE8' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  id: { color: PURPLE, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  type: { color: TEXT, fontSize: 16, fontWeight: '800', marginTop: 3 },
  status: { backgroundColor: '#EFE2F7', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { color: PURPLE, fontSize: 8, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#F0E7F1', marginVertical: 10 },
  row: { flexDirection: 'row', paddingVertical: 5 },
  rowLabel: { width: '42%', color: MUTED, fontSize: 10 },
  rowValue: { flex: 1, color: TEXT, fontSize: 10, fontWeight: '700', textAlign: 'right' },
  assignButton: { backgroundColor: PURPLE, borderRadius: 16, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  assignButtonText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  changeButton: { flex: 1, borderWidth: 1, borderColor: PURPLE, borderRadius: 15, height: 44, alignItems: 'center', justifyContent: 'center' },
  changeButtonText: { color: PURPLE, fontSize: 10, fontWeight: '800' },
  completeButton: { flex: 1, backgroundColor: PURPLE, borderRadius: 15, height: 44, alignItems: 'center', justifyContent: 'center' },
  completeButtonText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  completedBox: { backgroundColor: '#E5F3E9', borderRadius: 15, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
  completedText: { color: '#2F7D4A', fontSize: 10, fontWeight: '800' },
  note: { textAlign: 'center', color: '#A48BAE', fontSize: 8, letterSpacing: 0.7, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: TEXT, fontSize: 21, fontWeight: '800' },
  modalClose: { color: PURPLE, fontSize: 30 },
  modalHint: { color: MUTED, fontSize: 11, lineHeight: 17, marginTop: 4, marginBottom: 10 },
  sevaOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F0E7F1' },
  sevaOptionText: { color: TEXT, fontSize: 15, fontWeight: '700' },
  sevaArrow: { color: PURPLE, fontSize: 26 },
});
