
import { Request, Response } from 'express';
import { pool } from '../db';
import { AuthRequest } from '../middleware/authMiddleware';
const VALID_STATUSES = [
  'approved',
  'rejected',
  'hidden',
] as const;

type ModerationStatus = typeof VALID_STATUSES[number];

const parseId = (value: unknown): number | null => {
  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
};

const getModerationStatus = (
  value: unknown
): ModerationStatus | null => {
  if (
    typeof value === 'string' &&
    VALID_STATUSES.includes(value as ModerationStatus)
  ) {
    return value as ModerationStatus;
  }

  return null;
};

// ========================================
// GET QUESTIONS FOR ADMIN REVIEW
// ========================================

export const getAdminDharmaQuestions = async (
  req: Request,
  res: Response
) => {
  try {
    const status = req.query.status;

    if (
      status !== undefined &&
      (typeof status !== 'string' ||
        !['pending', ...VALID_STATUSES].includes(status))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question status',
      });
    }

    const result = await pool.query(
      `
      SELECT
        q.id,
        q.user_id,
        q.category_id,
        q.title,
        q.description,
        q.status,
        q.created_at,
        q.updated_at,
       COALESCE(u.full_name, 'Deleted Devotee') AS devotee_name,
        c.name AS category_name
      FROM dharma_questions q
     LEFT JOIN users u ON u.id = q.user_id
      JOIN dharma_categories c ON c.id = q.category_id
      WHERE ($1::VARCHAR IS NULL OR q.status = $1)
      ORDER BY
        CASE WHEN q.status = 'pending' THEN 0 ELSE 1 END,
        q.created_at DESC,
        q.id DESC
      LIMIT 100
      `,
      [status ?? null]
    );

    return res.json({
      success: true,
      questions: result.rows,
    });
  } catch (error) {
    console.error('Admin Dharma questions error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch questions',
    });
  }
};

// ========================================
// MODERATE QUESTION
// ========================================

export const moderateDharmaQuestion = async (
  req: Request,
  res: Response
) => {
  const questionId = parseId(req.params.id);
  const status = getModerationStatus(req.body?.status);

  if (!questionId || !status) {
    return res.status(400).json({
      success: false,
      message: 'Valid question ID and status are required',
    });
  }

  try {
    const result = await pool.query(
      `
      UPDATE dharma_questions
      SET
        status = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        title,
        status,
        updated_at
      `,
      [status, questionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Question not found',
      });
    }

    return res.json({
      success: true,
      message: `Question ${status} successfully`,
      question: result.rows[0],
    });
  } catch (error) {
    console.error('Moderate Dharma question error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to moderate question',
    });
  }
};

// ========================================
// GET ANSWERS FOR ADMIN REVIEW
// ========================================

export const getAdminDharmaAnswers = async (
  req: Request,
  res: Response
) => {
  try {
    const status = req.query.status;

    if (
      status !== undefined &&
      (typeof status !== 'string' ||
        !['pending', ...VALID_STATUSES].includes(status))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid answer status',
      });
    }

    const result = await pool.query(
      `
      SELECT
        a.id,
        a.question_id,
        a.user_id,
        a.answer,
        a.answer_type,
        a.status,
        a.created_at,
        a.updated_at,
        COALESCE(u.full_name, 'Deleted Devotee') AS devotee_name,
        q.title AS question_title
      FROM dharma_answers a
     LEFT JOIN users u ON u.id = a.user_id
      JOIN dharma_questions q ON q.id = a.question_id
      WHERE ($1::VARCHAR IS NULL OR a.status = $1)
      ORDER BY
        CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END,
        a.created_at DESC,
        a.id DESC
      LIMIT 100
      `,
      [status ?? null]
    );

    return res.json({
      success: true,
      answers: result.rows,
    });
  } catch (error) {
    console.error('Admin Dharma answers error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch answers',
    });
  }
};

// ========================================
// MODERATE ANSWER
// ========================================

export const moderateDharmaAnswer = async (
  req: Request,
  res: Response
) => {
  const answerId = parseId(req.params.id);
  const status = getModerationStatus(req.body?.status);

  if (!answerId || !status) {
    return res.status(400).json({
      success: false,
      message: 'Valid answer ID and status are required',
    });
  }

  try {
    const result = await pool.query(
      `
      UPDATE dharma_answers
      SET
        status = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        question_id,
        answer_type,
        status,
        updated_at
      `,
      [status, answerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Answer not found',
      });
    }

    return res.json({
      success: true,
      message: `Answer ${status} successfully`,
      answer: result.rows[0],
    });
  } catch (error) {
    console.error('Moderate Dharma answer error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to moderate answer',
    });
  }
};

 // ========================================
 // PUBLISH OFFICIAL TEMPLE ANSWER
 // ========================================

export const createOfficialDharmaAnswer = async (
  req: AuthRequest,
  res: Response
) => {
  const questionId = Number(req.params.id);
  const adminId = req.user?.userId;
  const answer = req.body?.answer;

  if (
    !Number.isSafeInteger(adminId) ||
    !adminId ||
    adminId <= 0
  ) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (
    !Number.isSafeInteger(questionId) ||
    questionId <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid question ID',
    });
  }

  if (
    typeof answer !== 'string' ||
    answer.trim().length < 10 ||
    answer.trim().length > 2000
  ) {
    return res.status(400).json({
      success: false,
      message: 'Official answer must contain 10 to 2000 characters',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Recheck administrator permissions in the database.
    // Assumes users.role stores the value "admin".
    const adminResult = await client.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
        AND role = 'admin'
      `,
      [adminId]
    );

    if (adminResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        success: false,
        message: 'Only authorized administrators can publish official answers',
      });
    }

    // Lock the question and verify it is approved.
    const questionResult = await client.query(
      `
      SELECT id, title, status
      FROM dharma_questions
      WHERE id = $1
      FOR UPDATE
      `,
      [questionId]
    );

    if (questionResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Question not found',
      });
    }

    if (questionResult.rows[0].status !== 'approved') {
      await client.query('ROLLBACK');

      return res.status(403).json({
        success: false,
        message: 'Official answers can only be published for approved questions',
      });
    }

    // Insert an official answer separately from community answers.
  // Check whether an official answer already exists.
const existing = await client.query(
  `
  SELECT id
  FROM dharma_answers
  WHERE question_id = $1
    AND answer_type = 'official'
  ORDER BY id ASC
  LIMIT 1
  `,
  [questionId]
);

let result;

if (existing.rows.length > 0) {
  // Update the existing official answer.
  result = await client.query(
    `
    UPDATE dharma_answers
    SET
      answer = $1,
      status = 'approved',
      updated_at = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [answer.trim(), existing.rows[0].id]
  );
} else {
  // Create the first official answer.
  result = await client.query(
    `
    INSERT INTO dharma_answers
      (question_id, user_id, answer, answer_type, status)
    VALUES
      ($1, $2, $3, 'official', 'approved')
    RETURNING *
    `,
    [questionId, adminId, answer.trim()]
  );
}

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Official temple answer published successfully',
      answer: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Create official Dharma answer error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to publish official temple answer',
    });
  } finally {
    client.release();
  }
};
