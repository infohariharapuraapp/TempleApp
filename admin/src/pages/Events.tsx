import { useEffect, useState } from 'react';

import type { FormEvent } from 'react';

import { apiRequest } from '../lib/api';



type EventItem = {

  id: number;

  title: string;

  description?: string | null;

  image_url?: string | null;

  event_date?: string | null;

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

                    <td>{datePart(event.event_date) || '—'}</td>

                    <td>{timePart(event.start_time) || '—'} – {timePart(event.end_time) || '—'}</td>

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

  const [title, setTitle] = useState(event?.title || '');

  const [description, setDescription] = useState(event?.description || '');

  const [imageUrl, setImageUrl] = useState(event?.image_url || '');

  const [eventDate, setEventDate] = useState(datePart(event?.event_date));

  const [startTime, setStartTime] = useState(timePart(event?.start_time));

  const [endTime, setEndTime] = useState(timePart(event?.end_time));

  const [location, setLocation] = useState(event?.location || '');

  const [categoryId, setCategoryId] = useState(event?.category_id ? String(event.category_id) : '');

  const [saving, setSaving] = useState(false);

  const [formError, setFormError] = useState('');

  const selectedCategory = categories.find(c => c.id === Number(categoryId));



  async function handleSubmit(e: FormEvent) {

    e.preventDefault();

    if (!title.trim()) { setFormError('Event title is required'); return; }

    if (!eventDate) { setFormError('Event date is required'); return; }

    if (!selectedCategory || !selectedCategory.is_active) {

      setFormError('Please select an active event category'); return;

    }

    if (startTime && endTime && endTime < startTime) {

      setFormError('End time cannot be earlier than start time'); return;

    }

    try {

      setSaving(true);

      setFormError('');

      const payload = {

        title: title.trim(),

        description: description.trim() || null,

        image_url: imageUrl.trim() || null,

        event_date: eventDate,

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

      <div className="section-header"><div><h2>{event ? 'Edit Event' : 'Add Event'}</h2><p>{event ? 'Update temple event details' : 'Create and publish a temple event'}</p></div></div>

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

          <label>Event Date<input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required /></label>

          <label>Start Time<input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></label>

          <label>End Time<input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></label>

          <label>Location<input value={location} onChange={e => setLocation(e.target.value)} placeholder="Temple Main Hall" /></label>

          <label>Image URL<input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." /></label>

          <label style={{ gridColumn: '1 / -1' }}>Description<textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Event description" /></label>

        </div>

        <p style={{ fontSize: 13, marginTop: 12 }}>New events are published immediately and trigger your existing event notification workflow. You can unpublish an event from the events table.</p>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>

          <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving...' : event ? 'Update Event' : 'Publish Event'}</button>

          <button type="button" onClick={onClose} disabled={saving}>Cancel</button>

        </div>

      </form>

    </div>

  );

}
