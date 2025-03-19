const express = require("express");
const multer = require("multer");
const path = require("path");
const config = require("./config");
const routes = require("./routes");

// Initialize Express application
const app = express();

// Configure multer for file uploads
const upload = multer({ dest: "./public/temp/" });

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(upload.any());

// Register routes
app.use(routes);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Upload directory: ${config.uploadDir}`);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

module.exports = app;
