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

const SKIP_AUTHOR = new Set(["van"]);

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

function optionFound(tokens, option) {
  return option.every((word) => tokenFound(tokens, word));
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

export function authorMatches(expected, input) {
  const expectedTokens = tokenize(expected).filter((token) => !SKIP_AUTHOR.has(token));
  const initials = expectedTokens.filter((token) => token.length <= 2);
  const names = expectedTokens.filter((token) => token.length > 2);
  const tokens = tokenize(input);
  if (!tokens.length) return false;
  return namesOk(names, tokens) && initialsOk(initials, tokens);
}

function namesOk(names, tokens) {
  const visit = (index, used) => {
    if (index === names.length) return true;
    for (let i = 0; i < tokens.length; i++) {
      if (used[i]) continue;
      if (!tokenFound([tokens[i]], names[index])) continue;
      used[i] = true;
      if (visit(index + 1, used)) return true;
      used[i] = false;
    }
    return false;
  };
  return visit(0, []);
}

function initialsOk(initials, tokens) {
  const visit = (index, used) => {
    if (index === initials.length) return true;
    for (let i = 0; i < tokens.length; i++) {
      if (used[i]) continue;
      const token = tokens[i];
      const need = initials[index];
      const asName = token === need || (token.startsWith(need) && token.length >= need.length + 2);
      if (asName) {
        used[i] = true;
        if (visit(index + 1, used)) return true;
        used[i] = false;
      }
      if (token.length >= 2 && token.length <= 4) {
        const glued = initials.slice(index, index + token.length).join("");
        if (token === glued) {
          used[i] = true;
          if (visit(index + token.length, used)) return true;
          used[i] = false;
        }
      }
    }
    return false;
  };
  return visit(0, []);
}

export function detailResult(details, input) {
  const tokens = tokenize(input);
  const missing = [];
  for (const group of groupsFrom(details)) {
    if (!group.alts.some((option) => optionFound(tokens, option))) missing.push(group.label);
  }
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
