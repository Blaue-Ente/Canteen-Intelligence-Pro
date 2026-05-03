const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /.*\/pdf-parse(@[^/]+)?\/.*/,
  /.*\/pdf-parse_tmp_.*/,
];
config.watcher = config.watcher || {};
config.watcher.additionalExts = config.watcher.additionalExts || [];
config.watcher.healthCheck = { enabled: false };
config.watcher.watchman = config.watcher.watchman || {};
config.watcher.unstable_workerThreads = false;

module.exports = config;
