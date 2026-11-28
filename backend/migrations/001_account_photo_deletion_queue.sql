BEGIN;
CREATE TABLE public.account_photo_deletion_queue (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cloud_name VARCHAR(100) NOT NULL,
    cloudinary_public_id VARCHAR(255) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT account_photo_deletion_unique
        UNIQUE (cloud_name, cloudinary_public_id),
    CONSTRAINT account_photo_deletion_attempts_check
        CHECK (attempts >= 0),
    CONSTRAINT account_photo_deletion_cloud_check
        CHECK (cloud_name ~ '^[a-zA-Z0-9_-]+$'),
    CONSTRAINT account_photo_deletion_path_check
        CHECK (
            cloudinary_public_id ~
            '^temple-app/volunteer/photos/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        )
);
CREATE INDEX account_photo_deletion_due_idx
ON public.account_photo_deletion_queue (
    next_attempt_at,
    id
);
COMMIT;
