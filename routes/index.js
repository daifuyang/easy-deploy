const express = require("express");
const router = express.Router();
const deploymentRoutes = require("./api/deploymentRoutes");
const pm2Routes = require("./api/pm2Routes");

// Register API routes
router.use("/api/upload", deploymentRoutes);
router.use("/api/pm2", pm2Routes);

module.exports = router;