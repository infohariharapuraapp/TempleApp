
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

type WelcomeSettings = {
  id: number;
  title: string;
  image_url: string | null;
  is_enabled: boolean;
  display_duration: number;
  updated_at?: string;
};

const defaults: WelcomeSettings = {
  id: 1,
  title: 'Welcome to Divyakshetra Hariharapura',
  image_url: null,
  is_enabled: false,
  display_duration: 3,
};

export default function WelcomeScreen() {
  const [settings, setSettings] =
    useState<WelcomeSettings>(defaults);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const result = await apiRequest<{
          success: boolean;
          data: WelcomeSettings | null;
        }>('/admin/welcome-screen');

        if (active && result.data) {
          setSettings({
            ...defaults,
            ...result.data,
          });
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load welcome settings'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowed.includes(file.type)) {
      setError('Select a JPG, PNG or WebP image.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    setSelectedFile(file);
    setError('');
    setSuccess('');
  }

  async function handleSave(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    setError('');
    setSuccess('');

    if (
      settings.is_enabled &&
      !settings.image_url &&
      !selectedFile
    ) {
      setError('Upload an image before enabling.');
      return;
    }

    setSaving(true);

    try {
      let imageUrl = settings.image_url;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('image', selectedFile);

        const uploaded = await apiRequest<{
          success: boolean;
          data: {
            image_url: string;
            public_id: string;
          };
        }>('/admin/welcome-screen/upload', {
          method: 'POST',
          body: formData,
        });

        imageUrl = uploaded.data.image_url;
      }

      const result = await apiRequest<{
        success: boolean;
        data: WelcomeSettings;
      }>('/admin/welcome-screen', {
        method: 'PUT',
        body: JSON.stringify({
          title: settings.title.trim(),
          image_url: imageUrl,
          is_enabled: settings.is_enabled,
          display_duration: settings.display_duration,
        }),
      });

      setSettings(result.data);
      setSelectedFile(null);
      setSuccess('Welcome Screen Settings saved successfully.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save welcome settings'
      );
    } finally {
      setSaving(false);
    }
  }

  const imagePreview =
    previewUrl || settings.image_url;

  return (
    <main className="content">
      <div className="page-head">
        <div>
          <h2>Welcome Screen Settings</h2>
          <p>
            Manage the welcome image shown when
            devotees open the Temple App.
          </p>
        </div>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div
          className="panel"
          role="status"
          style={{
            borderLeft: '4px solid #26804c',
            marginBottom: 18,
          }}
        >
          {success}
        </div>
      )}

      {loading ? (
        <div className="panel">
          Loading welcome settings...
        </div>
      ) : (
        <form
          className="form-card"
          onSubmit={handleSave}
          style={{ maxWidth: 850, width: '100%' }}
        >
          <h3>Welcome Screen Configuration</h3>

          <div className="grid2">
            <label>
              Welcome Title
              <input
                type="text"
                maxLength={200}
                value={settings.title}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Welcome to Divyakshetra Hariharapura"
              />
            </label>

            <label>
              Display Duration (Seconds)
              <select
                value={settings.display_duration}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    display_duration: Number(
                      event.target.value
                    ),
                  }))
                }
              >
                {Array.from(
                  { length: 9 },
                  (_, index) => index + 2
                ).map((seconds) => (
                  <option
                    key={seconds}
                    value={seconds}
                  >
                    {seconds} seconds
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Upload Welcome Image
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              disabled={saving}
            />
            <small>
              JPG, PNG or WebP. Maximum 5 MB.
            </small>
          </label>

          {imagePreview && (
            <div style={{ marginTop: 18 }}>
              <h3>Image Preview</h3>

              <div
                style={{
                  maxWidth: 320,
                  width: '100%',
                  aspectRatio: '9 / 16',
                  borderRadius: 16,
                  border: '1px solid #E8DCCB',
                  background: '#FFFDF8',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={imagePreview}
                  alt="Welcome screen preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>
            </div>
          )}

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 20,
            }}
          >
            <input
              type="checkbox"
              checked={settings.is_enabled}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  is_enabled: event.target.checked,
                }))
              }
            />
            Enable Welcome Screen
          </label>

          <p style={{ fontSize: 13 }}>
            When disabled, devotees will proceed
            directly to the normal app startup flow.
          </p>

          <div className="actions">
            <button
              type="submit"
              className="primary"
              disabled={saving}
            >
              {saving
                ? 'Saving Settings...'
                : 'Save Welcome Settings'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
