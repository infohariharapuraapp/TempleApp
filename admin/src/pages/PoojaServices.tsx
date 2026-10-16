
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

type PoojaSection = {
  id: number;
  name: string;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
};

type Pooja = {
  id: number;
  section_id: number;
  section_name: string;
  name: string;
  description: string | null;
  price: string | number;
  display_order: number;
  is_active: boolean;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

type SectionForm = {
  id?: number;
  name: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
};

type PoojaForm = {
  id?: number;
  section_id: number;
  name: string;
  description: string;
  price: string;
  display_order: number;
  is_active: boolean;
};

const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Something went wrong';

export default function PoojaServices() {
  const [tab, setTab] =
    useState<'sections' | 'poojas'>('sections');

  const [sections, setSections] =
    useState<PoojaSection[]>([]);

  const [poojas, setPoojas] =
    useState<Pooja[]>([]);

  const [sectionForm, setSectionForm] =
    useState<SectionForm | null>(null);

  const [poojaForm, setPoojaForm] =
    useState<PoojaForm | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadData() {
    try {
      const [sectionResponse, poojaResponse] =
        await Promise.all([
          apiRequest<ApiResponse<PoojaSection[]>>(
            '/admin/poojas/sections'
          ),
          apiRequest<ApiResponse<Pooja[]>>(
            '/admin/poojas'
          ),
        ]);

      setSections(sectionResponse.data || []);
      setPoojas(poojaResponse.data || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function resetMessages() {
    setError('');
    setMessage('');
  }

  function addSection() {
    resetMessages();
    setTab('sections');
    setSectionForm({
      name: '',
      image_url: '',
      display_order: 0,
      is_active: true,
    });
  }

  function editSection(section: PoojaSection) {
    resetMessages();
    setSectionForm({
      ...section,
      image_url: section.image_url || '',
    });
  }

  async function saveSection(e: React.FormEvent) {
    e.preventDefault();
    if (!sectionForm || busy) return;

    if (!sectionForm.name.trim()) {
      setError('Section name is required.');
      return;
    }

    if (
      !Number.isSafeInteger(
        Number(sectionForm.display_order)
      ) ||
      sectionForm.display_order < 0
    ) {
      setError('Enter a valid display order.');
      return;
    }

    setBusy(true);
    resetMessages();

    try {
      await apiRequest(
        sectionForm.id
          ? `/admin/poojas/sections/${sectionForm.id}`
          : '/admin/poojas/sections',
        {
          method: sectionForm.id ? 'PUT' : 'POST',
          body: JSON.stringify({
            name: sectionForm.name.trim(),
            image_url:
              sectionForm.image_url.trim() || null,
            display_order:
              Number(sectionForm.display_order),
            is_active: sectionForm.is_active,
          }),
        }
      );

      setSectionForm(null);
      await loadData();
      setMessage('Pooja section saved successfully.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function addPooja(sectionId?: number) {
    resetMessages();
    setTab('poojas');
    setPoojaForm({
      section_id:
        sectionId ||
        sections.find(s => s.is_active)?.id ||
        0,
      name: '',
      description: '',
      price: '',
      display_order: 0,
      is_active: true,
    });
  }

  function editPooja(pooja: Pooja) {
    resetMessages();
    setPoojaForm({
      ...pooja,
      description: pooja.description || '',
      price: String(pooja.price),
    });
  }

  async function savePooja(e: React.FormEvent) {
    e.preventDefault();
    if (!poojaForm || busy) return;

    const price = Number(poojaForm.price);

    if (
      !poojaForm.section_id ||
      !poojaForm.name.trim() ||
      poojaForm.price.trim() === '' ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 99999999.99
    ) {
      setError('Enter valid pooja details and price.');
      return;
    }

    if (
      !Number.isSafeInteger(poojaForm.display_order) ||
      poojaForm.display_order < 0
    ) {
      setError('Enter a valid display order.');
      return;
    }

    setBusy(true);
    resetMessages();

    try {
      await apiRequest(
        poojaForm.id
          ? `/admin/poojas/${poojaForm.id}`
          : '/admin/poojas',
        {
          method: poojaForm.id ? 'PUT' : 'POST',
          body: JSON.stringify({
            section_id: poojaForm.section_id,
            name: poojaForm.name.trim(),
            description:
              poojaForm.description.trim() || null,
            price,
            display_order:
              poojaForm.display_order,
            is_active: poojaForm.is_active,
          }),
        }
      );

      setPoojaForm(null);
      await loadData();
      setMessage('Pooja saved successfully.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(
    type: 'section' | 'pooja',
    id: number,
    active: boolean
  ) {
    if (busy) return;

    const confirmed = window.confirm(
      `${active ? 'Activate' : 'Deactivate'} this ${
        type === 'section' ? 'section' : 'pooja'
      }?`
    );

    if (!confirmed) return;

    setBusy(true);
    resetMessages();

    try {
      const endpoint =
        type === 'section'
          ? `/admin/poojas/sections/${id}`
          : `/admin/poojas/${id}`;

      await apiRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify({
          is_active: active,
        }),
      });

      await loadData();
      setMessage('Status updated successfully.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const activeSections = sections.filter(
    section => section.is_active
  );

  const currency = (value: string | number) =>
    `₹${Number(value).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <main className="content">
      <div className="page-head">
        <div>
          <h2>Pooja Services</h2>
          <p>
            Manage pooja sections, details and prices
          </p>
        </div>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="panel">
          {message}
        </div>
      )}

      <div
        className="actions"
        style={{ marginBottom: 20 }}
      >
        <button
          type="button"
          className={
            tab === 'sections' ? 'primary' : ''
          }
          onClick={() => setTab('sections')}
        >
          Pooja Sections ({sections.length})
        </button>

        <button
          type="button"
          className={tab === 'poojas' ? 'primary' : ''}
          onClick={() => setTab('poojas')}
        >
          Poojas ({poojas.length})
        </button>
      </div>

      {loading ? (
        <div className="panel">
          Loading Pooja Services...
        </div>
      ) : (
        <>
          {tab === 'sections' && (
            <>
              <div
                className="actions"
                style={{ marginBottom: 20 }}
              >
                <button
                  type="button"
                  className="primary"
                  onClick={addSection}
                  disabled={busy}
                >
                  + Create Pooja Section
                </button>
              </div>

              {sectionForm && (
                <form
                  className="form-card"
                  onSubmit={saveSection}
                >
                  <h3>
                    {sectionForm.id
                      ? 'Edit Pooja Section'
                      : 'Create Pooja Section'}
                  </h3>

                  <div className="grid2">
                    <label>
                      Section Name
                      <input
                        required
                        maxLength={255}
                        value={sectionForm.name}
                        onChange={e =>
                          setSectionForm({
                            ...sectionForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="Abhishekam"
                      />
                    </label>

                    <label>
                      Display Order
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={sectionForm.display_order}
                        onChange={e =>
                          setSectionForm({
                            ...sectionForm,
                            display_order:
                              Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>

                  <label>
                    Section Image URL
                    <input
                      type="url"
                      value={sectionForm.image_url}
                      onChange={e =>
                        setSectionForm({
                          ...sectionForm,
                          image_url: e.target.value,
                        })
                      }
                      placeholder="https://example.com/pooja.jpg"
                    />
                  </label>

                  {sectionForm.image_url && (
                    <img
                      src={sectionForm.image_url}
                      alt="Section preview"
                      style={{
                        width: 180,
                        height: 120,
                        objectFit: 'cover',
                        borderRadius: 10,
                        marginBottom: 12,
                      }}
                    />
                  )}

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sectionForm.is_active}
                      onChange={e =>
                        setSectionForm({
                          ...sectionForm,
                          is_active: e.target.checked,
                        })
                      }
                    />
                    Active
                  </label>

                  <div className="actions">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setSectionForm(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="primary"
                      disabled={busy}
                    >
                      {busy ? 'Saving...' : 'Save Section'}
                    </button>
                  </div>
                </form>
              )}

              <div className="panel">
                <h3>Pooja Sections</h3>

                {sections.length === 0 ? (
                  <p>
                    No sections yet. Create your first
                    pooja section.
                  </p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Image</th>
                          <th>Name</th>
                          <th>Poojas</th>
                          <th>Order</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sections.map(section => (
                          <tr key={section.id}>
                            <td>
                              {section.image_url ? (
                                <img
                                  className="thumb"
                                  src={section.image_url}
                                  alt={section.name}
                                />
                              ) : (
                                <div className="thumb empty">
                                  —
                                </div>
                              )}
                            </td>
                            <td>
                              <strong>{section.name}</strong>
                            </td>
                            <td>
                              {poojas.filter(
                                p => p.section_id === section.id
                              ).length}
                            </td>
                            <td>{section.display_order}</td>
                            <td>
                              <span className="badge">
                                {section.is_active
                                  ? 'Active'
                                  : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <div className="actions">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    editSection(section)
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={busy || !section.is_active}
                                  onClick={() =>
                                    addPooja(section.id)
                                  }
                                >
                                  + Pooja
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void changeStatus(
                                      'section',
                                      section.id,
                                      !section.is_active
                                    )
                                  }
                                >
                                  {section.is_active
                                    ? 'Deactivate'
                                    : 'Activate'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'poojas' && (
            <>
              <div
                className="actions"
                style={{ marginBottom: 20 }}
              >
                <button
                  type="button"
                  className="primary"
                  disabled={
                    busy || activeSections.length === 0
                  }
                  onClick={() => addPooja()}
                >
                  + Add Pooja
                </button>
              </div>

              {activeSections.length === 0 && (
                <div className="panel">
                  Create and activate a pooja section
                  before adding poojas.
                </div>
              )}

              {poojaForm && (
                <form
                  className="form-card"
                  onSubmit={savePooja}
                >
                  <h3>
                    {poojaForm.id
                      ? 'Edit Pooja'
                      : 'Add Pooja'}
                  </h3>

                  <div className="grid2">
                    <label>
                      Pooja Section
                      <select
                        required
                        value={poojaForm.section_id || ''}
                        onChange={e =>
                          setPoojaForm({
                            ...poojaForm,
                            section_id:
                              Number(e.target.value),
                          })
                        }
                      >
                        <option value="">
                          Select Section
                        </option>
                        {sections
                          .filter(
                            s =>
                              s.is_active ||
                              s.id === poojaForm.section_id
                          )
                          .map(section => (
                            <option
                              key={section.id}
                              value={section.id}
                            >
                              {section.name}
                            </option>
                          ))}
                      </select>
                    </label>

                    <label>
                      Pooja Name
                      <input
                        required
                        maxLength={255}
                        value={poojaForm.name}
                        onChange={e =>
                          setPoojaForm({
                            ...poojaForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="Special Abhishekam"
                      />
                    </label>
                  </div>

                  <label>
                    Description (optional)
                    <textarea
                      value={poojaForm.description}
                      onChange={e =>
                        setPoojaForm({
                          ...poojaForm,
                          description: e.target.value,
                        })
                      }
                      placeholder="Enter pooja details"
                    />
                  </label>

                  <div className="grid2">
                    <label>
                      Price (₹)
                      <input
                        type="number"
                        min="0"
                        max="99999999.99"
                        step="0.01"
                        required
                        value={poojaForm.price}
                        onChange={e =>
                          setPoojaForm({
                            ...poojaForm,
                            price: e.target.value,
                          })
                        }
                        placeholder="500"
                      />
                    </label>

                    <label>
                      Display Order
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={poojaForm.display_order}
                        onChange={e =>
                          setPoojaForm({
                            ...poojaForm,
                            display_order:
                              Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={poojaForm.is_active}
                      onChange={e =>
                        setPoojaForm({
                          ...poojaForm,
                          is_active: e.target.checked,
                        })
                      }
                    />
                    Active
                  </label>

                  <div className="actions">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPoojaForm(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="primary"
                      disabled={busy}
                    >
                      {busy ? 'Saving...' : 'Save Pooja'}
                    </button>
                  </div>
                </form>
              )}

              <div className="panel">
                <h3>Manage Poojas</h3>

                {poojas.length === 0 ? (
                  <p>No poojas added yet.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Pooja</th>
                          <th>Section</th>
                          <th>Price</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poojas.map(pooja => (
                          <tr key={pooja.id}>
                            <td>
                              <strong>{pooja.name}</strong>
                              {pooja.description && (
                                <div>
                                  <small>
                                    {pooja.description}
                                  </small>
                                </div>
                              )}
                            </td>
                            <td>{pooja.section_name}</td>
                            <td>{currency(pooja.price)}</td>
                            <td>
                              <span className="badge">
                                {pooja.is_active
                                  ? 'Active'
                                  : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <div className="actions">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    editPooja(pooja)
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void changeStatus(
                                      'pooja',
                                      pooja.id,
                                      !pooja.is_active
                                    )
                                  }
                                >
                                  {pooja.is_active
                                    ? 'Deactivate'
                                    : 'Activate'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
