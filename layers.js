// Slāņi sadaļai „Savienot”. Klausīšanās pārbaude joprojām lieto pieces.js rindiņu.
// prompt ir tas, ko rāda. part ir tukšs, ja gabals pats ir viss darbs.

import { authorMatches, detailResult, normalize } from "./check.js";

const MOVEMENTS = [
  "1. daļa",
  "2. daļa",
  "3. daļa",
  "4. daļa",
  "1. daļa, G.P.",
  "1. daļa, ievads",
  "pamattēma",
  "sākumtēma",
];

export const layers = [
  layer(1, "A.Vivaldi", "foreign", "instrumental", "Gada laiki", 'Vijolkoncerts "Pavasaris", 1. daļa', "title"),
  layer(2, "G.F.Hendelis", "foreign", "vocal", 'oratorija "Mesija"', 'koris "Alleluja"', "title"),
  layer(3, "J.S.Bahs", "foreign", "instrumental", "Tokāta un fūga re, ērģelēm"),
  layer(4, "J.S.Bahs", "foreign", "instrumental", "3. svīta orķestrim", "Ārija", "title"),
  layer(5, "J.Haidns", "foreign", "instrumental", 'simfonija "Pārsteigums"', "2. daļa", "movement"),
  layer(6, "V.A.Mocarts", "foreign", "instrumental", '"Mazā nakts mūzika" stīgu orķestrim', "1. daļa", "movement"),
  layer(7, "V.A.Mocarts", "foreign", "instrumental", "40. simfonija", "1. daļa, G.P.", "movement"),
  layer(8, "V.A.Mocarts", "foreign", "instrumental", "sonāte La klavierēm", "3. daļa", "movement"),
  layer(9, "V.A.Mocarts", "foreign", "vocal", 'opera "Burvju flauta"', "Nakts karalienes ārija", "title"),
  layer(10, "L.van Bēthovens", "foreign", "instrumental", "5. simfonija", "1. daļa, G.P.", "movement"),
  layer(11, "L.van Bēthovens", "foreign", "vocal", "9. simfonija", "Oda priekam, 4. daļa", "title"),
  layer(12, "L.van Bēthovens", "foreign", "instrumental", "Mēnesnīcas sonāte klavierēm", "1. daļa", "movement"),
  layer(13, "F.Šūberts", "foreign", "vocal", 'solodziesma "Ave Maria"'),
  layer(14, "K.M.Vēbers", "foreign", "vocal", 'opera "Burvju strēlnieks"', "Mednieku koris", "title"),
  layer(15, "F.Mendelszons-Bartoldi", "foreign", "instrumental", 'mūzika lugai "Sapnis vasaras naktī"', "Kāzu maršs", "title"),
  layer(16, "J.Brāmss", "foreign", "instrumental", "5. ungāru deju"),
  layer(17, "R.Vāgners", "foreign", "instrumental", 'opera "Valkīra"', "Valkīru auļojums", "title"),
  layer(18, "Dž. Verdi", "foreign", "vocal", 'opera "Traviata"', "Dzīru dziesma", "title"),
  layer(19, "Dž. Verdi", "foreign", "instrumental", 'opera "Aīda"', "Triumfa maršs", "title"),
  layer(20, "Ž.Bizē", "foreign", "vocal", 'opera "Karmena"', "Karmenas habanera", "title"),
  layer(21, "F.Šopēns", "foreign", "instrumental", "Polonēze La klavierēm"),
  layer(22, "E.Grīgs", "foreign", "instrumental", 'svīta "Pērs Gints"', "Rīts", "title"),
  layer(23, "M.Musorgskis", "foreign", "instrumental", 'klaviercikls "Izstādes gleznas"', '"Mājiņa uz vistas kājām"', "title"),
  layer(24, "N.Rimskis-Korsakovs", "foreign", "instrumental", 'simfoniskā svīta "Šeherezade"', "Šeherezades tēma", "title"),
  layer(25, "P.Čaikovskis", "foreign", "instrumental", "1. klavierkoncerts", "1. daļa, ievads", "movement"),
  layer(26, "P.Čaikovskis", "foreign", "instrumental", 'balets "Gulbju ezers"', "Mazo gulbīšu deja", "title"),
  layer(27, "M.Ravels", "foreign", "instrumental", "Bolero"),
  layer(28, "S.Prokofjevs", "foreign", "instrumental", 'balets "Romeo un Džuljeta"', "Bruņinieku deja", "title"),
  layer(29, "A.Jurjāns", "latvian", "vocal", 'kantāte "Tēvijai"', "pamattēma", "movement"),
  layer(30, "A.Jurjāns", "latvian", "instrumental", "Latvju vispārējo dziesmu svētku maršs"),
  layer(31, "J.Vītols", "latvian", "vocal", 'kora balāde "Gaismas pils"'),
  layer(32, "J.Vītols", "latvian", "instrumental", 'Variācijas klavierēm par tautasdziesmas "Ej, saulīte, drīz pie Dieva" tēmu'),
  layer(33, "E.Melngailis", "latvian", "vocal", 'tautasdziesmas apdare korim "Lokatiesi mežu gali"'),
  layer(34, "E.Melngailis", "latvian", "vocal", 'kordziesma "Jāņuvakars"'),
  layer(35, "E.Dārziņš", "latvian", "vocal", 'kordziesma "Lauztās priedes"'),
  layer(36, "E.Dārziņš", "latvian", "vocal", 'solodziesma "Teici to stundu, to brīdi"'),
  layer(37, "E.Dārziņš", "latvian", "instrumental", "Melanholiskais valsis"),
  layer(38, "A.Kalniņš", "latvian", "vocal", 'opera "Baņuta"', "Baņutas vadmotīvs", "title"),
  layer(39, "A.Kalniņš", "latvian", "instrumental", 'simfoniskā idille "Mana dzimtene"'),
  layer(40, "A.Kalniņš", "latvian", "vocal", 'solodziesma "Brīnos es"'),
  layer(41, "Jānis Mediņš", "latvian", "instrumental", "1. svīta orķestrim", "Ārija", "title"),
  layer(42, "L. Garūta", "latvian", "vocal", 'kantāte "Dievs, Tava zeme deg!"', "sākumtēma", "movement"),
  layer(43, "P. Barisons", "latvian", "vocal", 'kordziesma "Dziesmai šodien liela diena"'),
  layer(44, "J.Ivanovs", "latvian", "instrumental", "14. simfonija", "1. daļa", "movement"),
  layer(45, "M.Zariņš", "latvian", "instrumental", "Partita baroka stilā", "Pavana", "title"),
  layer(46, "P.Dambis", "latvian", "vocal", 'kordziesmu cikls "Jūras dziesmas"', '"Pūti, pūti, Vējamāte"', "title"),
  layer(47, "I.Kalniņš", "latvian", "instrumental", "4. simfonija", "1. daļa", "movement"),
  layer(48, "P.Vasks", "latvian", "instrumental", '"Ainava ar putniem"'),
  layer(49, "M.Brauns", "latvian", "vocal", 'dziesma "Saule, Pērkons, Daugava"'),
  layer(50, "A.Maskats", "latvian", "instrumental", "Tango"),
];

function layer(n, author, region, kind, prompt, part = "", partShape = "") {
  return { n, author, region, kind, prompt, part, partShape };
}

export function fieldOk(layer, field, input) {
  if (field === "author") return authorMatches(layer.author, input);
  if (field === "work") return detailResult(layer.prompt, input).ok;
  if (!layer.part) return false;
  return detailResult(layer.part, input).ok;
}

export function choiceTexts(layer, field, session) {
  if (field === "part") return layer.part ? partChoices(layer, session) : [];
  if (field === "work") return workChoices(layer, session);
  return shuffle([layer.author, ...takeUnique(authorPool(layer, session), layer.author, 4)]);
}

export function clipNumbers(layer, session) {
  const picked = [];
  const groups = [
    session.filter((item) => item.n !== layer.n && item.kind === layer.kind && item.region === layer.region),
    layers.filter((item) => item.n !== layer.n && item.kind === layer.kind && item.region === layer.region),
  ];
  for (const group of groups) {
    for (const item of shuffle(group)) {
      if (picked.length >= 3) break;
      if (picked.some((entry) => entry.n === item.n)) continue;
      picked.push(item);
    }
    if (picked.length >= 3) break;
  }
  return shuffle([layer, ...picked]).map((item) => item.n);
}

function workChoices(layer, session) {
  const names = (list) =>
    list
      .filter((item) => item.n !== layer.n && item.kind === layer.kind && item.region === layer.region)
      .map((item) => item.prompt);
  return shuffle([layer.prompt, ...takeUnique(mix([names(session), names(layers)]), layer.prompt, 4)]);
}

function authorPool(layer, session) {
  const inSession = session.filter((item) => item.region === layer.region && item.n !== layer.n);
  const rest = layers.filter((item) => item.region === layer.region && item.n !== layer.n);
  return mix([inSession.map((item) => item.author), rest.map((item) => item.author)]);
}

function partChoices(layer, session) {
  const correct = layer.part;
  const titles = mix([titleNames(session, layer), titleNames(layers, layer)]);
  const movements = mix([
    session
      .filter((item) => item.n !== layer.n && item.part && item.partShape === "movement")
      .map((item) => item.part),
    MOVEMENTS,
  ]);
  const picked = [...takeUnique(titles, correct, 2), ...takeUnique(movements, correct, 2)];
  if (picked.length < 4) {
    const seen = new Set([normalize(correct), ...picked.map((text) => normalize(text))]);
    for (const text of shuffle([...titles, ...movements])) {
      const key = normalize(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      picked.push(text);
      if (picked.length === 4) break;
    }
  }
  return shuffle([correct, ...picked]);
}

function titleNames(list, layer) {
  const out = [];
  for (const item of list) {
    if (item.n === layer.n || item.kind !== layer.kind || item.region !== layer.region) continue;
    if (item.part && item.partShape === "title") out.push(item.part);
    else if (!item.part) out.push(item.prompt);
  }
  return out;
}

function mix(groups) {
  const out = [];
  const seen = new Set();
  for (const group of groups) {
    for (const text of shuffle(group)) {
      const key = normalize(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
  }
  return out;
}

function takeUnique(list, correct, count) {
  const seen = new Set([normalize(correct)]);
  const out = [];
  for (const text of list) {
    const key = normalize(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length === count) break;
  }
  return out;
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
