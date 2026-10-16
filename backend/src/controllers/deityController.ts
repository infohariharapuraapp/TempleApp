
import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// DEITY FIELDS
// ========================================

const DEITY_FIELDS = `
  id,
  name,
  description,
  image_url,
  significance,
  devotional,
  is_active,
  deity_type,
  parent_deity_id,
  display_order
`;

// ========================================
// GET TOP-LEVEL DEITIES
// GET /api/deities
// ========================================

export const getDeities = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `
      SELECT
        ${DEITY_FIELDS}
      FROM deities
      WHERE is_active = TRUE
        AND parent_deity_id IS NULL
      ORDER BY
        display_order ASC,
        id ASC
      `
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      'Error fetching deities:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch deities',
    });
  }
};

// ========================================
// GET DEITY DETAILS
// GET /api/deities/:id
//
// Individual:
//   Returns deity details.
//
// Group:
//   Returns group details and sub_deities.
//
// Sub-deity:
//   Returns individual details if its
//   parent group is active.
// ========================================

export const getDeityById = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    // ------------------------------------
    // VALIDATE ID
    // ------------------------------------

    if (
      !Number.isSafeInteger(id) ||
      id <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid deity ID',
      });
    }

    // ------------------------------------
    // FETCH DEITY
    // ------------------------------------

    const result = await pool.query(
      `
      SELECT
        ${DEITY_FIELDS}
      FROM deities
      WHERE id = $1
        AND is_active = TRUE
        AND (
          parent_deity_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM deities parent
            WHERE parent.id =
              deities.parent_deity_id
              AND parent.deity_type = 'group'
              AND parent.is_active = TRUE
          )
        )
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Deity not found',
      });
    }

    const deity = result.rows[0];

    // ------------------------------------
    // GROUP DETAILS
    // ------------------------------------

    if (deity.deity_type === 'group') {
      const childrenResult =
        await pool.query(
          `
          SELECT
            ${DEITY_FIELDS}
          FROM deities
          WHERE parent_deity_id = $1
            AND deity_type = 'individual'
            AND is_active = TRUE
          ORDER BY
            display_order ASC,
            id ASC
          `,
          [id]
        );

      return res.json({
        success: true,
        data: {
          ...deity,
          sub_deities: childrenResult.rows,
        },
      });
    }

    // ------------------------------------
    // INDIVIDUAL / SUB-DEITY DETAILS
    // ------------------------------------

    return res.json({
      success: true,
      data: deity,
    });
  } catch (error) {
    console.error(
      'Error fetching deity:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch deity',
    });
  }
};
