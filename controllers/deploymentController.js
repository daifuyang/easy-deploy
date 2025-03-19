const path = require("path");
const fs = require("fs");
const config = require("../config");
const fileUtils = require("../utils/fileUtils");

/**
 * DeploymentController handles file deployment operations
 */
class DeploymentController {
  /**
   * Process file upload and deployment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deploy(req, res) {
    try {
      const deployFile = req.files?.find((file) => file.fieldname === "file");

      if (!deployFile) {
        return res.status(400).json({ error: "Missing required files" });
      }

      const { name, path: subDir = "" } = req.body;

      const tempPath = deployFile.path;
      const targetDir = path.join(config.uploadDir, subDir);

      // Validate subdirectory path
      if (subDir && !fileUtils.isValidSubDir(subDir)) {
        return res.status(400).json({ error: "Invalid subdirectory path" });
      }

      // Check if path is authorized for the user
      const pathsArray = Array.isArray(config.authorizedUsers[name])
        ? config.authorizedUsers[name]
        : [config.authorizedUsers[name]];
      
      if (!fileUtils.isPathAuthorized(config.uploadDir, subDir, pathsArray)) {
        return res.status(403).json({ error: "Path not authorized" });
      }

      // Delete all files in target directory
      fileUtils.deleteFolderRecursive(targetDir);

      // Ensure target directory exists
      fs.mkdirSync(targetDir, { recursive: true });

      // Process file based on its type
      const originalnameLower = deployFile.originalname.toLowerCase();
      
      if (originalnameLower.endsWith(".zip")) {
        try {
          await fileUtils.extractZip(tempPath, targetDir);
          res.json({ message: "Files extracted successfully", filePath: targetDir });
        } catch (err) {
          return res.status(500).json({ error: "Unzip failed" });
        }
      } else if (originalnameLower.endsWith(".tar.gz")) {
        try {
          await fileUtils.extractTarGz(tempPath, targetDir);
          res.json({ message: "Files extracted successfully", filePath: targetDir });
        } catch (err) {
          return res.status(500).json({ error: "Tar extraction failed" });
        }
      } else {
        // Regular file, just move it
        const targetPath = path.join(targetDir, deployFile.originalname);
        try {
          await fileUtils.moveFile(tempPath, targetPath);
          res.json({ message: "File uploaded successfully", filePath: targetPath });
        } catch (err) {
          return res.status(500).json({ error: "File upload failed" });
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

module.exports = DeploymentController;
