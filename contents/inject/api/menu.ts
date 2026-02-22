import { getServices } from "../hijack"

export const menus = {
  getOpenMenuInfo: (): { type: string; id: string } | null => {
    const { store } = getServices()
    const state = store.getState().app?.state
    if (!state) return null

    // 메뉴 플래그와 해당 메뉴의 ID가 저장되는 키들을 매핑해둡니다.
    // (💡주의: 실제 Redux 상태창을 보시고 ID 키 이름이 다르면 여기서 수정해주세요.
    // 예: openRoomItemMenuId 가 아니라 openRoomItemId 일 수도 있습니다.)
    const menuTypes = [
      {
        type: "character",
        flagKey: "openRoomCharacterMenu",
        idKey: "openRoomCharacterId"
      },
      {
        type: "deck",
        flagKey: "openRoomDeckMenu",
        idKey: "openRoomDeckMenuId"
      },
      {
        type: "dice",
        flagKey: "openRoomDiceDetail",
        idKey: "openRoomDiceDetailId"
      },
      {
        type: "item",
        flagKey: "openRoomItemMenu",
        idKey: "openRoomItemMenuId"
      },
      {
        type: "marker",
        flagKey: "openRoomMarkerMenu",
        idKey: "openRoomMarkerMenuId"
      }
    ]

    for (const menu of menuTypes) {
      if (state[menu.flagKey]) {
        const idFallback = menu.idKey
        const targetId = state[menu.idKey] || state[idFallback]

        if (targetId) {
          return { type: menu.type, id: targetId }
        }
      }
    }

    return null // 열려있는 메뉴가 없거나 알 수 없는 메뉴임
  }
}
