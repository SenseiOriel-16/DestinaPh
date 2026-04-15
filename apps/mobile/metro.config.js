// Metro config for Expo (SDK 51)
// Allows importing shared assets (e.g. ../Notification.wav) from the workspace.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
// `apps/` folder (workspace root for shared assets)
const appsRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Allow importing files from `apps/` (e.g. apps/Notification.wav)
config.watchFolders = Array.from(new Set([...(config.watchFolders || []), appsRoot]));

// Ensure `.wav` is treated as an asset.
config.resolver.assetExts = Array.from(new Set([...(config.resolver.assetExts || []), "wav"]));

// Note: we intentionally keep the resolver defaults here.
// Custom `extraNodeModules` / `disableHierarchicalLookup` can break asset resolution in some packages.

module.exports = config;

