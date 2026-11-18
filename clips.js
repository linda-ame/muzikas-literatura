export const DEFAULT_ID = "default";

export function blankEntry() {
  return { selected: DEFAULT_ID, custom: [] };
}

export function sanitizeEntry(value) {
  const custom = Array.isArray(value?.custom)
    ? value.custom.filter(
        (clip) =>
          clip &&
          typeof clip.id === "string" &&
          typeof clip.name === "string" &&
          Number.isFinite(clip.from) &&
          Number.isFinite(clip.to) &&
          clip.to > clip.from,
      )
    : [];
  const selected = typeof value?.selected === "string" ? value.selected : DEFAULT_ID;
  return activeEntry({ selected, custom });
}

export function activeEntry(entry) {
  const custom = entry.custom || [];
  const selected =
    entry.selected === DEFAULT_ID || custom.some((clip) => clip.id === entry.selected)
      ? entry.selected || DEFAULT_ID
      : DEFAULT_ID;
  return { selected: custom.length ? selected : DEFAULT_ID, custom };
}

export function addClip(entry, clip) {
  return { custom: [...entry.custom, clip], selected: clip.id };
}

export function removeClip(entry, id) {
  const custom = entry.custom.filter((clip) => clip.id !== id);
  const selected = !custom.length || entry.selected === id ? DEFAULT_ID : entry.selected;
  return activeEntry({ custom, selected });
}

export function chooseClip(entry, id) {
  if (id === DEFAULT_ID) return { ...entry, selected: DEFAULT_ID };
  if (!entry.custom.some((clip) => clip.id === id)) return entry;
  return { ...entry, selected: id };
}

export function resolveBounds(entry, fallback, duration) {
  const current = activeEntry(entry);
  if (current.selected === DEFAULT_ID) return fallback;
  const clip = current.custom.find((item) => item.id === current.selected);
  if (!clip) return fallback;
  const start = Math.max(0, clip.from);
  const end = Math.min(duration - 0.25, clip.to);
  if (!(end > start + 1)) return fallback;
  return { start, end };
}

export function rangeError(from, to, duration) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return "Ievadi sekundes laukos No un Līdz.";
  if (from < 0 || to > duration + 0.05) return `Sekundēm jābūt no 0 līdz ${Math.floor(duration)}.`;
  if (to - from < 4) return "Daļai jābūt vismaz 4 sekundes garai.";
  return "";
}
