import { Storage } from "@plasmohq/storage"
import { waitFor } from "~utils/wait-for";

const storage = new Storage({ copiedKeyList: ["characters"] })

let characters: Character[] = []        // ← 저장소 대신 전역 변수

// contents/scan.ts
type RawStat = { value: number; max: number }
type Character = {
  id: string            // img src 를 해시하거나 그대로 사용
  name: string
  img: string
  initiative: string
  listNode?: HTMLElement
  tableNode?: HTMLElement
  status: Record<string, RawStat> // { HP:{cur:4,max:7}, MP:{cur:2,max:6}, … }
}

const CHAR_LIST_SELECTOR =
  '#root > div > div.sc-liAOXi.jHiGQZ > div.sc-juNKnw.hVnzkT'
const TABLE_SELECTOR =
  '#root > div > div.sc-liAOXi.jHiGQZ > div.sc-jHUtOf.kvHjSA'


/** stat `<p>HP</p><p><span>4</span>/7</p>` → {label:'HP',cur:4,max:7} */
function parseStat(row: HTMLElement) {
  try {
    const [labelP, valueP] = row.querySelectorAll('p')
    const [curSpan, maxText] = valueP.textContent!.split('/')
    return {
      label: labelP.textContent!.trim(),
      value: Number(curSpan),
      max: Number(maxText)
    }
  } catch {
    return null
  }
}

/** 리스트 영역에서 캐릭터 아이템 추출 */
function scanCharacterList(): Character[] {
  const listRoot = document.querySelector(CHAR_LIST_SELECTOR)
  if (!listRoot) console.error("캐릭터 리스트 없음")
  if (!listRoot) return []

  return [...listRoot.children].map((item) => {
    // (1) 이미지 src
    const img = item.querySelector<HTMLImageElement>('img')!
    const src = img?.src ?? 'unknown'
    
    const name = "Char"

    // (2) 이름(리스트에 span, aria-label 둘 다 시도)
    const initiative =
      img?.getAttribute('aria-label') ??
      item.querySelector('span')?.textContent?.trim() ??
      '0'

    // (3) 스탯들
    const statsContainer = item.querySelector(':scope > div')
    const status: Record<string, RawStat> = {}
    if (statsContainer) {
      statsContainer
        .querySelectorAll<HTMLElement>('div.sc-jdXLlt') // 한 줄씩
        .forEach((row) => {
          const s = parseStat(row)
          if (s) status[s.label] = { value: s.value, max: isNaN(s.max)? 0 : s.max }
        })
    }

    return {
      id: src, // 필요하면 sha-1 등으로 축약
      name,
      initiative,
      img: src,
      listNode: item as HTMLElement,
      status
    }
  })
}

// function buildTableIndex(tableRoot: HTMLElement) {
//   const index = new Map<string, HTMLElement>()

//   // console.log("tableRootNotNull")

//   // “드래그 가능한 캐릭터 카드”는 role="button" div 안의 <figure>
//   const figures = tableRoot.querySelectorAll<HTMLDivElement>(
//     'div[role="button"] > figure'
//   )

//   figures.forEach((fig) => {
//     const name = fig.querySelector('span')?.textContent?.trim()
//     if (!name) return                    // 스크린·마커 패널 등은 span 없음
//     console.debug(name)
//     const buttonDiv = fig.closest<HTMLElement>('div[role="button"]')!
//     index.set(name, buttonDiv)           // 이름 → 노드 Map
//   })

//   return index
// }

/** 테이블 영역에서 img[src] 로 노드 매칭 */
function attachTableNodes(chars: Character[]) {
  const tableRoot = document.querySelector(TABLE_SELECTOR)
  if (!tableRoot) return

  // 1) src → Character 매핑
  const map = new Map<string, Character>()
  chars.forEach((c) => map.set(c.img, c))

  // 2) 테이블 전체 순회
  tableRoot
    .querySelectorAll<HTMLElement>('div[role="button"] > figure')
    .forEach((fig) => {
      const img  = fig.querySelector<HTMLImageElement>('img')
      if (!img) return

      const src  = img.src
      const name = fig.querySelector('span')?.textContent?.trim() ?? ''

      // 3) 리스트에서 이미 발견한 캐릭터면 업데이트
      const c = map.get(src)
      if (c) {
        c.tableNode = fig.parentElement as HTMLElement // <div role="button">
        c.name = name                    // 빈 이름 보충
      }
      // 4) 리스트에 없던 ‘테이블 전용’ 캐릭터라면 새로 push
      // else {
      //   chars.push({
      //     id: src,
      //     name,
      //     img: src,
      //     tableNode: fig.parentElement as HTMLElement,
      //     listNode: undefined,
      //     status: {},
      //     initiative: "0"
      //   })
      // }
    })
}

// function attachTableNodes(chars: Character[]) {
//   const tableRoot = document.querySelector<HTMLElement>(TABLE_SELECTOR)
//   if (!tableRoot) return

//   const tblIndex = buildTableIndex(tableRoot)

//   // chars.forEach((c) => {
//   //   const node = tableRoot.querySelector<HTMLImageElement>(`img[src="${c.img}"]`)
//   //   if (node) c.tableNode = node.closest<HTMLElement>('div[role="button"]') ?? undefined
//   // })

//   chars.forEach((c) => {
//     c.tableNode = tblIndex.get(c.name)   // “이름”으로 1:1 매칭
//       ?? c.tableNode                     // (여전히 img–src 매칭이 살아 있으면 유지)
//     // c.name = tblIndex.get()
//   })
// }
// function attachTableNodes(chars: Character[]) {
//   const tableRoot = document.querySelector(TABLE_SELECTOR)
//   if (!tableRoot) return

// //  > div > div > div:nth-child(35) > div > div:nth-child(1) > figure > span

//   chars.forEach((c) => {
//     const node = tableRoot.querySelector<HTMLImageElement>(`img[src="${c.img}"]`)
//     if (node) c.tableNode = node.closest<HTMLElement>('div[role="button"]') ?? undefined
//   })
// }

async function rescanAndStore() {
  // console.log("Scan Characters...")
  characters = scanCharacterList()
  attachTableNodes(characters)
  await storage.set("characters", characters)
  console.debug("캐릭터 스캔 완료:", characters)
}


(async () => {
  // 패널이 뜰 때까지 최대 15초 대기
  const listRoot  = await waitFor(CHAR_LIST_SELECTOR)
  const tableRoot = await waitFor(TABLE_SELECTOR)

  initObservers(listRoot, tableRoot) // ← 기존 MutationObserver 등록
  // rescanAndStore()                   // 첫 스캔
})().catch(console.warn)

/** 초기 1회 */
// rescanAndStore()

/** 리스트·테이블 모두 감시 */
function initObservers(listRoot, tableRoot){
  const obsCfg = { childList: true, subtree: true }
  const listObserver = new MutationObserver(rescanAndStore)
  // const tblObserver = new MutationObserver(rescanAndStore)

  if (listRoot) listObserver.observe(listRoot, obsCfg)
  // if (tableRoot) tblObserver.observe(tableRoot, obsCfg)
}


/** 다른 스크립트가 필요할 때 최신 캐릭터 배열 요청 */
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === "GET_CHARACTERS") {
    storage.get("characters").then(reply)
    reply(characters)
    return true // async reply
  }
})