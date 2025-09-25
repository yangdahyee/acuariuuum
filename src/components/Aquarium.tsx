// src/components/Aquarium.tsx
import React from "react"
import { View, Image, StyleSheet, Pressable, Text } from "react-native"
import { GLView } from "expo-gl"
import { Renderer, TextureLoader as ExpoTextureLoader } from "expo-three"
import * as THREE from "three"
import { Asset } from "expo-asset"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { SkeletonUtils } from "three/examples/jsm/utils/SkeletonUtils"

type Props = {
  fishSrc: any // require('./assets/models/fish/fish.gltf')
  seaImage: any // require('./assets/images/sea.jpg')
  onBack: () => void
}

const WORLD_HEIGHT = 10

export default function Aquarium({ fishSrc, seaImage, onBack }: Props) {
  return (
    <View style={{ flex: 1 }}>
      {/* RN 배경 이미지 */}
      <Image source={seaImage} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {/* 3D 씬 */}
      <GLView
        style={StyleSheet.absoluteFill}
        onContextCreate={async (gl) => {
          const renderer = new Renderer({ gl })
          const W = gl.drawingBufferWidth
          const H = gl.drawingBufferHeight
          renderer.setSize(W, H)
          // GLView 배경은 투명 지원이 기기마다 다릅니다. 안전하게 3D 씬 안에 배경 plane를 쓰거나,
          // 아래처럼 clearColor를 약간 투명하게 둘 수도 있음(기기별 차이 有):
          renderer.setClearColor(0x000000, 0) // 투명 시도

          const scene = new THREE.Scene()
          const aspect = W / H
          const camera = new THREE.OrthographicCamera((-WORLD_HEIGHT * aspect) / 2, (WORLD_HEIGHT * aspect) / 2, WORLD_HEIGHT / 2, -WORLD_HEIGHT / 2, 0.1, 100)
          camera.position.set(0, 0, 10)

          // 라이트
          scene.add(new THREE.AmbientLight(0xffffff, 1))
          const dir = new THREE.DirectionalLight(0xffffff, 0.6)
          dir.position.set(3, 5, 4)
          scene.add(dir)

          // ---- 배경 plane(옵션: RN Image만 써도 되지만 일관성 위해 Plane 추가)
          {
            const texAsset = Asset.fromModule(seaImage)
            await texAsset.downloadAsync()
            const texLoader = new ExpoTextureLoader(new THREE.LoadingManager())
            const tex = await texLoader.loadAsync(texAsset.uri!)
            const worldWidth = WORLD_HEIGHT * aspect
            const bgGeo = new THREE.PlaneGeometry(worldWidth, WORLD_HEIGHT)
            const bgMat = new THREE.MeshBasicMaterial({ map: tex })
            const bg = new THREE.Mesh(bgGeo, bgMat)
            bg.position.set(0, 0, -5)
            scene.add(bg)
          }

          // ---- GLTF 로드(Embedded 한 파일 가정)
          const gltfAsset = Asset.fromModule(fishSrc)
          await gltfAsset.downloadAsync()

          const manager = new THREE.LoadingManager()
          // png/jpg 텍스처는 ExpoTextureLoader로
          manager.addHandler(/\.(png|jpg|jpeg)$/i, new ExpoTextureLoader(manager))

          const loader = new GLTFLoader(manager)
          const clock = new THREE.Clock()

          type Agent = {
            node: THREE.Object3D
            mixer: THREE.AnimationMixer
            dir: 1 | -1
            speed: number
          }
          const agents: Agent[] = []

          loader.load(
            gltfAsset.uri || gltfAsset.localUri!,
            (gltf) => {
              const original = gltf.scene
              const clips = gltf.animations || []
              const swim = THREE.AnimationClip.findByName(clips, "Swim_Loop") || clips[0]

              const worldWidth = WORLD_HEIGHT * aspect
              const margin = 0.5

              // 한 마리만
              const fish = SkeletonUtils.clone(original)
              const s = 1.0
              fish.scale.set(s, s, s)
              fish.position.set(-worldWidth / 2 + margin, 0, 0)
              scene.add(fish)

              const mixer = new THREE.AnimationMixer(fish)
              if (swim) mixer.clipAction(swim).play()

              agents.push({
                node: fish,
                mixer,
                dir: 1, // 오른쪽으로 시작
                speed: 2.0, // 이동 속도 (월드 유닛/초)
              })

              // 렌더 루프
              function render() {
                const dt = clock.getDelta()

                camera.updateProjectionMatrix()

                for (const a of agents) {
                  a.mixer.update(dt)
                  a.node.position.x += a.dir * a.speed * dt

                  const halfW = (WORLD_HEIGHT * (gl.drawingBufferWidth / gl.drawingBufferHeight)) / 2 - margin
                  if (a.node.position.x > halfW) {
                    a.dir = -1
                    a.node.scale.x = -Math.abs(a.node.scale.x) // 왼쪽 보기
                  } else if (a.node.position.x < -halfW) {
                    a.dir = 1
                    a.node.scale.x = Math.abs(a.node.scale.x) // 오른쪽 보기
                  }
                }

                renderer.render(scene, camera)
                gl.endFrameEXP()
                requestAnimationFrame(render)
              }
              render()
            },
            undefined,
            (err) => console.error("[Aquarium] GLTF load error", err)
          )
        }}
      />

      {/* 뒤로가기 */}
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
