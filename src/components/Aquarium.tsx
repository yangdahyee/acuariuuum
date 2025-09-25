// src/components/Aquarium.tsx
import React, { useEffect, useMemo, useRef, useState } from "react"
import { View, Image, StyleSheet, Pressable, Text } from "react-native"
import { Canvas, useFrame, useThree } from "@react-three/fiber/native"
import { OrbitControls } from "@react-three/drei/native"
import { Asset } from "expo-asset"
import * as THREE from "three"
import { GLTFLoader } from "three-stdlib"

type Props = {
  onBack?: () => void
  seaImage?: any
  modelSrc?: number
}

const DEFAULT_BG = require("../../assets/images/sea.png")
const DEFAULT_MODEL = require("../../assets/models/fish/fish.glb")

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function SwimmingFish({
  source,
  targetScreenHeightRatio = 0.35,
  baseSpeed = 2.0,
  margin = 0.6,
  turnZone = 0.7,
  flipOnTurn = false,
  ampRange = [0.4, 1.1],
  freqRange = [0.5, 1.2],
  retargetEvery = [4, 9],
  initialYawDeg = 90, // ★ 넘패드 3처럼 옆면을 보이도록 기본 90°
}: {
  source: number
  targetScreenHeightRatio?: number
  baseSpeed?: number
  margin?: number
  turnZone?: number
  flipOnTurn?: boolean
  ampRange?: [number, number]
  freqRange?: [number, number]
  retargetEvery?: [number, number]
  initialYawDeg?: number
}) {
  const group = useRef<THREE.Group>(null)
  const [scene, setScene] = useState<THREE.Group | null>(null)

  const baseScale = useRef(1)
  const halfWidthWorld = useRef(0)
  const placed = useRef(false)
  const dirX = useRef<1 | -1>(1)
  const tAccum = useRef(0)

  // 파형 파라미터
  const amp = useRef(0.7)
  const freq = useRef(0.8)
  const phase = useRef(Math.random() * Math.PI * 2)
  const targetAmp = useRef(amp.current)
  const targetFreq = useRef(freq.current)
  const changeTimer = useRef(0)
  const nextChangeIn = useRef(lerp(retargetEvery[0], retargetEvery[1], Math.random()))

  const tmpBox = useMemo(() => new THREE.Box3(), [])
  const tmpV = useMemo(() => new THREE.Vector3(), [])
  const { viewport } = useThree()

  // GLB 로드 & 스케일/경계 계산
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const asset = Asset.fromModule(source)
      await asset.downloadAsync()
      const loader = new GLTFLoader()
      loader.load(
        asset.localUri || asset.uri || "",
        (gltf) => {
          if (!mounted) return
          const obj = gltf.scene as THREE.Group

          tmpBox.setFromObject(obj)
          const size = tmpBox.getSize(tmpV.set(0, 0, 0))
          const center = tmpBox.getCenter(tmpV.set(0, 0, 0))
          obj.position.sub(center)

          const maxDim = Math.max(size.x, size.y, size.z) || 1
          const targetH = viewport.height * targetScreenHeightRatio
          const s = targetH / maxDim
          baseScale.current = s
          halfWidthWorld.current = (size.x * s) / 2

          setScene(obj)
        },
        undefined,
        (err) => console.error("[Aquarium] GLB load error", err)
      )
    })()
    return () => {
      mounted = false
    }
  }, [source, viewport.height, targetScreenHeightRatio])

  // 이동/바운스 + 파형 + 경계 감속
  useFrame((_, delta) => {
    if (!group.current) return

    // 첫 배치
    if (!placed.current) {
      const startX = -viewport.width / 2 + margin + halfWidthWorld.current + 0.01
      group.current.position.set(startX, 0, 0.5)
      group.current.scale.setScalar(baseScale.current)

      // ★ 넘패드 3 방향(우측뷰)로 보이도록 Yaw 적용
      group.current.rotation.set(0, THREE.MathUtils.degToRad(initialYawDeg), 0)

      placed.current = true
    }

    // 파라미터 천천히 변화
    changeTimer.current += delta
    if (changeTimer.current >= nextChangeIn.current) {
      changeTimer.current = 0
      nextChangeIn.current = lerp(retargetEvery[0], retargetEvery[1], Math.random())
      targetAmp.current = lerp(ampRange[0], ampRange[1], Math.random())
      targetFreq.current = lerp(freqRange[0], freqRange[1], Math.random())
    }
    amp.current = lerp(amp.current, targetAmp.current, 1 - Math.pow(0.001, delta))
    freq.current = lerp(freq.current, targetFreq.current, 1 - Math.pow(0.001, delta))

    // 경계 감속
    const halfW = viewport.width / 2 - margin
    const x = group.current.position.x
    const distToEdge = dirX.current === 1 ? halfW - (x + halfWidthWorld.current) : x - halfWidthWorld.current + halfW
    const r = clamp01(distToEdge / Math.max(turnZone, 0.0001))
    const speedFactor = 0.35 + 0.65 * r

    // X 이동(반대방향으로만 전환, 텔레포트 없음)
    group.current.position.x += dirX.current * baseSpeed * speedFactor * delta
    if (distToEdge <= 0) {
      dirX.current = dirX.current === 1 ? -1 : 1
      if (flipOnTurn) {
        const sx = group.current.scale.x
        const sAbs = Math.abs(sx) || baseScale.current
        group.current.scale.x = dirX.current === 1 ? sAbs : -sAbs
      }
    }

    // Y 파형
    tAccum.current += delta
    const yWave = Math.sin(tAccum.current * freq.current * Math.PI * 2 + phase.current) * amp.current
    group.current.position.y = yWave
  })

  return <group ref={group}>{scene && <primitive object={scene} />}</group>
}

export default function Aquarium({ onBack, seaImage = DEFAULT_BG, modelSrc = DEFAULT_MODEL }: Props) {
  return (
    <View style={{ flex: 1 }}>
      <Image source={seaImage} style={StyleSheet.absoluteFill} resizeMode="cover" />

      <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 50, near: 0.1, far: 100 }} dpr={[1, 2]}>
        <ambientLight intensity={0.9} />
        <directionalLight intensity={0.7} position={[3, 5, 4]} />
        <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />

        {/* numpad3(우측뷰)로 보이도록 initialYawDeg=90 */}
        <SwimmingFish
          source={modelSrc}
          baseSpeed={2.1}
          targetScreenHeightRatio={0.35}
          margin={0.7}
          turnZone={0.8}
          flipOnTurn={false}
          initialYawDeg={90} // ← 여기 각도만 바꾸면 원하는 뷰 프리셋 가능
        />
      </Canvas>

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
