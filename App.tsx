// App.tsx
import { StatusBar } from "expo-status-bar"
import React, { useState } from "react"
import { View, Text, Pressable, Image, StyleSheet, FlatList, Platform } from "react-native"
import Aquarium from "./src/components/Aquarium"

const SEA_BG = require("./assets/images/sea.png")

// 바둑판용 더미 데이터
const FISHES = Array.from({ length: 6 }, (_, i) => ({
  id: `fish${i + 1}`,
  name: "멸치",
  model: require("./assets/models/fish/fish78.glb"),
  emoji: "🐟",
  accent: ["#22d3ee", "#60a5fa", "#f472b6", "#34d399", "#f59e0b", "#a78bfa"][i % 6],
}))

export default function App() {
  const [selected, setSelected] = useState<(typeof FISHES)[0] | null>(null)

  if (selected) {
    return <Aquarium modelSrc={selected.model} seaImage={SEA_BG} onBack={() => setSelected(null)} />
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
        <Text style={styles.subtitle}>그리드에서 ‘멸치’를 탭하면 시작합니다.</Text>
      </View>

      {/* 바둑판 리스트 */}
      <FlatList
        data={FISHES}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelected(item)}
            android_ripple={{ color: "rgba(255,255,255,0.08)" }}
            style={({ pressed }) => [styles.tile, { borderColor: item.accent }, pressed && styles.tilePressed]}
          >
            {/* 아이콘/일러스트 자리 */}
            <View style={[styles.thumb, { backgroundColor: item.accent + "22" }]}>
              <Text style={styles.thumbEmoji}>{item.emoji}</Text>
            </View>

            {/* 이름 배지: ‘멸치’ */}
            <View style={[styles.badge, { backgroundColor: item.accent }]}>
              <Text style={styles.badgeText}>{item.name}</Text>
            </View>
          </Pressable>
        )}
      />

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

  gridContent: { paddingHorizontal: 12, paddingBottom: 24, paddingTop: 4 },
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
  thumb: { width: "70%", aspectRatio: 1, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  thumbEmoji: { fontSize: 48 },
  badge: { position: "absolute", bottom: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: "#0b1220", fontWeight: "800", letterSpacing: 0.2 },
})
