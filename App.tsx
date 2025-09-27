// App.tsx
import { StatusBar } from "expo-status-bar"
import React, { useMemo, useState } from "react"
import { View, Text, Pressable, Image, StyleSheet, FlatList, Platform } from "react-native"
import Aquarium from "./src/components/Aquarium"

const SEA_BG = require("./assets/images/sea.png")

// 물고기 카탈로그: 앞 3개만 언락, 나머진 잠금(회색/비활성)
const CATALOG = [
  {
    id: "anchovy-1",
    name: "크라운피쉬",
    emoji: "🐟",
    model: require("./assets/models/fish/fish_2crown_downsize.glb"),
    unlocked: true,
    accent: "#22d3ee",
  },
  {
    id: "anchovy-2",
    name: "프린세스피쉬",
    emoji: "🐟",
    model: require("./assets/models/fish/action_finish_fish1_pink.glb"),
    unlocked: true,
    accent: "#60a5fa",
  },
  {
    id: "anchovy-3",
    name: "대왕피쉬",
    emoji: "🐟",
    model: require("./assets/models/fish/fish78.glb"),
    unlocked: true,
    accent: "#34d399",
  },
  // 미발견(잠금) 예시들 — 클릭 불가 + 회색 처리
  { id: "unk-1", name: "멸치피쉬", emoji: "❔", model: null, unlocked: false, accent: "#94a3b8" },
  { id: "unk-2", name: "복어피쉬", emoji: "❔", model: null, unlocked: false, accent: "#94a3b8" },
  { id: "unk-3", name: "큐트피쉬", emoji: "❔", model: null, unlocked: false, accent: "#94a3b8" },
]

export default function App() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [goAquarium, setGoAquarium] = useState(false)

  const selectedModels = useMemo(() => CATALOG.filter((c) => c.unlocked && selectedIds.includes(c.id)).map((c) => c.model as number), [selectedIds])

  if (goAquarium) {
    // 선택한 수만큼 띄움 (models 배열로 전달)
    return (
      <Aquarium
        models={selectedModels.length ? selectedModels : [require("./assets/models/fish/fish_2crown_downsize.glb")]}
        seaImage={SEA_BG}
        onBack={() => {
          setGoAquarium(false)
        }}
      />
    )
  }

  return (
    <View style={styles.container}>
      {/* 배경 + 스크림 */}
      <Image source={SEA_BG} style={styles.bg} resizeMode="cover" />
      <View style={styles.scrim} />

      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.kicker}>Aquarium</Text>
        <Text style={styles.title}>헤엄칠 물고기를 고르세요</Text>
        <Text style={styles.subtitle}>발견한 멸치 3마리 중 원하는 만큼 선택하세요.</Text>
        <Text style={styles.subtitle}>
          선택: <Text style={{ fontWeight: "800", color: "#e2e8f0" }}>{selectedIds.length}</Text> 마리
        </Text>
      </View>

      {/* 바둑판 리스트 */}
      <FlatList
        data={CATALOG}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item.id)
          const locked = !item.unlocked

          return (
            <Pressable
              disabled={locked}
              onPress={() => {
                setSelectedIds((prev) => (selected ? prev.filter((id) => id !== item.id) : [...prev, item.id]))
              }}
              android_ripple={!locked ? { color: "rgba(255,255,255,0.08)" } : undefined}
              style={({ pressed }) => [styles.tile, { borderColor: item.accent }, pressed && !locked && styles.tilePressed, locked && styles.tileLocked, selected && styles.tileSelected]}
            >
              {/* 잠금 오버레이 */}
              {locked && (
                <View style={styles.lockOverlay}>
                  <Text style={styles.lockIcon}>🔒</Text>
                  <Text style={styles.lockText}>미발견</Text>
                </View>
              )}

              {/* 아이콘/일러스트 자리 */}
              <View style={[styles.thumb, { backgroundColor: item.accent + "22" }, locked && { backgroundColor: "rgba(148,163,184,0.18)" }]}>
                <Text style={[styles.thumbEmoji, locked && { opacity: 0.45 }]}>{item.emoji}</Text>
              </View>

              {/* 이름/배지 */}
              <View style={[styles.badge, { backgroundColor: item.accent }, locked && { backgroundColor: "rgba(148,163,184,0.6)" }]}>
                <Text style={styles.badgeText}>{item.name}</Text>
              </View>

              {/* 선택 체크 인디케이터 */}
              {selected && <Text style={styles.checkMark}>✓</Text>}
            </Pressable>
          )
        }}
      />

      {/* 하단 ‘입수’ 버튼 */}
      <View style={styles.footer}>
        <Pressable onPress={() => setGoAquarium(true)} disabled={selectedIds.length === 0} style={[styles.goBtn, selectedIds.length === 0 && { opacity: 0.5 }]}>
          <Text style={styles.goBtnText}>바다로 풍덩</Text>
        </Pressable>
      </View>

      <StatusBar style="light" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#06121e" },
  bg: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },

  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 8 },
  kicker: { color: "#a5f3fc", fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", fontSize: 12 },
  title: { marginTop: 6, fontSize: 26, fontWeight: "800", color: "white" },
  subtitle: { marginTop: 6, color: "rgba(255,255,255,0.9)" },

  gridContent: { paddingHorizontal: 12, paddingBottom: 96, paddingTop: 4 },
  columns: { justifyContent: "space-between" },

  tile: {
    width: "48%",
    aspectRatio: 1.05,
    marginVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 3,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 5 },
    }),
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tilePressed: { transform: [{ translateY: 1 }], opacity: 0.96 },
  tileLocked: { opacity: 0.55 },
  tileSelected: { borderColor: "#a7f3d0", backgroundColor: "rgba(16,185,129,0.08)" },

  thumb: { width: "70%", aspectRatio: 1, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  thumbEmoji: { fontSize: 48 },

  badge: { position: "absolute", bottom: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: "#0b1220", fontWeight: "800", letterSpacing: 0.2 },

  checkMark: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#10b981",
    color: "#052e2b",
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },

  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  lockIcon: { fontSize: 28, marginBottom: 6, color: "#e5e7eb" },
  lockText: { color: "#e5e7eb", fontWeight: "700" },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "rgba(2,6,23,0.55)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  goBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#10b981",
  },
  goBtnText: { color: "#052e2b", fontWeight: "900", letterSpacing: 0.2, fontSize: 16 },
})
