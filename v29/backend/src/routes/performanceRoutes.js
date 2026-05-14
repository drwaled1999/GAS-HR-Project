import express from "express";
import { requireAuth } from "../middleware_auth.js";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  duplicateTemplate,
  updateTemplateStatus,
  deleteTemplate,
  addTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
  assignReview,
  listReviews,
  getReview,
  submitSelfReview,
  submitSupervisorReview,
  submitHRReview,
  updateRecommendation,
  finalApproveReview,
  rejectReview,
  lockReview,
  addComment,
  signReview,
  dashboard,
} from "../controllers/performanceController.js";

const router = express.Router();

router.use(requireAuth);

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/
router.get("/dashboard", dashboard);

/*
|--------------------------------------------------------------------------
| Templates
|--------------------------------------------------------------------------
*/
router.get("/templates", listTemplates);
router.post("/templates", createTemplate);
router.put("/templates/:id", updateTemplate);
router.post("/templates/:id/duplicate", duplicateTemplate);
router.patch("/templates/:id/status", updateTemplateStatus);
router.delete("/templates/:id", deleteTemplate);

/*
|--------------------------------------------------------------------------
| Template Items
|--------------------------------------------------------------------------
*/
router.post("/templates/:id/items", addTemplateItem);
router.put("/template-items/:id", updateTemplateItem);
router.delete("/template-items/:id", deleteTemplateItem);

/*
|--------------------------------------------------------------------------
| Assign Reviews
|--------------------------------------------------------------------------
*/
router.post("/assign", assignReview);

/*
|--------------------------------------------------------------------------
| Reviews
|--------------------------------------------------------------------------
*/
router.get("/reviews", listReviews);
router.get("/reviews/:id", getReview);

router.put("/reviews/:id/self-review", submitSelfReview);
router.put("/reviews/:id/supervisor-review", submitSupervisorReview);
router.put("/reviews/:id/hr-review", submitHRReview);

router.put("/reviews/:id/recommendation", updateRecommendation);

router.put("/reviews/:id/final-approve", finalApproveReview);
router.put("/reviews/:id/reject", rejectReview);
router.put("/reviews/:id/lock", lockReview);

/*
|--------------------------------------------------------------------------
| Comments / Signatures
|--------------------------------------------------------------------------
*/
router.post("/reviews/:id/comments", addComment);
router.post("/reviews/:id/sign", signReview);

export default router;
