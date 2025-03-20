module.exports = {
  apps: [
    {
      name: "easy-deploy",
      script: "./server.js",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
