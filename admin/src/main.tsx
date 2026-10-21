  import React, { useEffect, useState } from 'react';

  import { createRoot } from 'react-dom/client';


  import { apiRequest, clearAdminSession } from './lib/api';
  import TempleContact from './pages/TempleContact';

  import Publications from './pages/Publications';



  import Activities from './pages/Activities';


  import Darshan from './pages/Darshan';

  import Events from './pages/Events';



  import Users from './pages/Users';

  import DarshanVideos from './pages/DarshanVideos';

  import Announcements from './pages/Announcements';

  import DharmaSandeham from './pages/DharmaSandeham';

  import GuruParampara from './pages/GuruParampara';

  import NearbyPlaces from './pages/NearbyPlaces';

  import GuruVani from './pages/GuruVani';
  import WelcomeSlokams from './pages/WelcomeSlokams';

  import PoojaServices from './pages/PoojaServices';

  import WelcomeScreen from './pages/WelcomeScreen';

  import './styles.css';



  type User = {

    id: number;

    full_name: string;

    email: string;

    phone?: string;

    role: string;

  };



  type Summary = {

    total_devotees: number;

  };



  type Deity = {
    id: number;
    name: string;
    description?: string | null;
    image_url?: string | null;
    significance?: string | null;
    devotional?: string | null;
    is_active: boolean;
    deity_type: 'individual' | 'group';
    parent_deity_id: number | null;
    display_order: number;
  };



  type Gallery = {

    id: number;

    title: string;

    description?: string;

    image_url?: string;

    category?: string;



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

    created_at?: string;

  };

  const nav = [

    ['dashboard', 'Dashboard'],

    ['deities', 'Deities'],

    ['darshan', 'Darshan'],

    ['darshan-videos', 'Darshan Videos'],

    ['activities', 'Activities'],


    ['events', 'Events'],

    ['gallery', 'Gallery'],

    ['users', 'Users'],
    ['guru-vani', 'Guru Vani'],
    ['welcome-slokams', 'Welcome Slokam Library'],
['welcome-screen', 'Welcome Screen Settings'],

    ['publications', 'Publications'],

    ['announcements', 'Announcements'],

    ['nearby-places', 'Nearby Places'],
    ['pooja-services', 'Pooja Services'],

    ['dharma-sandeham', 'Dharma Sandeham'],
    ['guru-parampara', 'Guru Parampara'],
    ['temple-contact', 'Temple Contact'],

  ];



  function Login({

    onLogin,

  }: {

    onLogin: (user: User, token: string) => void;

  }) {

    const [email, setEmail] = useState('');

    const [password, setPassword] = useState('');

    const [error, setError] = useState('');

    const [busy, setBusy] = useState(false);



    async function submit(e: React.FormEvent) {

      e.preventDefault();



      setError('');

      setBusy(true);



      try {

        const result = await apiRequest<{

          success: boolean;

          data: {

            token: string;

            user: User;

          };

        }>('/auth/login', {

          method: 'POST',

          body: JSON.stringify({

            email,

            password,

          }),

        });



        if (result.data.user.role !== 'admin') {

          throw new Error(

            'This account does not have admin access.'

          );

        }



        localStorage.setItem(

          'temple_admin_token',

          result.data.token

        );



        localStorage.setItem(

          'temple_admin_user',

          JSON.stringify(result.data.user)

        );



        onLogin(

          result.data.user,

          result.data.token

        );

      } catch (err) {

        setError(

          err instanceof Error

            ? err.message

            : 'Login failed'

        );

      } finally {

        setBusy(false);

      }

    }



    return (

      <div className="login-shell">

        <form

          className="login-card"

          onSubmit={submit}

        >

          <div className="brand-mark">

            ॐ

          </div>



          <h1>Temple Admin</h1>



          <p>

            Manage temple content and operations

          </p>



          <label>

            Email



            <input

              value={email}

              onChange={(e) =>

                setEmail(e.target.value)

              }

              type="email"

              required

            />

          </label>



          <label>

            Password



            <input

              value={password}

              onChange={(e) =>

                setPassword(e.target.value)

              }

              type="password"

              required

            />

          </label>



          {error && (

            <div className="error">

              {error}

            </div>

          )}



          <button

            type="submit"

            className="primary wide"

            disabled={busy}

          >

            {busy

              ? 'Signing in…'

              : 'Sign in'}

          </button>

        </form>

      </div>

    );

  }



  function Dashboard() {

    const [summary, setSummary] =

      useState<Summary | null>(null);



    const [error, setError] =

      useState('');



    useEffect(() => {

      apiRequest<{ data: Summary }>(

        '/admin/dashboard'

      )

        .then((r) =>

          setSummary(r.data)

        )

        .catch((e) =>

          setError(e.message)

        );

    }, []);



    return (

      <Page

        title="Dashboard"

        subtitle="Temple platform overview"

      >

        {error && (

          <div className="error">

            {error}

          </div>

        )}



        <div className="stats">

          {[

            [

              'Devotees',

              summary?.total_devotees,

            ],







          ].map(([k, v]) => (

            <div

              className="stat"

              key={String(k)}

            >

              <span>{k}</span>



              <strong>

                {v ?? '—'}

              </strong>

            </div>

          ))}

        </div>



        <div className="panel">

          <h3>

            Admin integration

          </h3>



          <p>

            Content entered here will be

            stored through the backend API

            and PostgreSQL, then consumed by

            the devotee mobile application.

          </p>

        </div>

      </Page>

    );

  }



  function Deities() {
    const [items, setItems] = useState<Deity[]>([]);
    const [editing, setEditing] = useState<Partial<Deity> | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [filter, setFilter] = useState<'all' | 'groups' | 'individuals'>('all');
    const [search, setSearch] = useState('');

    async function load() {
      try {
        const response = await apiRequest<{ data: Deity[] }>('/admin/deities');
        setItems(response.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load deities');
      }
    }

    useEffect(() => { void load(); }, []);

    const groups = items.filter((item) =>
      item.deity_type === 'group' && item.parent_deity_id == null
    );

    const parentName = (id: number | null | undefined) =>
      groups.find((group) => group.id === id)?.name || 'Unassigned';

    const childrenCount = (id: number) =>
      items.filter((item) => item.parent_deity_id === id).length;

    const ordered = [...items]
      .filter((item) => {
        if (filter === 'groups' && item.deity_type !== 'group') return false;
        if (filter === 'individuals' && item.deity_type !== 'individual') return false;
        const q = search.trim().toLowerCase();
        return !q || item.name.toLowerCase().includes(q) ||
          (item.parent_deity_id != null && parentName(item.parent_deity_id).toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const aGroup = a.parent_deity_id ?? a.id;
        const bGroup = b.parent_deity_id ?? b.id;
        if (aGroup !== bGroup) {
          const aRoot = items.find((x) => x.id === aGroup);
          const bRoot = items.find((x) => x.id === bGroup);
          const orderDiff = (aRoot?.display_order ?? 0) - (bRoot?.display_order ?? 0);
          return orderDiff || aGroup - bGroup;
        }
        if (a.parent_deity_id == null && b.parent_deity_id != null) return -1;
        if (b.parent_deity_id == null && a.parent_deity_id != null) return 1;
        return (a.display_order ?? 0) - (b.display_order ?? 0) || a.id - b.id;
      });

    function addIndividual(parentId: number | null = null) {
      setError('');
      setEditing({
        name: '', description: '', image_url: '', significance: '', devotional: '',
        deity_type: 'individual', parent_deity_id: parentId,
        display_order: 0, is_active: true,
      });
    }

    function addGroup() {
      setError('');
      setEditing({
        name: '', description: '', image_url: '', significance: '', devotional: '',
        deity_type: 'group', parent_deity_id: null,
        display_order: 0, is_active: true,
      });
    }

    async function save(e: React.FormEvent) {
      e.preventDefault();
      if (!editing?.name?.trim() || busy) return;
      const deityType = editing.deity_type || 'individual';
      const parentId = deityType === 'group' ? null : editing.parent_deity_id ?? null;
      if (deityType === 'group' && editing.id && items.some((x) => x.parent_deity_id === editing.id && x.deity_type === 'group')) {
        setError('Nested deity groups are not supported.');
        return;
      }
      if (parentId === editing.id) {
        setError('A deity cannot be its own parent.');
        return;
      }
      if (parentId != null && !groups.some((x) => x.id === parentId && x.is_active)) {
        setError('Choose an active deity group.');
        return;
      }
      const order = Number(editing.display_order ?? 0);
      if (!Number.isSafeInteger(order) || order < 0) {
        setError('Display order must be a non-negative whole number.');
        return;
      }
      setError('');
      setBusy(true);
      try {
        const endpoint = editing.id ? `/admin/deities/${editing.id}` : '/admin/deities';
        await apiRequest(endpoint, {
          method: editing.id ? 'PUT' : 'POST',
          body: JSON.stringify({
            name: editing.name.trim(),
            description: editing.description?.trim() || null,
            image_url: editing.image_url?.trim() || null,
            significance: editing.significance?.trim() || null,
            devotional: editing.devotional?.trim() || null,
            deity_type: deityType,
            parent_deity_id: parentId,
            display_order: order,
            is_active: editing.is_active !== false,
          }),
        });
        setEditing(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save deity');
      } finally {
        setBusy(false);
      }
    }

    async function deactivate(item: Deity) {
      if (busy || !item.is_active) return;
      const count = item.deity_type === 'group'
        ? items.filter((x) => x.parent_deity_id === item.id && x.is_active).length
        : 0;
      if (count) {
        setError(`Deactivate the ${count} active sub-deities before deactivating this group.`);
        return;
      }
      if (!window.confirm(`Deactivate "${item.name}"?`)) return;
      setError('');
      setBusy(true);
      try {
        await apiRequest(`/admin/deities/${item.id}`, { method: 'DELETE' });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to deactivate deity');
      } finally {
        setBusy(false);
      }
    }

    return (
      <Page
        title="Deities"
        subtitle="Manage individual deities, deity groups and their sub-deities"
        action={
          <div className="actions">
            <button type="button" className="primary" onClick={() => addIndividual()} disabled={busy}>+ Add Individual</button>
            <button type="button" onClick={addGroup} disabled={busy}>+ Create Group</button>
          </div>
        }
      >
        {error && <div className="error" role="alert">{error}</div>}

        {editing && (
          <form className="form-card" onSubmit={save}>
            <h3>{editing.id ? 'Edit' : 'Add'} {editing.deity_type === 'group' ? 'Deity Group' : 'Deity'}</h3>
            <div className="grid2">
              <label>
                Name
                <input value={editing.name ?? ''} required onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </label>
              <label>
                Type
                <select
                  value={editing.deity_type || 'individual'}
                  disabled={Boolean(editing.id) && (editing.deity_type === 'group' ? childrenCount(editing.id!) > 0 : false)}
                  onChange={(e) => setEditing({
                    ...editing,
                    deity_type: e.target.value as 'individual' | 'group',
                    parent_deity_id: null,
                  })}
                >
                  <option value="individual">Individual Deity</option>
                  <option value="group">Deity Group</option>
                </select>
              </label>
            </div>
            <div className="grid2">
              {editing.deity_type !== 'group' && (
                <label>
                  Parent Group (optional)
                  <select
                    value={editing.parent_deity_id ?? ''}
                    onChange={(e) => setEditing({
                      ...editing,
                      parent_deity_id: e.target.value ? Number(e.target.value) : null,
                    })}
                  >
                    <option value="">None — top-level individual</option>
                    {groups.filter((g) => g.is_active || g.id === editing.parent_deity_id).map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Display Order
                <input type="number" min="0" step="1" value={editing.display_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })} />
              </label>
            </div>
            <label>
              Image URL
              <input type="url" value={editing.image_url ?? ''}
                onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                placeholder="https://example.com/deity.jpg" />
            </label>
            <label>
              Description
              <textarea value={editing.description ?? ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </label>
            <label>
              Spiritual Significance
              <textarea value={editing.significance ?? ''}
                onChange={(e) => setEditing({ ...editing, significance: e.target.value })} />
            </label>
            <label>
              Devotional Practice
              <textarea value={editing.devotional ?? ''}
                onChange={(e) => setEditing({ ...editing, devotional: e.target.value })} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={editing.is_active !== false}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              Active
            </label>
            <div className="actions">
              <button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Saving…' : editing.id ? 'Save Changes' : 'Create Deity'}
              </button>
            </div>
          </form>
        )}

        <div className="panel">
          <div className="actions" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <label>Show{' '}
              <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                <option value="all">All Deities</option>
                <option value="groups">Groups</option>
                <option value="individuals">Individuals & Sub-deities</option>
              </select>
            </label>
            <input aria-label="Search deities" placeholder="Search deity or group" value={search}
              onChange={(e) => setSearch(e.target.value)} />
            <span>{ordered.length} records</span>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Image</th><th>Name</th><th>Type / Parent</th><th>Order</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((item) => (
                <tr key={item.id}>
                  <td>{item.image_url
                    ? <img className="thumb" src={item.image_url} alt={item.name} />
                    : <div className="thumb empty">—</div>}</td>
                  <td>
                    <strong>{item.parent_deity_id != null ? '↳ ' : ''}{item.name}</strong>
                    {item.deity_type === 'group' && <div><small>{childrenCount(item.id)} sub-deities</small></div>}
                    {item.description && <div><small>{item.description.slice(0, 100)}{item.description.length > 100 ? '…' : ''}</small></div>}
                  </td>
                  <td>
                    {item.deity_type === 'group' ? 'Group' : item.parent_deity_id != null ? 'Sub-deity' : 'Individual'}
                    {item.parent_deity_id != null && <div><small>{parentName(item.parent_deity_id)}</small></div>}
                  </td>
                  <td>{item.display_order ?? 0}</td>
                  <td><span className="badge">{item.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="actions" style={{ flexWrap: 'wrap' }}>
                      <button type="button" disabled={busy} onClick={() => { setError(''); setEditing({ ...item }); }}>Edit</button>
                      {item.deity_type === 'group' && (
                        <button type="button" disabled={busy || !item.is_active} onClick={() => addIndividual(item.id)}>
                          + Sub-deity
                        </button>
                      )}
                      {item.is_active && (
                        <button type="button" className="danger" disabled={busy} onClick={() => void deactivate(item)}>
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 12, fontSize: 13 }}>
          To assign an existing deity to a group, select Edit and choose its Parent Group.
          Inactive deities can be reactivated through Edit. A group with active children cannot be deactivated.
        </p>
      </Page>
    );
  }

  function Gallery() {

    const [items, setItems] = useState<Gallery[]>([]);

    const [albums, setAlbums] = useState<GalleryAlbum[]>([]);



    const [editing, setEditing] =

      useState<Partial<Gallery> | null>(null);



    const [editingAlbum, setEditingAlbum] =

      useState<Partial<GalleryAlbum> | null>(null);



    const [error, setError] = useState('');



    const [imageMode, setImageMode] =

      useState<'url' | 'upload'>('url');



    const [selectedFile, setSelectedFile] =

      useState<File | null>(null);



    const [busy, setBusy] = useState(false);

    const [albumBusy, setAlbumBusy] = useState(false);



    const [deletingId, setDeletingId] =

      useState<number | null>(null);



    const [deletingAlbumId, setDeletingAlbumId] =

      useState<number | null>(null);



    /*

    * -----------------------------------------

    * LOAD GALLERY IMAGES

    * -----------------------------------------

    */



    const load = async () => {

      try {

        const result = await apiRequest<{

          data: Gallery[];

        }>('/admin/gallery');



        setItems(result.data || []);

      } catch (e) {

        setError(

          e instanceof Error

            ? e.message

            : 'Failed to load gallery'

        );

      }

    };



    /*

    * -----------------------------------------

    * LOAD GALLERY HEADINGS

    * -----------------------------------------

    */



    const loadAlbums = async () => {

      try {

        const result = await apiRequest<{

          success: boolean;

          data: GalleryAlbum[];

        }>('/admin/gallery-albums');



        setAlbums(result.data || []);

      } catch (e) {

        setError(

          e instanceof Error

            ? e.message

            : 'Failed to load gallery headings'

        );

      }

    };



    useEffect(() => {

      load();

      loadAlbums();

    }, []);



    /*

    * =========================================

    * GALLERY HEADING / ALBUM

    * =========================================

    */



    function openAddAlbumForm() {

      setError('');



      setEditingAlbum({

        name: '',

        description: '',

        display_order: albums.length + 1,

        is_active: true,

      });

    }



    function openEditAlbumForm(

      album: GalleryAlbum

    ) {

      setError('');



      setEditingAlbum({

        ...album,

      });

    }



    async function saveAlbum(

      e: React.FormEvent

    ) {

      e.preventDefault();



      if (!editingAlbum?.name?.trim()) {

        setError('Heading name is required.');

        return;

      }



      setError('');

      setAlbumBusy(true);



      try {

        const isEditing =

          Boolean(editingAlbum.id);



        const endpoint = isEditing

          ? `/admin/gallery-albums/${editingAlbum.id}`

          : '/admin/gallery-albums';



        const method = isEditing

          ? 'PUT'

          : 'POST';



        await apiRequest(endpoint, {

          method,

          body: JSON.stringify({

            name: editingAlbum.name.trim(),



            description:

              editingAlbum.description?.trim() ||

              null,



            display_order:

              Number(

                editingAlbum.display_order

              ) || 0,



            is_active:

              editingAlbum.is_active !== false,

          }),

        });



        setEditingAlbum(null);



        await loadAlbums();

      } catch (e) {

        setError(

          e instanceof Error

            ? e.message

            : 'Failed to save gallery heading'

        );

      } finally {

        setAlbumBusy(false);

      }

    }



    async function deleteAlbum(

      album: GalleryAlbum

    ) {

      const imageCount = items.filter(

        (item) => item.album_id === album.id

      ).length;



      const message =

        imageCount > 0

          ? `"${album.name}" contains ${imageCount} image(s).\n\nDeleting the heading will NOT delete the images. They will become unassigned.\n\nContinue?`

          : `Delete the heading "${album.name}"?`;



      if (!window.confirm(message)) {

        return;

      }



      setError('');

      setDeletingAlbumId(album.id);



      try {

        await apiRequest(

          `/admin/gallery-albums/${album.id}`,

          {

            method: 'DELETE',

          }

        );



        await Promise.all([

          loadAlbums(),

          load(),

        ]);

      } catch (e) {

        setError(

          e instanceof Error

            ? e.message

            : 'Failed to delete gallery heading'

        );

      } finally {

        setDeletingAlbumId(null);

      }

    }



    /*

    * =========================================

    * ADD GALLERY IMAGE

    * =========================================

    */



    function openAddForm(

      albumId?: number

    ) {

      setError('');

      setSelectedFile(null);

      setImageMode('url');



      setEditing({

        title: '',

        description: '',

        category: '',

        image_url: '',

        album_id:

          albumId ??

          (albums.length === 1

            ? albums[0].id

            : null),

        is_active: true,

      });

    }



    /*

    * -----------------------------------------

    * EDIT GALLERY IMAGE

    * -----------------------------------------

    */



    function openEditForm(item: Gallery) {

      setError('');

      setSelectedFile(null);

      setImageMode('url');



      setEditing({

        ...item,

      });

    }



    /*

    * -----------------------------------------

    * FILE CHANGE

    * -----------------------------------------

    */



    function handleFileChange(

      e: React.ChangeEvent<HTMLInputElement>

    ) {

      const file = e.target.files?.[0];



      if (!file) {

        return;

      }



      if (!file.type.startsWith('image/')) {

        setError(

          'Please select a JPG, JPEG, PNG or WEBP image.'

        );

        return;

      }



      if (file.size > 5 * 1024 * 1024) {

        setError(

          'Image size must be 5 MB or less.'

        );

        return;

      }



      setError('');

      setSelectedFile(file);



      setEditing((current) => ({

        ...current,

        image_url: URL.createObjectURL(file),

      }));

    }



    /*

    * =========================================

    * SAVE GALLERY IMAGE

    * =========================================

    */



    async function save(

      e: React.FormEvent

    ) {

      e.preventDefault();



      if (!editing) {

        return;

      }



      /*

      * Require a heading for NEW images.

      *

      * Existing legacy images are still allowed

      * to remain unassigned until edited.

      */

      if (

        !editing.id &&

        !editing.album_id

      ) {

        setError(

          'Please select a gallery heading.'

        );

        return;

      }



      setError('');

      setBusy(true);



      try {

        const isEditing =

          Boolean(editing.id);



        const endpoint = isEditing

          ? `/admin/gallery/${editing.id}`

          : '/admin/gallery';



        const method = isEditing

          ? 'PUT'

          : 'POST';



        /*

        * ---------------------------------------

        * UPLOAD IMAGE

        * ---------------------------------------

        */



        if (imageMode === 'upload') {

          if (

            !selectedFile &&

            !editing.image_url

          ) {

            throw new Error(

              'Please select an image.'

            );

          }



          /*

          * New image file selected

          */



          if (selectedFile) {

            const formData =

              new FormData();



            formData.append(

              'image',

              selectedFile

            );



            if (editing.title?.trim()) {

              formData.append(

                'title',

                editing.title.trim()

              );

            }



            if (

              editing.description?.trim()

            ) {

              formData.append(

                'description',

                editing.description.trim()

              );

            }



            if (

              editing.category?.trim()

            ) {

              formData.append(

                'category',

                editing.category.trim()

              );

            }



            /*

            * NEW: send album_id

            */



            if (editing.album_id) {

              formData.append(

                'album_id',

                String(editing.album_id)

              );

            }



            formData.append(

              'is_active',

              String(

                editing.is_active !== false

              )

            );



            await apiRequest(

              endpoint,

              {

                method,

                body: formData,

              }

            );

          }



          /*

          * Existing image.

          * No new file selected.

          */



          else {

            await apiRequest(

              endpoint,

              {

                method,

                body: JSON.stringify({

                  title:

                    editing.title?.trim() ||

                    null,



                  description:

                    editing.description?.trim() ||

                    null,



                  category:

                    editing.category?.trim() ||

                    null,



                  album_id:

                    editing.album_id ||

                    null,



                  is_active:

                    editing.is_active !== false,

                }),

              }

            );

          }

        }



        /*

        * ---------------------------------------

        * IMAGE URL

        * ---------------------------------------

        */



        else {

          const imageUrl =

            editing.image_url?.trim();



          if (!imageUrl) {

            throw new Error(

              'Please enter an image URL.'

            );

          }



          await apiRequest(

            endpoint,

            {

              method,

              body: JSON.stringify({

                title:

                  editing.title?.trim() ||

                  null,



                description:

                  editing.description?.trim() ||

                  null,



                image_url: imageUrl,



                category:

                  editing.category?.trim() ||

                  null,



                /*

                * NEW

                */

                album_id:

                  editing.album_id ||

                  null,



                is_active:

                  editing.is_active !== false,

              }),

            }

          );

        }



        setEditing(null);

        setSelectedFile(null);



        await load();

      } catch (e) {

        setError(

          e instanceof Error

            ? e.message

            : 'Save failed'

        );

      } finally {

        setBusy(false);

      }

    }



    /*

    * =========================================

    * DELETE GALLERY IMAGE

    * =========================================

    */



    async function handleDeleteGallery(

      id: number

    ) {

      const confirmed =

        window.confirm(

          'Are you sure you want to permanently delete this gallery image?'

        );



      if (!confirmed) {

        return;

      }



      setError('');

      setDeletingId(id);



      try {

        await apiRequest(

          `/admin/gallery/${id}`,

          {

            method: 'DELETE',

          }

        );



        setItems((currentItems) =>

          currentItems.filter(

            (item) =>

              item.id !== id

          )

        );

      } catch (error) {

        console.error(

          'Delete gallery image error:',

          error

        );



        setError(

          error instanceof Error

            ? error.message

            : 'Failed to delete gallery image'

        );

      } finally {

        setDeletingId(null);

      }

    }



    /*

    * =========================================

    * HELPER

    * =========================================

    */



    function getAlbumImageCount(

      albumId: number

    ) {

      return items.filter(

        (item) =>

          item.album_id === albumId

      ).length;

    }



    /*

    * =========================================

    * UI

    * =========================================

    */



    return (

      <Page

        title="Gallery"

        subtitle="Manage gallery headings and images shown in the devotee app"

        action={

          <div

            style={{

              display: 'flex',

              gap: '10px',

              flexWrap: 'wrap',

            }}

          >

            <button

              type="button"

              onClick={

                openAddAlbumForm

              }

              disabled={

                busy ||

                albumBusy ||

                deletingAlbumId !== null

              }

            >

              + Create Heading

            </button>



            <button

              type="button"

              className="primary"

              onClick={() =>

                openAddForm()

              }

              disabled={

                busy ||

                albumBusy ||

                deletingId !== null ||

                albums.length === 0

              }

            >

              + Add Image

            </button>

          </div>

        }

      >

        {error && (

          <div className="error">

            {error}

          </div>

        )}



        {albums.length === 0 &&

          !editingAlbum && (

            <div className="panel">

              <h3>

                Create your first gallery heading

              </h3>



              <p>

                Create a heading such as

                Anjaneya Swamy, Temple

                Outside or Festivals before

                adding new gallery images.

              </p>



              <button

                type="button"

                className="primary"

                onClick={

                  openAddAlbumForm

                }

              >

                + Create Heading

              </button>

            </div>

          )}



        {/* =====================================

            CREATE / EDIT HEADING

            ===================================== */}



        {editingAlbum && (

          <form

            className="form-card"

            onSubmit={saveAlbum}

          >

            <h3>

              {editingAlbum.id

                ? 'Edit Gallery Heading'

                : 'Create Gallery Heading'}

            </h3>



            <div className="grid2">

              <label>

                Heading Name



                <input

                  value={

                    editingAlbum.name ||

                    ''

                  }

                  onChange={(e) =>

                    setEditingAlbum({

                      ...editingAlbum,

                      name:

                        e.target.value,

                    })

                  }

                  placeholder="Anjaneya Swamy"

                  required

                />

              </label>



              <label>

                Display Order



                <input

                  type="number"

                  min="0"

                  value={

                    editingAlbum.display_order ??

                    0

                  }

                  onChange={(e) =>

                    setEditingAlbum({

                      ...editingAlbum,

                      display_order:

                        Number(

                          e.target.value

                        ),

                    })

                  }

                />

              </label>

            </div>



            <label>

              Description



              <span

                style={{

                  fontWeight:

                    'normal',

                  fontSize: '12px',

                }}

              >

                {' '}

                (optional)

              </span>



              <textarea

                value={

                  editingAlbum.description ||

                  ''

                }

                onChange={(e) =>

                  setEditingAlbum({

                    ...editingAlbum,

                    description:

                      e.target.value,

                  })

                }

                placeholder="Optional heading description"

              />

            </label>



            <label

              style={{

                display: 'flex',

                alignItems: 'center',

                gap: '8px',

              }}

            >

              <input

                type="checkbox"

                checked={

                  editingAlbum.is_active !==

                  false

                }

                onChange={(e) =>

                  setEditingAlbum({

                    ...editingAlbum,

                    is_active:

                      e.target.checked,

                  })

                }

              />



              Active

            </label>



            <div className="actions">

              <button

                type="button"

                onClick={() =>

                  setEditingAlbum(null)

                }

                disabled={albumBusy}

              >

                Cancel

              </button>



              <button

                type="submit"

                className="primary"

                disabled={albumBusy}

              >

                {albumBusy

                  ? 'Saving…'

                  : editingAlbum.id

                    ? 'Save Heading'

                    : 'Create Heading'}

              </button>

            </div>

          </form>

        )}



        {/* =====================================

            HEADINGS

            ===================================== */}



        {albums.length > 0 && (

          <div

            className="panel"

            style={{

              marginBottom: '24px',

            }}

          >

            <h3>

              Gallery Headings

            </h3>



            <div

              style={{

                display: 'grid',

                gridTemplateColumns:

                  'repeat(auto-fit, minmax(230px, 1fr))',

                gap: '14px',

                marginTop: '16px',

              }}

            >

              {albums.map(

                (album) => {

                  const count =

                    getAlbumImageCount(

                      album.id

                    );



                  return (

                    <div

                      key={album.id}

                      style={{

                        border:

                          '1px solid #e5e7eb',

                        borderRadius:

                          '12px',

                        padding: '16px',

                      }}

                    >

                      <div

                        style={{

                          display:

                            'flex',

                          justifyContent:

                            'space-between',

                          gap: '10px',

                        }}

                      >

                        <strong>

                          {album.name}

                        </strong>



                        <span className="badge">

                          {album.is_active

                            ? 'Active'

                            : 'Inactive'}

                        </span>

                      </div>



                      {album.description && (

                        <p>

                          {

                            album.description

                          }

                        </p>

                      )}



                      <p

                        style={{

                          margin:

                            '10px 0',

                        }}

                      >

                        <strong>

                          {count}

                        </strong>{' '}

                        {count === 1

                          ? 'photo'

                          : 'photos'}

                      </p>



                      <small>

                        Display order:{' '}

                        {

                          album.display_order

                        }

                      </small>



                      <div

                        className="actions"

                        style={{

                          marginTop:

                            '14px',

                        }}

                      >

                        <button

                          type="button"

                          className="primary"

                          onClick={() =>

                            openAddForm(

                              album.id

                            )

                          }

                        >

                          + Add Photo

                        </button>



                        <button

                          type="button"

                          onClick={() =>

                            openEditAlbumForm(

                              album

                            )

                          }

                        >

                          Edit

                        </button>



                        <button

                          type="button"

                          className="danger"

                          disabled={

                            deletingAlbumId ===

                            album.id

                          }

                          onClick={() =>

                            deleteAlbum(

                              album

                            )

                          }

                        >

                          {deletingAlbumId ===

                            album.id

                            ? 'Deleting…'

                            : 'Delete'}

                        </button>

                      </div>

                    </div>

                  );

                }

              )}

            </div>

          </div>

        )}



        {/* =====================================

            ADD / EDIT IMAGE

            ===================================== */}



        {editing && (

          <form

            className="form-card"

            onSubmit={save}

          >

            <h3>

              {editing.id

                ? 'Edit Gallery Image'

                : 'Add Gallery Image'}

            </h3>



            {/* HEADING */}



            <label>

              Gallery Heading



              <select

                value={

                  editing.album_id ??

                  ''

                }

                onChange={(e) =>

                  setEditing({

                    ...editing,

                    album_id:

                      e.target.value

                        ? Number(

                          e.target

                            .value

                        )

                        : null,

                  })

                }

                required={!editing.id}

              >

                <option value="">

                  Select heading

                </option>



                {albums

                  .filter(

                    (album) =>

                      album.is_active ||

                      album.id ===

                      editing.album_id

                  )

                  .map(

                    (album) => (

                      <option

                        key={

                          album.id

                        }

                        value={

                          album.id

                        }

                      >

                        {

                          album.name

                        }

                      </option>

                    )

                  )}

              </select>

            </label>



            {/* IMAGE MODE */}



            <div

              style={{

                display: 'flex',

                gap: '10px',

                marginBottom:

                  '18px',

                marginTop: '18px',

              }}

            >

              <button

                type="button"

                className={

                  imageMode === 'url'

                    ? 'primary'

                    : ''

                }

                onClick={() => {

                  setImageMode('url');

                  setSelectedFile(null);

                  setError('');

                }}

              >

                Image URL

              </button>



              <button

                type="button"

                className={

                  imageMode ===

                    'upload'

                    ? 'primary'

                    : ''

                }

                onClick={() => {

                  setImageMode(

                    'upload'

                  );

                  setError('');

                }}

              >

                Upload Image

              </button>

            </div>



            {/* IMAGE URL */}



            {imageMode === 'url' && (

              <label>

                Image URL



                <input

                  type="url"

                  value={

                    editing.image_url ||

                    ''

                  }

                  onChange={(e) =>

                    setEditing({

                      ...editing,

                      image_url:

                        e.target.value,

                    })

                  }

                  placeholder="https\://example.com/image.jpg"

                />

              </label>

            )}



            {/* FILE UPLOAD */}



            {imageMode ===

              'upload' && (

                <label>

                  Upload Image



                  <input

                    type="file"

                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"

                    onChange={

                      handleFileChange

                    }

                  />



                  <small

                    style={{

                      display:

                        'block',

                      marginTop:

                        '6px',

                    }}

                  >

                    JPG, JPEG, PNG or

                    WEBP · Maximum 5 MB

                  </small>

                </label>

              )}



            <div className="grid2">

              <label>

                Title



                <span

                  style={{

                    fontWeight:

                      'normal',

                    fontSize:

                      '12px',

                  }}

                >

                  {' '}

                  (optional)

                </span>



                <input

                  value={

                    editing.title ||

                    ''

                  }

                  onChange={(e) =>

                    setEditing({

                      ...editing,

                      title:

                        e.target.value,

                    })

                  }

                  placeholder="Temple Entrance"

                />

              </label>



              <label>

                Category



                <span

                  style={{

                    fontWeight:

                      'normal',

                    fontSize:

                      '12px',

                  }}

                >

                  {' '}

                  (optional)

                </span>



                <input

                  value={

                    editing.category ||

                    ''

                  }

                  onChange={(e) =>

                    setEditing({

                      ...editing,

                      category:

                        e.target.value,

                    })

                  }

                  placeholder="Temple"

                />

              </label>

            </div>



            <label>

              Description



              <span

                style={{

                  fontWeight:

                    'normal',

                  fontSize: '12px',

                }}

              >

                {' '}

                (optional)

              </span>



              <textarea

                value={

                  editing.description ||

                  ''

                }

                onChange={(e) =>

                  setEditing({

                    ...editing,

                    description:

                      e.target.value,

                  })

                }

                placeholder="Optional description"

              />

            </label>



            {/* PREVIEW */}



            {editing.image_url && (

              <img

                className="preview"

                src={

                  editing.image_url.startsWith(

                    '/uploads/'

                  )

                    ? `${window.location.origin}${editing.image_url}`

                    : editing.image_url

                }

                alt={

                  editing.title ||

                  'Gallery preview'

                }

              />

            )}



            <div className="actions">

              <button

                type="button"

                onClick={() => {

                  setEditing(null);

                  setSelectedFile(

                    null

                  );

                }}

                disabled={busy}

              >

                Cancel

              </button>



              <button

                type="submit"

                className="primary"

                disabled={busy}

              >

                {busy

                  ? 'Saving…'

                  : editing.id

                    ? 'Save Changes'

                    : 'Add Image'}

              </button>

            </div>

          </form>

        )}



        {/* =====================================

            EXISTING GALLERY IMAGES

            ===================================== */}



        <div

          style={{

            marginTop: '24px',

            marginBottom: '12px',

          }}

        >

          <h3>

            Gallery Images

          </h3>



          <p>

            Existing and newly uploaded

            gallery photos.

          </p>

        </div>



        <div className="gallery-grid">

          {items.map((x) => (

            <div

              className="gallery-card"

              key={x.id}

            >

              {x.image_url ? (

                <img

                  src={

                    x.image_url.startsWith(

                      '/uploads/'

                    )

                      ? `${window.location.origin}${x.image_url}`

                      : x.image_url

                  }

                  alt={

                    x.title ||

                    'Gallery image'

                  }

                />

              ) : (

                <div className="gallery-empty">

                  No image

                </div>

              )}



              <div className="gallery-body">

                <strong>

                  {x.title ||

                    'Gallery Image'}

                </strong>



                {/* HEADING */}



                <div

                  style={{

                    marginTop:

                      '6px',

                    marginBottom:

                      '6px',

                  }}

                >

                  <span className="badge">

                    {x.album_name ||

                      'Unassigned'}

                  </span>

                </div>



                {x.category && (

                  <span>

                    {x.category}

                  </span>

                )}



                {x.description && (

                  <p>

                    {x.description}

                  </p>

                )}



                <div className="actions">

                  <button

                    type="button"

                    onClick={() =>

                      openEditForm(x)

                    }

                    disabled={

                      deletingId !==

                      null

                    }

                  >

                    Edit

                  </button>



                  <button

                    type="button"

                    className="danger"

                    onClick={() =>

                      handleDeleteGallery(

                        x.id

                      )

                    }

                    disabled={

                      deletingId !==

                      null

                    }

                  >

                    {deletingId ===

                      x.id

                      ? 'Deleting…'

                      : 'Delete'}

                  </button>

                </div>

              </div>

            </div>

          ))}

        </div>

      </Page>

    );

  }

  function Page({

    title,

    subtitle,

    action,

    children,

  }: {

    title: string;

    subtitle: string;

    action?: React.ReactNode;

    children: React.ReactNode;

  }) {

    return (

      <main className="content">

        <div className="page-head">

          <div>

            <h2>{title}</h2>

            <p>{subtitle}</p>

          </div>



          {action}

        </div>



        {children}

      </main>

    );

  }



  function App() {

    const [user, setUser] =

      useState<User | null>(() => {

        const raw =

          localStorage.getItem(

            'temple_admin_user'

          );



        return raw

          ? JSON.parse(raw)

          : null;

      });



    const [page, setPage] =

      useState('dashboard');



    if (!user) {

      return (

        <Login

          onLogin={(u) =>

            setUser(u)

          }

        />

      );

    }



    function logout() {

      clearAdminSession();

      setUser(null);

    }



    return (

      <div className="app">



        <aside>

          <div className="side-brand">

            <span>

              ॐ

            </span>



            <div>

              <strong>

                Temple Admin

              </strong>



              <small>

                Management Portal

              </small>

            </div>

          </div>



          <nav>

            {nav.map(

              ([id, label]) => (

                <button

                  type="button"

                  className={

                    page === id

                      ? 'active'

                      : ''

                  }

                  key={id}

                  onClick={() =>

                    setPage(id)

                  }

                >

                  {label}

                </button>

              )

            )}

          </nav>



          <div className="side-bottom">

            <div className="admin-user">

              <strong>

                {user.full_name}

              </strong>



              <small>

                {user.email}

              </small>

            </div>



            <button

              type="button"

              onClick={logout}

            >

              Sign out

            </button>

          </div>

        </aside>



        {page === 'dashboard' && (

          <Dashboard />

        )}



        {page === 'deities' && (

          <Deities />

        )}

        {page === 'guru-parampara' && (
          <GuruParampara />
        )}
        {page === 'guru-vani' && (
          <GuruVani />
        )}

        {page === 'welcome-slokams' && (
    <WelcomeSlokams />
  )}
  {page === 'welcome-screen' && (
  <WelcomeScreen />
)}

        {page === 'pooja-services' && (
          <PoojaServices />
        )}

        {page === 'nearby-places' && (
          <NearbyPlaces />
        )}


        {page === 'publications' && (
          <Page
            title="Publications"
            subtitle="Manage publication categories and publications"
          >
            <Publications />
          </Page>
        )}


        {page === 'activities' && (

          <Activities />

        )}



        {page === 'gallery' && (

          <Gallery />

        )}



        {page === 'users' && (

          <Users />

        )}





        {page === 'events' && (

          <Events />

        )}

        {page === 'dharma-sandeham' && (

          <DharmaSandeham />

        )}



        {page === 'darshan' && (

          <Darshan />

        )}

        {page === 'darshan-videos' && (

          <DarshanVideos />

        )}

        {page === 'announcements' && <Announcements />}
        {/* ========================================
      TEMPLE CONTACT SETTINGS
  ======================================== */}

        {page === 'temple-contact' && (
          <TempleContact />
        )}

      </div>

    );

  }



  createRoot(

    document.getElementById('root')!

  ).render(

    <React.StrictMode>

      <App />

    </React.StrictMode>

  );
