
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import { apiRequest } from '@/services/api';

// ========================================
// TYPES
// ========================================

type Publication = {
  id: number;
  category_id: number;
  category_name: string;
  title: string;
  description: string | null;
  image_url: string | null;
  author: string | null;
  publication_date: string | null;
  document_url: string | null;
  is_active: boolean;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

// ========================================
// HELPERS
// ========================================

function formatDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isValidDocumentUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' ||
      url.protocol === 'http:'
    );
  } catch {
    return false;
  }
}

// ========================================
// SCREEN
// ========================================

export default function PublicationDetailsScreen() {
  const { id, category_id } = useLocalSearchParams<{
    id: string;
    category_id?: string;
  }>();

  const [publication, setPublication] =
    useState<Publication | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [openingDocument, setOpeningDocument] = useState(false);

  // ========================================
  // LOAD PUBLICATION
  // ========================================

  const loadPublication = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) {
          setLoading(true);
        }

        setError('');
        setPublication(null);

        const publicationId = Number(id);
        const categoryId = Number(category_id);

        if (
          !Number.isSafeInteger(publicationId) ||
          publicationId <= 0
        ) {
          throw new Error('Invalid publication ID');
        }

        if (
          !Number.isSafeInteger(categoryId) ||
          categoryId <= 0
        ) {
          throw new Error('Invalid publication category');
        }

        // Existing public API supports filtering by category.
        const response = await apiRequest<
          ApiResponse<Publication[]>
        >(
          `/publications?category_id=${categoryId}`
        );

        if (!response.success) {
          throw new Error(
            response.message ||
            'Unable to load publication'
          );
        }

        const selected = (response.data || []).find(
          (item) => item.id === publicationId
        );

        if (!selected) {
          throw new Error(
            'This publication is unavailable or has been removed.'
          );
        }

        setPublication(selected);
      } catch (err) {
        console.error('Publication details error:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load publication details'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, category_id]
  );

  useFocusEffect(
    useCallback(() => {
      void loadPublication();
    }, [loadPublication])
  );

  // ========================================
  // REFRESH
  // ========================================

  const onRefresh = () => {
    setRefreshing(true);
    void loadPublication(false);
  };

  // ========================================
  // OPEN DOCUMENT
  // ========================================

  const openDocument = async () => {
    if (
      openingDocument ||
      !publication?.document_url
    ) {
      return;
    }

    const documentUrl = publication.document_url.trim();

    setDocumentError('');

    if (!isValidDocumentUrl(documentUrl)) {
      setDocumentError(
        'This publication does not have a valid document link.'
      );
      return;
    }

    setOpeningDocument(true);

    try {
      await Linking.openURL(documentUrl);
    } catch (err) {
      console.error('Open publication document:', err);

      setDocumentError(
        'Unable to open the document. Please try again.'
      );
    } finally {
      setOpeningDocument(false);
    }
  };

  // ========================================
  // UI
  // ========================================

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#B66A2C']}
          />
        }
      >
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>
            ‹ Back to Publications
          </Text>
        </TouchableOpacity>

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator
              size="large"
              color="#B66A2C"
            />

            <Text style={styles.message}>
              Loading publication details...
            </Text>
          </View>
        )}

        {!loading && !!error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void loadPublication()}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && publication && (
          <>
            <Text style={styles.smallTitle}>
              TEMPLE PUBLICATIONS
            </Text>

            <Text style={styles.category}>
              {publication.category_name}
            </Text>

            <View style={styles.coverContainer}>
              {publication.image_url ? (
                <Image
                  source={{
                    uri: publication.image_url,
                  }}
                  style={styles.coverImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Text style={styles.coverIcon}>
                    📖
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.title}>
              {publication.title}
            </Text>

            {!!publication.author && (
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>
                  Author
                </Text>

                <Text style={styles.metadataValue}>
                  {publication.author}
                </Text>
              </View>
            )}

            {!!formatDate(
              publication.publication_date
            ) && (
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>
                  Published
                </Text>

                <Text style={styles.metadataValue}>
                  {formatDate(
                    publication.publication_date
                  )}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>
              About This Publication
            </Text>

            <Text style={styles.description}>
              {publication.description?.trim() ||
                'No description is available for this publication.'}
            </Text>

            {!!publication.document_url && (
              <TouchableOpacity
                style={[
                  styles.documentButton,
                  openingDocument &&
                    styles.disabledButton,
                ]}
                activeOpacity={0.8}
                onPress={() => void openDocument()}
                disabled={openingDocument}
              >
                <Text style={styles.documentButtonText}>
                  {openingDocument
                    ? 'Opening Document...'
                    : '📄 Read / Open Document'}
                </Text>
              </TouchableOpacity>
            )}

            {!!documentError && (
              <Text style={styles.errorText}>
                {documentError}
              </Text>
            )}

            {!publication.document_url && (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeText}>
                  A digital document is not currently
                  available for this publication.
                </Text>
              </View>
            )}

            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>
                🙏
              </Text>

              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>
                  Spiritual Knowledge
                </Text>

                <Text style={styles.infoText}>
                  Explore devotional literature and
                  temple publications shared for
                  spiritual learning.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9F0',
  },

  content: {
    padding: 20,
    paddingBottom: 45,
  },

  backRow: {
    marginBottom: 22,
  },

  backText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B66A2C',
  },

  smallTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#B66A2C',
    marginBottom: 7,
  },

  category: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B66A2C',
    marginBottom: 16,
  },

  coverContainer: {
    height: 300,
    backgroundColor: '#F3DEC5',
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  coverImage: {
    width: '100%',
    height: '100%',
  },

  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  coverIcon: {
    fontSize: 75,
  },

  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#4A2C18',
    lineHeight: 34,
    marginBottom: 18,
  },

  metadataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  metadataLabel: {
    width: 85,
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },

  metadataValue: {
    flex: 1,
    fontSize: 12,
    color: '#4A2C18',
    fontWeight: '600',
  },

  divider: {
    height: 1,
    backgroundColor: '#E9D8C5',
    marginVertical: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 12,
  },

  description: {
    fontSize: 13,
    lineHeight: 23,
    color: '#62554C',
    marginBottom: 24,
  },

  documentButton: {
    backgroundColor: '#B66A2C',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  documentButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  disabledButton: {
    opacity: 0.6,
  },

  noticeCard: {
    padding: 16,
    backgroundColor: '#F3DEC5',
    borderRadius: 14,
    marginBottom: 18,
  },

  noticeText: {
    fontSize: 12,
    lineHeight: 19,
    color: '#6D5541',
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    elevation: 2,
  },

  infoIcon: {
    fontSize: 27,
    marginRight: 13,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 4,
  },

  infoText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#777',
  },

  centerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  message: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 19,
  },

  errorText: {
    fontSize: 12,
    color: '#B42318',
    textAlign: 'center',
    marginBottom: 15,
  },

  retryButton: {
    backgroundColor: '#B66A2C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },

  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
