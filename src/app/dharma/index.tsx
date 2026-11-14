import { useTranslation } from 'react-i18next';
import dharmaI18n from '@/localization/i18n';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  fetchDharmaCategories,
  fetchDharmaQuestions,
  type DharmaCategory,
  type DharmaQuestion,
} from '@/services/dharmaApi';

// ========================================
// COLORS
// ========================================


function localizeDharmaError(value: string): string {
  const key = value.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const translationKey = 'dharmaLocal.' + key;
  return dharmaI18n.exists(translationKey)
    ? String(dharmaI18n.t(translationKey))
    : String(dharmaI18n.t(
        'dharmaLocal.something_went_wrong_please_try_again'
      ));
}

const COLORS = {
  background: '#FFFDF8',
  maroon: '#6B1720',
  gold: '#C69A3A',
  goldSoft: '#F7EBD7',
  border: '#E8DCCB',
  text: '#30241F',
  muted: '#8E8175',
  white: '#FFFFFF',
};

type StatusFilter = 'Latest' | 'Unanswered' | 'Answered';

const PAGE_SIZE = 20;

// ========================================
// HELPERS
// ========================================

function formatDate(value?: string) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(
      (dharmaI18n.resolvedLanguage ||
        dharmaI18n.language ||
        'en').split('-')[0] + '-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

// ========================================
// SCREEN
// ========================================

export default function DharmaScreen() {
  // DHARMA_LANGUAGE_V1
  const { t, i18n } = useTranslation();
  const language =
    (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusFilter>('Latest');

  const [categories, setCategories] = useState<DharmaCategory[]>([]);
  const [questions, setQuestions] = useState<DharmaQuestion[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const categoryRequestRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const pageRef = useRef(1);
  const searchRef = useRef(search);

  // ========================================
  // FETCH CATEGORIES
  // ========================================

  const loadCategories = useCallback(async () => {
    const requestId = ++categoryRequestRef.current;
    try {
      const response = await fetchDharmaCategories();
      if (requestId !== categoryRequestRef.current) {
        return;
      }
      if (response.success) {
        setCategories(response.categories ?? []);
      }
    } catch (err) {
      if (requestId === categoryRequestRef.current) {
        console.error('Dharma categories error:', err);
      }
    }
  }, [language]);

  // ========================================
  // FETCH QUESTIONS
  // ========================================

  const loadQuestions = useCallback(
    async (
      nextPage = 1,
      isRefresh = false
    ) => {
      if (nextPage > 1 && loadingMoreRef.current) {
        return;
      }

      const requestId = ++requestIdRef.current;

      if (nextPage === 1) {
        loadingMoreRef.current = false;

        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);
      } else {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }

      try {
        const filter =
          status === 'Answered'
            ? 'answered'
            : status === 'Unanswered'
              ? 'unanswered'
              : 'latest';

        const response = await fetchDharmaQuestions({
          categoryId: categoryId ?? undefined,
          search: searchRef.current,
          filter,
          page: nextPage,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!response.success) {
          throw new Error('Unable to load questions.');
        }

        const received = response.questions ?? [];

        setQuestions((previous) => {
          if (nextPage === 1) {
            return received;
          }

          const existingIds = new Set(
            previous.map((question) => question.id)
          );

          return [
            ...previous,
            ...received.filter(
              (question) => !existingIds.has(question.id)
            ),
          ];
        });

        pageRef.current = nextPage;
        setPage(nextPage);

        const more =
          typeof response.hasMore === 'boolean'
            ? response.hasMore
            : received.length >= PAGE_SIZE;

        hasMoreRef.current = more;
        setHasMore(more);
        setError(null);
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.error('Dharma questions error:', err);

        setError(getErrorMessage(err));

        if (nextPage === 1) {
          setQuestions([]);
          hasMoreRef.current = false;
          setHasMore(false);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [categoryId, status, language]
  );

  // ========================================
  // INITIAL LOAD / FILTER CHANGE
  // ========================================

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchRef.current = search;
      loadQuestions(1);
    }, 350);

    return () => {
      clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [search, loadQuestions]);

  // Reload when returning from question details
  // or after submitting a question.
  useFocusEffect(
    useCallback(() => {
      loadCategories();
      searchRef.current = search;
      loadQuestions(1);

      return () => {
        requestIdRef.current += 1;
        categoryRequestRef.current += 1;
      };
    }, [loadCategories, loadQuestions, search])
  );

  const onRefresh = useCallback(() => {
    loadCategories();
    searchRef.current = search;
    loadQuestions(1, true);
  }, [loadCategories, loadQuestions, search]);

  const loadMore = useCallback(() => {
    if (
      loading ||
      refreshing ||
      loadingMoreRef.current ||
      !hasMoreRef.current
    ) {
      return;
    }

    loadQuestions(pageRef.current + 1);
  }, [loading, refreshing, loadQuestions]);

  // ========================================
  // RENDER QUESTION
  // ========================================

  const renderQuestion = ({
    item,
  }: {
    item: DharmaQuestion;
  }) => {
    const answerCount = Number(item.answer_count ?? 0);

    return (
      <TouchableOpacity
        style={styles.questionCard}
        activeOpacity={0.85}
        onPress={() =>
          router.push({
            pathname: '/dharma/[id]',
            params: { id: String(item.id) },
          } as any)
        }
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.categoryLabel}>
            {item.category_name || t('dharmaLocal.general_questions')}
          </Text>

          <Text style={styles.date}>
            {formatDate(item.created_at)}
          </Text>
        </View>

        <Text style={styles.questionTitle}>
          {item.title}
        </Text>

        <Text style={styles.author}>
          {t('dharmaLocal.asked_by_name', { name: item.devotee_name || t('dharmaLocal.devotee') })}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.answerRow}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={17}
              color={COLORS.maroon}
            />

            <Text style={styles.answerCount}>
              {t('dharmaLocal.count_answers', { count: answerCount })}
            </Text>
          </View>

          <Text
            style={[
              styles.answerStatus,
              answerCount >= 10 && styles.fullStatus,
            ]}
          >
            {answerCount === 0
              ? t('dharmaLocal.needs_answer')
              : t('dharmaLocal.view_answers')}
          </Text>

          <Ionicons
            name="chevron-forward"
            size={17}
            color={COLORS.gold}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // ========================================
  // UI
  // ========================================

  return (
    <SafeAreaView
  style={styles.safeArea}
  edges={['top', 'bottom', 'left', 'right']}
>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel={t('dharmaLocal.go_back')}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={COLORS.maroon}
          />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.headerEyebrow}>{t('dharmaLocal.devotee_community')}</Text>

          <Text style={styles.headerTitle}>{t('dharmaLocal.dharma_sandeham')}</Text>
        </View>

        <View style={styles.omCircle}>
          <Text style={styles.om}>ॐ</Text>
        </View>
      </View>

      <FlatList
        data={questions}
        extraData={language}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderQuestion}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.maroon]}
            tintColor={COLORS.maroon}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View>
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>{t('dharmaLocal.ask_learn_share_dharma')}</Text>

              <Text style={styles.introDescription}>{t('dharmaLocal.ask_questions_about_temple_traditions_pooja_and_spiritual_practices_up_to_10_different_devotees_can_answer_each_question')}</Text>
            </View>

            <View style={styles.searchBox}>
              <Ionicons
                name="search-outline"
                size={20}
                color={COLORS.muted}
              />

              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('dharmaLocal.search_questions')}
                placeholderTextColor={COLORS.muted}
                style={styles.searchInput}
                returnKeyType="search"
              />

              {search.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearch('')}
                  accessibilityLabel={t('dharmaLocal.clear_search')}
                >
                  <Ionicons
                    name="close-circle"
                    size={19}
                    color={COLORS.muted}
                  />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sectionLabel}>{t('dharmaLocal.categories')}</Text>

            <FlatList
              data={[
                { id: 0, name: t('dharmaLocal.all'), description: null },
                ...categories,
              ]}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.chipsRow}
              renderItem={({ item }) => {
                const selected =
                  categoryId ===
                  (item.id === 0 ? null : item.id);

                return (
                  <TouchableOpacity
                    onPress={() =>
                      setCategoryId(
                        item.id === 0 ? null : item.id
                      )
                    }
                    style={[
                      styles.chip,
                      selected && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={styles.statusRow}>
              {(
                [
                  'Latest',
                  'Unanswered',
                  'Answered',
                ] as const
              ).map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => setStatus(item)}
                  style={[
                    styles.statusButton,
                    status === item && styles.statusActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      status === item &&
                        styles.statusTextActive,
                    ]}
                  >
                    {t('dharmaLocal.' + item.toLowerCase())}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.listHeadingRow}>
              <Text style={styles.listHeading}>{t('dharmaLocal.community_questions')}</Text>

              <Text style={styles.questionCount}>
                {t('dharmaLocal.count_shown', { count: questions.length })}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator
                size="large"
                color={COLORS.maroon}
              />
              <Text style={styles.emptyDescription}>{t('dharmaLocal.loading_questions')}</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="cloud-offline-outline"
                size={36}
                color={COLORS.gold}
              />

              <Text style={styles.emptyTitle}>{t('dharmaLocal.unable_to_load_questions')}</Text>

              <Text style={styles.emptyDescription}>
                {error ? localizeDharmaError(error) : ""}
              </Text>

              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => loadQuestions(1)}
              >
                <Text style={styles.retryText}>{t('dharmaLocal.try_again')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="chatbubbles-outline"
                size={36}
                color={COLORS.gold}
              />

              <Text style={styles.emptyTitle}>{t('dharmaLocal.no_questions_found')}</Text>

              <Text style={styles.emptyDescription}>{t('dharmaLocal.try_a_different_search_or_category_or_be_the_first_to_ask_a_question')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              color={COLORS.maroon}
              style={{ marginVertical: 18 }}
            />
          ) : hasMore && !loading && !error ? (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={loadMore}
            >
              <Text style={styles.loadMoreText}>{t('dharmaLocal.load_more_questions')}</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.askButton}
          activeOpacity={0.85}
          onPress={() =>
            router.push('/dharma/ask' as any)
          }
        >
          <Ionicons
            name="add-circle-outline"
            size={21}
            color={COLORS.white}
          />

          <Text style={styles.askButtonText}>{t('dharmaLocal.ask_a_question')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.goldSoft,
    borderRadius: 12,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  headerEyebrow: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: COLORS.gold,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 22,
    color: COLORS.maroon,
    fontWeight: '800',
    marginTop: 2,
  },
  omCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  om: {
    fontSize: 23,
    color: COLORS.maroon,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 30,
    flexGrow: 1,
  },
  introCard: {
    backgroundColor: COLORS.maroon,
    borderRadius: 22,
    padding: 21,
    marginTop: 18,
    marginBottom: 18,
  },
  introTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  introDescription: {
    color: '#F7EBD7',
    fontSize: 13,
    lineHeight: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    paddingHorizontal: 13,
    height: 50,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '800',
    color: COLORS.gold,
    marginTop: 22,
    marginBottom: 11,
  },
  chipsRow: {
    paddingBottom: 6,
    gap: 9,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.maroon,
    borderColor: COLORS.maroon,
  },
  chipText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: COLORS.white,
  },
  statusRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.goldSoft,
    borderRadius: 15,
    padding: 4,
    marginTop: 18,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: COLORS.white,
  },
  statusText: {
    color: COLORS.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  statusTextActive: {
    color: COLORS.maroon,
  },
  listHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 23,
    marginBottom: 13,
  },
  listHeading: {
    color: COLORS.maroon,
    fontSize: 18,
    fontWeight: '800',
  },
  questionCount: {
    color: COLORS.muted,
    fontSize: 12,
  },
  questionCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 19,
    padding: 17,
    marginBottom: 13,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 11,
  },
  categoryLabel: {
    color: COLORS.maroon,
    backgroundColor: COLORS.goldSoft,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    fontSize: 11,
    fontWeight: '700',
  },
  date: {
    color: COLORS.muted,
    fontSize: 11,
  },
  questionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 8,
  },
  author: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 15,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 13,
    gap: 9,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  answerCount: {
    color: COLORS.maroon,
    fontSize: 12,
    fontWeight: '700',
  },
  answerStatus: {
    flex: 1,
    textAlign: 'right',
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  fullStatus: {
    color: COLORS.muted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 55,
    gap: 9,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.maroon,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: COLORS.maroon,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: 15,
    marginBottom: 10,
  },
  loadMoreText: {
    color: COLORS.maroon,
    fontWeight: '700',
  },
 bottomBar: {
  paddingHorizontal: 18,
  paddingTop: 12,
  paddingBottom: 12,
  borderTopWidth: 1,
  borderTopColor: COLORS.border,
  backgroundColor: COLORS.white,
  flexShrink: 0,
},
  askButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: COLORS.maroon,
    paddingVertical: 15,
    borderRadius: 16,
  },
  askButtonText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 15,
  },
});
