const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Reuse only imported platform-independent web utilities; preserve the web package.
config.watchFolders = [path.resolve(__dirname, '../src')];
// Shared source must resolve the same Firebase SDK as the native application.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
module.exports = config;
