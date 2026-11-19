import assert from "node:assert/strict";
import test from "node:test";
import { pieces } from "./pieces.js";
import { choiceTexts, clipNumbers, fieldOk, layers } from "./layers.js";

const by = (n) => layers.find((item) => item.n === n);

test("katram gabalam ir slānis ar to pašu autoru", () => {
  assert.equal(layers.length, 50);
  assert.deepEqual(layers.map((item) => item.n), pieces.map((piece) => piece.n));
  for (const piece of pieces) {
    assert.equal(by(piece.n).author, piece.author, piece.n);
  }
});

test("paša daļa un autors skaitās pareizi", () => {
  for (const item of layers) {
    assert.equal(fieldOk(item, "author", item.author), true, item.author);
    if (item.part) assert.equal(fieldOk(item, "part", item.part), true, `${item.n} ${item.part}`);
    else assert.equal(item.partShape, "");
  }
});

test("varianti ir pieci un no tā paša loka", () => {
  for (const item of layers) {
    const authors = choiceTexts(item, "author", layers);
    assert.equal(authors.length, 5, item.n);
    assert.ok(authors.includes(item.author));
    for (const name of authors) {
      assert.ok(layers.some((other) => other.author === name && other.region === item.region), name);
    }
    if (!item.part) continue;
    const parts = choiceTexts(item, "part", layers);
    assert.equal(parts.length, 5, `${item.n} ${item.part}`);
    assert.ok(parts.includes(item.part));
    const moves = parts.filter((text) => movementLabels.has(text));
    assert.ok(moves.length >= 1 && moves.length < parts.length, `${item.n} ${parts.join(" | ")}`);
  }
});

const movementLabels = new Set([
  "1. daļa",
  "2. daļa",
  "3. daļa",
  "4. daļa",
  "1. daļa, G.P.",
  "1. daļa, ievads",
  "pamattēma",
  "sākumtēma",
]);

test("vokālam gabalam nerāda instrumentālo nosaukumu", () => {
  const parts = choiceTexts(by(2), "part", layers);
  assert.ok(!parts.includes("Bolero"));
  assert.ok(!parts.includes('kordziesma "Jāņuvakars"'));
  assert.ok(parts.some((text) => movementLabels.has(text)));
  const latvian = choiceTexts(by(31), "author", layers);
  assert.ok(!latvian.includes("A.Vivaldi"));
  assert.ok(latvian.includes("J.Vītols"));
});

test("lielajam darbam jābūt pilnajam nosaukumam", () => {
  const swan = by(26);
  assert.equal(swan.prompt, 'balets "Gulbju ezers"');
  assert.equal(by(20).prompt, 'opera "Karmena"');
  assert.equal(by(2).prompt, 'oratorija "Mesija"');
  assert.equal(by(28).prompt, 'balets "Romeo un Džuljeta"');
  assert.equal(fieldOk(swan, "work", swan.prompt), true);
  assert.equal(fieldOk(swan, "work", "Gulbju ezers"), false);
  const titled = layers.filter((item) => item.part && item.partShape === "title");
  assert.equal(titled.length, 20);
  for (const item of titled) {
    const works = choiceTexts(item, "work", titled);
    assert.equal(works.length, 5, item.n);
    assert.ok(works.includes(item.prompt));
    for (const name of works) {
      const other = layers.find((layer) => layer.prompt === name);
      assert.equal(other.region, item.region, name);
      assert.equal(other.kind, item.kind, name);
    }
  }
});

test("klausāmie varianti ir tā paša veida", () => {
  const clips = clipNumbers(by(8), layers);
  assert.equal(clips.length, 4);
  assert.ok(clips.includes(8));
  for (const n of clips) {
    assert.equal(by(n).kind, "instrumental");
    assert.equal(by(n).region, "foreign");
  }
  const vocal = clipNumbers(by(34), layers);
  for (const n of vocal) {
    assert.equal(by(n).kind, "vocal");
    assert.equal(by(n).region, "latvian");
  }
});
