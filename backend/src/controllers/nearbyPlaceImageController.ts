
import { Request, Response } from 'express';
import { pool } from '../db';

const validId = (value: unknown): boolean =>
  typeof value === 'string' &&
  /^[1-9]\d*$/.test(value);

const validImageUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
};

const getPlace = async (placeId: string) => {
  const result = await pool.query(
    'SELECT id FROM nearby_places WHERE id = $1',
    [placeId]
  );

  return result.rows.length > 0;
};

/*
|--------------------------------------------------------------------------
| PUBLIC / ADMIN - GET IMAGES
|--------------------------------------------------------------------------
*/


export const getNearbyPlaceImages = async (
  req: Request,
  res: Response
) => {
  try {
    const placeId = String(req.params.placeId);

    if (!validId(placeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid place ID',
      });
    }

    // Public access is limited to active places
    // belonging to active categories.
    const placeResult = await pool.query(
      `
      SELECT p.id
      FROM nearby_places p
      INNER JOIN nearby_place_categories c
        ON c.id = p.category_id
      WHERE p.id = $1
        AND p.is_active = TRUE
        AND c.is_active = TRUE
      `,
      [placeId]
    );

    if (placeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Place not found or unavailable',
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        place_id,
        image_url,
        display_order
      FROM nearby_place_images
      WHERE place_id = $1
      ORDER BY display_order ASC, id ASC
      `,
      [placeId]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get nearby place images:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch place images',
    });
  }
};


/*
|--------------------------------------------------------------------------
| ADMIN - ADD IMAGE URL
|--------------------------------------------------------------------------
*/

export const addNearbyPlaceImage = async (
  req: Request,
  res: Response
) => {
  try {
    const placeId = String(req.params.placeId);
    const { image_url, display_order = 0 } = req.body;

    if (!validId(placeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid place ID',
      });
    }

    if (!validImageUrl(image_url)) {
      return res.status(400).json({
        success: false,
        message: 'A valid HTTPS image URL is required',
      });
    }

    const order = Number(display_order);

    if (!Number.isSafeInteger(order) || order < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid display order',
      });
    }

    if (!(await getPlace(placeId))) {
      return res.status(404).json({
        success: false,
        message: 'Place not found',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO nearby_place_images
        (place_id, image_url, display_order)
      VALUES ($1, $2, $3)
      RETURNING id, place_id, image_url, display_order
      `,
      [placeId, image_url.trim(), order]
    );

    return res.status(201).json({
      success: true,
      message: 'Place image added successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Add nearby place image:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to add place image',
    });
  }
};

/*
|--------------------------------------------------------------------------
| ADMIN - UPDATE IMAGE ORDER
|--------------------------------------------------------------------------
*/

export const updateNearbyPlaceImage = async (
  req: Request,
  res: Response
) => {
  try {
    const placeId = String(req.params.placeId);
    const imageId = String(req.params.imageId);
    const order = Number(req.body.display_order);

    if (!validId(placeId) || !validId(imageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image or place ID',
      });
    }

    if (!Number.isSafeInteger(order) || order < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid display order',
      });
    }

    const result = await pool.query(
      `
      UPDATE nearby_place_images
      SET display_order = $1
      WHERE id = $2 AND place_id = $3
      RETURNING id, place_id, image_url, display_order
      `,
      [order, imageId, placeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Image not found',
      });
    }

    return res.json({
      success: true,
      message: 'Image order updated',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update nearby place image:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update image',
    });
  }
};

/*
|--------------------------------------------------------------------------
| ADMIN - DELETE IMAGE
|--------------------------------------------------------------------------
*/

export const deleteNearbyPlaceImage = async (
  req: Request,
  res: Response
) => {
  try {
    const placeId = String(req.params.placeId);
    const imageId = String(req.params.imageId);

    if (!validId(placeId) || !validId(imageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image or place ID',
      });
    }

    const result = await pool.query(
      `
      DELETE FROM nearby_place_images
      WHERE id = $1 AND place_id = $2
      RETURNING id, image_url
      `,
      [imageId, placeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Image not found',
      });
    }

    return res.json({
      success: true,
      message: 'Image removed from gallery',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Delete nearby place image:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete image',
    });
  }
};



export const getAdminNearbyPlaceImages = async (
  req: Request,
  res: Response
) => {
  try {
    const placeId = String(req.params.placeId);

    if (!validId(placeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid place ID',
      });
    }

    const placeResult = await pool.query(
      `
      SELECT id
      FROM nearby_places
      WHERE id = $1
      `,
      [placeId]
    );

    if (placeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Place not found',
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        place_id,
        image_url,
        display_order
      FROM nearby_place_images
      WHERE place_id = $1
      ORDER BY display_order ASC, id ASC
      `,
      [placeId]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get admin nearby place images:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch place images',
    });
  }
};
