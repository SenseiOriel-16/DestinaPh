/**
 * Square Expo / Play icons + Android mipmap launcher PNGs from `apps/System_Icon.png`.
 * - Crops a top-centered square (portrait logos → graphic mark; avoids tiny text in launcher).
 * - Writes `assets/icon.png`, `assets/adaptive-icon.png` (1024²).
 * - Writes Android res mipmap PNGs (ic_launcher, round, foreground) for committed android/.
 *
 * Run from apps/mobile: npm run icons:generate
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const rootMobile = path.join(__dirname, "..");
const repoApps = path.join(__dirname, "..", "..");
const defaultSrc = path.join(repoApps, "System_Icon.png");
const altSrc = path.join(rootMobile, "assets", "System_Icon.png");
const assetsDir = path.join(rootMobile, "assets");
const androidRes = path.join(rootMobile, "android", "app", "src", "main", "res");

const NAVY = { r: 11, g: 60, b: 93, alpha: 1 };

/** Legacy launcher (48dp baseline → mdpi 48px). */
const LEGACY_DP = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

/** Adaptive foreground layer (108dp baseline). */
const FOREGROUND_DP = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

function resolveSrc() {
  const fromEnv = process.env.ICON_SOURCE && process.env.ICON_SOURCE.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  if (fs.existsSync(defaultSrc)) return defaultSrc;
  if (fs.existsSync(altSrc)) return altSrc;
  return null;
}

/**
 * Top-weighted square crop: for tall images, take the top `width × width` (brand mark);
 * otherwise center-crop a square.
 */
async function squareMarkBuffer(srcPath) {
  const meta = await sharp(srcPath).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error(`Could not read dimensions: ${srcPath}`);

  let left = 0;
  let top = 0;
  let side = Math.min(w, h);

  if (h > w) {
    side = w;
    top = 0;
    left = 0;
  } else if (w > h) {
    side = h;
    left = Math.floor((w - side) / 2);
    top = Math.floor((h - side) / 2);
  }

  return sharp(srcPath).extract({ left, top, width: side, height: side }).png().toBuffer();
}

async function writePng(buf, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await sharp(buf).png({ compressionLevel: 9 }).toFile(outPath);
}

async function main() {
  const src = resolveSrc();
  if (!src) {
    console.error("Missing icon source. Add apps/System_Icon.png or apps/mobile/assets/System_Icon.png");
    process.exit(1);
  }

  const markBuf = await squareMarkBuffer(src);

  const icon1024 = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: NAVY },
  })
    .composite([{ input: await sharp(markBuf).resize(920, 920, { fit: "inside" }).png().toBuffer(), gravity: "center" }])
    .png()
    .toBuffer();

  const adaptive1024 = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: await sharp(markBuf).resize(670, 670, { fit: "inside" }).png().toBuffer(),
        gravity: "center",
      },
    ])
    .png()
    .toBuffer();

  fs.mkdirSync(assetsDir, { recursive: true });
  await sharp(icon1024).toFile(path.join(assetsDir, "icon.png"));
  await sharp(adaptive1024).toFile(path.join(assetsDir, "adaptive-icon.png"));
  console.log("OK: assets/icon.png, assets/adaptive-icon.png");

  for (const [density, px] of Object.entries(LEGACY_DP)) {
    const dir = path.join(androidRes, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    const legacy = await sharp(icon1024).resize(px, px).png().toBuffer();
    await writePng(legacy, path.join(dir, "ic_launcher.png"));
    await writePng(legacy, path.join(dir, "ic_launcher_round.png"));
  }

  for (const [density, px] of Object.entries(FOREGROUND_DP)) {
    const dir = path.join(androidRes, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    const fg = await sharp(adaptive1024).resize(px, px).png().toBuffer();
    await writePng(fg, path.join(dir, "ic_launcher_foreground.png"));
  }

  console.log("OK: android mipmap-* launcher PNGs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
