import { ANCHOR_SPECS } from "~utils/anchors"
import { getOrFindAnchor } from "~utils/elements"
import { ccf } from "~core/isolated/ccfolia-api"
import { getCurrentCharacterName } from "~features/slot-shortcut"

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
      // 코코포리아 기존 버튼들과 유사한 스타일을 위해 클래스 복사 (Mui-disabled 등 비활성화 클래스는 제거)
      exprBtn.className = anchorBtn.className.replace(/Mui-disabled/g, "").trim()
      exprBtn.disabled = false
      exprBtn.style.minWidth = "auto"
      exprBtn.style.padding = "6px 6px"

      // 4. 스마일 아이콘 (SVG) 추가
      exprBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
        </svg>
      `

      // 5. 클릭 이벤트: 표정 목록 드롭다운 표시
      exprBtn.addEventListener("click", async (e) => {
        e.preventDefault()
        e.stopPropagation()

        // 이미 드롭다운이 열려있다면 닫기
        const existingDropdown = document.getElementById("ccf-helper-expression-dropdown")
        if (existingDropdown) {
          existingDropdown.remove()
          return
        }

        // 현재 활성화된 캐릭터 이름 가져오기

        const charName = getCurrentCharacterName()
        if (!charName) {
          console.warn("[BattleHelper] 현재 선택된 캐릭터가 없습니다.")
          return
        }

        // 캐릭터 데이터 가져오기

        const character = await ccf.getCharacterByName(charName)
        if (!character || !character.faces || character.faces.length === 0) {
          console.warn("[BattleHelper] 캐릭터를 찾을 수 없거나 표정 데이터가 없습니다.")
          return
        }

        // 커스텀 드롭다운 컨테이너 생성
        const dropdown = document.createElement("div")
        dropdown.id = "ccf-helper-expression-dropdown"
        dropdown.style.position = "absolute"
        dropdown.style.zIndex = "9999"
        dropdown.style.backgroundColor = "#424242" // 다크테마 기준 (필요시 CSS 변수 등 활용)
        dropdown.style.border = "1px solid rgba(255,255,255,0.12)"
        dropdown.style.borderRadius = "4px"
        dropdown.style.boxShadow = "0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)"
        dropdown.style.padding = "8px 0"
        dropdown.style.maxHeight = "300px"
        dropdown.style.overflowY = "auto"
        dropdown.style.minWidth = "150px"
        dropdown.style.color = "#fff"

        // 버튼 기준 왼쪽 위로 열리도록 위치 조정 (채팅창이 우측 하단이므로)
        const rect = exprBtn.getBoundingClientRect()
        dropdown.style.bottom = `${window.innerHeight - rect.top + 4}px`
        dropdown.style.right = `${window.innerWidth - rect.right}px`

        // 각 표정을 순회하며 항목 생성
        character.faces.forEach((face: any, index: number) => {
          const item = document.createElement("div")
          item.style.display = "flex"
          item.style.alignItems = "center"
          item.style.padding = "6px 6px"
          item.style.cursor = "pointer"
          item.style.transition = "background-color 0.2s"
          item.onmouseenter = () => { item.style.backgroundColor = "rgba(255,255,255,0.08)" }
          item.onmouseleave = () => { item.style.backgroundColor = "transparent" }

          const img = document.createElement("img")
          img.src = face.iconUrl
          img.style.width = "48px"
          img.style.height = "48px"
          img.style.borderRadius = "50%"
          img.style.marginRight = "12px"
          img.style.objectFit = "cover"

          const label = document.createElement("span")
          label.textContent = face.label || `표정 ${index + 1}`
          label.style.fontSize = "14px"

          item.appendChild(img)
          item.appendChild(label)

          item.addEventListener("click", async (ev) => {
            ev.stopPropagation()
            // TODO: 실제 표정 변경 로직 구현. 
            // 코코포리아는 보드 위 캐릭터의 표정을 angle(인덱스)로 관리할 가능성이 큼.
            // 일단 콘솔에 찍고 patchCharacter는 차후 확정
            // console.log(`[BattleHelper] ${charName} 표정 변경 선택됨:`, face.label)
            ccf.setCharacterFace(charName, face.label)
            dropdown.remove()
          })

          dropdown.appendChild(item)
        })

        document.body.appendChild(dropdown)

        // 외부 클릭 시 드롭다운 닫기
        const closeDropdown = (ev: MouseEvent) => {
          if (!dropdown.contains(ev.target as Node) && ev.target !== exprBtn) {
            dropdown.remove()
            document.removeEventListener("mousedown", closeDropdown)
          }
        }
        document.addEventListener("mousedown", closeDropdown)
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
