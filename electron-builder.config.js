const fs = require("fs");
const path = require("path");

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
    "electron/assets/**/*",
    "!src",
    "!docs",
    "!db",
    "!public",
    "!.next",
    "!.worktrees",
    "!release",
    "!standalone-build",
    "!data",
    "!team_data",
    "!scripts",
    "!*.md",
    "!pnpm-lock.yaml",
  ],

  asarUnpack: [
    "dist-electron/**/*",
    "electron/assets/**/*",
  ],

  extraResources: [
    {
      from: "db/",
      to: "db/",
    },
  ],

  afterPack(context) {
    // Strip unused Chrome locale files (keep only en-US)
    const localesDir = path.join(context.appOutDir, "locales");
    if (fs.existsSync(localesDir)) {
      let removed = 0;
      for (const file of fs.readdirSync(localesDir)) {
        if (file !== "en-US.pak") {
          fs.unlinkSync(path.join(localesDir, file));
          removed++;
        }
      }
      console.log(`  Stripped ${removed} unused locale files`);
    }

    // Copy standalone build to resources
    const src = path.join(__dirname, "standalone-build");
    const dest = path.join(context.appOutDir, "resources", "standalone");
    fs.cpSync(src, dest, { recursive: true });

    // electron-builder's @electron/rebuild recompiles better-sqlite3 for
    // Electron's Node version, which corrupts our project copy. We need
    // to rebuild it for system Node and patch the standalone copy.
    const { execSync } = require("child_process");
    console.log("  Rebuilding better-sqlite3 for system Node...");
    execSync("pnpm rebuild better-sqlite3", { cwd: __dirname, stdio: "inherit" });

    // Now copy the system Node-compiled binary over the standalone copies
    const bs3Build = path.join(
      fs.realpathSync(path.join(__dirname, "node_modules", "better-sqlite3")),
      "build", "Release", "better_sqlite3.node"
    );
    if (fs.existsSync(bs3Build)) {
      // Patch .next/node_modules/better-sqlite3-*/build/Release/
      const nextNm = path.join(dest, ".next", "node_modules");
      if (fs.existsSync(nextNm)) {
        for (const dir of fs.readdirSync(nextNm).filter(d => d.startsWith("better-sqlite3"))) {
          const targetDir = path.join(nextNm, dir, "build", "Release");
          if (fs.existsSync(targetDir)) {
            for (const f of fs.readdirSync(targetDir).filter(f => f.endsWith(".node"))) {
              fs.copyFileSync(bs3Build, path.join(targetDir, f));
              console.log(`  Patched ${dir}/build/Release/${f}`);
            }
          }
        }
      }
      // Patch node_modules/better-sqlite3/build/Release/
      const topBs3 = path.join(dest, "node_modules", "better-sqlite3", "build", "Release");
      if (fs.existsSync(topBs3)) {
        for (const f of fs.readdirSync(topBs3).filter(f => f.endsWith(".node"))) {
          fs.copyFileSync(bs3Build, path.join(topBs3, f));
          console.log(`  Patched node_modules/better-sqlite3/build/Release/${f}`);
        }
      }
    }
  },

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
    createDesktopShortcut: true,
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
