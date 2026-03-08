// features/token-alt-click.ts

import { ccf } from "~core/isolated/ccfolia-api"
import { getChatInputBox, getPanelRoot } from "~utils/elements"
import { findItemIdFromDom } from "~utils/main/token"
import { setNativeValue } from "~utils/utils"

// ✨ 가장 최근에 마우스가 올라간 토큰의 ID를 저장하는 변수
let lastHoveredTokenId: string | null = null

export function initTokenAltClick() {
  // ==========================================================
  // 0. 마우스 호버링 토큰 정밀 추적기
  // ==========================================================
  document.addEventListener(
    "pointermove",
    (e: PointerEvent) => {
      const target = e.target as HTMLElement
      const root = getPanelRoot(target)

      // 타겟이나 부모 요소에서 토큰 ID를 추출합니다.
      const itemId =
        findItemIdFromDom(target) || (root ? findItemIdFromDom(root) : null)

      // 허공을 가리키면 null, 토큰 위면 해당 ID를 저장합니다.
      lastHoveredTokenId = itemId
    },
    { passive: true }
  )

  // ==========================================================
  // 1. 기존 기능: Alt + 좌클릭으로 캐릭터 이름 채팅창에 입력
  // ==========================================================
  document.addEventListener(
    "pointerdown",
    (e: PointerEvent) => {
      if (!e.isTrusted) return

      if (e.button === 0 && e.altKey) {
        const root = getPanelRoot(e.target as HTMLElement)
        if (!root) return

        e.preventDefault()
        e.stopImmediatePropagation()
        e.stopPropagation()

        const targetId =
          findItemIdFromDom(e.target as HTMLElement) || findItemIdFromDom(root)
        if (!targetId) return
        ;(async () => {
          try {
            const character = await ccf.characters.getById(targetId)
            if (!character || !character.name) return

            const ta = getChatInputBox()
            if (ta instanceof HTMLTextAreaElement) {
              const insertText = `[${character.name}] `

              const cursorStart = ta.selectionStart
              const cursorEnd = ta.selectionEnd
              const textBefore = ta.value.substring(0, cursorStart)
              const textAfter = ta.value.substring(cursorEnd)

              const newValue = textBefore + insertText + textAfter

              setNativeValue(ta, newValue)

              setTimeout(() => {
                ta.focus()
                const newCursorPos = cursorStart + insertText.length
                ta.setSelectionRange(newCursorPos, newCursorPos)
              }, 0)
            }
          } catch (err) {
            console.error(
              "[BattleHelper] Alt+클릭 캐릭터 정보 가져오기 실패:",
              err
            )
          }
        })()
      }
    },
    { capture: true }
  )

  // ==========================================================
  // 2. 신규 기능: 토큰 위에서 'A' 키를 눌러 hideStatus 토글
  // ==========================================================
  document.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      const activeTag = (e.target as HTMLElement)?.tagName
      const isInput =
        activeTag === "INPUT" ||
        activeTag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      if (isInput) return

      if (e.key === "a" || e.key === "A") {
        // ✨ 핵심: 좌표 계산을 버리고, pointermove가 기억해둔 확실한 ID를 사용합니다.
        if (!lastHoveredTokenId) return
        ;(async () => {
          try {
            // ID로 캐릭터 데이터를 가져옵니다.
            const character = await ccf.characters.getById(lastHoveredTokenId)
            if (!character || !character.name) return

            // 이름으로 toggleCharacterProp API를 호출하여 상태를 숨김/표시 전환합니다.
            await ccf.toggleCharacterProp(character.name, "hideStatus")
          } catch (err) {
            console.error("[BattleHelper] 상태 표시 토글 실패:", err)
          }
        })()
      }
    },
    { capture: true }
  )
}
