import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';
import {
  router,
} from 'expo-router';
import {
  useTranslation,
} from 'react-i18next';
import {
  apiRequest,
} from '@/services/api';
// ========================================
// TYPES
// ========================================

type Deity = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;

  // Deity group support
  deity_type: 'individual' | 'group';
  parent_deity_id: number | null;
  display_order: number;

  // Additional deity information
  significance?: string | null;
  devotional?: string | null;
};

// ========================================
// DEITIES SCREEN
// ========================================
export default function DeitiesScreen() {
  const { t } = useTranslation();
  const [deities, setDeities] =
    useState<Deity[]>([]);
  const [search, setSearch] =
    useState('');
  const [loading, setLoading] =
    useState(true);
  // ========================================
  // LOAD DEITIES
  // ========================================
  useEffect(() => {
    loadDeities();
  }, []);
  const loadDeities = async () => {
    try {
      setLoading(true);
      const response =
        await apiRequest('/deities');
      if (
        response.success &&
        Array.isArray(response.data)
      ) {
        setDeities(response.data);
      }
    } catch (error) {
      console.error(
        'Deities loading error:',
        error
      );
    } finally {
      setLoading(false);
    }
  };
  // ========================================
  // FILTER DEITIES
  // ========================================
  const filteredDeities = useMemo(() => {
    const query =
      search.trim().toLowerCase();
    if (!query) {
      return deities;
    }
    return deities.filter((deity) =>
      deity.name
        .toLowerCase()
        .includes(query)
    );
  }, [search, deities]);
  // ========================================
  // SCREEN
  // ========================================
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ================================= */}
        {/* HEADER                            */}
        {/* ================================= */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.smallText}>
              {t('deities.blessings')}
            </Text>
            <Text style={styles.title}>
              {t('deities.title')}
            </Text>
            <Text style={styles.subtitle}>
              {t('deities.subtitle')}
            </Text>
          </View>
          <View style={styles.omContainer}>
            <Text style={styles.om}>
              ॐ
            </Text>
          </View>
        </View>
        {/* ================================= */}
        {/* INTRODUCTION BANNER               */}
        {/* ================================= */}
        <View style={styles.banner}>
          <Text style={styles.bannerOm}>
            ॐ
          </Text>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>
              {t('deities.bannerTitle')}
            </Text>
            <Text style={styles.bannerText}>
              {t('deities.bannerText')}
            </Text>
          </View>
        </View>
        {/* ================================= */}
        {/* SEARCH                            */}
        {/* ================================= */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>
            🔍
          </Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t(
              'deities.searchPlaceholder'
            )}
            placeholderTextColor="#999"
            style={styles.searchInput}
          />
        </View>
        {/* ================================= */}
        {/* SECTION HEADER                    */}
        {/* ================================= */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('deities.sectionTitle')}
          </Text>
          <Text style={styles.countText}>
            {filteredDeities.length}
          </Text>
        </View>
        {/* ================================= */}
        {/* DEITIES CONTENT                   */}
        {/* ================================= */}
        {loading ? (
          // ==================================
          // LOADING STATE
          // ==================================
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>
              🙏
            </Text>
            <Text style={styles.emptyTitle}>
              {t('deities.loading')}
            </Text>
            <Text style={styles.emptyText}>
              {t('deities.loadingDescription')}
            </Text>
          </View>
        ) : filteredDeities.length > 0 ? (
          // ==================================
          // DEITIES LIST
          // ==================================
          filteredDeities.map((deity) => (
            <TouchableOpacity
              key={deity.id}
              style={styles.deityCard}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: '/deity/[id]',
                  params: {
                    id: String(deity.id),
                  },
                })
              }
            >
              {/* DEITY IMAGE */}
              {deity.image_url ? (
                <Image
                  source={{
                    uri: deity.image_url,
                  }}
                  style={styles.deityImage}
                />
              ) : (
                <View
                  style={styles.deityImagePlaceholder}
                >
                  <Text style={styles.placeholderIcon}>
                    🛕
                  </Text>
                </View>
              )}
              {/* DEITY INFORMATION */}
              <View style={styles.deityContent}>
                {deity.deity_type === 'group' ? (
                  <View style={styles.groupLabel}>
                      <Text style={styles.groupLabelText}>
  {t('deities.groupLabel')}
</Text>
                    </View>
                ) : null}
                <Text style={styles.deityName}>
                  {deity.name}
                </Text>
                <Text
                  style={styles.deityDescription}
                  numberOfLines={3}
                >
                  {deity.description ||
                    t('deities.descriptionFallback')}
                </Text>
                {/* VIEW DETAILS */}
                <View style={styles.viewDetailsRow}>
                  <Text style={styles.viewDetails}>
                    {deity.deity_type === 'group'
  ? t('deities.exploreDeities')
  : t('deities.viewDetails')}
                  </Text>
                  <Text style={styles.arrow}>
                    ›
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          // ==================================
          // EMPTY STATE
          // ==================================
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>
              🙏
            </Text>
            <Text style={styles.emptyTitle}>
              {search.trim()
                ? t('deities.noSearchResult')
                : t('deities.noDeities')}
            </Text>
            <Text style={styles.emptyText}>
              {search.trim()
                ? t('deities.tryAnother')
                : t('deities.noActive')}
            </Text>
          </View>
        )}
        {/* ================================= */}
        {/* BOTTOM BLESSING NOTE              */}
        {/* ================================= */}
        <View style={styles.noteCard}>
          <Text style={styles.noteIcon}>
            🪔
          </Text>
          <Text style={styles.noteText}>
            {t('deities.blessingNote')}
          </Text>
        </View>
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  smallText: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#777',
    lineHeight: 17,
  },
  omContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  om: {
    fontSize: 27,
    color: '#B66A2C',
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    backgroundColor: '#F3DEC5',
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
    alignItems: 'center',
  },
  bannerOm: {
    fontSize: 45,
    color: '#9A5726',
    marginRight: 14,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 5,
  },
  bannerText: {
    fontSize: 12,
    color: '#6D5140',
    lineHeight: 18,
  },
  searchContainer: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 22,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#4A2C18',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A2C18',
  },
  countText: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8C59E',
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#4A2C18',
    fontWeight: '700',
    overflow: 'hidden',
  },
  deityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 3,
    flexDirection: 'row',
  },
  deityImage: {
    width: 125,
    height: 155,
    backgroundColor: '#F0E6DA',
  },
  deityImagePlaceholder: {
    width: 125,
    height: 155,
    backgroundColor: '#F0E6DA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 38,
  },
  deityContent: {
    flex: 1,
    padding: 14,
  },
  deityName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 7,
  },
  groupLabel: {
    alignSelf: 'flex-start',
    backgroundColor: '#F7E8D4',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginBottom: 8,
  },
  groupLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9A5726',
  },
  deityDescription: {
    fontSize: 12,
    color: '#777',
    lineHeight: 18,
    flex: 1,
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  viewDetails: {
    fontSize: 12,
    color: '#B66A2C',
    fontWeight: '700',
  },
  arrow: {
    fontSize: 22,
    color: '#B66A2C',
    marginLeft: 5,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 35,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 35,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4A2C18',
    marginBottom: 5,
  },
  emptyText: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
  },
  noteCard: {
    marginTop: 8,
    padding: 16,
    backgroundColor: '#F7E8D4',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#6D5140',
  },
});
