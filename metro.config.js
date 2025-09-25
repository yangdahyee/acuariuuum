// metro.config.js
const { getDefaultConfig } = require("expo/metro-config")
const config = getDefaultConfig(__dirname)

// glTF + bin 로더를 자산으로 인식시키기
config.resolver.assetExts.push("gltf", "bin", "glb")

module.exports = config
