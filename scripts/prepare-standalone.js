/**
 * Prepare the Next.js standalone build for Electron packaging.
 *
 * pnpm's standalone output has symlinks pointing to the project root's
 * .pnpm store, not the standalone's own .pnpm directory. This script:
 * 1. Copies everything except node_modules (no symlink issues)
 * 2. Copies the .pnpm store from standalone with resolved symlinks
 * 3. Recreates top-level package links as real directory copies
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", ".next", "standalone");
const DEST = path.join(__dirname, "..", "standalone-build");
const STATIC_SRC = path.join(__dirname, "..", ".next", "static");
const PUBLIC_SRC = path.join(__dirname, "..", "public");

function copyDirResolved(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    let realPath = srcPath;
    try {
      const lstat = fs.lstatSync(srcPath);
      if (lstat.isSymbolicLink()) {
        realPath = fs.realpathSync(srcPath);
      }
    } catch {
      continue;
    }

    try {
      const stat = fs.statSync(realPath);
      if (stat.isDirectory()) {
        copyDirResolved(realPath, destPath);
      } else {
        fs.copyFileSync(realPath, destPath);
      }
    } catch {
      // Skip files we can't access
    }
  }
}

console.log("Preparing standalone build...");

// Clean dest
if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true });
}
fs.mkdirSync(DEST, { recursive: true });

// Step 1: Copy only the files needed for the standalone server to run
// Next.js standalone mirrors the entire project root, so we must skip
// directories that are not needed at runtime to avoid bloat.
const SKIP_DIRS = new Set([
  "node_modules",  // handled separately with symlink resolution
  "src",           // source code, not needed at runtime
  "docs",          // documentation
  "release",       // built artifacts
  "standalone-build", // previous build output
  "electron",      // electron source (packaged separately)
  "dist-electron", // compiled electron code (packaged separately)
  "scripts",       // build scripts
  ".worktrees",    // git worktrees
  "team_data",     // development data
  "data",          // SQLite database (created at runtime)
]);
const SKIP_FILES = new Set([
  "pnpm-lock.yaml",
  "tsconfig.json",
  "electron.tsconfig.json",
  "electron-builder.config.js",
  "postcss.config.mjs",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "PHILOSOPHY.md",
  "MVP_SPEC.md",
  "LICENSE",
  "README.md",
]);
const topEntries = fs.readdirSync(SRC);
for (const entry of topEntries) {
  if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue;
  const srcPath = path.join(SRC, entry);
  const destPath = path.join(DEST, entry);
  const stat = fs.lstatSync(srcPath);
  if (stat.isDirectory()) {
    fs.cpSync(srcPath, destPath, { recursive: true });
  } else {
    fs.copyFileSync(srcPath, destPath);
  }
}
console.log("  Copied standalone files (excluding non-runtime files)");

// Step 2: Copy node_modules with all symlinks resolved
const nmSrc = path.join(SRC, "node_modules");
const nmDest = path.join(DEST, "node_modules");
copyDirResolved(nmSrc, nmDest);
console.log("  Copied node_modules with resolved symlinks");

// Step 2b: Hoist packages from .pnpm into top-level node_modules
// pnpm's .pnpm store has packages in dirs like @swc+helpers@0.5.15/node_modules/@swc/helpers
// We need to make them accessible at node_modules/@swc/helpers for Node resolution
const pnpmDir = path.join(nmDest, ".pnpm");
if (fs.existsSync(pnpmDir)) {
  const pnpmEntries = fs.readdirSync(pnpmDir);
  for (const entry of pnpmEntries) {
    const innerNm = path.join(pnpmDir, entry, "node_modules");
    if (!fs.existsSync(innerNm)) continue;

    const innerPkgs = fs.readdirSync(innerNm);
    for (const pkg of innerPkgs) {
      const pkgSrc = path.join(innerNm, pkg);
      const pkgDest = path.join(nmDest, pkg);

      // Skip if already exists at top level (don't overwrite direct deps)
      if (fs.existsSync(pkgDest)) continue;

      const stat = fs.lstatSync(pkgSrc);
      if (stat.isSymbolicLink()) {
        // Resolve and copy
        const realPkg = fs.realpathSync(pkgSrc);
        if (fs.statSync(realPkg).isDirectory()) {
          copyDirResolved(realPkg, pkgDest);
        }
      } else if (stat.isDirectory()) {
        copyDirResolved(pkgSrc, pkgDest);
      }
    }
  }
  console.log("  Hoisted .pnpm packages to top-level node_modules");
}

// Step 2c: Remove the .pnpm store (no longer needed after hoisting)
if (fs.existsSync(pnpmDir)) {
  fs.rmSync(pnpmDir, { recursive: true });
  console.log("  Removed .pnpm store (hoisted packages are sufficient)");
}

// Step 2d: Replace ALL better-sqlite3 native binaries with system Node build
// Next.js bundles its own hashed copy in .next/node_modules/ and
// electron-builder's @electron/rebuild recompiles for Electron's Node version.
// Since we run the server with system Node, we need system-compatible binaries.
const projectBetterSqlite = path.join(__dirname, "..", "node_modules", "better-sqlite3");
if (fs.existsSync(projectBetterSqlite)) {
  const realBs3 = fs.realpathSync(projectBetterSqlite);
  const bs3BuildDir = path.join(realBs3, "build", "Release");

  // Replace top-level node_modules copy
  const betterSqliteDest = path.join(nmDest, "better-sqlite3");
  if (fs.existsSync(betterSqliteDest)) {
    fs.rmSync(betterSqliteDest, { recursive: true });
  }
  copyDirResolved(realBs3, betterSqliteDest);

  // Find and replace ALL hashed copies in .next/node_modules/
  const nextNm = path.join(DEST, ".next", "node_modules");
  if (fs.existsSync(nextNm)) {
    const hashedDirs = fs.readdirSync(nextNm).filter((d) => d.startsWith("better-sqlite3"));
    for (const dir of hashedDirs) {
      const hashedBuildDir = path.join(nextNm, dir, "build", "Release");
      if (fs.existsSync(hashedBuildDir) && fs.existsSync(bs3BuildDir)) {
        // Replace the .node binary with system Node-compatible one
        const nodeFiles = fs.readdirSync(bs3BuildDir).filter((f) => f.endsWith(".node"));
        const hashedNodeFiles = fs.readdirSync(hashedBuildDir).filter((f) => f.endsWith(".node"));
        for (const hashedFile of hashedNodeFiles) {
          for (const srcFile of nodeFiles) {
            fs.copyFileSync(
              path.join(bs3BuildDir, srcFile),
              path.join(hashedBuildDir, hashedFile)
            );
          }
        }
        console.log(`  Replaced native binary in .next/node_modules/${dir}`);
      }
    }
  }
  console.log("  Replaced better-sqlite3 with system Node-compatible builds");
}

// Step 3: Copy .next/static
const destStatic = path.join(DEST, ".next", "static");
fs.cpSync(STATIC_SRC, destStatic, { recursive: true });
console.log("  Copied .next/static");

// Step 4: Copy public
const destPublic = path.join(DEST, "public");
fs.cpSync(PUBLIC_SRC, destPublic, { recursive: true });
console.log("  Copied public/");

// Verify key files
const checks = [
  "server.js",
  "node_modules/next/dist/server/next.js",
  ".next/static",
  "public/favicon.ico",
];

let ok = true;
for (const check of checks) {
  const fullPath = path.join(DEST, check);
  if (!fs.existsSync(fullPath)) {
    console.error(`  MISSING: ${check}`);
    ok = false;
  }
}

if (ok) {
  console.log("Standalone build ready. All key files verified.");
} else {
  console.error("WARNING: Some expected files are missing!");
}
