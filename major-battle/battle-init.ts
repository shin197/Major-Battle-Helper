import { ccf } from "~contents/ccfolia-api"
import { showToast } from "~contents/toast"
import type { CcfoliaCharacter } from "~utils/types"

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
    const characters = await ccf.getCharacters("status")
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
        await ccf.patchCharacter(char.name, { status: statusUpdates })
        // callCcfolia("patchCharacter", )
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
    const characters = await ccf.getCharacters("status")
    if (!characters || characters.length === 0) {
      showToast("❗ 캐릭터를 찾을 수 없습니다.")
      return
    }

    let updatedCount = 0

    for (const char of characters) {
      const statusUpdates: Record<string, number> = {}

      for (const pair of INIT_PAIRS) {
        // 1. 해당 캐릭터에게 초기화 대상 Status가 있는지 확인
        const st = char.status.find((s) => s.label === pair.status)
        if (!st) continue

        // 2. 대응하는 Param(초기값) 찾기
        const pm = char.params.find((p) => p.label === pair.param)

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
        await ccf.patchCharacter(char.name, {
          status: statusUpdates
        })
        //  callCcfolia("patchCharacter", )
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

/** -----------------------------------------------
 * 4. /dmg 명령어 처리 (데미지 계산 로직)
 * - 형식: /dmg [양(amount)] [타입(type)] [횟수(count)]
 * - 예시: /dmg 15 관통폭발 x2
 * ----------------------------------------------*/
export async function handleDmgCommand(
  character: CcfoliaCharacter,
  commandLine: string
) {
  // 1. 인자 파싱 (/dmg 제거 후 공백 기준 분리)
  const args = commandLine
    .replace(/^\/dmg\s+/, "")
    .trim()
    .split(/\s+/)
  if (args.length === 0 || !args[0]) return

  let amount = 0
  let type = "일반"
  let count = 1

  // 각 인자의 형태를 검사하여 알맞은 변수에 할당 (순서 무관)
  for (const arg of args) {
    if (/^x\d+$/i.test(arg)) {
      // 'x' 또는 'X' 뒤에 숫자가 오는 경우 (예: x2, X3)
      count = parseInt(arg.substring(1), 10) || 1
    } else if (/^-?\d+(\.\d+)?$/.test(arg)) {
      // 순수 숫자 형태인 경우 (예: 15, 20.5, -5)
      amount = parseFloat(arg) || 0
    } else {
      // 그 외의 문자열은 타입으로 간주 (예: 관통, 폭발, 충격)
      // 만약 띄어쓰기로 여러 타입이 들어오면 합침 (예: "관통" "폭발" -> "관통폭발")
      if (type === "일반") {
        type = arg
      } else {
        type += arg
      }
    }
  }

  // 2. 캐릭터의 필요 파라미터 및 스테이터스 조회
  const armorParam = character.params.find((p) => p.label === "장갑")
  const armor = armorParam ? parseInt(armorParam.value, 10) || 0 : 0

  const defStatus = character.status.find((s) => s.label === "DEF")
  let def = defStatus ? defStatus.value : 0

  const hpStatus = character.status.find((s) => s.label === "HP")
  let hp = hpStatus ? hpStatus.value : 0

  const unitStatus = character.status.find((s) => s.label === "#")
  const unitCount = unitStatus ? Math.max(1, unitStatus.value) : 1

  // 3. 데미지 계산
  let dmg = amount

  // 장갑을 횟수만큼 적용
  dmg -= armor * count

  // 충격형 피해라면, 방어도에 50% 적용
  if (type.includes("충격")) {
    dmg = Math.floor(dmg / 2)
  }

  // 방어도를 피해만큼 차감 (남은 데미지가 0 미만이면 0으로 처리)
  def -= Math.max(0, dmg)

  // 방어도가 0보다 크다면 여기서 종료
  if (def > 0) {
    await ccf.patchCharacter(character.name, {
      status: { DEF: Math.floor(def) }
    })
    //  callCcfolia("patchCharacter", )
    // console.info(`[BattleHelper] DMG Blocked by DEF. DEF remaining: ${Math.floor(def)}`)
    return
  }

  // --- 방어도가 뚫린(음수) 경우의 추가 처리 ---

  // 관통형 피해라면, 남은 방어도가 절반이 된다 (소수점 버림)
  if (type.includes("관통")) {
    def = Math.floor(def / 2) // 예: -11 -> -6
  }

  // 폭발/방사 피해라면, 남은 방어도가 유닛 수만큼 곱해진다
  if (type.includes("폭발") || type.includes("방사")) {
    def *= unitCount
  }

  // 방어도가 음수라면 남은 방어도만큼 HP에서 차감
  hp -= Math.max(0, -def)

  // 방어도는 완전히 소모되었으므로 0으로 보정 (마이너스로 두지 않음)
  def = 0

  // 마지막으로, 유닛 수가 있다면, HP에 맞춰서 유닛 수 조정
  // 유닛 수가 많을 댸는 HP: 28/16 따위로 max가 cur을 초과한 상태로 표기중.
  // 이 때 유닛 수(#)는 ceil(cur/max)로 계산한다 (최소 0)
  let kills = 0
  if (unitStatus) {
    const maxUnits = Math.ceil(Math.max(0, hp) / (hpStatus ? hpStatus.max : 1))
    kills = unitStatus.value - maxUnits
    unitStatus.value = maxUnits
  }

  // 4. API로 최종 적용
  try {
    await ccf.patchCharacter(character.name, {
      status: {
        DEF: def,
        HP: Math.floor(hp),
        "#": unitStatus ? unitStatus.value : 0
      }
    })
    // callCcfolia("patchCharacter", )

    let message = `⚔️ ${character.name}에게 ${amount}`
    let typeMessage = " 피해를"
    let countMessage = " 입혔습니다."
    if (type !== "일반") {
      typeMessage = `의 ${type}형 피해를`
    }
    if (count > 1) {
      countMessage = ` 총 ${count}회에 걸쳐서 입혔습니다.`
    }
    message += typeMessage + countMessage

    if (kills >= 2 && unitStatus.value === 0) {
      message += ` (전원 처치!)`
    } else if (kills > 0) {
      message += ` (${kills}기 처치)`
    }
    showToast(message)
  } catch (e) {
    // console.error("[BattleHelper] patchCharacter failed during /dmg:", e)
  }
}
