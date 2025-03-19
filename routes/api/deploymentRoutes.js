const express = require("express");
const router = express.Router();
const DeploymentController = require("../../controllers/deploymentController");
const { authenticate } = require("../../middleware/authMiddleware");

// File deployment route
router.post("/", authenticate, DeploymentController.deploy);

module.exports = router;
