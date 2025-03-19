const fs = require("fs");
const config = require("../config");
const authUtils = require("../utils/authUtils");

/**
 * Authentication middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authenticate(req, res, next) {
  try {
    const { name } = req.body;
    const privateKeyFile = req.files?.find((file) => file.fieldname === "privateKey");

    if (!privateKeyFile) {
      return res.status(401).json({ error: "Fail to authenticate" });
    }

    const publicKeyDir = config.publicKeyPath;
    if (!publicKeyDir) {
      return res.status(403).json({ error: "User not authorized" });
    }

    const privateKeyContent = fs.readFileSync(privateKeyFile.path, "utf8");
    
    // Validate user
    const isValid = await authUtils.validateUser(name, privateKeyContent, publicKeyDir);
    
    if (!isValid) {
      return res.status(403).json({ error: "Invalid private key" });
    }

    // Delete temporary private key file
    fs.unlinkSync(privateKeyFile.path);

    // Add user to request for future use
    req.user = { name };
    
    next();
  } catch (err) {
    console.error("Authentication error:", err);
    res.status(403).json({ error: "Authentication failed" });
  }
}

module.exports = {
  authenticate
};
