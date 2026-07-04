const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/roomController");

const router = express.Router();
router.use(requireAuth);

router.get("/", getNotifications);
router.patch("/:notifId/read", markNotificationRead);
router.patch("/read-all", markAllNotificationsRead);

module.exports = router;
