import { ccf } from "~core/isolated/ccfolia-api"
import { showToast } from "~utils/isolated/toast"

const POPOVER_SELECTOR = "div.MuiPopover-root.MuiMenu-root"
const PAPER_SELECTOR = "div.MuiMenu-paper"
const MENU_LIST = "ul[role='menu']"
const ITEM_CLASS = "MuiButtonBase-root MuiMenuItem-root MuiMenuItem-gutters"

export function initContextMenuActions() {
  const bodyObserver = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (
          node.nodeType === 1 &&
          (node as HTMLElement).matches?.(POPOVER_SELECTOR)
        ) {
          const paper = (node as HTMLElement).querySelector(PAPER_SELECTOR)
          if (paper) injectContextMenuItems(paper as HTMLElement)
          else {
            new MutationObserver((muts, obs) => {
              const p = (node as HTMLElement).querySelector(PAPER_SELECTOR)
              if (p) {
                injectContextMenuItems(p as HTMLElement)
                obs.disconnect()
              }
            }).observe(node, { childList: true, subtree: true })
          }
        }
      }
    }
  })

  bodyObserver.observe(document.body, { childList: true })
  // console.log("✅ [Feature] 다중 선택 컨텍스트 메뉴 주입 기능 초기화")
}

async function injectContextMenuItems(paper: HTMLElement) {
  const ul = paper.querySelector<HTMLUListElement>(MENU_LIST)
  if (!ul) return

  const menuInfo = await ccf.menus.getOpenMenuInfo()
  if (!menuInfo || menuInfo.type !== "objects") return

  const selectedObjects = menuInfo.id as Array<{ selectType: string, id: string }>
  if (!Array.isArray(selectedObjects) || selectedObjects.length === 0) return

  if (ul.querySelector("[data-helper-injected='true']")) return

  const sampleLi = ul.querySelector("li[role='menuitem']")
  const liClass = sampleLi?.className ?? ITEM_CLASS

  // ==========================================
  // 유효성 검사 (어떤 버튼을 표시할지 결정)
  // ==========================================
  const hasHideable = selectedObjects.some(obj => obj.selectType === "item" || obj.selectType === "character")
  const hasLockable = selectedObjects.some(obj => obj.selectType === "item" || obj.selectType === "marker" || obj.selectType === "deck")

  // 도우미 함수: 버튼 생성 및 클릭 핸들러 바인딩
  const createBtn = (text: string, onClick: () => Promise<void>) => {
    const li = document.createElement("li")
    li.className = liClass
    li.tabIndex = -1
    li.role = "menuitem"
    li.dataset.helperInjected = "true"
    li.textContent = text

    li.addEventListener("click", async (e) => {
      e.stopPropagation()
      const backdrop = document.querySelector(".MuiBackdrop-root") as HTMLElement
      if (backdrop) backdrop.click()
      await onClick()
    })
    return li
  }

  // ==========================================
  // [1] "집어넣기" 버튼
  // ==========================================
  if (hasHideable) {
    const hideLi = createBtn("집어넣기", async () => {
      try {
        const updates: Array<{ id: string; _type: string; data: Record<string, any> }> = []
        for (const obj of selectedObjects) {
          let _type = ""
          if (obj.selectType === "item") _type = "roomItem"
          else if (obj.selectType === "character") _type = "roomCharacter"

          if (_type) {
            updates.push({ id: obj.id, _type, data: { active: false } })
          }
        }
        if (updates.length > 0) {
          await ccf.tokens.patchBulk(updates)
          showToast(`✅ ${updates.length}개의 토큰을 숨겼습니다.`)
        }
      } catch (err) {
        console.error("[BattleHelper] 다중 객체 숨기기 중 오류:", err)
        showToast("❗ 객체를 숨기는 중 오류가 발생했습니다.")
      }
    })
    ul.append(hideLi)
  }

  // ==========================================
  // [2] "위치 고정", "크기 고정" 버튼 (일괄 설정/해제)
  // ==========================================
  if (hasLockable) {
    const validTokensInfo = selectedObjects.map(obj => {
      let _type = ""
      if (obj.selectType === "item") _type = "roomItem"
      else if (obj.selectType === "marker") _type = "roomMarker"
      else if (obj.selectType === "deck") _type = "roomDeck"
      return { ...obj, _type }
    }).filter(obj => obj._type)

    const allTokens = await ccf.tokens.getAll()
    const selectedTokensData = validTokensInfo.map(info => allTokens.find(t => t.id === info.id)).filter(Boolean)

    // 하나라도 freezed가 false(또는 undefined)라면 "크기 고정" 버튼
    // 모두 freezed가 true라면 "크기 고정 해제" 버튼
    const isAllFreezed = selectedTokensData.length > 0 && selectedTokensData.every(t => t.freezed === true)

    const setProperty = async (propName: "locked" | "freezed", newState: boolean, labelText: string) => {
      try {
        if (validTokensInfo.length === 0) return

        const updates = validTokensInfo.map(obj => ({
          id: obj.id,
          _type: obj._type,
          data: { [propName]: newState }
        }))

        if (updates.length > 0) {
          await ccf.tokens.patchBulk(updates)
          showToast(`✅ ${updates.length}개의 토큰을 ${labelText}했습니다.`)
        }
      } catch (err) {
        console.error(`[BattleHelper] 다중 객체 ${labelText} 중 오류:`, err)
        showToast(`❗ ${labelText} 중 오류가 발생했습니다.`)
      }
    }

    ul.append(createBtn("위치 고정", () => setProperty("locked", true, "위치 고정")))
    ul.append(createBtn("위치 고정 해제", () => setProperty("locked", false, "위치 고정 해제")))

    if (isAllFreezed) {
      ul.append(createBtn("크기 고정 해제", () => setProperty("freezed", false, "크기 고정 해제")))
    } else {
      ul.append(createBtn("크기 고정", () => setProperty("freezed", true, "크기 고정")))
    }

    // ==========================================
    // [3] "겹침 우선도(z) 직접 설정..." 버튼
    // ==========================================
    ul.append(createBtn("겹침 우선도 직접 설정...", async () => {
      const input = window.prompt("새로운 겹침 우선도(z) 값을 입력하세요.\n(숫자만 입력 시 고정, '+5' 또는 '-2' 입력 시 현재 값에서 증감합니다.)")
      if (input === null || input.trim() === "") return

      const isRelative = input.trim().startsWith("+") || input.trim().startsWith("-")
      const parsedValue = parseInt(input, 10)

      if (isNaN(parsedValue)) {
        showToast("❗ 올바른 숫자를 입력해주세요.")
        return
      }

      try {
        const updates = validTokensInfo.map(obj => {
          let newZ = parsedValue
          if (isRelative) {
            const currentTokenData = allTokens.find(t => t.id === obj.id)
            const currentZ = currentTokenData?.z || 0
            newZ = currentZ + parsedValue
          }
          return {
            id: obj.id,
            _type: obj._type,
            data: { z: newZ }
          }
        })

        if (updates.length > 0) {
          await ccf.tokens.patchBulk(updates)
          showToast(`✅ ${updates.length}개의 토큰의 겹침 우선도를 설정했습니다.`)
        }
      } catch (err) {
        console.error("[BattleHelper] 다중 객체 겹침 우선도 설정 중 오류:", err)
        showToast("❗ 겹침 우선도 설정 중 오류가 발생했습니다.")
      }
    }))
  }
}
