import { callCcfolia } from "~contents/ccfolia-api"
import type { CcfoliaCharacter } from "~contents/enter-eval"
import { showToast } from "~contents/toast"

// --- 타입 정의 (ccfolia-api와 맞춤) ---

// 초기화 매핑 정의 (Status Label ↔ Param Label)
const INIT_PAIRS = [
  { status: "MP", param: "초기마력" },
  { status: "DEF", param: "초기방어도" },
  { status: "AP", param: "초기행동력" },
  { status: "EX", param: "초기주사위" },
  { status: "STK", param: "초기스택" }
]

/** ----------------------------------------------------------------
 * capStatus: 캐릭터들의 Status 값을 0 ~ Max 사이로 제한 (Clamping)
 * @param mustCap Max가 0이어도 반드시 최대값 제한을 걸어야 하는 라벨 목록
 * ----------------------------------------------------------------*/
export async function capStatus(mustCap: string[] = []) {
  try {
    const characters = await callCcfolia<CcfoliaCharacter[]>("getCharacters")
    if (!characters || characters.length === 0) {
      showToast("❗ 캐릭터를 찾을 수 없습니다.")
      return
    }

    let updatedCount = 0

    for (const char of characters) {
      const statusUpdates: Record<string, number> = {}

      for (const st of char.status) {
        let newValue = st.value
        // const allowNeg = allowNegative.includes(st.label)
        if (st.max === 0) {
          // Max가 0일 때: 보통은 무제한이지만, mustCap에 포함되면 0으로 제한
          if (mustCap.includes(st.label)) {
            newValue = 0
          } else if (st.value < 0) {
            continue // 제한 없음 (건너뜀)
          } else {
            newValue = 0
          }
        } else {
          // 일반적인 경우: 0 ~ Max 사이로 제한
          newValue = Math.min(st.value, st.max)
        }

        // 값이 달라져야만 업데이트 목록에 추가
        if (newValue !== st.value) {
          statusUpdates[st.label] = newValue
        }
      }

      // 변경 사항이 있는 경우 API 호출
      if (Object.keys(statusUpdates).length > 0) {
        await callCcfolia("patchCharacter", char.name, { status: statusUpdates })
        updatedCount++
      }
    }

    if (updatedCount > 0) {
      showToast(`✅ ${updatedCount}명의 스테이터스를 보정했습니다.`)
    } else {
      showToast("✨ 보정할 스테이터스가 없습니다.")
    }

  } catch (e) {
    console.error("[BattleHelper] capStatus Error:", e)
    showToast("❌ 스테이터스 보정 중 오류가 발생했습니다.")
  }
}

/** ----------------------------------------------------------------
 * initBattle: 전투 초기화
 * - 특정 Status(MP, DEF 등)를 대응하는 Param(초기마력 등) 값으로 설정
 * - Param이 없으면 0으로 설정
 * ----------------------------------------------------------------*/
export async function initBattle() {
  try {
    const characters = await callCcfolia<CcfoliaCharacter[]>("getCharacters")
    if (!characters || characters.length === 0) {
      showToast("❗ 캐릭터를 찾을 수 없습니다.")
      return
    }

    let updatedCount = 0

    for (const char of characters) {
      const statusUpdates: Record<string, number> = {}

      for (const pair of INIT_PAIRS) {
        // 1. 해당 캐릭터에게 초기화 대상 Status가 있는지 확인
        const st = char.status.find(s => s.label === pair.status)
        if (!st) continue

        // 2. 대응하는 Param(초기값) 찾기
        const pm = char.params.find(p => p.label === pair.param)
        
        let initValue = 0
        if (pm) {
          const parsed = parseInt(pm.value, 10)
          if (!isNaN(parsed)) {
            initValue = parsed
          }
        }

        // 3. 현재 값과 다르면 업데이트 목록에 추가
        if (st.value !== initValue) {
          statusUpdates[pair.status] = initValue
        }
      }

      // 변경 사항 적용
      if (Object.keys(statusUpdates).length > 0) {
        await callCcfolia("patchCharacter", char.name, { status: statusUpdates })
        updatedCount++
      }
    }

    if (updatedCount > 0) {
      showToast(`⚔️ ${updatedCount}명의 전투 상태를 초기화했습니다.`)
    } else {
      showToast("✨ 이미 초기화된 상태입니다.")
    }

  } catch (e) {
    console.error("[BattleHelper] initBattle Error:", e)
    showToast("❌ 전투 초기화 중 오류가 발생했습니다.")
  }
}