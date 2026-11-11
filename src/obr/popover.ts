import OBR, { type Player, type Theme } from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, LOCAL_CHANNEL, PLAYER_STATE_KEY, TOKEN_CHARACTER_KEY } from "./constants";
import { readCharacterSummaries } from "./characters";
import type { CharacterSummary } from "./types";

function waitForReady(): Promise<void> {
  if (OBR.isReady) return Promise.resolve();
  return new Promise((resolve) => OBR.onReady(resolve));
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.obrTheme = theme.mode.toLowerCase();
  document.documentElement.style.setProperty("--obr-background", theme.background.paper);
  document.documentElement.style.setProperty("--obr-text", theme.text.primary);
  document.documentElement.style.setProperty("--obr-primary", theme.primary.main);
  (
    window as Window & {
      TableKeeperTheme?: { setHostTheme: (nextTheme: Theme) => void };
    }
  ).TableKeeperTheme?.setHostTheme(theme);
}

async function publishCharacters(): Promise<CharacterSummary[]> {
  const characters = readCharacterSummaries();
  try {
    await OBR.player.setMetadata({
      [PLAYER_STATE_KEY]: { version: 1, characters },
    });
  } catch (error) {
    console.error(`[${EXTENSION_ID}] Unable to publish characters`, error);
  }
  return characters;
}

function createIntegrationPanel(
  player: Pick<Player, "name" | "role">,
  initialPartySize: number,
): void {
  const root = document.createElement("aside");
  root.className = "obr-integration";
  root.innerHTML = `
    <button class="obr-integration__trigger" type="button" aria-expanded="false">
      <span class="obr-integration__dot" aria-hidden="true"></span>
      Owlbear
    </button>
    <section class="obr-integration__panel" hidden aria-label="Owlbear Rodeo integration">
      <header>
        <strong>Owlbear Rodeo</strong>
        <button type="button" class="obr-integration__close" aria-label="Close">×</button>
      </header>
      <p class="obr-integration__identity"></p>
      <p class="obr-integration__status">Room storage synchronized.</p>
      <button type="button" class="obr-integration__link">Link character to selected token</button>
      <div class="obr-integration__characters" hidden></div>
    </section>
  `;
  document.body.append(root);

  const trigger = root.querySelector<HTMLButtonElement>(".obr-integration__trigger")!;
  const panel = root.querySelector<HTMLElement>(".obr-integration__panel")!;
  const close = root.querySelector<HTMLButtonElement>(".obr-integration__close")!;
  const identity = root.querySelector<HTMLElement>(".obr-integration__identity")!;
  const status = root.querySelector<HTMLElement>(".obr-integration__status")!;
  const link = root.querySelector<HTMLButtonElement>(".obr-integration__link")!;
  const characterList = root.querySelector<HTMLElement>(".obr-integration__characters")!;

  let partySize = initialPartySize;
  const renderIdentity = (name = player.name, role = player.role) => {
    identity.textContent = `${name} · ${role === "GM" ? "Game Master" : "Player"} · ${partySize} in room`;
  };
  renderIdentity();

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  };
  trigger.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));

  OBR.party.onChange((party) => {
    partySize = party.length;
    renderIdentity();
    window.dispatchEvent(new CustomEvent("dnd:obr-party", { detail: { players: party } }));
  });
  OBR.player.onChange((nextPlayer) => {
    renderIdentity(nextPlayer.name, nextPlayer.role);
    window.dispatchEvent(new CustomEvent("dnd:obr-player", { detail: nextPlayer }));
  });

  const localChannel = new BroadcastChannel(LOCAL_CHANNEL);
  let reloadTimer: number | undefined;
  localChannel.addEventListener("message", (event) => {
    if (event.data?.type === "STATUS") {
      status.textContent = event.data.message;
      status.dataset.level = event.data.level;
    } else if (event.data?.type === "SYNCED") {
      status.textContent = "Room storage synchronized.";
      delete status.dataset.level;
    } else if (event.data?.type === "REMOTE_UPDATE") {
      window.dispatchEvent(new CustomEvent("dnd:obr-room-update"));
      status.textContent = "Room data updated.";
      if (
        window.location.pathname.endsWith("/table.html") ||
        window.location.pathname.endsWith("/table")
      ) {
        status.textContent = "Room data updated. Refreshing the table…";
        window.clearTimeout(reloadTimer);
        reloadTimer = window.setTimeout(() => window.location.reload(), 600);
      }
    }
  });

  link.addEventListener("click", async () => {
    const characters = await publishCharacters();
    characterList.replaceChildren();
    if (!characters.length) {
      status.textContent = "Create or import a character before linking a token.";
      return;
    }

    for (const character of characters) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "obr-integration__character";
      button.textContent = `${character.name}${character.level ? ` · Level ${character.level}` : ""}`;
      button.addEventListener("click", async () => {
        try {
          if (!(await OBR.scene.isReady())) {
            await OBR.notification.show(
              "Open a scene before linking a character token.",
              "WARNING",
            );
            return;
          }
          if (!(await OBR.player.hasPermission("CHARACTER_UPDATE"))) {
            await OBR.notification.show(
              "You do not have permission to update character tokens.",
              "WARNING",
            );
            return;
          }
          const selection = await OBR.player.getSelection();
          if (!selection?.length) {
            await OBR.notification.show("Select a character token on the map first.", "WARNING");
            return;
          }
          const selectedItems = await OBR.scene.items.getItems(selection);
          const characterTokens = selectedItems.filter((item) => item.layer === "CHARACTER");
          if (!characterTokens.length) {
            await OBR.notification.show(
              "The selection does not contain a character token.",
              "WARNING",
            );
            return;
          }
          await OBR.scene.items.updateItems(characterTokens, (items) => {
            for (const item of items) {
              item.metadata[TOKEN_CHARACTER_KEY] = character;
            }
          });
          await OBR.notification.show(
            `${character.name} linked to the selected character token.`,
            "SUCCESS",
          );
          characterList.hidden = true;
        } catch (error) {
          console.error(`[${EXTENSION_ID}] Unable to link token`, error);
          await OBR.notification.show(
            "The token could not be updated. Check room permissions.",
            "ERROR",
          );
        }
      });
      characterList.append(button);
    }
    characterList.hidden = false;
  });
}

export async function initializePopover(): Promise<void> {
  if (!OBR.isAvailable) return;
  await waitForReady();
  document.documentElement.classList.add("is-obr-extension");

  try {
    const [name, role, party, theme] = await Promise.all([
      OBR.player.getName(),
      OBR.player.getRole(),
      OBR.party.getPlayers(),
      OBR.theme.getTheme(),
    ]);
    const playerName = localStorage.getItem("dnd.playerName");
    if (!playerName?.trim()) localStorage.setItem("dnd.playerName", name);
    applyTheme(theme);
    OBR.theme.onChange(applyTheme);
    await publishCharacters();
    createIntegrationPanel({ name, role }, party.length);
  } catch (error) {
    console.error(`[${EXTENSION_ID}] Owlbear initialization failed`, error);
  }
}
