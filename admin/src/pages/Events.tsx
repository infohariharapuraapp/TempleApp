import { useEffect, useState } from 'react';

import type { FormEvent } from 'react';

import { apiRequest } from '../lib/api';



type EventItem = {

  id: number;

  title: string;

  description?: string | null;

  image_url?: string | null;

  event_date?: string | null;
  event_end_date?: string | null;
  images?: Array<string | { image_url: string }>;

  start_time?: string | null;

  end_time?: string | null;

  location?: string | null;

  category_id?: number | null;

  category_name?: string | null;

  is_active: boolean;

  created_at?: string;

  updated_at?: string;

};



type EventCategory = {

  id: number;

  name: string;
  name_en?: string | null;
  name_te?: string | null;
  name_kn?: string | null;
  name_hi?: string | null;
  name_ta?: string | null;

  is_active: boolean;

};



type ApiList<T> = { success: boolean; data: T[] };



const messageOf = (error: unknown, fallback: string) =>

  error instanceof Error ? error.message : fallback;

const datePart = (value?: string | null) => value?.substring(0, 10) || '';

const timePart = (value?: string | null) => value?.substring(0, 5) || '';
const displayTime = (start?: string | null, end?: string | null) => {
  const a = timePart(start);
  const b = timePart(end);
  return a && b ? `${a} – ${b}` : a ? `Starts at ${a}` : b ? `Ends at ${b}` : '—';
};
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.heic', '.heif', '.avif'];
const IMAGE_ACCEPT = IMAGE_EXTENSIONS.join(',');
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;



export default function Events() {

  const [items, setItems] = useState<EventItem[]>([]);

  const [categories, setCategories] = useState<EventCategory[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);

  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

  const [manageCategories, setManageCategories] = useState(false);

  const [categoryNames, setCategoryNames] = useState({
    name_en: '',
    name_te: '',
    name_kn: '',
    name_hi: '',
    name_ta: '',
  });

  const categoryLanguages = [
    { key: 'name_en', label: 'English', placeholder: 'e.g. Festivals', required: true },
    { key: 'name_te', label: 'Telugu', placeholder: 'ఉదా. పండుగలు' },
    { key: 'name_kn', label: 'Kannada', placeholder: 'ಉದಾ. ಹಬ್ಬಗಳು' },
    { key: 'name_hi', label: 'Hindi', placeholder: 'जैसे त्योहार' },
    { key: 'name_ta', label: 'Tamil', placeholder: 'எ.கா. திருவிழாக்கள்' },
  ] as const;

  const [editingCategory, setEditingCategory] = useState<EventCategory | null>(null);

  const [categoryBusy, setCategoryBusy] = useState(false);

  const [statusBusy, setStatusBusy] = useState<number | null>(null);



  async function loadEvents() {

    const result = await apiRequest<ApiList<EventItem>>('/admin/events');

    setItems(result.data || []);

  }



  async function loadCategories() {

    const result = await apiRequest<ApiList<EventCategory>>('/admin/event-categories');

    setCategories(result.data || []);

  }



  async function refresh() {

    try {

      setLoading(true);

      setError('');

      await Promise.all([loadEvents(), loadCategories()]);

    } catch (err) {

      setError(messageOf(err, 'Failed to load events or categories'));

    } finally {

      setLoading(false);

    }

  }



  useEffect(() => { void refresh(); }, []);



  function openAddForm() {

    setEditingEvent(null);

    setShowForm(true);

    setManageCategories(false);

  }



  function openEditForm(event: EventItem) {

    setEditingEvent(event);

    setShowForm(true);

    setManageCategories(false);

  }



  async function toggleStatus(event: EventItem) {

    try {

      setStatusBusy(event.id);

      setError('');

      await apiRequest(`/admin/events/${event.id}/status`, {

        method: 'PATCH',

        body: JSON.stringify({ is_active: !event.is_active }),

      });

      await loadEvents();

    } catch (err) {

      setError(messageOf(err, 'Failed to update event status'));

    } finally {

      setStatusBusy(null);

    }

  }



  function startAddCategory() {

    setEditingCategory(null);

    setCategoryNames({ name_en: '', name_te: '', name_kn: '', name_hi: '', name_ta: '' });

  }



  function startEditCategory(category: EventCategory) {

    setEditingCategory(category);

    setCategoryNames({
      name_en: category.name_en || category.name,
      name_te: category.name_te || '',
      name_kn: category.name_kn || '',
      name_hi: category.name_hi || '',
      name_ta: category.name_ta || '',
    });

  }



  async function saveCategory(e: FormEvent) {

    e.preventDefault();

    const name = categoryNames.name_en.trim();
    const translations = Object.fromEntries(
      Object.entries(categoryNames).map(([key, value]) => [key, value.trim() || null])
    );

    if (!name) { setError('Category name is required'); return; }

    if (Object.values(categoryNames).some(value => value.trim().length > 100)) { setError('Each category translation must be 100 characters or fewer'); return; }

    try {

      setCategoryBusy(true);

      setError('');

      if (editingCategory) {

        await apiRequest(`/admin/event-categories/${editingCategory.id}`, {

          method: 'PUT',

          body: JSON.stringify({ ...translations, is_active: editingCategory.is_active }),

        });

      } else {

        await apiRequest('/admin/event-categories', {

          method: 'POST',

          body: JSON.stringify(translations),

        });

      }

      startAddCategory();

      await Promise.all([loadCategories(), loadEvents()]);

    } catch (err) {

      setError(messageOf(err, 'Failed to save category'));

    } finally {

      setCategoryBusy(false);

    }

  }



  async function toggleCategory(category: EventCategory) {

    const affected = items.filter(e => e.category_id === category.id && e.is_active).length;

    if (category.is_active && affected > 0 &&

      !window.confirm(`Deactivating "${category.name}" will hide ${affected} published event(s) from devotees until the category is reactivated. Continue?`)) return;

    try {

      setCategoryBusy(true);

      setError('');

      await apiRequest(`/admin/event-categories/${category.id}`, {

        method: 'PUT',

        body: JSON.stringify({ name: category.name, is_active: !category.is_active }),

      });

      await loadCategories();

    } catch (err) {

      setError(messageOf(err, 'Failed to change category status'));

    } finally {

      setCategoryBusy(false);

    }

  }



  return (

    <div className="page">

      <div className="page-header">

        <div>

          <h1>Events</h1>

          <p>Manage temple events and categories displayed to devotees</p>

        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>

          <button type="button" onClick={() => void refresh()} disabled={loading}>

            {loading ? 'Refreshing...' : 'Refresh'}

          </button>

          <button type="button" onClick={() => { setManageCategories(!manageCategories); setShowForm(false); startAddCategory(); }}>

            {manageCategories ? 'Close Categories' : 'Manage Categories'}

          </button>

          <button type="button" className="primary-button" onClick={openAddForm} disabled={!categories.some(c => c.is_active)}>

            + Add Event

          </button>

        </div>

      </div>



      {error && <div className="error-message" role="alert">{error}</div>}



      {manageCategories && (

        <div className="card" style={{ marginBottom: 20 }}>

          <div className="section-header">

            <div><h2>Manage Event Categories</h2><p>New active categories appear in the app through the API, without an app release.</p></div>

          </div>

          <form onSubmit={saveCategory} style={{ marginBottom: 20 }}>
            <p style={{ marginBottom: 12, color: '#81776d' }}>
              Enter category names in the languages you support. English is required;
              other languages fall back to English when left blank.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {categoryLanguages.map(language => (
                <label key={language.key}>
                  {language.label}{language.key === 'name_en' ? ' *' : ' (optional)'}
                  <input
                    value={categoryNames[language.key]}
                    maxLength={100}
                    required={language.key === 'name_en'}
                    placeholder={language.placeholder}
                    onChange={e => setCategoryNames(previous => ({
                      ...previous,
                      [language.key]: e.target.value,
                    }))}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" className="primary-button" disabled={categoryBusy || !categoryNames.name_en.trim()}>
                {categoryBusy ? 'Saving...' : editingCategory ? 'Save Changes' : '+ Add Category'}
              </button>
              {editingCategory && <button type="button" disabled={categoryBusy} onClick={startAddCategory}>Cancel Edit</button>}
            </div>
          </form>
          <div className="table-wrap">

            <table>

              <thead><tr><th>Category</th><th>Events</th><th>Status</th><th>Actions</th></tr></thead>

              <tbody>

                {categories.map(category => (

                  <tr key={category.id}>

                    <td>
                      <strong>{category.name_en || category.name}</strong>
                      {(['name_te', 'name_kn', 'name_hi', 'name_ta'] as const).some(key => category[key]) && (
                        <small style={{ display: 'block', color: '#81776d', marginTop: 4 }}>
                          {(['name_te', 'name_kn', 'name_hi', 'name_ta'] as const)
                            .map(key => category[key]).filter(Boolean).join(' · ')}
                        </small>
                      )}
                    </td>

                    <td>{items.filter(event => event.category_id === category.id).length}</td>

                    <td><span className="badge">{category.is_active ? 'Active' : 'Inactive'}</span></td>

                    <td><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

                      <button type="button" disabled={categoryBusy} onClick={() => startEditCategory(category)}>Edit</button>

                      <button type="button" disabled={categoryBusy} onClick={() => void toggleCategory(category)}>

                        {category.is_active ? 'Deactivate' : 'Activate'}

                      </button>

                    </div></td>

                  </tr>

                ))}

              </tbody>

            </table>

            {categories.length === 0 && <p>No categories yet. Add your first category above.</p>}

          </div>

        </div>

      )}



      {showForm && (

        <EventForm

          event={editingEvent}

          categories={categories}

          onClose={() => setShowForm(false)}

          onSaved={() => { setShowForm(false); void refresh(); }}

        />

      )}



      <div className="card">

        <div className="section-header"><div><h2>Temple Events</h2><p>Published events in active categories are visible to devotees</p></div></div>

        {loading && items.length === 0 ? <p>Loading events...</p> : items.length === 0 ? <p>No events found.</p> : (

          <div className="table-wrap">

            <table>

              <thead><tr><th>Event</th><th>Category</th><th>Date</th><th>Time</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>

              <tbody>

                {items.map(event => (

                  <tr key={event.id}>

                    <td><strong>{event.title}</strong>{event.description && <small style={{ display: 'block', marginTop: 4, color: '#81776d', maxWidth: 300 }}>{event.description}</small>}</td>

                    <td>{event.category_name || 'Unassigned'}</td>

                    <td>{datePart(event.event_date) || '—'}{event.event_end_date && datePart(event.event_end_date) !== datePart(event.event_date) ? ` – ${datePart(event.event_end_date)}` : ''}</td>

                    <td>{displayTime(event.start_time, event.end_time)}</td>

                    <td>{event.location || '—'}</td>

                    <td><span className="badge">{event.is_active ? 'Published' : 'Unpublished'}</span></td>

                    <td><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

                      <button type="button" onClick={() => openEditForm(event)}>Edit</button>

                      <button type="button" disabled={statusBusy === event.id} onClick={() => void toggleStatus(event)}>

                        {event.is_active ? 'Unpublish' : 'Publish'}

                      </button>

                    </div></td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </div>

  );

}



function EventForm({ event, categories, onClose, onSaved }: {
  event: EventItem | null;
  categories: EventCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existingImages = (event?.images ?? []).map(item =>
    typeof item === 'string' ? item : item.image_url
  ).filter(Boolean);
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [eventDate, setEventDate] = useState(datePart(event?.event_date));
  const [eventEndDate, setEventEndDate] = useState(datePart(event?.event_end_date));
  const [startTime, setStartTime] = useState(timePart(event?.start_time));
  const [endTime, setEndTime] = useState(timePart(event?.end_time));
  const [location, setLocation] = useState(event?.location || '');
  const [categoryId, setCategoryId] = useState(event?.category_id ? String(event.category_id) : '');
  const [images, setImages] = useState<string[]>(
    existingImages.length ? existingImages : event?.image_url ? [event.image_url] : []
  );
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const selectedCategory = categories.find(c => c.id === Number(categoryId));

  function addFiles(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    if (images.length + pendingFiles.length + incoming.length > 10) {
      setFormError('Maximum 10 images per event');
      return;
    }
    if (incoming.some(file => !IMAGE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext)) || file.size > MAX_IMAGE_BYTES || file.size === 0)) {
      setFormError('Use JPG, JPEG, PNG, WebP, GIF, BMP, TIFF, HEIC, HEIF or AVIF images up to 10 MB each');
      return;
    }
    setFormError('');
    setPendingFiles(previous => [...previous, ...incoming]);
  }

  function moveImage(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    setImages(previous => {
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setFormError('Event title is required'); return; }
    if (!eventDate) { setFormError('Event date is required'); return; }
    if (eventEndDate && eventEndDate < eventDate) {
      setFormError('Event end date cannot be earlier than event date'); return;
    }
    if (!selectedCategory || !selectedCategory.is_active) {
      setFormError('Please select an active event category'); return;
    }
    if (startTime && endTime && endTime < startTime && (!eventEndDate || eventEndDate === eventDate)) {
      setFormError('End time cannot be earlier than start time for a single-day event'); return;
    }
    if (images.length + pendingFiles.length > 10) {
      setFormError('Maximum 10 images per event'); return;
    }

    try {
      setSaving(true);
      setFormError('');
      let allImages = [...images];
      if (pendingFiles.length) {
        const formData = new FormData();
        pendingFiles.forEach(file => formData.append('images', file));
        const uploaded = await apiRequest<{
          success: boolean;
          data: Array<{ image_url: string; public_id: string }>;
        }>('/admin/events/upload-images', {
          method: 'POST',
          body: formData,
        });
        allImages = [...allImages, ...uploaded.data.map(item => item.image_url)];
      }
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        image_url: allImages[0] || null,
        images: allImages,
        event_date: eventDate,
        event_end_date: eventEndDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        location: location.trim() || null,
        category_id: Number(categoryId),
      };
      await apiRequest(event ? `/admin/events/${event.id}` : '/admin/events', {
        method: event ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (err) {
      setFormError(messageOf(err, 'Failed to save event'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="section-header">
        <div><h2>{event ? 'Edit Event' : 'Add Event'}</h2>
          <p>{event ? 'Update temple event details' : 'Create and publish a temple event'}</p></div>
      </div>
      {formError && <div className="error-message" role="alert">{formError}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <label>Title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Temple Festival" required /></label>
          <label>Event Category
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
              <option value="">Select category</option>
              {categories.filter(c => c.is_active || c.id === event?.category_id).map(category => (
                <option key={category.id} value={category.id} disabled={!category.is_active}>
                  {category.name}{!category.is_active ? ' (Inactive)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>Event Date *<input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required /></label>
          <label>Event End Date (Optional)<input type="date" min={eventDate || undefined} value={eventEndDate} onChange={e => setEventEndDate(e.target.value)} /></label>
          <label>Start Time (Optional)<input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></label>
          <label>End Time (Optional)<input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></label>
          <label>Location<input value={location} onChange={e => setLocation(e.target.value)} placeholder="Temple Main Hall" /></label>
          <label style={{ gridColumn: '1 / -1' }}>Description<textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Event description" /></label>
        </div>
        <div style={{ marginTop: 18 }}>
          <label>Event Photos (maximum 10, JPG/JPEG/PNG/WebP/GIF/BMP/TIFF/HEIC/HEIF/AVIF, 10 MB each)
            <input type="file" accept={IMAGE_ACCEPT} multiple disabled={saving || images.length + pendingFiles.length >= 10}
              onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <p style={{ fontSize: 13, color: '#81776d' }}>
            {images.length + pendingFiles.length}/10 selected. The first saved photo is the cover. Use arrows to reorder saved photos.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            {images.map((url, index) => (
              <div key={`${url}-${index}`} style={{ width: 150, border: '1px solid #e8dccb', padding: 8, borderRadius: 8 }}>
                <img src={url} alt={`Event photo ${index + 1}`} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 5 }} />
                <small style={{ display: 'block' }}>{index === 0 ? 'Cover photo' : `Photo ${index + 1}`}</small>
                <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                  <button type="button" disabled={saving || index === 0} onClick={() => moveImage(index, -1)}>↑</button>
                  <button type="button" disabled={saving || index === images.length - 1} onClick={() => moveImage(index, 1)}>↓</button>
                  <button type="button" disabled={saving} onClick={() => setImages(previous => previous.filter((_, i) => i !== index))}>Remove</button>
                </div>
              </div>
            ))}
            {pendingFiles.map((file, index) => (
              <PendingImagePreview key={`${file.name}-${file.lastModified}-${index}`} file={file} index={index}
                disabled={saving} onRemove={() => setPendingFiles(previous => previous.filter((_, i) => i !== index))} />
            ))}
          </div>
        </div>
        <p style={{ fontSize: 13, marginTop: 12 }}>
          New events are published immediately and trigger your existing event notification workflow. You can unpublish an event from the events table.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Uploading / Saving...' : event ? 'Update Event' : 'Publish Event'}</button>
          <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function PendingImagePreview({ file, index, disabled, onRemove }: {
  file: File;
  index: number;
  disabled: boolean;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div style={{ width: 150, border: '1px dashed #c69a3a', padding: 8, borderRadius: 8 }}>
      {preview && <img src={preview} alt={`New photo ${index + 1}`} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 5 }} />}
      <small style={{ display: 'block' }}>New photo {index + 1}</small>
      <button type="button" disabled={disabled} onClick={onRemove}>Remove</button>
    </div>
  );
}
