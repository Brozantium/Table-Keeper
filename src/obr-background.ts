import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, PLAYER_STATE_KEY } from "./obr/constants";
import { readCharacterSummaries } from "./obr/characters";
import { startRoomSync } from "./obr/room-sync";

let started = false;

if (OBR.isAvailable) {
  OBR.onReady(() => {
    if (started) return;
    started = true;

    const publishCharacters = (event: StorageEvent) => {
      if (event.key !== "dnd.characters.v1") return;
      void OBR.player.setMetadata({
        [PLAYER_STATE_KEY]: {
          version: 1,
          characters: readCharacterSummaries(),
        },
      }).catch((error) => {
        console.error(`[${EXTENSION_ID}] Character metadata update failed`, error);
      });
    };
    window.addEventListener("storage", publishCharacters);

    let stopRoomSync: (() => void) | undefined;
    let disposed = false;
    void startRoomSync().then((stop) => {
      if (disposed) stop();
      else stopRoomSync = stop;
    }).catch((error) => {
      console.error(`[${EXTENSION_ID}] Room synchronization failed`, error);
    });

    window.addEventListener("pagehide", () => {
      disposed = true;
      window.removeEventListener("storage", publishCharacters);
      stopRoomSync?.();
      started = false;
    }, { once: true });
  });
}
