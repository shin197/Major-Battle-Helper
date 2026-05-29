import { getServices } from "../hijack"

export const room = {
  updateRoom: async (payload: Record<string, any>) => {
    const { store, roomActions, roomId } = getServices()

    if (roomActions && typeof roomActions.updateRoom === "function") {
      await store.dispatch(roomActions.updateRoom(roomId, payload))
    } else {
      console.warn("[BattleHelper] updateRoom action not found in roomActions. Falling back to fsTools.")
      const { fsTools, db } = getServices()
      if (fsTools && fsTools.updateDoc) {
        await fsTools.updateDoc(fsTools.doc(db, "rooms", roomId), payload)
      } else if (fsTools && fsTools.setDoc) {
        await fsTools.setDoc(fsTools.doc(db, "rooms", roomId), payload, { merge: true })
      } else {
        console.error("[BattleHelper] Failed to update room: no valid API found.")
      }
    }
  },

  getAllVariables: (): Array<{ label: string; value: string }> => {
    const { store, roomId } = getServices()
    const state = store.getState()
    const room = state.entities?.rooms?.entities?.[roomId]
    return room?.variables || []
  },

  getVariableByLabel: (label: string): { label: string; value: string } | undefined => {
    const { store, roomId } = getServices()
    const state = store.getState()
    const room = state.entities?.rooms?.entities?.[roomId]
    const variables: Array<{ label: string; value: string }> = room?.variables || []
    return variables.find(v => v.label === label)
  },

  setVariable: async (label: string, value: string) => {
    const variables = [...room.getAllVariables()]
    const index = variables.findIndex(v => v.label === label)
    if (index >= 0) {
      variables[index] = { label, value }
    } else {
      variables.push({ label, value })
    }
    await room.updateRoom({ variables })
  },

  deleteVariable: async (label: string) => {
    const variables = room.getAllVariables()
    const newVariables = variables.filter(v => v.label !== label)
    if (variables.length !== newVariables.length) {
      await room.updateRoom({ variables: newVariables })
    }
  }
}
