const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Validates if a private key matches with the public key
 * @param {string} privateKeyContent - Private key content
 * @param {string} publicKeyContent - Public key content
 * @returns {boolean} - True if keys match, false otherwise
 */
function validateKeys(privateKeyContent, publicKeyContent) {
  try {
    const publicKey = crypto.createPublicKey({ key: publicKeyContent, format: "pem" });
    const privateKey = crypto.createPrivateKey({ key: privateKeyContent, format: "pem" });

    const testData = "test_data";
    const encryptedData = crypto.privateEncrypt(
      { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(testData)
    );
    const decryptedData = crypto.publicDecrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      encryptedData
    );

    return decryptedData.toString() === testData;
  } catch (err) {
    console.error("Key validation error:", err);
    return false;
  }
}

/**
 * Validates user authentication using public/private key pair
 * @param {string} username - Username
 * @param {string} privateKeyContent - Private key content
 * @param {string} publicKeyDir - Directory containing public keys
 * @returns {Promise<boolean>} - Resolves to true if authentication is successful
 */
async function validateUser(username, privateKeyContent, publicKeyDir) {
  if (!username || !privateKeyContent || !publicKeyDir) {
    return false;
  }

  try {
    const publicKeyPath = path.join(publicKeyDir, `${username}_public_key.pem`);
    const publicKeyContent = fs.readFileSync(publicKeyPath, "utf8");
    
    return validateKeys(privateKeyContent, publicKeyContent);
  } catch (err) {
    console.error("User validation error:", err);
    return false;
  }
}

module.exports = {
  validateKeys,
  validateUser
};
