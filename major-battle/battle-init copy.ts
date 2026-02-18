import {
  applyCharacterPatches,
  extractCharacterData,
  type Patch
} from "~contents/character-data"
import type { CharacterData } from "~contents/character-store"
import { showToast } from "~contents/toast"
import { getSideCharacterListTab } from "~utils/elements"
import { sleep } from "~utils/utils"
import { waitFor } from "~utils/wait-for"

const SIDE_CHAR_DIALOG_SEL =
  "body > div.MuiPopover-root > div.MuiPaper-elevation"

export async function taskForEachUnit(
  task: (charData: CharacterData) => Patch[],
  taskName: string = "작업"
) {
  const sideCharacterList: HTMLDivElement | null = getSideCharacterListTab()
  if (!sideCharacterList) return

  // ✅ 직접 자식 div > div 순회
  const items = Array.from(
    sideCharacterList.querySelectorAll<HTMLDivElement>(":scope > div > div")
  )
  console.log(items)
  if (items.length === 0) {
    showToast("❗ 유닛이 없습니다.")
    return
  }

  for (let i = 0; i < items.length; i++) {
    const div = items[i]
    const isFirst = i === 0
    const isLast = i === items.length - 1

    try {
      // 스크롤 뷰에 안정적으로 올려놓고 클릭 (가상 스크롤 안정화)
      div.scrollIntoView({ block: "nearest" })
      // 첫 번째만 약간 더 안정화 시간 부여 (React 렌더/선택 지연 대응)
      // if (isFirst) await sleep(500)

      // 목록 아이템 클릭 → 팝오버 열림
      div.click()

      // 첫 번째만 팝오버 대기 전 지연 한번 더 (경험적으로 안정적)
      if (isFirst) await sleep(300)

      const sideCharacterDialog = await waitFor<HTMLDivElement>(
        SIDE_CHAR_DIALOG_SEL,
        { timeout: 1500 }
      )
      if (!sideCharacterDialog) {
        showToast("❗ 유닛 팝오버를 찾지 못했습니다.")
        continue
      }

      // 팝오버 내 첫 번째 버튼(= 편집) 클릭
      const firstBtn =
        sideCharacterDialog.querySelector<HTMLButtonElement>(
          "div > div > button:nth-of-type(1)"
        ) ||
        sideCharacterDialog.querySelector<HTMLButtonElement>(
          "button, [role='button']"
        )
      if (!firstBtn) {
        showToast("❗ 유닛 편집 버튼을 찾지 못했습니다.")
        continue
      }
      firstBtn.click()

      // 편집 다이얼로그 대기
      const characterEditDialog = await waitFor<HTMLDivElement>(
        'div.MuiDialog-paper[role="dialog"]',
        { timeout: 2000 }
      )
      if (!characterEditDialog) {
        showToast("❗ 유닛 편집 창을 찾지 못했습니다.")
        continue
      }

      // 데이터 추출
      const charData: CharacterData = extractCharacterData(
        characterEditDialog,
        false
      )

      // 적용 (다이얼로그는 지금 회수)
      applyCharacterPatches(characterEditDialog, task(charData), true)

      // 다이얼로그 닫힘 대기 (최대 2초)
      const t0 = performance.now()
      while (document.querySelector('div.MuiDialog-paper[role="dialog"]')) {
        if (performance.now() - t0 > 2000) break
        await sleep(50)
      }

      if (isLast) {
        await closePopoverRobust(div /* 앵커 */, 1800)
      }
    } catch (e) {
      console.error(e)
      showToast(`⚠️ 유닛의 ${taskName} 도중 오류가 발생했습니다.`)
      // 다음 아이템으로 진행
    }
  }

  showToast(`✅ 전 유닛 ${taskName} 완료되었습니다.`)
}

export async function initBattle() {
  taskForEachUnit((charData: CharacterData) => {
    const patches: Patch[] = []
    const getParamNum = (label: string, fallback = 0) => {
      const v =
        charData.params.find((p) => p.label === label)?.value ?? `${fallback}`
      const n = Number(v)
      return Number.isFinite(n) ? n : fallback
    }
    const hasStatus = (label: string) =>
      charData.status.some((s) => s.label === label)

    if (hasStatus("MP"))
      patches.push({ label: "MP", value: getParamNum("초기마력", 0) })
    if (hasStatus("DEF"))
      patches.push({ label: "DEF", value: getParamNum("초기방어도", 0) })
    if (hasStatus("AP"))
      patches.push({ label: "AP", value: getParamNum("초기행동력", 0) })
    if (hasStatus("EX"))
      patches.push({ label: "EX", value: getParamNum("초기주사위", 0) })
    if (hasStatus("STK"))
      patches.push({ label: "STK", value: getParamNum("초기스택", 0) })
    return patches
  }, "초기화")
}

export async function capStatus() {
  taskForEachUnit((charData: CharacterData) => {
    const patches: Patch[] = []
    const getMaxStatus = (label: string, fallback = 0) => {
      const target = charData.status.find((p) => p.label === label)
      const v = target?.max ?? target?.cur ?? `${fallback}`
      const n = Number(v)
      return Number.isFinite(n) ? n : fallback
    }
    const hasStatus = (label: string) =>
      charData.status.some((s) => s.label === label)

    charData.status.forEach((stat) => {
      const label = stat.label
      if (label === "HP" && hasStatus("#")) {
        const groupSize = charData.status.find((p) => p.label === "#")
        const groupMaxHP = groupSize.cur * stat.max
        if (stat.cur > groupMaxHP)
          patches.push({ label: "HP", value: groupMaxHP })
        if (Math.ceil(stat.cur / stat.max) < groupSize.cur)
          patches.push({ label: "#", value: Math.ceil(stat.cur / stat.max) })
        return
      }
      if (label === "#") {
        return
      }
      if (stat.cur > stat.max)
        patches.push({ label, value: getMaxStatus(label, stat.cur) })
    })
    return patches
  }, "상한제한")
}

// Esc 발송(포커스 대상 & 팝오버 컨테이너 모두에 시도)
async function pressEscTargets() {
  const esc = (t: EventTarget) => {
    const mk = (type: string) =>
      new KeyboardEvent(type, {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
        composed: true
      })
    ;(t as any).dispatchEvent(mk("keydown"))
    ;(t as any).dispatchEvent(mk("keyup"))
  }
  esc(document)
  if (document.activeElement) esc(document.activeElement)
  const presentations = document.querySelectorAll(
    '[role="presentation"], .MuiPopover-root, .MuiMenu-root'
  )
  presentations.forEach((p) => esc(p))
  await sleep(80)
}

// 현재 열린 팝오버/메뉴 후보 셀렉터들
const POPOVER_SELECTORS = [
  "body > div.MuiPopover-root",
  "body > div.MuiPopover-root > div.MuiPaper-elevation",
  "body > div.MuiMenu-root",
  'div[role="presentation"]'
]
const isPopoverOpen = () =>
  POPOVER_SELECTORS.some((s) => document.querySelector(s))

// 종합 닫기: Esc → 클릭어웨이 → 앵커 재클릭 → 하드 제거
async function closePopoverRobust(anchor?: HTMLElement, timeout = 1500) {
  const t0 = performance.now()
  const until = async (fn: () => Promise<void> | void) => {
    if (!isPopoverOpen()) return true
    await fn()
    await sleep(80)
    return !isPopoverOpen()
  }

  if (await until(pressEscTargets)) return true
  return !isPopoverOpen()
}
