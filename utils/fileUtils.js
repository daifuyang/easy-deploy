const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const tar = require("tar");

/**
 * Validates if the subdirectory path is safe
 * @param {string} subDir - Subdirectory path
 * @returns {boolean} - True if path is valid, false otherwise
 */
function isValidSubDir(subDir) {
  return !(subDir.includes("..") || subDir.startsWith("/"));
}

/**
 * Checks if the path is authorized for the user
 * @param {string} targetDir - Base target directory
 * @param {string} subDir - Subdirectory path
 * @param {Array<string>} authorizedPaths - List of authorized paths
 * @returns {boolean} - True if path is authorized, false otherwise
 */
function isPathAuthorized(targetDir, subDir, authorizedPaths) {
  const fullTargetDir = subDir ? path.join(targetDir, subDir) : targetDir;
  return authorizedPaths.some((authorizedPath) => {
    const resolvedAuthorizedPath = path.resolve(targetDir, authorizedPath);
    const resolvedFullTargetDir = path.resolve(fullTargetDir);
    return resolvedFullTargetDir.startsWith(resolvedAuthorizedPath);
  });
}

/**
 * Recursively deletes a folder and all its contents
 * @param {string} folderPath - Path to the folder to delete
 */
function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const filePath = path.join(folderPath, file);
      const fileStat = fs.statSync(filePath);
      if (fileStat.isDirectory()) {
        deleteFolderRecursive(filePath); // Recursively delete subdirectories
      } else {
        fs.unlinkSync(filePath); // Delete file
      }
    });
    fs.rmdirSync(folderPath); // Delete empty directory
  }
}

/**
 * Extracts a zip file to a target directory
 * @param {string} filePath - Path to the zip file
 * @param {string} targetDir - Target directory for extraction
 * @returns {Promise} - Resolves when extraction is complete
 */
function extractZip(filePath, targetDir) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(unzipper.Extract({ path: targetDir }))
      .on("close", () => {
        fs.unlinkSync(filePath); // Delete temporary file
        resolve();
      })
      .on("error", (err) => {
        console.error("Unzip failed:", err);
        fs.unlinkSync(filePath); // Delete temporary file
        reject(err);
      });
  });
}

/**
 * Extracts a tar.gz file to a target directory
 * @param {string} filePath - Path to the tar.gz file
 * @param {string} targetDir - Target directory for extraction
 * @returns {Promise} - Resolves when extraction is complete
 */
async function extractTarGz(filePath, targetDir) {
  try {
    await tar.x({
      file: filePath,
      C: targetDir
    });
    fs.unlinkSync(filePath); // Delete temporary file
    return Promise.resolve();
  } catch (err) {
    console.error("Tar extraction failed:", err);
    fs.unlinkSync(filePath); // Delete temporary file
    return Promise.reject(err);
  }
}

/**
 * Moves a file from source to destination
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @returns {Promise} - Resolves when move is complete
 */
function moveFile(sourcePath, destPath) {
  return new Promise((resolve, reject) => {
    fs.rename(sourcePath, destPath, (err) => {
      if (err) {
        console.error("File move failed:", err);
        reject(err);
        return;
      }
      resolve();
    });
  });
}

module.exports = {
  isValidSubDir,
  isPathAuthorized,
  deleteFolderRecursive,
  extractZip,
  extractTarGz,
  moveFile
};
