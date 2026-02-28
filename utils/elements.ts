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

export const getChatInputBoxAsync = () =>
  getOrFindAnchor(ANCHOR_SPECS.CHAT_INPUT)
export const getChatInputBox = () =>
  getAnchorSync<HTMLTextAreaElement>(ANCHOR_SPECS.CHAT_INPUT.key) ||
  document.querySelector<HTMLTextAreaElement>(ANCHOR_SPECS.CHAT_INPUT.selector!)

export const getCurrentCharacterChatPaletteEditButtonAsync = () =>
  getOrFindAnchor(ANCHOR_SPECS.CHARACTER_CHAT_PALETTE_EDIT_BTN)
export const getCurrentCharacterChatPaletteEditButton = () =>
  getAnchorSync<HTMLButtonElement>(
    ANCHOR_SPECS.CHARACTER_CHAT_PALETTE_EDIT_BTN.key
  ) ||
  document.querySelector<HTMLButtonElement>(
    ANCHOR_SPECS.CHARACTER_CHAT_PALETTE_EDIT_BTN.selector!
  )

export const getBoardTableAsync = () =>
  getOrFindAnchor(ANCHOR_SPECS.TABLE_CONTAINER)
export const getBoardTable = () =>
  getAnchorSync<HTMLDivElement>(ANCHOR_SPECS.TABLE_CONTAINER.key) ||
  document.querySelector<HTMLDivElement>(ANCHOR_SPECS.TABLE_CONTAINER.selector!)

export function getCharacterListButton(): HTMLButtonElement {
  const CHARACTER_LIST_BTN_SEL =
    "#root > div > header > div > button:nth-child(3)"
  const characterListBtn = document.querySelector<HTMLButtonElement>(
    CHARACTER_LIST_BTN_SEL
  )
  if (!characterListBtn) showToast("❗ 캐릭터 목록 버튼을 찾지 못했습니다.") //throw new Error("캐릭터 목록 버튼을 찾지 못했습니다.")
  return characterListBtn
}

export const getPanels = (): HTMLElement[] => {
  return Array.from(
    document.querySelectorAll('[aria-roledescription="draggable"]')
  ) as HTMLElement[]
}

export const getPanelRoot = (t: EventTarget | null): HTMLElement | null => {
  if (!(t instanceof Element)) return null
  return t.closest('[aria-roledescription="draggable"]') as HTMLElement | null
}
