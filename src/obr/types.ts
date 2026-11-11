export interface CharacterSummary {
  id: string;
  name: string;
  level?: number;
  classes?: string;
  armorClass?: number;
  currentHitPoints?: number;
  maxHitPoints?: number;
  updatedAt: number;
}

export interface StorageEntry {
  value: string | null;
  updatedAt: number;
  updatedBy: string;
}

export interface RoomState {
  version: 1;
  entries: Record<string, StorageEntry>;
}

export type SyncMessage =
  | {
      type: "UPDATE";
      key: string;
      entry: StorageEntry;
    }
  | {
      type: "REQUEST";
      requesterId: string;
    }
  | {
      type: "SNAPSHOT";
      requesterId: string;
      entries: Record<string, StorageEntry>;
    };
