import volunteerI18n from '@/localization/i18n';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import {
  API_BASE_URL,
  ApiError,
} from '@/services/api';

import { getToken } from '@/services/authStorage';

let downloadRunning = false;

async function getSessionToken() {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const token = await Promise.race([
      getToken(),

      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new ApiError(volunteerI18n.t('volunteer.sessionTimeout')));
        }, 5000);
      }),
    ]);

    if (!token) {
      throw new ApiError(
        volunteerI18n.t('volunteer.loginRequired'),
        401
      );
    }

    return token;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export async function downloadVolunteerCertificate(
  certificateId: number
): Promise<void> {
  if (
    !Number.isSafeInteger(certificateId) ||
    certificateId <= 0 ||
    certificateId > 2147483647
  ) {
    throw new ApiError('Invalid certificate ID.');
  }

  if (downloadRunning) {
    throw new ApiError(
      volunteerI18n.t('volunteer.downloadInProgress')
    );
  }

  downloadRunning = true;

  const controller = new AbortController();

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let file: File | undefined;

  try {
    const token = await getSessionToken();

    const sharingAvailable =
      await Sharing.isAvailableAsync();

    if (!sharingAvailable) {
      throw new ApiError(
        volunteerI18n.t('volunteer.sharingUnavailable')
      );
    }

    timeout = setTimeout(() => {
      controller.abort();
    }, 60000);

    const response = await fetch(
      `${API_BASE_URL}/volunteer/certificates/${certificateId}/download`,
      {
        method: 'GET',

        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/pdf',
          'Cache-Control': 'no-cache',
        },

        signal: controller.signal,
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new ApiError(
          'Your session has expired. Please login again.',
          401
        );
      }

      if (
        response.status === 403 ||
        response.status === 404
      ) {
        throw new ApiError(
          volunteerI18n.t('volunteer.certificateAccessDenied'),
          response.status
        );
      }

      throw new ApiError(
        volunteerI18n.t('volunteer.certificateDownloadError'),
        response.status
      );
    }

    const contentType =
      response.headers.get('content-type') || '';

    if (!contentType.toLowerCase().includes(
      'application/pdf'
    )) {
      throw new ApiError(
        'The server did not return a valid PDF.'
      );
    }

    const maxBytes = 10 * 1024 * 1024;

    const contentLength = Number(
      response.headers.get('content-length')
    );

    if (contentLength > maxBytes) {
      throw new ApiError(
        volunteerI18n.t('volunteer.certificateTooLarge')
      );
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > maxBytes) {
      throw new ApiError(
        volunteerI18n.t('volunteer.certificateTooLarge')
      );
    }

    const bytes = new Uint8Array(buffer);

    // Verify the PDF file signature.

    if (
      bytes.length < 5 ||
      bytes[0] !== 37 ||
      bytes[1] !== 80 ||
      bytes[2] !== 68 ||
      bytes[3] !== 70 ||
      bytes[4] !== 45
    ) {
      throw new ApiError(
        volunteerI18n.t('volunteer.invalidPDF')
      );
    }

    clearTimeout(timeout);
    timeout = undefined;

    // Do not share a certificate after
    // the authenticated account has changed.

    const currentToken = await getSessionToken();

    if (currentToken !== token) {
      throw new ApiError(
        volunteerI18n.t('volunteer.sessionChanged')
      );
    }

    file = new File(
      Paths.cache,
      `Volunteer-Certificate-${certificateId}-${Date.now()}.pdf`
    );

    file.create();
    file.write(bytes);

    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Save or Share Seva Certificate',
      UTI: 'com.adobe.pdf',
    });

  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError(
        volunteerI18n.t('volunteer.certificateTimeout')
      );
    }

    throw error;

  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }

    try {
      if (file?.exists) {
        file.delete();
      }
    } catch {
      // Cache cleanup failure should not
      // prevent another download.
    }

    downloadRunning = false;
  }
}