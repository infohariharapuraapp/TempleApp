import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import { useTranslation } from 'react-i18next';

import {
  uploadVolunteerPhoto,
  getVolunteerError,
} from '@/services/volunteerApi';

import {
  VOLUNTEER_COLORS as C,
  VolunteerButton,
} from '@/components/volunteer/VolunteerUI';

export interface VolunteerPhotoSelection {
  uri: string;
  uploadId: string;
  expiresAt: string;
}

interface Props {
  opportunityId: number;
  value?: VolunteerPhotoSelection;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
  onChange: (
    photo: VolunteerPhotoSelection
  ) => void;
}

export default function VolunteerPhotoPicker({
  opportunityId,
  value,
  disabled = false,
  onBusyChange,
  onChange,
}: Props) {
  const { t } = useTranslation();

  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] =
    useState(false);

  const [error, setError] = useState('');

  const [candidate, setCandidate] =
    useState<ImagePicker.ImagePickerAsset | null>(
      null
    );

  const mounted = useRef(false);
  const lock = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  async function upload(
    asset: ImagePicker.ImagePickerAsset
  ) {
    const mimeType = asset.mimeType ||
      (
        /\.(jpe?g)$/i.test(asset.uri)
          ? 'image/jpeg'
          : /\.png$/i.test(asset.uri)
            ? 'image/png'
            : /\.webp$/i.test(asset.uri)
              ? 'image/webp'
              : ''
      );

    if (
      ![
        'image/jpeg',
        'image/png',
        'image/webp',
      ].includes(mimeType)
    ) {
      throw new Error(
        t(
          'volunteer.photoInvalidType',
          'Choose a JPG, PNG or WebP photograph.'
        )
      );
    }

    if (
      asset.fileSize !== undefined &&
      asset.fileSize > 5 * 1024 * 1024
    ) {
      throw new Error(
        t(
          'volunteer.photoTooLarge',
          'Photograph must not exceed 5 MB.'
        )
      );
    }

    setUploading(true);

    try {
      const result = await uploadVolunteerPhoto(
        opportunityId,
        {
          uri: asset.uri,
          mimeType,
          fileSize: asset.fileSize,
        }
      );

      if (!mounted.current) return;

      onChange({
        uri: asset.uri,
        uploadId: result.upload_id,
        expiresAt: result.expires_at,
      });

      setCandidate(null);

    } finally {
      if (mounted.current) {
        setUploading(false);
      }
    }
  }

  async function choosePhoto(
    source: 'camera' | 'gallery' | 'retry'
  ) {
    if (disabled || lock.current) return;

    lock.current = true;

    setBusy(true);
    setError('');
    onBusyChange(true);

    try {
      if (source === 'retry') {
        if (candidate) {
          await upload(candidate);
        }

        return;
      }

      if (source === 'camera') {
        const permission =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          throw new Error(
            t(
              'volunteer.cameraPermissionDenied',
              'Camera permission was denied. You can choose a photograph from the gallery instead.'
            )
          );
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
        allowsMultipleSelection: false,
        base64: false,
        exif: false,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(
              options
            )
          : await ImagePicker.launchImageLibraryAsync(
              options
            );

      if (
        result.canceled ||
        !result.assets?.length ||
        !mounted.current
      ) {
        return;
      }

      const asset = result.assets[0];

      setCandidate(asset);

      await upload(asset);

    } catch (err) {
      if (mounted.current) {
        setError(
          err instanceof Error
            ? err.message
            : getVolunteerError(err)
        );
      }

    } finally {
      lock.current = false;

      if (mounted.current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  }

  const expired = Boolean(
    value &&
    !(Date.parse(value.expiresAt) > Date.now())
  );

  const previewUri =
    candidate?.uri || value?.uri;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        {t(
          'volunteer.passportPhoto',
          'Passport-size Photograph'
        )} *
      </Text>

      <Text style={styles.description}>
        {t(
          'volunteer.photoInstructions',
          'Upload a recent, clear photograph with your face fully visible. JPG, PNG or WebP, maximum 5 MB.'
        )}
      </Text>

      <View style={styles.preview}>
        {previewUri ? (
          <Image
            source={{ uri: previewUri }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel="Volunteer photograph"
          />
        ) : (
          <Text style={styles.placeholder}>
            {t(
              'volunteer.noPhotoSelected',
              'No photograph selected'
            )}
          </Text>
        )}
      </View>

      {value && !candidate && !expired && (
        <Text style={styles.success}>
          {t(
            'volunteer.photoUploaded',
            'Photograph uploaded successfully'
          )}
        </Text>
      )}

      {expired && (
        <Text style={styles.error}>
          {t(
            'volunteer.photoExpired',
            'Photograph upload expired. Please upload it again.'
          )}
        </Text>
      )}

      {busy && (
        <View style={styles.progress}>
          <ActivityIndicator color={C.maroon} />

          <Text style={styles.description}>
            {uploading
              ? t(
                  'volunteer.uploadingPhoto',
                  'Uploading photograph…'
                )
              : t(
                  'volunteer.openingPhotoPicker',
                  'Opening photograph picker…'
                )}
          </Text>
        </View>
      )}

      {!!error && (
        <Text style={styles.error}>
          {error}
        </Text>
      )}

      {!!candidate && !!error && (
        <>
          <VolunteerButton
            title={t(
              'volunteer.retryPhotoUpload',
              'Retry Upload'
            )}
            disabled={busy || disabled}
            onPress={() =>
              void choosePhoto('retry')
            }
          />

          <VolunteerButton
            secondary
            title={t(
              'volunteer.discardPhoto',
              'Discard Failed Selection'
            )}
            disabled={busy || disabled}
            onPress={() => {
              setCandidate(null);
              setError('');
            }}
          />
        </>
      )}

      <View style={styles.buttons}>
        <View style={{ flex: 1 }}>
          <VolunteerButton
            title={t(
              'volunteer.takePhoto',
              'Take Photo'
            )}
            secondary
            disabled={busy || disabled}
            onPress={() =>
              void choosePhoto('camera')
            }
          />
        </View>

        <View style={{ flex: 1 }}>
          <VolunteerButton
            title={t(
              'volunteer.chooseGallery',
              'Gallery'
            )}
            secondary
            disabled={busy || disabled}
            onPress={() =>
              void choosePhoto('gallery')
            }
          />
        </View>
      </View>

      <Text style={styles.note}>
        {t(
          'volunteer.photoPrivacyNote',
          'Your photograph is used for volunteer verification and ID card generation.'
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 15,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FFFDF8',
    borderRadius: 15,
    marginVertical: 15,
  },

  heading: {
    fontSize: 16,
    color: C.maroon,
    fontWeight: '800',
    marginBottom: 9,
  },

  description: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
  },

  preview: {
    width: 132,
    height: 176,
    backgroundColor: C.lightGold,
    borderRadius: 12,
    borderColor: C.border,
    borderWidth: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginVertical: 16,
  },

  image: {
    width: '100%',
    height: '100%',
  },

  placeholder: {
    color: C.muted,
    padding: 14,
    textAlign: 'center',
    fontSize: 12,
  },

  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },

  progress: {
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },

  success: {
    color: C.green,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '700',
  },

  error: {
    backgroundColor: C.lightRed,
    color: C.red,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    marginVertical: 10,
  },

  note: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 10,
  },
});