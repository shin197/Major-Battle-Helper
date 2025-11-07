// import { Storage } from "@plasmohq/storage"
// import { waitFor } from "~utils/wait-for";

// const storage = new Storage({ copiedKeyList: ["characters"] })

// export let characters: Character[] = []        // ← 저장소 대신 전역 변수

// // contents/scan.ts
// type RawStat = { value: number; max: number }
// export type Character = {
//   id: string            // img src 를 해시하거나 그대로 사용
//   name: string
//   img: string
//   initiative: string
//   listNode?: HTMLElement
//   tableNode?: HTMLElement
//   status: Record<string, RawStat> // { HP:{cur:4,max:7}, MP:{cur:2,max:6}, … }
//   params: Record<string, string>
// }

// const CHAR_LIST_SELECTOR =
//   '#root > div > div:nth-of-type(2) > div:nth-of-type(8)' // TODO: 이거 안정적으로 실행 가능하게 하기
//   // '#root > div > div.sc-liAOXi.jHiGQZ > div.sc-gDyKqB.fXPYIC' // TODO: 이거 안정적으로 실행 가능하게 하기

//   // '#root > div > div.nth-child(2) > div.sc-gDyKqB.fXPYIC' // TODO: 이거 안정적으로 실행 가능하게 하기
// const TABLE_SELECTOR =
//   '#root > div > div:nth-of-type(2) > div:nth-of-type(1)'
//   // '#root > div > div.sc-liAOXi.jHiGQZ > div.sc-bRuaPG.dkLqjp'

// /** stat `<p>HP</p><p><span>4</span>/7</p>` → {label:'HP',cur:4,max:7} */
// function parseStat(row: HTMLElement) {
//   try {
//     const [labelP, valueP] = row.querySelectorAll('p')
//     const [curSpan, maxText] = valueP.textContent!.split('/')
//     return {
//       label: labelP.textContent!.trim(),
//       value: Number(curSpan),
//       max: Number(maxText)
//     }
//   } catch {
//     return null
//   }
// }

// /** 리스트 영역에서 캐릭터 아이템 추출 */
// function scanCharacterList(): Character[] {
//   const listRoot = document.querySelector(CHAR_LIST_SELECTOR)
//   if (!listRoot) {
//     console.error("캐릭터 리스트 없음")
//     return []
//   }

//   return [...listRoot.children].map((item) => {
//     // (1) 이미지 src — 해시 클래스 무시, 구조만 신뢰
//     const img =
//       item.querySelector<HTMLImageElement>(':scope figure > img') ||
//       item.querySelector<HTMLImageElement>(':scope button img') ||
//       item.querySelector<HTMLImageElement>(':scope img')
//     const src = img?.src ?? 'unknown'

//     // (2) 이름 — 우선 화면 표시 span, 없으면 img의 aria-label
//     const nameSpan = item.querySelector(':scope figure > span')
//     const name =
//       nameSpan?.textContent?.trim() ||
//       img?.getAttribute('aria-label')?.trim() ||
//       'Char'

//     // (선택) 이니시티브 — 별도 위치를 확정 못 했다면 기본값 유지
//     const initiative = '0'

//     // (3) 스탯들 — statsContainer의 "직속 자식"만 순회
//     const statsContainer =
//       item.querySelector<HTMLElement>(':scope > div:last-child') ||
//       item.querySelector<HTMLElement>(':scope > div') // 구조 바뀔 때 대비

//     const status: Record<string, RawStat> = {}

//     if (statsContainer) {
//       const candidates: HTMLElement[] = [...statsContainer.querySelectorAll<HTMLElement>(':scope div')]

//       for (const row of candidates) {
//         const s = parseStat(row) // 기존 파서 그대로 사용
//         if (!s) continue

//         // 이미 같은 라벨을 채웠으면 스킵 (중복/오인 방지)
//         if (status[s.label] !== undefined) continue

//         status[s.label] = {
//           value: s.value,
//           max: Number.isNaN(s.max) ? 0 : s.max
//         }
//       }
//     }

//     const params: Record<string, string> = {}

//     return {
//       id: src,                    // 필요하면 sha-1 등으로 축약
//       name,
//       initiative,
//       img: src,
//       listNode: item as HTMLElement,
//       status,
//       params
//     }
//   })
// }

// /** 테이블 영역에서 img[src] 로 노드 매칭 */
// function attachTableNodes(chars: Character[]) {
//   const tableRoot = document.querySelector(TABLE_SELECTOR)
//   if (!tableRoot) return

//   // 1) src → Character 매핑
//   const map = new Map<string, Character>()
//   chars.forEach((c) => map.set(c.img, c))

//   // 2) 테이블 전체 순회
//   tableRoot
//     .querySelectorAll<HTMLElement>('div[role="button"] > figure')
//     .forEach((fig) => {
//       const img  = fig.querySelector<HTMLImageElement>('img')
//       if (!img) return

//       const src  = img.src
//       const name = fig.querySelector('span')?.textContent?.trim() ?? ''

//       // 3) 리스트에서 이미 발견한 캐릭터면 업데이트
//       const c = map.get(src)
//       if (c) {
//         c.tableNode = fig.parentElement as HTMLElement // <div role="button">
//         c.name = name                    // 빈 이름 보충
//       }
//       // 4) 리스트에 없던 ‘테이블 전용’ 캐릭터라면 새로 push
//       // else {
//       //   chars.push({
//       //     id: src,
//       //     name,
//       //     img: src,
//       //     tableNode: fig.parentElement as HTMLElement,
//       //     listNode: undefined,
//       //     status: {},
//       //     initiative: "0"
//       //   })
//       // }
//     })
// }

// // function attachTableNodes(chars: Character[]) {
// //   const tableRoot = document.querySelector<HTMLElement>(TABLE_SELECTOR)
// //   if (!tableRoot) return

// //   const tblIndex = buildTableIndex(tableRoot)

// //   // chars.forEach((c) => {
// //   //   const node = tableRoot.querySelector<HTMLImageElement>(`img[src="${c.img}"]`)
// //   //   if (node) c.tableNode = node.closest<HTMLElement>('div[role="button"]') ?? undefined
// //   // })

// //   chars.forEach((c) => {
// //     c.tableNode = tblIndex.get(c.name)   // “이름”으로 1:1 매칭
// //       ?? c.tableNode                     // (여전히 img–src 매칭이 살아 있으면 유지)
// //     // c.name = tblIndex.get()
// //   })
// // }
// // function attachTableNodes(chars: Character[]) {
// //   const tableRoot = document.querySelector(TABLE_SELECTOR)
// //   if (!tableRoot) return

// // //  > div > div > div:nth-child(35) > div > div:nth-child(1) > figure > span

// //   chars.forEach((c) => {
// //     const node = tableRoot.querySelector<HTMLImageElement>(`img[src="${c.img}"]`)
// //     if (node) c.tableNode = node.closest<HTMLElement>('div[role="button"]') ?? undefined
// //   })
// // }

// async function rescanAndStore() {
//   // console.log("Scan Characters...")
//   characters = scanCharacterList()
//   attachTableNodes(characters)
//   await storage.set("characters", characters)
//   console.debug("캐릭터 스캔 완료:", characters)
// }

// (async () => {
//   // 패널이 뜰 때까지 최대 15초 대기
//   const listRoot  = await waitFor(CHAR_LIST_SELECTOR)
//   const tableRoot = await waitFor(TABLE_SELECTOR)

//   initObservers(listRoot, tableRoot) // ← 기존 MutationObserver 등록
//   // rescanAndStore()                   // 첫 스캔
// })().catch(console.warn)

// /** 초기 1회 */
// // rescanAndStore()

// /** 리스트·테이블 모두 감시 */
// function initObservers(listRoot, tableRoot){
//   const obsCfg = { childList: true, subtree: true }
//   const listObserver = new MutationObserver(rescanAndStore)
//   // const tblObserver = new MutationObserver(rescanAndStore)

//   if (listRoot) listObserver.observe(listRoot, obsCfg)
//   // if (tableRoot) tblObserver.observe(tableRoot, obsCfg)
// }

// /** 다른 스크립트가 필요할 때 최신 캐릭터 배열 요청 */
// chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
//   if (msg.type === "GET_CHARACTERS") {
//     storage.get("characters").then(reply)
//     reply(characters)
//     return true // async reply
//   }
// })

// // const GLOBAL_KEY = "characters"  // window.characters, localStorage.characters 공용 키
// const RAM: { map?: Record<string, Character> } = {} // 세션 캐시

// function getGlobalCharacters(): Record<string, Character> | null {
//   // 1) 전역(window)
//   const g: any = (globalThis as any)
//   if (g && g["characters"] && typeof g["characters"] === "object") return g["characters"]

//   // 2) 로컬스토리지
//   try {
//     const raw = localStorage.getItem("characters")
//     if (raw) return JSON.parse(raw)
//   } catch {}
//   return null
// }
