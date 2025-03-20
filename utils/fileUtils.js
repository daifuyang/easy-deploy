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
 * Recursively deletes a folder and all its contents, excluding specified directories
 * @param {string} folderPath - Path to the folder to delete
 * @param {Array<string>} excludePaths - List of relative paths to exclude from deletion
 */
function deleteFolderRecursive(folderPath, excludePaths = []) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const filePath = path.join(folderPath, file);
      const relativeFilePath = path.relative(folderPath, filePath);
      // Skip excluded directories and files
      if (excludePaths.includes(relativeFilePath)) {
        console.log(`Skipping excluded path: ${relativeFilePath}`);
      }else {
      const fileStat = fs.statSync(filePath);
      if (fileStat.isDirectory()) {
        deleteFolderRecursive(filePath, excludePaths); // Recursively delete subdirectories
      } else {
        fs.unlinkSync(filePath); // Delete file
        console.log("delete file success:", filePath)
      }
    }
    });
  }
}

/**
 * Extracts a zip file to a target directory
 * @param {string} filePath - Path to the zip file
 * @param {string} targetDir - Target directory for extraction
 * @returns {Promise} - Resolves when extraction is complete
 */
async function extractZip(filePath, targetDir) {
  try {
    console.log(`Extracting ZIP file from ${filePath} to ${targetDir}`);

    // Open the zip file for parsing
    const directory = await unzipper.Open.file(filePath);

    // Extract all files
    let extractedCount = 0;
    for (const file of directory.files) {
      // Skip directories, they'll be created when extracting files
      if (file.type === "Directory") continue;

      const outputPath = path.join(targetDir, file.path);
      const outputDir = path.dirname(outputPath);

      // Create directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Extract file
      const content = await file.buffer();
      fs.writeFileSync(outputPath, content);
      extractedCount++;
    }

    console.log(`ZIP extraction complete: extracted ${extractedCount} files.`);

    // Delete temporary file
    fs.unlinkSync(filePath);
    return Promise.resolve();
  } catch (err) {
    console.error("Unzip failed:", err);
    // Only delete the temporary file if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return Promise.reject(err);
  }
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
