const pm2 = require("pm2");

/**
 * PM2 Service for managing Node.js applications
 */
class PM2Manager {
  /**
   * Connect to PM2 daemon
   * @returns {Promise} - Resolves when connection is established
   */
  static connect() {
    return new Promise((resolve, reject) => {
      pm2.connect((err) => {
        if (err) {
          console.error("PM2 connection failed:", err);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Disconnect from PM2 daemon
   */
  static disconnect() {
    pm2.disconnect();
  }

  /**
   * Start a new application or restart existing one
   * @param {string} projectName - Name of the project
   * @param {string} scriptPath - Path to the script
   * @returns {Promise} - Resolves with process information
   */
  static start(params) {
    return new Promise((resolve, reject) => {
      pm2.start(params, (err, proc) => {
        if (err) {
          console.error("PM2 start failed:", err);
          reject(err);
          return;
        }
        resolve(proc);
      });
    });
  }

  /**
   * Stop an application
   * @param {string} projectName - Name of the project
   * @returns {Promise} - Resolves with process information
   */
  static stop(projectName) {
    return new Promise((resolve, reject) => {
      pm2.stop(projectName, (err, proc) => {
        if (err) {
          console.error("PM2 stop failed:", err);
          reject(err);
          return;
        }
        resolve(proc);
      });
    });
  }

  /**
   * Restart an application
   * @param {string} projectName - Name of the project
   * @returns {Promise} - Resolves with process information
   */
  static restart(projectName) {
    return new Promise((resolve, reject) => {
      pm2.restart(projectName, (err, proc) => {
        if (err) {
          console.error("PM2 restart failed:", err);
          reject(err);
          return;
        }
        resolve(proc);
      });
    });
  }

  /**
   * Delete an application
   * @param {string} projectName - Name of the project
   * @returns {Promise} - Resolves with process information
   */
  static delete(projectName) {
    return new Promise((resolve, reject) => {
      pm2.delete(projectName, (err, proc) => {
        if (err) {
          console.error("PM2 delete failed:", err);
          reject(err);
          return;
        }
        resolve(proc);
      });
    });
  }

  /**
   * List all applications
   * @returns {Promise} - Resolves with list of processes
   */
  static list() {
    return new Promise((resolve, reject) => {
      pm2.list((err, list) => {
        if (err) {
          console.error("PM2 list failed:", err);
          reject(err);
          return;
        }
        resolve(list);
      });
    });
  }

  /**
   * Get detailed information about a specific application
   * @param {string} projectName - Name of the project
   * @returns {Promise} - Resolves with process description
   */
  static describe(projectName) {
    return new Promise((resolve, reject) => {
      pm2.describe(projectName, (err, processDescription) => {
        if (err) {
          console.error("PM2 describe failed:", err);
          reject(err);
          return;
        }
        resolve(processDescription);
      });
    });
  }

  /**
   * Get formatted status information for an application
   * @param {string} projectName - Name of the project
   * @returns {Promise} - Resolves with formatted status information
   */
  static async getStatus(projectName) {
    try {
      const processDescription = await this.describe(projectName);

      if (processDescription.length === 0) {
        throw new Error(`Project ${projectName} not found`);
      }

      return processDescription.map((proc) => ({
        name: proc.name,
        pid: proc.pid,
        pm_id: proc.pm_id,
        status: proc.pm2_env.status,
        restarts: proc.pm2_env.restart_time,
        uptime: proc.pm2_env.pm_uptime ? Date.now() - proc.pm2_env.pm_uptime : null
      }));
    } catch (err) {
      throw err;
    }
  }
}

module.exports = PM2Manager;
