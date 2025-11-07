import { Storage } from "@plasmohq/storage"

import {
  getChatInputBox,
  getCurrentCharacterChatPaletteEditButton,
  getCurrentCharacterNameInput
} from "~utils/elements"

import { showToast } from "./toast"

const CODE2NUM: Record<string, string> = {
  Digit0: "0",
  Numpad0: "0",
  Digit1: "1",
  Numpad1: "1",
  Digit2: "2",
  Numpad2: "2",
  Digit3: "3",
  Numpad3: "3",
  Digit4: "4",
  Numpad4: "4",
  Digit5: "5",
  Numpad5: "5",
  Digit6: "6",
  Numpad6: "6",
  Digit7: "7",
  Numpad7: "7",
  Digit8: "8",
  Numpad8: "8",
  Digit9: "9",
  Numpad9: "9"
}

const storage = new Storage()
const NUMS = "0123456789"

export function getCurrentCharacterName(): string | null {
  const el = getCurrentCharacterNameInput()
  const btn = getCurrentCharacterChatPaletteEditButton()
  if (!el) return null
  if (
    btn &&
    (btn.disabled ||
      btn.hasAttribute("disabled") ||
      btn.classList.contains("Mui-disabled"))
  ) {
    return null
  }
  return el.value
}

async function saveSlot(idx: string) {
  const el = getCurrentCharacterNameInput()
  const btn = getCurrentCharacterChatPaletteEditButton()
  if (!el) return
  if (
    btn &&
    (btn.disabled ||
      btn.hasAttribute("disabled") ||
      btn.classList.contains("Mui-disabled"))
  ) {
    showToast(`❗ ${idx}번 슬롯 저장 실패`)
    return
  }
  await storage.set(`slot${idx}`, el.value)
  showToast(`${idx}번 슬롯 저장됨`)
}

async function loadSlot(idx: string) {
  const val = await storage.get<string>(`slot${idx}`)
  if (val == null) return
  const el = getCurrentCharacterNameInput()
  if (!el) return
  el.value = val
  ;["input", "change"].forEach((t) =>
    el.dispatchEvent(new Event(t, { bubbles: true }))
  )
  // flash(`${idx}번 슬롯 불러옴`)
}

// Alt+숫자 = 저장,  숫자 = 불러오기
document.addEventListener(
  "keydown",
  (e) => {
    // const idx = e.key
    const idx = CODE2NUM[e.code]
    if (!NUMS.includes(idx)) return

    // 타깃 입력란 포커스일 때만 동작
    // console.log(idx);
    if (
      document.activeElement !== getCurrentCharacterNameInput() &&
      document.activeElement !== getChatInputBox()
    )
      return

    let stopDefault = false

    if (!e.altKey && e.ctrlKey && !e.metaKey && !e.shiftKey) {
      saveSlot(idx) // Ctrl+Shift+숫자 → 저장
      stopDefault = true
    } else if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      loadSlot(idx) // 숫자 단독 → 불러오기
      stopDefault = true
    }
    if (stopDefault) {
      e.preventDefault()
      e.stopPropagation()
    }
  },
  true
)
