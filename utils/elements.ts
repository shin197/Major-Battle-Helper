import { showToast } from "~utils/isolated/toast"

import { ANCHOR_SPECS } from "./anchors"

export type AnchorSpec<T extends HTMLElement = HTMLElement> = {
  key: string
  selector?: string
  find?: () => T | null
}

const anchorCache = new Map<string, HTMLElement>()

// 💡 2. 죽은 참조(Stale) 검증 로직 추가
function isAlive(el: HTMLElement | null): boolean {
  if (!el) return false
  // 요소가 여전히 실제 문서 DOM 트리에 연결되어 있는지 확인
  return document.body.contains(el)
}

export async function getOrFindAnchor<T extends HTMLElement>(
  spec: AnchorSpec<T>
): Promise<T | null> {
  let el = anchorCache.get(spec.key) as T | null

  // 캐시에 있고, 여전히 화면에 살아있다면 즉시 반환
  if (isAlive(el)) {
    return el
  }

  // 캐시가 죽었거나 없으면 새로 탐색
  el = null

  // A. selector가 있다면 1순위로 탐색
  if (spec.selector) {
    el = document.querySelector<T>(spec.selector)
  }

  // B. selector로 못 찾았고 find 함수가 있다면 2순위로 실행
  if (!el && spec.find) {
    el = spec.find()
  }

  // 찾았다면 캐시에 저장하고 data-anchor 마킹
  if (el) {
    el.setAttribute("data-anchor", spec.key)
    anchorCache.set(spec.key, el)
  }

  return el
}

export function getAnchorSync<T extends HTMLElement>(key: string): T | null {
  const el = anchorCache.get(key) as T | null
  if (isAlive(el)) return el

  // 캐시가 깨졌다면 DOM에서 마킹된 속성으로 긁어오기 시도
  const marked = document.querySelector<T>(`[data-anchor="${key}"]`)
  if (marked) {
    anchorCache.set(key, marked)
    return marked
  }

  return null
}

// 편의성을 위한 래퍼 함수들
export const getChatInputAsync = () => getOrFindAnchor(ANCHOR_SPECS.CHAT_INPUT)
export const getChatInput = () =>
  getAnchorSync<HTMLTextAreaElement>(ANCHOR_SPECS.CHAT_INPUT.key) ||
  document.querySelector<HTMLTextAreaElement>(ANCHOR_SPECS.CHAT_INPUT.selector!)

export const getCurrentCharacterNameInputAsync = () =>
  getOrFindAnchor(ANCHOR_SPECS.CHARACTER_NAME_INPUT)
export const getCurrentCharacterNameInput = () =>
  getAnchorSync<HTMLInputElement>(ANCHOR_SPECS.CHARACTER_NAME_INPUT.key) ||
  document.querySelector<HTMLInputElement>(
    ANCHOR_SPECS.CHARACTER_NAME_INPUT.selector!
  )

// export function getCurrentCharacterNameInput(): HTMLInputElement | null {
//   const CUR_CHAR_NAME_INPUT_SEL =
//     "#root > div > div.MuiDrawer-root.MuiDrawer-docked> div > div > form > div:nth-child(2) > div > div > input"
//   return document.querySelector(CUR_CHAR_NAME_INPUT_SEL)
// }

export const getCurrentCharacterChatPaletteEditButtonAsync = () =>
  getOrFindAnchor(ANCHOR_SPECS.CHARACTER_CHAT_PALETTE_EDIT_BTN)
export const getCurrentCharacterChatPaletteEditButton = () =>
  getAnchorSync<HTMLButtonElement>(
    ANCHOR_SPECS.CHARACTER_CHAT_PALETTE_EDIT_BTN.key
  ) ||
  document.querySelector<HTMLButtonElement>(
    ANCHOR_SPECS.CHARACTER_CHAT_PALETTE_EDIT_BTN.selector!
  )

// export function getCurrentCharacterChatPaletteEditButton(): HTMLButtonElement | null {
//   const CUR_CHAR_CHAT_PALETTE_BTN_SEL =
//     "#root > div > div.MuiDrawer-root.MuiDrawer-docked > div > div > form > div:nth-child(2) > div:nth-child(3) > button"
//   return document.querySelector(CUR_CHAR_CHAT_PALETTE_BTN_SEL)
// }

export function getChatInputBox(): HTMLTextAreaElement | null {
  const CHAT_INPUT_SEL = 'textarea[id^="downshift"]'
  return document.querySelector(CHAT_INPUT_SEL)
}

export function getCharacterListButton(): HTMLButtonElement {
  const CHARACTER_LIST_BTN_SEL =
    "#root > div > header > div > button:nth-child(3)"
  const characterListBtn = document.querySelector<HTMLButtonElement>(
    CHARACTER_LIST_BTN_SEL
  )
  if (!characterListBtn) showToast("❗ 캐릭터 목록 버튼을 찾지 못했습니다.") //throw new Error("캐릭터 목록 버튼을 찾지 못했습니다.")
  return characterListBtn
}

// export function getSideCharacterListTab(): HTMLDivElement | null {
//   const SIDE_CHAR_LIST_SELECTOR =
//     "#root > div > div:nth-of-type(2) > div:nth-of-type(8)"

//   const SIDE_CHAR_ANCHOR = "side-char-list"
//   const el = getOrMarkElement<HTMLDivElement>(SIDE_CHAR_ANCHOR, () => {
//     return document.querySelector<HTMLDivElement>(SIDE_CHAR_LIST_SELECTOR)
//   })

//   // document.querySelector<HTMLDivElement>(SIDE_CHAR_LIST_SELECTOR)
//   // 만약 해당 el에 div가 child로써 존재하지 않는다면, 없는거임
//   if (!el) {
//     showToast("❗ 표시중인 캐릭터가 없습니다.")
//     return null
//   }

//   // ✅ child div 존재 여부 확인
//   const hasChildDiv = el.querySelector("div") !== null
//   if (!hasChildDiv) {
//     showToast("❗ 표시중인 캐릭터가 없습니다.")
//     return null
//   }

//   return el
// }

// function isShown(el: HTMLElement) {
//   const r = el.getBoundingClientRect()
//   const st = getComputedStyle(el)
//   return (
//     r.width > 0 &&
//     r.height > 0 &&
//     st.display !== "none" &&
//     st.visibility !== "hidden"
//   )
// }

/**
 * 1) 이미 태그된 엘리먼트가 있으면 그걸 반환
 * 2) 없으면 findFn으로 찾고, data 속성(앵커)을 붙인 뒤 반환
 */
// export function getOrMarkElement<T extends HTMLElement>(
//   anchor: string,
//   findFn: () => T | null
// ): T | null {
//   const marked = document.querySelector<T>(`[data-anchor="${anchor}"]`)
//   if (marked) return marked

//   const found = findFn()
//   if (!found) return null

//   found.setAttribute("data-anchor", anchor)
//   return found
// }

// export function getAnchored<T extends HTMLElement = HTMLElement>(
//   key: string
// ): T | null {
//   return document.querySelector<T>(`[data-anchor="${key}"]`)
// }

// function defaultValidate<T extends HTMLElement>(el: T) {
//   return isShown(el)
// }

// export function markAnchor<T extends HTMLElement>(
//   spec: AnchorSpec<T>
// ): T | null {
//   const validate = spec.validate ?? defaultValidate

//   // 1) 이미 마킹된 게 있으면 그걸 우선 사용
//   const existing = getAnchored<T>(spec.key)
//   if (existing && validate(existing)) return existing

//   // 2) 없다면 새로 찾고 마킹
//   const found = spec.find()
//   if (!found) return null

//   found.setAttribute("data-anchor", spec.key)
//   return found
// }

// export async function initAnchorsAsync(
//   specs: AnchorSpec[],
//   {
//     root = document,
//     timeout = 10_000
//   }: { root?: ParentNode; timeout?: number } = {}
// ): Promise<Map<string, HTMLElement>> {
//   const out = new Map<string, HTMLElement>()

//   for (const spec of specs) {
//     // 이미 마킹되어 있으면 스킵
//     const existing = document.querySelector<HTMLElement>(
//       `[data-anchor="${spec.key}"]`
//     )
//     if (existing) {
//       out.set(spec.key, existing)
//       continue
//     }

//     let el: HTMLElement | null = null

//     // 1) selector가 있으면 waitFor로 기다린다
//     if (spec.selector) {
//       el = await waitFor<HTMLElement>(spec.selector, { root, timeout })
//     }

//     // 2) selector가 없거나 실패하면 find()로 재시도
//     if (!el && spec.find) {
//       // find는 “즉시”만 하므로, 타이밍 이슈면 한 번 더 기다렸다가 재시도할 수도 있음
//       el = spec.find() as HTMLElement | null
//     }

//     if (!el) continue

//     el.setAttribute("data-anchor", spec.key)
//     out.set(spec.key, el)
//   }

//   return out
// }
export const getPanels = (): HTMLElement[] => {
  return Array.from(
    document.querySelectorAll('[aria-roledescription="draggable"]')
  ) as HTMLElement[]
}

export const getPanelRoot = (t: EventTarget | null): HTMLElement | null => {
  if (!(t instanceof Element)) return null
  return t.closest('[aria-roledescription="draggable"]') as HTMLElement | null
}
