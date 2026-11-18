import assert from "node:assert/strict";
import test from "node:test";
import { addClip, chooseClip, rangeError, removeClip, resolveBounds, sanitizeEntry } from "./clips.js";

const fallback = { start: 1.4, end: 33.4 };

test("jauna daļa kļūst par izvēlēto", () => {
  const next = addClip({ selected: "default", custom: [] }, { id: "a", name: "Sākums", from: 10, to: 40 });
  assert.equal(next.selected, "a");
  assert.equal(resolveBounds(next, fallback, 200).start, 10);
});

test("noklusējumu var izvēlēties atpakaļ", () => {
  const entry = addClip({ selected: "default", custom: [] }, { id: "a", name: "Beigas", from: 20, to: 50 });
  const back = chooseClip(entry, "default");
  assert.deepEqual(resolveBounds(back, fallback, 200), fallback);
});

test("izvēlētās daļas dzēšana atgriež noklusējumu", () => {
  const entry = {
    selected: "b",
    custom: [
      { id: "a", name: "A", from: 1, to: 10 },
      { id: "b", name: "B", from: 12, to: 20 },
    ],
  };
  const next = removeClip(entry, "b");
  assert.equal(next.selected, "default");
  assert.equal(next.custom.length, 1);
  assert.deepEqual(resolveBounds(next, fallback, 200), fallback);
});

test("citas daļas dzēšana patur ieķeksēto", () => {
  const entry = {
    selected: "b",
    custom: [
      { id: "a", name: "A", from: 1, to: 10 },
      { id: "b", name: "B", from: 12, to: 20 },
    ],
  };
  const next = removeClip(entry, "a");
  assert.equal(next.selected, "b");
  assert.equal(resolveBounds(next, fallback, 200).start, 12);
});

test("bojāts ieraksts neatstāj svešu izvēli", () => {
  const entry = sanitizeEntry({ selected: "pazudis", custom: [{ id: "a", name: "A", from: 1, to: 9 }] });
  assert.equal(entry.selected, "default");
});

test("pārāk īsu vai par garu daļu nepieņem", () => {
  assert.equal(rangeError(1, 3, 100), "Daļai jābūt vismaz 4 sekundes garai.");
  assert.match(rangeError(0, 120, 90), /0 līdz 90/);
  assert.equal(rangeError(0, 40, 90), "");
});
