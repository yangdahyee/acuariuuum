// src/components/Aquarium.tsx
import React, { useEffect, useMemo, useRef, useState, memo } from "react"
import { View, Image, StyleSheet, Pressable, Text } from "react-native"
import { Canvas, useFrame, useThree } from "@react-three/fiber/native"
import { OrbitControls } from "@react-three/drei/native"
import { Asset } from "expo-asset"
import { Group, Box3, Vector3, MathUtils, AnimationMixer, AnimationClip, LoopRepeat } from "three"
import { GLTFLoader } from "three-stdlib"

type Props = { onBack?: () => void; seaImage?: any; modelSrc?: number }

const DEFAULT_BG = require("../../assets/images/sea.png")
const DEFAULT_MODEL = require("../../assets/models/fish/fish_2crown_downsize.glb")

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function SwimmingFish({
  source,
  targetScreenHeightRatio = 0.22,
  sizeMultiplier = 0.28,

  // 이동
  speed = 2.0,
  margin = 0.7,
  flipOnTurn = true,
  startSide = "left", // "left" | "right" | "middle"
  initialYawDeg = 90,
  xOffset = 0,
  yFrac = 0, // -1(아래) ~ +1(위)
  zLayer = 0.5,
  spawnT = 0.5,

  // 상하 바운스(옵션)
  bobAmplitude = 0,
  bobFrequency = 1.0,

  // 애니메이션(옵션)
  animName = "swim_idle",
  animSpeed = 1.0,
  fadeSeconds = 0.1,
}: {
  source: number
  targetScreenHeightRatio?: number
  sizeMultiplier?: number
  speed?: number
  margin?: number
  flipOnTurn?: boolean
  startSide?: "left" | "right" | "middle"
  initialYawDeg?: number
  xOffset?: number
  yFrac?: number
  zLayer?: number
  spawnT?: number
  bobAmplitude?: number
  bobFrequency?: number
  animName?: string
  animSpeed?: number
  fadeSeconds?: number
}) {
  const group = useRef<Group>(null)
  const [scene, setScene] = useState<Group | null>(null)

  // 크기/경계
  const baseScale = useRef(1)
  const halfWidthWorld = useRef(0)
  const placed = useRef(false)
  const dirX = useRef<1 | -1>(1)
  const bobT = useRef(0)

  // 애니
  const mixerRef = useRef<AnimationMixer | null>(null)
  const actionRef = useRef<ReturnType<AnimationMixer["clipAction"]> | null>(null)

  const tmpBox = useMemo(() => new Box3(), [])
  const tmpV = useMemo(() => new Vector3(), [])
  const { viewport } = useThree()

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const asset = Asset.fromModule(source)
      if (!asset.localUri) await asset.downloadAsync()

      const loader = new GLTFLoader()
      loader.load(
        asset.localUri || asset.uri || "",
        (gltf) => {
          if (!mounted) return

          const obj = gltf.scene as Group

          // 중앙 정렬 + 스케일 정규화
          tmpBox.setFromObject(obj)
          const size = tmpBox.getSize(tmpV.set(0, 0, 0))
          const center = tmpBox.getCenter(tmpV.set(0, 0, 0))
          obj.position.sub(center)

          const maxDim = Math.max(size.x, size.y, size.z) || 1
          const targetH = viewport.height * targetScreenHeightRatio
          const s = (targetH / maxDim) * sizeMultiplier
          baseScale.current = s
          halfWidthWorld.current = (size.x * s) / 2

          setScene(obj)

          // ── 애니: 있으면 재생, 없으면 스킵 ──
          const hasClips = Array.isArray(gltf.animations) && gltf.animations.length > 0
          if (!hasClips) {
            mixerRef.current = null
            actionRef.current = null
            return
          }

          // 찾기(이름 없으면 첫 클립)
          const clip = AnimationClip.findByName(gltf.animations, animName) || gltf.animations[0]
          if (!clip) {
            mixerRef.current = null
            actionRef.current = null
            return
          }

          const mixer = new AnimationMixer(obj)
          mixerRef.current = mixer
          const action = mixer.clipAction(clip, obj)
          actionRef.current = action
          action.setLoop(LoopRepeat, Infinity)
          action.enabled = true
          action.timeScale = animSpeed
          action.fadeIn(fadeSeconds).play()
        },
        undefined,
        (err) => console.error("[Aquarium] GLB load error", err)
      )
    })()

    return () => {
      mounted = false
      if (actionRef.current) {
        actionRef.current.stop()
        actionRef.current = null
      }
      if (mixerRef.current) {
        mixerRef.current.stopAllAction()
        mixerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, viewport.height, targetScreenHeightRatio, sizeMultiplier, animName, animSpeed])

  useFrame((_, delta) => {
    // 애니가 있으면 업데이트, 없으면 통과
    if (mixerRef.current) mixerRef.current.update(delta)

    if (!group.current) return
    const halfH = viewport.height / 2
    const laneY = halfH * MathUtils.clamp(yFrac, -1, 1)

    // 최초 배치
    if (!placed.current) {
      const left = -viewport.width / 2 + margin + halfWidthWorld.current + 0.01
      const right = viewport.width / 2 - margin - halfWidthWorld.current - 0.01
      let startX = 0
      if (startSide === "left") {
        startX = left
        dirX.current = 1
      } else if (startSide === "right") {
        startX = right
        dirX.current = -1
      } else {
        startX = lerp(left, right, clamp01(spawnT))
        dirX.current = 1
      }
      group.current.position.set(startX + xOffset, laneY, zLayer)
      group.current.scale.setScalar(baseScale.current)
      const yaw = dirX.current === 1 ? initialYawDeg : -initialYawDeg
      group.current.rotation.set(0, MathUtils.degToRad(yaw), 0)
      placed.current = true
    }

    // 좌우 핑퐁
    const leftB = -viewport.width / 2 + margin + halfWidthWorld.current
    const rightB = viewport.width / 2 - margin - halfWidthWorld.current
    group.current.position.x += dirX.current * speed * delta

    if (group.current.position.x <= leftB) {
      group.current.position.x = leftB
      dirX.current = 1
      if (flipOnTurn) group.current.scale.x = Math.abs(group.current.scale.x)
    } else if (group.current.position.x >= rightB) {
      group.current.position.x = rightB
      dirX.current = -1
      if (flipOnTurn) group.current.scale.x = -Math.abs(group.current.scale.x)
    }

    // Y(화면 비율) + 바운스(옵션)
    if (bobAmplitude > 0) {
      bobT.current += delta
      group.current.position.y = laneY + Math.sin(bobT.current * bobFrequency * Math.PI * 2) * bobAmplitude
    } else {
      group.current.position.y = laneY
    }

    group.current.position.z = zLayer
  })

  return <group ref={group}>{scene && <primitive object={scene} />}</group>
}

const CanvasScene = memo(function CanvasScene({ modelSrc }: { modelSrc: number }) {
  return (
    <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 50, near: 0.1, far: 100 }}>
      <ambientLight intensity={0.9} />
      <directionalLight intensity={0.7} position={[3, 5, 4]} />
      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />

      {/* 애니 있는 모델은 재생, 없으면 이동만 */}
      <SwimmingFish source={modelSrc} sizeMultiplier={0.28} startSide="right" yFrac={+0.8} speed={2.2} zLayer={0.96} animName="swim_idle" animSpeed={1.0} />
      <SwimmingFish
        source={require("../../assets/models/fish/action_finish_fish1_pink.glb")}
        sizeMultiplier={0.26}
        startSide="middle"
        spawnT={0.25}
        yFrac={0.0}
        speed={1.6}
        zLayer={0.92}
        animName="swim_idle" // 여기에 애니 없으면 자동으로 이동만
        animSpeed={1.2}
      />
      <SwimmingFish source={require("../../assets/models/fish/fish78.glb")} sizeMultiplier={0.26} startSide="left" yFrac={-0.5} speed={2.8} zLayer={0.94} animName="swim_idle" animSpeed={0.9} />
    </Canvas>
  )
})

export default function Aquarium({ onBack, seaImage = DEFAULT_BG, modelSrc = DEFAULT_MODEL }: Props) {
  return (
    <View style={{ flex: 1 }}>
      <Image source={seaImage} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <CanvasScene modelSrc={modelSrc} />
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backTxt}>← Back</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  backBtn: {
    position: "absolute",
    top: 40,
    left: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  backTxt: { color: "#fff", fontWeight: "800", letterSpacing: 0.5 },
})
