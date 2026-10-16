import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

type Category = { id: number; name: string; description: string | null; icon: string; display_order: number; is_active: boolean };
type Place = { id: number; category_id: number; category_name?: string; name: string; description: string | null; address: string | null; phone: string | null; google_maps_url: string | null; image_url: string | null; display_order: number; is_active: boolean };
type Response<T> = { success: boolean; data: T };

const blankCategory = (): Partial<Category> => ({ name: '', description: '', icon: '📍', display_order: 0, is_active: true });
const blankPlace = (category_id: number): Partial<Place> => ({ category_id, name: '', description: '', address: '', phone: '', google_maps_url: '', image_url: '', display_order: 0, is_active: true });

export default function NearbyPlaces() {
  const [tab, setTab] = useState<'categories' | 'places'>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingPlace, setEditingPlace] = useState<Partial<Place> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  async function load() {
    try {
      const [c, p] = await Promise.all([
        apiRequest<Response<Category[]>>('/admin/nearby/categories'),
        apiRequest<Response<Place[]>>('/admin/nearby/places'),
      ]);
      setCategories(c.data || []);
      setPlaces(p.data || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nearby places');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const validOrder = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) >= 0;
  const validMapsUrl = (value: string) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && ['google.com', 'www.google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl'].includes(url.hostname.toLowerCase());
    } catch { return false; }
  };

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCategory || busy) return;
    if (!editingCategory.name?.trim() || !validOrder(editingCategory.display_order)) {
      setError('Enter a category name and valid display order.'); return;
    }
    setBusy(true); setError('');
    try {
      await apiRequest(editingCategory.id ? `/admin/nearby/categories/${editingCategory.id}` : '/admin/nearby/categories', {
        method: editingCategory.id ? 'PUT' : 'POST',
        body: JSON.stringify({ name: editingCategory.name.trim(), description: editingCategory.description || null, icon: editingCategory.icon || '📍', display_order: Number(editingCategory.display_order), is_active: editingCategory.is_active !== false }),
      });
      setEditingCategory(null);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save category'); }
    finally { setBusy(false); }
  }

  async function savePlace(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlace || busy) return;
    if (!editingPlace.name?.trim() || !categories.some(c => c.id === editingPlace.category_id) || !validOrder(editingPlace.display_order)) {
      setError('Enter a place name, valid category and display order.'); return;
    }
    if (!validMapsUrl(editingPlace.google_maps_url?.trim() || '')) {
      setError('Enter a valid HTTPS Google Maps URL.'); return;
    }
    setBusy(true); setError('');
    try {
      await apiRequest(editingPlace.id ? `/admin/nearby/places/${editingPlace.id}` : '/admin/nearby/places', {
        method: editingPlace.id ? 'PUT' : 'POST',
        body: JSON.stringify({ category_id: Number(editingPlace.category_id), name: editingPlace.name.trim(), description: editingPlace.description || null, address: editingPlace.address || null, phone: editingPlace.phone || null, google_maps_url: editingPlace.google_maps_url || null, image_url: editingPlace.image_url || null, display_order: Number(editingPlace.display_order), is_active: editingPlace.is_active !== false }),
      });
      setEditingPlace(null);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save place'); }
    finally { setBusy(false); }
  }

  async function toggleCategory(item: Category) {
    if (busy) return;
    if (item.is_active && !window.confirm(`Deactivate category "${item.name}"? Its places will also be hidden from the app.`)) return;
    setBusy(true); setError('');
    try {
      await apiRequest(`/admin/nearby/categories/${item.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !item.is_active }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update category'); }
    finally { setBusy(false); }
  }

  async function togglePlace(item: Place) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await apiRequest(`/admin/nearby/places/${item.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !item.is_active }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update place'); }
    finally { setBusy(false); }
  }

  const shownPlaces = filter === 'all' ? places : places.filter(p => p.category_id === Number(filter));

  return (
    <main className="content">
      <div className="page-head"><div><h2>Nearby Places</h2><p>Manage nearby categories, hospitals, transport and Google Maps directions</p></div></div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="actions" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        <button type="button" className={tab === 'categories' ? 'primary' : ''} onClick={() => { setTab('categories'); setEditingPlace(null); setError(''); }}>Categories ({categories.length})</button>
        <button type="button" className={tab === 'places' ? 'primary' : ''} onClick={() => { setTab('places'); setEditingCategory(null); setError(''); }}>Places ({places.length})</button>
      </div>
      {loading && <div className="panel">Loading nearby places…</div>}
      {!loading && tab === 'categories' && <>
        <div className="actions" style={{ marginBottom: 16 }}><button type="button" className="primary" disabled={busy} onClick={() => { setEditingCategory(blankCategory()); setError(''); }}>+ Add Category</button></div>
        {editingCategory && <form className="form-card" onSubmit={saveCategory}>
          <h3>{editingCategory.id ? 'Edit Category' : 'Create Category'}</h3>
          <div className="grid2">
            <label>Category Name<input required maxLength={150} value={editingCategory.name ?? ''} onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })} placeholder="Hospitals" /></label>
            <label>Icon (Emoji)<input maxLength={50} value={editingCategory.icon ?? ''} onChange={e => setEditingCategory({ ...editingCategory, icon: e.target.value })} placeholder="🏥" /></label>
          </div>
          <label>Description<textarea value={editingCategory.description ?? ''} onChange={e => setEditingCategory({ ...editingCategory, description: e.target.value })} /></label>
          <label>Display Order<input type="number" min="0" step="1" value={editingCategory.display_order ?? 0} onChange={e => setEditingCategory({ ...editingCategory, display_order: Number(e.target.value) })} /></label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={editingCategory.is_active !== false} onChange={e => setEditingCategory({ ...editingCategory, is_active: e.target.checked })} />Active</label>
          <div className="actions"><button type="button" disabled={busy} onClick={() => setEditingCategory(null)}>Cancel</button><button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Category'}</button></div>
        </form>}
        <div className="table-wrap"><table><thead><tr><th>Icon</th><th>Category</th><th>Places</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {categories.map(c => <tr key={c.id}><td>{c.icon}</td><td><strong>{c.name}</strong><div><small>{c.description}</small></div></td><td>{places.filter(p => p.category_id === c.id).length}</td><td>{c.display_order}</td><td><span className="badge">{c.is_active ? 'Active' : 'Inactive'}</span></td><td><div className="actions" style={{ flexWrap: 'wrap' }}><button type="button" disabled={busy} onClick={() => { setEditingCategory({ ...c }); setError(''); }}>Edit</button><button type="button" disabled={busy} onClick={() => void toggleCategory(c)}>{c.is_active ? 'Deactivate' : 'Activate'}</button><button type="button" onClick={() => { setFilter(String(c.id)); setTab('places'); setEditingPlace(null); }}>View Places</button></div></td></tr>)}
          {categories.length === 0 && <tr><td colSpan={6}>No categories created yet.</td></tr>}
        </tbody></table></div>
      </>}
      {!loading && tab === 'places' && <>
        <div className="actions" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <button type="button" className="primary" disabled={busy || categories.length === 0} onClick={() => { setEditingPlace(blankPlace(filter !== 'all' ? Number(filter) : (categories.find(c => c.is_active)?.id ?? categories[0].id))); setError(''); }}>+ Add Place</button>
          <label>Category <select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All Categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div>
        {categories.length === 0 && <div className="panel">Create a category before adding places.</div>}
        {editingPlace && <form className="form-card" onSubmit={savePlace}>
          <h3>{editingPlace.id ? 'Edit Place' : 'Add Place'}</h3>
          <div className="grid2">
            <label>Category<select required value={editingPlace.category_id ?? ''} onChange={e => setEditingPlace({ ...editingPlace, category_id: Number(e.target.value) })}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Place Name<input required maxLength={200} value={editingPlace.name ?? ''} onChange={e => setEditingPlace({ ...editingPlace, name: e.target.value })} placeholder="Government Hospital" /></label>
          </div>
          <label>Description<textarea value={editingPlace.description ?? ''} onChange={e => setEditingPlace({ ...editingPlace, description: e.target.value })} /></label>
          <label>Address<textarea value={editingPlace.address ?? ''} onChange={e => setEditingPlace({ ...editingPlace, address: e.target.value })} /></label>
          <div className="grid2"><label>Phone<input type="tel" maxLength={30} value={editingPlace.phone ?? ''} onChange={e => setEditingPlace({ ...editingPlace, phone: e.target.value })} /></label><label>Display Order<input type="number" min="0" step="1" value={editingPlace.display_order ?? 0} onChange={e => setEditingPlace({ ...editingPlace, display_order: Number(e.target.value) })} /></label></div>
          <label>Google Maps URL<input type="url" value={editingPlace.google_maps_url ?? ''} onChange={e => setEditingPlace({ ...editingPlace, google_maps_url: e.target.value })} placeholder="https://www.google.com/maps/place/..." /></label>
          <label>Image URL (optional)<input type="url" value={editingPlace.image_url ?? ''} onChange={e => setEditingPlace({ ...editingPlace, image_url: e.target.value })} placeholder="https://example.com/hospital.jpg" /></label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={editingPlace.is_active !== false} onChange={e => setEditingPlace({ ...editingPlace, is_active: e.target.checked })} />Active</label>
          <div className="actions"><button type="button" disabled={busy} onClick={() => setEditingPlace(null)}>Cancel</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save Place'}</button></div>
        </form>}
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Category</th><th>Address / Phone</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {shownPlaces.map(p => <tr key={p.id}><td><strong>{p.name}</strong><div><small>{p.description}</small></div></td><td>{p.category_name ?? categories.find(c => c.id === p.category_id)?.name}</td><td><div>{p.address}</div><small>{p.phone}</small></td><td>{p.display_order}</td><td><span className="badge">{p.is_active ? 'Active' : 'Inactive'}</span></td><td><div className="actions" style={{ flexWrap: 'wrap' }}><button type="button" disabled={busy} onClick={() => { setEditingPlace({ ...p }); setError(''); }}>Edit</button><button type="button" disabled={busy} onClick={() => void togglePlace(p)}>{p.is_active ? 'Deactivate' : 'Activate'}</button>{p.google_maps_url && validMapsUrl(p.google_maps_url) && <a href={p.google_maps_url} target="_blank" rel="noopener noreferrer">Open Map</a>}</div></td></tr>)}
          {shownPlaces.length === 0 && <tr><td colSpan={6}>No places found.</td></tr>}
        </tbody></table></div>
      </>}
    </main>
  );
}
