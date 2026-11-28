BEGIN;
CREATE TABLE public.anonymous_volunteer_service_totals (
    id INTEGER PRIMARY KEY DEFAULT 1,
    completed_volunteers BIGINT NOT NULL DEFAULT 0,
    total_service_days BIGINT NOT NULL DEFAULT 0,
    total_service_hours NUMERIC(20,2)
        NOT NULL DEFAULT 0,
    CONSTRAINT anonymous_service_singleton_check
        CHECK (id = 1),
    CONSTRAINT anonymous_service_totals_check
        CHECK (
            completed_volunteers >= 0
            AND total_service_days >= 0
            AND total_service_hours >= 0
        )
);
INSERT INTO public.anonymous_volunteer_service_totals (
    id
)
VALUES (1);
COMMIT;