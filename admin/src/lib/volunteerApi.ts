import { apiRequest } from './api';

export interface VolunteerResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface VolunteerOpportunity {
  id: number;
  title: string;
  service_start_date: string;
  service_end_date: string;
  is_published: boolean;
}

export async function volunteerRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<VolunteerResponse<T>> {
  const controller = new AbortController();

  const timer = window.setTimeout(
    () => controller.abort(),
    60000
  );

  try {
    const response =
      await apiRequest<VolunteerResponse<T>>(
        `/admin/volunteer${endpoint}`,
        {
          ...options,
          cache: 'no-store',
          signal: controller.signal,
        }
      );

    if (!response.success) {
      throw new Error(
        response.message || 'Request failed'
      );
    }

    return response;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        'Request timed out. Refresh records before retrying any changes.'
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function jsonRequest(
  method: string,
  body: unknown
): RequestInit {
  return {
    method,
    body: JSON.stringify(body),
  };
}

export function getErrorMessage(
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

export async function uploadVolunteerImage(
  file: File,
  type: 'opportunity' | 'male-dress' | 'female-dress'
): Promise<string> {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      'Only JPG, PNG and WebP images are allowed.'
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error(
      'Image size must not exceed 5 MB.'
    );
  }

  const formData = new FormData();

  formData.append('image', file);
  formData.append('type', type);

  const response = await volunteerRequest<{
    image_url: string;
    public_id: string;
  }>('/upload', {
    method: 'POST',
    body: formData,
  });

  if (
    typeof response.data?.image_url !== 'string' ||
    !response.data.image_url.startsWith('https://')
  ) {
    throw new Error(
      'Invalid image upload response.'
    );
  }

  return response.data.image_url;
}

export function formatIST(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatServiceDate(value?: string | null) {
  if (!value) return '—';

  return value
    .slice(0, 10)
    .split('-')
    .reverse()
    .join('/');
}

export function isFutureShift(
  date: string,
  time: string
): boolean {
  return Date.parse(
    `${date.slice(0, 10)}T${time.slice(0, 8)}+05:30`
  ) > Date.now();
}