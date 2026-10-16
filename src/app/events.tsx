import React, { useCallback, useState } from 'react';

import {

  ActivityIndicator,

  Image,

  RefreshControl,

  ScrollView,

  StyleSheet,

  Text,

  TouchableOpacity,

  View,

} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useFocusEffect, router } from 'expo-router';

import { useTranslation } from 'react-i18next';

import { apiRequest } from '@/services/api';



type Category = {
  id: number;
  name: string;
  name_en?: string | null;
  name_te?: string | null;
  name_kn?: string | null;
  name_hi?: string | null;
  name_ta?: string | null;
};

type CategoryLanguage = 'en' | 'te' | 'kn' | 'hi' | 'ta';

function translatedCategoryName(category: Category, language: string): string {
  const code = language.split('-')[0] as CategoryLanguage;
  const field: Record<CategoryLanguage, keyof Category> = {
    en: 'name_en',
    te: 'name_te',
    kn: 'name_kn',
    hi: 'name_hi',
    ta: 'name_ta',
  };
  const translated = category[field[code] || 'name_en'];
  return typeof translated === 'string' && translated.trim()
    ? translated.trim()
    : category.name_en?.trim() || category.name;
}

type TempleEvent = {

  id: number;

  title: string;

  description?: string | null;

  image_url?: string | null;

  event_date?: string | null;

  start_time?: string | null;

  end_time?: string | null;

  location?: string | null;

  category_id: number;

  category_name: string;

};

type ApiResponse<T> = { success: boolean; data: T };

type Period = 'upcoming' | 'past';

const LOCALES: Record<string, string> = {

  en: 'en-IN', te: 'te-IN', kn: 'kn-IN', hi: 'hi-IN', ta: 'ta-IN',

};



export default function EventsScreen() {

  const { t, i18n } = useTranslation();

  const [period, setPeriod] = useState<Period>('upcoming');

  const [categoryId, setCategoryId] = useState<number | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);

  const [events, setEvents] = useState<TempleEvent[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState('');

  const locale = LOCALES[i18n.language.split('-')[0]] || 'en-IN';



  const loadData = useCallback(async (showLoader = true) => {

    if (showLoader) setLoading(true);

    setError('');

    try {

      const [categoryResponse, eventResponse] = await Promise.all([

        apiRequest<ApiResponse<Category[]>>('/event-categories'),

        apiRequest<ApiResponse<TempleEvent[]>>(`/events?type=${period}`),

      ]);

      const activeCategories = categoryResponse.data || [];

      setCategories(activeCategories);

      setEvents(eventResponse.data || []);

      setCategoryId((current) =>

        current !== null && !activeCategories.some((c) => c.id === current)

          ? null

          : current

      );

    } catch (err) {

      console.error('Load temple events failed:', err);

      setError(t('events.loadError', { defaultValue: 'Unable to load events. Please try again.' }));

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  }, [period, t]);



  useFocusEffect(useCallback(() => {

    void loadData();

  }, [loadData]));



  function formatDate(value?: string | null) {

    if (!value) return '—';

    const date = new Date(`${value.slice(0, 10)}T12:00:00`);

    return Number.isNaN(date.getTime()) ? value.slice(0, 10) :

      date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });

  }



  const visibleEvents = categoryId === null

    ? events

    : events.filter((event) => event.category_id === categoryId);

  const categoryCounts = (id: number) => events.filter((event) => event.category_id === id).length;

  const categoryNameForEvent = (event: TempleEvent): string => {
    const category = categories.find((item) => item.id === event.category_id);
    return category
      ? translatedCategoryName(category, i18n.language)
      : event.category_name;
  };



  return (

    <SafeAreaView style={styles.container}>

      <ScrollView

        contentContainerStyle={styles.content}

        showsVerticalScrollIndicator={false}

        refreshControl={

          <RefreshControl refreshing={refreshing} onRefresh={() => {

            setRefreshing(true);

            void loadData(false);

          }} />

        }

      >

        <Text style={styles.eyebrow}>{t('events.community', { defaultValue: 'Temple Community' })}</Text>

        <Text style={styles.heading}>{t('events.title', { defaultValue: 'Temple Events' })} 📅</Text>

        <Text style={styles.subtitle}>{t('events.subtitle', { defaultValue: 'Explore temple celebrations and special occasions' })}</Text>



        <View style={styles.periodRow}>

          {(['upcoming', 'past'] as Period[]).map((value) => (

            <TouchableOpacity

              key={value}

              style={[styles.periodButton, period === value && styles.periodActive]}

              onPress={() => { setPeriod(value); setCategoryId(null); }}

            >

              <Text style={[styles.periodText, period === value && styles.periodTextActive]}>

                {value === 'upcoming'

                  ? t('events.upcoming', { defaultValue: 'Upcoming Events' })

                  : t('events.past', { defaultValue: 'Past Events' })}

              </Text>

            </TouchableOpacity>

          ))}

        </View>



        {loading ? (

          <ActivityIndicator size="large" color="#8B4513" style={styles.center} />

        ) : error ? (

          <View style={styles.center}>

            <Text style={styles.error}>{error}</Text>

            <TouchableOpacity style={styles.retry} onPress={() => void loadData()}>

              <Text style={styles.retryText}>{t('events.retry', { defaultValue: 'Retry' })}</Text>

            </TouchableOpacity>

          </View>

        ) : (

          <>

            <Text style={styles.sectionHeading}>{t('events.categories', { defaultValue: 'Event Categories' })}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>

              <TouchableOpacity

                style={[styles.chip, categoryId === null && styles.chipActive]}

                onPress={() => setCategoryId(null)}

              >

                <Text style={[styles.chipText, categoryId === null && styles.chipTextActive]}>

                  {t('events.allCategories', { defaultValue: 'All Categories' })} ({events.length})

                </Text>

              </TouchableOpacity>

              {categories.map((category) => (

                <TouchableOpacity

                  key={category.id}

                  style={[styles.chip, categoryId === category.id && styles.chipActive]}

                  onPress={() => setCategoryId(category.id)}

                >

                  <Text style={[styles.chipText, categoryId === category.id && styles.chipTextActive]}>

                    {translatedCategoryName(category, i18n.language)} ({categoryCounts(category.id)})

                  </Text>

                </TouchableOpacity>

              ))}

            </ScrollView>



            <Text style={styles.sectionHeading}>

              {period === 'upcoming'

                ? t('events.upcoming', { defaultValue: 'Upcoming Events' })

                : t('events.past', { defaultValue: 'Past Events' })}

            </Text>

            {visibleEvents.length === 0 ? (

              <Text style={styles.empty}>{t('events.noEvents', { defaultValue: 'No events found in this category.' })}</Text>

            ) : visibleEvents.map((event) => (

              <TouchableOpacity

                key={event.id}

                activeOpacity={0.8}

                style={styles.eventCard}

                onPress={() => router.push({ pathname: '/events/[id]' as any, params: { id: String(event.id), period } })}

              >

                {event.image_url ? (

                  <Image source={{ uri: event.image_url }} style={styles.image} resizeMode="cover" />

                ) : (

                  <View style={styles.placeholder}><Text style={styles.placeholderIcon}>🛕</Text></View>

                )}

                <View style={styles.eventBody}>

                  <Text style={styles.categoryLabel}>{categoryNameForEvent(event)}</Text>

                  <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>

                  <Text style={styles.meta}>📅 {formatDate(event.event_date)}</Text>

                  {(event.start_time || event.end_time) && (

                    <Text style={styles.meta}>🕐 {[event.start_time?.slice(0, 5), event.end_time?.slice(0, 5)].filter(Boolean).join(' – ')}</Text>

                  )}

                  {event.location ? <Text style={styles.meta} numberOfLines={1}>📍 {event.location}</Text> : null}

                  <Text style={styles.more}>{t('events.viewDetails', { defaultValue: 'View Details' })} →</Text>

                </View>

              </TouchableOpacity>

            ))}

          </>

        )}

      </ScrollView>

    </SafeAreaView>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#FFF9F0' },

  content: { padding: 20, paddingBottom: 50 },

  eyebrow: { fontSize: 13, color: '#9A806B', marginBottom: 4 },

  heading: { fontSize: 26, fontWeight: '800', color: '#4A2C18' },

  subtitle: { fontSize: 12, color: '#777', marginTop: 6, lineHeight: 19 },

  periodRow: { flexDirection: 'row', marginTop: 24, marginBottom: 22, gap: 10 },

  periodButton: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: '#F2E3D2', alignItems: 'center' },

  periodActive: { backgroundColor: '#8B4513' },

  periodText: { color: '#7B4C2C', fontSize: 12, fontWeight: '700' },

  periodTextActive: { color: '#FFFFFF' },

  sectionHeading: { color: '#4A2C18', fontWeight: '800', fontSize: 17, marginBottom: 12 },

  chips: { paddingBottom: 20, gap: 8 },

  chip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: '#E4C9A9', backgroundColor: '#FFFFFF' },

  chipActive: { backgroundColor: '#8B4513', borderColor: '#8B4513' },

  chipText: { fontSize: 12, fontWeight: '600', color: '#784D2D' },

  chipTextActive: { color: '#FFFFFF' },

  eventCard: { backgroundColor: '#FFFFFF', borderRadius: 18, marginBottom: 14, overflow: 'hidden', elevation: 2 },

  image: { width: '100%', height: 160 },

  placeholder: { height: 110, backgroundColor: '#F4E0C5', justifyContent: 'center', alignItems: 'center' },

  placeholderIcon: { fontSize: 38 },

  eventBody: { padding: 16 },

  categoryLabel: { color: '#B56A22', fontWeight: '700', fontSize: 11, marginBottom: 5 },

  eventTitle: { color: '#4A2C18', fontWeight: '800', fontSize: 16, marginBottom: 9 },

  meta: { fontSize: 12, color: '#786A60', marginBottom: 5 },

  more: { fontSize: 12, fontWeight: '700', color: '#8B4513', marginTop: 8 },

  center: { marginTop: 35, alignItems: 'center' },

  error: { color: '#B3261E', textAlign: 'center', marginBottom: 15 },

  retry: { backgroundColor: '#8B4513', borderRadius: 18, paddingHorizontal: 24, paddingVertical: 10 },

  retryText: { color: '#FFFFFF', fontWeight: '700' },

  empty: { textAlign: 'center', color: '#877A70', marginTop: 25, fontSize: 13 },

});
