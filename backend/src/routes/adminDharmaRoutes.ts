
import { NextFunction, Response, Router } from 'express';

import {
    AuthRequest,
    authenticateToken,
} from '../middleware/authMiddleware';

import {
    createOfficialDharmaAnswer,
    deleteOfficialDharmaAnswer,
    getAdminDharmaAnswers,
    getAdminDharmaQuestions,
    moderateDharmaAnswer,
    moderateDharmaQuestion,
} from '../controllers/adminDharmaController';
import {
    getAdminDharmaReports,
    reviewDharmaReport,
} from '../controllers/dharmaController';

const router = Router();

// ========================================
// ADMIN AUTHORIZATION
// ========================================

// IMPORTANT:
// This assumes the role value is exactly "admin".
// Confirm your existing role values before deployment.
const requireDharmaAdmin = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required',
        });
    }

    next();
};

router.use(authenticateToken);
router.use(requireDharmaAdmin);

// ========================================
// QUESTION MODERATION
// ========================================

router.get('/questions', getAdminDharmaQuestions);

router.patch(
    '/questions/:id/status',
    moderateDharmaQuestion
);

// ========================================
// OFFICIAL TEMPLE ANSWERS
// ========================================

router.post(
    '/questions/:id/official-answer',
    createOfficialDharmaAnswer
);
// ========================================
// ANSWER MODERATION
// ========================================

router.get('/answers', getAdminDharmaAnswers);

router.patch(
    '/answers/:id/status',
    moderateDharmaAnswer
);
// ========================================
// DHARMA REPORT MANAGEMENT
// ========================================

// Fetch reports
router.get(
    '/reports',
    getAdminDharmaReports
);

// Review, dismiss, or hide reported content
router.patch(
    '/reports/:id/review',
    reviewDharmaReport
);

router.delete(
    '/official-answers/:id',
    deleteOfficialDharmaAnswer
);
export default router;
