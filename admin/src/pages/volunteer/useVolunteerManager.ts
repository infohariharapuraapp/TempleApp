import {
  beginVolunteerOperation,
} from '../../lib/volunteerOperationGuard';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  volunteerRequest,
  getErrorMessage,
} from '../../lib/volunteerApi';

export function useVolunteerManager<T>(
  endpoint: string
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [needsRefresh, setNeedsRefresh] =
    useState(false);

  const version = useRef(0);
  const mutationLock = useRef(false);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    const currentVersion = ++version.current;

    setLoading(true);
    setError('');

    try {
      const response =
        await volunteerRequest<T[]>(endpoint);

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid server response.');
      }

      if (
        !mounted.current ||
        currentVersion !== version.current
      ) {
        return false;
      }

      setItems(response.data);
      setLoaded(true);
      setNeedsRefresh(false);

      return true;
    } catch (error) {
      if (
        mounted.current &&
        currentVersion === version.current
      ) {
        setError(getErrorMessage(error));
      }

      return false;
    } finally {
      if (
        mounted.current &&
        currentVersion === version.current
      ) {
        setLoading(false);
      }
    }
  }, [endpoint]);

  useEffect(() => {
    mounted.current = true;

    setItems([]);
    setLoaded(false);
    setSuccess('');

    void refresh();

    return () => {
      mounted.current = false;
      version.current++;
    };
  }, [refresh]);

  async function mutate(
    task: () => Promise<unknown>,
    message: string,
    onSuccess?: () => void
  ) {
    if (
      mutationLock.current ||
      loading ||
      needsRefresh ||
      !loaded
    ) {
      return false;
    }

    const releaseOperation = beginVolunteerOperation(
      'Volunteer management update'
    );

    mutationLock.current = true;

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await task();

      if (!mounted.current) return true;

      onSuccess?.();

      setSuccess(message);

      const refreshed = await refresh();

      if (mounted.current && !refreshed) {
        setNeedsRefresh(true);
      }

      return true;
    } catch (error) {
      if (mounted.current) {
        setError(getErrorMessage(error));
        setNeedsRefresh(true);
      }

      return false;
    } finally {
      mutationLock.current = false;

      if (mounted.current) {
        setBusy(false);
      }

      releaseOperation();
    }
  }

  return {
    items,
    loading,
    loaded,
    busy,
    error,
    success,
    needsRefresh,
    disabled:
      loading ||
      busy ||
      needsRefresh ||
      !loaded,
    refresh,
    mutate,
    setError,
    setSuccess,
  };
}