import { characters } from "./characters"
import { devtools } from "./devtools"
import { menus } from "./menu"
import { messages } from "./messages"
import { tokens } from "./tokens"

export const buildAPI = () => {
  return {
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
    messages,
    getAllMessages: messages.getAll,
    modifyRollResult: messages.modifyRollResult,
    menus,
    getOpenMenuInfo: menus.getOpenMenuInfo,
    devtools
  }
}
