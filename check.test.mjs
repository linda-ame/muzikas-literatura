import assert from "node:assert/strict";
import test from "node:test";
import { pieces, clipBounds } from "./pieces.js";
import { checkAnswer, authorMatches, detailResult } from "./check.js";

test("sarakstā ir 50 numuri pēc kārtas", () => {
  assert.equal(pieces.length, 50);
  assert.deepEqual(pieces.map((piece) => piece.n), Array.from({ length: 50 }, (_, i) => i + 1));
  assert.equal(new Set(pieces.map((piece) => piece.youtubeId)).size, 50);
});

test("katram gabalam fragments ievietojas video garumā", () => {
  for (const piece of pieces) {
    const { start, end } = clipBounds(piece);
    assert.ok(start >= 0, piece.n);
    assert.ok(end > start + 4, piece.n);
    assert.ok(end <= piece.duration, piece.n);
  }
});

test("pareiza atbilde no lapas der katram gabalam", () => {
  for (const piece of pieces) {
    const result = checkAnswer(piece, piece.author, piece.details);
    assert.equal(result.authorOk, true, piece.author);
    assert.equal(result.detailsOk, true, `${piece.n} ${piece.details} missing ${result.missing}`);
  }
});

test("autors pieņem saraksta formu un sīkas atšķirības", () => {
  const by = (n) => pieces.find((piece) => piece.n === n);
  assert.equal(authorMatches(by(1).author, "a. vivaldi"), true);
  assert.equal(authorMatches(by(1).author, "Antonio Vivaldi"), true);
  assert.equal(authorMatches(by(1).author, "Vivaldi"), false);
  assert.equal(authorMatches(by(2).author, "G. F. Hendelis"), true);
  assert.equal(authorMatches(by(2).author, "GF Hendelis"), true);
  assert.equal(authorMatches(by(2).author, "Georgs Fridrihs Hendelis"), true);
  assert.equal(authorMatches(by(10).author, "L. Bēthovens"), true);
  assert.equal(authorMatches(by(10).author, "Ludvigs van Bēthovens"), true);
  assert.equal(authorMatches(by(10).author, "Bēthovens"), false);
  assert.equal(authorMatches(by(18).author, "Dz. Verdi"), true);
  assert.equal(authorMatches(by(18).author, "Džuzepe Verdi"), true);
  assert.equal(authorMatches(by(20).author, "Z. Bize"), true);
  assert.equal(authorMatches(by(15).author, "F. Mendelszons Bartoldi"), true);
  assert.equal(authorMatches(by(15).author, "F. Mendelszons"), false);
  assert.equal(authorMatches(by(24).author, "N. Rimskis Korsakovs"), true);
  assert.equal(authorMatches(by(41).author, "Janis Medins"), true);
  assert.equal(authorMatches(by(41).author, "J. Medins"), false);
  assert.equal(authorMatches(by(38).author, "A.Kalnins"), true);
  assert.equal(authorMatches(by(38).author, "I.Kalniņš"), false);
  assert.equal(authorMatches(by(47).author, "Imants Kalniņš"), true);
  assert.equal(authorMatches(by(47).author, "A. Kalniņš"), false);
});

test("informācijā jābūt visam, bet drīkst kļūdīties sīkumos", () => {
  const by = (n) => pieces.find((piece) => piece.n === n);
  const ok = (n, text) => detailResult(by(n).details, text).ok;

  assert.equal(ok(1, "Gada laiki, vijolkoncerts Pavasaris, 1. dala"), true);
  assert.equal(ok(1, "vijolkoncerts Pavasaris"), false);
  assert.equal(ok(1, "gada laiki vijoles koncerts Pavasaris pirma dala"), true);
  assert.equal(ok(7, "40. simfonija 1. dala G.P."), true);
  assert.equal(ok(7, "40 simfonija pirma dala galvenā partija"), true);
  assert.equal(ok(7, "40. simfonija 1. daļa"), false);
  assert.equal(ok(10, "5.simfonija, 1.dala"), false);
  assert.equal(ok(20, "Karmenas habanera opera Karmena"), true);
  assert.equal(ok(20, "Karmena"), false);
  assert.equal(ok(44, "14. simfonija 1. dala"), true);
  assert.equal(ok(44, "4. simfonija 1. dala"), false);
  assert.equal(ok(49, "dziesma Saule Perkons Daugava"), true);
  assert.equal(ok(49, "Saule Daugava"), false);
  assert.equal(ok(39, "simfonija Mana dzimtene"), false);
  assert.equal(ok(39, "simfoniska idille Mana dzimtene"), true);
  assert.equal(ok(46, "kora dziesmu cikls Juras dziesmas Puti puti Veja mate"), true);
  assert.equal(ok(48, "Ainava ar putniem"), true);
  assert.equal(ok(48, "Ainava putniem"), false);
  assert.equal(ok(33, "tautas dziesmas apdare korim Lokaties mezu gali"), true);
  assert.equal(ok(16, "5. ungaru deja"), true);
});

test("samainītus laukus nepieskaita par pareiziem", () => {
  const piece = pieces[0];
  const result = checkAnswer(piece, piece.details, piece.author);
  assert.equal(result.authorOk, false);
  assert.equal(result.detailsOk, false);
  assert.equal(result.swapped, true);
});
