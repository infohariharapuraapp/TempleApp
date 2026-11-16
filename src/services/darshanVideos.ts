import {
  apiRequest,
  API_BASE_URL,
} from '@/services/api';

// ========================================
// TYPES
// ========================================

export type DarshanVideo = {
  id: number;
  title: string;
  description?: string | null;
  label: 'live' | 'watch';
  url: string;
  thumbnail_url?: string | null;
  is_active: boolean;
  category_id?: number | null;
  category_name?: string | null;
};

export type DarshanVideoCategory = {
  id: number;
  name: string;
  sort_order: number;
  video_count: number;
};

export type DarshanCategoryFilter = {
  id: string;
  name: string;
};

// ========================================
// TRANSLATIONS
// ========================================

const TRANSLATIONS = {
  en: {
    all: 'All',
    allVideos: 'All Videos',
    live: 'Live',
    videos: 'Videos',
    retry: 'Try Again',
    error: 'Unable to load videos.',
    openError: 'Unable to open this video.',
    noCategoryVideos:
      'No videos available in this category.',
  },

  te: {
    all: 'అన్నీ',
    allVideos: 'అన్ని వీడియోలు',
    live: 'ప్రత్యక్షం',
    videos: 'వీడియోలు',
    retry: 'మళ్లీ ప్రయత్నించండి',
    error: 'వీడియోలను లోడ్ చేయలేకపోయాము.',
    openError: 'ఈ వీడియోను తెరవలేకపోయాము.',
    noCategoryVideos:
      'ఈ విభాగంలో వీడియోలు అందుబాటులో లేవు.',
  },

  kn: {
    all: 'ಎಲ್ಲಾ',
    allVideos: 'ಎಲ್ಲಾ ವೀಡಿಯೊಗಳು',
    live: 'ನೇರ ಪ್ರಸಾರ',
    videos: 'ವೀಡಿಯೊಗಳು',
    retry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
    error: 'ವೀಡಿಯೊಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.',
    openError: 'ಈ ವೀಡಿಯೊವನ್ನು ತೆರೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.',
    noCategoryVideos:
      'ಈ ವಿಭಾಗದಲ್ಲಿ ವೀಡಿಯೊಗಳು ಲಭ್ಯವಿಲ್ಲ.',
  },

  hi: {
    all: 'सभी',
    allVideos: 'सभी वीडियो',
    live: 'लाइव',
    videos: 'वीडियो',
    retry: 'पुनः प्रयास करें',
    error: 'वीडियो लोड नहीं हो सके।',
    openError: 'यह वीडियो नहीं खुल सका।',
    noCategoryVideos:
      'इस श्रेणी में कोई वीडियो उपलब्ध नहीं है।',
  },

  ta: {
    all: 'அனைத்தும்',
    allVideos: 'அனைத்து வீடியோக்கள்',
    live: 'நேரலை',
    videos: 'வீடியோக்கள்',
    retry: 'மீண்டும் முயற்சிக்கவும்',
    error: 'வீடியோக்களை ஏற்ற முடியவில்லை.',
    openError: 'இந்த வீடியோவைத் திறக்க முடியவில்லை.',
    noCategoryVideos:
      'இந்தப் பிரிவில் வீடியோக்கள் இல்லை.',
  },
};

export function getDarshanVideoLabels(
  language: string
) {
  const lang = language
    .toLowerCase()
    .split('-')[0];

  return (
    TRANSLATIONS[
      lang as keyof typeof TRANSLATIONS
    ] || TRANSLATIONS.en
  );
}

// ========================================
// FETCH VIDEOS AND CATEGORIES
// ========================================

export async function fetchDarshanVideoData(
  language: string
) {
  const lang = encodeURIComponent(language);

  const [videoResponse, categoryResponse] =
    await Promise.all([
      apiRequest<{
        success: boolean;
        data: DarshanVideo[];
      }>(`/darshan-videos?lang=${lang}`),

      apiRequest<{
        success: boolean;
        data: DarshanVideoCategory[];
      }>(
        `/darshan-video-categories?lang=${lang}`
      ).catch((error) => {
        console.warn(
          'Darshan categories unavailable:',
          error
        );

        return {
          success: false,
          data: [] as DarshanVideoCategory[],
        };
      }),
    ]);

  if (
    !videoResponse.success ||
    !Array.isArray(videoResponse.data)
  ) {
    throw new Error(
      'Unable to load Darshan Videos.'
    );
  }

  const videos = videoResponse.data
    .filter((video) => video.is_active)
    .sort((a, b) => {
      const aPriority =
        a.label === 'live' ? 0 : 1;

      const bPriority =
        b.label === 'live' ? 0 : 1;

      return (
        aPriority - bPriority ||
        b.id - a.id
      );
    });

  const categories =
    categoryResponse.success &&
    Array.isArray(categoryResponse.data)
      ? categoryResponse.data
          .filter((category) =>
            videos.some(
              (video) =>
                video.category_id === category.id
            )
          )
          .sort(
            (a, b) =>
              a.sort_order - b.sort_order ||
              a.id - b.id
          )
      : [];

  return {
    videos,
    categories,
  };
}

// ========================================
// BUILD FILTER OPTIONS
// ========================================

export function buildDarshanVideoFilters(
  videos: DarshanVideo[],
  categories: DarshanVideoCategory[],
  language: string
): DarshanCategoryFilter[] {
  const labels =
    getDarshanVideoLabels(language);

  const filters: DarshanCategoryFilter[] = [
    {
      id: 'all',
      name: labels.all,
    },
  ];

  if (
    videos.some(
      (video) => video.label === 'live'
    )
  ) {
    filters.push({
      id: 'live',
      name: labels.live,
    });
  }

  categories.forEach((category) => {
    filters.push({
      id: String(category.id),
      name: category.name,
    });
  });

  return filters;
}

// ========================================
// FILTER VIDEOS
// ========================================

export function filterDarshanVideos(
  videos: DarshanVideo[],
  selectedCategory: string
): DarshanVideo[] {
  if (selectedCategory === 'all') {
    return videos;
  }

  if (selectedCategory === 'live') {
    return videos.filter(
      (video) => video.label === 'live'
    );
  }

  return videos.filter(
    (video) =>
      String(video.category_id) ===
      selectedCategory
  );
}

// ========================================
// YOUTUBE THUMBNAIL
// ========================================

export function getYoutubeThumbnail(
  url: string
): string {
  try {
    const parsed = new URL(url);

    const hostname =
      parsed.hostname.toLowerCase();

    let videoId: string | null = null;

    if (hostname === 'youtu.be') {
      videoId =
        parsed.pathname
          .split('/')
          .filter(Boolean)[0] || null;
    }

    if (
      hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com')
    ) {
      videoId = parsed.searchParams.get('v');

      if (!videoId) {
        const parts = parsed.pathname
          .split('/')
          .filter(Boolean);

        if (
          ['live', 'shorts', 'embed', 'v']
            .includes(parts[0])
        ) {
          videoId = parts[1] || null;
        }
      }
    }

    if (
      !videoId ||
      !/^[a-zA-Z0-9_-]{11}$/.test(videoId)
    ) {
      return '';
    }

    return (
      `https://img.youtube.com/vi/` +
      `${videoId}/hqdefault.jpg`
    );
  } catch {
    return '';
  }
}

// ========================================
// RESOLVE THUMBNAIL
// ========================================

export function getDarshanVideoThumbnail(
  video: DarshanVideo
): string {
  const thumbnail =
    video.thumbnail_url?.trim();

  if (thumbnail) {
    if (/^https?:\/\//i.test(thumbnail)) {
      return thumbnail;
    }

    const baseUrl = API_BASE_URL.replace(
      /\/api\/?$/,
      ''
    );

    return `${baseUrl}${
      thumbnail.startsWith('/') ? '' : '/'
    }${thumbnail}`;
  }

  return getYoutubeThumbnail(video.url);
}