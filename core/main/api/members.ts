import { getServices } from "../hijack"
import type { CcfoliaMember } from "~utils/types"

export const members = {
  getAll: (): CcfoliaMember[] => {
    const { store } = getServices()
    if (!store) return []
    const rc = store.getState().entities?.roomMembers
    if (!rc || !rc.entities) return []
    return Object.values(rc.entities) as CcfoliaMember[]
  },

  getById: (id: string): CcfoliaMember | undefined => {
    const { store } = getServices()
    if (!store) return undefined
    const rc = store.getState().entities?.roomMembers
    return rc?.entities?.[id] as CcfoliaMember | undefined
  },

  getByDisplayName: (displayName: string): CcfoliaMember | undefined => {
    return members.getAll().find((m) => m.displayName === displayName)
  },

  /**
   * isAnonymous가 false인 멤버 중, 지정한 role(minRole)과 같거나 더 높은 권한을 가진 멤버들을 반환합니다.
   * role: "owner" > "subowner" > "player" > "audience" > "denied"
   */
  getByRole: (minRole: "owner" | "subowner" | "player" | "audience" | "denied"): CcfoliaMember[] => {
    const { store } = getServices()
    if (!store) return []

    const currentState = store.getState()
    const roomId = currentState.app?.state?.roomId
    if (!roomId) return []

    const myRoom = currentState.entities?.rooms?.entities?.[roomId]
    if (!myRoom) return []

    const roomOwner = myRoom.owner
    const defaultRole = myRoom.defaultRole || "player" // fallback

    const ROLE_LEVELS: Record<string, number> = {
      "owner": 5,
      "subowner": 4,
      "player": 3,
      "audience": 2,
      "denied": 1
    }

    const targetLevel = ROLE_LEVELS[minRole] || 0
    const allMembers = members.getAll()

    return allMembers.filter((m) => {
      if (m.isAnonymous) return false

      let effectiveRole = m.role

      // GM인지 확인 (최고 권한)
      if (m._id === roomOwner) {
        effectiveRole = "owner"
      } else if (effectiveRole === null || effectiveRole === undefined) {
        // null이면 방의 기본 역할
        effectiveRole = defaultRole
      }

      const userLevel = ROLE_LEVELS[effectiveRole] || 0
      return userLevel >= targetLevel
    })
  }
}
