// src/components/GLBAnimatedFish.tsx
import React, { useEffect, useMemo, useRef, useState } from "react"
import { Asset } from "expo-asset"
import { useFrame, useThree } from "@react-three/fiber/native"
import {
  Group, Box3, Vector3, MathUtils,
  AnimationMixer, AnimationClip, LoopRepeat, Object3D
} from "three"
import { GLTFLoader } from "three-stdlib"

type Props = {
  source: number;              // require(".../model.glb")
  animName?: string;           // 재생할 클립 이름(없으면 첫 클립)
  animSpeed?: number;          // 재생 속도
  fadeSeconds?: number;        // 페이드 인 시간
  // 이동/연출
  speed?: number;              // 좌우 속도
  margin?: number;
  startSide?: "left" | "right" | "middle";
  yFrac?: number;              // -1(아래) ~ +1(위)
  zLayer?: number;
  initialYawDeg?: number;
  flipOnTurn?: boolean;        // true면 X스케일 반전, false면 회전만
  faceTurn?: boolean;          // 방향 전환 시 회전 타겟 변경
  turnSeconds?: number;        // 회전 스무딩 시간
  targetScreenHeightRatio?: number; // 화면 높이에 대한 목표 비율
  sizeMultiplier?: number;
  // (선택) 코드로 특정 본을 더 흔들고 싶다면
  extraTailWave?: boolean;
  tailBoneName?: string;       // 예: "Tail"
  tailAmp?: number;            // 라디안
  tailHz?: number;             // 헤르츠
}

export default function GLBAnimatedFish({
  source,
  animName = undefined,
  animSpeed = 1.0,
  fadeSeconds = 0.1,
  speed = 2.0,
  margin = 0.7,
  startSide = "left",
  yFrac = 0,
  zLayer = 0.5,
  initialYawDeg = 90,
  flipOnTurn = false,     // 스킨드 메시 안전 기본값
  faceTurn = true,
  turnSeconds = 0.25,
  targetScreenHeightRatio = 0.22,
  sizeMultiplier = 0.28,
  extraTailWave = false,
  tailBoneName = "Tail",
  tailAmp = 0.2,
  tailHz = 2.0,
}: Props) {
  const group = useRef<Group>(null)
  const [model, setModel] = useState<Group | null>(null)
  const mixerRef = useRef<AnimationMixer | null>(null)
  const actionRef = useRef<ReturnType<AnimationMixer["clipAction"]> | null>(null)

  const baseScale = useRef(1)
  const halfWidthWorld = useRef(0)
  const placed = useRef(false)
  const dirX = useRef<1 | -1>(1)
  const targetYaw = useRef(0)
  const bobT = useRef(0)

  const tmpBox = useMemo(() => new Box3(), [])
  const tmpV = useMemo(() => new Vector3(), [])
  const { viewport } = useThree()

  // (선택) 꼬리 본 참조
  const tailRef = useRef<Object3D | null>(null)

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

          // 중앙 정렬 + 스케일 정규화(Ortho 기준)
          const box = tmpBox.setFromObject(obj)
          const size = box.getSize(tmpV.set(0,0,0))
          const center = box.getCenter(tmpV.set(0,0,0))
          obj.position.sub(center)

          const maxDim = Math.max(size.x, size.y, size.z) || 1
          const targetH = viewport.height * targetScreenHeightRatio
          const s = (targetH / maxDim) * sizeMultiplier
          baseScale.current = s
          halfWidthWorld.current = (size.x * s) / 2

          setModel(obj)

          // 본 이름으로 찾아두기(옵션)
          if (extraTailWave && tailBoneName) {
            const found = obj.getObjectByName(tailBoneName)
            tailRef.current = found || null
          }

          // 애니 재생
          if (gltf.animations && gltf.animations.length > 0) {
            const clip =
              (animName && AnimationClip.findByName(gltf.animations, animName)) ||
              gltf.animations[0]
            if (clip) {
              const mixer = new AnimationMixer(obj)
              mixerRef.current = mixer
              const action = mixer.clipAction(clip, obj)
              actionRef.current = action
              action.setLoop(LoopRepeat, Infinity)
              action.timeScale = animSpeed
              action.fadeIn(fadeSeconds).play()
            }
          } else {
            mixerRef.current = null
            actionRef.current = null
          }
        },
        undefined,
        (err) => console.error("[GLBAnimatedFish] load error", err)
      )
    })()

    return () => {
      mounted = false
      // 정리
      actionRef.current?.stop()
      mixerRef.current?.stopAllAction()
      mixerRef.current = null
      actionRef.current = null
    }
  }, [
    source, viewport.height, targetScreenHeightRatio, sizeMultiplier,
    animName, animSpeed, fadeSeconds, extraTailWave, tailBoneName
  ])

  useFrame((_, delta) => {
    // 애니 업데이트
    mixerRef.current?.update(delta)
    const g = group.current
    if (!g) return

    // lane Y
    const halfH = viewport.height / 2
    const laneY = halfH * MathUtils.clamp(yFrac, -1, 1)

    // 최초 배치
    if (!placed.current) {
      const left = -viewport.width / 2 + margin + halfWidthWorld.current + 0.01
      const right = viewport.width / 2 - margin - halfWidthWorld.current - 0.01
      let startX = 0
      if (startSide === "left") {
        startX = left; dirX.current = 1
      } else if (startSide === "right") {
        startX = right; dirX.current = -1
      } else {
        startX = MathUtils.lerp(left, right, 0.5); dirX.current = 1
      }
      g.position.set(startX, laneY, zLayer)
      g.scale.setScalar(baseScale.current)

      const yawDeg = dirX.current === 1 ? initialYawDeg : -initialYawDeg
      const yawRad = MathUtils.degToRad(yawDeg)
      g.rotation.set(0, yawRad, 0)
      targetYaw.current = yawRad
      placed.current = true
    }

    // 좌우 이동 + 경계 체크
    const leftB  = -viewport.width / 2 + margin + halfWidthWorld.current
    const rightB =  viewport.width / 2 - margin - halfWidthWorld.current

    g.position.x += dirX.current * speed * delta
    const hitLeft  = g.position.x <= leftB
    const hitRight = g.position.x >= rightB

    if (hitLeft || hitRight) {
      g.position.x = MathUtils.clamp(g.position.x, leftB, rightB)
      dirX.current = hitLeft ? 1 : -1

      if (flipOnTurn) {
        const s = Math.abs(g.scale.x) || baseScale.current
        g.scale.x = dirX.current === 1 ? s : -s
      }
      if (faceTurn) {
        const deg = dirX.current === 1 ? initialYawDeg : -initialYawDeg
        targetYaw.current = MathUtils.degToRad(deg)
      }
    }

    // 회전 스무딩
    if (faceTurn) {
      const k = 1 - Math.pow(0.001, delta / Math.max(0.0001, turnSeconds))
      g.rotation.y = lerpAngle(g.rotation.y, targetYaw.current, k)
    }

    // (옵션) 꼬리 본 추가 웨이브
    if (extraTailWave && tailRef.current) {
      bobT.current += delta
      // 기본 애니 위에 "아주 조금" 더해주기(겹침 방지 위해 소량)
      const add = Math.sin(bobT.current * tailHz * Math.PI * 2) * tailAmp
      // 회전 누적 대신 "offset"처럼 쓰려면, 원래 로컬 회전 값을 저장해서 더하는 구조가 좋습니다.
      ;(tailRef.current as any).rotation.y += add * delta * 10
    }

    // Y 위치 고정
    g.position.y = laneY
    g.position.z = zLayer
  })

  return <group ref={group}>{model && <primitive object={model} />}</group>
}

// 유틸: 각도 보간(래핑 고려)
function lerpAngle(a: number, b: number, t: number) {
  let diff = MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI
  return a + diff * t
}
