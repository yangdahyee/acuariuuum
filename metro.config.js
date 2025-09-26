const { getDefaultConfig } = require("expo/metro-config")
const config = getDefaultConfig(__dirname)
config.resolver.alias = {
  three: require.resolve("three"),
  // 'three/examples/jsm': require.resolve('three-stdlib'), // 필요하면
}
config.resolver.assetExts.push("gltf", "bin", "glb")
module.exports = config
