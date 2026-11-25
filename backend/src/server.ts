import cors from 'cors';
import dotenv from 'dotenv';
import express, { ErrorRequestHandler } from 'express';

import { pool } from './db';
import activityRoutes from './routes/activityRoutes';
import activitySectionRoutes from './routes/activitySectionRoutes';
import adminRoutes from './routes/adminRoutes';
import adminActivityRoutes from './routes/adminActivityRoutes';
import adminContentRoutes from './routes/adminContentRoutes';
import authRoutes from './routes/authRoutes';
import buildingRoutes from './routes/buildingRoutes';
import deityRoutes from './routes/deityRoutes';
import eventRoutes from './routes/eventRoutes';
import galleryRoutes from './routes/galleryRoutes';
import publicationRoutes from './routes/publicationRoutes';
import eventCategoryRoutes from './routes/eventCategoryRoutes';
import guruParamparaRoutes from './routes/guruParamparaRoutes';
import adminGuruParamparaRoutes from './routes/adminGuruParamparaRoutes';

import nearbyRoutes from './routes/nearbyRoutes';
import adminNearbyRoutes from './routes/adminNearbyRoutes';
import poojaRoutes from './routes/poojaRoutes';
import adminPoojaRoutes from './routes/adminPoojaRoutes';
import { Router } from 'express';
import { getTempleContact } from './controllers/templeContactController';

import welcomeSlokamRoutes from './routes/welcomeSlokamRoutes';

import translationRoutes from './routes/translationRoutes';
import {
  publicTranslationMiddleware,
} from './middleware/publicTranslation';


import adminWelcomeSlokamRoutes from './routes/adminWelcomeSlokamRoutes';

import quotesRoutes from './routes/quotesRoutes';
import adminQuotesRoutes from './routes/adminQuotesRoutes';


import {
  startVolunteerScheduler,
  stopVolunteerScheduler,
  waitForVolunteerSchedulerIdle,
} from './services/volunteerSchedulerService';



import mahaswamijiProgrammeRoutes from './routes/mahaswamijiProgrammeRoutes';
import adminMahaswamijiProgrammeRoutes from './routes/adminMahaswamijiProgrammeRoutes';



import adminTempleContactRoutes from './routes/adminTempleContactRoutes';

import pravachanaRoutes from './routes/pravachanaRoutes';
import adminPravachanaRoutes from './routes/adminPravachanaRoutes';


import adminDarshanRoutes from './routes/adminDarshanRoutes';
import darshanRoutes from './routes/darshanRoutes';
import darshanVideosRoutes from './routes/darshanVideos';
import notificationRoutes from './routes/notificationRoutes';
import announcementRoutes from './routes/announcementRoutes';
import adminAnnouncementRoutes from './routes/adminAnnouncementRoutes';
import adminGalleryAlbumRoutes from './routes/adminGalleryAlbumRoutes';
import dharmaRoutes from './routes/dharmaRoutes';
import adminDharmaRoutes from './routes/adminDharmaRoutes';
import guruVaniRoutes from './routes/guruVaniRoutes';


import volunteerRoutes from './routes/volunteerRoutes';
import adminVolunteerRoutes from './routes/adminVolunteerRoutes';



import nearbyPlaceImageUploadRoutes from './routes/nearbyPlaceImageUploadRoutes';

import {
  getNearbyPlaceImages,
    getAdminNearbyPlaceImages,
  addNearbyPlaceImage,
  updateNearbyPlaceImage,
  deleteNearbyPlaceImage,
} from './controllers/nearbyPlaceImageController';

import {
  authenticateToken,
} from './middleware/authMiddleware';

import {
  requireAdmin,
} from './middleware/adminMiddleware';



import {
  checkPushReceipts,
} from './services/notificationService';


import {
  welcomeScreenRouter,
  adminWelcomeScreenRouter,
} from './routes/welcomeScreenRoutes';

import panchangamRoutes from './routes/panchangamRoutes';
import adminGuruVaniRoutes from './routes/adminGuruVaniRoutes';
import {
  processScheduledNotifications,
} from './services/notificationScheduler';
dotenv.config();

const app = express();
// Reduce unnecessary framework information exposure.
app.disable('x-powered-by');
// Security headers compatible with mobile and admin clients.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
// Enable proxy trust only after verifying the deployment topology.
// Never use unrestricted `trust proxy: true`.
if (process.env.TRUST_PROXY_HOPS === '1') {
  app.set('trust proxy', 1);
}

const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

app.use(publicTranslationMiddleware);

app.use(
  '/uploads',
  express.static('uploads')
);

app.use('/api/deities', deityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/darshan', darshanRoutes);
app.use('/api', darshanVideosRoutes);
app.use('/api/admin', adminContentRoutes);
app.use('/api/admin/darshan', adminDarshanRoutes);
app.use('/api/admin/activities', adminActivityRoutes);
// ========================================
// POOJA SERVICES
// ========================================

app.use('/api/quotes', quotesRoutes);
app.use('/api/admin/quotes', adminQuotesRoutes);


// ========================================
// PRAVACHANA LIBRARY
// ========================================

// Public - Devotee App
app.use('/api/pravachanas', pravachanaRoutes);

// Protected - Admin Management
app.use('/api/admin/pravachanas', adminPravachanaRoutes);

// ========================================
// VOLUNTEER SEVA MANAGEMENT
// ========================================

// Public - Devotee App

app.use(
  '/api/volunteer',
  volunteerRoutes
);

// Protected - Admin Dashboard

app.use(
  '/api/admin/volunteer',
  adminVolunteerRoutes
);


// ========================================
// MAHASWAMIJI PROGRAMMES
// ========================================

// Public - Devotee App
app.use(
  '/api/mahaswamiji-programmes',
  mahaswamijiProgrammeRoutes
);



// Register before your 404/error handlers.
// Use each path only once.

app.get(
  '/api/nearby/places/:placeId/images',
  getNearbyPlaceImages
);

app.post(
  '/api/admin/nearby/places/:placeId/images',
  authenticateToken,
  requireAdmin,
  addNearbyPlaceImage
);




app.get(
  '/api/admin/nearby/places/:placeId/images',
  authenticateToken,
  requireAdmin,
  getAdminNearbyPlaceImages
);


app.put(
  '/api/admin/nearby/places/:placeId/images/:imageId',
  authenticateToken,
  requireAdmin,
  updateNearbyPlaceImage
);

app.delete(
  '/api/admin/nearby/places/:placeId/images/:imageId',
  authenticateToken,
  requireAdmin,
  deleteNearbyPlaceImage
);

app.use(
  '/api/admin/nearby/places',
  nearbyPlaceImageUploadRoutes
);


// Protected - Admin Dashboard
app.use(
  '/api/admin/mahaswamiji-programmes',
  adminMahaswamijiProgrammeRoutes
);


// Public - Devotee App
app.use('/api/poojas', poojaRoutes);

// Admin - Pooja Management
app.use('/api/admin/poojas', adminPoojaRoutes);
app.use(
  '/api/guru-parampara',
  guruParamparaRoutes
);


// ========================================
// DYNAMIC WELCOME SCREEN
// ========================================

// Public — mobile app
app.use(
  '/api/welcome-screen',
  welcomeScreenRouter
);

// Protected — admin dashboard
app.use(
  '/api/admin/welcome-screen',
  adminWelcomeScreenRouter
);



app.use(
  '/api/admin/guru-parampara',
  adminGuruParamparaRoutes
);

app.use('/api/activities', activityRoutes);
app.use(
  '/api/activity-sections',
  activitySectionRoutes
);
// ========================================
// GURU VANI ROUTES
// ========================================

// Public - devotees
app.use(
  '/api/guru-vani',
  guruVaniRoutes
);

// Admin - manage slokas
app.use(
  '/api/admin/guru-vani',
  adminGuruVaniRoutes
);
// ========================================
// DAILY PANCHANGAM - PUBLIC API
// ========================================
app.use('/api/panchangam', panchangamRoutes);


// ========================================
// WELCOME SLOKAM LIBRARY
// ========================================

// Public - Devotee App
app.use(
  '/api/welcome-slokams',
  welcomeSlokamRoutes
);

// Admin - Slokam Library Management
app.use(
  '/api/admin/welcome-slokams',
  adminWelcomeSlokamRoutes
);

app.use('/api/events', eventRoutes);
app.use('/api/event-categories', eventCategoryRoutes);

// Public gallery - existing functionality
app.use('/api/gallery', galleryRoutes);

// Admin gallery album/heading management
app.use(
  '/api/admin/gallery-albums',
  adminGalleryAlbumRoutes
);


// ========================================
// NEARBY PLACES
// ========================================

// Public - mobile app
app.use('/api/nearby', nearbyRoutes);

// Admin - category and place management
app.use('/api/admin/nearby', adminNearbyRoutes);


app.use('/api/publications', publicationRoutes);


app.use('/api/buildings', buildingRoutes);

// ========================================
// ADMIN TEMPLE CONTACT SETTINGS
// ========================================

app.use(
  '/api/admin/temple-contact',
  adminTempleContactRoutes
);
app.use('/api/auth', authRoutes);
// ========================================
// PUBLIC TEMPLE CONTACT API
// ========================================

const templeContactRouter = Router();

templeContactRouter.get(
  '/',
  getTempleContact
);

app.use(
  '/api/temple-contact',
  templeContactRouter
);
// ========================================
// DHARMA SANDEHAM ROUTES
// ========================================

app.use('/api/dharma', dharmaRoutes);
// Dharma Sandeham administration
app.use('/api/admin/dharma', adminDharmaRoutes);


app.use('/api/notifications', notificationRoutes);

app.use(
  '/api/announcements',
  announcementRoutes
);

app.use('/api/translate', translationRoutes);


app.use(
  '/api/admin/announcements',
  adminAnnouncementRoutes
);


app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Temple App Backend API is running',
  });
});

app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');

    res.json({
      success: true,
      message: 'Backend and PostgreSQL are connected',
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error('Database health check failed');

    res.status(500).json({
      success: false,
      message: 'Database connection failed',
    });
  }
});

/* ================================
   ANDROID EMULATOR
   ================================

app.listen(PORT, () => {
  console.log(`Temple App Backend running on port ${PORT}`);
});
*/

/* ================================
   IPHONE / PHYSICAL DEVICE
   ================================ */
/*
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Temple App Backend running on port ${PORT}`);
});*/
// Physical Android Phone / iPhone
/*
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Temple App Backend running on port ${PORT}`);
});*/

//beore

/*app.listen(PORT, () => {
  console.log(`Temple App Backend running on port ${PORT}`);
});*/


//andriod
/*
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Temple App Backend running on port ${PORT}`);
});*/


// ========================================
// CENTRALIZED API ERROR HANDLING
// ========================================
const apiErrorHandler: ErrorRequestHandler =
  (error, _req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }
    const type =
      typeof error?.type === 'string'
        ? error.type
        : '';
    const suppliedStatus =
      error?.status ?? error?.statusCode;
    let status = 500;
    let message = 'Unable to complete the request';
    if (type === 'entity.parse.failed') {
      status = 400;
      message = 'Invalid JSON request';
    } else if (type === 'entity.too.large') {
      status = 413;
      message = 'Request is too large';
    } else if (
      Number.isInteger(suppliedStatus) &&
      suppliedStatus >= 400 &&
      suppliedStatus <= 499
    ) {
      status = suppliedStatus;
      message = 'Invalid or unauthorized request';
    }
    if (status >= 500) {
      console.error('Unhandled API request error');
    }
    res.status(status).json({
      success: false,
      message,
    });
  };
app.use(apiErrorHandler);
// ========================================
// MANAGED BACKGROUND TASKS
// ========================================
let shuttingDown = false;
let scheduledTask: Promise<void> | null = null;
let receiptTask: Promise<void> | null = null;
function runScheduledNotifications(): void {
  if (shuttingDown || scheduledTask) {
    return;
  }
  scheduledTask = processScheduledNotifications()
    .then(() => undefined)
    .catch(() => {
      console.error('Notification scheduler failed');
    })
    .finally(() => {
      scheduledTask = null;
    });
}
function runReceiptProcessor(): void {
  if (shuttingDown || receiptTask) {
    return;
  }
  receiptTask = checkPushReceipts()
    .then(result => {
      if (result.checked > 0 || result.failed > 0) {
        console.log('Push receipt results:', {
          checked: result.checked,
          accepted: result.accepted,
          failed: result.failed,
          pending: result.pending,
        });
      }
    })
    .catch(() => {
      console.error('Push receipt processor failed');
    })
    .finally(() => {
      receiptTask = null;
    });
}
const scheduledTimer = setInterval(
  runScheduledNotifications,
  30 * 1000
);
const receiptTimer = setInterval(
  runReceiptProcessor,
  5 * 60 * 1000
);
// ========================================
// SERVER STARTUP
// ========================================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Temple App Backend running on port ${PORT}`);
  if (!shuttingDown) {
    startVolunteerScheduler();
    runScheduledNotifications();
  }
});
// ========================================
// GRACEFUL SHUTDOWN
// ========================================
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log('Graceful shutdown started:', signal);
  const deadline = setTimeout(() => {
    console.error('Graceful shutdown deadline exceeded');
    process.exit(1);
  }, 25000);
  try {
    clearInterval(scheduledTimer);
    clearInterval(receiptTimer);
    stopVolunteerScheduler();
    const httpClosed = new Promise<void>(
      (resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }
    );
    server.closeIdleConnections();
    await Promise.all([
      httpClosed,
      waitForVolunteerSchedulerIdle(),
      scheduledTask ?? Promise.resolve(),
      receiptTask ?? Promise.resolve(),
    ]);
    await pool.end();
    clearTimeout(deadline);
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch {
    clearTimeout(deadline);
    console.error('Graceful shutdown failed');
    process.exit(1);
  }
}
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
