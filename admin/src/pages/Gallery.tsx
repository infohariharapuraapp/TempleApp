
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { apiRequest } from '../lib/api';
import './Gallery.css';

type GalleryImage = {
  id: number;
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
  album_id?: number | null;
  album_name?: string | null;
  is_active: boolean;
};

type GalleryAlbum = {
  id: number;
  name: string;
  description?: string | null;
  display_order: number;
  is_active: boolean;
};

type ImageForm = Partial<GalleryImage>;
type AlbumForm = Partial<GalleryAlbum>;
type ImageMode = 'url' | 'upload';

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function resolveImageUrl(value?: string | null) {
  if (!value) return '';

  if (value.startsWith('/uploads/')) {
    return `${window.location.origin}${value}`;
  }

  return value;
}

function SmoothImage({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className={`gallery-image-frame ${className}`}>
      {!loaded && !failed && (
        <div className="gallery-skeleton" aria-hidden="true" />
      )}

      {failed ? (
        <div className="gallery-image-fallback">
          Image unavailable
        </div>
      ) : (
        <img
          key={src}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={loaded ? 'is-loaded' : ''}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export default function Gallery() {
  const [items, setItems] = useState<GalleryImage[]>([]);
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);

  const [editing, setEditing] = useState<ImageForm | null>(null);
  const [editingAlbum, setEditingAlbum] =
    useState<AlbumForm | null>(null);

  const [imageMode, setImageMode] = useState<ImageMode>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const [busy, setBusy] = useState(false);
  const [albumBusy, setAlbumBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingAlbumId, setDeletingAlbumId] =
    useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState('');
  const [albumFilter, setAlbumFilter] = useState('all');

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('');
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  async function loadImages() {
    const result = await apiRequest<{
      data: GalleryImage[];
    }>('/admin/gallery');

    setItems(result.data || []);
  }

  async function loadAlbums() {
    const result = await apiRequest<{
      data: GalleryAlbum[];
    }>('/admin/gallery-albums');

    setAlbums(result.data || []);
  }

  async function refresh() {
    setLoading(true);
    setError('');

    try {
      await Promise.all([loadImages(), loadAlbums()]);
    } catch (err) {
      setError(messageOf(err, 'Failed to load gallery'));
    } finally {
      setLoading(false);
    }
  }

  const filteredImages = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter(item => {
      const matchesSearch =
        !query ||
        [
          item.title,
          item.description,
          item.category,
          item.album_name,
        ].some(value =>
          (value || '').toLowerCase().includes(query)
        );

      const matchesAlbum =
        albumFilter === 'all' ||
        (albumFilter === 'unassigned'
          ? item.album_id == null
          : String(item.album_id) === albumFilter);

      return matchesSearch && matchesAlbum;
    });
  }, [items, search, albumFilter]);

  function openAddForm(albumId?: number) {
    setError('');
    setNotice('');
    setSelectedFile(null);
    setImageMode('upload');
    setEditingAlbum(null);

    setEditing({
      title: '',
      description: '',
      category: '',
      image_url: '',
      album_id:
        albumId ??
        (albums.length === 1 ? albums[0].id : null),
      is_active: true,
    });
  }

  function openEditForm(item: GalleryImage) {
    setError('');
    setNotice('');
    setSelectedFile(null);
    setImageMode('url');
    setEditingAlbum(null);
    setEditing({ ...item });

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function openAddAlbumForm() {
    setError('');
    setNotice('');
    setEditing(null);
    setEditingAlbum({
      name: '',
      description: '',
      display_order: albums.length + 1,
      is_active: true,
    });
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      setError('Please select a JPG, PNG or WebP image.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_SIZE || file.size === 0) {
      setError('Image must be between 1 byte and 5 MB.');
      event.target.value = '';
      return;
    }

    setError('');
    setSelectedFile(file);
    event.target.value = '';
  }

  async function saveImage(event: FormEvent) {
    event.preventDefault();

    if (!editing || busy) return;

    if (!editing.id && !editing.album_id) {
      setError('Please select a gallery heading.');
      return;
    }

    if (imageMode === 'upload' && !selectedFile && !editing.id) {
      setError('Please select an image to upload.');
      return;
    }

    if (
      imageMode === 'url' &&
      !editing.image_url?.trim()
    ) {
      setError('Please enter an image URL.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const endpoint = editing.id
        ? `/admin/gallery/${editing.id}`
        : '/admin/gallery';

      const method = editing.id ? 'PUT' : 'POST';

      if (imageMode === 'upload' && selectedFile) {
        const formData = new FormData();

        formData.append('image', selectedFile);
        formData.append('title', editing.title?.trim() || '');
        formData.append(
          'description',
          editing.description?.trim() || ''
        );
        formData.append(
          'category',
          editing.category?.trim() || ''
        );

        if (editing.album_id) {
          formData.append(
            'album_id',
            String(editing.album_id)
          );
        }

        formData.append(
          'is_active',
          String(editing.is_active !== false)
        );

        await apiRequest(endpoint, {
          method,
          body: formData,
        });
      } else {
        const payload: Record<string, unknown> = {
          title: editing.title?.trim() || null,
          description: editing.description?.trim() || null,
          category: editing.category?.trim() || null,
          album_id: editing.album_id || null,
          is_active: editing.is_active !== false,
        };

        if (imageMode === 'url') {
          payload.image_url = editing.image_url?.trim() || null;
        }

        await apiRequest(endpoint, {
          method,
          body: JSON.stringify(payload),
        });
      }

      setEditing(null);
      setSelectedFile(null);
      setNotice('Gallery image saved successfully.');

      await loadImages();
    } catch (err) {
      setError(messageOf(err, 'Failed to save gallery image'));
    } finally {
      setBusy(false);
    }
  }

  async function saveAlbum(event: FormEvent) {
    event.preventDefault();

    if (!editingAlbum?.name?.trim() || albumBusy) return;

    setAlbumBusy(true);
    setError('');

    try {
      const endpoint = editingAlbum.id
        ? `/admin/gallery-albums/${editingAlbum.id}`
        : '/admin/gallery-albums';

      await apiRequest(endpoint, {
        method: editingAlbum.id ? 'PUT' : 'POST',
        body: JSON.stringify({
          name: editingAlbum.name.trim(),
          description: editingAlbum.description?.trim() || null,
          display_order: Number(editingAlbum.display_order) || 0,
          is_active: editingAlbum.is_active !== false,
        }),
      });

      setEditingAlbum(null);
      setNotice('Gallery heading saved successfully.');

      await Promise.all([loadAlbums(), loadImages()]);
    } catch (err) {
      setError(messageOf(err, 'Failed to save heading'));
    } finally {
      setAlbumBusy(false);
    }
  }

  async function deleteImage(item: GalleryImage) {
    if (
      !window.confirm(
        `Permanently delete "${item.title || 'Gallery Image'}"?`
      )
    ) {
      return;
    }

    setDeletingId(item.id);
    setError('');

    try {
      await apiRequest(`/admin/gallery/${item.id}`, {
        method: 'DELETE',
      });

      setItems(previous =>
        previous.filter(image => image.id !== item.id)
      );

      setNotice('Gallery image deleted.');
    } catch (err) {
      setError(messageOf(err, 'Failed to delete image'));
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteAlbum(album: GalleryAlbum) {
    const count = items.filter(
      item => item.album_id === album.id
    ).length;

    const message = count
      ? `"${album.name}" contains ${count} image(s).\n\n` +
        'Deleting the heading will not delete its images. ' +
        'They will become unassigned. Continue?'
      : `Delete heading "${album.name}"?`;

    if (!window.confirm(message)) return;

    setDeletingAlbumId(album.id);
    setError('');

    try {
      await apiRequest(
        `/admin/gallery-albums/${album.id}`,
        { method: 'DELETE' }
      );

      await Promise.all([loadAlbums(), loadImages()]);
      setNotice('Gallery heading deleted.');
    } catch (err) {
      setError(messageOf(err, 'Failed to delete heading'));
    } finally {
      setDeletingAlbumId(null);
    }
  }

  return (
    <main className="content gallery-admin">
      <div className="page-head gallery-page-head">
        <div>
          <h2>Gallery Management</h2>
          <p>
            Organize temple photos and manage gallery headings.
          </p>
        </div>

        <div className="gallery-actions">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={openAddAlbumForm}
          >
            + Create Heading
          </button>

          <button
            type="button"
            className="primary"
            onClick={() => openAddForm()}
            disabled={albums.length === 0}
          >
            + Add Image
          </button>
        </div>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="gallery-notice" role="status">
          {notice}
        </div>
      )}

      {albums.length === 0 && !loading && (
        <div className="panel">
          <h3>Create your first gallery heading</h3>
          <p>
            Create a heading such as Anjaneya Swamy,
            Temple Outside or Festivals before adding images.
          </p>
          <button
            type="button"
            className="primary"
            onClick={openAddAlbumForm}
          >
            + Create Heading
          </button>
        </div>
      )}

      {/* CREATE / EDIT HEADING */}

      {editingAlbum && (
        <form className="form-card gallery-form" onSubmit={saveAlbum}>
          <h3>
            {editingAlbum.id
              ? 'Edit Gallery Heading'
              : 'Create Gallery Heading'}
          </h3>

          <div className="gallery-form-grid">
            <label>
              Heading Name
              <input
                required
                value={editingAlbum.name || ''}
                onChange={e =>
                  setEditingAlbum({
                    ...editingAlbum,
                    name: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Display Order
              <input
                type="number"
                min="0"
                value={editingAlbum.display_order ?? 0}
                onChange={e =>
                  setEditingAlbum({
                    ...editingAlbum,
                    display_order: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>

          <label>
            Description (optional)
            <textarea
              value={editingAlbum.description || ''}
              onChange={e =>
                setEditingAlbum({
                  ...editingAlbum,
                  description: e.target.value,
                })
              }
            />
          </label>

          <label className="gallery-check">
            <input
              type="checkbox"
              checked={editingAlbum.is_active !== false}
              onChange={e =>
                setEditingAlbum({
                  ...editingAlbum,
                  is_active: e.target.checked,
                })
              }
            />
            Active
          </label>

          <div className="gallery-actions">
            <button
              type="button"
              disabled={albumBusy}
              onClick={() => setEditingAlbum(null)}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary"
              disabled={albumBusy}
            >
              {albumBusy
                ? 'Saving...'
                : editingAlbum.id
                  ? 'Save Heading'
                  : 'Create Heading'}
            </button>
          </div>
        </form>
      )}

      {/* GALLERY HEADINGS */}

      {albums.length > 0 && (
        <section className="panel">
          <h3>Gallery Headings</h3>

          <div className="gallery-album-grid">
            {albums.map(album => {
              const count = items.filter(
                item => item.album_id === album.id
              ).length;

              return (
                <div className="gallery-album-card" key={album.id}>
                  <div className="gallery-album-top">
                    <strong>{album.name}</strong>
                    <span className="badge">
                      {album.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {album.description && (
                    <p>{album.description}</p>
                  )}

                  <p>
                    <strong>{count}</strong>{' '}
                    {count === 1 ? 'photo' : 'photos'}
                  </p>

                  <small>
                    Display order: {album.display_order}
                  </small>

                  <div className="gallery-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => openAddForm(album.id)}
                      disabled={!album.is_active}
                    >
                      + Add Photo
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setEditingAlbum({ ...album });
                      }}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="danger"
                      disabled={deletingAlbumId !== null}
                      onClick={() => void deleteAlbum(album)}
                    >
                      {deletingAlbumId === album.id
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ADD / EDIT IMAGE */}

      {editing && (
        <form className="form-card gallery-form" onSubmit={saveImage}>
          <h3>
            {editing.id ? 'Edit Gallery Image' : 'Add Gallery Image'}
          </h3>

          <label>
            Gallery Heading
            <select
              value={editing.album_id ?? ''}
              required={!editing.id}
              onChange={e =>
                setEditing({
                  ...editing,
                  album_id: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
            >
              <option value="">Select heading</option>

              {albums
                .filter(
                  album =>
                    album.is_active ||
                    album.id === editing.album_id
                )
                .map(album => (
                  <option key={album.id} value={album.id}>
                    {album.name}
                    {!album.is_active ? ' (Inactive)' : ''}
                  </option>
                ))}
            </select>
          </label>

          <div className="gallery-mode-tabs">
            <button
              type="button"
              className={imageMode === 'upload' ? 'selected' : ''}
              disabled={busy}
              onClick={() => setImageMode('upload')}
            >
              Upload Image
            </button>

            <button
              type="button"
              className={imageMode === 'url' ? 'selected' : ''}
              disabled={busy}
              onClick={() => {
                setImageMode('url');
                setSelectedFile(null);
              }}
            >
              Image URL
            </button>
          </div>

          {imageMode === 'upload' ? (
            <div className="gallery-upload-zone">
              <div className="gallery-upload-icon">↑</div>
              <strong>Choose a temple photo</strong>
              <p>JPG, PNG or WebP · Maximum 5 MB</p>

              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                disabled={busy}
                onChange={handleFileChange}
              />

              {selectedFile && (
                <small>
                  Selected: {selectedFile.name} (
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </small>
              )}
            </div>
          ) : (
            <label>
              Image URL
              <input
                type="url"
                value={editing.image_url || ''}
                placeholder="https://example.com/image.jpg"
                onChange={e =>
                  setEditing({
                    ...editing,
                    image_url: e.target.value,
                  })
                }
              />
            </label>
          )}

          <div className="gallery-form-grid">
            <label>
              Title (optional)
              <input
                value={editing.title || ''}
                placeholder="Temple Entrance"
                onChange={e =>
                  setEditing({
                    ...editing,
                    title: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Category (optional)
              <input
                value={editing.category || ''}
                placeholder="Temple"
                onChange={e =>
                  setEditing({
                    ...editing,
                    category: e.target.value,
                  })
                }
              />
            </label>
          </div>

          <label>
            Description (optional)
            <textarea
              value={editing.description || ''}
              onChange={e =>
                setEditing({
                  ...editing,
                  description: e.target.value,
                })
              }
            />
          </label>

          <label className="gallery-check">
            <input
              type="checkbox"
              checked={editing.is_active !== false}
              onChange={e =>
                setEditing({
                  ...editing,
                  is_active: e.target.checked,
                })
              }
            />
            Active
          </label>

          {(previewUrl ||
            (imageMode === 'url' && editing.image_url) ||
            (imageMode === 'upload' && editing.id && editing.image_url)) && (
            <div className="gallery-preview-section">
              <strong>Image Preview</strong>

              <SmoothImage
                key={
                  previewUrl ||
                  editing.image_url ||
                  'preview'
                }
                src={
                  previewUrl ||
                  resolveImageUrl(editing.image_url)
                }
                alt="Selected gallery preview"
                className="gallery-preview-frame"
              />
            </div>
          )}

          {busy && (
            <div className="gallery-saving" role="status">
              <span className="gallery-spinner" />
              Uploading and saving image. Please wait...
            </div>
          )}

          <div className="gallery-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setSelectedFile(null);
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary"
              disabled={busy}
            >
              {busy
                ? 'Saving...'
                : editing.id
                  ? 'Save Changes'
                  : 'Add Image'}
            </button>
          </div>
        </form>
      )}

      {/* GALLERY IMAGES */}

      <section className="gallery-images-section">
        <div className="gallery-section-header">
          <div>
            <h3>Gallery Images</h3>
            <p>
              {filteredImages.length} of {items.length} photos
            </p>
          </div>

          <div className="gallery-filters">
            <input
              type="search"
              placeholder="Search photos..."
              aria-label="Search gallery photos"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <select
              aria-label="Filter gallery heading"
              value={albumFilter}
              onChange={e => setAlbumFilter(e.target.value)}
            >
              <option value="all">All Headings</option>
              <option value="unassigned">Unassigned</option>

              {albums.map(album => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div className="gallery-photo-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="gallery-photo-card" key={index}>
                <div className="gallery-skeleton gallery-list-placeholder" />
              </div>
            ))}
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="gallery-empty-state">
            No gallery images found.
          </div>
        ) : (
          <div className="gallery-photo-grid">
            {filteredImages.map(item => (
              <article className="gallery-photo-card" key={item.id}>
                {item.image_url ? (
                  <SmoothImage
                    key={`${item.id}-${item.image_url}`}
                    src={resolveImageUrl(item.image_url)}
                    alt={item.title || 'Temple gallery image'}
                  />
                ) : (
                  <div className="gallery-image-fallback">
                    No image
                  </div>
                )}

                <div className="gallery-photo-body">
                  <strong>
                    {item.title || 'Gallery Image'}
                  </strong>

                  <span className="gallery-album-label">
                    {item.album_name || 'Unassigned'}
                  </span>

                  {item.category && (
                    <small>{item.category}</small>
                  )}

                  {item.description && (
                    <p>{item.description}</p>
                  )}

                  <div className="gallery-actions">
                    <button
                      type="button"
                      disabled={deletingId !== null}
                      onClick={() => openEditForm(item)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="danger"
                      disabled={deletingId !== null}
                      onClick={() => void deleteImage(item)}
                    >
                      {deletingId === item.id
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
