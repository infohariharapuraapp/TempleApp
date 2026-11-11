
import { getToken } from '@/services/authStorage';
import i18n from '@/localization/i18n';

// Production Render backend
const API_BASE_URL =
  'https://hariharapura-temple-api.onrender.com/api';

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  token?: string;
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

  // Don't translate authentication, admin,
  // private user information or translation endpoints.
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

  const language = getSelectedLanguage();

  const separator = endpoint.includes('?')
    ? '&'
    : '?';

  // Respect any explicit language parameter
  // already supplied by a screen.
  if (/[?&]lang=/i.test(endpoint)) {
    return endpoint;
  }

  return `${endpoint}${separator}lang=${language}`;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    token,
  } = options;

  const authToken =
    token || await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers.Authorization =
      `Bearer ${authToken}`;
  }

  const finalEndpoint = buildEndpoint(
    endpoint,
    method
  );

  const response = await fetch(
    `${API_BASE_URL}${finalEndpoint}`,
    {
      method,
      headers,
      body:
        body !== undefined
          ? JSON.stringify(body)
          : undefined,
    }
  );

  let data: any;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      'Invalid response from server'
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      'Something went wrong'
    );
  }

  return data as T;
}

export { API_BASE_URL };