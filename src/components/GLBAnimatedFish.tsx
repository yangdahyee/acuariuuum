// src/components/GLBAnimatedFish.tsx
import React, { useEffect, useMemo, useRef, useState } from "react"
import { Asset } from "expo-asset"
import { useFrame, useThree } from "@react-three/fiber/native"
import { Group, Box3, Vector3, MathUtils, AnimationMixer, AnimationClip, LoopRepeat, Object3D, Material, MeshStandardMaterial, Color } from "three"
import { GLTFLoader } from "three-stdlib"

type Props = {
  id?: string // 디버그 식별자 (로그용)
  source: number // require(".../model.glb")
  animName?: string // 기본 재생 클립 (없으면 첫 클립)
  animSpeed?: number // 기본 재생 속도
  fadeSeconds?: number // 페이드 인 시간
  phaseOffsetSec?: number // 시작 시 애니 타임 오프셋(개체 변주)
  // 이동/연출
  speed?: number // 좌우 속도
  speedJitterPct?: number // 속도 지터(예: 0.15 => ±15%)
  margin?: number
  startSide?: "left" | "right" | "middle"
  yFrac?: number // -1(아래) ~ +1(위)
  zLayer?: number
  initialYawDeg?: number
  flipOnTurn?: boolean // true면 X스케일 반전, false면 회전만
  faceTurn?: boolean // 방향 전환 시 회전 타겟 변경
  turnSeconds?: number // 회전 스무딩 시간
  targetScreenHeightRatio?: number // 화면 높이 대비 목표 비율
  sizeMultiplier?: number

  // ▶ 역동연출: 턴 모션/부스트/뱅킹/틴트
  turnClipLeft?: string // 예: "turn_left"
  turnClipRight?: string // 예: "turn_right"
  turnCrossFadeSec?: number // 턴 순간 크로스페이드 시간
  turnBoostFactor?: number // 턴 직후 잠깐 속도 배수
  turnBoostDurationSec?: number
  bankDegrees?: number // 좌우 이동 시 몸을 약간 기울이기(Z축 회전)
  bankLerpSec?: number
  tintOnTurn?: boolean // 턴 순간 살짝 발광 틴트
  tintColor?: number | string // 예: 0x66ccff
  tintIntensity?: number // 0~1 정도

  // (선택) 특정 본에 코드 웨이브 추가
  extraTailWave?: boolean
  tailBoneName?: string // 예: "Tail"
  tailAmp?: number // 라디안
  tailHz?: number // 헤르츠

  debug?: boolean // 디버그 로그/값 표시
}

export default function GLBAnimatedFish({
  id = "GLBAnimatedFish",
  source,
  animName = undefined,
  animSpeed = 1.0,
  fadeSeconds = 0.1,
  phaseOffsetSec = 0,

  speed = 2.0,
  speedJitterPct = 0.12,
  margin = 0.7,
  startSide = "left",
  yFrac = 0,
  zLayer = 0.5,
  initialYawDeg = 90,
  flipOnTurn = false, // 스킨드 메시 안전
  faceTurn = true,
  turnSeconds = 0.25,
  targetScreenHeightRatio = 0.22,
  sizeMultiplier = 0.28,

  turnClipLeft = undefined,
  turnClipRight = undefined,
  turnCrossFadeSec = 0.18,
  turnBoostFactor = 1.35,
  turnBoostDurationSec = 0.35,
  bankDegrees = 6,
  bankLerpSec = 0.18,
  tintOnTurn = true,
  tintColor = 0x66ccff,
  tintIntensity = 0.35,

  extraTailWave = false,
  tailBoneName = "Tail",
  tailAmp = 0.2,
  tailHz = 2.0,

  debug = false,
}: Props) {
  const tag = `🐟[${id}]`
  const group = useRef<Group>(null)
  const [model, setModel] = useState<Group | null>(null)
  const mixerRef = useRef<AnimationMixer | null>(null)
  const baseActionRef = useRef<ReturnType<AnimationMixer["clipAction"]> | null>(null)
  const turnActionRef = useRef<ReturnType<AnimationMixer["clipAction"]> | null>(null)

  const baseScale = useRef(1)
  const halfWidthWorld = useRef(0)
  const placed = useRef(false)
  const dirX = useRef<1 | -1>(1)
  const targetYaw = useRef(0)
  const bankTarget = useRef(0) // Z축 목표 기울기(라디안)
  const bankCurr = useRef(0)
  const bobT = useRef(0)

  const speedBase = useRef(speed)
  const speedNow = useRef(speed)
  const boostUntilT = useRef(0) // 부스트 종료 시각(초)
  const elapsed = useRef(0) // 컴포넌트 내부 경과 시간

  const tmpBox = useMemo(() => new Box3(), [])
  const tmpV = useMemo(() => new Vector3(), [])
  const { viewport } = useThree()

  const tailRef = useRef<Object3D | null>(null)
  const origEmissives = useRef<Map<Material, number>>(new Map())

  // 도우미
  const deg2rad = (d: number) => (d * Math.PI) / 180
  const easeLerp = (curr: number, target: number, dt: number, tSec: number) => {
    const k = 1 - Math.pow(0.001, dt / Math.max(0.0001, tSec))
    return curr + (target - curr) * k
  }
  const findClip = (clips: AnimationClip[], name?: string) => (name ? AnimationClip.findByName(clips, name) : undefined)

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
          const size = box.getSize(tmpV.set(0, 0, 0))
          const center = box.getCenter(tmpV.set(0, 0, 0))
          obj.position.sub(center)

          const maxDim = Math.max(size.x, size.y, size.z) || 1
          const targetH = viewport.height * targetScreenHeightRatio
          const s = (targetH / maxDim) * sizeMultiplier
          baseScale.current = s
          halfWidthWorld.current = (size.x * s) / 2

          // (옵션) 꼬리 본 핸들
          if (extraTailWave && tailBoneName) {
            const found = obj.getObjectByName(tailBoneName)
            tailRef.current = found || null
          }

          // (옵션) 머티리얼 발광값 기록
          obj.traverse((ch: any) => {
            if (ch.isMesh && ch.material) {
              const m: any = ch.material
              if (m.emissive) {
                origEmissives.current.set(m, (m.emissiveIntensity ?? 1) as number)
              }
            }
          })

          setModel(obj)

          // 애니 재생
          const clips = gltf.animations ?? []
          if (clips.length > 0) {
            const baseClip = (animName && AnimationClip.findByName(clips, animName)) || clips[0]

            const mixer = new AnimationMixer(obj)
            mixerRef.current = mixer
            if (baseClip) {
              const action = mixer.clipAction(baseClip, obj)
              baseActionRef.current = action
              action.setLoop(LoopRepeat, Infinity)
              action.timeScale = animSpeed
              // 시작 위상
              if (phaseOffsetSec) {
                action.time = action.getClip().duration > 0 ? phaseOffsetSec % action.getClip().duration : 0
              }
              action.fadeIn(fadeSeconds).play()
            }

            // 턴 전용 클립 준비(선택)
            const leftClip = findClip(clips, turnClipLeft)
            const rightClip = findClip(clips, turnClipRight)
            // 하나라도 있으면 action 만들어둠(재생은 턴 때)
            const turnClip = leftClip || rightClip
            if (turnClip) {
              turnActionRef.current = mixer.clipAction(turnClip, obj)
              turnActionRef.current.setLoop(LoopRepeat, 0) // 한 번만 사용
            }

            if (debug) {
              console.log(
                `${tag} clips:`,
                clips.map((c) => ({ name: c.name, dur: c.duration?.toFixed(3), tracks: c.tracks.length }))
              )
              console.log(`${tag} base clip:`, baseClip?.name)
              console.log(`${tag} turn clips:`, { left: leftClip?.name, right: rightClip?.name })
            }
          } else {
            mixerRef.current = null
            baseActionRef.current = null
            turnActionRef.current = null
          }

          // 스피드 지터 초기 반영
          const jitter = 1 + (Math.random() * 2 - 1) * speedJitterPct
          speedBase.current = speed * jitter
          speedNow.current = speedBase.current
        },
        undefined,
        (err) => console.error(`${tag} load error`, err)
      )
    })()

    return () => {
      mounted = false
      baseActionRef.current?.stop()
      turnActionRef.current?.stop()
      mixerRef.current?.stopAllAction()
      mixerRef.current = null
      baseActionRef.current = null
      turnActionRef.current = null
    }
  }, [source, viewport.height, targetScreenHeightRatio, sizeMultiplier, animName, animSpeed, phaseOffsetSec, turnClipLeft, turnClipRight, debug, speed, speedJitterPct, tailBoneName, extraTailWave])

  useFrame((_, delta) => {
    // 시간/애니 업데이트
    elapsed.current += delta
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
        startX = left
        dirX.current = 1
      } else if (startSide === "right") {
        startX = right
        dirX.current = -1
      } else {
        startX = MathUtils.lerp(left, right, 0.5)
        dirX.current = 1
      }
      g.position.set(startX, laneY, zLayer)
      g.scale.setScalar(baseScale.current)

      const yawDeg = dirX.current === 1 ? initialYawDeg : -initialYawDeg
      const yawRad = deg2rad(yawDeg)
      g.rotation.set(0, yawRad, 0)
      targetYaw.current = yawRad
      placed.current = true
    }

    // 좌우 경계
    const leftB = -viewport.width / 2 + margin + halfWidthWorld.current
    const rightB = viewport.width / 2 - margin - halfWidthWorld.current

    // 이동 (부스트 고려)
    const base = speedBase.current
    if (elapsed.current <= boostUntilT.current) {
      speedNow.current = base * turnBoostFactor
    } else {
      // 점진 복귀
      speedNow.current = easeLerp(speedNow.current, base, delta, 0.2)
    }

    g.position.x += dirX.current * speedNow.current * delta

    const hitLeft = g.position.x <= leftB
    const hitRight = g.position.x >= rightB

    if (hitLeft || hitRight) {
      // 경계 고정
      g.position.x = MathUtils.clamp(g.position.x, leftB, rightB)
      // 진행 방향 전환
      const wasRight = dirX.current === 1
      dirX.current = hitLeft ? 1 : -1

      // 스케일 반전(옵션) vs 회전 전환
      if (flipOnTurn) {
        const s = Math.abs(g.scale.x) || baseScale.current
        g.scale.x = dirX.current === 1 ? s : -s
      }
      if (faceTurn) {
        const deg = dirX.current === 1 ? initialYawDeg : -initialYawDeg
        targetYaw.current = deg2rad(deg)
      }

      // ▶ 턴 연출: 부스트/뱅킹/틴트/클립 페이드
      boostUntilT.current = elapsed.current + turnBoostDurationSec

      // 뱅킹 목표 (좌회전이면 +, 우회전이면 -)
      const sign = dirX.current === 1 ? +1 : -1
      bankTarget.current = deg2rad(bankDegrees) * sign

      // 틴트
      if (tintOnTurn) {
        applyEmissiveTint(model, tintColor, tintIntensity, origEmissives.current)
        // 잠시 후 원복 예약(아주 짧게)
        setTimeout(() => restoreEmissive(model, origEmissives.current), 180)
      }

      // 턴 전용 클립이 있으면 순간 블렌드
      const turnAct = turnActionRef.current
      const baseAct = baseActionRef.current
      if (turnAct && baseAct) {
        // 방향별로 다른 클립을 쓰고 싶다면 name 비교로 교체 가능
        // 여기서는 하나만 세팅되어 있어도 블렌드(혹은 좌/우 둘 다 있으면 setEffectiveWeight 사용)
        turnAct.reset()
        turnAct.enabled = true
        turnAct.setLoop(LoopRepeat, 0)
        turnAct.clampWhenFinished = true
        turnAct.fadeIn(turnCrossFadeSec).play()
        // 짧게 재생한 다음 다시 기본으로 페이드아웃
        setTimeout(() => {
          if (turnAct.isRunning()) turnAct.fadeOut(turnCrossFadeSec)
        }, turnCrossFadeSec * 1000 + 60)
      }

      if (debug) console.log(`${tag} turn: ${wasRight ? "RIGHT→LEFT" : "LEFT→RIGHT"}`)
    }

    // 회전 스무딩 (Yaw)
    if (faceTurn) {
      g.rotation.y = lerpAngle(g.rotation.y, targetYaw.current, smoothK(delta, turnSeconds))
    }

    // 뱅킹 스무딩 (Roll = Z)
    bankCurr.current = easeLerp(bankCurr.current, bankTarget.current, delta, bankLerpSec)
    g.rotation.z = bankCurr.current

    // (옵션) 꼬리 본 추가 웨이브
    if (extraTailWave && tailRef.current) {
      bobT.current += delta
      const add = Math.sin(bobT.current * tailHz * Math.PI * 2) * tailAmp
      ;(tailRef.current as any).rotation.y += add * delta * 10
    }

    // Y/Z 고정
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
function smoothK(delta: number, seconds: number) {
  return 1 - Math.pow(0.001, delta / Math.max(0.0001, seconds))
}

// 머티리얼 틴트 유틸
function applyEmissiveTint(root: Group | null, color: any, intensity: number, cache: Map<Material, number>) {
  if (!root) return
  root.traverse((ch: any) => {
    if (ch.isMesh && ch.material) {
      const m: any = ch.material as MeshStandardMaterial
      if (m.emissive) {
        if (!cache.has(m)) cache.set(m, m.emissiveIntensity ?? 1)
        m.emissive = new Color(color as any)
        m.emissiveIntensity = Math.min(2, (m.emissiveIntensity ?? 1) + intensity)
        m.needsUpdate = true
      }
    }
  })
}
function restoreEmissive(root: Group | null, cache: Map<Material, number>) {
  if (!root) return
  root.traverse((ch: any) => {
    if (ch.isMesh && ch.material) {
      const m: any = ch.material as MeshStandardMaterial
      if (m.emissive && cache.has(m)) {
        m.emissiveIntensity = cache.get(m) as number
        m.needsUpdate = true
      }
    }
  })
}
