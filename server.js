const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();
const yaml = require("js-yaml"); // 新增：用于解析 YAML 配置文件

const app = express();
const upload = multer({ dest: "./public/temp/" }); // 临时存储目录

// 新增：解析 JSON 和 URL 编码的请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(upload.any());

// 加载配置
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

// 新增：加载 config.yaml 配置文件
const configPath = path.join(__dirname, "config.yaml");
const config = yaml.load(fs.readFileSync(configPath, "utf8"));
const AUTHORIZED_USERS = config.authorizedUsers || {};

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 新增：提取路径验证逻辑为独立函数
function isValidSubDir(subDir) {
  return !(subDir.includes("..") || subDir.startsWith("/"));
}

// 新增：提取授权路径检查逻辑为独立函数
function isPathAuthorized(targetDir, subDir, authorizedPaths) {
  const fullTargetDir = subDir ? path.join(targetDir, subDir) : targetDir;
  return authorizedPaths.some((authorizedPath) => {
    const resolvedAuthorizedPath = path.resolve(targetDir, authorizedPath);
    const resolvedFullTargetDir = path.resolve(fullTargetDir);
    return resolvedFullTargetDir.startsWith(resolvedAuthorizedPath);
  });
}

// 文件上传接口
app.post("/upload", authenticate, (req, res) => {
  try {
    const privateKeyFile = req.files?.find((file) => file.fieldname === "privateKey");
    const deployFile = req.files?.find((file) => file.fieldname === "file");

    if (!privateKeyFile || !deployFile) {
      return res.status(400).json({ error: "Missing required files" });
    }

    const { name, path: subDir = "" } = req.body;

    const tempPath = deployFile.path;
    const targetDir = path.join(UPLOAD_DIR);

    // 调用路径验证函数
    if (subDir && !isValidSubDir(subDir)) {
      return res.status(400).json({ error: "Invalid subdirectory path" });
    }

    // 调用授权路径检查函数
    const pathsArray = Array.isArray(AUTHORIZED_USERS[name])
      ? AUTHORIZED_USERS[name]
      : [AUTHORIZED_USERS[name]];
    if (!isPathAuthorized(targetDir, subDir, pathsArray)) {
      return res.status(403).json({ error: "Path not authorized" });
    }

    // 创建目标文件夹
    if (!fs.existsSync(subDir ? path.join(targetDir, subDir) : targetDir)) {
      fs.mkdirSync(subDir ? path.join(targetDir, subDir) : targetDir, { recursive: true });
    }

    const targetPath = path.join(
      subDir ? path.join(targetDir, subDir) : targetDir,
      deployFile.originalname
    );

    fs.rename(tempPath, targetPath, (err) => {
      if (err) {
        console.error("File move failed:", err);
        return res.status(500).json({ error: "File upload failed" });
      }
      res.json({ message: "File uploaded successfully", filePath: targetPath });
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 身份验证中间件
function authenticate(req, res, next) {
  try {
    const { name } = req.body;
    const privateKeyFile = req.files?.find((file) => file.fieldname === "privateKey");

    if (!name || !privateKeyFile) {
      return res.status(401).json({ error: "Missing Params" });
    }

    const publicKeyDir = process.env.PUBLIC_KEY_PATH;
    if (!publicKeyDir) {
      return res.status(403).json({ error: "User not authorized" });
    }

    const publicKeyPath = path.join(publicKeyDir, `${name}_public_key.pem`);
    const privateKeyContent = fs.readFileSync(privateKeyFile.path, "utf8");
    const publicKeyContent = fs.readFileSync(publicKeyPath, "utf8");

    // 新增：提取密钥验证逻辑为独立函数
    function validateKeys(privateKeyContent, publicKeyContent) {
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
    }

    if (!validateKeys(privateKeyContent, publicKeyContent)) {
      return res.status(403).json({ error: "Invalid private key" });
    }

    next();
  } catch (err) {
    console.error("Authentication error:", err);
    res.status(403).json({ error: "Authentication failed" });
  }
}

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
