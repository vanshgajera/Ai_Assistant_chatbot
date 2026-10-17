module.exports = {
  apps: [
    {
      name: "travel-api",
      script: "./server/index.js",
      instances: 4,          // 4 CPU Cores use karega
      exec_mode: "cluster",  // Cluster mode for load balancing
      watch: false,
      max_memory_restart: "500M",
      env: {
        PORT: 5000,
        NODE_ENV: "production",
      },
    },
  ],
};
