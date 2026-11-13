
import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import './NearbyPlaces.css';

type Category = {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  display_order: number;
  is_active: boolean;
};

type Place = {
  id: number;
  category_id: number;
  category_name?: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  google_maps_url: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
};

type PlaceImage = {
  id: number;
  place_id: number;
  image_url: string;
  display_order: number;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type Tab = 'categories' | 'places';

const newCategory = (): Partial<Category> => ({
  name: '',
  description: '',
  icon: '📍',
  display_order: 0,
  is_active: true,
});

const newPlace = (categoryId: number): Partial<Place> => ({
  category_id: categoryId,
  name: '',
  description: '',
  address: '',
  phone: '',
  google_maps_url: '',
  image_url: '',
  display_order: 0,
  is_active: true,
});

function validHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validMapsUrl(value: string): boolean {
  if (!value) return true;

  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      [
        'google.com',
        'www.google.com',
        'maps.google.com',
        'maps.app.goo.gl',
        'goo.gl',
      ].includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function getError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export default function NearbyPlaces() {
  const [tab, setTab] = useState<Tab>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingPlace, setEditingPlace] = useState<Partial<Place> | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const [images, setImages] = useState<PlaceImage[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imageOrder, setImageOrder] = useState(0);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const notify = (message: string) => {
    setError('');
    setSuccess(message);
  };

  const fail = (error: unknown) => {
    setSuccess('');
    setError(getError(error));
  };

  const load = useCallback(async () => {
    try {
      const [categoryResponse, placeResponse] = await Promise.all([
        apiRequest<ApiResponse<Category[]>>('/admin/nearby/categories'),
        apiRequest<ApiResponse<Place[]>>('/admin/nearby/places'),
      ]);

      setCategories(categoryResponse.data || []);
      setPlaces(placeResponse.data || []);
    } catch (error) {
      fail(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadImages = async (placeId: number) => {
    setImagesLoading(true);

    try {
      const response = await apiRequest<ApiResponse<PlaceImage[]>>(
        `/admin/nearby/places/${placeId}/images`
      );

      setImages(response.data || []);
    } catch (error) {
      fail(error);
    } finally {
      setImagesLoading(false);
    }
  };

  const openGallery = async (place: Place) => {
    setSelectedPlace(place);
    setImages([]);
    setSelectedFiles([]);
    setImageUrl('');
    setError('');
    setSuccess('');
    await loadImages(place.id);
  };

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingCategory || busy) return;

    if (!editingCategory.name?.trim()) {
      setError('Category name is required');
      return;
    }

    setBusy(true);

    try {
      const id = editingCategory.id;

      await apiRequest(
        id ? `/admin/nearby/categories/${id}` : '/admin/nearby/categories',
        {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify({
            name: editingCategory.name.trim(),
            description: editingCategory.description ?? null,
            icon: editingCategory.icon || '📍',
            display_order: Number(editingCategory.display_order ?? 0),
            is_active: editingCategory.is_active !== false,
          }),
        }
      );

      setEditingCategory(null);
      await load();
      notify(id ? 'Category updated successfully' : 'Category created successfully');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const savePlace = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingPlace || busy) return;

    if (!editingPlace.name?.trim() || !editingPlace.category_id) {
      setError('Place name and category are required');
      return;
    }

    if (!validMapsUrl(editingPlace.google_maps_url?.trim() || '')) {
      setError('Enter a valid HTTPS Google Maps link');
      return;
    }

    if (
      editingPlace.image_url?.trim() &&
      !validHttpsUrl(editingPlace.image_url.trim())
    ) {
      setError('Enter a valid HTTPS cover image URL');
      return;
    }

    setBusy(true);

    try {
      const id = editingPlace.id;

      await apiRequest(
        id ? `/admin/nearby/places/${id}` : '/admin/nearby/places',
        {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify({
            category_id: Number(editingPlace.category_id),
            name: editingPlace.name.trim(),
            description: editingPlace.description ?? null,
            address: editingPlace.address ?? null,
            phone: editingPlace.phone ?? null,
            google_maps_url: editingPlace.google_maps_url || null,
            image_url: editingPlace.image_url || null,
            display_order: Number(editingPlace.display_order ?? 0),
            is_active: editingPlace.is_active !== false,
          }),
        }
      );

      setEditingPlace(null);
      await load();
      notify(id ? 'Place updated successfully' : 'Place created successfully');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const toggleCategory = async (category: Category) => {
    if (busy) return;

    if (
      category.is_active &&
      !window.confirm(`Deactivate "${category.name}"? Its places will be hidden.`)
    ) return;

    setBusy(true);

    try {
      await apiRequest(`/admin/nearby/categories/${category.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !category.is_active }),
      });

      await load();
      notify('Category status updated');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const togglePlace = async (place: Place) => {
    if (busy) return;

    setBusy(true);

    try {
      await apiRequest(`/admin/nearby/places/${place.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !place.is_active }),
      });

      await load();
      notify('Place status updated');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    if (busy) return;

    const count = places.filter(p => p.category_id === category.id).length;

    if (count > 0) {
      setError(`"${category.name}" contains ${count} places. Delete or move them first.`);
      return;
    }

    if (!window.confirm(`Permanently delete category "${category.name}"?`)) return;

    setBusy(true);

    try {
      await apiRequest(`/admin/nearby/categories/${category.id}`, {
        method: 'DELETE',
      });

      await load();
      notify('Category permanently deleted');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const deletePlace = async (place: Place) => {
    if (busy) return;

    if (
      !window.confirm(
        `Permanently delete "${place.name}" and its gallery records? This cannot be undone.`
      )
    ) return;

    setBusy(true);

    try {
      await apiRequest(`/admin/nearby/places/${place.id}`, {
        method: 'DELETE',
      });

      if (selectedPlace?.id === place.id) {
        setSelectedPlace(null);
      }

      await load();
      notify('Place permanently deleted');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const addImageUrl = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPlace || busy) return;

    if (!validHttpsUrl(imageUrl.trim())) {
      setError('Enter a valid HTTPS image URL');
      return;
    }

    setBusy(true);

    try {
      await apiRequest(
        `/admin/nearby/places/${selectedPlace.id}/images`,
        {
          method: 'POST',
          body: JSON.stringify({
            image_url: imageUrl.trim(),
            display_order: imageOrder,
          }),
        }
      );

      setImageUrl('');
      setImageOrder(0);
      await loadImages(selectedPlace.id);
      notify('Image URL added');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const uploadImages = async () => {
    if (!selectedPlace || !selectedFiles.length || busy) return;

    if (selectedFiles.length > 8) {
      setError('Maximum 8 images per upload');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (
      selectedFiles.some(
        file => !allowed.includes(file.type) || file.size > 5 * 1024 * 1024
      )
    ) {
      setError('Use JPG, PNG or WebP images, maximum 5 MB each');
      return;
    }

    setBusy(true);

    try {
      const formData = new FormData();

      selectedFiles.forEach(file => {
        formData.append('images', file);
      });

      await apiRequest(
        `/admin/nearby/places/${selectedPlace.id}/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      setSelectedFiles([]);
      await loadImages(selectedPlace.id);
      notify('Images uploaded successfully');
    } catch (error) {
      fail(error);
      await loadImages(selectedPlace.id);
    } finally {
      setBusy(false);
    }
  };

  const deleteImage = async (image: PlaceImage) => {
    if (!selectedPlace || busy) return;

    if (!window.confirm('Remove this image from the gallery?')) return;

    setBusy(true);

    try {
      await apiRequest(
        `/admin/nearby/places/${selectedPlace.id}/images/${image.id}`,
        { method: 'DELETE' }
      );

      await loadImages(selectedPlace.id);
      notify('Gallery image removed');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const changeImageOrder = async (image: PlaceImage, order: number) => {
    if (!selectedPlace || busy || order < 0) return;

    setBusy(true);

    try {
      await apiRequest(
        `/admin/nearby/places/${selectedPlace.id}/images/${image.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ display_order: order }),
        }
      );

      await loadImages(selectedPlace.id);
      notify('Image order updated');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const filteredPlaces = places.filter(place => {
    const categoryMatch =
      filter === 'all' || place.category_id === Number(filter);

    const query = search.toLowerCase();

    const searchMatch =
      place.name.toLowerCase().includes(query) ||
      (place.address || '').toLowerCase().includes(query) ||
      (place.category_name || '').toLowerCase().includes(query);

    return categoryMatch && searchMatch;
  });

  const getCover = (place: Place) => place.image_url || '';

  return (
    <main className="content nearby-admin">
      <header className="nearby-hero">
        <div>
          <span className="nearby-eyebrow">DIVYAKSHETRA HARIHARAPURA</span>
          <h2>Nearby Places</h2>
          <p>Manage destinations, services, categories and beautiful photo galleries.</p>
        </div>
        <div className="nearby-hero-icon">🗺️</div>
      </header>

      <div className="nearby-stats">
        <div className="nearby-stat">
          <span>Categories</span>
          <strong>{categories.length}</strong>
        </div>
        <div className="nearby-stat">
          <span>Total Places</span>
          <strong>{places.length}</strong>
        </div>
        <div className="nearby-stat">
          <span>Active Places</span>
          <strong>{places.filter(p => p.is_active).length}</strong>
        </div>
      </div>

      {error && (
        <div className="nearby-message nearby-error" role="alert">
          {error}
          <button type="button" onClick={() => setError('')}>×</button>
        </div>
      )}

      {success && (
        <div className="nearby-message nearby-success" role="status">
          {success}
          <button type="button" onClick={() => setSuccess('')}>×</button>
        </div>
      )}

      <div className="nearby-toolbar">
        <div className="nearby-tabs">
          <button
            className={tab === 'categories' ? 'active' : ''}
            onClick={() => setTab('categories')}
          >
            Categories
          </button>
          <button
            className={tab === 'places' ? 'active' : ''}
            onClick={() => setTab('places')}
          >
            Places
          </button>
        </div>

        <button
          type="button"
          className="nearby-btn nearby-primary"
          disabled={busy || (tab === 'places' && categories.length === 0)}
          onClick={() => {
            setError('');
            setSuccess('');

            if (tab === 'categories') {
              setEditingCategory(newCategory());
              setEditingPlace(null);
            } else {
              setEditingPlace(
                newPlace(
                  filter !== 'all'
                    ? Number(filter)
                    : (categories.find(c => c.is_active)?.id || categories[0].id)
                )
              );
              setEditingCategory(null);
            }
          }}
        >
          + Add {tab === 'categories' ? 'Category' : 'Place'}
        </button>
      </div>

      {loading ? (
        <div className="nearby-empty">Loading nearby places...</div>
      ) : (
        <>
          {tab === 'categories' && (
            <>
              {editingCategory && (
                <form className="nearby-editor" onSubmit={saveCategory}>
                  <div className="nearby-editor-head">
                    <h3>{editingCategory.id ? 'Edit Category' : 'New Category'}</h3>
                    <button type="button" onClick={() => setEditingCategory(null)}>×</button>
                  </div>

                  <div className="nearby-fields">
                    <label>
                      Category Name
                      <input
                        required
                        maxLength={150}
                        value={editingCategory.name || ''}
                        onChange={e => setEditingCategory({
                          ...editingCategory, name: e.target.value
                        })}
                      />
                    </label>

                    <label>
                      Emoji Icon
                      <input
                        value={editingCategory.icon || ''}
                        onChange={e => setEditingCategory({
                          ...editingCategory, icon: e.target.value
                        })}
                      />
                    </label>

                    <label className="nearby-wide">
                      Description
                      <textarea
                        rows={3}
                        value={editingCategory.description || ''}
                        onChange={e => setEditingCategory({
                          ...editingCategory, description: e.target.value
                        })}
                      />
                    </label>

                    <label>
                      Display Order
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editingCategory.display_order ?? 0}
                        onChange={e => setEditingCategory({
                          ...editingCategory, display_order: Number(e.target.value)
                        })}
                      />
                    </label>
                  </div>

                  <label className="nearby-check">
                    <input
                      type="checkbox"
                      checked={editingCategory.is_active !== false}
                      onChange={e => setEditingCategory({
                        ...editingCategory, is_active: e.target.checked
                      })}
                    />
                    Active
                  </label>

                  <div className="nearby-actions">
                    <button type="button" className="nearby-btn" onClick={() => setEditingCategory(null)}>
                      Cancel
                    </button>
                    <button type="submit" className="nearby-btn nearby-primary" disabled={busy}>
                      {busy ? 'Saving...' : 'Save Category'}
                    </button>
                  </div>
                </form>
              )}

              <div className="nearby-card-grid">
                {categories.map(category => {
                  const count = places.filter(
                    p => p.category_id === category.id
                  ).length;

                  return (
                    <article className="nearby-category-card" key={category.id}>
                      <div className="nearby-category-icon">{category.icon || '📍'}</div>
                      <span className={`nearby-status ${category.is_active ? 'on' : 'off'}`}>
                        {category.is_active ? 'Active' : 'Inactive'}
                      </span>

                      <h3>{category.name}</h3>
                      <p>{category.description || 'Explore places in this category.'}</p>

                      <div className="nearby-card-meta">
                        <span>{count} Places</span>
                        <span>Order {category.display_order}</span>
                      </div>

                      <div className="nearby-actions">
                        <button
                          className="nearby-btn"
                          disabled={busy}
                          onClick={() => {
                            setEditingCategory({ ...category });
                            setError('');
                          }}
                        >
                          Edit
                        </button>

                        <button
                          className="nearby-btn"
                          disabled={busy}
                          onClick={() => void toggleCategory(category)}
                        >
                          {category.is_active ? 'Deactivate' : 'Activate'}
                        </button>

                        <button
                          className="nearby-btn nearby-danger"
                          disabled={busy}
                          onClick={() => void deleteCategory(category)}
                        >
                          Delete
                        </button>

                        <button
                          className="nearby-btn nearby-view"
                          onClick={() => {
                            setFilter(String(category.id));
                            setSearch('');
                            setTab('places');
                          }}
                        >
                          View Places
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {categories.length === 0 && (
                <div className="nearby-empty">No categories yet. Create your first category.</div>
              )}
            </>
          )}

          {tab === 'places' && (
            <>
              <div className="nearby-filterbar">
                <input
                  type="search"
                  placeholder="Search places or locations..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />

                <select
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {editingPlace && (
                <form className="nearby-editor" onSubmit={savePlace}>
                  <div className="nearby-editor-head">
                    <h3>{editingPlace.id ? 'Edit Place' : 'Add New Place'}</h3>
                    <button type="button" onClick={() => setEditingPlace(null)}>×</button>
                  </div>

                  <div className="nearby-fields">
                    <label>
                      Category
                      <select
                        required
                        value={editingPlace.category_id || ''}
                        onChange={e => setEditingPlace({
                          ...editingPlace, category_id: Number(e.target.value)
                        })}
                      >
                        {categories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Place Name
                      <input
                        required
                        maxLength={200}
                        value={editingPlace.name || ''}
                        onChange={e => setEditingPlace({
                          ...editingPlace, name: e.target.value
                        })}
                      />
                    </label>

                    <label className="nearby-wide">
                      Description
                      <textarea
                        rows={4}
                        value={editingPlace.description || ''}
                        onChange={e => setEditingPlace({
                          ...editingPlace, description: e.target.value
                        })}
                      />
                    </label>

                    <label className="nearby-wide">
                      Address
                      <textarea
                        rows={2}
                        value={editingPlace.address || ''}
                        onChange={e => setEditingPlace({
                          ...editingPlace, address: e.target.value
                        })}
                      />
                    </label>

                    <label>
                      Phone
                      <input
                        type="tel"
                        value={editingPlace.phone || ''}
                        onChange={e => setEditingPlace({
                          ...editingPlace, phone: e.target.value
                        })}
                      />
                    </label>

                    <label>
                      Display Order
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editingPlace.display_order ?? 0}
                        onChange={e => setEditingPlace({
                          ...editingPlace, display_order: Number(e.target.value)
                        })}
                      />
                    </label>

                    <label className="nearby-wide">
                      Google Maps URL
                      <input
                        type="url"
                        placeholder="https://www.google.com/maps/..."
                        value={editingPlace.google_maps_url || ''}
                        onChange={e => setEditingPlace({
                          ...editingPlace, google_maps_url: e.target.value
                        })}
                      />
                    </label>

                    <label className="nearby-wide">
                      Cover Image URL (Existing Field)
                      <input
                        type="url"
                        placeholder="https://..."
                        value={editingPlace.image_url || ''}
                        onChange={e => setEditingPlace({
                          ...editingPlace, image_url: e.target.value
                        })}
                      />
                    </label>
                  </div>

                  {editingPlace.image_url && (
                    <img
                      className="nearby-cover-preview"
                      src={editingPlace.image_url}
                      alt="Cover preview"
                    />
                  )}

                  <label className="nearby-check">
                    <input
                      type="checkbox"
                      checked={editingPlace.is_active !== false}
                      onChange={e => setEditingPlace({
                        ...editingPlace, is_active: e.target.checked
                      })}
                    />
                    Active
                  </label>

                  <div className="nearby-actions">
                    <button type="button" className="nearby-btn" onClick={() => setEditingPlace(null)}>
                      Cancel
                    </button>
                    <button type="submit" className="nearby-btn nearby-primary" disabled={busy}>
                      {busy ? 'Saving...' : 'Save Place'}
                    </button>
                  </div>
                </form>
              )}

              <div className="nearby-card-grid">
                {filteredPlaces.map(place => (
                  <article className="nearby-place-card" key={place.id}>
                    <div className="nearby-place-cover">
                      {getCover(place) ? (
                        <img
                          src={getCover(place)}
                          alt={place.name}
                          loading="lazy"
                        />
                      ) : (
                        <div className="nearby-no-image">🏞️</div>
                      )}

                      <span className={`nearby-status ${place.is_active ? 'on' : 'off'}`}>
                        {place.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="nearby-place-body">
                      <span className="nearby-place-category">
                        {place.category_name ||
                          categories.find(c => c.id === place.category_id)?.name}
                      </span>

                      <h3>{place.name}</h3>
                      <p className="nearby-place-description">
                        {place.description || 'No description provided.'}
                      </p>

                      {place.address && (
                        <div className="nearby-place-info">
                          📍 {place.address}
                        </div>
                      )}

                      {place.phone && (
                        <div className="nearby-place-info">
                          📞 {place.phone}
                        </div>
                      )}

                      <div className="nearby-actions">
                        <button
                          className="nearby-btn nearby-view"
                          onClick={() => void openGallery(place)}
                        >
                          📷 Gallery
                        </button>

                        <button
                          className="nearby-btn"
                          disabled={busy}
                          onClick={() => {
                            setEditingPlace({ ...place });
                            setError('');
                          }}
                        >
                          Edit
                        </button>

                        <button
                          className="nearby-btn"
                          disabled={busy}
                          onClick={() => void togglePlace(place)}
                        >
                          {place.is_active ? 'Deactivate' : 'Activate'}
                        </button>

                        <button
                          className="nearby-btn nearby-danger"
                          disabled={busy}
                          onClick={() => void deletePlace(place)}
                        >
                          Delete
                        </button>
                      </div>

                      {place.google_maps_url && validMapsUrl(place.google_maps_url) && (
                        <a
                          className="nearby-map-link"
                          href={place.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open Google Maps ↗
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              {filteredPlaces.length === 0 && (
                <div className="nearby-empty">No matching places found.</div>
              )}
            </>
          )}
        </>
      )}

      {selectedPlace && (
        <div
          className="nearby-modal-overlay"
          onClick={() => !busy && setSelectedPlace(null)}
        >
          <section
            className="nearby-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedPlace.name} gallery`}
            onClick={e => e.stopPropagation()}
          >
            <div className="nearby-modal-head">
              <div>
                <span className="nearby-eyebrow">PHOTO MANAGEMENT</span>
                <h3>{selectedPlace.name}</h3>
                <p>Manage multiple images for this place.</p>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => setSelectedPlace(null)}
              >
                ×
              </button>
            </div>

            <div className="nearby-modal-content">
              <div className="nearby-upload-box">
                <h4>Upload Images from Computer</h4>
                <p>JPG, PNG or WebP. Maximum 8 images per upload, 5 MB each.</p>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={e => setSelectedFiles(Array.from(e.target.files || []))}
                />

                {selectedFiles.length > 0 && (
                  <p>{selectedFiles.length} file(s) selected</p>
                )}

                <button
                  className="nearby-btn nearby-primary"
                  type="button"
                  disabled={busy || !selectedFiles.length}
                  onClick={() => void uploadImages()}
                >
                  {busy ? 'Processing...' : 'Upload Selected Images'}
                </button>
              </div>

              <form className="nearby-upload-box" onSubmit={addImageUrl}>
                <h4>Add Image Using URL</h4>

                <input
                  type="url"
                  required
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                />

                <label>
                  Display Order
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={imageOrder}
                    onChange={e => setImageOrder(Number(e.target.value))}
                  />
                </label>

                <button
                  className="nearby-btn nearby-primary"
                  type="submit"
                  disabled={busy}
                >
                  Add Image URL
                </button>
              </form>

              <h4>Gallery Images ({images.length})</h4>

              {imagesLoading ? (
                <div className="nearby-empty">Loading images...</div>
              ) : images.length === 0 ? (
                <div className="nearby-empty">No gallery images yet.</div>
              ) : (
                <div className="nearby-gallery-grid">
                  {images.map(image => (
                    <div className="nearby-gallery-image" key={image.id}>
                      <img
                        src={image.image_url}
                        alt={`${selectedPlace.name} gallery`}
                        loading="lazy"
                      />

                      <div className="nearby-gallery-controls">
                        <label>
                          Order
                          <input
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={image.display_order}
                            key={`${image.id}-${image.display_order}`}
                            onBlur={e => {
                              const order = Number(e.target.value);

                              if (
                                Number.isSafeInteger(order) &&
                                order !== image.display_order
                              ) {
                                void changeImageOrder(image, order);
                              }
                            }}
                          />
                        </label>

                        <button
                          type="button"
                          className="nearby-btn nearby-danger"
                          disabled={busy}
                          onClick={() => void deleteImage(image)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedPlace.image_url && (
                <p className="nearby-gallery-note">
                  The original cover image is stored separately. You can edit
                  its URL using the Edit Place form.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
