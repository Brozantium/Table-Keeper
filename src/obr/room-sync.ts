import OBR from "@owlbear-rodeo/sdk";
import {
  EXTENSION_ID,
  LOCAL_CHANNEL,
  ROOM_STATE_KEY,
  SYNC_CHANNEL,
  isRoomStorageKey,
} from "./constants";
import type { RoomState, StorageEntry, SyncMessage } from "./types";

const MAX_PERSISTED_STATE_SIZE = 14_000;

function isStorageEntry(value: unknown): value is StorageEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<StorageEntry>;
  return (
    (typeof entry.value === "string" || entry.value === null) &&
    typeof entry.updatedAt === "number" &&
    typeof entry.updatedBy === "string"
  );
}

function parseRoomState(value: unknown): RoomState {
  if (!value || typeof value !== "object") {
    return { version: 1, entries: {} };
  }
  const candidate = value as Partial<RoomState>;
  const entries = Object.fromEntries(
    Object.entries(candidate.entries ?? {}).filter(
      ([key, entry]) => isRoomStorageKey(key) && isStorageEntry(entry),
    ),
  );
  return { version: 1, entries };
}

function currentRoomValues(playerId: string): Record<string, StorageEntry> {
  const entries: Record<string, StorageEntry> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !isRoomStorageKey(key)) continue;
    entries[key] = {
      value: localStorage.getItem(key),
      updatedAt: Date.now(),
      updatedBy: playerId,
    };
  }
  return entries;
}

function applyEntry(key: string, entry: StorageEntry): void {
  if (!isRoomStorageKey(key)) return;
  if (entry.value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, entry.value);
}

export async function startRoomSync(): Promise<void> {
  const playerId = await OBR.player.getId();
  const role = await OBR.player.getRole();
  const latest = new Map<string, StorageEntry>();
  let applyingRemote = false;
  let persistTimer: number | undefined;
  const localChannel = new BroadcastChannel(LOCAL_CHANNEL);

  const persist = async () => {
    if (role !== "GM") return;
    const state: RoomState = {
      version: 1,
      entries: Object.fromEntries(latest),
    };
    if (JSON.stringify(state).length > MAX_PERSISTED_STATE_SIZE) {
      localChannel.postMessage({
        type: "STATUS",
        level: "warning",
        message: "Room state is live, but is too large for Owlbear metadata persistence.",
      });
      return;
    }
    try {
      await OBR.room.setMetadata({ [ROOM_STATE_KEY]: state });
    } catch (error) {
      console.error(`[${EXTENSION_ID}] Unable to persist room state`, error);
    }
  };

  const schedulePersist = () => {
    if (role !== "GM") return;
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(persist, 400);
  };

  const acceptEntries = (entries: Record<string, StorageEntry>, force = false, notify = false) => {
    let changed = false;
    applyingRemote = true;
    try {
      for (const [key, entry] of Object.entries(entries)) {
        if (!isRoomStorageKey(key) || !isStorageEntry(entry)) continue;
        const known = latest.get(key);
        if (!force && known && known.updatedAt > entry.updatedAt) continue;
        if (localStorage.getItem(key) !== entry.value) changed = true;
        latest.set(key, entry);
        applyEntry(key, entry);
      }
    } finally {
      applyingRemote = false;
    }
    localChannel.postMessage({ type: "SYNCED" });
    if (changed && notify) localChannel.postMessage({ type: "REMOTE_UPDATE" });
  };

  try {
    const metadata = await OBR.room.getMetadata();
    const persisted = parseRoomState(metadata[ROOM_STATE_KEY]);
    acceptEntries(persisted.entries, true);
  } catch (error) {
    console.error(`[${EXTENSION_ID}] Unable to hydrate room state`, error);
  }

  for (const [key, entry] of Object.entries(currentRoomValues(playerId))) {
    if (!latest.has(key)) latest.set(key, entry);
  }

  window.addEventListener("storage", (event) => {
    if (
      applyingRemote ||
      event.storageArea !== localStorage ||
      !event.key ||
      !isRoomStorageKey(event.key)
    ) {
      return;
    }
    const entry: StorageEntry = {
      value: event.newValue,
      updatedAt: Date.now(),
      updatedBy: playerId,
    };
    latest.set(event.key, entry);
    void OBR.broadcast.sendMessage(
      SYNC_CHANNEL,
      { type: "UPDATE", key: event.key, entry } satisfies SyncMessage,
      { destination: "REMOTE" },
    );
    schedulePersist();
  });

  OBR.broadcast.onMessage(SYNC_CHANNEL, ({ data }) => {
    if (!data || typeof data !== "object") return;
    const message = data as SyncMessage;
    if (
      message.type === "UPDATE" &&
      isRoomStorageKey(message.key) &&
      isStorageEntry(message.entry)
    ) {
      acceptEntries({ [message.key]: message.entry }, false, true);
      schedulePersist();
    } else if (message.type === "REQUEST") {
      void OBR.broadcast.sendMessage(
        SYNC_CHANNEL,
        {
          type: "SNAPSHOT",
          requesterId: message.requesterId,
          entries: Object.fromEntries(latest),
        } satisfies SyncMessage,
        { destination: "REMOTE" },
      );
    } else if (message.type === "SNAPSHOT" && message.requesterId === playerId) {
      acceptEntries(message.entries, false, true);
    }
  });

  OBR.room.onMetadataChange((metadata) => {
    acceptEntries(parseRoomState(metadata[ROOM_STATE_KEY]).entries, false, true);
  });

  await OBR.broadcast.sendMessage(
    SYNC_CHANNEL,
    { type: "REQUEST", requesterId: playerId } satisfies SyncMessage,
    { destination: "REMOTE" },
  );
  schedulePersist();
}
