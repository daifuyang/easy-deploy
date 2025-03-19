const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const util = require("util");
const config = require("../config");
const fileUtils = require("../utils/fileUtils");

const execPromise = util.promisify(exec);

/**
 * DeploymentController handles file deployment operations
 */
class DeploymentController {
  /**
   * Install Node.js dependencies in the target directory
   * @param {string} targetDir - Target directory where package.json is located
   * @returns {Promise} - Resolves when installation is complete
   */
  static async installNodeDependencies(targetDir) {
    try {
      console.log(`Installing Node.js dependencies in ${targetDir}`);
      const { spawn } = require('child_process');
      const npmInstall = spawn('npm', ['install'], { cwd: targetDir });

      npmInstall.stdout.on('data', (data) => {
        console.log(`npm install stdout: ${data}`);
      });

      npmInstall.stderr.on('data', (data) => {
        console.error(`npm install stderr: ${data}`);
      });

      await new Promise((resolve, reject) => {
        npmInstall.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`npm install process exited with code ${code}`));
          } else {
            resolve();
          }
        });
      });

      return true;
    } catch (err) {
      console.error('Failed to install dependencies:', err);
      return false;
    }
  }

  /**
   * Process Node.js application after extraction
   * @param {string} targetDir - Target directory where files were extracted
   * @param {Object} res - Express response object
   * @returns {boolean} - True if response was sent, false otherwise
   */
  static async processNodeApplication(targetDir, res) {
    const packageJsonExists = fs.existsSync(path.join(targetDir, "package.json"));
    if (packageJsonExists) {
      const installSuccess = await DeploymentController.installNodeDependencies(targetDir);
      if (installSuccess) {
        // Check if 'deploy' script exists in package.json
        const packageJsonPath = path.join(targetDir, "package.json");
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        if (packageJson.scripts && packageJson.scripts.deploy) {
          try {
            console.log("Running 'npm run deploy' script...");
            const { stdout, stderr } = await execPromise("npm run deploy", { cwd: targetDir });
            console.log(stdout);
            if (stderr) {
              console.error(stderr);
              res.json({ 
                message: "Files extracted and dependencies installed successfully, but 'npm run deploy' encountered warnings", 
                filePath: targetDir,
                warning: "Warnings during 'npm run deploy'"
              });
            } else {
              res.json({ 
                message: "Files extracted, dependencies installed, and 'npm run deploy' executed successfully", 
                filePath: targetDir 
              });
            }
          } catch (err) {
            console.error("Failed to execute 'npm run deploy':", err);
            res.json({ 
              message: "Files extracted and dependencies installed successfully, but 'npm run deploy' failed", 
              filePath: targetDir,
              warning: "Failed to execute 'npm run deploy'"
            });
          }
        } else {
          res.json({ 
            message: "Files extracted and dependencies installed successfully", 
            filePath: targetDir,
            warning: "No 'deploy' script found in package.json"
          });
        }
      } else {
        res.json({ 
          message: "Files extracted successfully, but dependency installation failed", 
          filePath: targetDir,
          warning: "Node.js dependencies failed to install"
        });
      }
    } else {
      res.json({ 
        message: "Files extracted successfully, but no package.json found", 
        filePath: targetDir,
        warning: "No package.json found for Node.js application"
      });
    }
    return true;
  }

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

      const { name, path: subDir = "", type = "nginx" } = req.body;

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
          // Ensure extractZip completes before proceeding
          await fileUtils.extractZip(tempPath, targetDir);

          // Log completion of extraction for debugging purposes
          console.log("Zip extraction completed successfully");

          // For Node.js applications, install dependencies
          if (type.toLowerCase() === "node") {
            await DeploymentController.processNodeApplication(targetDir, res);
          } else {
            res.json({ message: "Files extracted successfully", filePath: targetDir });
          }
        } catch (err) {
          return res.status(500).json({ error: "Unzip failed" });
        }
      } else if (originalnameLower.endsWith(".tar.gz")) {
        try {
          await fileUtils.extractTarGz(tempPath, targetDir);
          
          // For Node.js applications, install dependencies
          if (type.toLowerCase() === "node") {
            await DeploymentController.processNodeApplication(targetDir, res);
          } else {
            res.json({ message: "Files extracted successfully", filePath: targetDir });
          }
        } catch (err) {
          return res.status(500).json({ error: "Tar extraction failed" });
        }
      } else {
        // Regular file, just move it
        const targetPath = path.join(targetDir, deployFile.originalname);
        try {
          await fileUtils.moveFile(tempPath, targetPath);
          
          // Handle regular file for Node.js application
          // Note: This is less common as Node.js apps are typically packaged as archives
          if (type.toLowerCase() === "node" && originalnameLower === "package.json") {
            const installSuccess = await DeploymentController.installNodeDependencies(targetDir);
            if (installSuccess) {
              res.json({ 
                message: "File uploaded and dependencies installed successfully", 
                filePath: targetPath 
              });
            } else {
              res.json({ 
                message: "File uploaded successfully, but dependency installation failed", 
                filePath: targetPath,
                warning: "Node.js dependencies failed to install"
              });
            }
          } else {
            res.json({ message: "File uploaded successfully", filePath: targetPath });
          }
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
