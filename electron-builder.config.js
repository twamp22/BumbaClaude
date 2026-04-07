/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "com.bumbaclaude.app",
  productName: "BumbaClaude",
  copyright: "Copyright 2026 Thomas Wright",

  directories: {
    output: "release",
    buildResources: "electron/assets",
  },

  files: [
    "dist-electron/**/*",
    "electron/splash.html",
    "electron/assets/**/*",
    ".next/standalone/**/*",
    ".next/static/**/*",
    "public/**/*",
    "db/**/*",
  ],

  extraResources: [
    {
      from: ".next/standalone",
      to: "app/.next/standalone",
      filter: ["**/*"],
    },
    {
      from: ".next/static",
      to: "app/.next/static",
      filter: ["**/*"],
    },
    {
      from: "public",
      to: "app/public",
      filter: ["**/*"],
    },
    {
      from: "db",
      to: "app/db",
      filter: ["**/*"],
    },
  ],

  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
      {
        target: "zip",
        arch: ["x64"],
      },
    ],
    icon: "electron/assets/icon.ico",
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopIcon: true,
    createStartMenuShortcut: true,
    shortcutName: "BumbaClaude",
    installerIcon: "electron/assets/icon.ico",
    uninstallerIcon: "electron/assets/icon.ico",
  },

  publish: {
    provider: "github",
    owner: "twamp22",
    repo: "BumbaClaude",
    releaseType: "release",
  },
};
