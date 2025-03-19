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
app.post("/api/upload", authenticate, (req, res) => {
  try {
    const deployFile = req.files?.find((file) => file.fieldname === "file");

    if (!deployFile) {
      return res.status(400).json({ error: "Missing required files" });
    }

    const { name, path: subDir = "" } = req.body;

    const tempPath = deployFile.path;
    const targetDir = path.join(UPLOAD_DIR, subDir);

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

    // 删除目标文件夹下的所有文件
    if (fs.existsSync(targetDir)) {
      fs.readdirSync(targetDir).forEach((file) => {
        const filePath = path.join(targetDir, file);
        fs.unlinkSync(filePath);
      });
    } else {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 检查文件是否是压缩包并解压
    const originalnameLower = deployFile.originalname.toLowerCase();
    if (originalnameLower.endsWith(".zip")) {
      const unzipper = require("unzipper");
      fs.createReadStream(tempPath)
        .pipe(unzipper.Extract({ path: targetDir }))
        .on("close", () => {
          fs.unlinkSync(tempPath); // 删除临时文件
          res.json({ message: "Files extracted successfully", filePath: targetDir });
        })
        .on("error", (err) => {
          console.error("Unzip failed:", err);
          fs.unlinkSync(tempPath); // 删除临时文件
          return res.status(500).json({ error: "Unzip failed" });
        });
    } else if (originalnameLower.endsWith(".tar.gz")) {
      const tar = require("tar");
      tar.x({
        file: tempPath,
        C: targetDir
      })
        .then(() => {
          fs.unlinkSync(tempPath); // 删除临时文件
          res.json({ message: "Files extracted successfully", filePath: targetDir });
        })
        .catch((err) => {
          console.error("Tar extraction failed:", err);
          fs.unlinkSync(tempPath); // 删除临时文件
          return res.status(500).json({ error: "Tar extraction failed" });
        });
    } else {
      const targetPath = path.join(targetDir, deployFile.originalname);

      fs.rename(tempPath, targetPath, (err) => {
        if (err) {
          console.error("File move failed:", err);
          return res.status(500).json({ error: "File upload failed" });
        }
        res.json({ message: "File uploaded successfully", filePath: targetPath });
      });
    }
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 新增：引入pm2模块
const pm2 = require("pm2");

// 新增：PM2管理接口
app.post("/api/pm2/manage", (req, res) => {
  const { action, projectName, scriptPath } = req.body;

  if (!action || !["start", "stop", "restart", "delete", "list", "status"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  if (action !== "list" && !projectName) {
    return res.status(400).json({ error: "Project name is required" });
  }

  pm2.connect((err) => {
    if (err) {
      console.error("PM2 connection failed:", err);
      return res.status(500).json({ error: "PM2 connection failed" });
    }

    switch (action) {
      case "start":
        pm2.describe(projectName, (err, processDescription) => {
          if (err) {
            console.error("PM2 describe failed:", err);
            return res.status(500).json({ error: "PM2 describe failed" });
          }

          if (processDescription.length === 0) {
            // 应用不存在，创建新应用
            if (!scriptPath) {
              return res.status(400).json({ error: "Script path is required for new project" });
            }

            const startOptions = {
              name: projectName,
              script: scriptPath
            };

            pm2.start(startOptions, (err, proc) => {
              if (err) {
                console.error("PM2 start failed:", err);
                return res.status(500).json({ error: "PM2 start failed" });
              }
              res.json({ message: `New project ${projectName} started successfully`, proc });
            });
          } else {
            // 应用已存在，直接启动
            pm2.start(projectName, (err, proc) => {
              if (err) {
                console.error("PM2 start failed:", err);
                return res.status(500).json({ error: "PM2 start failed" });
              }
              res.json({ message: `Project ${projectName} started successfully`, proc });
            });
          }
        });
        break;
      case "stop":
        pm2.stop(projectName, (err, proc) => {
          if (err) {
            console.error("PM2 stop failed:", err);
            return res.status(500).json({ error: "PM2 stop failed" });
          }
          res.json({ message: `Project ${projectName} stopped successfully`, proc });
        });
        break;
      case "restart":
        pm2.restart(projectName, (err, proc) => {
          if (err) {
            console.error("PM2 restart failed:", err);
            return res.status(500).json({ error: "PM2 restart failed" });
          }
          res.json({ message: `Project ${projectName} restarted successfully`, proc });
        });
        break;
      case "delete":
        pm2.delete(projectName, (err, proc) => {
          if (err) {
            console.error("PM2 delete failed:", err);
            return res.status(500).json({ error: "PM2 delete failed" });
          }
          res.json({ message: `Project ${projectName} deleted successfully`, proc });
        });
        break;
      case "list":
        pm2.list((err, list) => {
          if (err) {
            console.error("PM2 list failed:", err);
            return res.status(500).json({ error: "PM2 list failed" });
          }
          res.json({ message: "PM2 process list", list });
        });
        break;
      case "status":
        pm2.describe(projectName, (err, processDescription) => {
          if (err) {
            console.error("PM2 describe failed:", err);
            return res.status(500).json({ error: "PM2 describe failed" });
          }

          if (processDescription.length === 0) {
            return res.status(404).json({ error: `Project ${projectName} not found` });
          }

          const statusInfo = processDescription.map((proc) => ({
            name: proc.name,
            pid: proc.pid,
            pm_id: proc.pm_id,
            status: proc.pm2_env.status,
            restarts: proc.pm2_env.restart_time,
            uptime: proc.pm2_env.pm_uptime ? Date.now() - proc.pm2_env.pm_uptime : null
          }));

          res.json({ message: `Status of project ${projectName}`, status: statusInfo });
        });
        break;
      default:
        pm2.disconnect();
        return res.status(400).json({ error: "Invalid action" });
    }
  });
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

    // 删除privateKeyFile临时文件
    fs.unlinkSync(privateKeyFile.path);

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
