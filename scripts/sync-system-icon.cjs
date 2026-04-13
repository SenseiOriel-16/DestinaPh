/**
 * Copies apps/System_Icon.png into all apps that need it (mobile bundle + web public).
 * Run from repo root: node scripts/sync-system-icon.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "apps", "System_Icon.png");

const targets = [
  path.join(root, "apps", "mobile", "assets", "System_Icon.png"),
  path.join(root, "apps", "client-web", "public", "system-icon.png"),
  path.join(root, "apps", "admin-web", "public", "system-icon.png"),
];

function main() {
  if (!fs.existsSync(src)) {
    console.error("Missing source file:", src);
    process.exit(1);
  }
  for (const dest of targets) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log("Copied ->", path.relative(root, dest));
  }
  console.log("OK");
}

main();
