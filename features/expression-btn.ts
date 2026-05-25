import { ANCHOR_SPECS } from "~utils/anchors"
import { getOrFindAnchor } from "~utils/elements"

const BTN_ID = "ccf-helper-expression-btn"

export async function initExpressionButton() {
  // 지속적으로 버튼 삽입 위치를 감시하는 Observer
  const observer = new MutationObserver(async () => {
    try {
      // 1. 앵커(채팅 팔레트 편집창 버튼) 요소를 찾습니다.
      const anchorBtn = await getOrFindAnchor(ANCHOR_SPECS.CHARACTER_CHAT_PALETTE_EDIT_BTN)
      if (!anchorBtn) return

      // 2. 부모 컨테이너들을 거슬러 올라가 채팅 팔레트 버튼 컨테이너를 찾습니다.
      const editBtnContainer = anchorBtn.parentElement
      if (!editBtnContainer) return

      const chatPaletteBtnContainer = editBtnContainer.previousElementSibling
      if (!chatPaletteBtnContainer) return

      const flexContainer = editBtnContainer.parentElement
      if (!flexContainer) return

      if (flexContainer.querySelector(`#${BTN_ID}-wrapper`)) return

      // 3. 버튼 래퍼 및 엘리먼트 생성
      const wrapper = document.createElement("div")
      wrapper.id = `${BTN_ID}-wrapper`
      wrapper.style.display = "flex"
      // wrapper.style.marginRight = "4px"

      const exprBtn = document.createElement("button")
      exprBtn.id = BTN_ID
      // 코코포리아 기존 버튼들과 유사한 스타일을 위해 클래스 복사 (또는 인라인 스타일)
      exprBtn.className = anchorBtn.className
      exprBtn.style.minWidth = "auto"
      exprBtn.style.padding = "6px 6px"

      // 4. 스마일 아이콘 (SVG) 추가
      exprBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
        </svg>
      `

      // 5. 클릭 이벤트 (추후 세부 구현 예정)
      exprBtn.addEventListener("click", (e) => {
        e.preventDefault()
        e.stopPropagation()
        console.log("[BattleHelper] 표정 변경 버튼 클릭됨 - 기능 미구현")
        // TODO: 표정 목록 표시 및 변경 로직 추가
      })

      // 6. 채팅 팔레트 버튼의 직전 형제 노드로 삽입
      wrapper.appendChild(exprBtn)
      flexContainer.insertBefore(wrapper, chatPaletteBtnContainer)
    } catch (e) {
      // 앵커를 찾지 못한 경우 등은 무시 (패널이 열려있지 않음)
    }
  })

  // body의 변경사항을 감지 (사이드바가 열리고 닫히는 것을 감지)
  observer.observe(document.body, { childList: true, subtree: true })
}
