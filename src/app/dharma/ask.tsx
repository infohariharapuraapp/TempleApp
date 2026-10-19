
import React, {
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  fetchDharmaCategories,
  submitDharmaQuestion,
  type DharmaCategory,
} from '@/services/dharmaApi';

// ========================================
// COLORS
// ========================================

const COLORS = {
  background: '#FFFDF8',
  maroon: '#6B1720',
  gold: '#C69A3A',
  cream: '#F7EBD7',
  white: '#FFFFFF',
  text: '#30241F',
  muted: '#8E8175',
  border: '#E8DCCB',
};

// ========================================
// HELPERS
// ========================================

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

// ========================================
// ASK QUESTION SCREEN
// ========================================

export default function AskQuestionScreen() {
  const [categories, setCategories] =
    useState<DharmaCategory[]>([]);

  const [categoryId, setCategoryId] =
    useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [loadingCategories, setLoadingCategories] =
    useState(true);

  const [categoryError, setCategoryError] =
    useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const submittingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const descriptionRef = useRef<TextInput>(null);

  const [keyboardVisible, setKeyboardVisible] =
    useState(false);

  // ========================================
  // KEYBOARD LISTENERS
  // ========================================

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );

    const hideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // ========================================
  // SCROLL TO INPUT
  // ========================================

  const scrollToInput = (position: number) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: position,
        animated: true,
      });
    }, 300);
  };

  // ========================================
  // LOAD CATEGORIES FROM BACKEND
  // ========================================

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      setLoadingCategories(true);
      setCategoryError(null);

      try {
        const response = await fetchDharmaCategories();

        if (!response.success) {
          throw new Error('Unable to load categories.');
        }

        const received = response.categories ?? [];

        if (!active) return;

        setCategories(received);

        setCategoryId((previous) => {
          if (
            previous !== null &&
            received.some((item) => item.id === previous)
          ) {
            return previous;
          }

          return received.length > 0
            ? received[0].id
            : null;
        });
      } catch (error) {
        console.error(
          'Dharma categories error:',
          error
        );

        if (active) {
          setCategoryError(getErrorMessage(error));
        }
      } finally {
        if (active) {
          setLoadingCategories(false);
        }
      }
    };

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  // ========================================
  // SUBMIT QUESTION
  // ========================================

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }

    Keyboard.dismiss();

    const question = title.trim();
    const details = description.trim();

    if (categoryId === null) {
      Alert.alert(
        'Select Category',
        'Please select a question category.'
      );
      return;
    }

    if (question.length < 10) {
      Alert.alert(
        'Invalid Question',
        'Please enter a question with at least 10 characters.'
      );
      return;
    }

    if (question.length > 200) {
      Alert.alert(
        'Question Too Long',
        'The question must not exceed 200 characters.'
      );
      return;
    }

    if (details.length > 2000) {
      Alert.alert(
        'Description Too Long',
        'The description must not exceed 2000 characters.'
      );
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const response = await submitDharmaQuestion({
        category_id: categoryId,
        title: question,
        description: details,
      }) as {
        success: boolean;
        message?: string;
      };

      if (!response.success) {
        throw new Error(
          response.message || 'Unable to submit question.'
        );
      }

      Alert.alert(
        'Question Submitted',
        'Your question has been submitted successfully and is awaiting temple admin approval. It will become visible to devotees after approval.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error(
        'Submit Dharma question error:',
        error
      );

      Alert.alert(
        'Submission Failed',
        getErrorMessage(error)
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // ========================================
  // UI
  // ========================================

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Keyboard.dismiss();
            router.back();
          }}
          style={styles.backButton}
          accessibilityLabel="Go back"
          disabled={submitting}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color={COLORS.maroon}
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Ask a Question
        </Text>

        <View style={{ width: 40 }} />
      </View>

      {/* KEYBOARD RESPONSIVE FORM */}

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={
            Platform.OS === 'ios'
          }
          contentContainerStyle={styles.content}
        >
          {/* INTRO */}

          <View style={styles.introCard}>
            <Text style={styles.introSymbol}>
              ॐ
            </Text>

            <Text style={styles.introTitle}>
              Dharma Sandeham
            </Text>

            <Text style={styles.introDescription}>
              Have a question about temple traditions,
              pooja rituals, or spiritual practices?
              Ask fellow devotees and share knowledge.
            </Text>
          </View>

          {/* CATEGORY SELECTION */}

          <Text style={styles.label}>
            Select Category *
          </Text>

          {loadingCategories ? (
            <View style={styles.categoryLoading}>
              <ActivityIndicator
                color={COLORS.maroon}
              />

              <Text style={styles.loadingText}>
                Loading categories...
              </Text>
            </View>
          ) : categoryError ? (
            <View style={styles.categoryMessage}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={COLORS.maroon}
              />

              <Text style={styles.categoryMessageText}>
                {categoryError}
              </Text>
            </View>
          ) : categories.length === 0 ? (
            <View style={styles.categoryMessage}>
              <Text style={styles.categoryMessageText}>
                No question categories are currently available.
              </Text>
            </View>
          ) : (
            <View style={styles.categories}>
              {categories.map((item) => {
                const selected =
                  categoryId === item.id;

                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() =>
                      setCategoryId(item.id)
                    }
                    disabled={submitting}
                    style={[
                      styles.categoryChip,
                      selected && styles.selectedChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        selected &&
                          styles.selectedChipText,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* QUESTION TITLE */}

          <Text style={styles.label}>
            Your Question *
          </Text>

          <TextInput
            style={styles.questionInput}
            placeholder="Example: How many pradakshinas should we perform?"
            placeholderTextColor={COLORS.muted}
            value={title}
            onChangeText={setTitle}
            onFocus={() => scrollToInput(220)}
            maxLength={200}
            editable={!submitting}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              descriptionRef.current?.focus();
            }}
          />

          <Text style={styles.counter}>
            {title.length}/200
          </Text>

          {/* QUESTION DESCRIPTION */}

          <Text style={styles.label}>
            Additional Details (Optional)
          </Text>

          <TextInput
            ref={descriptionRef}
            style={styles.descriptionInput}
            placeholder="Explain your doubt in more detail..."
            placeholderTextColor={COLORS.muted}
            value={description}
            onChangeText={setDescription}
            onFocus={() => scrollToInput(420)}
            multiline
            textAlignVertical="top"
            maxLength={2000}
            editable={!submitting}
            scrollEnabled
          />

          <Text style={styles.counter}>
            {description.length}/2000
          </Text>

          {/* DONE TYPING */}

          {keyboardVisible && (
            <TouchableOpacity
              style={styles.keyboardDoneButton}
              onPress={() => Keyboard.dismiss()}
              activeOpacity={0.8}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={19}
                color={COLORS.maroon}
              />

              <Text style={styles.keyboardDoneText}>
                Done Typing
              </Text>
            </TouchableOpacity>
          )}

          {/* INFORMATION */}

          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={COLORS.maroon}
            />

            <Text style={styles.infoText}>
              Each question can receive answers from up to
              10 different devotees. Questions and answers
              are reviewed by temple administrators before
              becoming publicly visible.
            </Text>
          </View>

          {/* SUBMIT BUTTON */}

          <TouchableOpacity
            style={[
              styles.submitButton,
              (
                submitting ||
                loadingCategories ||
                categoryId === null
              ) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={
              submitting ||
              loadingCategories ||
              categoryId === null
            }
          >
            {submitting ? (
              <>
                <ActivityIndicator
                  color={COLORS.white}
                />

                <Text style={styles.submitText}>
                  Submitting...
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="send-outline"
                  size={19}
                  color={COLORS.white}
                />

                <Text style={styles.submitText}>
                  Submit Question
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            Please ask respectful, temple-related questions.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ========================================
// STYLES
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
    backgroundColor: COLORS.background,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.maroon,
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 80,
    flexGrow: 1,
  },

  introCard: {
    backgroundColor: COLORS.maroon,
    borderRadius: 22,
    padding: 25,
    alignItems: 'center',
    marginBottom: 28,
  },

  introSymbol: {
    fontSize: 42,
    color: COLORS.gold,
    marginBottom: 10,
  },

  introTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
  },

  introDescription: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORS.cream,
    textAlign: 'center',
    marginTop: 12,
  },

  label: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },

  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 25,
  },

  categoryChip: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  selectedChip: {
    backgroundColor: COLORS.maroon,
    borderColor: COLORS.maroon,
  },

  categoryText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },

  selectedChipText: {
    color: COLORS.white,
  },

  questionInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 15,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 55,
  },

  descriptionInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 15,
    minHeight: 145,
    maxHeight: 240,
    fontSize: 14,
    color: COLORS.text,
  },

  counter: {
    textAlign: 'right',
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 6,
    marginBottom: 20,
  },

  keyboardDoneButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    marginBottom: 15,
  },

  keyboardDoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.maroon,
  },

  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.cream,
    padding: 15,
    borderRadius: 14,
    marginTop: 5,
    marginBottom: 25,
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.maroon,
  },

  submitButton: {
    backgroundColor: COLORS.maroon,
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 55,
  },

  submitButtonDisabled: {
    opacity: 0.55,
  },

  submitText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },

  footerNote: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 18,
  },

  categoryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 25,
    paddingVertical: 12,
  },

  loadingText: {
    fontSize: 12,
    color: COLORS.muted,
  },

  categoryMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 13,
    borderRadius: 12,
    backgroundColor: COLORS.cream,
    marginBottom: 25,
  },

  categoryMessageText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.maroon,
  },
});
