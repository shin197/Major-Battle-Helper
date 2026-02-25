import { ccf } from "~core/isolated/ccfolia-api"
import { showToast } from "~utils/isolated/toast"
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
// ccf API 호출이 필요하므로 상단에 import 되어 있어야 합니다.
// import { ccf } from "../core/isolated/ccfolia-api"
// import { showToast } from "../utils/isolated/toast"

export async function handleDmgCommand(
  character: CcfoliaCharacter | null, // 대상 지정이 기본이 되므로 null 허용
  commandLine: string
) {
  // 1. 접두사 파싱 (/dmg, /d, /ㅇ 모두 지원)
  let content = commandLine.replace(/^\/(dmg|d|ㅇ)\s+/, "").trim()
  if (!content) return

  // 2. 다중 대상 캐릭터 파싱: [캐릭터A] [캐릭터B]
  const targetNames: string[] = []
  content = content.replace(/\[(.*?)\]/g, (match, name) => {
    targetNames.push(name.trim())
    return "" // 파싱한 이름은 문자열에서 제거
  })

  const targets: CcfoliaCharacter[] = []
  if (targetNames.length > 0) {
    for (const name of targetNames) {
      const char = await ccf.getCharacterByName(name)
      if (char) targets.push(char)
      else showToast(`❗ 캐릭터 '${name}'를 찾을 수 없습니다.`)
    }
  } else if (character) {
    targets.push(character)
  }

  // 데미지를 줄 대상이 아무도 없다면 종료
  if (targets.length === 0) {
    showToast(`❗ 데미지를 적용할 대상 캐릭터가 없습니다.`)
    return
  }

  // 3. 데미지 인자 파싱
  const args = content
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0)
  if (args.length === 0) return

  let amount = 0
  let type = "일반"
  let count = 1

  for (const arg of args) {
    if (/^x\d+$/i.test(arg)) {
      count = parseInt(arg.substring(1), 10) || 1
    } else if (/^-?\d+(\.\d+)?$/.test(arg)) {
      amount = parseFloat(arg) || 0
    } else {
      if (type === "일반") type = arg
      else type += arg
    }
  }

  // ==========================================
  // 4. 데미지 적용 재귀 함수 (내부 함수)
  // ==========================================
  async function processDamage(
    target: CcfoliaCharacter,
    dmgAmount: number,
    dmgType: string,
    hitCount: number,
    isPrimaryWithSplash: boolean
  ) {
    const armorParam = target.params.find((p) => p.label === "장갑")
    const armor = armorParam ? parseInt(armorParam.value, 10) || 0 : 0

    const defStatus = target.status.find((s) => s.label === "DEF")
    let def = defStatus ? defStatus.value : 0

    const hpStatus = target.status.find((s) => s.label === "HP")
    let hp = hpStatus ? hpStatus.value : 0

    const unitStatus = target.status.find((s) => s.label === "#")
    const unitCount = unitStatus ? Math.max(1, unitStatus.value) : 1

    let dmg = dmgAmount

    // 장갑을 횟수만큼 적용
    dmg -= armor * hitCount

    // 충격형 피해라면, 방어도에 50% 적용
    if (dmgType.includes("충격")) {
      dmg = Math.floor(dmg / 2)
    }

    // 방어도를 피해만큼 차감
    def -= Math.max(0, dmg)

    // 방어도가 막아냈을 때 (관통/폭발 등 체력 피해 없이 여기서 종료)
    if (def > 0) {
      await ccf.patchCharacter(target.name, {
        status: { DEF: Math.floor(def) }
      })
      // showToast(`🛡️ ${target.name}의 방어도가 공격을 막아냈습니다! (남은 DEF: ${Math.floor(def)})`)
      return
    }

    // 뚫고 들어간 순수 피해량 산출
    let penDamage = -def

    // --- [핵심] 방사(Splash) 피해 확산 로직 ---
    // 조건: 첫 번째 대상이고, '방사' 타입이며, 방어도를 뚫은 피해량이 0보다 클 때
    if (isPrimaryWithSplash && penDamage > 0) {
      const splashTargets = targets.slice(1) // 자신을 제외한 나머지 캐릭터들
      const splashType = dmgType.replace(/방사/g, "폭발") // 방사를 폭발로 대체

      for (const splashTarget of splashTargets) {
        // 남은 피해량(penDamage)을 폭발 타입으로 나머지 대상들에게 가함 (count는 1회로 취급)
        await processDamage(splashTarget, penDamage, splashType, 1, false)
      }
    }

    // --- 방어도가 뚫린(음수) 경우의 주 대상 체력 피해 처리 ---
    if (dmgType.includes("관통")) {
      def = Math.floor(def / 2)
    }

    if (dmgType.includes("폭발") || dmgType.includes("방사")) {
      def *= unitCount
    }

    // 방어도가 음수라면 남은 방어도만큼 HP에서 차감
    hp -= Math.max(0, -def)
    def = 0

    let kills = 0
    if (unitStatus) {
      const maxUnits = Math.ceil(
        Math.max(0, hp) / (hpStatus ? hpStatus.max : 1)
      )
      kills = unitStatus.value - maxUnits
      unitStatus.value = maxUnits
    }

    // API로 최종 적용
    try {
      await ccf.patchCharacter(target.name, {
        status: {
          DEF: def,
          HP: Math.floor(hp),
          "#": unitStatus ? unitStatus.value : 0
        }
      })

      let message = `⚔️ ${target.name}에게 ${dmgAmount}`
      let typeMessage = " 피해를"
      let countMessage = " 입혔습니다."
      if (dmgType !== "일반") {
        typeMessage = `의 ${dmgType}형 피해를`
      }
      if (hitCount > 1) {
        countMessage = ` 총 ${hitCount}회에 걸쳐서 입혔습니다.`
      }
      message += typeMessage + countMessage

      if (kills >= 2 && unitStatus && unitStatus.value === 0) {
        message += ` (전원 처치!)`
      } else if (kills > 0) {
        message += ` (${kills}기 처치)`
      }
      showToast(message)
    } catch (e) {
      // console.error("[BattleHelper] patchCharacter failed during /dmg:", e)
    }
  }

  // ==========================================
  // 5. 대상에 따른 데미지 적용 실행
  // ==========================================
  if (type.includes("방사")) {
    // '방사' 타입일 경우: 첫 번째 캐릭터에게만 전체 로직(isPrimaryWithSplash = true)을 실행.
    // 나머지 대상들은 processDamage 내부의 확산 로직에 의해 자동으로 피해를 받습니다.
    await processDamage(targets[0], amount, type, count, true)
  } else {
    // '방사' 타입이 아닐 경우: 지정된 모든 캐릭터들에게 동일한 데미지를 각각 적용합니다.
    for (const target of targets) {
      await processDamage(target, amount, type, count, false)
    }
  }
}
