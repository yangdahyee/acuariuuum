// src/components/Aquarium.tsx
import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { View, SafeAreaView, Image, StyleSheet, Pressable, Text, FlatList, TextInput, Platform } from "react-native"
import { Canvas, useFrame, useThree } from "@react-three/fiber/native"
import { Asset } from "expo-asset"
import * as THREE from "three"
import { GLTFLoader } from "three-stdlib"
import { Ionicons } from "@expo/vector-icons"

type Props = {
  onBack?: () => void
  seaImage?: any
  modelSrc?: number // glb
}

const SEA_BG = require("../../assets/images/sea.png")
const FISH_GLB = require("../../assets/models/fish/fish.glb")

/* ─────────────────── 3D 부분: 배경 물고기 ─────────────────── */

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function SwimmingFish({
  source,
  heightRatio = 0.3, // 화면 높이 대비 물고기 목표 높이
  baseSpeed = 1.8,
  margin = 0.6,
  bounceEaseWidth = 0.9, // 가장자리 감속 구간
  initialYawDeg = 90, // 옆면 보이도록(넘패드 3 느낌)
  seed = 0,
}: {
  source: number
  heightRatio?: number
  baseSpeed?: number
  margin?: number
  bounceEaseWidth?: number
  initialYawDeg?: number
  seed?: number
}) {
  const root = useRef<THREE.Group>(null)
  const [scene, setScene] = useState<THREE.Group | null>(null)
  const baseScale = useRef(1)
  const halfWidthWorld = useRef(0)
  const placed = useRef(false)
  const dirX = useRef<1 | -1>(Math.random() > 0.5 ? 1 : -1)
  const t = useRef(0)

  // 파도 파라미터(개체별 고유값)
  const rand = (min: number, max: number) => min + (max - min) * Math.abs(Math.sin(seed * 999 + 0.123))
  const amp = useRef(rand(0.35, 0.9))
  const freq = useRef(rand(0.6, 1.2))
  const phase = useRef(rand(0, Math.PI * 2))

  const box = useMemo(() => new THREE.Box3(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const { viewport } = useThree()

  // GLB 로드 + 스케일 계산
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
          box.setFromObject(obj)
          const size = box.getSize(v.set(0, 0, 0))
          const center = box.getCenter(v.set(0, 0, 0))
          obj.position.sub(center)

          const maxDim = Math.max(size.x, size.y, size.z) || 1
          const targetH = viewport.height * heightRatio
          const s = targetH / maxDim
          baseScale.current = s
          halfWidthWorld.current = (size.x * s) / 2

          setScene(obj)
        },
        undefined,
        (e) => console.error("[Aquarium] GLB load error", e)
      )
    })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, viewport.height])

  useFrame((_, dt) => {
    if (!root.current) return

    // 초기 배치(왼/오 랜덤 출발)
    if (!placed.current) {
      const startEdge = dirX.current === 1 ? -1 : 1
      const startX = startEdge * (viewport.width / 2 - margin - halfWidthWorld.current - 0.02)
      root.current.position.set(startX, 0, 0.5)
      root.current.scale.setScalar(baseScale.current)
      root.current.rotation.set(0, THREE.MathUtils.degToRad(initialYawDeg), 0)
      placed.current = true
    }

    // 가장자리 감속(자연스러운 반전)
    const halfW = viewport.width / 2 - margin
    const x = root.current.position.x
    const dist = dirX.current === 1 ? halfW - (x + halfWidthWorld.current) : x - halfWidthWorld.current + halfW
    const ease = clamp01(dist / bounceEaseWidth)

    // 이동
    root.current.position.x += dirX.current * baseSpeed * (0.35 + 0.65 * ease) * dt
    if (dist <= 0) {
      dirX.current = dirX.current === 1 ? -1 : 1
      // 좌우 반전(그림자/노말 깨짐 방지: scale.x만 반전)
      const sx = root.current.scale.x
      root.current.scale.x = dirX.current === 1 ? Math.abs(sx) : -Math.abs(sx)
    }

    // 상하 파동
    t.current += dt
    root.current.position.y = Math.sin(t.current * freq.current * Math.PI * 2 + phase.current) * amp.current
  })

  return <group ref={root}>{scene && <primitive object={scene} />}</group>
}

const FloatingFishesBg = memo(function FloatingFishesBg({ modelSrc, count = 4 }: { modelSrc: number; count?: number }) {
  // 개체별 시드 고정
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => i * 0.37 + Math.random()), [count])
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 50, near: 0.1, far: 100 }} dpr={[1, 2]}>
        <ambientLight intensity={0.95} />
        <directionalLight position={[3, 5, 4]} intensity={0.65} />
        {seeds.map((s, i) => (
          <SwimmingFish key={i} source={modelSrc} seed={s} heightRatio={0.26 + (i % 3) * 0.04} baseSpeed={1.6 + (i % 4) * 0.25} initialYawDeg={90} />
        ))}
      </Canvas>
    </View>
  )
})

/* ─────────────────── UI: 카드/헤더/탭/FAB ─────────────────── */

type Task = {
  id: string
  title: string
  desc: string
  chips: { label: string; tone: "green" | "orange" | "blue" }[]
  done?: boolean
  reward?: string
}

const demoTasks: Task[] = [
  {
    id: "1",
    title: "20시 회의",
    desc: "일찍 일어나서 꼭 공부하자 정말?? 진짜??",
    chips: [
      { label: "어려움", tone: "orange" },
      { label: "생활", tone: "blue" },
    ],
  },
  {
    id: "2",
    title: "20시 회의를 해야하는...",
    desc: "일찍 일어나서 꼭 공부하자",
    chips: [
      { label: "쉬움", tone: "green" },
      { label: "생활", tone: "blue" },
    ],
  },
  {
    id: "3",
    title: "20시 회의를 해야하는...",
    desc: "일찍 일어나서 꼭 공부하자",
    chips: [
      { label: "쉬움", tone: "green" },
      { label: "생활", tone: "blue" },
    ],
    done: true,
    reward: "50P",
  },
]

function Chip({ label, tone }: { label: string; tone: "green" | "orange" | "blue" }) {
  const bg = tone === "green" ? "#22c55e33" : tone === "orange" ? "#f9731633" : "#60a5fa33"
  const fg = tone === "green" ? "#16a34a" : tone === "orange" ? "#ea580c" : "#3b82f6"
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </View>
  )
}

function TaskCard({ item }: { item: Task }) {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.link}>자세히 보기</Text>
      </View>
      <Text style={styles.cardDesc} numberOfLines={1}>
        {item.desc}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
        {item.chips.map((c, i) => (
          <Chip key={i} {...c} />
        ))}
        <View style={{ flex: 1 }} />
        {item.done ? (
          <View style={[styles.actionPill, { backgroundColor: "#475569" }]}>
            <Text style={{ color: "#e2e8f0", fontWeight: "800" }}>완료 {item.reward}</Text>
          </View>
        ) : (
          <View style={[styles.actionPill, { backgroundColor: "#2dd4bf" }]}>
            <Text style={{ color: "#0f172a", fontWeight: "800" }}>완료하기</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function TodayHeader() {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()
  return (
    <View style={{ gap: 14, marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Pressable style={styles.smallPill}>
          <Text style={{ color: "#e2e8f0", fontWeight: "800" }}>여행 보기</Text>
        </Pressable>
      </View>
      <Text style={styles.todaySmall}>TODAY</Text>
      <Text style={styles.todayBig}>
        {month}월 {day}일
      </Text>

      <View style={styles.banner}>
        <Text style={{ color: "#0f172a", fontWeight: "900" }}>오늘의 TO DO LIST</Text>
        <Pressable style={styles.bannerBtn}>
          <Text style={{ color: "#083344", fontWeight: "900" }}>자세히 보기 ›</Text>
        </Pressable>
      </View>
    </View>
  )
}

function BottomTabs() {
  const Item = ({ name, label }: { name: any; label: string }) => (
    <View style={styles.tabItem}>
      <Ionicons name={name} size={22} color="#0ea5e9" />
      <Text style={styles.tabLabel}>{label}</Text>
    </View>
  )
  return (
    <View style={styles.tabs}>
      <Item name="home-outline" label="홈" />
      <Item name="checkbox-outline" label="투두" />
      <Item name="fish-outline" label="꾸미기" />
      <Item name="person-outline" label="마이 페이지" />
    </View>
  )
}

/* ─────────────────── 최종 화면 ─────────────────── */

export default function Aquarium({ onBack, seaImage = SEA_BG, modelSrc = FISH_GLB }: Props) {
  return (
    <View style={{ flex: 1 }}>
      {/* 1) 배경 이미지 */}
      <Image source={seaImage} style={StyleSheet.absoluteFillObject} resizeMode="cover" />

      {/* 2) 3D 물고기 배경 */}
      <FloatingFishesBg modelSrc={modelSrc} count={4} />

      {/* 3) 콘텐츠 오버레이 */}
      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        <View style={styles.content}>
          <TodayHeader />

          <FlatList
            data={demoTasks}
            keyExtractor={(t) => t.id}
            renderItem={({ item }) => <TaskCard item={item} />}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* 뒤로가기(필요하면) */}
        {onBack && (
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>← Back</Text>
          </Pressable>
        )}

        {/* 4) FAB */}
        <Pressable style={styles.fab}>
          <Ionicons name="add" size={28} color="#0f172a" />
        </Pressable>

        {/* 5) 하단 탭 */}
        <BottomTabs />
      </SafeAreaView>
    </View>
  )
}

/* ─────────────────── 스타일 ─────────────────── */

const styles = StyleSheet.create({
  safe: { ...StyleSheet.absoluteFillObject },
  content: { flex: 1, paddingHorizontal: 18, paddingTop: 8 },

  smallPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(2,6,23,0.35)",
  },
  todaySmall: { color: "#334155", fontWeight: "900", letterSpacing: 1, fontSize: 12 },
  todayBig: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 34,
  },

  banner: {
    marginTop: 8,
    backgroundColor: "#99f6e4",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  bannerBtn: {
    backgroundColor: "#67e8f9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 4 },
    }),
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", flex: 1, paddingRight: 10 },
  link: { color: "#64748b", fontWeight: "700" },
  cardDesc: { color: "#475569", marginTop: 6 },

  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 6 },
  actionPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },

  fab: {
    position: "absolute",
    right: 18,
    bottom: 86,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#67e8f9",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
    }),
  },

  tabs: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
    height: 58,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 4 },
    }),
  },
  tabItem: { alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 12, color: "#0ea5e9", marginTop: 2, fontWeight: "700" },

  backBtn: {
    position: "absolute",
    top: 18,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
})
