
  import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
  } from 'react';

  import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
  } from 'react-native';

  import { SafeAreaView } from 'react-native-safe-area-context';

  import {
    router,
    useFocusEffect,
    useLocalSearchParams,
  } from 'expo-router';

  import { Ionicons } from '@expo/vector-icons';

  import ReportDialog from './ReportDialog';
  import { apiRequest } from '@/services/api';

  import {
    fetchDharmaQuestionById,
    submitDharmaAnswer,
    toggleDharmaHelpful,
    type DharmaAnswer,
    type DharmaQuestionDetails,
  } from '@/services/dharmaApi';

  // ========================================
  // COLORS
  // ========================================

  const COLORS = {
    background: '#FFFDF8',
    white: '#FFFFFF',
    maroon: '#6B1720',
    gold: '#C69A3A',
    cream: '#F7EBD7',
    text: '#30241F',
    muted: '#8E8175',
    border: '#E8DCCB',
    green: '#347C52',
  };

  const DEFAULT_MAX_ANSWERS = 10;

  // ========================================
  // HELPERS
  // ========================================

  function formatDate(value?: string) {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString('en-IN', {
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

  type ReportTarget =
    | { type: 'question'; id: number }
    | { type: 'answer'; id: number };

  // ========================================
  // QUESTION DETAILS SCREEN
  // ========================================

  export default function DharmaQuestionDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const questionId = Number(id);

    const [question, setQuestion] =
      useState<DharmaQuestionDetails | null>(null);
      const [currentUserId, setCurrentUserId] =
  useState<number | null>(null);

    const [answers, setAnswers] =
      useState<DharmaAnswer[]>([]);

    const [slotsUsed, setSlotsUsed] = useState(0);

    const [maxAnswers, setMaxAnswers] =
      useState(DEFAULT_MAX_ANSWERS);

    const [answerText, setAnswerText] = useState('');
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const scrollRef = useRef<ScrollView>(null);
    const answerSectionY = useRef(0);

    useEffect(() => {
      const show = Keyboard.addListener('keyboardDidShow', () => {
        setKeyboardVisible(true);
      });
      const hide = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardVisible(false);
      });
      return () => { show.remove(); hide.remove(); };
    }, []);

    const scrollToAnswer = () => {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, answerSectionY.current - 15),
          animated: true,
        });
      }, 300);
    };

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [error, setError] =
      useState<string | null>(null);

    const [votingIds, setVotingIds] =
      useState<number[]>([]);

    const [votedIds, setVotedIds] =
      useState<number[]>([]);

    // ========================================
    // REPORT STATE
    // ========================================

    const [reportTarget, setReportTarget] =
      useState<ReportTarget | null>(null);

    const openQuestionReport = () => {
      if (
        !Number.isSafeInteger(questionId) ||
        questionId <= 0
      ) {
        return;
      }

      setReportTarget({
        type: 'question',
        id: questionId,
      });
    };

    const openAnswerReport = (answerId: number) => {
      setReportTarget({
        type: 'answer',
        id: answerId,
      });
    };

    const closeReport = () => {
      setReportTarget(null);
    };

    // ========================================
    // REFS
    // ========================================

    const submittingRef = useRef(false);
    const votingRef = useRef<Set<number>>(new Set());
    const requestRef = useRef(0);

    // ========================================
    // ANSWER COUNTS
    // ========================================

    const remaining = Math.max(
      0,
      maxAnswers - slotsUsed
    );

    const isFull = remaining === 0;

    const officialAnswers = answers.filter(
      (item) => item.answer_type === 'official'
    );

    const communityAnswers = answers.filter(
      (item) => item.answer_type === 'community'
    );

    // ========================================
    // LOAD QUESTION
    // ========================================

    const loadQuestion = useCallback(
      async (isRefresh = false) => {
        const requestId = ++requestRef.current;

        if (
          !Number.isSafeInteger(questionId) ||
          questionId <= 0
        ) {
          setQuestion(null);
          setAnswers([]);
          setError('Invalid question ID.');
          setLoading(false);
          setRefreshing(false);
          return;
        }

        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        try {
          const response =
            await fetchDharmaQuestionById(questionId);

          if (requestId !== requestRef.current) {
            return;
          }

          if (!response.success || !response.question) {
            throw new Error('Question not found.');
          }
try {
  const profile = await apiRequest<{
    success: boolean;
    data?: { id: number };
    user?: { id: number };
  }>('/auth/me');

  if (requestId !== requestRef.current) {
    return;
  }

  const loggedInUser = profile.data ?? profile.user;

  const userId =
    profile.success && loggedInUser
      ? Number(loggedInUser.id)
      : null;

  setCurrentUserId(
    userId !== null &&
    Number.isSafeInteger(userId) &&
    userId > 0
      ? userId
      : null
  );
} catch (error) {
  console.error('Unable to load logged-in user:', error);

  if (requestId !== requestRef.current) {
    return;
  }

  setCurrentUserId(null);
}
          setQuestion(response.question);

const loadedAnswers = response.answers ?? [];

setAnswers(loadedAnswers);

// Restore the logged-in devotee's liked answers
setVotedIds(
  loadedAnswers
    .filter((answer) => answer.is_liked === true)
    .map((answer) => answer.id)
);

          setSlotsUsed(
            Math.max(
              0,
              Number(
                response.communityAnswerSlotsUsed ?? 0
              )
            )
          );

          setMaxAnswers(
            Math.max(
              1,
              Number(
                response.maxCommunityAnswers ??
                DEFAULT_MAX_ANSWERS
              )
            )
          );
        } catch (err) {
          if (requestId !== requestRef.current) {
            return;
          }

          console.error(
            'Load Dharma question error:',
            err
          );

          setError(getErrorMessage(err));

          if (!isRefresh) {
            setQuestion(null);
            setAnswers([]);
          }
        } finally {
          if (requestId === requestRef.current) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      },
      [questionId]
    );

    useFocusEffect(
      useCallback(() => {
        loadQuestion();

        return () => {
          requestRef.current += 1;
        };
      }, [loadQuestion])
    );

    // ========================================
    // SUBMIT ANSWER
    // ========================================

    const handleSubmitAnswer = async () => {
      Keyboard.dismiss();
      if (submittingRef.current || !question) {
        return;
      }

      if (isFull) {
        Alert.alert(
          'Answers Full',
          'This question has reached the maximum number of community answer submissions.'
        );
        return;
      }

      const text = answerText.trim();

      if (text.length < 10) {
        Alert.alert(
          'Invalid Answer',
          'Please enter at least 10 characters.'
        );
        return;
      }

      if (text.length > 2000) {
        Alert.alert(
          'Answer Too Long',
          'Your answer must not exceed 2000 characters.'
        );
        return;
      }

      submittingRef.current = true;
      setSubmitting(true);

      try {
        const response = await submitDharmaAnswer(
          questionId,
          text
        ) as {
          success: boolean;
          message?: string;
        };

        if (!response.success) {
          throw new Error(
            response.message ||
            'Unable to submit answer.'
          );
        }

        setAnswerText('');

        await loadQuestion(true);

        Alert.alert(
          'Answer Submitted',
          'Your answer has been submitted for temple admin review. It will appear publicly after approval.'
        );
      } catch (err) {
        Alert.alert(
          'Submission Failed',
          getErrorMessage(err)
        );
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    };

    // ========================================
    // HELPFUL VOTES
    // ========================================

    const handleHelpful = async (answerId: number) => {
      if (votingRef.current.has(answerId)) {
        return;
      }

      votingRef.current.add(answerId);

      setVotingIds((previous) => [
        ...previous,
        answerId,
      ]);

      try {
        const response =
          await toggleDharmaHelpful(answerId) as {
            success: boolean;
            helpfulCount?: number;
            helpful_count?: number;
            voted?: boolean;
            isHelpful?: boolean;
            message?: string;
          };

        if (!response.success) {
          throw new Error(
            response.message ||
            'Unable to update helpful vote.'
          );
        }

        const count =
          response.helpfulCount ??
          response.helpful_count;

        if (typeof count === 'number') {
          setAnswers((previous) =>
            previous.map((answer) =>
              answer.id === answerId
                ? {
                    ...answer,
                    helpful_count: count,
                  }
                : answer
            )
          );
        } else {
          await loadQuestion(true);
        }

        const voted =
          response.voted ?? response.isHelpful;

        if (typeof voted === 'boolean') {
          setVotedIds((previous) =>
            voted
              ? [
                  ...previous.filter(
                    (id) => id !== answerId
                  ),
                  answerId,
                ]
              : previous.filter(
                  (id) => id !== answerId
                )
          );
        }
      } catch (err) {
        Alert.alert(
          'Unable to Vote',
          getErrorMessage(err)
        );
      } finally {
        votingRef.current.delete(answerId);

        setVotingIds((previous) =>
          previous.filter((id) => id !== answerId)
        );
      }
    };

    // PART 2 CONTINUES HERE

    // ========================================
    // RENDER ANSWER CARD
    // ========================================

    const renderAnswer = (
      item: DharmaAnswer,
      index: number
    ) => {
      const official =
        item.answer_type === 'official';

      const voted = votedIds.includes(item.id);
      const voting = votingIds.includes(item.id);

      return (
        <View
          key={item.id}
          style={[
            styles.answerCard,
            official && styles.officialCard,
          ]}
        >
          {/* ANSWER AUTHOR */}

          <View style={styles.answerTopRow}>
            <View style={styles.avatar}>
              <Ionicons
                name={
                  official
                    ? 'shield-checkmark'
                    : 'person'
                }
                size={20}
                color={
                  official
                    ? COLORS.green
                    : COLORS.maroon
                }
              />
            </View>

            <View style={styles.answerAuthorInfo}>
              <Text style={styles.answerAuthor}>
                {official
                  ? 'Temple Administration'
                  : item.devotee_name || 'Devotee'}
              </Text>

              <Text style={styles.answerDate}>
                {formatDate(item.created_at)}
              </Text>
            </View>

            {!official && (
              <View style={styles.answerNumber}>
                <Text style={styles.answerNumberText}>
                  #{index + 1}
                </Text>
              </View>
            )}
          </View>

          {/* OFFICIAL VERIFICATION */}

          {official && (
            <View style={styles.verifiedRow}>
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={COLORS.green}
              />

              <Text style={styles.verifiedText}>
                Official Temple Answer — Verified
              </Text>
            </View>
          )}

          {/* ANSWER CONTENT */}

          <Text style={styles.answerBody}>
            {item.answer}
          </Text>

          {/* HELPFUL VOTE */}

          <TouchableOpacity
            style={styles.helpfulButton}
            onPress={() => handleHelpful(item.id)}
            disabled={voting}
            accessibilityLabel="Mark answer as helpful"
          >
            {voting ? (
              <ActivityIndicator
                size="small"
                color={COLORS.maroon}
              />
            ) : (
              <Ionicons
                name={
                  voted
                    ? 'thumbs-up'
                    : 'thumbs-up-outline'
                }
                size={17}
                color={
                  voted
                    ? COLORS.maroon
                    : COLORS.muted
                }
              />
            )}

            <Text
              style={[
                styles.helpfulText,
                voted && {
                  color: COLORS.maroon,
                },
              ]}
            >
              Helpful (
              {Number(item.helpful_count ?? 0)})
            </Text>
          </TouchableOpacity>

          {/* REPORT ANSWER */}

          <TouchableOpacity
            style={styles.reportAnswerButton}
            onPress={() => openAnswerReport(item.id)}
            accessibilityLabel="Report answer"
          >
            <Ionicons
              name="flag-outline"
              size={15}
              color={COLORS.muted}
            />

            <Text style={styles.reportButtonText}>
              Report Answer
            </Text>
          </TouchableOpacity>
        </View>
      );
    };

    // ========================================
    // MAIN SCREEN UI
    // ========================================

    return (
      <SafeAreaView style={styles.container}>

        {/* HEADER */}

        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <Ionicons
              name="arrow-back"
              size={23}
              color={COLORS.maroon}
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Dharma Sandeham
          </Text>

          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
          keyboardVerticalOffset={0}
        >

          {/* LOADING */}

          {loading && !question ? (
            <View style={styles.centerState}>
              <ActivityIndicator
                size="large"
                color={COLORS.maroon}
              />

              <Text style={styles.stateText}>
                Loading question...
              </Text>
            </View>

          ) : error && !question ? (

            /* ERROR STATE */

            <View style={styles.centerState}>
              <Ionicons
                name="alert-circle-outline"
                size={38}
                color={COLORS.gold}
              />

              <Text style={styles.stateText}>
                {error}
              </Text>

              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => loadQuestion()}
              >
                <Text style={styles.retryText}>
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>

          ) : (

            /* MAIN CONTENT */

            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: keyboardVisible ? 180 : 80 },
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() =>
                    loadQuestion(true)
                  }
                  colors={[COLORS.maroon]}
                  tintColor={COLORS.maroon}
                />
              }
            >

              {question && (
                <>

                  {/* QUESTION CARD */}

                  <View style={styles.questionCard}>

                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>
                        {question.category_name ||
                          'General Questions'}
                      </Text>
                    </View>

                    <Text style={styles.questionTitle}>
                      {question.title}
                    </Text>

                    {!!question.description && (
                      <Text
                        style={styles.questionDescription}
                      >
                        {question.description}
                      </Text>
                    )}

                    {/* REPORT QUESTION BUTTON */}

                    <TouchableOpacity
                      style={styles.reportQuestionButton}
                      onPress={openQuestionReport}
                      accessibilityLabel="Report question"
                    >
                      <Ionicons
                        name="flag-outline"
                        size={16}
                        color={COLORS.muted}
                      />

                      <Text style={styles.reportButtonText}>
                        Report Question
                      </Text>
                    </TouchableOpacity>

                    {/* QUESTION AUTHOR */}

                    <View style={styles.authorRow}>
                      <Ionicons
                        name="person-circle-outline"
                        size={22}
                        color={COLORS.gold}
                      />

                      <Text style={styles.authorText}>
                        Asked by{' '}
                        {question.devotee_name ||
                          'Devotee'}
                      </Text>

                      <Text style={styles.dateText}>
                        {formatDate(question.created_at)}
                      </Text>
                    </View>
                  </View>

                  {/* OFFICIAL TEMPLE ANSWERS */}

                  {officialAnswers.length > 0 && (
                    <View style={styles.officialSection}>

                      <Text style={styles.sectionTitle}>
                        Official Temple Guidance
                      </Text>

                      <Text style={styles.sectionSubtitle}>
                        Verified answers from temple
                        administration
                      </Text>

                      <View style={{ marginTop: 16 }}>
                        {officialAnswers.map(
                          (item, index) =>
                            renderAnswer(item, index)
                        )}
                      </View>
                    </View>
                  )}

                  {/* COMMUNITY ANSWERS HEADER */}

                  <View style={styles.answersHeader}>
                    <View>
                      <Text style={styles.sectionTitle}>
                        Community Answers
                      </Text>

                      <Text style={styles.sectionSubtitle}>
                        Shared by fellow devotees
                      </Text>
                    </View>

                    <View style={styles.answerCountBadge}>
                      <Text style={styles.answerCountText}>
                        {slotsUsed}/{maxAnswers}
                      </Text>
                    </View>
                  </View>

                  {/* ANSWER PROGRESS */}

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${
                            Math.min(
                              100,
                              (slotsUsed / maxAnswers) *
                                100
                            )
                          }%`,
                        },
                      ]}
                    />
                  </View>

                  <Text style={styles.remainingText}>
                    {isFull
                      ? 'All community answer submission slots are occupied.'
                      : `${remaining} community answer submission slots remain.`}
                  </Text>

                  {/* COMMUNITY ANSWER CARDS */}

                  {communityAnswers.length === 0 ? (
                    <View style={styles.noAnswers}>
                      <Ionicons
                        name="chatbubble-outline"
                        size={29}
                        color={COLORS.gold}
                      />

                      <Text style={styles.noAnswersText}>
                        No approved community answers yet.
                      </Text>

                      <Text style={styles.sectionSubtitle}>
                        Be the first to share your
                        knowledge.
                      </Text>
                    </View>
                  ) : (
                    communityAnswers.map(
                      (item, index) =>
                        renderAnswer(item, index)
                    )
                  )}

                  {/* PART 3 CONTINUES HERE */}

                  {/* ========================================
                      SHARE YOUR ANSWER
                  ======================================== */}

                 {currentUserId !== null &&
  Number(question.user_id) !== currentUserId && (
    <View
      style={styles.submitSection}
      onLayout={(event) => {
        answerSectionY.current = event.nativeEvent.layout.y;
      }}
    >
                    <Text style={styles.sectionTitle}>
                      Share Your Answer
                    </Text>

                    <Text style={styles.sectionSubtitle}>
                      Help another devotee by sharing
                      your knowledge.
                    </Text>

                    {isFull ? (
                      <View style={styles.fullNotice}>
                        <Ionicons
                          name="lock-closed-outline"
                          size={20}
                          color={COLORS.maroon}
                        />

                        <Text style={styles.fullNoticeText}>
                          This question has reached the
                          maximum of {maxAnswers} community
                          answer submissions.
                        </Text>
                      </View>
                    ) : (
                      <>
                        <TextInput
                          style={styles.answerInput}
                          onFocus={scrollToAnswer}
                          scrollEnabled
                          multiline
                          textAlignVertical="top"
                          placeholder="Write your answer here..."
                          placeholderTextColor={COLORS.muted}
                          value={answerText}
                          onChangeText={setAnswerText}
                          maxLength={2000}
                          editable={!submitting}
                        />

                        {keyboardVisible && (
                          <TouchableOpacity
                            style={styles.doneTypingButton}
                            onPress={() => Keyboard.dismiss()}
                            activeOpacity={0.85}
                          >
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={19}
                              color={COLORS.white}
                            />
                            <Text style={styles.doneTypingText}>
                              Done Typing
                            </Text>
                          </TouchableOpacity>
                        )}

                        <Text style={styles.characterCount}>
                          {answerText.length}/2000
                        </Text>

                        <TouchableOpacity
                          style={[
                            styles.submitButton,
                            submitting &&
                              styles.disabledButton,
                          ]}
                          onPress={handleSubmitAnswer}
                          disabled={submitting}
                          activeOpacity={0.85}
                        >
                          {submitting ? (
                            <ActivityIndicator
                              color={COLORS.white}
                            />
                          ) : (
                            <Ionicons
                              name="send-outline"
                              size={19}
                              color={COLORS.white}
                            />
                          )}

                          <Text
                            style={styles.submitButtonText}
                          >
                            {submitting
                              ? 'Submitting...'
                              : 'Submit Answer'}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                   )}

                  {/* ========================================
                      DISCLAIMER
                  ======================================== */}

                  <View style={styles.disclaimer}>
                    <Ionicons
                      name="information-circle-outline"
                      size={19}
                      color={COLORS.maroon}
                    />

                    <Text style={styles.disclaimerText}>
                      Community answers represent
                      individual devotees' knowledge.
                      For official temple procedures,
                      please follow temple authority
                      guidance. All community answers
                      require admin approval.
                    </Text>
                  </View>

                </>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>

        {/* ========================================
            REPORT DIALOG
        ======================================== */}

        <ReportDialog
          visible={reportTarget !== null}
          target={reportTarget}
          onClose={closeReport}
        />

      </SafeAreaView>
    );
  }

  // ========================================
  // COMPLETE STYLES
  // ========================================

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },

    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },

    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: COLORS.maroon,
    },

    content: {
      padding: 18,
      paddingBottom: 60,
    },

    questionCard: {
      backgroundColor: COLORS.white,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 20,
      marginBottom: 25,
    },

    categoryBadge: {
      alignSelf: 'flex-start',
      backgroundColor: COLORS.cream,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
      marginBottom: 15,
    },

    categoryText: {
      fontSize: 11,
      fontWeight: '700',
      color: COLORS.maroon,
    },

    questionTitle: {
      fontSize: 21,
      lineHeight: 31,
      fontWeight: '800',
      color: COLORS.text,
      marginBottom: 12,
    },

    questionDescription: {
      fontSize: 14,
      lineHeight: 23,
      color: COLORS.muted,
      marginBottom: 20,
    },

    // ========================================
    // REPORT QUESTION BUTTON
    // ========================================

    reportQuestionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 7,
      marginBottom: 15,
      paddingVertical: 7,
    },

    reportButtonText: {
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: '600',
    },

    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingTop: 14,
    },

    authorText: {
      flex: 1,
      fontSize: 12,
      color: COLORS.text,
      fontWeight: '600',
    },

    dateText: {
      fontSize: 11,
      color: COLORS.muted,
    },

    // ========================================
    // SECTION HEADINGS
    // ========================================

    answersHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 15,
    },

    sectionTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: COLORS.maroon,
    },

    sectionSubtitle: {
      fontSize: 12,
      color: COLORS.muted,
      marginTop: 5,
    },

    answerCountBadge: {
      backgroundColor: COLORS.cream,
      borderRadius: 15,
      paddingHorizontal: 15,
      paddingVertical: 9,
    },

    answerCountText: {
      color: COLORS.maroon,
      fontWeight: '800',
      fontSize: 14,
    },

    progressTrack: {
      height: 8,
      backgroundColor: '#EDE4D8',
      borderRadius: 10,
      overflow: 'hidden',
    },

    progressFill: {
      height: '100%',
      backgroundColor: COLORS.gold,
      borderRadius: 10,
    },

    remainingText: {
      fontSize: 12,
      color: COLORS.muted,
      marginTop: 9,
      marginBottom: 20,
    },

    // ========================================
    // ANSWER CARDS
    // ========================================

    answerCard: {
      backgroundColor: COLORS.white,
      borderRadius: 18,
      padding: 18,
      marginBottom: 13,
      borderWidth: 1,
      borderColor: COLORS.border,
    },

    officialCard: {
      borderColor: COLORS.green,
      borderWidth: 1.5,
    },

    officialSection: {
      marginBottom: 25,
    },

    answerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
    },

    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: COLORS.cream,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },

    answerAuthorInfo: {
      flex: 1,
    },

    answerAuthor: {
      fontSize: 14,
      fontWeight: '800',
      color: COLORS.text,
    },

    answerDate: {
      fontSize: 11,
      color: COLORS.muted,
      marginTop: 4,
    },

    answerNumber: {
      backgroundColor: COLORS.cream,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },

    answerNumberText: {
      color: COLORS.maroon,
      fontSize: 12,
      fontWeight: '800',
    },

    answerBody: {
      fontSize: 14,
      lineHeight: 23,
      color: COLORS.text,
      marginBottom: 15,
    },

    verifiedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12,
    },

    verifiedText: {
      fontSize: 12,
      color: COLORS.green,
      fontWeight: '700',
    },

    // ========================================
    // HELPFUL VOTES
    // ========================================

    helpfulButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingTop: 13,
    },

    helpfulText: {
      fontSize: 12,
      color: COLORS.muted,
      fontWeight: '600',
    },

    // ========================================
    // REPORT ANSWER BUTTON
    // ========================================

    reportAnswerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 7,
      marginTop: 12,
      paddingVertical: 5,
    },

    // ========================================
    // ANSWER SUBMISSION
    // ========================================

    submitSection: {
      marginTop: 20,
      marginBottom: 25,
    },

    answerInput: {
      backgroundColor: COLORS.white,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 15,
      height: 150,
      padding: 15,
      marginTop: 18,
      color: COLORS.text,
      fontSize: 14,
    },

    characterCount: {
      textAlign: 'right',
      color: COLORS.muted,
      fontSize: 11,
      marginTop: 7,
      marginBottom: 15,
    },

    doneTypingButton: {
      backgroundColor: COLORS.gold,
      borderRadius: 12,
      paddingVertical: 12,
      marginTop: 12,


      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    doneTypingText: {
      color: COLORS.white,
      fontSize: 14,
      fontWeight: '700',
    },



    submitButton: {
      backgroundColor: COLORS.maroon,
      borderRadius: 15,
      paddingVertical: 17,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },

    disabledButton: {
      opacity: 0.6,
    },

    submitButtonText: {
      color: COLORS.white,
      fontWeight: '800',
      fontSize: 15,
    },

    fullNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: COLORS.cream,
      padding: 17,
      borderRadius: 15,
      marginTop: 18,
    },

    fullNoticeText: {
      flex: 1,
      color: COLORS.maroon,
      fontSize: 13,
      lineHeight: 21,
    },

    // ========================================
    // DISCLAIMER
    // ========================================

    disclaimer: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: COLORS.cream,
      borderRadius: 14,
      padding: 15,
    },

    disclaimerText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 19,
      color: COLORS.maroon,
    },

    // ========================================
    // LOADING / ERROR STATES
    // ========================================

    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 25,
      gap: 14,
    },

    stateText: {
      color: COLORS.muted,
      fontSize: 14,
      textAlign: 'center',
    },

    retryButton: {
      backgroundColor: COLORS.maroon,
      borderRadius: 12,
      paddingHorizontal: 22,
      paddingVertical: 12,
    },

    retryText: {
      color: COLORS.white,
      fontWeight: '700',
    },

    // ========================================
    // EMPTY ANSWERS
    // ========================================

    noAnswers: {
      alignItems: 'center',
      padding: 24,
      marginBottom: 15,
      gap: 7,
      backgroundColor: COLORS.white,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },

    noAnswersText: {
      color: COLORS.maroon,
      fontWeight: '700',
      fontSize: 13,
      textAlign: 'center',
    },
  });
