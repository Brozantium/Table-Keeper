export const EXTENSION_ID = "table-keeper";
export const ROOM_STATE_KEY = `${EXTENSION_ID}/room-state`;
export const PLAYER_STATE_KEY = `${EXTENSION_ID}/characters`;
export const TOKEN_CHARACTER_KEY = `${EXTENSION_ID}/character`;
export const SYNC_CHANNEL = `${EXTENSION_ID}/storage-sync`;
export const LOCAL_CHANNEL = `${EXTENSION_ID}/local`;
export const PARTY_CHANGE_EVENT = `${EXTENSION_ID}:obr-party`;
export const PLAYER_CHANGE_EVENT = `${EXTENSION_ID}:obr-player`;
export const ROOM_UPDATE_EVENT = `${EXTENSION_ID}:obr-room-update`;

export const ROOM_STORAGE_PREFIXES = ["dnd.campaignTable.v1:", "dnd.campaignArchive.v1:"] as const;

export const ROOM_STORAGE_KEYS = new Set(["dnd.dmOpenCampaign", "dnd.docLinks.v1"]);

export function isRoomStorageKey(key: string): boolean {
  return (
    ROOM_STORAGE_KEYS.has(key) || ROOM_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}
