// src/components/Aquarium.tsx
import React, { useEffect, useMemo, useRef, useState, memo } from "react"
import { View, Image, StyleSheet, Pressable, Text, TextInput, FlatList } from "react-native"
import { Canvas, useFrame, useThree } from "@react-three/fiber/native"
import { OrbitControls } from "@react-three/drei/native"
import { Asset } from "expo-asset"
import { Group, Box3, Vector3, MathUtils } from "three"
import { GLTFLoader } from "three-stdlib"

type Props = {
  onBack?: () => void
  seaImage?: any
  modelSrc?: number
}

const DEFAULT_BG = require("../../assets/images/sea.png")
const DEFAULT_MODEL = require("../../assets/models/fish/fish_2crown_downsize.glb")

/* ───────────────── Canvas 쪽 ───────────────── */

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function SwimmingFish({
  source,
  targetScreenHeightRatio = 0.22,
  sizeMultiplier = 0.2, // ← 더 작게
  baseSpeed = 5.1,
  margin = 0.7,
  turnZone = 0.8,
  flipOnTurn = true, // ← 방향 전환 시 좌우 뒤집기
  ampRange = [0.1, 0.7],
  freqRange = [0.5, 100.0],
  retargetEvery = [4, 9],
  initialYawDeg = 360, // 우측 보기
  xOffset = 50,
  yOffset = 10,
  zLayer = 30,
  spawnT = 0,
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
  sizeMultiplier?: number
  xOffset?: number
  yOffset?: number
  zLayer?: number
  spawnT?: number
}) {
  const group = useRef<Group>(null)
  const [scene, setScene] = useState<Group | null>(null)

  const baseScale = useRef(1)
  const halfWidthWorld = useRef(0)
  const placed = useRef(false)
  const dirX = useRef<1 | -1>(Math.random() < 0.8 ? 1 : -1) // 시작 방향 랜덤
  const tAccum = useRef(0)

  // 파형 파라미터
  const amp = useRef(0.7)
  const freq = useRef(0.8)
  const phase = useRef(Math.random() * Math.PI * 2)
  const targetAmp = useRef(amp.current)
  const targetFreq = useRef(freq.current)
  const changeTimer = useRef(0)
  const nextChangeIn = useRef(lerp(retargetEvery[0], retargetEvery[1], Math.random()))

  const tmpBox = useMemo(() => new Box3(), [])
  const tmpV = useMemo(() => new Vector3(), [])
  const { viewport } = useThree()

  // GLB 로드 & 스케일/경계 계산
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

          tmpBox.setFromObject(obj)
          const size = tmpBox.getSize(tmpV.set(0, 0, 0))
          const center = tmpBox.getCenter(tmpV.set(0, 0, 0))
          obj.position.sub(center)

          const maxDim = Math.max(size.x, size.y, size.z) || 1
          const targetH = viewport.height * targetScreenHeightRatio
          const s = targetH / maxDim
          baseScale.current = s * sizeMultiplier
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

  useFrame((_, delta) => {
    if (!group.current) return

    // 첫 배치
    if (!placed.current) {
      const left = -viewport.width / 2 + margin + halfWidthWorld.current + 0.01
      const right = viewport.width / 2 - margin - halfWidthWorld.current - 0.01
      const startX = lerp(left, right, clamp01(spawnT)) + xOffset
      group.current.position.set(startX, yOffset, zLayer)
      group.current.scale.setScalar(baseScale.current)
      const yaw = dirX.current === 1 ? initialYawDeg : -initialYawDeg
      group.current.rotation.set(0, MathUtils.degToRad(yaw), 0)
      placed.current = true
    }
    group.current.position.z = zLayer
    // 파라미터 서서히 변화
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

    // X 이동(반대방향으로만 전환)
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
    group.current.position.y = yOffset + yWave
  })

  return <group ref={group}>{scene && <primitive object={scene} />}</group>
}

const CanvasScene = memo(function CanvasScene({ modelSrc }: { modelSrc: number }) {
  return (
    <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 50, near: 0.1, far: 100 }}>
      <ambientLight intensity={0.9} />
      <directionalLight intensity={0.7} position={[3, 5, 4]} />
      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />

      {/* 1번 물고기: 위 레인 */}
      <SwimmingFish
        source={modelSrc}
        sizeMultiplier={0.55}
        xOffset={0.3}
        yOffset={+0.22} // ↑ 위쪽 레인
        zLayer={0.95} // 앞쪽(살짝)
        ampRange={[0.03, 0.06]} // 파형 작게 → 레인 침범 방지
        freqRange={[0.6, 1.0]}
      />

      {/* 2번 물고기: 아래 레인 */}
      <SwimmingFish
        source={require("../../assets/models/fish/fish1_pink.glb")}
        sizeMultiplier={0.5}
        baseSpeed={6.5}
        spawnT={0.15}
        yOffset={-0.22} // ↓ 아래쪽 레인
        zLayer={0.9} // 뒤쪽(살짝)
        ampRange={[0.1, 0.9]} // 파형 작게
        freqRange={[0.1, 1.0]}
        initialYawDeg={-50}
      />

      <SwimmingFish
        source={require("../../assets/models/fish/fish78.glb")}
        sizeMultiplier={0.5}
        baseSpeed={2.6}
        spawnT={0.75}
        yOffset={-0.15} // ↓ 아래쪽 레인
        zLayer={0.95} // 뒤쪽(살짝)
        ampRange={[0.03, 0.96]} // 파형 작게
        freqRange={[0.6, 1.0]}
        initialYawDeg={-90}
      />
    </Canvas>
  )
})

/* ───────────────── TODO 오버레이 ───────────────── */

type Todo = { id: string; text: string; done: boolean }

function TodoOverlay() {
  const [input, setInput] = useState("")
  const [todos, setTodos] = useState<Todo[]>([])

  const addTodo = () => {
    const text = input.trim()
    if (!text) return
    setTodos((prev) => [{ id: String(Date.now()), text, done: false }, ...prev])
    setInput("")
  }
  const toggleTodo = (id: string) => setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  const removeTodo = (id: string) => setTodos((prev) => prev.filter((t) => t.id !== id))

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View style={styles.todoWrap} pointerEvents="auto">
        <Text style={styles.todoTitle}>할 일</Text>
        <View style={styles.inputRow}>
          <TextInput value={input} onChangeText={setInput} placeholder="무엇을 할까요?" placeholderTextColor="#cbd5e1" style={styles.input} onSubmitEditing={addTodo} returnKeyType="done" />
          <Pressable style={styles.addBtn} onPress={addTodo}>
            <Text style={{ color: "#0f172a", fontWeight: "800" }}>추가</Text>
          </Pressable>
        </View>

        <FlatList
          data={todos}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={styles.todoItem}>
              <Pressable onPress={() => toggleTodo(item.id)} style={[styles.checkbox, item.done && styles.checkboxOn]}>
                {item.done && <Text style={{ color: "#0f172a", fontWeight: "900" }}>✓</Text>}
              </Pressable>
              <Text style={[styles.todoText, item.done && styles.todoDone]} numberOfLines={1}>
                {item.text}
              </Text>
              <Pressable onPress={() => removeTodo(item.id)} style={styles.removeBtn}>
                <Text style={{ color: "#fecaca", fontWeight: "900" }}>✕</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>여기에 할 일을 추가하세요</Text>}
          style={{ maxHeight: 220 }}
        />
      </View>
    </View>
  )
}

/* ───────────────── 페이지 조립 ───────────────── */

export default function Aquarium({ onBack, seaImage = DEFAULT_BG, modelSrc = DEFAULT_MODEL }: Props) {
  return (
    <View style={{ flex: 1 }}>
      <Image source={seaImage} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {/* Canvas는 메모된 별도 컴포넌트 → 투두 변화에도 재렌더 최소화 */}
      <CanvasScene modelSrc={modelSrc} />

      {/* 투두 오버레이 */}
      <TodoOverlay />

      {/* 뒤로가기 */}
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

  todoWrap: {
    position: "absolute",
    right: 16,
    top: 60,
    width: 260,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.75)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
  todoTitle: { color: "#e2e8f0", fontSize: 16, fontWeight: "800", marginBottom: 8 },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 },
  input: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(2,6,23,0.6)", color: "#e2e8f0" },
  addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#93c5fd" },
  todoItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#94a3b8", alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: "#86efac", borderColor: "#86efac" },
  todoText: { flex: 1, color: "#e2e8f0" },
  todoDone: { textDecorationLine: "line-through", color: "#94a3b8" },
  removeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  emptyText: { color: "#94a3b8", textAlign: "center", paddingVertical: 6 },
})
