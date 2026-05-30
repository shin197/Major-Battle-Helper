import { getServices } from "../hijack"
import { characters } from "./characters"
import { devtools } from "./devtools"
import { menus } from "./menu"
import { messages } from "./messages"
import { tokens } from "./tokens"
import { decks } from "./decks"
import { app } from "./app"
import { members } from "./members"
import { diceTokens } from "./dice-tokens"
import { room } from "./room"
import { ai } from "./ai"
import { notes } from "./notes"

export const buildAPI = () => {
  return {
    app,
    members,
    diceTokens,
    room,
    ai,
    notes,
    getReduxState: () => {
      const { store } = getServices()
      return store.getState()
    },
    characters,
    getCharacters: characters.getCharacters,
    getCharacterByName: characters.getByName,
    getCharacterById: characters.getById,
    setCharacterStatus: characters.setStatus,
    setCharacterParam: characters.setParam,
    toggleCharacterProp: characters.toggleProp,
    setCharacterCommands: characters.setCommands,
    patchCharacter: characters.patch,
    tokens,
    getAllTokens: tokens.getAll,
    getTokenById: tokens.getById,
    patchToken: tokens.patch,
    patchBulkTokens: tokens.patchBulk,
    setSelectedObjects: tokens.setSelectedObjects,
    deleteSelectedObjectsWithUndo: tokens.deleteSelectedObjectsWithUndo,
    messages,
    getAllMessages: messages.getAll,
    getRecentMessages: messages.getRecentMessages,
    modifyRollResult: messages.modifyRollResult,
    deleteMessage: messages.delete,
    sendSystemMessage: messages.sendSystemMessage,
    sendMessageAsChar: messages.sendMessageAsChar,
    sendDiceAsChar: messages.sendDiceAsChar,
    menus,
    getOpenMenuInfo: menus.getOpenMenuInfo,
    decks,
    devtools
  }
}
