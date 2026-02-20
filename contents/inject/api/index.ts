import type { get } from "http"

import { characters } from "./characters"
import { devtools } from "./devtools"
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
    devtools
  }
}
