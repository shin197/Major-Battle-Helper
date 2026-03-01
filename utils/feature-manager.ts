// utils/feature-manager.ts
import { Storage } from "@plasmohq/storage"

const storage = new Storage()

export interface FeatureDefinition {
  id: string
  name: string
  init: () => void | Promise<void>
  defaultEnabled?: boolean
  condition?: () => boolean
}

// ==========================================
// 1. ISOLATED 환경용 런처 (스토리지 직접 접근 가능)
// ==========================================
export async function loadFeatures(features: FeatureDefinition[]) {
  for (const feature of features) {
    if (feature.condition && !feature.condition()) continue

    const isEnabled =
      (await storage.get<boolean>(`feature:${feature.id}`)) ??
      feature.defaultEnabled ??
      true
    if (!isEnabled) {
      console.log(`⏭️ [Feature] '${feature.name}' 비활성화됨`)
      continue
    }

    try {
      await feature.init()
    } catch (e) {
      console.error(`❌ [Feature] '${feature.name}' 초기화 실패:`, e)
    }
  }
}

// ==========================================
// 2. ISOLATED -> MAIN 설정 브릿지 (isolated.ts에서 1회 실행)
// ==========================================
export function initSettingsBridge() {
  window.addEventListener("message", async (event) => {
    // MAIN 쪽에서 설정값을 달라고 요청이 오면
    if (event.data?.type === "MBH_REQUEST_SETTINGS") {
      const requests = event.data.features as {
        id: string
        defaultEnabled?: boolean
      }[]
      const settings: Record<string, boolean> = {}

      // 스토리지를 읽어서 답변 세트를 만듭니다
      for (const req of requests) {
        settings[req.id] =
          (await storage.get<boolean>(`feature:${req.id}`)) ??
          req.defaultEnabled ??
          true
      }

      // MAIN 쪽으로 답변(settings)을 쏴줍니다.
      window.postMessage({ type: "MBH_PROVIDE_SETTINGS", settings }, "*")
    }
  })
}

// ==========================================
// 3. MAIN 환경용 런처 (스토리지 접근 불가, ISOLATED에게 요청)
// ==========================================
export function loadMainFeatures(features: FeatureDefinition[]) {
  const requestData = features.map((f) => ({
    id: f.id,
    defaultEnabled: f.defaultEnabled
  }))
  let intervalId: ReturnType<typeof setInterval>

  // ISOLATED의 답변을 기다리는 리스너
  const listener = async (event: MessageEvent) => {
    if (event.data?.type === "MBH_PROVIDE_SETTINGS") {
      window.removeEventListener("message", listener)
      clearInterval(intervalId) // 답변을 받았으니 재요청 중단!

      const settings = event.data.settings

      for (const feature of features) {
        if (feature.condition && !feature.condition()) continue

        const isEnabled = settings[feature.id]
        if (!isEnabled) {
          console.log(`⏭️ [MAIN Feature] '${feature.name}' 비활성화됨`)
          continue
        }

        try {
          await feature.init()
        } catch (e) {
          console.error(`❌ [MAIN Feature] '${feature.name}' 초기화 실패:`, e)
        }
      }
    }
  }

  window.addEventListener("message", listener)

  // ✨ 핵심 방어 로직 (Race Condition 방지)
  // isolated.ts보다 main.ts가 먼저 실행되었을 경우를 대비해,
  // 응답이 올 때까지 50ms마다 "설정값 좀 주세요!" 하고 반복 요청합니다.
  intervalId = setInterval(() => {
    window.postMessage(
      { type: "MBH_REQUEST_SETTINGS", features: requestData },
      "*"
    )
  }, 50)
}
