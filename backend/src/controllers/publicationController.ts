
import { Request, Response } from 'express';
import { pool } from '../db';

// ========================================
// PUBLICATION CATEGORIES - PUBLIC
// ========================================

export const getPublicationCategories = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         name,
         description,
         icon,
         display_order,
         is_active
       FROM publication_categories
       WHERE is_active = TRUE
       ORDER BY display_order ASC, id ASC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get publication categories:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch publication categories',
    });
  }
};

// ========================================
// PUBLICATIONS - PUBLIC
// ========================================

export const getPublications = async (
  req: Request,
  res: Response
) => {
  try {
    const { category_id } = req.query;

    const params: unknown[] = [];

    let query = `
      SELECT
        p.id,
        p.category_id,
        c.name AS category_name,
        p.title,
        p.description,
        p.image_url,
        p.author,
        p.publication_date,
        p.document_url,
        p.is_active
      FROM publications p
      INNER JOIN publication_categories c
        ON c.id = p.category_id
      WHERE p.is_active = TRUE
        AND c.is_active = TRUE
    `;

    if (category_id !== undefined) {
      const id = Number(category_id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid category ID',
        });
        return;
      }

      params.push(id);
      query += ` AND p.category_id = $1`;
    }

    query += `
      ORDER BY
        p.publication_date DESC NULLS LAST,
        p.id DESC
    `;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get publications:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch publications',
    });
  }
};

// ========================================
// ADMIN - GET ALL CATEGORIES
// ========================================

export const getAdminPublicationCategories = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT
         c.*,
         COUNT(p.id)::INTEGER AS publication_count
       FROM publication_categories c
       LEFT JOIN publications p
         ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.display_order ASC, c.id ASC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Admin publication categories:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
    });
  }
};

// ========================================
// ADMIN - CREATE CATEGORY
// ========================================

export const createPublicationCategory = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      name,
      description,
      icon,
      display_order = 0,
      is_active = true,
    } = req.body ?? {};

    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
      return;
    }

    const order = Number(display_order);

    if (!Number.isSafeInteger(order)) {
      res.status(400).json({
        success: false,
        message: 'Invalid display order',
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO publication_categories
       (name, description, icon, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name.trim(),
        description ?? null,
        icon ?? null,
        order,
        is_active,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({
        success: false,
        message: 'Category already exists',
      });
      return;
    }

    console.error('Create publication category:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to create category',
    });
  }
};

// ========================================
// ADMIN - UPDATE CATEGORY
// ========================================

export const updatePublicationCategory = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid category ID',
      });
      return;
    }

    const {
      name,
      description,
      icon,
      display_order,
      is_active,
    } = req.body ?? {};

    if (
      name !== undefined &&
      (typeof name !== 'string' || !name.trim())
    ) {
      res.status(400).json({
        success: false,
        message: 'Valid category name is required',
      });
      return;
    }

    if (
      display_order !== undefined &&
      !Number.isSafeInteger(Number(display_order))
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid display order',
      });
      return;
    }

    const result = await pool.query(
      `UPDATE publication_categories
       SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         icon = COALESCE($3, icon),
         display_order = COALESCE($4, display_order),
         is_active = COALESCE($5, is_active),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        name === undefined ? null : name.trim(),
        description ?? null,
        icon ?? null,
        display_order === undefined
          ? null
          : Number(display_order),
        is_active ?? null,
        id,
      ]
    );

    if (!result.rows.length) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({
        success: false,
        message: 'Category name already exists',
      });
      return;
    }

    console.error('Update publication category:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update category',
    });
  }
};

// ========================================
// ADMIN - DELETE CATEGORY
// ========================================

export const deletePublicationCategory = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid category ID',
      });
      return;
    }

    const result = await pool.query(
      `DELETE FROM publication_categories
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error: any) {
    if (error.code === '23503') {
      res.status(409).json({
        success: false,
        message:
          'This category contains publications. Remove or reassign them before deleting.',
      });
      return;
    }

    console.error('Delete publication category:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
    });
  }
};

// ========================================
// ADMIN - GET ALL PUBLICATIONS
// ========================================

export const getAdminPublications = async (
  _req: Request,
  res: Response
) => {
  try {
    const result = await pool.query(
      `SELECT
         p.*,
         c.name AS category_name
       FROM publications p
       LEFT JOIN publication_categories c
         ON c.id = p.category_id
       ORDER BY p.id DESC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Admin publications:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch publications',
    });
  }
};

// ========================================
// ADMIN - CREATE PUBLICATION
// ========================================

export const createPublication = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      category_id,
      title,
      description,
      image_url,
      author,
      publication_date,
      document_url,
      is_active = true,
    } = req.body ?? {};

    const categoryId = Number(category_id);

    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
      res.status(400).json({
        success: false,
        message: 'Valid category is required',
      });
      return;
    }

    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({
        success: false,
        message: 'Publication title is required',
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO publications
       (
         category_id,
         title,
         description,
         image_url,
         author,
         publication_date,
         document_url,
         is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        categoryId,
        title.trim(),
        description ?? null,
        image_url ?? null,
        author ?? null,
        publication_date || null,
        document_url ?? null,
        is_active,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Publication created successfully',
      data: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === '23503') {
      res.status(400).json({
        success: false,
        message: 'Selected category does not exist',
      });
      return;
    }

    console.error('Create publication:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to create publication',
    });
  }
};

// ========================================
// ADMIN - UPDATE PUBLICATION
// ========================================

export const updatePublication = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid publication ID',
      });
      return;
    }

    const {
      category_id,
      title,
      description,
      image_url,
      author,
      publication_date,
      document_url,
      is_active,
    } = req.body ?? {};

    if (
      title !== undefined &&
      (typeof title !== 'string' || !title.trim())
    ) {
      res.status(400).json({
        success: false,
        message: 'Valid publication title is required',
      });
      return;
    }

    if (
      category_id !== undefined &&
      (!Number.isSafeInteger(Number(category_id)) ||
        Number(category_id) <= 0)
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid category ID',
      });
      return;
    }

    const result = await pool.query(
      `UPDATE publications
       SET
         category_id = COALESCE($1, category_id),
         title = COALESCE($2, title),
         description = COALESCE($3, description),
         image_url = COALESCE($4, image_url),
         author = COALESCE($5, author),
         publication_date = COALESCE($6, publication_date),
         document_url = COALESCE($7, document_url),
         is_active = COALESCE($8, is_active),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        category_id === undefined
          ? null
          : Number(category_id),
        title === undefined ? null : title.trim(),
        description ?? null,
        image_url ?? null,
        author ?? null,
        publication_date || null,
        document_url ?? null,
        is_active ?? null,
        id,
      ]
    );

    if (!result.rows.length) {
      res.status(404).json({
        success: false,
        message: 'Publication not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Publication updated successfully',
      data: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === '23503') {
      res.status(400).json({
        success: false,
        message: 'Selected category does not exist',
      });
      return;
    }

    console.error('Update publication:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update publication',
    });
  }
};

// ========================================
// ADMIN - DELETE PUBLICATION
// ========================================

export const deletePublication = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid publication ID',
      });
      return;
    }

    const result = await pool.query(
      `DELETE FROM publications
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      res.status(404).json({
        success: false,
        message: 'Publication not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Publication deleted successfully',
    });
  } catch (error) {
    console.error('Delete publication:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete publication',
    });
  }
};
