/**
 * Regenerate valid PNGs for Expo prebuild (replaces broken Git LFS pointers or corrupt files).
 * Run: node scripts/generate-expo-icons.cjs
 */
const path = require("path");
const sharp = require("sharp");

const assets = path.join(__dirname, "..", "assets");

async function main() {
  const navy = { r: 11, g: 60, b: 93, alpha: 1 };
  const teal = { r: 8, g: 143, b: 143, alpha: 1 };
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: navy } })
    .png()
    .toFile(path.join(assets, "icon.png"));
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: teal } })
    .png()
    .toFile(path.join(assets, "adaptive-icon.png"));
  console.log("OK: wrote assets/icon.png and assets/adaptive-icon.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
