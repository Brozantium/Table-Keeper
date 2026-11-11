import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, PLAYER_STATE_KEY } from "./obr/constants";
import { readCharacterSummaries } from "./obr/characters";
import { startRoomSync } from "./obr/room-sync";

if (OBR.isAvailable) {
  OBR.onReady(() => {
    window.addEventListener("storage", (event) => {
      if (event.key !== "dnd.characters.v1") return;
      void OBR.player.setMetadata({
        [PLAYER_STATE_KEY]: {
          version: 1,
          characters: readCharacterSummaries(),
        },
      });
    });
    void startRoomSync().catch((error) => {
      console.error(`[${EXTENSION_ID}] Room synchronization failed`, error);
    });
  });
}
