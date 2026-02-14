import { showToast } from "~contents/toast"

import { waitFor } from "./wait-for"

export type AnchorSpec<T extends HTMLElement = HTMLElement> = {
  key: string
  selector?: string
  find?: () => T | null
  validate?: (el: T) => boolean
}

const TAB_LIST_SEL =
  "#root > div > div.MuiDrawer-root.MuiDrawer-docked > div > div > form > \
  header div.MuiTabs-scroller.MuiTabs-hideScrollbar.MuiTabs-scrollableX"

const TAB_SCROLLER_SEL =
  "#root div.MuiDrawer-docked form header div.MuiTabs-scroller"
const TAB_BTN_SEL = `${TAB_SCROLLER_SEL} > div > button[role='tab']`
const CHAT_LOG_SEL = "#root div.MuiDrawer-docked > div > ul > div > div"
const TAB_BAR_SEL = "div.MuiTabs-scroller.MuiTabs-hideScrollbar"

const TABLE_SELECTOR =
  "#root > div > div.sc-liAOXi.jHiGQZ > div.sc-bRuaPG.dkLqjp"

export function getCurrentCharacterNameInput(): HTMLInputElement | null {
  const CUR_CHAR_NAME_INPUT_SEL =
    "#root > div > div.MuiDrawer-root.MuiDrawer-docked> div > div > form > div:nth-child(2) > div > div > input"
  return document.querySelector(CUR_CHAR_NAME_INPUT_SEL)
}

export function getCurrentCharacterChatPaletteEditButton(): HTMLButtonElement | null {
  const CUR_CHAR_CHAT_PALETTE_BTN_SEL =
    "#root > div > div.MuiDrawer-root.MuiDrawer-docked > div > div > form > div:nth-child(2) > div:nth-child(3) > button"
  return document.querySelector(CUR_CHAR_CHAT_PALETTE_BTN_SEL)
}

export function getChatInputBox(): HTMLTextAreaElement | null {
  const CHAT_INPUT_SEL = 'textarea[id^="downshift"]'
  return document.querySelector(CHAT_INPUT_SEL)
}

// function getCurrentCharacterName(): string | null {
//   for (const sel of CUR_CHAR_NAME_INPUT_SEL) {
//     const el = document.querySelector<HTMLInputElement>(sel)
//     if (el?.value?.trim()) return el.value.trim()
//   }
//   return null
// }

export function getCharacterListButton(): HTMLButtonElement {
  const CHARACTER_LIST_BTN_SEL =
    "#root > div > header > div > button:nth-child(3)"
  const characterListBtn = document.querySelector<HTMLButtonElement>(
    CHARACTER_LIST_BTN_SEL
  )
  if (!characterListBtn) showToast("❗ 캐릭터 목록 버튼을 찾지 못했습니다.") //throw new Error("캐릭터 목록 버튼을 찾지 못했습니다.")
  return characterListBtn
}

const SIDE_CHAR_ANCHOR = "side-char-list"

export function getSideCharacterListTab(): HTMLDivElement | null {
  const SIDE_CHAR_LIST_SELECTOR =
    "#root > div > div:nth-of-type(2) > div:nth-of-type(8)"

  // #root > div > div.sc-geBDJh.iTYDax > div.sc-yECoe.kulSwB
  const el = getOrMarkElement<HTMLDivElement>(SIDE_CHAR_ANCHOR, () => {
    // 1) (가능하면) 의미 기반 후보 탐색을 먼저 시도
    // 예: '캐릭터' 텍스트가 있는 사이드 패널, role=navigation 등
    // 프로젝트에 맞게 커스터마이즈하세요.
    // const candidates = Array.from(
    //   document.querySelectorAll<HTMLDivElement>("#root div")
    // ).filter(isShown)

    // const byText = candidates.find((d) => {
    //   const t = d.textContent?.replace(/\s+/g, " ").trim() ?? ""
    //   return t.includes("캐릭터") && t.includes("목록") // 예시: "캐릭터 목록"
    // })
    // if (byText) return byText

    return document.querySelector<HTMLDivElement>(SIDE_CHAR_LIST_SELECTOR)
  })

  // document.querySelector<HTMLDivElement>(SIDE_CHAR_LIST_SELECTOR)
  // 만약 해당 el에 div가 child로써 존재하지 않는다면, 없는거임
  if (!el) {
    showToast("❗ 표시중인 캐릭터가 없습니다.")
    return null
  }

  // ✅ child div 존재 여부 확인
  const hasChildDiv = el.querySelector("div") !== null
  if (!hasChildDiv) {
    showToast("❗ 표시중인 캐릭터가 없습니다.")
    return null
  }

  return el
}

function isShown(el: HTMLElement) {
  const r = el.getBoundingClientRect()
  const st = getComputedStyle(el)
  return (
    r.width > 0 &&
    r.height > 0 &&
    st.display !== "none" &&
    st.visibility !== "hidden"
  )
}

/**
 * 1) 이미 태그된 엘리먼트가 있으면 그걸 반환
 * 2) 없으면 findFn으로 찾고, data 속성(앵커)을 붙인 뒤 반환
 */
export function getOrMarkElement<T extends HTMLElement>(
  anchor: string,
  findFn: () => T | null
): T | null {
  const marked = document.querySelector<T>(`[data-anchor="${anchor}"]`)
  if (marked) return marked

  const found = findFn()
  if (!found) return null

  found.setAttribute("data-anchor", anchor)
  return found
}

export function getAnchored<T extends HTMLElement = HTMLElement>(
  key: string
): T | null {
  return document.querySelector<T>(`[data-anchor="${key}"]`)
}

function defaultValidate<T extends HTMLElement>(el: T) {
  return isShown(el)
}

export function markAnchor<T extends HTMLElement>(
  spec: AnchorSpec<T>
): T | null {
  const validate = spec.validate ?? defaultValidate

  // 1) 이미 마킹된 게 있으면 그걸 우선 사용
  const existing = getAnchored<T>(spec.key)
  if (existing && validate(existing)) return existing

  // 2) 없다면 새로 찾고 마킹
  const found = spec.find()
  if (!found) return null

  found.setAttribute("data-anchor", spec.key)
  return found
}

export async function initAnchorsAsync(
  specs: AnchorSpec[],
  {
    root = document,
    timeout = 10_000
  }: { root?: ParentNode; timeout?: number } = {}
): Promise<Map<string, HTMLElement>> {
  const out = new Map<string, HTMLElement>()

  for (const spec of specs) {
    // 이미 마킹되어 있으면 스킵
    const existing = document.querySelector<HTMLElement>(
      `[data-anchor="${spec.key}"]`
    )
    if (existing) {
      out.set(spec.key, existing)
      continue
    }

    let el: HTMLElement | null = null

    // 1) selector가 있으면 waitFor로 기다린다
    if (spec.selector) {
      el = await waitFor<HTMLElement>(spec.selector, { root, timeout })
    }

    // 2) selector가 없거나 실패하면 find()로 재시도
    if (!el && spec.find) {
      // find는 “즉시”만 하므로, 타이밍 이슈면 한 번 더 기다렸다가 재시도할 수도 있음
      el = spec.find() as HTMLElement | null
    }

    if (!el) continue

    el.setAttribute("data-anchor", spec.key)
    out.set(spec.key, el)
  }

  return out
}
