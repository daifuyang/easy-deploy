# Easy Deploy - 基于 Node.js 的安全文件上传与部署服务

## 项目简介

Easy Deploy 是一个基于 Node.js 的 Web 服务，旨在通过 HTTP API 实现安全的文件上传和自动化部署功能。它支持以下特性：

1. **安全的文件上传**：通过公钥私钥身份验证机制，确保只有授权用户可以上传文件。
2. **固定工作空间**：所有文件只能上传到指定的安全目录。
3. **PM2 集成**：支持绑定 Node.js 项目并自动重启服务。
4. **阿里云 DNS 解析**：提供一键解析功能。
5. **Nginx 自动配置**：支持自动创建站点并配置 HTTPS。

## 安装与使用

### 前置条件

在开始之前，请确保已安装以下依赖：

- [Node.js](https://nodejs.org/) (v16 或更高版本)
- [npm](https://www.npmjs.com/)
- [OpenSSL](https://www.openssl.org/)（用于生成公钥和私钥）

### 步骤 1：克隆项目

...

## 创建用户公钥私钥

为了安全地使用本项目，你需要创建用户公钥和私钥。以下是创建步骤：

### 1. 安装 OpenSSL

如果你还没有安装 OpenSSL，请先安装它。你可以通过以下命令安装：

#### 在 macOS 上

```bash
brew install openssl
```

#### 在 Ubuntu 上

```bash
sudo apt-get install openssl
```

### 2. 生成公钥和私钥

在终端中，使用以下命令生成公钥和私钥：

```bash
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt
```

输入一个密码，然后使用以下命令导出公钥：

```bash
openssl rsa -pubout -in private_key.pem -out public_key.pem
```
