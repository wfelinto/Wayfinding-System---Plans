// Next.js's "standalone" output intentionally excludes the static asset
// folders (.next/static and public/) to keep the traced server bundle
// minimal — its own docs say to copy them in manually after building.
// This runs automatically after `npm run build` via the "postbuild"
// script name in package.json.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");

if (!fs.existsSync(standaloneDir)) {
  console.log("No .next/standalone directory found — skipping (is output: 'standalone' set in next.config.js?).");
  process.exit(0);
}

fs.cpSync(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"), {
  recursive: true,
});

if (fs.existsSync(path.join(root, "public"))) {
  fs.cpSync(path.join(root, "public"), path.join(standaloneDir, "public"), { recursive: true });
}

console.log("Copied static assets into .next/standalone — ready for Electron packaging.");
