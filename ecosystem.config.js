module.exports = {
  apps: [
    {
      name: 'widgetcord',
      script: 'server.js',
      cwd: __dirname,
      env: {
        PORT: 3000,
      },
    },
  ],
};
