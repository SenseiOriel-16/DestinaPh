const { parseProjectEnv } = require("@expo/env");
const appJson = require("./app.json");

// Merge EXPO_PUBLIC_* from apps/mobile/.env* into process.env so Metro inlines them.
// EAS dashboard vars are already on process.env; file values fill gaps when present.
const { env: fromFiles } = parseProjectEnv(__dirname, { silent: true });
for (const key of Object.keys(fromFiles)) {
  if (!key.startsWith("EXPO_PUBLIC_")) continue;
  const v = fromFiles[key];
  if (v != null && String(v).trim() !== "") {
    process.env[key] = String(v);
  }
}

/** Prefer EAS / shell env, then .env* (for local prebuild). */
function pickEnv(name) {
  const fromProc = process.env[name];
  if (fromProc != null && String(fromProc).trim() !== "") return String(fromProc).trim();
  const fromFile = fromFiles[name];
  if (fromFile != null && String(fromFile).trim() !== "") return String(fromFile).trim();
  return "";
}

// Standalone Android builds need Maps SDK + this key in AndroidManifest (Expo Go supplies its own).
// See: https://docs.expo.dev/versions/latest/sdk/map-view/#deploy-app-with-google-maps
const androidGoogleMapsApiKey = pickEnv("GOOGLE_MAPS_ANDROID_API_KEY") || pickEnv("GOOGLE_MAPS_API_KEY");
const iosGoogleMapsApiKey = pickEnv("GOOGLE_MAPS_IOS_API_KEY") || pickEnv("GOOGLE_MAPS_API_KEY");

const plugins = [...(appJson.expo.plugins || [])];
plugins.push([
  "react-native-maps",
  {
    androidGoogleMapsApiKey,
    iosGoogleMapsApiKey,
  },
]);

module.exports = {
  expo: {
    ...appJson.expo,
    plugins,
  },
};
