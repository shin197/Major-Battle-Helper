import { getServices } from "../hijack"

export const notes = {
  addRoomNote: async () => {
    const { store, noteActions, roomId } = getServices()
    if (!noteActions || typeof noteActions.addRoomNote !== "function") {
      console.warn("[BattleHelper] addRoomNote action not found.")
      return
    }

    const state = store.getState()
    const uid = state.app?.state?.uid || state.app?.user?.uid || ""

    await store.dispatch(noteActions.addRoomNote(roomId, uid))
  },

  updateRoomNote: async (noteId: string, item: Record<string, any>) => {
    const { store, noteActions, roomId } = getServices()
    if (!noteActions || typeof noteActions.updateRoomNote !== "function") {
      console.warn("[BattleHelper] updateRoomNote action not found.")
      return
    }

    await store.dispatch(noteActions.updateRoomNote(roomId, noteId, item))
  },

  deleteRoomNote: async (noteId: string) => {
    const { store, noteActions, roomId } = getServices()
    if (!noteActions || typeof noteActions.deleteRoomNote !== "function") {
      console.warn("[BattleHelper] deleteRoomNote action not found.")
      return
    }

    await store.dispatch(noteActions.deleteRoomNote(roomId, noteId))
  },

  getAllNotes: () => {
    const { store, roomId } = getServices()
    const state = store.getState()
    const notesDict = state.entities?.roomNotes?.entities || {}
    return Object.values(notesDict)
  },

  getById: (noteId: string) => {
    const { store } = getServices()
    const state = store.getState()
    return state.entities?.roomNotes?.entities?.[noteId]
  },

  getByName: (name: string) => {
    const notesArray = notes.getAllNotes() as any[]
    return notesArray.find(note => note.name === name)
  },

  search: (keyword: string) => {
    const notesArray = notes.getAllNotes() as any[]
    const lowerKeyword = keyword.toLowerCase()
    return notesArray.filter(note =>
      (note.name && note.name.toLowerCase().includes(lowerKeyword)) ||
      (note.text && note.text.toLowerCase().includes(lowerKeyword))
    )
  },

  searchTitle: (keyword: string) => {
    const notesArray = notes.getAllNotes() as any[]
    const lowerKeyword = keyword.toLowerCase()
    return notesArray.filter(note =>
      (note.name && note.name.toLowerCase().includes(lowerKeyword))
    )
  }
}
