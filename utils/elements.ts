import { showToast } from "~contents/toast"

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

export function getSideCharacterListTab(): HTMLDivElement | null {
  const SIDE_CHAR_LIST_SELECTOR =
    "#root > div > div:nth-of-type(2) > div:nth-of-type(8)"
  const el = document.querySelector<HTMLDivElement>(SIDE_CHAR_LIST_SELECTOR)
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
