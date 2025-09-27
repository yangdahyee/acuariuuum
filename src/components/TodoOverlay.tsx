// src/components/TodoOverlay.tsx
import React, { useState } from "react"
import { View, Text, TextInput, Pressable, StyleSheet, FlatList } from "react-native"

export type Todo = { id: string; text: string; done: boolean }

type Props = {
  initial?: Todo[]
  onChange?: (todos: Todo[]) => void
}

export default function TodoOverlay({ initial = [], onChange }: Props) {
  const [input, setInput] = useState("")
  const [todos, setTodos] = useState<Todo[]>(initial)

  const commit = (next: Todo[]) => {
    setTodos(next)
    onChange?.(next)
  }

  const add = () => {
    const text = input.trim()
    if (!text) return
    commit([{ id: String(Date.now()), text, done: false }, ...todos])
    setInput("")
  }
  const toggle = (id: string) => commit(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  const remove = (id: string) => commit(todos.filter((t) => t.id !== id))

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="auto" style={styles.panel}>
        <Text style={styles.title}>할 일</Text>

        <View style={styles.row}>
          <TextInput value={input} onChangeText={setInput} placeholder="무엇을 할까요?" placeholderTextColor="#cbd5e1" style={styles.input} onSubmitEditing={add} returnKeyType="done" />
          <Pressable onPress={add} style={styles.addBtn}>
            <Text style={{ color: "#0f172a", fontWeight: "800" }}>추가</Text>
          </Pressable>
        </View>

        <FlatList
          data={todos}
          keyExtractor={(i) => i.id}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 220 }}
          ListEmptyComponent={<Text style={styles.empty}>여기에 할 일을 추가하세요</Text>}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Pressable onPress={() => toggle(item.id)} style={[styles.checkbox, item.done && styles.checkboxOn]}>
                {item.done && <Text style={{ color: "#0f172a", fontWeight: "900" }}>✓</Text>}
              </Pressable>
              <Text style={[styles.text, item.done && styles.done]} numberOfLines={1}>
                {item.text}
              </Text>
              <Pressable onPress={() => remove(item.id)} style={styles.remove}>
                <Text style={{ color: "#fecaca", fontWeight: "900" }}>✕</Text>
              </Pressable>
            </View>
          )}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    right: 16,
    top: 60,
    width: 260,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.78)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
  title: { color: "#e2e8f0", fontSize: 16, fontWeight: "800", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(2,6,23,0.6)",
    color: "#e2e8f0",
  },
  addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#93c5fd" },
  item: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#86efac", borderColor: "#86efac" },
  text: { flex: 1, color: "#e2e8f0" },
  done: { textDecorationLine: "line-through", color: "#94a3b8" },
  remove: { paddingHorizontal: 8, paddingVertical: 4 },
  empty: { color: "#94a3b8", textAlign: "center", paddingVertical: 6 },
})
