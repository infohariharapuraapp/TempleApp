import {
  resubmitVolunteerPhoto,
} from '../controllers/volunteerPhotoResubmissionController';import {
  getMyReporting,
  confirmMyReporting,
  withdrawMyReporting,
  markMyCoordinatorContacted,
} from '../controllers/volunteerReportingController';
import {
  getAvailableServiceDates,
} from '../controllers/volunteerServiceDateController';
import { Router } from 'express';

import {
  authenticateToken,
} from '../middleware/authMiddleware';


import {
  uploadVolunteerPhoto,
} from '../controllers/volunteerPhotoController';


import {
  getAvailableOpportunities,
  getOpportunityById,
} from '../controllers/volunteerOpportunityController';

import {
  getAvailableShifts,
} from '../controllers/volunteerShiftController';

import {
  createVolunteerRegistration,
  getMyVolunteerRegistrations,
} from '../controllers/volunteerRegistrationController';

import {
  getMyVolunteerIdCards,
} from '../controllers/volunteerIdCardController';

import {
  getMyVolunteerAccommodation,
} from '../controllers/volunteerAccommodationController';

import {
  getMyVolunteerCertificates,
  downloadMyVolunteerCertificate,
} from '../controllers/volunteerCertificateController';

import {
  getMySevaDetails,
} from '../controllers/volunteerMySevasController';

const router = Router();

// ========================================
// PUBLIC VOLUNTEER OPPORTUNITIES
// ========================================

router.get(
  '/opportunities',
  getAvailableOpportunities
);

router.get(
  '/opportunities/:id',
  getOpportunityById
);

router.get(
  '/opportunities/:opportunityId/shifts',
  getAvailableShifts
);
// ========================================
// AVAILABLE SERVICE DATES
// ========================================
router.get(
  '/opportunities/:opportunityId/service-dates',
  getAvailableServiceDates
);

// ========================================
// VOLUNTEER REGISTRATION
// ========================================

router.post(
  '/registrations',
  authenticateToken,
  createVolunteerRegistration
);

// ========================================
// MY SEVA REGISTRATIONS
// ========================================

router.get(
  '/my-registrations',
  authenticateToken,
  getMyVolunteerRegistrations
);

// ========================================
// COMPLETE MY SEVA DETAILS
// ========================================

router.get(
  '/my-registrations/:registrationId',
  authenticateToken,
  getMySevaDetails
);

// ========================================
// MY DIGITAL ID CARDS
// ========================================

router.get(
  '/my-id-cards',
  authenticateToken,
  getMyVolunteerIdCards
);

// ========================================
// MY ACCOMMODATION
// ========================================

router.get(
  '/my-accommodation',
  authenticateToken,
  getMyVolunteerAccommodation
);

// ========================================
// MY CERTIFICATES
// ========================================

router.get(
  '/my-certificates',
  authenticateToken,
  getMyVolunteerCertificates
);

// ========================================
// SECURE CERTIFICATE DOWNLOAD
// ========================================

router.get(
  '/certificates/:certificateId/download',
  authenticateToken,
  downloadMyVolunteerCertificate
);

// ========================================
// MY DAILY REPORTING
// ========================================
router.get(
  '/my-registrations/:registrationId/reporting',
  authenticateToken,
  getMyReporting
);
router.post(
  '/reporting/:reportingId/confirm',
  authenticateToken,
  confirmMyReporting
);
router.post(
  '/reporting/:reportingId/withdraw',
  authenticateToken,
  withdrawMyReporting
);
router.post(
  '/reporting/:reportingId/contacted-coordinator',
  authenticateToken,
  markMyCoordinatorContacted
);

// ========================================
// VOLUNTEER PHOTOGRAPH UPLOAD
// ========================================

router.post(
  '/photos/upload',
  authenticateToken,
  uploadVolunteerPhoto
);

// ========================================
// VOLUNTEER PHOTOGRAPH RESUBMISSION
// ========================================
router.post(
  '/my-registrations/:registrationId/members/:memberId/photo',
  authenticateToken,
  resubmitVolunteerPhoto
);
export default router;