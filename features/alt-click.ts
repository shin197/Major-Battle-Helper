// features/token-alt-click.ts

import { ccf } from "~core/isolated/ccfolia-api"
import { getChatInputBox, getPanelRoot } from "~utils/elements"
import { findItemIdFromDom } from "~utils/main/token"
import { setNativeValue } from "~utils/utils"

export function initTokenAltClick() {
  // 별도의 pointerdown 이벤트 리스너를 문서 전체에 등록합니다.
  document.addEventListener(
    "pointerdown",
    (e: PointerEvent) => {
      if (!e.isTrusted) return

      // Alt + 좌클릭 감지
      if (e.button === 0 && e.altKey) {
        const root = getPanelRoot(e.target as HTMLElement)
        if (!root) return

        // ✨ 중요: 다른 이벤트(드래그 등)가 실행되지 않도록 여기서 완벽히 차단
        e.preventDefault()
        e.stopImmediatePropagation()
        e.stopPropagation()

        const targetId =
          findItemIdFromDom(e.target as HTMLElement) || findItemIdFromDom(root)
        if (!targetId) return // 비동기 처리
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
    {
      // ✨ 핵심: React나 다른 스크립트보다 먼저 이벤트를 가로채기 위해 capture를 true로 설정
      capture: true
    }
  )
}
