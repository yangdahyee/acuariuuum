// src/components/Aquarium.tsx
import React from "react"
import { View, Image, StyleSheet, Pressable, Text } from "react-native"
import { GLView } from "expo-gl"
import { Renderer, TextureLoader as ExpoTextureLoader } from "expo-three"
import * as THREE from "three"
import { Asset } from "expo-asset"

// ★ examples는 확장자 없이 임포트 (타입/리졸브 이슈 방지)
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { SkeletonUtils } from "three/examples/jsm/utils/SkeletonUtils"

type Props = {
  fishSrc: any // require("./assets/models/fish/fish.gltf")
  seaImage: any // require("./assets/images/sea.png")
  onBack: () => void
}

const WORLD_HEIGHT = 10

export default function Aquarium({ fishSrc, seaImage, onBack }: Props) {
  return (
    <View style={{ flex: 1 }}>
      <Image source={seaImage} style={StyleSheet.absoluteFill} resizeMode="cover" />

      <GLView
        style={StyleSheet.absoluteFill}
        onContextCreate={async (gl) => {
          const renderer = new Renderer({ gl })
          const W = gl.drawingBufferWidth
          const H = gl.drawingBufferHeight
          renderer.setSize(W, H)
          renderer.setClearColor(0x000000, 0)

          const scene = new THREE.Scene()
          const aspect = W / H
          const camera = new THREE.OrthographicCamera((-WORLD_HEIGHT * aspect) / 2, (WORLD_HEIGHT * aspect) / 2, WORLD_HEIGHT / 2, -WORLD_HEIGHT / 2, 0.1, 100)
          camera.position.set(0, 0, 10)

          scene.add(new THREE.AmbientLight(0xffffff, 1))
          const dir = new THREE.DirectionalLight(0xffffff, 0.6)
          dir.position.set(3, 5, 4)
          scene.add(dir)

          // (옵션) 3D 배경 Plane
          {
            const bgAsset = Asset.fromModule(seaImage)
            await bgAsset.downloadAsync()
            const tloader = new ExpoTextureLoader(new THREE.LoadingManager())
            const tex = await tloader.loadAsync(bgAsset.uri!)
            const worldWidth = WORLD_HEIGHT * aspect
            const bg = new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, WORLD_HEIGHT), new THREE.MeshBasicMaterial({ map: tex }))
            bg.position.set(0, 0, -5)
            scene.add(bg)
          }

          // ---- glTF (Separate: .gltf + .bin + .png) → 경로를 절대 URL로 치환 후 parse
          const gltfAsset = Asset.fromModule(fishSrc)
          const binAsset = Asset.fromModule(require("../../assets/models/fish/fish.bin"))
          const pngAsset = Asset.fromModule(require("../../assets/models/fish/eye.png"))

          // 각각 다운로드 (Asset.loadAsync([...]) 대신 → TS 경고 회피)
          await gltfAsset.downloadAsync()
          await binAsset.downloadAsync()
          await pngAsset.downloadAsync()

          // 1) glTF 텍스트 가져오기
          const gltfText = await (await fetch(gltfAsset.uri!)).text()

          // 2) 내부 uri들을 Expo가 제공한 HTTP URL로 치환
          type GLTFDoc = {
            buffers?: Array<{ uri?: string }>
            images?: Array<{ uri?: string }>
            [k: string]: any
          }
          const doc: GLTFDoc = JSON.parse(gltfText)

          const mapUri = (u?: string) => {
            if (!u) return u
            const name = u
              .split("?")[0]
              .split("#")[0]
              .replace(/^.*[\\/]/, "")
            if (name === "fish.bin") return binAsset.uri!
            if (name === "eye.png") return pngAsset.uri!
            return u
          }

          if (doc.buffers) doc.buffers = doc.buffers.map((b) => ({ ...b, uri: mapUri(b.uri) }))
          if (doc.images) doc.images = doc.images.map((i) => ({ ...i, uri: mapUri(i.uri) }))

          const patched = JSON.stringify(doc)

          // 3) 로더 (RN 친화 텍스처 로더 등록)
          const manager = new THREE.LoadingManager()
          manager.addHandler(/\.(png|jpg|jpeg)$/i, new ExpoTextureLoader(manager))
          const loader = new GLTFLoader(manager)

          const clock = new THREE.Clock()
          type Agent = { node: THREE.Object3D; mixer: THREE.AnimationMixer; dir: 1 | -1; speed: number }
          const agents: Agent[] = []

          // 4) URL 없이 parse로 로딩 → 경로 이슈 차단
          loader.parse(
            patched,
            "",
            (gltf: any) => {
              const original = gltf.scene
              const clips = gltf.animations || []
              const swim = THREE.AnimationClip.findByName(clips, "Swim_Loop") || THREE.AnimationClip.findByName(clips, "ArmatureAction.001") || clips[0]

              const worldWidth = WORLD_HEIGHT * aspect
              const margin = 0.5

              const fish = SkeletonUtils.clone(original)
              const s = 1.0
              fish.scale.set(s, s, s)
              fish.position.set(-worldWidth / 2 + margin, 0, 0)
              scene.add(fish)

              const mixer = new THREE.AnimationMixer(fish)
              if (swim) mixer.clipAction(swim).play()

              agents.push({ node: fish, mixer, dir: 1, speed: 2.0 })

              function render() {
                const dt = clock.getDelta()
                camera.updateProjectionMatrix()

                for (const a of agents) {
                  a.mixer.update(dt)
                  a.node.position.x += a.dir * a.speed * dt

                  const halfW = (WORLD_HEIGHT * (gl.drawingBufferWidth / gl.drawingBufferHeight)) / 2 - margin
                  if (a.node.position.x > halfW) {
                    a.dir = -1
                    a.node.scale.x = -Math.abs(a.node.scale.x)
                  } else if (a.node.position.x < -halfW) {
                    a.dir = 1
                    a.node.scale.x = Math.abs(a.node.scale.x)
                  }
                }

                renderer.render(scene, camera)
                gl.endFrameEXP()
                requestAnimationFrame(render)
              }
              render()
            },
            (err: unknown) => console.error("[Aquarium] GLTF parse error", err)
          )
        }}
      />

      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>← Back</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  backBtn: {
    position: "absolute",
    top: 40,
    left: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
})
