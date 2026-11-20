import { useEffect, useRef, useState } from 'react';

import {
  volunteerRequest,
  getErrorMessage,
} from '../../lib/volunteerApi';

type Props = {
  registrationId: number;
  memberId: number;
  memberName: string;
  photoStatus: string;
  photoRevision: number;
  reviewComment?: string | null;
  canReview: boolean;
  disabled: boolean;

  onReview: (
    action: 'verify' | 'request_correction',
    comment: string,
    revision: number
  ) => Promise<void>;
};

const statusLabels: Record<string, string> = {
  missing: 'Photograph Missing',
  pending: 'Pending Verification',
  correction_required: 'Correction Required',
  resubmitted: 'Resubmitted — Review Required',
  verified: 'Photograph Verified',
};

export default function VolunteerPhotoReview({
  registrationId,
  memberId,
  memberName,
  photoStatus,
  photoRevision,
  reviewComment,
  canReview,
  disabled,
  onReview,
}: Props) {
  const [imageUrl, setImageUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const version = useRef(0);
  const mounted = useRef(false);
  const lock = useRef(false);

  const awaitingReview =
    ['pending', 'resubmitted'].includes(photoStatus);

  const statusColor =
    photoStatus === 'verified'
      ? '#15803d'
      : photoStatus === 'correction_required' ||
        photoStatus === 'missing'
        ? '#b91c1c'
        : '#a16207';

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      version.current++;
    };
  }, []);

  useEffect(() => {
    version.current++;
    setImageUrl('');
    setLoaded(false);
    setLoading(false);
    setComment('');
    setError('');
    setExpanded(false);
  }, [
    registrationId,
    memberId,
    photoRevision,
    photoStatus,
  ]);

  useEffect(() => {
    if (!imageUrl) return;

    const timer = window.setTimeout(() => {
      setImageUrl('');
      setLoaded(false);
      setExpanded(false);
    }, 270000);

    return () => window.clearTimeout(timer);
  }, [imageUrl]);

  async function loadPhoto() {
    if (loading || disabled) return;

    const requestVersion = ++version.current;

    setLoading(true);
    setError('');
    setLoaded(false);
    setImageUrl('');

    try {
      const result = await volunteerRequest<{
        image_url: string;
        photo_revision: number;
        photo_status: string;
      }>(
        `/registrations/${registrationId}/members/${memberId}/photo`
      );

      if (
        !mounted.current ||
        requestVersion !== version.current
      ) {
        return;
      }

      if (
        result.data.photo_revision !== photoRevision ||
        result.data.photo_status !== photoStatus
      ) {
        throw new Error(
          'Photograph has changed. Refresh registration details.'
        );
      }

      if (
        !result.data.image_url?.startsWith('https://')
      ) {
        throw new Error('Invalid photograph preview');
      }

      setImageUrl(result.data.image_url);

    } catch (error) {
      if (
        mounted.current &&
        requestVersion === version.current
      ) {
        setError(getErrorMessage(error));
      }
    } finally {
      if (
        mounted.current &&
        requestVersion === version.current
      ) {
        setLoading(false);
      }
    }
  }

  async function review(
    action: 'verify' | 'request_correction'
  ) {
    if (
      disabled ||
      lock.current ||
      !canReview ||
      !awaitingReview ||
      loading ||
      (action === 'verify' && !loaded)
    ) {
      return;
    }

    if (
      action === 'request_correction' &&
      !comment.trim()
    ) {
      setError(
        'Enter a comment explaining why a new photograph is required.'
      );

      return;
    }

    const confirmation =
      action === 'verify'
        ? `Verify photograph of ${memberName}?`
        : `Request a new photograph from ${memberName}?`;

    if (!window.confirm(confirmation)) {
      return;
    }

    lock.current = true;
    setError('');

    try {
      await onReview(
        action,
        comment.trim(),
        photoRevision
      );
    } catch (error) {
      if (mounted.current) {
        setError(getErrorMessage(error));
      }
    } finally {
      lock.current = false;
    }
  }

  return (
    <div
      style={{
        border: '1px solid #E6D6B8',
        background: '#FFFDF8',
        borderRadius: 12,
        padding: 18,
        margin: '16px 0',
      }}
    >
      <h4 style={{ marginTop: 0, color: '#6B1720' }}>
        Volunteer Photograph
      </h4>

      <div style={{
        color: statusColor,
        fontWeight: 700,
        marginBottom: 10,
      }}>
        {statusLabels[photoStatus] || photoStatus}
      </div>

      {photoRevision > 0 && (
        <p>Photograph revision: {photoRevision}</p>
      )}

      {reviewComment && (
        <div style={{
          background: '#FFF4E5',
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
          overflowWrap: 'anywhere',
        }}>
          <strong>Previous Review Comment</strong>
          <p>{reviewComment}</p>
        </div>
      )}

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {photoStatus === 'missing' ? (
        <p>
          The volunteer has not uploaded a
          photograph yet.
        </p>
      ) : (
        <>
          {imageUrl && (
            <img
              src={imageUrl}
              alt={`Photograph of ${memberName}`}
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onError={() => {
                setLoaded(false);
                setImageUrl('');
                setError(
                  'Unable to display photograph. Load it again.'
                );
              }}
              style={{
                width: expanded ? 320 : 150,
                maxWidth: '100%',
                maxHeight: 420,
                objectFit: 'contain',
                borderRadius: 10,
                display: 'block',
                marginBottom: 12,
                background: '#F3EEE5',
              }}
            />
          )}

          <div className="actions">
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => void loadPhoto()}
            >
              {loading
                ? 'Loading…'
                : imageUrl
                  ? 'Reload Photograph'
                  : 'View Photograph'}
            </button>

            {imageUrl && loaded && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded
                  ? 'Reduce Preview'
                  : 'Enlarge Preview'}
              </button>
            )}
          </div>

          {canReview && awaitingReview && (
            <>
              <label style={{
                display: 'block',
                marginTop: 16,
              }}>
                Photograph Review Comment

                <textarea
                  disabled={disabled}
                  rows={3}
                  maxLength={1000}
                  value={comment}
                  placeholder="Example: Photograph is blurry. Please upload a clear passport-size photograph."
                  onChange={e =>
                    setComment(e.target.value)
                  }
                />
              </label>

              <small>
                Comment is mandatory when
                requesting correction.
              </small>

              <div
                className="actions"
                style={{ marginTop: 12 }}
              >
                <button
                  type="button"
                  disabled={
                    disabled ||
                    !loaded ||
                    loading
                  }
                  style={{
                    background: '#15803d',
                    color: '#FFFFFF',
                  }}
                  onClick={() => void review('verify')}
                >
                  Verify Photograph
                </button>

                <button
                  type="button"
                  disabled={
                    disabled ||
                    loading ||
                    !comment.trim()
                  }
                  style={{
                    background: '#B91C1C',
                    color: '#FFFFFF',
                  }}
                  onClick={() =>
                    void review('request_correction')
                  }
                >
                  Request Correction
                </button>
              </div>

              {!loaded && (
                <p>
                  Load the photograph before verification.
                  If the photograph is unavailable or
                  cannot be displayed, request correction
                  with a clear explanation.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}