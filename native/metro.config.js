const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Reuse only imported platform-independent web utilities; preserve the web package.
// The shared request-budget adapter imports the existing pure quota policy.
// Watching its folder makes that explicit dependency visible to Metro on EAS.
config.watchFolders = [path.resolve(__dirname, '../src'), path.resolve(__dirname, '../functions')];
// Shared source must resolve the same Firebase SDK as the native application.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
// Keep query-string 7's callable CommonJS contract while using the upstream
// linear-time security fix. Applies to every native Metro decoder import.
const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'decode-uri-component' || moduleName === 'decode-uri-component/index.js') {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'vendor/decode-uri-component/index.cjs') };
  }
  return previousResolveRequest
    ? previousResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
