const express = require("express");
const router = express.Router();
const PM2Controller = require("../../controllers/pm2Controller");
const { authenticate } = require("../../middleware/authMiddleware");

// PM2 management route
router.post("/manage", authenticate, PM2Controller.manage);

module.exports = router;
