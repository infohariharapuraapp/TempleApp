
import { getToken } from '@/services/authStorage';
import i18n from '@/localization/i18n';

// ========================================
// API CONFIGURATION
// ========================================

const API_BASE_URL =
  'https://hariharapura-temple-api.onrender.com/api';

const DEFAULT_TIMEOUT_MS = 15000;

// ========================================
// TYPES
// ========================================

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  token?: string;
  timeoutMs?: number;
};

type SupportedLanguage =
  | 'en'
  | 'te'
  | 'kn'
  | 'hi'
  | 'ta';

const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'en',
  'te',
  'kn',
  'hi',
  'ta',
];

// ========================================
// API ERROR
// ========================================

export class ApiError extends Error {
  status?: number;

  constructor(
    message: string,
    status?: number
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;

    Object.setPrototypeOf(
      this,
      ApiError.prototype
    );
  }
}

// ========================================
// LANGUAGE
// ========================================

function getSelectedLanguage(): SupportedLanguage {
  const currentLanguage =
    i18n.resolvedLanguage ||
    i18n.language ||
    'en';

  const normalized =
    currentLanguage
      .toLowerCase()
      .split('-')[0] as SupportedLanguage;

  return SUPPORTED_LANGUAGES.includes(normalized)
    ? normalized
    : 'en';
}

function shouldAppendLanguage(
  endpoint: string,
  method: string
): boolean {
  if (method !== 'GET') {
    return false;
  }

  const path = endpoint.split('?')[0];

  const excludedPrefixes = [
    '/auth',
    '/admin',
    '/dharma',
    '/notifications',
    '/translate',
  ];

  return !excludedPrefixes.some(
    (prefix) =>
      path === prefix ||
      path.startsWith(prefix + '/')
  );
}

function buildEndpoint(
  endpoint: string,
  method: string
): string {
  if (!shouldAppendLanguage(endpoint, method)) {
    return endpoint;
  }

  if (/[?&]lang=/i.test(endpoint)) {
    return endpoint;
  }

  const separator = endpoint.includes('?')
    ? '&'
    : '?';

  return `${endpoint}${separator}lang=${getSelectedLanguage()}`;
}

// ========================================
// API REQUEST
// ========================================

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    token,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  // Explicitly supplied token takes precedence.
  const authToken =
    token !== undefined
      ? token
      : await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const finalEndpoint = buildEndpoint(
    endpoint,
    method
  );

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(
      `${API_BASE_URL}${finalEndpoint}`,
      {
        method,
        headers,
        body:
          body !== undefined
            ? JSON.stringify(body)
            : undefined,
        signal: controller.signal,
      }
    );

    let data: any;

    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        'Invalid response from server',
        response.status
      );
    }

    if (!response.ok) {
      throw new ApiError(
        data?.message ||
          'Something went wrong',
        response.status
      );
    }

    return data as T;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === 'AbortError'
    ) {
      throw new ApiError(
        'Request timed out. Please try again.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export { API_BASE_URL };
