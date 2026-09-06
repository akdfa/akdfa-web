const { Router } = require("express");

const router = Router();

router.use("/auth", require("../modules/auth/auth.routes"));
router.use("/districts", require("../modules/districts/districts.routes"));
router.use("/units", require("../modules/units/units.routes"));
router.use("/members", require("../modules/members/members.routes"));
router.use("/news", require("../modules/news/news.routes"));
router.use("/events", require("../modules/events/events.routes"));
router.use("/polls", require("../modules/polls/polls.routes"));
router.use("/cricket", require("../modules/cricket/cricket.routes"));
router.use("/sponsors", require("../modules/sponsors/sponsors.routes"));
router.use("/growth", require("../modules/growth/growth.routes"));
router.use("/notifications", require("../modules/notifications/notifications.routes"));
router.use("/reports", require("../modules/reports/reports.routes"));
router.use("/admin", require("../modules/admin/admin.routes"));
router.use("/payments", require("../modules/payments/payments.routes"));
router.use("/store", require("../modules/store/store.routes"));
router.use("/public", require("../modules/public/public.routes"));
router.use("/uploads", require("../modules/uploads/uploads.routes"));

module.exports = router;
