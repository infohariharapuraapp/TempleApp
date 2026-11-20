import './VolunteerSeva.css';
import {
  hasVolunteerUnsavedChanges,
  useVolunteerUnsavedChanges,
} from '../lib/volunteerUnsavedChangesGuard';
import {
  pushAdminHistory,
  replaceAdminHistory,
} from '../lib/adminNavigationHistory';
import {
  beginVolunteerOperation,
  canLeaveVolunteerWorkspace,
  useVolunteerOperationBusy,
} from '../lib/volunteerOperationGuard';
import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  readProgrammeSelection,
  writeProgrammeSelection,
} from './volunteer/programmeNavigation';
import DailyReporting from './volunteer/DailyReporting';
import Assignments from './volunteer/Assignments';
import AttendanceManager from './volunteer/AttendanceManager';

import Completion from './volunteer/Completion';
import Certificates from './volunteer/Certificates';

import IdCards from './volunteer/IdCards';
import Accommodation from './volunteer/Accommodation';

import Duties from './volunteer/Duties';
import Shifts from './volunteer/Shifts';
import Requirements from './volunteer/Requirements';
import Registrations from './volunteer/Registrations';

import {
  uploadVolunteerImage,
} from '../lib/volunteerApi';

import { apiRequest } from '../lib/api';

// ========================================
// API CONFIGURATION
// ========================================

const BASE = '/admin/volunteer';

type RegistrationStatus =
  | 'draft'
  | 'upcoming'
  | 'open'
  | 'closed';

// ========================================
// TYPES
// ========================================

type AttendanceMode =
  | 'legacy'
  | 'simple'
  | 'detailed'
  | 'none';
type OpportunityForm = {
  attendance_mode: AttendanceMode;
  accommodation_enabled: boolean;
  title: string;
  description: string;
  instructions: string;
  image_url: string;

  registration_start_at: string;
  registration_end_at: string;

  service_start_date: string;
  service_end_date: string;

  required_volunteers: number;

  allow_individual: boolean;
  allow_group: boolean;

  minimum_group_size: number;
  maximum_group_size: number;
};

type Opportunity = OpportunityForm & {
  id: number;

  is_published: boolean;
  registration_enabled: boolean;

  registration_status: RegistrationStatus;

  total_registrations: number;
  registered_volunteers: number;
  approved_volunteers: number;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

type Section =
  | 'overview'
  | 'opportunities'
  | 'registrations'
  | 'reporting'
  | 'duties'
  | 'shifts'
  | 'requirements'
  | 'assignments'
  | 'attendance'
  | 'id-cards'
  | 'accommodation'
  | 'completion'
  | 'certificates';

// ========================================
// DEFAULT FORM
// ========================================

const emptyForm: OpportunityForm = {
  attendance_mode: 'simple',
  accommodation_enabled: false,
  title: '',
  description: '',
  instructions: '',
  image_url: '',

  registration_start_at: '',
  registration_end_at: '',

  service_start_date: '',
  service_end_date: '',

  required_volunteers: 100,

  allow_individual: true,
  allow_group: true,

  minimum_group_size: 10,
  maximum_group_size: 100,
};

// ========================================
// DATE AND TIME HELPERS
// ========================================

function toISTInput(
  value: string | null | undefined
): string {
  if (!value) return '';

  const time = Date.parse(value);

  if (!Number.isFinite(time)) return '';

  return new Date(
    time + 330 * 60 * 1000
  )
    .toISOString()
    .slice(0, 16);
}

function toISTTimestamp(
  value: string
): string {
  if (!value) return '';

  return `${value}:00+05:30`;
}

function formatDateTime(
  value: string
): string {
  const time = new Date(value);

  if (Number.isNaN(time.getTime())) {
    return '—';
  }

  return time.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDate(value: string): string {
  if (!value) return '—';

  const parts = value.slice(0, 10).split('-');

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : value;
}

function errorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

// ========================================
// REQUEST HELPER
// ========================================

async function volunteerRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const controller = new AbortController();

  const timer = window.setTimeout(() => {
    controller.abort();
  }, 45000);

  try {
    const response =
      await apiRequest<ApiResponse<T>>(
        `${BASE}${endpoint}`,
        {
          ...options,
          signal: controller.signal,
        }
      );

    if (!response.success) {
      throw new Error(
        response.message ||
          'Volunteer request failed.'
      );
    }

    return response;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        'Request timed out. Refresh the records before retrying a change.'
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

// ========================================
// MAIN COMPONENT
// ========================================

export default function VolunteerSeva() {
  const volunteerOperationBusy = useVolunteerOperationBusy();
  const validSections: Section[] = [
    'overview',
    'opportunities',
    'registrations',
    'reporting',
    'duties',
    'shifts',
    'requirements',
    'assignments',
    'attendance',
    'id-cards',
    'accommodation',
    'completion',
    'certificates',
  ];
  function readSection(): Section {
    const requested = new URLSearchParams(
      window.location.search
    ).get('section');
    return validSections.includes(requested as Section)
      ? requested as Section
      : 'overview';
  }
  const [section, setCurrentSection] =
    useState<Section>(readSection);
  useEffect(() => {
    function restoreSection() {
      clearWorkspaceDrafts();
      setCurrentSection(readSection());
    }
    window.addEventListener(
      'popstate',
      restoreSection
    );
    return () => {
      window.removeEventListener(
        'popstate',
        restoreSection
      );
    };
  }, []);
  function setSection(nextSection: Section): boolean {
    if (!validSections.includes(nextSection)) {
      return false;
    }
    if (
      nextSection === 'accommodation' &&
      !accommodationAvailable
    ) {
      return false;
    }
    if (nextSection === section) {
      return true;
    }
    if (!canLeaveVolunteerWorkspace()) {
      return false;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('page', 'volunteer-seva');
    if (nextSection === 'overview') {
      url.searchParams.delete('section');
    } else {
      url.searchParams.set('section', nextSection);
    }
    if (url.href !== window.location.href) {
      if (!pushAdminHistory(url.href)) {
        return false;
      }
    }
    clearWorkspaceDrafts();
    setCurrentSection(nextSection);
    return true;
  }
  const [items, setItems] =
    useState<Opportunity[]>([]);

  const [editing, setEditing] =
    useState<OpportunityForm | null>(null);

  const [editingId, setEditingId] =
    useState<number | null>(null);
  const editingBaseline =
    useRef<OpportunityForm | null>(null);
  const extensionBaseline =
    useRef<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

    const [uploadingImage, setUploadingImage] =
  useState(false);

const imageUploadLock = useRef(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [filter, setFilter] =
    useState('all');

  const [loaded, setLoaded] =
    useState(false);
  const [selectedProgrammeId, setSelectedProgrammeId] =
    useState('');
  useEffect(() => {
    if (!loaded) return;
    function restoreProgramme() {
      setSelectedProgrammeId(
        readProgrammeSelection(items)
      );
    }
    restoreProgramme();
    window.addEventListener(
      'popstate',
      restoreProgramme
    );
    return () => {
      window.removeEventListener(
        'popstate',
        restoreProgramme
      );
    };
  }, [items, loaded]);
  function selectProgramme(value: string) {
    if (busy || loading || requiresRefresh) return;
    if (value === selectedProgrammeId) return;
    if (
      value &&
      !items.some(item => String(item.id) === value)
    ) {
      return;
    }
    const hadUnsavedChanges =
      hasVolunteerUnsavedChanges();
    if (!canLeaveVolunteerWorkspace()) return;
    const operationalSections: Section[] = [
      'registrations',
      'attendance',
      'reporting',
      'shifts',
      'requirements',
      'assignments',
      'id-cards',
      'accommodation',
      'completion',
      'certificates',
    ];
    if (
      operationalSections.includes(section) &&
      !hadUnsavedChanges
    ) {
      if (selectedProgrammeId && !window.confirm(
        'Changing programme resets this workspace. Make sure all operations are finished and changes are saved. Continue?'
      )) {
        return;
      }
    }
    writeProgrammeSelection(value);
    if (readProgrammeSelection(items) !== value) {
      return;
    }
    clearWorkspaceDrafts();
    setSelectedProgrammeId(value);
  }
  const selectedProgramme = items.find(
    item => String(item.id) === selectedProgrammeId
  );
  const accommodationAvailable =
    loaded &&
    selectedProgramme?.accommodation_enabled === true;
  // Wait for programme restoration before
  // correcting an unavailable accommodation route.
  useEffect(() => {
    if (
      !loaded ||
      loading ||
      volunteerOperationBusy ||
      section !== 'accommodation'
    ) {
      return;
    }
    const restoredProgrammeId =
      readProgrammeSelection(items);
    // The URL selection may have changed before
    // React finishes restoring programme state.
    if (
      restoredProgrammeId !== selectedProgrammeId
    ) {
      return;
    }
    if (accommodationAvailable) {
      return;
    }
    const url = new URL(window.location.href);
    if (
      url.searchParams.get('page') !==
      'volunteer-seva'
    ) {
      return;
    }
    if (
      url.searchParams.get('section') !==
      'accommodation'
    ) {
      return;
    }
    url.searchParams.delete('section');
    // Replace invalid routes instead of creating
    // another browser history entry.
    if (!replaceAdminHistory(url.href)) {
      return;
    }
    setCurrentSection('overview');
  }, [
    loaded,
    loading,
    volunteerOperationBusy,
    section,
    accommodationAvailable,
    selectedProgrammeId,
    items,
  ]);

  const [requiresRefresh, setRequiresRefresh] =
    useState(false);

  const [extension, setExtension] =
    useState<{
      id: number;
      title: string;
      deadline: string;
    } | null>(null);

  const programmeDirty =
    editing !== null &&
    editingBaseline.current !== null &&
    JSON.stringify(editing) !==
      JSON.stringify(editingBaseline.current);
  const deadlineDirty =
    extension !== null &&
    extensionBaseline.current !== null &&
    extension.deadline !== extensionBaseline.current;
  useVolunteerUnsavedChanges(
    'Seva opportunity form',
    programmeDirty
  );
  useVolunteerUnsavedChanges(
    'Registration deadline form',
    deadlineDirty
  );
  function clearProgrammeDraft() {
    editingBaseline.current = null;
    setEditing(null);
    setEditingId(null);
  }
  function clearDeadlineDraft() {
    extensionBaseline.current = null;
    setExtension(null);
  }
  function clearWorkspaceDrafts() {
    clearProgrammeDraft();
    clearDeadlineDraft();
  }
  function cancelProgrammeDraft() {
    if (!canLeaveVolunteerWorkspace()) return;
    clearProgrammeDraft();
  }
  function cancelDeadlineDraft() {
    if (!canLeaveVolunteerWorkspace()) return;
    clearDeadlineDraft();
  }
  const mutationRunning = useRef(false);
  const loadVersion = useRef(0);

  // ========================================
  // LOAD OPPORTUNITIES
  // ========================================

  async function load(): Promise<boolean> {
    const version = ++loadVersion.current;

    setLoading(true);
    setError('');

    try {
      const response =
        await volunteerRequest<Opportunity[]>(
          '/opportunities',
          { cache: 'no-store' }
        );

      if (!Array.isArray(response.data)) {
        throw new Error(
          'Invalid opportunity response.'
        );
      }

      if (version !== loadVersion.current) {
        return false;
      }

      setItems(response.data);
      setLoaded(true);
      setRequiresRefresh(false);

      return true;
    } catch (err) {
      if (version === loadVersion.current) {
        setError(
          errorMessage(
            err,
            'Unable to load opportunities.'
          )
        );
      }

      return false;
    } finally {
      if (version === loadVersion.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void load();

    return () => {
      loadVersion.current++;
    };
  }, []);

  // ========================================
  // MUTATION HANDLER
  // ========================================

  async function mutate(
    task: () => Promise<unknown>,
    message: string,
    onSuccess?: () => void
  ) {
    if (
      mutationRunning.current ||
      requiresRefresh ||
      loading
    ) {
      return;
    }

    const releaseOperation = beginVolunteerOperation(
      'Seva opportunity update'
    );
    mutationRunning.current = true;

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await task();

      onSuccess?.();

      setSuccess(message);

      const refreshed = await load();

      if (!refreshed) {
        setRequiresRefresh(true);
      }
    } catch (err) {
      setError(
        errorMessage(err, 'Operation failed.')
      );

      setRequiresRefresh(true);
    } finally {
      mutationRunning.current = false;
      setBusy(false);
      releaseOperation();
    }
  }

  // ========================================
  // CREATE AND EDIT
  // ========================================

  function prepareProgrammeForm(): boolean {
    if (
      busy ||
      loading ||
      requiresRefresh ||
      imageUploadLock.current
    ) {
      return false;
    }
    if (section === 'opportunities') {
      return canLeaveVolunteerWorkspace();
    }
    return setSection('opportunities');
  }
  function add() {
    if (!prepareProgrammeForm()) return;
    clearWorkspaceDrafts();
    const initialForm = { ...emptyForm };
    editingBaseline.current = { ...initialForm };
    setEditingId(null);
    setEditing(initialForm);
    setError('');
    setSuccess('');
  }

  function edit(item: Opportunity) {
    if (
      typeof item.accommodation_enabled !== 'boolean'
    ) {
      setError(
        'Programme configuration is unavailable. Refresh after the server update before editing.'
      );
      return;
    }
    if (!prepareProgrammeForm()) return;
    clearWorkspaceDrafts();
    setEditingId(item.id);
    const initialForm: OpportunityForm = {
      attendance_mode:
        item.attendance_mode ?? 'legacy',
      accommodation_enabled:
        item.accommodation_enabled === true,
      title: item.title,
      description: item.description || '',
      instructions: item.instructions || '',
      image_url: item.image_url || '',

      registration_start_at:
        toISTInput(item.registration_start_at),

      registration_end_at:
        toISTInput(item.registration_end_at),

      service_start_date:
        item.service_start_date.slice(0, 10),

      service_end_date:
        item.service_end_date.slice(0, 10),

      required_volunteers:
        item.required_volunteers,

      allow_individual:
        item.allow_individual,

      allow_group:
        item.allow_group,

      minimum_group_size:
        item.minimum_group_size,

      maximum_group_size:
        item.maximum_group_size,
    };
    editingBaseline.current = { ...initialForm };
    setEditing(initialForm);

    setError('');
    setSuccess('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function update<K extends keyof OpportunityForm>(
    key: K,
    value: OpportunityForm[K]
  ) {
    setEditing((current) =>
      current
        ? { ...current, [key]: value }
        : null
    );
  }

  // ========================================
  // FORM VALIDATION
  // ========================================

  function validate(
    form: OpportunityForm
  ): string | null {
    if (
      !form.title.trim() ||
      form.title.trim().length > 255
    ) {
      return 'Enter a valid opportunity title.';
    }

    const start = Date.parse(
      toISTTimestamp(form.registration_start_at)
    );

    const end = Date.parse(
      toISTTimestamp(form.registration_end_at)
    );

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end)
    ) {
      return 'Registration dates are required.';
    }

    if (end <= start) {
      return 'Registration end must be after start.';
    }

    if (
      !form.service_start_date ||
      !form.service_end_date
    ) {
      return 'Service dates are required.';
    }

    if (
      form.service_end_date <
      form.service_start_date
    ) {
      return 'Service end cannot be before start.';
    }

    const serviceEnd = Date.parse(
      `${form.service_end_date}T23:59:59.999+05:30`
    );

    if (end > serviceEnd) {
      return 'Registration must end within the service period.';
    }

    if (
      !Number.isInteger(form.required_volunteers) ||
      form.required_volunteers < 1 ||
      form.required_volunteers > 2147483647
    ) {
      return 'Required volunteers must be a positive integer.';
    }

    if (
      !form.allow_individual &&
      !form.allow_group
    ) {
      return 'Enable at least one registration type.';
    }

    if (
      !Number.isInteger(form.minimum_group_size) ||
      !Number.isInteger(form.maximum_group_size) ||
      form.minimum_group_size < 2 ||
      form.maximum_group_size > 2147483647 ||
      form.maximum_group_size <
        form.minimum_group_size
    ) {
      return 'Enter valid minimum and maximum group sizes.';
    }

    if (form.image_url.trim()) {
      try {
        const url = new URL(form.image_url);

        if (
          !['https:', 'http:'].includes(url.protocol)
        ) {
          throw new Error('Invalid protocol');
        }
      } catch {
        return 'Enter a valid image URL.';
      }
    }

    return null;
  }


  async function uploadCoverImage(file: File) {
  if (
    imageUploadLock.current ||
    busy ||
    loading ||
    requiresRefresh ||
    !editing
  ) {
    return;
  }

  const releaseOperation = beginVolunteerOperation(
    'Seva opportunity image upload'
  );
  imageUploadLock.current = true;

  setUploadingImage(true);
  setError('');

  try {
    const imageUrl =
      await uploadVolunteerImage(
        file,
        'opportunity'
      );

    setEditing(current =>
      current
        ? {
            ...current,
            image_url: imageUrl,
          }
        : null
    );
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : 'Unable to upload cover image.'
    );
  } finally {
    imageUploadLock.current = false;
    setUploadingImage(false);
    releaseOperation();
  }
}

  // ========================================
  // SAVE OPPORTUNITY
  // ========================================

  async function save(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (
      !editing ||
      busy ||
      uploadingImage ||
      imageUploadLock.current
    ) return;

    const validation = validate(editing);

    if (validation) {
      setError(validation);
      return;
    }

    const id = editingId;

    const body = {
      ...editing,

      title: editing.title.trim(),

      description:
        editing.description.trim() || null,

      instructions:
        editing.instructions.trim() || null,

      image_url:
        editing.image_url.trim() || null,

      registration_start_at:
        toISTTimestamp(
          editing.registration_start_at
        ),

      registration_end_at:
        toISTTimestamp(
          editing.registration_end_at
        ),
    };

    await mutate(
      () =>
        volunteerRequest(
          id
            ? `/opportunities/${id}`
            : '/opportunities',
          {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(body),
          }
        ),

      id
        ? 'Opportunity updated successfully.'
        : 'Opportunity created as a draft.',

      () => {
        clearProgrammeDraft();
      }
    );
  }

  // ========================================
  // PUBLISH / UNPUBLISH
  // ========================================

  async function togglePublish(
    item: Opportunity
  ) {
    const published = !item.is_published;

    const message = published
      ? `Publish "${item.title}"?`
      : `Unpublish "${item.title}"? Registration will also be disabled.`;

    if (!window.confirm(message)) return;

    await mutate(
      () =>
        volunteerRequest(
          `/opportunities/${item.id}/publish`,
          {
            method: 'PATCH',

            body: JSON.stringify({
              is_published: published,
            }),
          }
        ),

      published
        ? 'Opportunity published.'
        : 'Opportunity unpublished.'
    );
  }

  // ========================================
  // ENABLE / CLOSE REGISTRATION
  // ========================================

  async function toggleRegistration(
    item: Opportunity
  ) {
    const enabled =
      !item.registration_enabled;

    if (enabled && !item.is_published) {
      setError('Publish the opportunity first.');
      return;
    }

    if (
      !window.confirm(
        enabled
          ? 'Enable registration for the configured period?'
          : 'Close registration for this opportunity?'
      )
    ) {
      return;
    }

    await mutate(
      () =>
        volunteerRequest(
          `/opportunities/${item.id}/registration`,
          {
            method: 'PATCH',

            body: JSON.stringify({
              registration_enabled: enabled,
            }),
          }
        ),

      enabled
        ? 'Registration enabled.'
        : 'Registration closed.'
    );
  }

  // ========================================
  // EXTEND DEADLINE
  // ========================================

  async function extendDeadline(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!extension) return;

    const item = items.find(
      (row) => row.id === extension.id
    );

    if (!item) return;

    const deadline = toISTTimestamp(
      extension.deadline
    );

    const timestamp = Date.parse(deadline);

    if (
      !Number.isFinite(timestamp) ||
      timestamp <=
        Date.parse(item.registration_end_at) ||
      timestamp <= Date.now()
    ) {
      setError(
        'New deadline must be later than the existing deadline and current time.'
      );

      return;
    }

    const serviceEnd = Date.parse(
      `${item.service_end_date.slice(0, 10)}T23:59:59.999+05:30`
    );

    if (timestamp > serviceEnd) {
      setError(
        'Deadline cannot exceed the service period.'
      );
      return;
    }

    if (
      !window.confirm(
        'Extend the registration deadline?'
      )
    ) {
      return;
    }

    await mutate(
      () =>
        volunteerRequest(
          `/opportunities/${extension.id}/extend`,
          {
            method: 'PATCH',

            body: JSON.stringify({
              registration_end_at: deadline,
            }),
          }
        ),

      'Registration deadline extended.',

      () => clearDeadlineDraft()
    );
  }

  // ========================================
  // DASHBOARD STATISTICS
  // ========================================

  const stats = {
    opportunities: items.length,

    published: items.filter(
      (item) => item.is_published
    ).length,

    open: items.filter(
      (item) =>
        item.registration_status === 'open'
    ).length,

    registrations: items.reduce(
      (sum, item) =>
        sum + Number(item.total_registrations || 0),
      0
    ),

    volunteers: items.reduce(
      (sum, item) =>
        sum + Number(item.registered_volunteers || 0),
      0
    ),

    approved: items.reduce(
      (sum, item) =>
        sum + Number(item.approved_volunteers || 0),
      0
    ),
  };

  const filtered = items.filter((item) => {
    if (
      filter !== 'all' &&
      item.registration_status !== filter
    ) {
      return false;
    }

    const q = search.trim().toLowerCase();

    return (
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.description || '')
        .toLowerCase()
        .includes(q)
    );
  });

  const disabled =
    busy || loading || requiresRefresh || !loaded;

  const statusColors = {
    draft: '#64748b',
    upcoming: '#b45309',
    open: '#15803d',
    closed: '#b91c1c',
  };

  // ========================================
  // GUIDED PROGRAMME WORKFLOW
  // ========================================
  type WorkflowStage = {
    title: string;
    icon: string;
    description: string;
    actions: {
      key: Section;
      label: string;
    }[];
  };
  const attendanceMode =
    selectedProgramme?.attendance_mode ?? 'legacy';
  const isLegacy = attendanceMode === 'legacy';
  const hasAttendance = attendanceMode !== 'none';
  const workflow: WorkflowStage[] = [
    {
      title: 'Programme Setup',
      icon: '⚙',
      description:
        'Create the programme, configure service dates, publish and enable registration.',
      actions: [
        {
          key: 'opportunities',
          label: 'Manage Programmes',
        },
      ],
    },
    {
      title: 'Registration & Approval',
      icon: '♙',
      description:
        'Review individual and group applications, verify photographs and approve eligible volunteers.',
      actions: [
        {
          key: 'registrations',
          label: 'Review Registrations',
        },
      ],
    },
    {
      title: 'Volunteer ID Cards',
      icon: '▣',
      description:
        'Generate and issue digital ID cards to approved volunteers.',
      actions: [
        {
          key: 'id-cards',
          label: 'Manage ID Cards',
        },
      ],
    },
    {
      title: 'Service Preparation',
      icon: '▦',
      description: isLegacy
        ? 'Configure duties, shifts, requirements and volunteer assignments.'
        : 'Send reporting information and review volunteer availability.',
      actions: [
        {
          key: 'reporting',
          label: 'Daily Reporting',
        },
        ...(isLegacy ? [
          {
            key: 'duties' as Section,
            label: 'Duties',
          },
          {
            key: 'shifts' as Section,
            label: 'Service Shifts',
          },
          {
            key: 'requirements' as Section,
            label: 'Duty Requirements',
          },
          {
            key: 'assignments' as Section,
            label: 'Assignments',
          },
        ] : []),
        ...(accommodationAvailable ? [
          {
            key: 'accommodation' as Section,
            label: 'Accommodation',
          },
        ] : []),
      ],
    },
    ...(hasAttendance ? [{
      title: 'Attendance Management',
      icon: '✓',
      description:
        attendanceMode === 'simple'
          ? 'Mark volunteers present, absent or excused and finalise daily attendance.'
          : attendanceMode === 'detailed'
            ? 'Record check-in, check-out, attendance and actual service hours.'
            : 'Record and finalise duty and shift-based attendance.',
      actions: [
        {
          key: 'attendance' as Section,
          label: 'Manage Attendance',
        },
      ],
    }] : []),
    {
      title: 'Service Completion',
      icon: '◎',
      description:
        attendanceMode === 'none'
          ? 'Manually verify and complete volunteer service.'
          : 'Review completed service and finalised attendance before completion.',
      actions: [
        {
          key: 'completion',
          label: 'Review Completion',
        },
      ],
    },
    {
      title: 'Certificates',
      icon: '★',
      description:
        'Create certificate drafts, verify details and issue certificates.',
      actions: [
        {
          key: 'certificates',
          label: 'Manage Certificates',
        },
      ],
    },
  ];
  const activeStageIndex = workflow.findIndex(
    stage => stage.actions.some(
      action => action.key === section
    )
  );
  const activeStage = workflow[activeStageIndex];
  const navigationDisabled =
    busy ||
    loading ||
    volunteerOperationBusy;
  const modeLabel =
    attendanceMode === 'simple'
      ? 'Simple Attendance'
      : attendanceMode === 'detailed'
        ? 'Detailed Attendance'
        : attendanceMode === 'none'
          ? 'No Attendance Tracking'
          : 'Duty & Shift Based';
  function openWorkflowSection(key: Section) {
    if (navigationDisabled) return;
    if (setSection(key)) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }
  const registeredCount = Number(
    selectedProgramme?.registered_volunteers || 0
  );
  const approvedCount = Number(
    selectedProgramme?.approved_volunteers || 0
  );
  const requiredCount = Number(
    selectedProgramme?.required_volunteers || 0
  );
  const recruitmentPercentage =
    requiredCount > 0
      ? Math.round(
          approvedCount / requiredCount * 100
        )
      : 0;
  // ========================================
  // UI
  // ========================================

  return (
    <main className="content volunteer-dashboard">
      <header className="volunteer-dashboard-hero">
        <div className="volunteer-hero-copy">
          <span className="volunteer-eyebrow">
            DIVYAKSHETRA HARIHARAPURA
          </span>
          <h2>Volunteer Seva Management</h2>
          <p>
            A dedicated workspace to organise,
            guide and manage volunteer service.
          </p>
        </div>
        <div className="volunteer-hero-actions">
          <button
            type="button"
            disabled={navigationDisabled}
            onClick={() => {
              if (!canLeaveVolunteerWorkspace()) return;
              void load();
            }}
          >
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
          <button
            type="button"
            className="volunteer-gold-button"
            disabled={disabled || volunteerOperationBusy}
            onClick={add}
          >
            + Create Programme
          </button>
        </div>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {requiresRefresh && (
        <div className="panel" role="alert">
          Refresh the records before performing
          another change. This helps prevent
          duplicate submissions.
        </div>
      )}

      {success && (
        <div
          className="panel"
          role="status"
          style={{ color: '#15803d' }}
        >
          {success}
        </div>
      )}



      {(programmeDirty || deadlineDirty) && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            border: '1px solid #e5c98c',
            borderRadius: 10,
            background: '#FFF8E8',
            color: '#795318',
          }}
        >
          <strong>Unsaved changes</strong>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Save your changes before leaving this workspace.
          </div>
        </div>
      )}
      {volunteerOperationBusy && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            marginBottom: 16,
            border: '1px solid #e5c98c',
            borderRadius: 10,
            background: '#FFF8E8',
            color: '#795318',
          }}
        >
          <span
            aria-hidden="true"
            style={{ fontSize: 23 }}
          >
            &#9203;
          </span>
          <div>
            <strong>Operation in progress</strong>
            <div style={{
              fontSize: 13,
              marginTop: 4,
              lineHeight: 1.5,
            }}>
              Please wait while the operation finishes.
              Navigation will become available automatically.
            </div>
          </div>
        </div>
      )}
      <section className="volunteer-workspace">
        <div className="volunteer-workspace-heading">
          <div>
            <span className="volunteer-section-kicker">
              PROGRAMME WORKSPACE
            </span>
            <h3>Select your seva programme</h3>
            <p>
              All programme-specific operations use
              the selected programme.
            </p>
          </div>
          <button
            type="button"
            disabled={navigationDisabled}
            onClick={() => openWorkflowSection('overview')}
          >
            Dashboard Overview
          </button>
        </div>
        <select
          aria-label="Selected Seva Programme"
          className="volunteer-programme-select"
          value={selectedProgrammeId}
          disabled={
            navigationDisabled ||
            !loaded ||
            requiresRefresh
          }
          onChange={event =>
            selectProgramme(event.target.value)
          }
        >
          <option value="">Select a programme</option>
          {items.map(item => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        {selectedProgramme && (
          <div className="volunteer-programme-meta">
            <span>{modeLabel}</span>
            <span>
              {selectedProgramme.allow_individual &&
              selectedProgramme.allow_group
                ? 'Individual & Group'
                : selectedProgramme.allow_group
                  ? 'Group Registration'
                  : 'Individual Registration'}
            </span>
            <span>
              {selectedProgramme.registration_status}
            </span>
            <span>
              {formatDate(
                selectedProgramme.service_start_date
              )}
              {' - '}
              {formatDate(
                selectedProgramme.service_end_date
              )}
            </span>
            {accommodationAvailable && (
              <span>Accommodation Available</span>
            )}
          </div>
        )}
      </section>
      <nav
        className="volunteer-workflow-nav"
        aria-label="Programme workflow navigation"
      >
        {workflow.map((stage, index) => (
          <button
            type="button"
            key={stage.title}
            className={
              'volunteer-workflow-tab' +
              (activeStageIndex === index
                ? ' active'
                : '')
            }
            aria-current={
              activeStageIndex === index
                ? 'step'
                : undefined
            }
            disabled={navigationDisabled}
            onClick={() =>
              openWorkflowSection(
                stage.actions[0].key
              )
            }
          >
            <span className="volunteer-step-number">
              {index + 1}
            </span>
            <span>{stage.title}</span>
          </button>
        ))}
      </nav>
      {activeStage && (
        <section className="volunteer-current-stage">
          <span className="volunteer-section-kicker">
            WORKFLOW STAGE {activeStageIndex + 1}
            {' OF '}
            {workflow.length}
          </span>
          <h3>{activeStage.title}</h3>
          <p>{activeStage.description}</p>
          {activeStage.actions.length > 1 && (
            <div className="volunteer-stage-actions">
              {activeStage.actions.map(action => (
                <button
                  type="button"
                  key={action.key}
                  disabled={navigationDisabled}
                  className={
                    section === action.key
                      ? 'primary'
                      : ''
                  }
                  onClick={() =>
                    openWorkflowSection(action.key)
                  }
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {section === 'overview' && (
        <section className="volunteer-dashboard-stats">
          {(selectedProgramme ? [
            ['Registrations',
              Number(selectedProgramme.total_registrations || 0)],
            ['Registered Volunteers', registeredCount],
            ['Approved Volunteers', approvedCount],
            ['Required Volunteers', requiredCount],
          ] : [
            ['Total Programmes', stats.opportunities],
            ['Published', stats.published],
            ['Open Registrations', stats.open],
            ['Total Registrations', stats.registrations],
            ['Registered Volunteers', stats.volunteers],
            ['Approved Volunteers', stats.approved],
          ]).map(([label, count]) => (
            <article
              key={String(label)}
              className="volunteer-stat-card"
            >
              <span>{label}</span>
              <strong>
                {loaded ? count : '—'}
              </strong>
            </article>
          ))}
        </section>
      )}
      {section === 'overview' && selectedProgramme && (
        <section className="volunteer-recruitment">
          <div className="volunteer-recruitment-heading">
            <div>
              <h3>Volunteer Recruitment</h3>
              <p>
                {approvedCount} approved out of
                {' '}{requiredCount} required volunteers
              </p>
            </div>
            <strong>{recruitmentPercentage}%</strong>
          </div>
          <progress
            value={Math.min(recruitmentPercentage, 100)}
            max={100}
            aria-label="Approved volunteers against required volunteers"
          />
          <small>
            {Math.max(requiredCount - approvedCount, 0)}
            {' '}additional volunteers required
          </small>
        </section>
      )}
      {/* OVERVIEW */}

      {section === 'overview' && (
        <>
          <section className="volunteer-workflow-section">
            <div className="volunteer-section-heading">
              <span className="volunteer-section-kicker">
                STEP-BY-STEP MANAGEMENT
              </span>
              <h3>Programme Workflow</h3>
              <p>
                Follow these stages to manage the
                complete volunteer service lifecycle.
              </p>
            </div>
            {!selectedProgramme && (
              <div className="volunteer-selection-notice">
                Select a programme above to customise
                the workflow and view its statistics.
              </div>
            )}
            <div className="volunteer-workflow-grid">
              {workflow.map((stage, index) => (
                <article
                  key={stage.title}
                  className="volunteer-workflow-card"
                >
                  <div className="volunteer-card-top">
                    <span
                      className="volunteer-stage-icon"
                      aria-hidden="true"
                    >
                      {stage.icon}
                    </span>
                    <span className="volunteer-stage-label">
                      STAGE {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3>{stage.title}</h3>
                  <p>{stage.description}</p>
                  <div className="volunteer-card-actions">
                    {stage.actions.map(action => (
                      <button
                        type="button"
                        key={action.key}
                        disabled={navigationDisabled}
                        onClick={() =>
                          openWorkflowSection(action.key)
                        }
                      >
                        <span>{action.label}</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="panel">
            <h3>Recent Opportunities</h3>

            {loading && <p>Loading records…</p>}

            {loaded &&
              !loading &&
              items.length === 0 && (
                <p>
                  No volunteer opportunities
                  created yet.
                </p>
              )}

            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 0',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <div>
                  <strong>{item.title}</strong>

                  <div>
                    <small>
                      {formatDate(
                        item.service_start_date
                      )}
                      {' — '}
                      {formatDate(
                        item.service_end_date
                      )}
                    </small>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => edit(item)}
                >
                  Manage
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* OPPORTUNITIES */}

      {section === 'opportunities' && (
        <>
          {editing && (
            <form
              className="form-card"
              onSubmit={save}
            >
              <h3>
                {editingId
                  ? 'Edit Seva Opportunity'
                  : 'Create Seva Opportunity'}
              </h3>

              <fieldset
                disabled={disabled}
                style={{
                  border: 0,
                  padding: 0,
                  margin: 0,
                  minWidth: 0,
                }}
              >
                <label>
                  Opportunity Title *

                  <input
                    required
                    maxLength={255}
                    value={editing.title}
                    placeholder="Brahmotsavam Volunteer Seva"
                    onChange={(e) =>
                      update('title', e.target.value)
                    }
                  />
                </label>

                <label>
                  Description

                  <textarea
                    rows={4}
                    value={editing.description}
                    onChange={(e) =>
                      update(
                        'description',
                        e.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Volunteer Instructions

                  <textarea
                    rows={4}
                    value={editing.instructions}
                    onChange={(e) =>
                      update(
                        'instructions',
                        e.target.value
                      )
                    }
                  />
                </label>
<label>
  Upload Cover Image

  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    disabled={uploadingImage || busy}
    onChange={e => {
      const file = e.target.files?.[0];

      if (file) {
        void uploadCoverImage(file);
      }

      e.target.value = '';
    }}
  />
</label>

{uploadingImage && (
  <p>Uploading image to Cloudinary…</p>
)}
                <label>
                  Cover Image URL

                  <input
                    type="url"

                    value={editing.image_url}
                    placeholder="https://..."
                    onChange={(e) =>
                      update(
                        'image_url',
                        e.target.value
                      )
                    }
                  />
                </label>

                {/^https?:\/\//i.test(
                  editing.image_url
                ) && (
                  <img
                    src={editing.image_url}
                    alt="Opportunity cover preview"
                    style={{
                      width: 260,
                      maxWidth: '100%',
                      height: 150,
                      objectFit: 'cover',
                      borderRadius: 12,
                      marginBottom: 16,
                    }}
                  />
                )}

                <div
                  className="panel"
                  style={{
                    background: '#FFFDF8',
                    border: '1px solid #e8dfcf',
                    borderRadius: 12,
                    padding: 18,
                    marginBottom: 20,
                  }}
                >
                  <h3 style={{ color: '#6B1720' }}>
                    Attendance Configuration
                  </h3>
                  <label>
                    Attendance Mode
                    <select
                      value={editing.attendance_mode}
                      disabled={
                        disabled ||
                        Boolean(
                          editingId &&
                          items.find(
                            item => item.id === editingId
                          )?.total_registrations
                        )
                      }
                      onChange={event =>
                        update(
                          'attendance_mode',
                          event.target.value as AttendanceMode
                        )
                      }
                    >
                      <option value="simple">
                        Simple Attendance (Recommended)
                      </option>
                      <option value="detailed">
                        Detailed Attendance
                      </option>
                      <option value="none">
                        No Attendance Tracking
                      </option>
                      <option value="legacy">
                        Duty & Shift Based
                      </option>
                    </select>
                  </label>
                  <p>
                    {editing.attendance_mode === 'simple'
                      ? 'Track daily present, absent and excused attendance. No check-in or check-out required.'
                      : editing.attendance_mode === 'detailed'
                        ? 'Track daily attendance, check-in, check-out and actual service hours.'
                        : editing.attendance_mode === 'none'
                          ? 'Verify service completion manually without attendance records.'
                          : 'Use the existing duties, shifts and assignment-based workflow.'}
                  </p>
                  <small>
                    Attendance mode is locked after volunteers register.
                  </small>
                </div>
                <div
                  style={{
                    padding: 20,
                    marginTop: 20,
                    marginBottom: 24,
                    border: '1px solid #e7d9be',
                    borderRadius: 12,
                    background: '#FFFDF8',
                  }}
                >
                  <h3 style={{
                    color: '#6B1720',
                    marginTop: 0,
                    marginBottom: 16,
                  }}>
                    Accommodation Configuration
                  </h3>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    cursor: disabled
                      ? 'not-allowed'
                      : 'pointer',
                  }}>
                    <input
                      type="checkbox"
                      checked={
                        editing.accommodation_enabled
                      }
                      disabled={disabled}
                      onChange={event =>
                        update(
                          'accommodation_enabled',
                          event.target.checked
                        )
                      }
                      style={{
                        width: 20,
                        height: 20,
                        flexShrink: 0,
                        accentColor: '#6B1720',
                      }}
                    />
                    <div>
                      <strong style={{
                        color: '#6B1720',
                        fontSize: 15,
                      }}>
                        Enable Accommodation Facility
                      </strong>
                      <p style={{
                        margin: '6px 0 0',
                        color: '#6b7280',
                        lineHeight: 1.6,
                      }}>
                        Provide accommodation to
                        volunteers participating in
                        this programme.
                      </p>
                    </div>
                  </label>
                  <div style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 8,
                    background:
                      editing.accommodation_enabled
                        ? '#ECFDF5'
                        : '#F3F4F6',
                    border:
                      editing.accommodation_enabled
                        ? '1px solid #BBF7D0'
                        : '1px solid #E5E7EB',
                  }}>
                    <strong style={{
                      color:
                        editing.accommodation_enabled
                          ? '#166534'
                          : '#4B5563',
                    }}>
                      {editing.accommodation_enabled
                        ? 'Accommodation Enabled'
                        : 'Accommodation Not Required'}
                    </strong>
                    <p style={{
                      margin: '8px 0 0',
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}>
                      {editing.accommodation_enabled
                        ? 'Administrators can allocate accommodation, provide stay details and publish them to volunteers.'
                        : 'Accommodation management is not required for this programme.'}
                    </p>
                  </div>
                  <p style={{
                    fontSize: 12,
                    color: '#6b7280',
                    lineHeight: 1.6,
                    marginBottom: 0,
                  }}>
                    Accommodation is optional and does
                    not affect registration, approval,
                    attendance, service completion or
                    certificates. Programmes with existing
                    accommodation allocations cannot
                    disable this facility.
                  </p>
                </div>
                <h3>Registration Period</h3>

                <p>
                  All registration dates and times
                  are in Indian Standard Time (IST).
                </p>

                <div className="grid2">
                  <label>
                    Registration Start *

                    <input
                      required
                      type="datetime-local"
                      value={
                        editing.registration_start_at
                      }
                      onChange={(e) =>
                        update(
                          'registration_start_at',
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Registration End *

                    <input
                      required
                      type="datetime-local"
                      value={
                        editing.registration_end_at
                      }
                      onChange={(e) =>
                        update(
                          'registration_end_at',
                          e.target.value
                        )
                      }
                    />
                  </label>
                </div>

                <h3>Service Period</h3>

                <div className="grid2">
                  <label>
                    Service Start Date *

                    <input
                      required
                      type="date"
                      value={editing.service_start_date}
                      onChange={(e) =>
                        update(
                          'service_start_date',
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Service End Date *

                    <input
                      required
                      type="date"
                      min={editing.service_start_date}
                      value={editing.service_end_date}
                      onChange={(e) =>
                        update(
                          'service_end_date',
                          e.target.value
                        )
                      }
                    />
                  </label>
                </div>

                <label>
                  Required Volunteers *

                  <input
                    required
                    type="number"
                    min={1}
                    max={2147483647}
                    step={1}
                    value={editing.required_volunteers}
                    onChange={(e) =>
                      update(
                        'required_volunteers',
                        Number(e.target.value)
                      )
                    }
                  />
                </label>

                <h3>Registration Types</h3>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={editing.allow_individual}
                    onChange={(e) =>
                      update(
                        'allow_individual',
                        e.target.checked
                      )
                    }
                  />

                  Allow Individual Registration
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={editing.allow_group}
                    onChange={(e) =>
                      update(
                        'allow_group',
                        e.target.checked
                      )
                    }
                  />

                  Allow Group Registration
                </label>

                {editing.allow_group && (
                  <div className="grid2">
                    <label>
                      Minimum Group Size

                      <input
                        required
                        type="number"
                        min={2}
                        step={1}
                        value={
                          editing.minimum_group_size
                        }
                        onChange={(e) =>
                          update(
                            'minimum_group_size',
                            Number(e.target.value)
                          )
                        }
                      />
                    </label>

                    <label>
                      Maximum Group Size

                      <input
                        required
                        type="number"
                        min={
                          editing.minimum_group_size
                        }
                        step={1}
                        value={
                          editing.maximum_group_size
                        }
                        onChange={(e) =>
                          update(
                            'maximum_group_size',
                            Number(e.target.value)
                          )
                        }
                      />
                    </label>
                  </div>
                )}

                <div className="panel">
                  {editingId
                    ? 'Changes will update the existing opportunity.'
                    : 'New opportunities are saved as drafts. Configure service dates and publish before enabling registration.'}
                </div>

                <div className="actions">
                  <button
                    type="submit"
                    className="primary"
                    disabled={disabled}
                  >
                    {busy
                      ? 'Saving…'
                      : editingId
                        ? 'Save Changes'
                        : 'Create Opportunity'}
                  </button>
                </div>
              </fieldset>

              <button
                type="button"
                disabled={busy}
                style={{ marginTop: 12 }}
                onClick={cancelProgrammeDraft}
              >
                Cancel
              </button>
            </form>
          )}

          {/* EXTEND REGISTRATION DEADLINE */}

          {extension && (
            <form
              className="form-card"
              onSubmit={extendDeadline}
            >
              <h3>Extend Registration Deadline</h3>

              <p>{extension.title}</p>

              <label>
                New Registration Deadline (IST)

                <input
                  required
                  type="datetime-local"
                  value={extension.deadline}
                  disabled={disabled}
                  onChange={(e) =>
                    setExtension((current) =>
                      current
                        ? {
                            ...current,
                            deadline: e.target.value,
                          }
                        : null
                    )
                  }
                />
              </label>

              <div className="actions">
                <button
                  type="submit"
                  className="primary"
                  disabled={disabled}
                >
                  Extend Deadline
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelDeadlineDraft}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* SEARCH AND FILTERS */}

          <div className="panel">
            <div className="grid2">
              <label>
                Search Opportunities

                <input
                  value={search}
                  placeholder="Search by programme name..."
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                />
              </label>

              <label>
                Registration Status

                <select
                  value={filter}
                  onChange={(e) =>
                    setFilter(e.target.value)
                  }
                >
                  <option value="all">
                    All Opportunities
                  </option>

                  <option value="draft">
                    Draft
                  </option>

                  <option value="upcoming">
                    Upcoming
                  </option>

                  <option value="open">
                    Registration Open
                  </option>

                  <option value="closed">
                    Registration Closed
                  </option>
                </select>
              </label>
            </div>
          </div>

          {/* OPPORTUNITY TABLE */}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>Service Dates</th>
                  <th>Registration Period</th>
                  <th>Volunteers</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6}>
                      Loading opportunities…
                    </td>
                  </tr>
                )}

                {!loading &&
                  loaded &&
                  filtered.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        No opportunities found.
                      </td>
                    </tr>
                  )}

                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="thumb"
                        />
                      )}

                      <div>
                        <strong>{item.title}</strong>
                      </div>

                      <small>
                        {item.allow_individual
                          ? 'Individual'
                          : ''}

                        {item.allow_individual &&
                        item.allow_group
                          ? ' / '
                          : ''}

                        {item.allow_group
                          ? 'Group'
                          : ''}
                      </small>
                    </td>

                    <td>
                      {formatDate(
                        item.service_start_date
                      )}

                      <div>to</div>

                      {formatDate(
                        item.service_end_date
                      )}
                    </td>

                    <td>
                      <small>
                        Starts:
                        {' '}
                        {formatDateTime(
                          item.registration_start_at
                        )}
                      </small>

                      <div>
                        <small>
                          Ends:
                          {' '}
                          {formatDateTime(
                            item.registration_end_at
                          )}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div>
                        Required:
                        {' '}
                        {item.required_volunteers}
                      </div>

                      <div>
                        Registered:
                        {' '}
                        {item.registered_volunteers}
                      </div>

                      <div>
                        Approved:
                        {' '}
                        {item.approved_volunteers}
                      </div>

                      <small>
                        Applications:
                        {' '}
                        {item.total_registrations}
                      </small>
                    </td>

                    <td>
                      <span
                        className="badge"
                        style={{
                          color:
                            statusColors[
                              item.registration_status
                            ],
                          fontWeight: 700,
                          textTransform: 'capitalize',
                        }}
                      >
                        {item.registration_status}
                      </span>

                      <div>
                        <small>
                          {item.is_published
                            ? 'Published'
                            : 'Not published'}
                        </small>
                      </div>

                      <div>
                        <small>
                          {item.registration_enabled
                            ? 'Registration enabled'
                            : 'Registration disabled'}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div
                        className="actions"
                        style={{
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => edit(item)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            void togglePublish(item)
                          }
                        >
                          {item.is_published
                            ? 'Unpublish'
                            : 'Publish'}
                        </button>

                        <button
                          type="button"
                          disabled={
                            disabled ||
                            (
                              !item.is_published &&
                              !item.registration_enabled
                            )
                          }
                          onClick={() =>
                            void toggleRegistration(item)
                          }
                        >
                          {item.registration_enabled
                            ? 'Close Registration'
                            : 'Enable Registration'}
                        </button>

                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (!prepareProgrammeForm()) return;
                            clearWorkspaceDrafts();
                            const deadline =
                              toISTInput(
                                item.registration_end_at
                              );
                            extensionBaseline.current =
                              deadline;
                            setExtension({
                              id: item.id,
                              title: item.title,
                              deadline,
                            });

                            setError('');
                            setSuccess('');

                            window.scrollTo({
                              top: 0,
                              behavior: 'smooth',
                            });
                          }}
                        >
                          Extend Deadline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {section === 'registrations' && (
  <Registrations
    key={selectedProgrammeId || 'unselected'}
    opportunities={items}
    selectedProgrammeId={selectedProgrammeId}
  />
)}

{section === 'reporting' && (
  <DailyReporting
    key={selectedProgrammeId || 'unselected'}
    opportunities={items}
    selectedProgrammeId={selectedProgrammeId}
  />
)}
{section === 'duties' && (
  <Duties />
)}

{section === 'shifts' && (
  <Shifts
    key={selectedProgrammeId || 'unselected'}
    opportunities={items}
    selectedProgrammeId={selectedProgrammeId}
  />
)}

{section === 'requirements' && (
  <Requirements
    key={selectedProgrammeId || 'unselected'}
    opportunities={items}
    selectedProgrammeId={selectedProgrammeId}
  />
)}
{section === 'assignments' && (
  <Assignments
    key={selectedProgrammeId || 'unselected'}
    opportunities={items}
    selectedProgrammeId={selectedProgrammeId}
  />
)}

{section === 'attendance' && (
  <AttendanceManager
    key={selectedProgrammeId || 'unselected'}
    opportunities={items}
    selectedProgrammeId={selectedProgrammeId}
  />
)}

{section === 'id-cards' && (
  <IdCards
    key={selectedProgrammeId || 'unselected'}
    opportunities={items}
    selectedProgrammeId={selectedProgrammeId}
  />
)}

{section === 'accommodation' &&
 accommodationAvailable && (
  <Accommodation
    key={selectedProgrammeId || 'unselected'}
    opportunities={items}
    selectedProgrammeId={selectedProgrammeId}
  />
)}
{section === 'completion' && (
  <Completion
    key={selectedProgrammeId || 'unselected'}
    opportunities={items}
    selectedProgrammeId={selectedProgrammeId}
  />
)}

{section === 'certificates' && (
  <Certificates
    key={selectedProgrammeId || 'unselected'}
    opportunities={items}
    selectedProgrammeId={selectedProgrammeId}
  />
)}

      {activeStage && (
        <section className="volunteer-stage-footer">
          <button
            type="button"
            disabled={navigationDisabled}
            onClick={() =>
              openWorkflowSection(
                activeStageIndex > 0
                  ? workflow[
                      activeStageIndex - 1
                    ].actions[0].key
                  : 'overview'
              )
            }
          >
            ← {activeStageIndex > 0
              ? workflow[activeStageIndex - 1].title
              : 'Dashboard Overview'}
          </button>
          <div>
            <small>
              Stage {activeStageIndex + 1}
              {' of '}{workflow.length}
            </small>
          </div>
          <button
            type="button"
            className="primary"
            disabled={navigationDisabled}
            onClick={() =>
              openWorkflowSection(
                activeStageIndex < workflow.length - 1
                  ? workflow[
                      activeStageIndex + 1
                    ].actions[0].key
                  : 'overview'
              )
            }
          >
            {activeStageIndex < workflow.length - 1
              ? workflow[activeStageIndex + 1].title
              : 'Return to Dashboard'} →
          </button>
        </section>
      )}
    </main>
  );
}
