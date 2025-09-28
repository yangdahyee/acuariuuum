// src/screens/DecorScreen.tsx
import React, { useMemo, useRef, useState } from "react"
import { View, Image, StyleSheet, Pressable, Text, PanResponder, LayoutChangeEvent } from "react-native"

export type DecorItem = {
  id: string
  emoji: string
  xPct: number // 0..1 (컨테이너 가로 비율)
  yPct: number // 0..1 (컨테이너 세로 비율)
  size: number // 폰트 크기(px)
}

export default function DecorScreen({ onBack, background }: { onBack: () => void; background: any }) {
  const palette = useMemo(() => ["🐚", "🪸", "🐟", "🐠", "🪼", "🌊", "⭐️"], [])
  const [items, setItems] = useState<DecorItem[]>([])
  const [selectedEmoji, setSelectedEmoji] = useState<string>(palette[0])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 캔버스 사이즈(비율 좌표 변환용)
  const sizeRef = useRef({ w: 1, h: 1 })
  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    sizeRef.current = { w: width, h: height }
  }

  // 캔버스 탭 → 아이템 추가
  const handleCanvasPress = (e: any) => {
    const { locationX, locationY } = e.nativeEvent
    const { w, h } = sizeRef.current
    const xPct = Math.min(1, Math.max(0, locationX / w))
    const yPct = Math.min(1, Math.max(0, locationY / h))
    const id = Math.random().toString(36).slice(2)
    setItems((prev) => [...prev, { id, emoji: selectedEmoji, xPct, yPct, size: 36 }])
    setSelectedId(id)
  }

  return (
    <View style={{ flex: 1 }}>
      {/* 배경 */}
      <Image source={background} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {/* 상단 바 */}
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={[styles.chip, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
          <Text style={styles.chipTxt}>← 뒤로</Text>
        </Pressable>
        <Text style={styles.title}>바다 꾸미기</Text>
      </View>

      {/* 팔레트 */}
      <View style={styles.palette}>
        {palette.map((em) => (
          <Pressable key={em} onPress={() => setSelectedEmoji(em)} style={[styles.pill, selectedEmoji === em && styles.pillActive]}>
            <Text style={styles.pillTxt}>{em}</Text>
          </Pressable>
        ))}
      </View>

      {/* 캔버스(터치로 추가) */}
      <View style={styles.canvas} onLayout={onCanvasLayout} onStartShouldSetResponder={() => true} onResponderRelease={handleCanvasPress}>
        {/* 배치된 아이템들 */}
        {items.map((it) => (
          <DraggableEmoji
            key={it.id}
            item={it}
            selected={it.id === selectedId}
            onSelect={() => setSelectedId(it.id)}
            onMove={(xPct, yPct) => {
              setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, xPct, yPct } : p)))
            }}
            onResize={(dir) => {
              setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, size: Math.min(120, Math.max(18, dir === "inc" ? p.size + 4 : p.size - 4)) } : p)))
            }}
            sizeRef={sizeRef}
          />
        ))}
      </View>

      {/* 하단 바(선택 삭제/크기 조절) */}
      <View style={styles.bottomBar}>
        <Pressable
          disabled={!selectedId}
          onPress={() => {
            if (!selectedId) return
            setItems((prev) => prev.filter((p) => p.id !== selectedId))
            setSelectedId(null)
          }}
          style={[styles.btn, !selectedId && styles.disabled]}
        >
          <Text style={styles.btnTxt}>선택 삭제</Text>
        </Pressable>
        <Pressable
          disabled={!selectedId}
          onPress={() => {
            const id = selectedId!
            setItems((prev) => prev.map((p) => (p.id === id ? { ...p, size: Math.max(18, p.size - 4) } : p)))
          }}
          style={[styles.btn, !selectedId && styles.disabled]}
        >
          <Text style={styles.btnTxt}>작게</Text>
        </Pressable>
        <Pressable
          disabled={!selectedId}
          onPress={() => {
            const id = selectedId!
            setItems((prev) => prev.map((p) => (p.id === id ? { ...p, size: Math.min(120, p.size + 4) } : p)))
          }}
          style={[styles.btn, !selectedId && styles.disabled]}
        >
          <Text style={styles.btnTxt}>크게</Text>
        </Pressable>
      </View>
    </View>
  )
}

/* 개별 이모지 드래그 */
function DraggableEmoji({
  item,
  selected,
  onSelect,
  onMove,
  onResize,
  sizeRef,
}: {
  item: DecorItem
  selected: boolean
  onSelect: () => void
  onMove: (xPct: number, yPct: number) => void
  onResize: (dir: "inc" | "dec") => void
  sizeRef: React.MutableRefObject<{ w: number; h: number }>
}) {
  const posRef = useRef({ xPct: item.xPct, yPct: item.yPct })
  posRef.current = { xPct: item.xPct, yPct: item.yPct }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => onSelect(),
      onPanResponderMove: (_, g) => {
        const { w, h } = sizeRef.current
        const dxPct = g.dx / w
        const dyPct = g.dy / h
        const nx = Math.min(1, Math.max(0, posRef.current.xPct + dxPct))
        const ny = Math.min(1, Math.max(0, posRef.current.yPct + dyPct))
        onMove(nx, ny)
      },
    })
  ).current

  const { w, h } = sizeRef.current
  const left = item.xPct * w
  const top = item.yPct * h

  return (
    <View {...pan.panHandlers} style={[styles.emojiWrap, { left, top, transform: [{ translateX: -item.size / 2 }, { translateY: -item.size / 2 }] }]}>
      <Pressable onPress={onSelect} style={[styles.emojiBtn, selected && styles.emojiSelected]}>
        <Text style={{ fontSize: item.size }}>{item.emoji}</Text>
      </Pressable>
    </View>
  )
}

/* styles */
const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    top: 24,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 10,
  },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  chipTxt: { color: "#fff", fontWeight: "800" },
  title: { color: "#fff", fontWeight: "900", fontSize: 18, marginLeft: 8 },

  palette: {
    position: "absolute",
    top: 70,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.45)" },
  pillActive: { backgroundColor: "rgba(16,185,129,0.9)" },
  pillTxt: { fontSize: 18, color: "#fff" },

  canvas: { flex: 1 },
  emojiWrap: { position: "absolute" },
  emojiBtn: { padding: 4, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.0)" },
  emojiSelected: { backgroundColor: "rgba(255,209,102,0.22)" },

  bottomBar: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    gap: 10,
  },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center" },
  btnTxt: { color: "#fff", fontWeight: "800" },
  disabled: { opacity: 0.45 },
})
