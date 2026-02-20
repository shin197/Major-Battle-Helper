import type { PlasmoCSConfig } from "plasmo"

import { ccf } from "./ccfolia-api"
import { showToast } from "./toast"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"], // 도메인에 맞게 수정
  run_at: "document_idle",
  all_frames: true // 캔버스가 iframe 안일 때도 주입
}

const POPOVER_SELECTOR = "div.MuiPopover-root.MuiMenu-root" // (A)
const PAPER_SELECTOR = "div.MuiMenu-paper" // (B)
const MENU_LIST = "ul[role='menu']"
const ITEM_CLASS = "MuiButtonBase-root MuiMenuItem-root MuiMenuItem-gutters" //
const LABEL = "표정 복사"

function isCharacterMenu(ul: HTMLUListElement): boolean {
  const hasIdCopyItem = [...ul.querySelectorAll("li")].some((li) =>
    li.textContent?.trim().includes("ID 복사(개발자용)")
  )

  return hasIdCopyItem //&& ![...ul.querySelectorAll("li")].every(isHelperItem)
}

let lastRightClickTarget: HTMLElement | null = null

document.addEventListener("contextmenu", (e) => {
  lastRightClickTarget = e.target as HTMLElement
})

function isCharacterTarget(): boolean {
  if (!lastRightClickTarget) return false
  /* (예) 캐릭터 토큰은 div[data-id][data-character-id] 를 품고 있음 */
  return !!lastRightClickTarget.closest("div[data-character-id]")
}

/* ──────────────────────────────────────────────────────────
   Observer – <body> 직속으로 생성되는 메뉴 div 감시
─────────────────────────────────────────────────────────── */
const bodyObserver = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      // (A) 포털 div가 body에 붙으면
      if (
        node.nodeType === 1 &&
        (node as HTMLElement).matches?.(POPOVER_SELECTOR)
      ) {
        // (B) 메뉴 박스는 그 안에 바로 생성 → 따로 observe 필요 X
        const paper = (node as HTMLElement).querySelector(PAPER_SELECTOR)
        if (paper) injectMenuItem(paper as HTMLElement)
        else {
          // rare: paper가 나중에 들어올 수도 → 한 번 더 observe
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

bodyObserver.observe(document.body, { childList: true }) // 포털은 항상 body 직속

/* ──────────────────────────────────────────────────────────
   메뉴 항목 삽입
─────────────────────────────────────────────────────────── */
function injectMenuItem(paper: HTMLElement) {
  const ul = paper.querySelector<HTMLUListElement>(MENU_LIST)
  if (!ul) return

  if (!isCharacterMenu(ul)) return //

  if (ul.querySelector("[data-helper='copy-expression']")) return

  /* ── ① 샘플 클래스를 런타임에 추출 ────────────────── */
  const sampleLi = ul.querySelector("li[role='menuitem']")
  const liClass = sampleLi?.className ?? ITEM_CLASS // fallback은 기존 하드코드
  const li = document.createElement("li")
  li.className = liClass //ITEM_CLASS
  li.tabIndex = -1
  li.role = "menuitem"
  li.dataset.helper = "copy-expression"

  li.textContent = LABEL

  const idCopyItem = Array.from(ul.children).find((n) =>
    n.textContent?.trim().startsWith("ID 복사")
  ) as HTMLElement | undefined
  if (idCopyItem) {
    li.addEventListener("click", async (e) => {
      e.stopPropagation()
      // ID 복사 메뉴 클릭 (코코포리아 기본 기능: 클립보드에 ID 복사 후 메뉴 닫힘)
      idCopyItem.click()
      try {
        // await new Promise((res) => setTimeout(res, 50))
        const charId = await navigator.clipboard.readText()

        if (!charId) {
          showToast("❗ 캐릭터 ID를 가져오지 못했습니다.")
          return
        }
        /* 3. ccfoliaAPI를 통해 캐릭터 데이터 직접 가져오기 */
        // const characterData = await callCcfolia<any>("getCharacterById", charId)
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

        /* 5. 클립보드에 캐릭터 ID 대신 완성된 표정 데이터로 덮어쓰기 */
        await navigator.clipboard.writeText(jsonText)
        showToast("표정 데이터가 클립보드에 복사되었습니다.")
      } catch (err) {
        console.error("표정 복사 중 오류:", err)
        showToast("❗ 데이터를 복사하는 중 오류가 발생했습니다.")
      }
    })
    ul.insertBefore(li, idCopyItem.nextSibling)
  } else {
    ul.append(li) // 못 찾으면 맨 끝
  }
}
