import type { PlasmoCSConfig } from "plasmo"
import { showToast } from "./toast"
import { waitFor } from "~utils/wait-for"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"], // 도메인에 맞게 수정
  run_at: "document_idle",
  all_frames: true            // 캔버스가 iframe 안일 때도 주입
}

const POPOVER_SELECTOR = "div.MuiPopover-root.MuiMenu-root"     // (A)
const PAPER_SELECTOR   = "div.MuiMenu-paper"                    // (B)
const MENU_LIST        = "ul[role='menu']"
const ITEM_CLASS       = "MuiButtonBase-root MuiMenuItem-root MuiMenuItem-gutters" //  
const LABEL            = "표정 복사"

function isCharacterMenu(ul: HTMLUListElement): boolean {
  /* ① “ID 복사(개발자용)” 가 들어 있는 <li> 가 하나라도 있는가? */
  const hasIdCopyItem = [...ul.querySelectorAll("li")].some((li) =>
    li.textContent?.trim().includes("ID 복사(개발자용)")
  )

  /* ② 이미 우리가 넣은 ‘표정 복사’ 자체를 만나도 true 가 되지 않게 */
  // const isHelperItem = (li: Element) =>
  //   (li as HTMLElement).dataset.helper === "copy-expression"

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

  if (!isCharacterMenu(ul) ) return //

  if (ul.querySelector("[data-helper='copy-expression']")) return

  /* ── ① 샘플 클래스를 런타임에 추출 ────────────────── */
  const sampleLi  = ul.querySelector("li[role='menuitem']")
  const liClass   = sampleLi?.className ?? ITEM_CLASS       // fallback은 기존 하드코드

  const sampleHr  = ul.querySelector("hr")
  const hrClass   = sampleHr?.className ?? "MuiDivider-root"

  const hr = document.createElement("hr")
  hr.className = hrClass //"MuiDivider-root MuiDivider-fullWidth css-1px5dlw" // 
  hr.style.margin = "8px 0"

  const li = document.createElement("li")
  li.className = liClass//ITEM_CLASS
  li.tabIndex = -1
  li.role = "menuitem"
  li.dataset.helper = "copy-expression"
  
  li.textContent = LABEL

li.addEventListener("click", async (e) => {
  e.stopPropagation()

  /* 1. 현 메뉴 UL 안에서 '편집' 항목 찾기 & 클릭 */
  const editLi = Array.from(ul.children).find(
    (n) => n.textContent?.trim().startsWith("편집")
  ) as HTMLElement | undefined

  if (!editLi) {
    showToast("❗ '편집' 메뉴를 찾지 못했습니다.")
    return
  }
  editLi.click() // 편집 창 열기

  /* 2. 편집 다이얼로그 등장 대기 (최대 2초) */
  const dialog = await waitFor<HTMLDivElement>(
    'div.MuiDialog-paper[role="dialog"]',   // ← 이 셀렉터로만 기다린다
    {timeout: 3000}                                    // (필요하면 시간 조정)
  )
  if (!dialog) {
    showToast("❗ 캐릭터 편집 창을 찾지 못했습니다.")
    return
  }

/* ------------------------------------------------------------------
   1) 편집 다이얼로그(dialog) 안의 <form> → 두 번째 <div> = 스탠딩
------------------------------------------------------------------ */

console.log(dialog);

const form = dialog.querySelector("form")
if (!form) {
  showToast("❗ 편집 폼을 찾지 못했습니다.")
  return
}

// 간판 아이콘 찾기
const iconUrl =
  form.querySelector<HTMLImageElement>(":scope > div:first-of-type img")
    ?.src ?? null

const standingSection = form.querySelectorAll<HTMLDivElement>(":scope > div")[1]
if (!standingSection) {
  showToast("❗ 스탠딩 섹션을 찾지 못했습니다.")
  return
}

// console.log(standingSection);

/* ------------------------------------------------------------------
   2) 스탠딩 행(row) = 이미지 + faces.N.label input 을 모두 포함한 div
------------------------------------------------------------------ */
const rows = [...standingSection.querySelectorAll<HTMLDivElement>("div")].filter(
  (div) =>
    div.querySelector("img") &&
    div.querySelector('input[name^="faces."][name$=".label"]')
)

/* ------------------------------------------------------------------
   3) iconUrl / label 추출
------------------------------------------------------------------ */
const faces = rows.map((row) => {
  const iconUrl = row.querySelector<HTMLImageElement>("img")?.src ?? null
  const input = row.querySelector<HTMLInputElement>(
    'input[name^="faces."][name$=".label"]'
  )!
  const label = (input.value || input.placeholder || "").trim()
  return { iconUrl, label }
})

  /* 4. JSON 텍스트 생성 */
  // const jsonText = `"faces": ${JSON.stringify(faces, null, 2)}`

  const data = { iconUrl, faces }           // 전체 객체

  let jsonText = JSON.stringify(data)       // {"iconUrl": "...", "faces":[...]}
    .replace(/^\{|\}$/g, "")                // 🗑️ 맨 앞 {, 맨 뒤 } 제거
    .replace(/\n/g, "")                     // 줄바꿈 제거

  /* 5. 클립보드 복사 + 토스트 */
  await navigator.clipboard.writeText(jsonText)
  showToast("표정 데이터가 클립보드에 복사되었습니다.")

  /* 메뉴 & 다이얼로그 닫기(선택) ------------------------------ */
  document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })) // 메뉴 닫기
  // 이미 열린 다이얼로그를 닫고 싶다면:
  // dialog.querySelector<HTMLButtonElement>('button[aria-label="Close"]')?.click()

  /* 6) 편집 창 닫기 -------------------------------------------------- */
  const closeBtn =
    dialog
      .querySelector('header svg[data-testid="CloseIcon"]')  // 아이콘
      ?.closest<HTMLButtonElement>("button")                 // → 버튼
    || dialog.querySelector<HTMLButtonElement>("header button:first-of-type")

  closeBtn?.click()       // 버튼이 있으면 클릭
  /* --------------------------------------------------------------- */
  
})

  const idCopyItem = Array.from(ul.children).find(
    (n) => n.textContent?.trim().startsWith("ID 복사")
  )
  if (idCopyItem) {
    ul.insertBefore(hr, idCopyItem.nextSibling)
    ul.insertBefore(li, hr.nextSibling)
  } else {
    ul.append(hr, li) // 못 찾으면 맨 끝
  }

  // console.log("[MBH] 표정 복사 메뉴 추가")
}
