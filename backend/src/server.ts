import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

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






import adminDarshanRoutes from './routes/adminDarshanRoutes';
import darshanRoutes from './routes/darshanRoutes';
import darshanVideosRoutes from './routes/darshanVideos';
import notificationRoutes from './routes/notificationRoutes';
import announcementRoutes from './routes/announcementRoutes';
import adminGalleryAlbumRoutes from './routes/adminGalleryAlbumRoutes';
import dharmaRoutes from './routes/dharmaRoutes';
import adminDharmaRoutes from './routes/adminDharmaRoutes';
import guruVaniRoutes from './routes/guruVaniRoutes';

import {
  checkPushReceipts,
} from './services/notificationService';

import adminGuruVaniRoutes from './routes/adminGuruVaniRoutes';
import {
  processScheduledNotifications,
} from './services/notificationScheduler';
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());
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

// Public - Devotee App
app.use('/api/poojas', poojaRoutes);

// Admin - Pooja Management
app.use('/api/admin/poojas', adminPoojaRoutes);
app.use(
  '/api/guru-parampara',
  guruParamparaRoutes
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

app.use('/api/auth', authRoutes);
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
    console.error('Database connection error:', error);

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


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Temple App Backend running on port ${PORT}`);
});
// ========================================
// SCHEDULED NOTIFICATION PROCESSOR
// ========================================

// ========================================
// SCHEDULED NOTIFICATION PROCESSOR
// ========================================

// Run once when backend starts
processScheduledNotifications()
  .catch((error) => {
    console.error(
      'Initial notification scheduler error:',
      error
    );
  });

// Then check every 30 seconds
setInterval(
  () => {
    processScheduledNotifications()
      .catch((error) => {
        console.error(
          'Notification scheduler error:',
          error
        );
      });
  },
  30 * 1000
);
// ========================================
// EXPO PUSH RECEIPT PROCESSOR
// ========================================

// Check Expo receipts every 5 minutes.
// Receipts confirm Expo's handoff to FCM,
// not that a notification appeared on the phone.

setInterval(() => {
  checkPushReceipts()
    .then((result) => {
      if (
        result.checked > 0 ||
        result.failed > 0
      ) {
        console.log(
          'Push receipt results:',
          result
        );
      }
    })
    .catch((error) => {
      console.error(
        'Push receipt processor error:',
        error
      );
    });
}, 5 * 60 * 1000);