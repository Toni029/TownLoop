const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Reuse only imported platform-independent web utilities; preserve the web package.
config.watchFolders = [path.resolve(__dirname, '../src')];
module.exports = config;
