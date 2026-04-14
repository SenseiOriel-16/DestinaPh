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

// When resolving from watchFolders, force Metro to use this project's node_modules.
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (_, name) => path.join(projectRoot, "node_modules", name),
  },
 );

module.exports = config;

