import { Request, Response } from 'express';
import { pool } from '../db';

import {
  getOpportunityServiceDates,
} from '../services/volunteerServiceDateService';

// ========================================
// PUBLIC: GET AVAILABLE SERVICE DATES
// ========================================

export const getAvailableServiceDates = async (
  req: Request,
  res: Response
) => {
  const rawId = String(
    req.params.opportunityId
  );

  if (
    !/^[1-9]\d*$/.test(rawId) ||
    Number(rawId) > 2147483647
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid opportunity ID',
    });
  }

  const opportunityId = Number(rawId);

  res.set('Cache-Control', 'no-store');

  try {
    const client = await pool.connect();

    try {
      await client.query(
        'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'
      );

      const result = await client.query(
        `
        SELECT
          id,
          title,
          required_volunteers,

          service_start_date::text
            AS service_start_date,

          service_end_date::text
            AS service_end_date,

          (
            registration_enabled = TRUE

            AND clock_timestamp()
              >= registration_start_at

            AND clock_timestamp()
              < registration_end_at

            AND service_end_date >= (
              clock_timestamp()
              AT TIME ZONE 'Asia/Kolkata'
            )::date

          ) AS registration_open

        FROM volunteer_opportunities

        WHERE id = $1

          AND is_published = TRUE
        `,
        [opportunityId]
      );

      if (!result.rows.length) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          success: false,
          message: 'Volunteer opportunity not found',
        });
      }

      const opportunity = result.rows[0];

      const dates = opportunity.registration_open
        ? await getOpportunityServiceDates(
            client,
            opportunityId
          )
        : [];

      await client.query('COMMIT');

      return res.json({
        success: true,

        data: {
          opportunity_id: opportunity.id,

          programme_name: opportunity.title,

          service_start_date:
            opportunity.service_start_date,

          service_end_date:
            opportunity.service_end_date,

          registration_open:
            opportunity.registration_open,

          total_available_dates: dates.length,

          required_volunteers: Number(opportunity.required_volunteers),
          service_dates: dates,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK')
        .catch(console.error);

      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(
      'Available service dates error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to load service dates',
    });
  }
};