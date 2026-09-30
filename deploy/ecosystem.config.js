module.exports = {
  apps: [
    {
      name: 'alelmam-api',
      script: './src/server.js',
      instances: 1, // ارفعها لـ 'max' لاحقاً عند الحاجة لاستغلال كل أنوية المعالج
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      time: true,
    },
  ],
};
