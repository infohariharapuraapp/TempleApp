
  import { Request, Response } from 'express';
  import { pool } from '../db';
  import { AuthRequest } from '../middleware/authMiddleware';

  // ========================================
  // GET PUBLIC CATEGORIES
  // ========================================

  export const getDharmaCategories = async (
    _req: Request,
    res: Response
  ) => {
    try {
      const result = await pool.query(`
        SELECT id, name, description
        FROM dharma_categories
        WHERE is_active = TRUE
        ORDER BY display_order ASC, id ASC
      `);

      return res.json({
        success: true,
        categories: result.rows,
      });
    } catch (error) {
      console.error('Get Dharma categories error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch categories',
      });
    }
  };

  // ========================================
  // GET APPROVED QUESTIONS
  // ========================================

  export const getDharmaQuestions = async (
    req: Request,
    res: Response
  ) => {
    try {
      const categoryId = req.query.category_id;
      const search = req.query.search;
      const filter = req.query.filter;

      const page = Math.max(
        1,
        Number.parseInt(String(req.query.page ?? '1'), 10) || 1
      );

      const limit = 20;
      const offset = (page - 1) * limit;

      const conditions: string[] = [
        "q.status = 'approved'",
      ];

      const params: unknown[] = [];

      if (categoryId !== undefined) {
        const parsedId = Number(categoryId);

        if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid category ID',
          });
        }

        params.push(parsedId);
        conditions.push(
          `q.category_id = $${params.length}`
        );
      }

      if (
        typeof search === 'string' &&
        search.trim().length > 0
      ) {
        params.push(`%${search.trim()}%`);

        conditions.push(
          `(q.title ILIKE $${params.length}
            OR q.description ILIKE $${params.length})`
        );
      }

      if (filter === 'unanswered') {
        conditions.push(`
          NOT EXISTS (
            SELECT 1
            FROM dharma_answers a
            WHERE a.question_id = q.id
              AND a.status = 'approved'
              AND a.answer_type = 'community'
          )
        `);
      } else if (filter === 'answered') {
        conditions.push(`
          EXISTS (
            SELECT 1
            FROM dharma_answers a
            WHERE a.question_id = q.id
              AND a.status = 'approved'
              AND a.answer_type = 'community'
          )
        `);
      } else if (
        filter !== undefined &&
        filter !== 'latest'
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid question filter',
        });
      }

      const whereClause = conditions.join(' AND ');

      params.push(limit);
      const limitParam = params.length;

      params.push(offset);
      const offsetParam = params.length;

      const result = await pool.query(
        `
        SELECT
          q.id,
          q.title,
          q.description,
          q.created_at,
          q.category_id,
          c.name AS category_name,
          COALESCE(u.full_name, 'Deleted Devotee') AS devotee_name,

          (
            SELECT COUNT(*)::INTEGER
            FROM dharma_answers a
            WHERE a.question_id = q.id
              AND a.answer_type = 'community'
              AND a.status = 'approved'
          ) AS answer_count

        FROM dharma_questions q
        JOIN dharma_categories c
          ON c.id = q.category_id
        LEFT JOIN users u
          ON u.id = q.user_id

        WHERE ${whereClause}

        ORDER BY q.created_at DESC, q.id DESC

        LIMIT $${limitParam}
        OFFSET $${offsetParam}
        `,
        params
      );

      return res.json({
        success: true,
        questions: result.rows,
        page,
        limit,
        hasMore: result.rows.length === limit,
      });
    } catch (error) {
      console.error('Get Dharma questions error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch questions',
      });
    }
  };

  // ========================================
  // GET ONE APPROVED QUESTION
  // ========================================

  export const getDharmaQuestionById = async (
    req: Request,
    res: Response
  ) => {
    try {
      const questionId = Number(req.params.id);

      if (
        !Number.isSafeInteger(questionId) ||
        questionId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid question ID',
        });
      }

      const questionResult = await pool.query(
        `
      SELECT
  q.id,
  q.user_id,
  q.title,
  q.description,
  q.created_at,
  q.category_id,
  c.name AS category_name,
  COALESCE(u.full_name, 'Deleted Devotee') AS devotee_name

        FROM dharma_questions q
        JOIN dharma_categories c
          ON c.id = q.category_id
       LEFT JOIN users u
          ON u.id = q.user_id


        WHERE q.id = $1
          AND q.status = 'approved'
        `,
        [questionId]
      );

      if (questionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Question not found',
        });
      }
      const authReq = req as AuthRequest;
  const userId = authReq.user?.userId ?? null;

    const answersResult = await pool.query(
    `
    SELECT
      a.id,
      a.answer,
      a.answer_type,
      a.created_at,
     COALESCE(u.full_name, 'Deleted Devotee') AS devotee_name,

      (
        SELECT COUNT(*)::INTEGER
        FROM dharma_votes v
        WHERE v.answer_id = a.id
      ) AS helpful_count,

      EXISTS (
        SELECT 1
        FROM dharma_votes v
        WHERE v.answer_id = a.id
          AND v.user_id = $2
      ) AS is_liked

    FROM dharma_answers a
    LEFT JOIN users u
      ON u.id = a.user_id

    WHERE a.question_id = $1
      AND a.status = 'approved'

    ORDER BY
      CASE
        WHEN a.answer_type = 'official' THEN 0
        ELSE 1
      END,
      a.created_at ASC,
      a.id ASC
    `,
    [questionId, userId]
  );

      const countResult = await pool.query(
        `
        SELECT COUNT(*)::INTEGER AS total
        FROM dharma_answers
        WHERE question_id = $1
          AND answer_type = 'community'
        `,
        [questionId]
      );

      return res.json({
        success: true,
        question: questionResult.rows[0],
        answers: answersResult.rows,
        communityAnswerSlotsUsed: countResult.rows[0].total,
        maxCommunityAnswers: 10,
      });
    } catch (error) {
      console.error('Get Dharma question error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch question details',
      });
    }
  };

  // ========================================
  // SUBMIT QUESTION (AUTHENTICATED)
  // ========================================

  export const createDharmaQuestion = async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const userId = req.user?.userId;
      const { category_id, title, description } = req.body ?? {};

      if (!Number.isSafeInteger(userId) || !userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      if (
        typeof title !== 'string' ||
        title.trim().length < 10 ||
        title.trim().length > 200
      ) {
        return res.status(400).json({
          success: false,
          message: 'Question must contain 10 to 200 characters',
        });
      }

      if (
        description !== undefined &&
        description !== null &&
        (
          typeof description !== 'string' ||
          description.length > 2000
        )
      ) {
        return res.status(400).json({
          success: false,
          message: 'Description must not exceed 2000 characters',
        });
      }

      const categoryId = Number(category_id);

      if (
        !Number.isSafeInteger(categoryId) ||
        categoryId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Valid category is required',
        });
      }

      const categoryResult = await pool.query(
        `
        SELECT id
        FROM dharma_categories
        WHERE id = $1 AND is_active = TRUE
        `,
        [categoryId]
      );

      if (categoryResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Category not found or inactive',
        });
      }

      const result = await pool.query(
        `
        INSERT INTO dharma_questions
          (user_id, category_id, title, description, status)

        VALUES ($1, $2, $3, $4, 'pending')

        RETURNING
          id,
          user_id,
          category_id,
          title,
          description,
          status,
          created_at
        `,
        [
          userId,
          categoryId,
          title.trim(),
          typeof description === 'string'
            ? description.trim() || null
            : null,
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Question submitted for admin approval',
        question: result.rows[0],
      });
    } catch (error) {
      console.error('Create Dharma question error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to submit question',
      });
    }
  };

  // ========================================
  // SUBMIT COMMUNITY ANSWER
  // ========================================

  export const createDharmaAnswer = async (
    req: AuthRequest,
    res: Response
  ) => {
    const userId = req.user?.userId;
    const questionId = Number(req.params.id);
    const answer = req.body?.answer;

    if (!Number.isSafeInteger(userId) || !userId) {
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
        message: 'Answer must contain 10 to 2000 characters',
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Lock this question to serialize answer submissions.
      const questionResult = await client.query(
        `
        SELECT id, user_id, status
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

      const question = questionResult.rows[0];


      if (question.status !== 'approved') {
        await client.query('ROLLBACK');

        return res.status(403).json({
          success: false,
          message: 'This question is not open for answers',
        });
      }
      // Prevent devotees from answering their own questions
  if (Number(question.user_id) === userId) {
    await client.query('ROLLBACK');

    return res.status(403).json({
      success: false,
      message: 'You cannot answer your own question',
    });
  }

      // Check if the devotee has already answered.
      const existingAnswer = await client.query(
        `
        SELECT id
        FROM dharma_answers
        WHERE question_id = $1
          AND user_id = $2
          AND answer_type = 'community'
        `,
        [questionId, userId]
      );

      if (existingAnswer.rows.length > 0) {
        await client.query('ROLLBACK');

        return res.status(409).json({
          success: false,
          message: 'You have already answered this question',
        });
      }

      // Count all community answer slots, including pending answers.
      const countResult = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS total
        FROM dharma_answers
        WHERE question_id = $1
          AND answer_type = 'community'
        `,
        [questionId]
      );

      if (countResult.rows[0].total >= 10) {
        await client.query('ROLLBACK');

        return res.status(409).json({
          success: false,
          message: 'Maximum 10 community answers reached',
        });
      }

      // Never accept user_id, answer_type, or status from the app.
      const result = await client.query(
        `
        INSERT INTO dharma_answers
          (
            question_id,
            user_id,
            answer,
            answer_type,
            status
          )
        VALUES
          ($1, $2, $3, 'community', 'pending')
        RETURNING
          id,
          question_id,
          user_id,
          answer,
          answer_type,
          status,
          created_at
        `,
        [questionId, userId, answer.trim()]
      );

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        message: 'Answer submitted for admin approval',
        answer: result.rows[0],
      });
    } catch (error: any) {
      await client.query('ROLLBACK');

      console.error('Create Dharma answer error:', error);

      if (error?.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'You have already answered this question',
        });
      }

      if (
        typeof error?.message === 'string' &&
        error.message.includes(
          'Maximum 10 community answers allowed'
        )
      ) {
        return res.status(409).json({
          success: false,
          message: 'Maximum 10 community answers reached',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to submit answer',
      });
    } finally {
      client.release();
    }
  };

  // ========================================
  // TOGGLE HELPFUL VOTE
  // ========================================

  export const toggleDharmaHelpfulVote = async (
    req: AuthRequest,
    res: Response
  ) => {
    const userId = req.user?.userId;
    const answerId = Number(req.params.answerId);

    if (!Number.isSafeInteger(userId) || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (
      !Number.isSafeInteger(answerId) ||
      answerId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid answer ID',
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Lock the answer so concurrent vote toggles
      // for the same answer are processed in order.
      const answerResult = await client.query(
        `
        SELECT
          a.id,
          a.user_id,
          a.status,
          q.status AS question_status
        FROM dharma_answers a
        JOIN dharma_questions q
          ON q.id = a.question_id
        WHERE a.id = $1
        FOR UPDATE OF a
        `,
        [answerId]
      );

      if (answerResult.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          success: false,
          message: 'Answer not found',
        });
      }

      const answer = answerResult.rows[0];

      if (
        answer.status !== 'approved' ||
        answer.question_status !== 'approved'
      ) {
        await client.query('ROLLBACK');

        return res.status(403).json({
          success: false,
          message: 'This answer is not available for voting',
        });
      }

      // Prevent devotees from voting on their own answers.
      if (answer.user_id === userId) {
        await client.query('ROLLBACK');

        return res.status(403).json({
          success: false,
          message: 'You cannot vote on your own answer',
        });
      }

      const existingVote = await client.query(
        `
        SELECT id
        FROM dharma_votes
        WHERE answer_id = $1
          AND user_id = $2
        `,
        [answerId, userId]
      );

      let isHelpful: boolean;

      if (existingVote.rows.length > 0) {
        // Remove existing vote.
        await client.query(
          `
          DELETE FROM dharma_votes
          WHERE answer_id = $1
            AND user_id = $2
          `,
          [answerId, userId]
        );

        isHelpful = false;
      } else {
        // Add helpful vote.
        await client.query(
          `
          INSERT INTO dharma_votes (answer_id, user_id)
          VALUES ($1, $2)
          `,
          [answerId, userId]
        );

        isHelpful = true;
      }

      const countResult = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS helpful_count
        FROM dharma_votes
        WHERE answer_id = $1
        `,
        [answerId]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        answerId,
        isHelpful,
        helpfulCount: countResult.rows[0].helpful_count,
        message: isHelpful
          ? 'Answer marked as helpful'
          : 'Helpful vote removed',
      });
    } catch (error) {
      await client.query('ROLLBACK');

      console.error('Dharma helpful vote error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to update helpful vote',
      });
    } finally {
      client.release();
    }
  };

  // ========================================
  // REPORT QUESTION OR ANSWER
  // ========================================

  export const reportDharmaContent = async (
    req: AuthRequest,
    res: Response
  ) => {
    const userId = req.user?.userId;
    const { question_id, answer_id, reason } = req.body ?? {};

    if (!Number.isSafeInteger(userId) || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const hasQuestion = question_id !== undefined &&
      question_id !== null;

    const hasAnswer = answer_id !== undefined &&
      answer_id !== null;

    if (hasQuestion === hasAnswer) {
      return res.status(400).json({
        success: false,
        message: 'Provide either question_id or answer_id',
      });
    }

    const targetId = Number(
      hasQuestion ? question_id : answer_id
    );

    if (!Number.isSafeInteger(targetId) || targetId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid content ID',
      });
    }

    if (
      typeof reason !== 'string' ||
      reason.trim().length < 10 ||
      reason.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: 'Report reason must contain 10 to 500 characters',
      });
    }

    try {
      const targetResult = hasQuestion
        ? await pool.query(
            `
            SELECT id
            FROM dharma_questions
            WHERE id = $1 AND status = 'approved'
            `,
            [targetId]
          )
        : await pool.query(
            `
            SELECT a.id
            FROM dharma_answers a
            JOIN dharma_questions q
              ON q.id = a.question_id
            WHERE a.id = $1
              AND a.status = 'approved'
              AND q.status = 'approved'
            `,
            [targetId]
          );

      if (targetResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Content not found or unavailable',
        });
      }

      // Prevent repeated pending reports by the same user.
      const duplicateResult = await pool.query(
        `
        SELECT id
        FROM dharma_reports
        WHERE reported_by = $1
          AND status = 'pending'
          AND (
            ($2::INTEGER IS NOT NULL AND question_id = $2)
            OR
            ($3::INTEGER IS NOT NULL AND answer_id = $3)
          )
        LIMIT 1
        `,
        [
          userId,
          hasQuestion ? targetId : null,
          hasAnswer ? targetId : null,
        ]
      );

      if (duplicateResult.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'You have already reported this content',
        });
      }

      const result = await pool.query(
        `
        INSERT INTO dharma_reports
          (reported_by, question_id, answer_id, reason)
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          question_id,
          answer_id,
          reason,
          status,
          created_at
        `,
        [
          userId,
          hasQuestion ? targetId : null,
          hasAnswer ? targetId : null,
          reason.trim(),
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Report submitted for admin review',
        report: result.rows[0],
      });
    } catch (error) {
      console.error('Report Dharma content error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to submit report',
      });
    }

  };

  // ========================================
  // GET DHARMA REPORTS FOR ADMIN
  // ========================================

  export const getAdminDharmaReports = async (
    req: Request,
    res: Response
  ) => {
    try {
      const status = req.query.status;

      if (
        status !== undefined &&
        (
          typeof status !== 'string' ||
          !['pending', 'reviewed', 'dismissed'].includes(status)
        )
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid report status',
        });
      }

      const result = await pool.query(
        `
        SELECT
          r.id,
          r.reported_by,
          r.question_id,
          r.answer_id,
          r.reason,
          r.status,
          r.created_at,

          COALESCE(reporter.full_name, 'Deleted Devotee') AS reported_by_name,

          q.title AS question_title,

          a.answer AS answer_text,

          CASE
            WHEN r.question_id IS NOT NULL THEN 'question'
            ELSE 'answer'
          END AS content_type

        FROM dharma_reports r

        LEFT JOIN users reporter
          ON reporter.id = r.reported_by

        LEFT JOIN dharma_questions q
          ON q.id = COALESCE(
            r.question_id,
            (
              SELECT question_id
              FROM dharma_answers
              WHERE id = r.answer_id
            )
          )

        LEFT JOIN dharma_answers a
          ON a.id = r.answer_id

        WHERE (
          $1::VARCHAR IS NULL
          OR r.status = $1
        )

        ORDER BY
          CASE
            WHEN r.status = 'pending' THEN 0
            ELSE 1
          END,
          r.created_at DESC,
          r.id DESC

        LIMIT 100
        `,
        [status ?? null]
      );

      return res.json({
        success: true,
        reports: result.rows,
      });
    } catch (error) {
      console.error('Get Dharma reports error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch reports',
      });
    }
  };

  // ========================================
  // REVIEW / DISMISS / HIDE REPORTED CONTENT
  // ========================================

  export const reviewDharmaReport = async (
    req: Request,
    res: Response
  ) => {
    const reportId = Number(req.params.id);

    const { action } = req.body ?? {};

  if (
    !Number.isSafeInteger(reportId) ||
    reportId <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid report ID',
    });
  }
    if (
      !['reviewed', 'dismissed', 'hide_content'].includes(action)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review action',
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const reportResult = await client.query(
        `
        SELECT
          id,
          question_id,
          answer_id,
          status
        FROM dharma_reports
        WHERE id = $1
        FOR UPDATE
        `,
        [reportId]
      );

      if (reportResult.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          success: false,
          message: 'Report not found',
        });
      }

      const report = reportResult.rows[0];

      if (report.status !== 'pending') {
        await client.query('ROLLBACK');

        return res.status(409).json({
          success: false,
          message: 'This report has already been resolved',
        });
      }

      let newStatus: 'reviewed' | 'dismissed';

      if (action === 'hide_content') {
        // Hide the exact content that was reported.
        const updateResult = report.question_id !== null
          ? await client.query(
              `
              UPDATE dharma_questions
              SET status = 'hidden', updated_at = NOW()
              WHERE id = $1
              RETURNING id
              `,
              [report.question_id]
            )
          : await client.query(
              `
              UPDATE dharma_answers
              SET status = 'hidden', updated_at = NOW()
              WHERE id = $1
              RETURNING id
              `,
              [report.answer_id]
            );

        if (updateResult.rows.length === 0) {
          await client.query('ROLLBACK');

          return res.status(404).json({
            success: false,
            message: 'Reported content no longer exists',
          });
        }

        newStatus = 'reviewed';
      } else {
        newStatus = action;
      }

      const result = await client.query(
        `
        UPDATE dharma_reports
        SET status = $1
        WHERE id = $2
        RETURNING
          id,
          question_id,
          answer_id,
          reason,
          status,
          created_at
        `,
        [newStatus, reportId]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        message:
          action === 'hide_content'
            ? 'Reported content hidden successfully'
            : `Report marked as ${newStatus}`,
        report: result.rows[0],
      });
    } catch (error) {
      await client.query('ROLLBACK');

      console.error('Review Dharma report error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to review report',
      });
    } finally {
      client.release();
    }
  };
