import { ccf } from "~core/isolated/ccfolia-api"
import { injectDragReorder } from "./drag-reorder"

// 주로 세부 편집창(MUI Dialog 또는 Drawer 등)이 body의 자식으로 추가될 때 감지합니다.
const EDIT_WINDOW_SELECTOR = ".MuiDialog-root, .MuiDrawer-root"

export function initMenuActions() {
  const bodyObserver = new MutationObserver(async (records) => {
    let addedDialog: HTMLElement | null = null

    for (const record of records) {
      for (const node of record.addedNodes) {
        if (
          node.nodeType === 1 &&
          (node as HTMLElement).matches?.(EDIT_WINDOW_SELECTOR)
        ) {
          addedDialog = node as HTMLElement
          break
        }
      }
      if (addedDialog) break
    }

    if (addedDialog) {
      // 약간의 지연을 주어 Redux 상태창에 현재 창 정보가 업데이트될 시간을 확보합니다.
      setTimeout(async () => {
        const menuInfo = await ccf.menus.getOpenMenuInfo()
        if (!menuInfo) return

        const type = menuInfo.type
        const id = menuInfo.id

        const form = addedDialog.querySelector("form")
        console.log(form)

        if (type === "character-detail") {
          console.log(`[BattleHelper] 캐릭터 세부 편집창 열림 감지 - ID: ${id}`)
          injectDragReorder((form || addedDialog) as HTMLElement)
        } else if (type === "item-detail") {
          console.log(`[BattleHelper] 스크린 토큰 세부 편집창 열림 감지 - ID: ${id}`)
        } else if (type === "marker-detail") {
          console.log(`[BattleHelper] 마커 패널 세부 편집창 열림 감지 - ID: ${id}`)
        } else if (type === "deck-detail") {
          console.log(`[BattleHelper] 덱 세부 편집창 열림 감지 - ID: ${id}`)
        }
      }, 50)
    }
  })

  bodyObserver.observe(document.body, { childList: true })
}
