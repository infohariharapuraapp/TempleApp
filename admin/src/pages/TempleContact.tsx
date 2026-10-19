
import React, { useEffect, useState } from 'react';

import { apiRequest } from '../lib/api';

type ContactSettings = {
  main_phone: string;
  guest_house_phone: string;
  bangalore_phone: string;
  email: string;
  temple_name: string;
  temple_address: string;
  bangalore_address: string;
  google_maps_url: string;
};

const emptySettings: ContactSettings = {
  main_phone: '',
  guest_house_phone: '',
  bangalore_phone: '',
  email: '',
  temple_name: '',
  temple_address: '',
  bangalore_address: '',
  google_maps_url: '',
};

const fields: {
  key: keyof ContactSettings;
  label: string;
  type?: string;
  multiline?: boolean;
}[] = [
  { key: 'temple_name', label: 'Temple Name' },
  { key: 'main_phone', label: 'Main Office Phone', type: 'tel' },
  { key: 'guest_house_phone', label: 'Guest House Phone', type: 'tel' },
  { key: 'bangalore_phone', label: 'Bengaluru Branch Phone', type: 'tel' },
  { key: 'email', label: 'Email Address', type: 'email' },
  { key: 'temple_address', label: 'Temple Address', multiline: true },
  { key: 'bangalore_address', label: 'Bengaluru Branch Address', multiline: true },
  { key: 'google_maps_url', label: 'Google Maps URL', type: 'url' },
];

export default function TempleContact() {
  const [settings, setSettings] =
    useState<ContactSettings>(emptySettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const result = await apiRequest<{
          success: boolean;
          data: ContactSettings;
        }>('/admin/temple-contact');

        if (active) {
          setSettings({
            ...emptySettings,
            ...result.data,
          });
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load contact settings'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  function updateField(
    key: keyof ContactSettings,
    value: string
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setSuccess('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();

    if (saving) return;

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const payload = Object.fromEntries(
        Object.entries(settings).map(([key, value]) => [
          key,
          value.trim(),
        ])
      );

      await apiRequest('/admin/temple-contact', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setSuccess('Temple contact details updated successfully.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save contact settings'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="content">
      <div className="page-head">
        <div>
          <h2>Temple Contact Settings</h2>
          <p>
            Manage the contact information displayed
            in the devotee mobile application.
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
          Loading contact settings...
        </div>
      ) : (
        <form className="form-card" onSubmit={save}>
          <h3>Contact Information</h3>

          <div className="grid2">
            {fields.map((field) => (
              <label key={field.key}>
                {field.label}

                {field.multiline ? (
                  <textarea
                    value={settings[field.key]}
                    onChange={(e) =>
                      updateField(field.key, e.target.value)
                    }
                    maxLength={2000}
                    required
                  />
                ) : (
                  <input
                    type={field.type || 'text'}
                    value={settings[field.key]}
                    onChange={(e) =>
                      updateField(field.key, e.target.value)
                    }
                    maxLength={2000}
                    required
                  />
                )}
              </label>
            ))}
          </div>

          <div className="actions">
            <button
              type="submit"
              className="primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Contact Details'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
