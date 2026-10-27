import catalog from './catalog.json';

/**
 * Every line the game says, by its id in the one catalog (the gate holds the catalog: each line said somewhere, none
 * in the engine's vocabulary, and the inventory the owner rewrites from generated from it). A line's slots for values
 * are written `{name}`; each is filled with text the caller has already put in words, and a slot left empty or a value
 * with no slot stops the line, so a sentence never reaches the player half made.
 */
export type LineId = keyof typeof catalog;

const SLOT = /\{([^}]*)\}/g;

export function isLine(id: unknown): id is LineId {
  return typeof id === 'string' && Object.hasOwn(catalog, id);
}

/** A line's text with its slots filled, each by its own words and none left over. */
export function fill(id: string, text: string, values: Readonly<Record<string, string>>): string {
  const slots = new Set([...text.matchAll(SLOT)].map((m) => m[1]));
  for (const [name, value] of Object.entries(values)) {
    if (!slots.has(name)) throw new Error(`the line ${id} has no {${name}}`);
    if (typeof value !== 'string' || value === '') throw new Error(`the line ${id}'s {${name}} is given no words`);
  }
  return text.replace(SLOT, (_slot, name: string) => {
    if (!Object.hasOwn(values, name)) throw new Error(`the line ${id} needs {${name}}`);
    return values[name] as string;
  });
}

export function t(id: LineId, values: Readonly<Record<string, string>> = {}): string {
  if (!isLine(id)) throw new Error(`there is no line ${String(id)}`);
  return fill(id, catalog[id].text, values);
}
