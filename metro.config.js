// metro.config.js
const { getDefaultConfig } = require("expo/metro-config")
const config = getDefaultConfig(__dirname)
config.resolver.assetExts.push("gltf", "glb", "bin")
module.exports = config
