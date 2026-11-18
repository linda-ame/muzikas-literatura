const STOP = new Set(["un", "par"]);

const NUMBER_WORDS = {
  1: ["pirma", "pirmo", "pirmais", "pirmaja", "pirmas"],
  2: ["otra", "otro", "otrais", "otraja", "otras"],
  3: ["tresa", "treso", "tresais", "tresaja", "treso"],
  4: ["ceturta", "ceturto", "ceturtais", "ceturtaja", "ceturtas"],
  5: ["piekta", "piekto", "piektais", "piektaja"],
  9: ["devita", "devito", "devitais", "devitaja"],
  14: ["cetrpadsmit", "cetrpadsmita", "cetrpadsmitais", "cetrpadsmito"],
  40: ["cetrdesmit", "cetrdesmita", "cetrdesmitais", "cetrdesmito"],
};

const WORD_ALTS = {
  deju: [["deju"], ["deja"], ["dejas"]],
  vejamate: [["vejamate"], ["veja", "mate"]],
  vijolkoncerts: [["vijolkoncerts"], ["vijoles", "koncerts"]],
  solodziesma: [["solodziesma"], ["solo", "dziesma"]],
  kordziesma: [["kordziesma"], ["kora", "dziesma"]],
  kordziesmu: [["kordziesmu"], ["kora", "dziesmu"], ["kordziesma"], ["kora", "dziesma"]],
  klavierkoncerts: [["klavierkoncerts"], ["klavieru", "koncerts"]],
  klaviercikls: [["klaviercikls"], ["klavieru", "cikls"]],
  tautasdziesmas: [["tautasdziesmas"], ["tautas", "dziesmas"]],
  sakumtema: [["sakumtema"], ["sakuma", "tema"]],
  pamattema: [["pamattema"], ["pamata", "tema"]],
};

const SKIP_AUTHOR = new Set(["van", "fon"]);

// Pilnie vārdi der līdzās saraksta saīsinājumam. Rādīšanā paliek saraksta forma.
const GIVEN_NAMES = {
  "A.Vivaldi": [["Antonio"]],
  "G.F.Hendelis": [["Georgs"], ["Frīdrihs"]],
  "J.S.Bahs": [["Johans"], ["Sebastiāns"]],
  "J.Haidns": [["Jozefs"]],
  "V.A.Mocarts": [["Volfgangs"], ["Amadejs"]],
  "L.van Bēthovens": [["Ludvigs"]],
  "F.Šūberts": [["Francs"]],
  "K.M.Vēbers": [["Karls"], ["Marija"]],
  "F.Mendelszons-Bartoldi": [["Fēlikss"]],
  "J.Brāmss": [["Johanness", "Johanss"]],
  "R.Vāgners": [["Rihards"]],
  "Dž. Verdi": [["Džuzepe"]],
  "Ž.Bizē": [["Žoržs"]],
  "F.Šopēns": [["Frideriks"]],
  "E.Grīgs": [["Edvards"]],
  "M.Musorgskis": [["Modests"]],
  "N.Rimskis-Korsakovs": [["Nikolajs"]],
  "P.Čaikovskis": [["Pēteris", "Pjotrs"]],
  "M.Ravels": [["Moriss"]],
  "S.Prokofjevs": [["Sergejs"]],
  "A.Jurjāns": [["Andrejs"]],
  "J.Vītols": [["Jāzeps"]],
  "E.Melngailis": [["Emilis"]],
  "E.Dārziņš": [["Emīls"]],
  "A.Kalniņš": [["Alfrēds"]],
  "Jānis Mediņš": [["Jānis"]],
  "L. Garūta": [["Lūcija"]],
  "P. Barisons": [["Pēteris"]],
  "J.Ivanovs": [["Jānis"]],
  "M.Zariņš": [["Marģeris"]],
  "P.Dambis": [["Pauls"]],
  "I.Kalniņš": [["Imants"]],
  "P.Vasks": [["Pēteris"]],
  "M.Brauns": [["Mārtiņš"]],
  "A.Maskats": [["Arturs"]],
};

export function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ā/g, "a")
    .replace(/č/g, "c")
    .replace(/ē/g, "e")
    .replace(/ģ/g, "g")
    .replace(/ī/g, "i")
    .replace(/ķ/g, "k")
    .replace(/ļ/g, "l")
    .replace(/ņ/g, "n")
    .replace(/š/g, "s")
    .replace(/ū/g, "u")
    .replace(/ž/g, "z")
    .replace(/ŗ/g, "r")
    .replace(/[“”„«»"']/g, " ")
    .replace(/[.!,/?;:()[\]{}]+/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value) {
  const text = normalize(value);
  return text ? text.split(" ") : [];
}

function maxDist(word) {
  if (/^\d+$/.test(word)) return 0;
  if (word.length <= 3) return 0;
  if (word.length <= 12) return 1;
  return 2;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

function tokenFound(tokens, wanted) {
  const limit = maxDist(wanted);
  return tokens.some((token) => {
    if (token === wanted) return true;
    if (limit === 0) return false;
    if (token[0] !== wanted[0]) return false;
    if (Math.abs(token.length - wanted.length) > limit) return false;
    return levenshtein(token, wanted) <= limit;
  });
}

function hasMainTheme(tokens) {
  if (tokens.includes("gp")) return true;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] === "g" && tokens[i + 1] === "p") return true;
  }
  const head = tokenFound(tokens, "galvena") || tokenFound(tokens, "galveno") || tokenFound(tokens, "galvenas");
  const tail = tokenFound(tokens, "partija") || tokenFound(tokens, "partiju") || tokenFound(tokens, "partijas");
  return head && tail;
}

function groupsFrom(details) {
  const cleaned = details.replace(/G\.?\s*P\.?/gi, " ");
  const tokens = tokenize(cleaned).filter((token) => !STOP.has(token));
  return tokens.map((token) => {
    if (WORD_ALTS[token]) {
      return { label: surfaceLabel(details, token), alts: WORD_ALTS[token] };
    }
    if (/^\d+$/.test(token)) {
      const words = NUMBER_WORDS[Number(token)] || [];
      return {
        label: token,
        alts: [[token], ...words.map((word) => [word])],
      };
    }
    return { label: surfaceLabel(details, token), alts: [[token]] };
  });
}

function surfaceLabel(details, token) {
  const parts = details
    .replace(/G\.?\s*P\.?/gi, " ")
    .replace(/[“”„«»"]/g, "")
    .split(/[\s,/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const found = parts.find((part) => tokenize(part).includes(token));
  return found ? found.replace(/^\.+|\.+$/g, "") : token;
}

function authorSlots(expected) {
  const given = GIVEN_NAMES[expected] || [];
  const options = given.map((names) => names.map((name) => tokenize(name).find((token) => token.length > 2)));
  const flatGiven = new Set(options.flat());
  const tokens = tokenize(expected).filter((token) => !SKIP_AUTHOR.has(token) && !flatGiven.has(token));
  const initials = tokens.filter((token) => token.length <= 2);
  const surnames = tokens.filter((token) => token.length > 2);
  const slots = options.map((choices, index) => ({
    options: choices,
    initial: initials[index] || choices[0][0],
  }));
  return { surnames, slots };
}

export function authorMatches(expected, input) {
  const tokens = tokenize(input);
  if (!tokens.length) return false;
  const { surnames, slots } = authorSlots(expected);
  const used = [];
  if (!namesOk(surnames, tokens, used)) return false;
  return givenOk(slots, tokens, used);
}

function namesOk(names, tokens, used = []) {
  const visit = (index) => {
    if (index === names.length) return true;
    for (let i = 0; i < tokens.length; i++) {
      if (used[i]) continue;
      if (!tokenFound([tokens[i]], names[index])) continue;
      used[i] = true;
      if (visit(index + 1)) return true;
      used[i] = false;
    }
    return false;
  };
  return visit(0);
}

function givenOk(slots, tokens, used) {
  const visit = (index) => {
    if (index === slots.length) return true;
    for (let i = 0; i < tokens.length; i++) {
      if (used[i]) continue;
      const token = tokens[i];
      const slot = slots[index];
      const asName = slot.options.some((name) => tokenFound([token], name));
      if (token === slot.initial || asName) {
        used[i] = true;
        if (visit(index + 1)) return true;
        used[i] = false;
      }
      if (token.length >= 2 && token.length <= 4) {
        const glued = slots.slice(index, index + token.length).map((item) => item.initial).join("");
        if (token === glued) {
          used[i] = true;
          if (visit(index + token.length)) return true;
          used[i] = false;
        }
      }
    }
    return false;
  };
  return visit(0);
}

function fuzzyEq(got, expected, loose) {
  if (got === expected) return true;
  const limit = loose ? maxDist(expected) : 1;
  if (!limit || !got || !expected) return false;
  if (got[0] !== expected[0]) return false;
  if (Math.abs(got.length - expected.length) > limit) return false;
  return levenshtein(got, expected) <= limit;
}

function coverGroups(groups, tokens) {
  const covered = Array(groups.length).fill(false);
  if (!groups.length || !tokens.length) return covered;
  const prepared = groups.map((group) => group.alts.map((option) => option.join("")));
  const tUsed = Array(tokens.length).fill(false);
  let best = covered.slice();
  let bestCount = 0;

  function matches(start, length, tokenStart, tokenLength) {
    for (let i = 0; i < tokenLength; i++) if (tUsed[tokenStart + i]) return false;
    const got = tokens.slice(tokenStart, tokenStart + tokenLength).join("");
    let options = [""];
    for (let index = start; index < start + length; index++) {
      const next = [];
      for (const prefix of options) {
        for (const alt of prepared[index]) next.push(prefix + alt);
      }
      options = next;
    }
    return options.some((expected) => fuzzyEq(got, expected, length === 1 && tokenLength === 1));
  }

  function remember() {
    const count = covered.filter(Boolean).length;
    if (count > bestCount) {
      bestCount = count;
      best = covered.slice();
    }
  }

  function walk(start) {
    remember();
    if (start >= groups.length) return true;
    const maxLength = Math.min(4, groups.length - start);
    for (let length = 1; length <= maxLength; length++) {
      for (let tokenStart = 0; tokenStart < tokens.length; tokenStart++) {
        if (tUsed[tokenStart]) continue;
        const maxTokens = Math.min(tokens.length - tokenStart, Math.max(length, 2) + length);
        for (let tokenLength = 1; tokenLength <= maxTokens; tokenLength++) {
          if (tokens.slice(tokenStart, tokenStart + tokenLength).some((_, offset) => tUsed[tokenStart + offset])) continue;
          if (!matches(start, length, tokenStart, tokenLength)) continue;
          for (let offset = 0; offset < tokenLength; offset++) tUsed[tokenStart + offset] = true;
          for (let offset = 0; offset < length; offset++) covered[start + offset] = true;
          if (walk(start + length)) return true;
          for (let offset = 0; offset < tokenLength; offset++) tUsed[tokenStart + offset] = false;
          for (let offset = 0; offset < length; offset++) covered[start + offset] = false;
        }
      }
    }
    return false;
  }

  walk(0);
  return best;
}

export function detailResult(details, input) {
  const tokens = tokenize(input);
  const groups = groupsFrom(details);
  const covered = coverGroups(groups, tokens);
  const missing = groups.filter((_, index) => !covered[index]).map((group) => group.label);
  if (/G\.?\s*P\.?/i.test(details) && !hasMainTheme(tokens)) missing.push("G.P.");
  return { ok: missing.length === 0 && tokens.length > 0, missing: [...new Set(missing)] };
}

export function checkAnswer(piece, authorInput, detailsInput) {
  const authorOk = authorMatches(piece.author, authorInput);
  const details = detailResult(piece.details, detailsInput);
  const authorInOtherField = !authorOk && authorMatches(piece.author, detailsInput);
  const detailsInAuthorField = !details.ok && detailResult(piece.details, authorInput).ok;
  return {
    authorOk,
    detailsOk: details.ok,
    missing: details.missing,
    swapped: authorInOtherField && detailsInAuthorField,
    authorInOtherField,
  };
}

export function answerText(piece) {
  return /G\.?\s*P\.?/i.test(piece.details)
    ? piece.details.replace(/G\.?\s*P\.?/i, "G.P. (galvenā partija)")
    : piece.details;
}
