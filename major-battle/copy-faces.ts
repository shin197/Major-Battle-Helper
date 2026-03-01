import type { PlasmoCSConfig } from "plasmo"

import { ccf } from "../core/isolated/ccfolia-api"
import { showToast } from "../utils/isolated/toast"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  run_at: "document_idle",
  all_frames: true
}

const POPOVER_SELECTOR = "div.MuiPopover-root.MuiMenu-root" // (A)
const PAPER_SELECTOR = "div.MuiMenu-paper" // (B)
const MENU_LIST = "ul[role='menu']"
const ITEM_CLASS = "MuiButtonBase-root MuiMenuItem-root MuiMenuItem-gutters"
const LABEL = "표정 복사"

/* ──────────────────────────────────────────────────────────
   Observer – <body> 직속으로 생성되는 메뉴 div 감시
─────────────────────────────────────────────────────────── */
export function initCopyFaces() {
  const bodyObserver = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (
          node.nodeType === 1 &&
          (node as HTMLElement).matches?.(POPOVER_SELECTOR)
        ) {
          const paper = (node as HTMLElement).querySelector(PAPER_SELECTOR)
          if (paper) injectMenuItem(paper as HTMLElement)
          else {
            new MutationObserver((muts, obs) => {
              const p = (node as HTMLElement).querySelector(PAPER_SELECTOR)
              if (p) {
                injectMenuItem(p as HTMLElement)
                obs.disconnect()
              }
            }).observe(node, { childList: true, subtree: true })
          }
        }
      }
    }
  })

  bodyObserver.observe(document.body, { childList: true })
  // console.log("✅ [Feature] 표정 복사 기능 초기화 완료")
}

/* ──────────────────────────────────────────────────────────
   메뉴 항목 삽입 (Redux API + 원본 UI 로직)
─────────────────────────────────────────────────────────── */
async function injectMenuItem(paper: HTMLElement) {
  const ul = paper.querySelector<HTMLUListElement>(MENU_LIST)
  if (!ul) return

  // 💡 1. 불안정한 DOM 텍스트 감지 대신, API를 호출해 메뉴 종류와 ID를 확실하게 가져옵니다.
  const menuInfo = await ccf.menus.getOpenMenuInfo()

  // 열린 메뉴가 캐릭터 메뉴가 아니면 중단
  if (!menuInfo || menuInfo.type !== "character") return

  // 💡 2. API에서 가져온 안전한 캐릭터 ID
  const charId = menuInfo.id

  // 중복 생성 방지
  if (ul.querySelector("[data-helper='copy-expression']")) return

  /* ── ① 샘플 클래스를 런타임에 추출 (원본 로직 유지) ────────────────── */
  const sampleLi = ul.querySelector("li[role='menuitem']")
  const liClass = sampleLi?.className ?? ITEM_CLASS
  const li = document.createElement("li")
  li.className = liClass
  li.tabIndex = -1
  li.role = "menuitem"
  li.dataset.helper = "copy-expression"
  li.textContent = LABEL

  // 💡 메뉴 위치를 잡기 위해 "ID 복사" DOM을 찾습니다. (기능적 의존 X, 오직 위치 잡기용)
  const idCopyItem = Array.from(ul.children).find((n) =>
    n.textContent?.trim().startsWith("ID 복사")
  ) as HTMLElement | undefined

  li.addEventListener("click", async (e) => {
    e.stopPropagation()

    // 메뉴 강제 닫기 (코코포리아 백드롭 클릭)
    const backdrop = document.querySelector(".MuiBackdrop-root") as HTMLElement
    if (backdrop) backdrop.click()

    try {
      /* 3. ccfoliaAPI를 통해 캐릭터 데이터 직접 가져오기 (클립보드 해킹 제거) */
      const characterData = await ccf.getCharacterById(charId)

      if (!characterData) {
        showToast("❗ 캐릭터 데이터를 불러오지 못했습니다.")
        return
      }

      /* 4. 필요한 표정 데이터만 추출하여 JSON 포맷팅 */
      const data = {
        iconUrl: characterData.iconUrl || "",
        faces: characterData.faces || []
      }
      let jsonText = JSON.stringify(data)
        .replace(/^\{|\}$/g, "") // 🗑️ 맨 앞 {, 맨 뒤 } 제거
        .replace(/\n/g, "") // 줄바꿈 제거

      /* 5. 클립보드에 완성된 표정 데이터 쓰기 */
      await navigator.clipboard.writeText(jsonText)
      showToast("표정 데이터가 클립보드에 복사되었습니다.")
    } catch (err) {
      console.error("표정 복사 중 오류:", err)
      showToast("❗ 데이터를 복사하는 중 오류가 발생했습니다.")
    }
  })

  // "ID 복사" 메뉴가 있으면 그 바로 밑에, 없으면 맨 아래에 추가합니다.
  if (idCopyItem) {
    ul.insertBefore(li, idCopyItem.nextSibling)
  } else {
    ul.append(li)
  }
}
