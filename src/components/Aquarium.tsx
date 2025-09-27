// src/components/Aquarium.tsx
import React, { useEffect, useMemo, useRef, useState, memo } from "react"
import { View, Image, StyleSheet, Pressable, Text } from "react-native"
import { Canvas, useFrame, useThree } from "@react-three/fiber/native"
import { OrbitControls } from "@react-three/drei/native"
import { Asset } from "expo-asset"
import { Group, Box3, Vector3, MathUtils, AnimationMixer, AnimationClip, LoopRepeat } from "three"
import { GLTFLoader } from "three-stdlib"

/* ───────────────── types ───────────────── */
export type AquariumProps = {
  onBack?: () => void
  seaImage?: any
  modelSrc?: number // 단일 모델 fallback
  models?: number[] // 여러 마리
}

type StartSide = "left" | "right" | "middle"

export type SwimmingFishProps = {
  source: number // require(...) 모듈 id (expo-asset)
  targetScreenHeightRatio?: number
  sizeMultiplier?: number

  // 이동
  speed?: number
  margin?: number
  flipOnTurn?: boolean
  startSide?: StartSide
  initialYawDeg?: number
  xOffset?: number
  yFrac?: number // -1(아래) ~ +1(위)
  zLayer?: number
  spawnT?: number

  // 상하 바운스
  bobAmplitude?: number
  bobFrequency?: number

  // 회전 전환(스케일 반전 대신/또는 함께)
  faceTurn?: boolean // 벽에서 방향 전환 시 회전도 바꿀지
  turnSeconds?: number // 회전 전환에 걸리는 시간(부드럽게)

  // 애니(있을 때만 재생)
  animName?: string
  animSpeed?: number
  fadeSeconds?: number
}

/* ───────────────── utils ───────────────── */
const DEFAULT_BG = require("../../assets/images/sea.png")
const DEFAULT_MODEL = require("../../assets/models/fish/fish_2crown_downsize.glb")

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// 각도 보간(래핑 고려: 가장 짧은 경로로)
function lerpAngle(a: number, b: number, t: number) {
  let diff = MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI
  return a + diff * t
}

/* ───────────────── Fish ───────────────── */
function SwimmingFish({
  source,
  targetScreenHeightRatio = 0.22,
  sizeMultiplier = 0.28,

  // 이동
  speed = 2.0,
  margin = 0.7,
  flipOnTurn = true,
  startSide = "left",
  initialYawDeg = 90,
  xOffset = 0,
  yFrac = 0,
  zLayer = 0.5,
  spawnT = 0.5,

  // 바운스
  bobAmplitude = 0,
  bobFrequency = 1.0,

  // 회전 전환
  faceTurn = true,
  turnSeconds = 0.25,

  // 애니
  animName = "swim_idle",
  animSpeed = 1.0,
  fadeSeconds = 0.1,
}: SwimmingFishProps) {
  const group = useRef<Group>(null)
  const [scene, setScene] = useState<Group | null>(null)

  // 크기/경계
  const baseScale = useRef(1)
  const halfWidthWorld = useRef(0)
  const placed = useRef(false)
  const dirX = useRef<1 | -1>(1)
  const bobT = useRef(0)
  const targetYaw = useRef(0) // 바라볼 목표 Y 회전(라디안)

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

          // 애니(있을 때만)
          const hasClips = Array.isArray(gltf.animations) && gltf.animations.length > 0
          if (!hasClips) {
            mixerRef.current = null
            actionRef.current = null
            return
          }

          const clip = AnimationClip.findByName(gltf.animations, animName) || gltf.animations[0]
          if (!clip) return

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
  }, [source, viewport.height, targetScreenHeightRatio, sizeMultiplier, animName, animSpeed])

  useFrame((_, delta) => {
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
      const yawDeg = dirX.current === 1 ? initialYawDeg : -initialYawDeg
      const yawRad = MathUtils.degToRad(yawDeg)
      group.current.rotation.set(0, yawRad, 0)
      targetYaw.current = yawRad // 초기 타겟 회전
      placed.current = true
    }

    // 좌우 핑퐁
    const leftB = -viewport.width / 2 + margin + halfWidthWorld.current
    const rightB = viewport.width / 2 - margin - halfWidthWorld.current
    group.current.position.x += dirX.current * speed * delta

    const hitLeft = group.current.position.x <= leftB
    const hitRight = group.current.position.x >= rightB

    if (hitLeft || hitRight) {
      group.current.position.x = hitLeft ? leftB : rightB
      dirX.current = hitLeft ? 1 : -1

      // 스케일 뒤집기(원하면 유지)
      if (flipOnTurn) {
        const s = Math.abs(group.current.scale.x) || baseScale.current
        group.current.scale.x = dirX.current === 1 ? s : -s
      }

      // 회전 타겟 갱신
      if (faceTurn) {
        const deg = dirX.current === 1 ? initialYawDeg : -initialYawDeg
        targetYaw.current = MathUtils.degToRad(deg)
      }
    }

    // 회전 부드럽게 보간
    if (faceTurn) {
      const k = 1 - Math.pow(0.001, delta / Math.max(0.0001, turnSeconds)) // 시간기반 감쇠
      group.current.rotation.y = lerpAngle(group.current.rotation.y, targetYaw.current, k)
    }

    // Y(고정 + 바운스 옵션)
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

/* ───────────────── Scene ───────────────── */
const CanvasScene = memo(function CanvasScene({ models }: { models: number[] }) {
  // Lane 프리셋(예시 5개)
  const lanes = [
    { yFrac: +0.8, zLayer: 0.96, speed: 2.2, startSide: "right" as const, size: 0.28 },
    { yFrac: +0.4, zLayer: 0.95, speed: 2.0, startSide: "middle" as const, size: 0.27, spawnT: 0.3 },
    { yFrac: 0.0, zLayer: 0.94, speed: 1.8, startSide: "left" as const, size: 0.26 },
    { yFrac: -0.4, zLayer: 0.93, speed: 2.4, startSide: "middle" as const, size: 0.26, spawnT: 0.7 },
    { yFrac: -0.8, zLayer: 0.92, speed: 2.6, startSide: "right" as const, size: 0.25 },
  ]

  return (
    <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 50, near: 0.1, far: 100 }}>
      <ambientLight intensity={0.9} />
      <directionalLight intensity={0.7} position={[3, 5, 4]} />
      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />

      {models.map((m, i) => {
        const lane = lanes[i % lanes.length]
        return (
          <SwimmingFish
            key={i}
            source={m}
            sizeMultiplier={lane.size}
            startSide={lane.startSide}
            spawnT={lane.spawnT ?? 0.5}
            yFrac={lane.yFrac}
            speed={lane.speed}
            zLayer={lane.zLayer}
            animName="swim_idle" // 애니 없으면 이동만
            animSpeed={1.0}
            faceTurn={true}
            turnSeconds={0.25}
          />
        )
      })}
    </Canvas>
  )
})

/* ───────────────── Page ───────────────── */
export default function Aquarium({ onBack, seaImage = DEFAULT_BG, modelSrc = DEFAULT_MODEL, models }: AquariumProps) {
  const modelList: number[] = models && models.length > 0 ? models : [modelSrc]

  return (
    <View style={{ flex: 1 }}>
      <Image source={seaImage} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <CanvasScene models={modelList} />
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backTxt}>← Back</Text>
      </Pressable>
    </View>
  )
}

/* ───────────────── styles ───────────────── */
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
