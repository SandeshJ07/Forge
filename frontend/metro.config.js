// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @shopify/react-native-skia's web target loads CanvasKit as a .wasm asset
// (used by victory-native's charts on the web build) — Metro doesn't treat
// .wasm as an asset by default, so register it here.
config.resolver.assetExts.push('wasm');

// react-native-reanimated 4's web build resolves a couple of packages
// through "package.json#exports" fields metro doesn't fully evaluate yet.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
