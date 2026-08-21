require("dotenv").config();

module.exports = {
  apps: [
    {
      name: "asteris-server",
      script: "app.js",
      instances: 2,
      exec_mode: "cluster",
      max_memory_restart: "1G",
      watch: true,
      ignore_watch: ["node_modules", "uploads", ".git", "logs"],
      env: {
        ...process.env,
        NODE_ENV: "production",
      },
    },
  ],
};
