import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

type Category = {
  id: number; name: string; description: string | null; icon: string | null;
  display_order: number; is_active: boolean; publication_count?: number;
};
type Publication = {
  id: number; category_id: number | null; category_name?: string | null;
  title: string; description: string | null; image_url: string | null;
  author: string | null; publication_date: string | null;
  document_url: string | null; is_active: boolean;
};
type ApiList<T> = { success: boolean; data: T[] };
const emptyCategory = (): Partial<Category> => ({ name: '', description: '', icon: '📚', display_order: 0, is_active: true });
const emptyPublication = (categoryId?: number): Partial<Publication> => ({
  category_id: categoryId ?? null, title: '', description: '', image_url: '',
  author: '', publication_date: '', document_url: '', is_active: true,
});
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Request failed';
const formatDate = (value: string | null) => value ? value.slice(0, 10) : '';

export default function Publications() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingPublication, setEditingPublication] = useState<Partial<Publication> | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [cat, pub] = await Promise.all([
        apiRequest<ApiList<Category>>('/publications/admin/categories'),
        apiRequest<ApiList<Publication>>('/publications/admin'),
      ]);
      setCategories(cat.data ?? []);
      setPublications(pub.data ?? []);
      setError('');
    } catch (err) { setError(errorText(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!editingCategory || busy) return;
    if (!editingCategory.name?.trim()) { setError('Category name is required.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const id = editingCategory.id;
      await apiRequest(id ? `/publications/admin/categories/${id}` : '/publications/admin/categories', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify({
          name: editingCategory.name.trim(),
          description: editingCategory.description?.trim() || null,
          icon: editingCategory.icon?.trim() || null,
          display_order: Number(editingCategory.display_order ?? 0),
          is_active: editingCategory.is_active !== false,
        }),
      });
      setEditingCategory(null); setNotice(id ? 'Category updated.' : 'Category created.');
      await load();
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }

  async function savePublication(event: React.FormEvent) {
    event.preventDefault();
    if (!editingPublication || busy) return;
    if (!editingPublication.title?.trim() || !editingPublication.category_id) {
      setError('Publication title and category are required.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const id = editingPublication.id;
      await apiRequest(id ? `/publications/admin/${id}` : '/publications/admin', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify({
          category_id: editingPublication.category_id,
          title: editingPublication.title.trim(),
          description: editingPublication.description?.trim() || null,
          image_url: editingPublication.image_url?.trim() || null,
          author: editingPublication.author?.trim() || null,
          publication_date: formatDate(editingPublication.publication_date ?? null) || null,
          document_url: editingPublication.document_url?.trim() || null,
          is_active: editingPublication.is_active !== false,
        }),
      });
      setEditingPublication(null); setNotice(id ? 'Publication updated.' : 'Publication created.');
      await load();
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }

  async function removeCategory(item: Category) {
    if (busy) return;
    if ((item.publication_count ?? publications.filter(p => p.category_id === item.id).length) > 0) {
      setError('Reassign or delete the publications in this category first.'); return;
    }
    if (!window.confirm(`Permanently delete category "${item.name}"?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest(`/publications/admin/categories/${item.id}`, { method: 'DELETE' });
      setNotice('Category deleted.'); await load();
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }

  async function removePublication(item: Publication) {
    if (busy || !window.confirm(`Permanently delete publication "${item.title}"?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest(`/publications/admin/${item.id}`, { method: 'DELETE' });
      setNotice('Publication deleted.'); await load();
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }

  const visible = publications.filter(item =>
    (filter === 'all' || String(item.category_id) === filter) &&
    `${item.title} ${item.author ?? ''} ${item.category_name ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="publications-page">
      <div className="page-header">

        <div className="actions">
          <button type="button" disabled={busy} onClick={() => { setEditingCategory(emptyCategory()); setEditingPublication(null); setError(''); }}>+ Add Category</button>
          <button type="button" className="primary" disabled={busy || !categories.some(c => c.is_active)} onClick={() => { setEditingPublication(emptyPublication(categories.find(c => c.is_active)?.id)); setEditingCategory(null); setError(''); }}>+ Add Publication</button>
        </div>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="panel" role="status">{notice}</div>}
      {loading && <p>Loading publications...</p>}

      {editingCategory && (
        <form className="form-card" onSubmit={saveCategory}>
          <h3>{editingCategory.id ? 'Edit Category' : 'Create Category'}</h3>
          <div className="grid2">
            <label>Category Name<input required maxLength={150} value={editingCategory.name ?? ''} onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })} placeholder="Magazines" /></label>
            <label>Icon / Emoji<input value={editingCategory.icon ?? ''} onChange={e => setEditingCategory({ ...editingCategory, icon: e.target.value })} placeholder="📰" /></label>
          </div>
          <label>Description<textarea value={editingCategory.description ?? ''} onChange={e => setEditingCategory({ ...editingCategory, description: e.target.value })} /></label>
          <label>Display Order<input type="number" step="1" value={editingCategory.display_order ?? 0} onChange={e => setEditingCategory({ ...editingCategory, display_order: Number(e.target.value) })} /></label>
          <label><input type="checkbox" checked={editingCategory.is_active !== false} onChange={e => setEditingCategory({ ...editingCategory, is_active: e.target.checked })} /> Active</label>
          <div className="actions"><button type="button" disabled={busy} onClick={() => setEditingCategory(null)}>Cancel</button><button className="primary" disabled={busy} type="submit">{busy ? 'Saving...' : 'Save Category'}</button></div>
        </form>
      )}

      {editingPublication && (
        <form className="form-card" onSubmit={savePublication}>
          <h3>{editingPublication.id ? 'Edit Publication' : 'Add Publication'}</h3>
          <div className="grid2">
            <label>Category<select required value={editingPublication.category_id ?? ''} onChange={e => setEditingPublication({ ...editingPublication, category_id: Number(e.target.value) || null })}>
              <option value="">Select category</option>
              {categories.filter(c => c.is_active || c.id === editingPublication.category_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
            <label>Publication Title<input required value={editingPublication.title ?? ''} onChange={e => setEditingPublication({ ...editingPublication, title: e.target.value })} /></label>
            <label>Author / Publisher<input value={editingPublication.author ?? ''} onChange={e => setEditingPublication({ ...editingPublication, author: e.target.value })} /></label>
            <label>Publication Date<input type="date" value={formatDate(editingPublication.publication_date ?? null)} onChange={e => setEditingPublication({ ...editingPublication, publication_date: e.target.value })} /></label>
          </div>
          <label>Description<textarea rows={4} value={editingPublication.description ?? ''} onChange={e => setEditingPublication({ ...editingPublication, description: e.target.value })} /></label>
          <label>Cover Image URL<input type="url" value={editingPublication.image_url ?? ''} placeholder="https://example.com/cover.jpg" onChange={e => setEditingPublication({ ...editingPublication, image_url: e.target.value })} /></label>
          {editingPublication.image_url && <img src={editingPublication.image_url} alt="Cover preview" style={{ width: 110, height: 145, objectFit: 'contain' }} />}
          <label>PDF / Document URL<input type="url" value={editingPublication.document_url ?? ''} placeholder="https://example.com/book.pdf" onChange={e => setEditingPublication({ ...editingPublication, document_url: e.target.value })} /></label>
          <label><input type="checkbox" checked={editingPublication.is_active !== false} onChange={e => setEditingPublication({ ...editingPublication, is_active: e.target.checked })} /> Published / Active</label>
          <div className="actions"><button type="button" disabled={busy} onClick={() => setEditingPublication(null)}>Cancel</button><button className="primary" disabled={busy} type="submit">{busy ? 'Saving...' : 'Save Publication'}</button></div>
        </form>
      )}

      <div className="panel">
        <h3>Publication Categories ({categories.length})</h3>
        {categories.length === 0 && <p>No categories yet. Create your first category.</p>}
        <div className="table-wrap"><table><thead><tr><th>Category</th><th>Order</th><th>Publications</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {categories.map(c => <tr key={c.id}>
            <td><strong>{c.icon || '📚'} {c.name}</strong><div><small>{c.description}</small></div></td>
            <td>{c.display_order}</td><td>{c.publication_count ?? publications.filter(p => p.category_id === c.id).length}</td>
            <td><span className="badge">{c.is_active ? 'Active' : 'Inactive'}</span></td>
            <td><div className="actions"><button type="button" disabled={busy} onClick={() => { setEditingCategory({ ...c }); setEditingPublication(null); setError(''); }}>Edit</button><button type="button" disabled={busy} onClick={() => { setEditingPublication(emptyPublication(c.id)); setEditingCategory(null); setError(''); }}>+ Publication</button><button type="button" className="danger" disabled={busy} onClick={() => void removeCategory(c)}>Delete</button></div></td>
          </tr>)}
        </tbody></table></div>
      </div>

      <div className="panel">
        <h3>Publications ({visible.length})</h3>
        <div className="actions">
          <select aria-label="Filter by category" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All Categories</option>{categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}</select>
          <input aria-label="Search publications" placeholder="Search title, author or category" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="table-wrap"><table><thead><tr><th>Cover</th><th>Title</th><th>Category</th><th>Date</th><th>PDF</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {visible.map(p => <tr key={p.id}>
            <td>{p.image_url ? <img className="thumb" src={p.image_url} alt={p.title} /> : '—'}</td>
            <td><strong>{p.title}</strong><div><small>{p.author}</small></div></td>
            <td>{p.category_name || 'Unassigned'}</td><td>{formatDate(p.publication_date) || '—'}</td>
            <td>{p.document_url ? <a href={p.document_url} target="_blank" rel="noopener noreferrer">View</a> : '—'}</td>
            <td><span className="badge">{p.is_active ? 'Active' : 'Inactive'}</span></td>
            <td><div className="actions"><button type="button" disabled={busy} onClick={() => { setEditingPublication({ ...p }); setEditingCategory(null); setError(''); }}>Edit</button><button type="button" className="danger" disabled={busy} onClick={() => void removePublication(p)}>Delete</button></div></td>
          </tr>)}
        </tbody></table></div>
        {visible.length === 0 && <p>No publications found.</p>}
      </div>
    </div>
    </div>
  );
}
