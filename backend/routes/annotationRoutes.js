const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  postAnnotation,
  listAnnotations,
  postComment,
  resolveAnnotationHandler,
} = require("../controllers/annotationController");

const router = express.Router();
router.use(requireAuth);

router.post("/", postAnnotation);
router.get("/:documentId", listAnnotations);
router.post("/comment", postComment);
router.patch("/:annotationId/resolve", resolveAnnotationHandler);

module.exports = router;
