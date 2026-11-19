import { Router } from 'express';

import {
  authenticateToken,
} from '../middleware/authMiddleware';

import {
  requireAdmin,
} from '../middleware/adminMiddleware';

import {
  getAdminOpportunities,
  getAdminOpportunityById,
  createOpportunity,
  updateOpportunity,
  updateOpportunityPublishStatus,
  updateRegistrationStatus,
  extendRegistrationDeadline,
} from '../controllers/volunteerOpportunityController';

import {
  getAdminShifts,
  createShifts,
  updateShift,
  updateShiftStatus,
} from '../controllers/volunteerShiftController';

import {
  getAdminVolunteerRegistrations,
  getVolunteerRegistrationStats,
  getAdminVolunteerRegistrationById,
  reviewVolunteerRegistration,
} from '../controllers/adminVolunteerRegistrationController';

import {
  getAdminDuties,
  getAdminDutyById,
  createDuty,
  updateDuty,
  updateDutyStatus,
} from '../controllers/volunteerDutyController';

import {
  uploadVolunteerImage,
} from '../controllers/volunteerUploadController';

import {
  getVolunteerRequirements,
  createVolunteerRequirement,
  updateVolunteerRequirement,
  updateVolunteerRequirementStatus,
} from '../controllers/volunteerRequirementController';

import {
  getEligibleVolunteers,
  getVolunteerAssignments,
  createVolunteerAssignments,
  cancelVolunteerAssignment,
  reassignVolunteerDuty,
} from '../controllers/volunteerAssignmentController';

import {
  getVolunteerAttendance,
  markVolunteerAttendance,
  finalizeVolunteerAttendance,
  reopenVolunteerAttendance,
} from '../controllers/volunteerAttendanceController';

import {
  getEligibleIdCardMembers,
  getVolunteerIdCards,
  getVolunteerIdCardById,
  issueVolunteerIdCards,
  revokeVolunteerIdCard,
  refreshVolunteerIdCard,
} from '../controllers/volunteerIdCardController';

import {
  getEligibleAccommodationMembers,
  getVolunteerAccommodation,
  getVolunteerAccommodationById,
  createVolunteerAccommodation,
  updateVolunteerAccommodation,
  updateVolunteerAccommodationVisibility,
} from '../controllers/volunteerAccommodationController';

import {
  getVolunteerCompletionList,
  getVolunteerCompletionDetails,
  completeVolunteerService,
  reopenVolunteerCompletion,
} from '../controllers/volunteerCompletionController';

import {
  getEligibleCertificateMembers,
  getVolunteerCertificates,
  getVolunteerCertificateById,
  createVolunteerCertificates,
  updateVolunteerCertificate,
  previewVolunteerCertificate,
  issueVolunteerCertificates,
  revokeVolunteerCertificate,
} from '../controllers/volunteerCertificateController';

const router = Router();

// ========================================
// ADMIN AUTHENTICATION
// ========================================

router.use(
  authenticateToken,
  requireAdmin
);

router.use((_req, res, next) => {
  res.set(
    'Cache-Control',
    'private, no-store'
  );

  next();
});

// ========================================
// IMAGE UPLOAD
// ========================================

router.post(
  '/upload',
  uploadVolunteerImage
);

// ========================================
// OPPORTUNITY MANAGEMENT
// ========================================

router.get(
  '/opportunities',
  getAdminOpportunities
);

router.get(
  '/opportunities/:id',
  getAdminOpportunityById
);

router.post(
  '/opportunities',
  createOpportunity
);

router.put(
  '/opportunities/:id',
  updateOpportunity
);

router.patch(
  '/opportunities/:id/publish',
  updateOpportunityPublishStatus
);

router.patch(
  '/opportunities/:id/registration',
  updateRegistrationStatus
);

router.patch(
  '/opportunities/:id/extend',
  extendRegistrationDeadline
);

// ========================================
// SERVICE SHIFTS
// ========================================

router.get(
  '/opportunities/:opportunityId/shifts',
  getAdminShifts
);

router.post(
  '/opportunities/:opportunityId/shifts',
  createShifts
);

router.put(
  '/opportunities/:opportunityId/shifts/:shiftId',
  updateShift
);

router.patch(
  '/opportunities/:opportunityId/shifts/:shiftId/status',
  updateShiftStatus
);

// ========================================
// REGISTRATIONS
// ========================================

router.get(
  '/registrations',
  getAdminVolunteerRegistrations
);

router.get(
  '/registrations/stats',
  getVolunteerRegistrationStats
);

router.get(
  '/registrations/:id',
  getAdminVolunteerRegistrationById
);

router.patch(
  '/registrations/:id/review',
  reviewVolunteerRegistration
);

// ========================================
// DYNAMIC DUTIES
// ========================================

router.get(
  '/duties',
  getAdminDuties
);

router.get(
  '/duties/:id',
  getAdminDutyById
);

router.post(
  '/duties',
  createDuty
);

router.put(
  '/duties/:id',
  updateDuty
);

router.patch(
  '/duties/:id/status',
  updateDutyStatus
);

// ========================================
// DUTY REQUIREMENTS
// ========================================

router.get(
  '/opportunities/:opportunityId/requirements',
  getVolunteerRequirements
);

router.post(
  '/opportunities/:opportunityId/requirements',
  createVolunteerRequirement
);

router.put(
  '/opportunities/:opportunityId/requirements/:requirementId',
  updateVolunteerRequirement
);

router.patch(
  '/opportunities/:opportunityId/requirements/:requirementId/status',
  updateVolunteerRequirementStatus
);

// ========================================
// ELIGIBLE VOLUNTEERS
// ========================================

router.get(
  '/opportunities/:opportunityId/requirements/:requirementId/eligible-volunteers',
  getEligibleVolunteers
);

// ========================================
// DUTY ASSIGNMENTS
// ========================================

router.get(
  '/opportunities/:opportunityId/assignments',
  getVolunteerAssignments
);

router.post(
  '/opportunities/:opportunityId/assignments',
  createVolunteerAssignments
);

router.patch(
  '/opportunities/:opportunityId/assignments/:assignmentId/cancel',
  cancelVolunteerAssignment
);

router.patch(
  '/opportunities/:opportunityId/assignments/:assignmentId/reassign',
  reassignVolunteerDuty
);

// ========================================
// ATTENDANCE
// ========================================

router.get(
  '/opportunities/:opportunityId/attendance',
  getVolunteerAttendance
);

router.post(
  '/opportunities/:opportunityId/attendance',
  markVolunteerAttendance
);

router.post(
  '/opportunities/:opportunityId/attendance/finalize',
  finalizeVolunteerAttendance
);

router.patch(
  '/opportunities/:opportunityId/attendance/:assignmentId/reopen',
  reopenVolunteerAttendance
);

// ========================================
// DIGITAL ID CARDS
// ========================================

router.get(
  '/opportunities/:opportunityId/id-cards/eligible-members',
  getEligibleIdCardMembers
);

router.get(
  '/opportunities/:opportunityId/id-cards',
  getVolunteerIdCards
);

router.get(
  '/opportunities/:opportunityId/id-cards/:cardId',
  getVolunteerIdCardById
);

router.post(
  '/opportunities/:opportunityId/id-cards',
  issueVolunteerIdCards
);

router.patch(
  '/opportunities/:opportunityId/id-cards/:cardId/revoke',
  revokeVolunteerIdCard
);

router.patch(
  '/opportunities/:opportunityId/id-cards/:cardId/refresh',
  refreshVolunteerIdCard
);

// ========================================
// OPTIONAL ACCOMMODATION
// ========================================

router.get(
  '/opportunities/:opportunityId/accommodation/eligible-members',
  getEligibleAccommodationMembers
);

router.get(
  '/opportunities/:opportunityId/accommodation',
  getVolunteerAccommodation
);

router.get(
  '/opportunities/:opportunityId/accommodation/:accommodationId',
  getVolunteerAccommodationById
);

router.post(
  '/opportunities/:opportunityId/accommodation',
  createVolunteerAccommodation
);

router.put(
  '/opportunities/:opportunityId/accommodation/:accommodationId',
  updateVolunteerAccommodation
);

router.patch(
  '/opportunities/:opportunityId/accommodation/:accommodationId/visibility',
  updateVolunteerAccommodationVisibility
);

// ========================================
// SERVICE COMPLETION
// ========================================

router.get(
  '/opportunities/:opportunityId/completion',
  getVolunteerCompletionList
);

router.get(
  '/opportunities/:opportunityId/completion/:memberId',
  getVolunteerCompletionDetails
);

router.post(
  '/opportunities/:opportunityId/completion',
  completeVolunteerService
);

router.patch(
  '/opportunities/:opportunityId/completion/:memberId/reopen',
  reopenVolunteerCompletion
);

// ========================================
// DIGITAL CERTIFICATES
// ========================================

router.get(
  '/opportunities/:opportunityId/certificates/eligible-members',
  getEligibleCertificateMembers
);

router.get(
  '/opportunities/:opportunityId/certificates',
  getVolunteerCertificates
);

router.get(
  '/opportunities/:opportunityId/certificates/:certificateId',
  getVolunteerCertificateById
);

router.get(
  '/opportunities/:opportunityId/certificates/:certificateId/preview',
  previewVolunteerCertificate
);

router.post(
  '/opportunities/:opportunityId/certificates',
  createVolunteerCertificates
);

router.put(
  '/opportunities/:opportunityId/certificates/:certificateId',
  updateVolunteerCertificate
);

router.post(
  '/opportunities/:opportunityId/certificates/issue',
  issueVolunteerCertificates
);

router.patch(
  '/opportunities/:opportunityId/certificates/:certificateId/revoke',
  revokeVolunteerCertificate
);

export default router;