const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
require("dotenv").config();

// Load environment variables
const config = {
  port: process.env.PORT || 3000,
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  publicKeyPath: process.env.PUBLIC_KEY_PATH,
};

// Load YAML configuration
const configPath = path.join(__dirname, "../config.yaml");
try {
  const yamlConfig = yaml.load(fs.readFileSync(configPath, "utf8"));
  config.authorizedUsers = yamlConfig.authorizedUsers || {};
} catch (err) {
  console.error("Error loading config.yaml:", err);
  config.authorizedUsers = {};
}

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

module.exports = config;
