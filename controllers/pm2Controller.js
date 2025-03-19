const path = require("path");
const PM2Manager = require("../models/pm2Manager");
const config = require("../config");

/**
 * PM2Controller handles PM2 process management operations
 */
class PM2Controller {
  /**
   * Process PM2 management requests
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async manage(req, res) {
    const { action, projectName, scriptPath } = req.body;
    const userName = req.user?.name;

    if (!action || !["start", "stop", "restart", "delete", "list", "status"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    if (action !== "list" && action !== "start" && !projectName) {
      return res.status(400).json({ error: "Project name is required" });
    }

    try {
      await PM2Manager.connect();

      switch (action) {
        case "start":
          if (!scriptPath) {
            PM2Manager.disconnect();
            return res.status(400).json({ error: "Script path is required" });
          }

          // Get authorized path for the current user
          if (!userName || !config.authorizedUsers[userName]) {
            PM2Manager.disconnect();
            return res.status(403).json({ error: "User not authorized" });
          }

          // Construct the absolute script path by combining the authorized path with the relative script path
          const userAuthorizedPath = Array.isArray(config.authorizedUsers[userName]) 
            ? config.authorizedUsers[userName][0] 
            : config.authorizedUsers[userName];
          
          const absoluteScriptPath = path.join(userAuthorizedPath, scriptPath);

          const params = require(absoluteScriptPath);
          
          const proc = await PM2Manager.start(params);
          res.json({ 
            message: `Project ${projectName || scriptPath} started successfully`, 
            proc 
          });
          break;
          
        case "stop":
          const stopProc = await PM2Manager.stop(projectName);
          res.json({ message: `Project ${projectName} stopped successfully`, proc: stopProc });
          break;
          
        case "restart":
          const restartProc = await PM2Manager.restart(projectName);
          res.json({ message: `Project ${projectName} restarted successfully`, proc: restartProc });
          break;
          
        case "delete":
          const deleteProc = await PM2Manager.delete(projectName);
          res.json({ message: `Project ${projectName} deleted successfully`, proc: deleteProc });
          break;
          
        case "list":
          const list = await PM2Manager.list();
          res.json({ message: "PM2 process list", list });
          break;
          
        case "status":
          try {
            const statusInfo = await PM2Manager.getStatus(projectName);
            res.json({ message: `Status of project ${projectName}`, status: statusInfo });
          } catch (err) {
            res.status(404).json({ error: err.message });
          }
          break;
          
        default:
          res.status(400).json({ error: "Invalid action" });
      }
    } catch (err) {
      console.error("PM2 operation error:", err);
      res.status(500).json({ error: "PM2 operation failed" });
    } finally {
      PM2Manager.disconnect();
    }
  }
}

module.exports = PM2Controller;
