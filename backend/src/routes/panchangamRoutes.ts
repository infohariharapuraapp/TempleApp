
import { Router } from 'express';
import { calculatePanchangam } from '../services/panchangamService';

const router = Router();

router.get('/', (req, res) => {
  try {
    const date = String(req.query.date ?? '');
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    if (!match) {
      res.status(400).json({
        success: false,
        message: 'Date must be YYYY-MM-DD',
      });
      return;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const parsed = new Date(
      Date.UTC(year, month - 1, day),
    );

    if (
      year < 1900 ||
      year > 2100 ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid calendar date',
      });
      return;
    }

    if (
      req.query.lat === undefined ||
      req.query.lon === undefined ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < 6 ||
      lat > 38 ||
      lon < 68 ||
      lon > 98
    ) {
      res.status(400).json({
        success: false,
        message:
          'Valid Indian latitude and longitude are required',
      });
      return;
    }

    const data = calculatePanchangam(
      date,
      lat,
      lon,
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Panchangam error:', error);

    res.status(500).json({
      success: false,
      message:
        'Unable to calculate Panchangam for this date and location',
    });
  }
});

export default router;
