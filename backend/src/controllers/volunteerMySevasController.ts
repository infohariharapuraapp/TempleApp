import {
  withVolunteerPhotoAccess,
} from '../services/volunteerPhotoAccessService';
import { CARD_SELECT } from './volunteerIdCardController';
import {
  DAILY_SERVICE_SUMMARY_SQL,
  calculateDailyServiceSummary,
} from '../services/volunteerDailyServiceSummary';
import { Response } from 'express';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

// ========================================
// GET MY SEVA REGISTRATION DETAILS
// ========================================

export const getMySevaDetails = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  const registrationId = String(
    req.params.registrationId
  );

  if (
    !/^[1-9]\d*$/.test(registrationId) ||
    Number(registrationId) > 2147483647
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid registration ID',
    });
  }

  const userId = req.user.userId;

  res.set(
    'Cache-Control',
    'private, no-store'
  );

  try {
    const client = await pool.connect();
    let discardClient = false;
    let clientReleased = false;

    try {
      await client.query(
        'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'
      );

      // ========================================
      // REGISTRATION AND OPPORTUNITY
      // ========================================

      const registrationResult =
        await client.query(
          `
          SELECT
            r.id,
            r.registration_code,
            r.opportunity_id,
            r.registration_type,
            r.group_name,
            r.total_members,
            r.status,
            r.devotee_remarks,
            r.rejection_reason,
            r.reviewed_at,
            r.completed_at,
            r.created_at,
            r.updated_at,

           COALESCE(r.user_id = $2, FALSE)
  AS is_registration_owner,

            o.title AS programme_name,
            o.attendance_mode,
            o.accommodation_enabled,
            o.description,
            o.instructions,
            o.image_url,

            o.service_start_date::text
              AS service_start_date,

            o.service_end_date::text
              AS service_end_date,

            o.registration_start_at,
            o.registration_end_at,

            (
              o.is_published = TRUE
              AND o.registration_enabled = TRUE
              AND clock_timestamp()
                >= o.registration_start_at
              AND clock_timestamp()
                < o.registration_end_at
            ) AS registration_window_open

          FROM volunteer_registrations r

          JOIN volunteer_opportunities o
            ON o.id = r.opportunity_id

          WHERE r.id = $1

          AND (
            r.user_id = $2

            OR EXISTS (
              SELECT 1

              FROM volunteer_members m

              WHERE m.registration_id = r.id
                AND m.user_id = $2
            )
          )
          `,
          [registrationId, userId]
        );

      if (!registrationResult.rows.length) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          success: false,
          message: 'Seva registration not found',
        });
      }

      const registration =
        registrationResult.rows[0];

      // ========================================
      // REGISTRATION MEMBERS
      // ========================================

      const memberResult =
        await client.query(
          `
          SELECT
            m.id,
            m.member_code,
            m.full_name,
            m.gender,
            m.photo_url,
            m.photo_status,
            m.photo_revision,
            m.photo_review_comment,
            m.photo_uploaded_at,
            m.photo_reviewed_at,
            (
              r.status IN (
                'pending',
                'approved',
                'assigned',
                'in_progress'
              )
              AND m.status IN (
                'pending',
                'approved'
              )
              AND m.photo_status IN (
                'missing',
                'correction_required'
              )
              AND NOT EXISTS (
                SELECT 1
                FROM volunteer_id_cards pc
                WHERE pc.member_id = m.id
                  AND pc.opportunity_id = m.opportunity_id
                  AND pc.status = 'active'
                  AND pc.valid_until >=
                    (clock_timestamp()
                      AT TIME ZONE 'Asia/Kolkata')::date
              )
            ) AS can_resubmit_photo,
            m.is_team_leader,
            m.status,
            m.created_at

          FROM volunteer_members m

          JOIN volunteer_registrations r
            ON r.id = m.registration_id

          WHERE m.registration_id = $1

            AND (
              r.user_id = $2
              OR m.user_id = $2
            )

          ORDER BY
            m.is_team_leader DESC,
            m.id ASC
          `,
          [registrationId, userId]
        );

      const memberIds =
        memberResult.rows.map(
          member => member.id
        );

      // ========================================
      // SELECTED SERVICE AVAILABILITY
      // ========================================

      const serviceDateResult =
        await client.query(
          `
          SELECT
            sd.id AS service_date_id,
            sd.member_id,
            sd.service_date::text AS service_date
          FROM volunteer_service_dates sd
          WHERE sd.member_id = ANY($1::integer[])
            AND sd.opportunity_id = $2
          ORDER BY
            sd.member_id,
            sd.service_date
          `,
          [
            memberIds,
            registration.opportunity_id,
          ]
        );
      // ========================================
      // FINALIZED DAILY ATTENDANCE
      // ========================================
      const dailyAttendanceResult =
        await client.query(
          `
          SELECT
            sd.id AS service_date_id,
            sd.member_id,
            sd.service_date::text AS service_date,
            CASE
              WHEN da.is_finalized = TRUE
                THEN da.attendance_status
              ELSE 'not_marked'
            END AS attendance_status,
            COALESCE(
              da.is_finalized,
              FALSE
            ) AS is_finalized,
            CASE
              WHEN da.is_finalized = TRUE
                AND o.attendance_mode = 'detailed'
                AND da.attendance_status = 'present'
                THEN da.check_in_at
              ELSE NULL
            END AS check_in_at,
            CASE
              WHEN da.is_finalized = TRUE
                AND o.attendance_mode = 'detailed'
                AND da.attendance_status = 'present'
                THEN da.check_out_at
              ELSE NULL
            END AS check_out_at,
            CASE
              WHEN da.is_finalized = TRUE
                AND o.attendance_mode = 'detailed'
                AND da.attendance_status = 'present'
                THEN da.total_service_hours
              ELSE NULL
            END AS service_hours
          FROM volunteer_service_dates sd
          JOIN volunteer_opportunities o
            ON o.id = sd.opportunity_id
          LEFT JOIN volunteer_daily_attendance da
            ON da.service_date_id = sd.id
            AND da.attendance_mode = o.attendance_mode
          WHERE sd.member_id = ANY($1::integer[])
            AND sd.opportunity_id = $2
            AND o.attendance_mode IN (
              'simple',
              'detailed'
            )
          ORDER BY
            sd.member_id,
            sd.service_date
          `,
          [
            memberIds,
            registration.opportunity_id,
          ]
        );
      // ========================================
      // SHARED SERVICE SUMMARY
      // ========================================
      const dailySummaryResult =
        await client.query(
          `
          SELECT
            m.id AS member_id,
            m.status AS member_status,
            r.status AS registration_status,
            o.attendance_mode,
            daily.*
          FROM volunteer_members m
          JOIN volunteer_registrations r
            ON r.id = m.registration_id
          JOIN volunteer_opportunities o
            ON o.id = m.opportunity_id
          CROSS JOIN LATERAL (
            ${DAILY_SERVICE_SUMMARY_SQL}
          ) daily
          WHERE m.id = ANY($1::integer[])
            AND m.opportunity_id = $2
            AND o.attendance_mode IN (
              'simple',
              'detailed',
              'none'
            )
          `,
          [
            memberIds,
            registration.opportunity_id,
          ]
        );
      const availabilityResult =
        await client.query(
          `
          SELECT
            av.member_id,
            av.shift_id,

            s.shift_name,

            s.service_date::text
              AS service_date,

            s.start_time,
            s.end_time,
            s.is_active

          FROM volunteer_availability av

          JOIN volunteer_shifts s
            ON s.id = av.shift_id

          WHERE av.member_id =
            ANY($1::integer[])

          ORDER BY
            s.service_date ASC,
            s.start_time ASC
          `,
          [memberIds]
        );

      // ========================================
      // DUTY ASSIGNMENTS AND ATTENDANCE
      // ========================================

      const assignmentResult =
        await client.query(
          `
          SELECT
            a.id AS assignment_id,
            a.member_id,
            a.requirement_id,
            a.shift_id,
            a.status,
            a.assigned_at,
            a.completed_at,

            a.reporting_location,
            a.reporting_time,
            a.coordinator_name,
            a.coordinator_phone,
            a.special_instructions,

            d.id AS duty_id,
            d.name AS duty_name,
            d.description AS duty_description,
            d.responsibilities,

            d.male_dress_code,
            d.female_dress_code,

            d.male_dress_image_url,
            d.female_dress_image_url,

            d.general_instructions,

            s.shift_name,

            s.service_date::text
              AS service_date,

            s.start_time,
            s.end_time,

            (
              (s.service_date + s.start_time)
              AT TIME ZONE 'Asia/Kolkata'
            ) AS shift_start_at,

            (
              (s.service_date + s.end_time)
              AT TIME ZONE 'Asia/Kolkata'
            ) AS shift_end_at,

            CASE

              WHEN a.status = 'completed'
                THEN 'completed'

              WHEN (
                (s.service_date + s.end_time)
                AT TIME ZONE 'Asia/Kolkata'
              ) <= clock_timestamp()
                THEN 'awaiting_review'

              WHEN (
                (s.service_date + s.start_time)
                AT TIME ZONE 'Asia/Kolkata'
              ) <= clock_timestamp()
                THEN 'current'

              ELSE 'upcoming'

            END AS display_status,

            CASE
              WHEN att.is_finalized = TRUE
                THEN att.attendance_status
              ELSE 'not_marked'
            END AS attendance_status,

            COALESCE(
              att.is_finalized,
              FALSE
            ) AS attendance_finalized,

            CASE

              WHEN att.is_finalized = TRUE
                AND att.attendance_status = 'present'

              THEN ROUND(
                EXTRACT(
                  EPOCH FROM
                  (s.end_time - s.start_time)
                ) / 3600,
                2
              )

              ELSE 0

            END AS service_hours

          FROM volunteer_assignments a

          JOIN volunteer_members m
            ON m.id = a.member_id

          JOIN volunteer_requirements vr
            ON vr.id = a.requirement_id

          JOIN volunteer_duties d
            ON d.id = vr.duty_id

          JOIN volunteer_shifts s
            ON s.id = a.shift_id

          LEFT JOIN volunteer_attendance att
            ON att.assignment_id = a.id

          WHERE a.member_id =
            ANY($1::integer[])

          AND m.status IN (
            'approved',
            'completed'
          )

          AND a.status NOT IN (
            'cancelled',
            'reassigned'
          )

          ORDER BY
            s.service_date ASC,
            s.start_time ASC,
            a.id ASC
          `,
          [memberIds]
        );

      // ========================================
      // DIGITAL ID CARDS
      // ========================================

      const idCardResult =
        await client.query(
          `
          WITH cards AS (
            ${CARD_SELECT}
            WHERE c.member_id = ANY($1::integer[])
              AND c.status <> 'revoked'
              AND m.status IN (
                'approved',
                'completed'
              )
          )
          SELECT
            id,
            member_id,
            card_number,
            photo_url,
            valid_from,
            valid_until,
            issued_at,
            authorized_service_dates,
            effective_status AS status
          FROM cards
          `,
          [memberIds]
        );

      // ========================================
      // OPTIONAL ACCOMMODATION
      // ========================================

      const accommodationResult =
        await client.query(
          `
          SELECT
            ac.id,
            ac.member_id,
            ac.accommodation_name,
            ac.building_name,
            ac.room_number,
            ac.address,
            ac.check_in_at,
            ac.check_out_at,
            ac.contact_person,
            ac.contact_phone,
            ac.instructions

          FROM volunteer_accommodation ac
          JOIN volunteer_members m
            ON m.id = ac.member_id
            AND m.opportunity_id = ac.opportunity_id
          JOIN volunteer_opportunities o
            ON o.id = ac.opportunity_id
          WHERE ac.member_id =
            ANY($1::integer[])
            AND o.accommodation_enabled = TRUE
            AND ac.is_visible = TRUE

            AND m.status IN (
              'approved',
              'completed'
            )

          ORDER BY ac.check_in_at ASC
            NULLS LAST
          `,
          [memberIds]
        );

      // ========================================
      // ISSUED CERTIFICATES ONLY
      // ========================================

      const certificateResult =
        await client.query(
          `
          SELECT
            c.id,
            c.member_id,
            c.certificate_number,

            c.volunteer_name,
            c.programme_name,
            c.certificate_title,
            c.certificate_message,

            c.service_start_date::text
              AS service_start_date,

            c.service_end_date::text
              AS service_end_date,

            c.total_service_days,
            c.total_service_hours,
            c.attendance_mode,

            c.certificate_url,
            c.signatory_name,
            c.signatory_designation,
            c.issued_at,
            c.status

          FROM volunteer_certificates c

          JOIN volunteer_members m
            ON m.id = c.member_id

          WHERE c.member_id =
            ANY($1::integer[])

            AND c.status = 'issued'
            AND m.status = 'completed'
          `,
          [memberIds]
        );

      // ========================================
      // ORGANIZE RESULTS BY MEMBER
      // ========================================

      await client.query('COMMIT');
      clientReleased = true;
      client.release();
      function groupByMember(
        rows: any[]
      ): Map<number, any[]> {
        const grouped =
          new Map<number, any[]>();

        for (const row of rows) {
          const existing =
            grouped.get(row.member_id) || [];

          existing.push(row);

          grouped.set(
            row.member_id,
            existing
          );
        }

        return grouped;
      }

      const serviceDateMap =
        groupByMember(serviceDateResult.rows);
      const dailyAttendanceMap =
        groupByMember(dailyAttendanceResult.rows);
      const dailySummaryMap =
        new Map<
          number,
          ReturnType<typeof calculateDailyServiceSummary>
        >();
      for (const row of dailySummaryResult.rows) {
        dailySummaryMap.set(
          Number(row.member_id),
          calculateDailyServiceSummary(row)
        );
      }
      const availabilityMap =
        groupByMember(
          availabilityResult.rows
        );

      const assignmentMap =
        groupByMember(
          assignmentResult.rows
        );

      const idCardMap =
        groupByMember(
          idCardResult.rows.map(
            row => withVolunteerPhotoAccess(row)
          )
        );

      const accommodationMap =
        groupByMember(
          accommodationResult.rows
        );

      const certificateMap =
        groupByMember(
          certificateResult.rows
        );

      const canViewService = [
        'approved',
        'assigned',
        'in_progress',
        'completed',
      ].includes(registration.status);

      // ========================================
      // BUILD MEMBER DETAILS
      // ========================================

      const members =
        memberResult.rows.map(member => {
          const allowed =
            canViewService &&
            [
              'approved',
              'completed',
            ].includes(member.status);

          const assignments = allowed
            ? assignmentMap.get(member.id) || []
            : [];

          const present = assignments.filter(
            item =>
              item.attendance_finalized &&
              item.attendance_status === 'present'
          );

          const absent = assignments.filter(
            item =>
              item.attendance_finalized &&
              item.attendance_status === 'absent'
          );

          const excused = assignments.filter(
            item =>
              item.attendance_finalized &&
              item.attendance_status === 'excused'
          );

          const finalizedCount =
            assignments.filter(
              item =>
                item.attendance_finalized
            ).length;

          const totalServiceDays =
            new Set(
              present.map(
                item => item.service_date
              )
            ).size;

          const totalServiceHours =
            Number(
              present.reduce(
                (sum, item) =>
                  sum + Number(
                    item.service_hours || 0
                  ),
                0
              ).toFixed(2)
            );

          const attendancePercentage =
            finalizedCount > 0
              ? Number(
                  (
                    present.length /
                    finalizedCount * 100
                  ).toFixed(2)
                )
              : null;

          const attendanceMode =
            registration.attendance_mode ?? 'legacy';
          const selectedDates =
            serviceDateMap.get(member.id) || [];
          const dailyAttendance =
            allowed &&
            ['simple', 'detailed'].includes(attendanceMode)
              ? dailyAttendanceMap.get(member.id) || []
              : [];
          const dailySummary =
            allowed &&
            attendanceMode !== 'legacy'
              ? dailySummaryMap.get(Number(member.id))
              : undefined;
          const dailyServiceSummary =
            dailySummary
              ? {
                  attendance_mode: attendanceMode,
                  total_selected_dates:
                    dailySummary.total_selected_dates,
                  finalized_dates:
                    attendanceMode === 'none'
                      ? null
                      : dailySummary.finalized_dates,
                  remaining_dates:
                    dailySummary.remaining_dates,
                  present:
                    attendanceMode === 'none'
                      ? null
                      : dailySummary.present_count,
                  absent:
                    attendanceMode === 'none'
                      ? null
                      : dailySummary.absent_count,
                  excused:
                    attendanceMode === 'none'
                      ? null
                      : dailySummary.excused_count,
                  attendance_percentage:
                    attendanceMode === 'none' ||
                    dailySummary.finalized_dates !==
                      dailySummary.total_selected_dates
                      ? null
                      : dailySummary.attendance_percentage,
                  total_service_days:
                    dailySummary.total_service_days,
                  total_service_hours:
                    dailySummary.total_service_hours,
                  service_start_date:
                    dailySummary.service_start_date,
                  service_end_date:
                    dailySummary.service_end_date,
                  is_completed:
                    member.status === 'completed',
                }
              : null;
          return {
            ...withVolunteerPhotoAccess(member),
            attendance_mode: attendanceMode,
            service_dates: selectedDates.map(
              item => item.service_date
            ),
            daily_attendance: dailyAttendance,
            daily_service_summary: dailyServiceSummary,
            availability:
              availabilityMap.get(member.id)
                || [],

            assignments,

            attendance_summary: {
              total_assignments:
                assignments.length,

              present: present.length,

              absent: absent.length,

              excused: excused.length,

              finalized: finalizedCount,

              pending:
                assignments.length -
                finalizedCount,

              attendance_percentage:
                attendancePercentage,

              total_service_days:
                totalServiceDays,

              total_service_hours:
                totalServiceHours,
            },

            id_card: allowed
              ? idCardMap.get(member.id)?.[0]
                || null
              : null,

            accommodation:
              allowed &&
              registration.accommodation_enabled === true
                ? accommodationMap.get(member.id) || []
                : [],

            certificate: allowed
              ? certificateMap.get(member.id)?.[0]
                || null
              : null,
          };
        });

      // ========================================
      // REGISTRATION PROGRESS
      // ========================================

      const stats = {
        total_members:
          registration.total_members,

        visible_members:
          members.length,

        approved_members:
          members.filter(
            member =>
              member.status === 'approved' ||
              member.status === 'completed'
          ).length,

        completed_members:
          members.filter(
            member =>
              member.status === 'completed'
          ).length,

        total_assignments:
          members.reduce(
            (sum, member) =>
              sum + member.assignments.length,
            0
          ),

        upcoming_assignments:
          members.reduce(
            (sum, member) =>
              sum +
              member.assignments.filter(
             (item: any) =>
  item.display_status === 'upcoming'
              ).length,
            0
          ),

        current_assignments:
          members.reduce(
            (sum, member) =>
              sum +
              member.assignments.filter(
               (item: any) =>
  item.display_status === 'current'
              ).length,
            0
          ),

        certificates_issued:
          members.filter(
            member =>
              member.certificate !== null
          ).length,
      };

      // ========================================
      // NEXT UPCOMING DUTY
      // ========================================

 // ========================================
// NEXT UPCOMING DUTY
// ========================================

const upcoming = members.flatMap(
  member =>
    member.assignments
      .filter(
        (item: any) =>
          item.display_status === 'upcoming'
      )
      .map((item: any) => ({
        ...item,
        volunteer_name: member.full_name,
        member_code: member.member_code,
      }))
);

upcoming.sort(
  (a, b) =>
    new Date(a.shift_start_at).getTime() -
    new Date(b.shift_start_at).getTime()
);

const nextDuty = upcoming[0] || null;


      // ========================================
      // FINAL RESPONSE
      // ========================================

      return res.json({
        success: true,

        data: {
          registration,
          stats,

          next_duty: nextDuty,

          members,
        },
      });
    } catch (error) {
      if (!clientReleased) {
        try {
          await client.query('ROLLBACK');
        } catch {
          discardClient = true;
          console.error('Volunteer transaction rollback failed');
        }
      }

      throw error;
    } finally {
      if (!clientReleased) {
        clientReleased = true;
        client.release(discardClient);
      }
    }
  } catch (error) {
    console.error('My Seva details error:');

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};