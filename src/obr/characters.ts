import type { CharacterSummary } from "./types";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(...values: unknown[]): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim()) as string | undefined;
}

function number(...values: unknown[]): number | undefined {
  const value = values.find(
    (candidate) => typeof candidate === "number" && Number.isFinite(candidate),
  );
  return value as number | undefined;
}

export function readCharacterSummaries(): CharacterSummary[] {
  let characters: unknown;
  try {
    characters = JSON.parse(localStorage.getItem("dnd.characters.v1") ?? "[]");
  } catch {
    return [];
  }

  if (!Array.isArray(characters)) return [];

  return characters.flatMap((value, index) => {
    const character = record(value);
    const details = record(character.details);
    const state = record(character.state);
    const hitPoints = record(character.hitPoints);
    const levels = Array.isArray(character.levels) ? character.levels : [];
    const classes = levels
      .map((entry) => {
        const level = record(entry);
        return text(level.className, level.name, record(level.class).name);
      })
      .filter(Boolean)
      .join(" / ");
    const calculatedLevel =
      levels.reduce((total, entry) => {
        const level = record(entry);
        return total + (number(level.level, level.count) ?? 0);
      }, 0) || undefined;
    const id = text(character.id, details.id) ?? `character-${index + 1}`;
    const name =
      text(details.name, character.name, character.characterName) ?? `Character ${index + 1}`;

    return [
      {
        id,
        name,
        level: number(character.level, details.level) ?? calculatedLevel,
        classes: classes || text(character.className, details.className),
        armorClass: number(character.armorClass, character.ac, state.armorClass),
        currentHitPoints: number(
          state.currentHitPoints,
          state.hp,
          hitPoints.current,
          character.currentHitPoints,
        ),
        maxHitPoints: number(state.maxHitPoints, hitPoints.max, character.maxHitPoints),
        updatedAt: number(character.updatedAt, character.modifiedAt, state.updatedAt) ?? Date.now(),
      },
    ];
  });
}
