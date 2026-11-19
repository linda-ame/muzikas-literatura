import { pieces, clipBounds } from "./pieces.js";
import { answerText, checkAnswer, normalize } from "./check.js";
import { DEFAULT_ID, addClip, blankEntry, chooseClip, rangeError, removeClip, resolveBounds, sanitizeEntry } from "./clips.js";
import { choiceTexts, clipNumbers, fieldOk, layers } from "./layers.js?v=3";

const TEST_SIZE = 10;
const SETTINGS_KEY = "ml-settings";
const SESSION_KEY = "ml-session";
const CLIPS_KEY = "ml-clips";
const HISTORY_KEY = "ml-quiz-history";
const ASSEMBLE_KEY = "ml-assemble";
const ASSEMBLE_SESSION_KEY = "ml-assemble-session";

const state = {
  screen: "learn",
  settings: loadSettings(),
  queue: [],
  index: 0,
  restored: false,
  openN: null,
  editor: { n: null, name: "", from: "", to: "", error: "" },
  assemble: loadAssemble(),
  assembleQueue: [],
  assembleIndex: 0,
  historyLogged: false,
};

const playerState = {
  ready: false,
  player: null,
  clip: null,
  playing: false,
  skipUntil: 0,
};

const app = document.querySelector("#app");
app.addEventListener("click", onClick);
app.addEventListener("input", onInput);
app.addEventListener("change", onChange);
app.addEventListener("submit", onSubmit);
app.addEventListener("pointerdown", onPointerDown);
app.addEventListener("keydown", onKeyDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", () => {
  if (playerState.scrubPiece && playerState.scrubTo != null) playLearn(playerState.scrubPiece, playerState.scrubTo);
  playerState.scrub = null;
  playerState.scrubPiece = null;
  playerState.scrubTo = null;
});

window.onYouTubeIframeAPIReady = () => createPlayer();

function createPlayer() {
  playerState.ready = false;
  const host = document.querySelector("#yt-host");
  if (!host.querySelector("#player")) host.innerHTML = '<div id="player"></div>';
  playerState.player = new YT.Player("player", {
    width: "320",
    height: "180",
    playerVars: {
      controls: 0,
      disablekb: 1,
      fs: 0,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      iv_load_policy: 3,
      origin: location.origin,
    },
    events: {
      onReady: () => {
        playerState.ready = true;
        hidePlayerTitle();
        if (playerState.clip) loadClip(playerState.clip);
      },
      onStateChange: onPlayerState,
      onError: onPlayerError,
    },
  });
}

function rebuildPlayer() {
  playerState.ready = false;
  playerState.clip = null;
  try {
    playerState.player?.destroy();
  } catch {
    /* the broken player may already be gone */
  }
  document.querySelector("#yt-host").innerHTML = '<div id="player"></div>';
  createPlayer();
}

const api = document.createElement("script");
api.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(api);
setInterval(watchPlayback, 250);

restoreSession();
restoreAssembleSession();
render();

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (saved && validSettings(saved)) {
      if (saved.from === 1 && saved.to === 15) {
        saved.to = 20;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(saved));
      }
      saved.hints = saved.hints === true;
      return saved;
    }
  } catch {
    /* keep the default */
  }
  return { from: 1, to: 20, mode: "all", feedback: "now", hints: false };
}

function validSettings(value) {
  return (
    Number.isInteger(value.from) &&
    Number.isInteger(value.to) &&
    value.from >= 1 &&
    value.to <= 50 &&
    value.from <= value.to &&
    (value.mode === "all" || value.mode === "test") &&
    (value.feedback === "now" || value.feedback === "end")
  );
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(CLIPS_KEY) || "{}");
    if (!raw || typeof raw !== "object") return {};
    return raw;
  } catch {
    return {};
  }
}

function entryFor(n) {
  return sanitizeEntry(loadStore()[n] || blankEntry());
}

function writeEntry(n, entry) {
  const store = loadStore();
  store[n] = sanitizeEntry(entry);
  localStorage.setItem(CLIPS_KEY, JSON.stringify(store));
}

function selectedBounds(piece) {
  return resolveBounds(entryFor(piece.n), clipBounds(piece), piece.duration);
}

function saveSession() {
  if (!state.queue.length) {
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      settings: state.settings,
      index: state.index,
      screen: state.screen,
      historyLogged: state.historyLogged,
      queue: state.queue.map((item) => ({
        n: item.piece.n,
        start: item.start,
        end: item.end,
        authorInput: item.authorInput,
        detailsInput: item.detailsInput,
        answered: item.answered,
        authorOk: item.authorOk,
        detailsOk: item.detailsOk,
        missing: item.missing,
        swapped: item.swapped,
        authorInOtherField: item.authorInOtherField,
        heard: item.heard,
        attempted: item.attempted,
        authorOptions: item.authorOptions,
        detailsOptions: item.detailsOptions,
        authorWrong: item.authorWrong,
        detailsWrong: item.detailsWrong,
        authorFixed: item.authorFixed,
        detailsFixed: item.detailsFixed,
      })),
    }),
  );
}

function restoreSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (!saved || !validSettings(saved.settings) || !Array.isArray(saved.queue) || !saved.queue.length) return;
    const queue = saved.queue.map((item) => {
      const piece = pieces.find((entry) => entry.n === item.n);
      if (!piece) throw new Error("missing piece");
      return {
        piece,
        authorOptions: null,
        detailsOptions: null,
        authorWrong: [],
        detailsWrong: [],
        authorFixed: false,
        detailsFixed: false,
        attempted: false,
        ...item,
      };
    });
    state.settings = saved.settings;
    state.queue = queue;
    state.index = Math.min(saved.index, queue.length - 1);
    state.historyLogged = saved.historyLogged === true;
    state.screen = saved.screen === "summary" || saved.screen === "question" ? saved.screen : "settings";
    state.restored = state.screen !== "settings";
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function render() {
  const quiz = state.screen === "settings" || state.screen === "question" || state.screen === "summary";
  const assemble = state.screen === "assemble" || state.screen === "assemble-card" || state.screen === "assemble-done";
  const keepSound = state.screen === "question" || state.screen === "learn" || state.screen === "summary" || state.screen === "assemble-card";
  app.innerHTML = `
    ${shell(assemble ? "assemble" : quiz ? "quiz" : "learn")}
    ${screenView()}
  `;
  if (!keepSound) stopPlayback();
  document.body.classList.toggle("sheet-open", state.screen === "learn" && state.openN != null);
  if (state.screen === "learn" && playerState.clip?.learn) {
    setLearnUi(playerState.clip.n, null, playerState.playing ? "Skan" : null);
  }
  if (state.screen === "assemble-card" && playerState.clip?.assemble) markAssemblePlaying();
}

function screenView() {
  if (state.screen === "learn") return learnView();
  if (state.screen === "settings") return settingsView();
  if (state.screen === "summary") return summaryView();
  if (state.screen === "assemble") return assembleSetup();
  if (state.screen === "assemble-card") return assembleCard();
  if (state.screen === "assemble-done") return assembleDone();
  return questionView();
}

function shell(active) {
  const whites = Array.from({ length: 7 }, () => "<i></i>").join("");
  const blacks = [1, 2, 4, 5, 6]
    .map((crack) => `<b style="left:${(crack / 7) * 100 - 4.4}%"></b>`)
    .join("");
  return `
    <header class="masthead">
      <div class="brand">
        <svg class="note" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="currentColor" d="M20 6h3.2v22.2a6.2 6.2 0 1 1-3.2-5.4V6zm12.4 5.2H36v16.6a6.2 6.2 0 1 1-3.6-5.6V11.2z"/>
        </svg>
        <h1>Mūzikas literatūra</h1>
        <div class="piano" aria-hidden="true">${whites}${blacks}</div>
      </div>
    </header>
    <nav class="modes">
      <button type="button" data-action="goto-learn" class="${active === "learn" ? "is-on" : ""}">Mācīties</button>
      <button type="button" data-action="goto-assemble" class="${active === "assemble" ? "is-on" : ""}">Savienot</button>
      <button type="button" data-action="goto-quiz" class="${active === "quiz" ? "is-on" : ""}">Pārbaudīt sevi</button>
    </nav>
  `;
}

function learnView() {
  const open = pieces.find((piece) => piece.n === state.openN);
  return `
    <div class="catalog">
      ${pieces.map((piece) => pieceRow(piece)).join("")}
    </div>
    ${open ? pieceDialog(open) : ""}
  `;
}

function pieceRow(piece) {
  return `
    <button class="piece-row" type="button" data-action="open-piece" data-n="${piece.n}">
      <span class="num">${String(piece.n).padStart(2, "0")}</span>
      <span class="piece-copy">
        <strong>${esc(piece.author)}</strong>
        <span class="details">${esc(piece.details)}</span>
        ${piece.replaced ? `<span class="note-swap">Šis ieraksts nav no sākotnējās playlistes.</span>` : ""}
      </span>
    </button>
  `;
}

function pieceDialog(piece) {
  const atStart = piece.n === 1;
  const atEnd = piece.n === pieces.length;
  return `
    <div class="sheet">
      <div class="sheet-card" role="dialog" aria-modal="true" aria-label="${piece.n}. ${esc(piece.author)}" tabindex="-1">
        <div class="sheet-nav">
          <div class="sheet-steps">
            <button class="ghost" type="button" data-action="learn-step" data-by="-1" ${atStart ? "disabled" : ""}>‹ Iepriekšējais</button>
            <button class="ghost" type="button" data-action="learn-step" data-by="1" ${atEnd ? "disabled" : ""}>Nākamais ›</button>
          </div>
          <button class="sheet-close" type="button" data-action="close-piece" aria-label="Aizvērt">×</button>
        </div>
        ${pieceCard(piece)}
      </div>
    </div>
  `;
}

function pieceCard(piece) {
  const entry = entryFor(piece.n);
  const bounds = clipBounds(piece);
  const playing = playerState.playing && playerState.clip?.token === learnToken(piece.n);
  const hasCustom = entry.custom.length > 0;
  const chosen = hasCustom ? entry.selected : DEFAULT_ID;
  return `
    <article class="piece" id="piece-${piece.n}">
      <div class="piece-top">
        <span class="num">${String(piece.n).padStart(2, "0")}</span>
        <div>
          <h2>${esc(piece.author)}</h2>
          <p class="details">${esc(piece.details)}</p>
          ${piece.replaced ? `<p class="note-swap">Šis ieraksts nav no sākotnējās playlistes.</p>` : ""}
        </div>
      </div>
      <div class="transport" style="margin-top:12px">
        <button class="play ${playing ? "is-on" : ""}" type="button" data-action="learn-play" data-n="${piece.n}">${playing ? "Apturēt" : "Klausīties visu"}</button>
        <button class="step" type="button" data-action="seek" data-n="${piece.n}" data-by="-15">−15</button>
        <button class="step" type="button" data-action="seek" data-n="${piece.n}" data-by="15">+15</button>
        <span class="time" data-time-for="${piece.n}">${clock(piece.start)} / ${clock(piece.duration)}</span>
      </div>
      <div class="scrub" data-scrub="${piece.n}" role="slider" tabindex="0" aria-label="Vieta ierakstā: ${esc(piece.author)}" aria-valuemin="0" aria-valuemax="${Math.round(piece.duration)}" aria-valuenow="${Math.round(piece.start)}">
        <span data-bar-for="${piece.n}"></span>
      </div>
      <section class="clips">
        <h3>Klausāmā daļa pārbaudei</h3>
        ${clipRow(piece.n, DEFAULT_ID, "Noklusējums", bounds, chosen, hasCustom, false)}
        ${entry.custom.map((clip) => clipRow(piece.n, clip.id, clip.name, clip, chosen, true, true)).join("")}
        ${state.editor.n === piece.n ? editorForm(piece) : `<div class="actions" style="margin-top:8px"><button class="ghost" type="button" data-action="open-editor" data-n="${piece.n}">Pievienot citu</button></div>`}
      </section>
    </article>
  `;
}

function clipRow(n, id, name, range, chosen, showRadio, removable) {
  const from = range.from ?? range.start;
  const to = range.to ?? range.end;
  const label = `${secText(from)}–${secText(to)} s`;
  if (!showRadio) {
    return `<div class="pick-row"><span class="pick-name">${esc(name)}</span><span class="pick-time">${label}</span></div>`;
  }
  return `
    <div class="pick-row">
      <label>
        <input type="radio" name="pick-${n}" value="${esc(id)}" data-n="${n}" ${chosen === id ? "checked" : ""} />
        <span class="pick-name">${esc(name)}</span>
        <span class="pick-time">${label}</span>
      </label>
      ${removable ? `<button class="icon" type="button" data-action="delete-clip" data-n="${n}" data-id="${esc(id)}" aria-label="Dzēst daļu ${esc(name)}">×</button>` : ""}
    </div>
  `;
}

function editorForm(piece) {
  const editor = state.editor;
  return `
    <div class="editor">
      <label class="field">Nosaukums
        <input type="text" data-draft="name" value="${esc(editor.name)}" maxlength="40" placeholder="piemēram, galvenais motīvs" autocomplete="off" />
      </label>
      <div class="range-row">
        <label class="field">No
          <input type="text" inputmode="decimal" data-draft="from" value="${esc(editor.from)}" />
        </label>
        <label class="field">līdz
          <input type="text" inputmode="decimal" data-draft="to" value="${esc(editor.to)}" />
        </label>
      </div>
      ${editor.error ? `<p class="warn">${esc(editor.error)}</p>` : `<p class="quiet">Sekundes šajā YouTube ierakstā, no 0 līdz ${Math.floor(piece.duration)}.</p>`}
      <div class="actions">
        <button class="primary" type="button" data-action="save-clip" data-n="${piece.n}">Saglabāt</button>
        <button class="ghost" type="button" data-action="close-editor">Atcelt</button>
      </div>
    </div>
  `;
}

function settingsView() {
  const { from, to, mode, feedback } = state.settings;
  return `
    <p class="lede">Noklausies fragmentu un ieraksti autoru tā, kā sarakstā, bet otrajā laukā visu pārējo par šo gabalu. Skan tā daļa, kas mācībās ir ieķeksēta.</p>
    <form class="card" id="settings-form">
      <fieldset>
        <legend>Cik gabalu klausīties?</legend>
        <div class="range-row">
          <label class="field">No
            <input type="number" min="1" max="50" name="from" data-field="from" value="${from}" inputmode="numeric" />
          </label>
          <label class="field">līdz
            <input type="number" min="1" max="50" name="to" data-field="to" value="${to}" inputmode="numeric" />
          </label>
        </div>
        <div class="presets" style="margin-top:10px">
          ${[20, 30, 40, 50].map((end) => `<button type="button" class="chip ${to === end && from === 1 ? "is-on" : ""}" data-action="preset" data-to="${end}">1–${end}</button>`).join("")}
        </div>
      </fieldset>
      <div class="split" style="margin-top:18px">
        <fieldset>
          <legend>Kā klausīties?</legend>
          <label class="radio"><input type="radio" name="mode" value="all" ${mode === "all" ? "checked" : ""} /> Visus izvēlētos, jauktā secībā</label>
          <label class="radio"><input type="radio" name="mode" value="test" ${mode === "test" ? "checked" : ""} /> Tests: 10 nejauši no izvēlētajiem</label>
        </fieldset>
        <fieldset>
          <legend>Kad rādīt pareizās atbildes?</legend>
          <label class="radio"><input type="radio" name="feedback" value="now" ${feedback === "now" ? "checked" : ""} /> Uzreiz pēc katra gabala</label>
          <label class="radio"><input type="radio" name="feedback" value="end" ${feedback === "end" ? "checked" : ""} /> Kad visi gabali ir pabeigti</label>
        </fieldset>
      </div>
      <fieldset style="margin-top:18px">
        <legend>Atbilžu varianti</legend>
        <label class="radio"><input type="checkbox" name="hints" ${state.settings.hints ? "checked" : ""} /> Piedāvāt variantus pēc pieprasījuma</label>
        <p class="quiet">Ja atbilde nav pareiza, varianti atveras paši. Ķeksis pieliek katram laukam savu pogu vēl pirms iesniegšanas.</p>
      </fieldset>
      <p class="plan" id="plan-text">${planText(state.settings)}</p>
      <div class="actions" style="margin-top:16px">
        <button class="primary" type="submit">Sākt</button>
      </div>
      <p class="foot quiet">Vienā reizē gabali neatkārtojas. Skaņa nāk no YouTube, tāpēc dažreiz pirms mūzikas ir reklāma. Nosaukums video logā nav redzams.</p>
    </form>
    ${state.restored ? `<div class="card"><p>Iepriekšējā reize vēl ir atvērta.</p><button class="ghost" type="button" data-action="resume">Turpināt</button></div>` : ""}
  `;
}

function questionView() {
  const item = current();
  const total = state.queue.length;
  const show = item.answered && state.settings.feedback === "now";
  const length = Math.max(1, Math.round(item.end - item.start));
  const pending = item.attempted && !item.answered;
  const nextLabel = state.index + 1 === total ? "Skatīt rezultātu" : "Nākamais gabals";
  return `
    <section class="card">
      <div class="progress">
        <strong>${state.index + 1}. no ${total}</strong>
        <button class="tiny" type="button" data-action="settings">Mainīt iestatījumus</button>
      </div>
      <div class="listen-row">
        <button class="listen ${playerState.playing ? "is-on" : ""}" id="play-btn" type="button" data-action="toggle-play">${playLabel(item)}</button>
      </div>
      <p class="status" id="clip-status">${item.heard ? "Vari klausīties vēlreiz vai rakstīt atbildi." : `Fragments ilgst apmēram ${length} s. Ja vispirms ir reklāma, pagaidi.`}</p>
      <div class="meter" aria-hidden="true"><span id="clip-bar"></span></div>
      <form id="answer-form" class="stack">
        <div>
          <label class="field">Autors
            <input class="${fieldClass(item, "author")}" type="text" name="author" data-field="author" value="${esc(item.authorInput)}" autocomplete="off" autocapitalize="off" lang="lv" ${fieldLocked(item, "author") ? "readonly" : ""} />
          </label>
          ${quizAsk(item, "author")}
          ${quizOptionList(item, "author")}
        </div>
        <div>
          <label class="field">Pārējā informācija
            <textarea class="${fieldClass(item, "details")}" name="details" data-field="details" lang="lv" rows="2" ${fieldLocked(item, "details") ? "readonly" : ""}>${esc(item.detailsInput)}</textarea>
          </label>
          ${quizAsk(item, "details")}
          ${quizOptionList(item, "details")}
        </div>
        ${show ? resultBlock(item) : ""}
        ${show || pending ? `<div class="actions"><button class="primary" type="button" data-action="next">${nextLabel}</button></div>` : `
          <div class="actions">
            <button class="primary" type="submit">Iesniegt atbildi</button>
            <button class="ghost" type="button" data-action="skip">Nezinu</button>
          </div>
        `}
      </form>
    </section>
  `;
}

function fieldClass(item, field) {
  if (item[`${field}Ok`] || item[`${field}Fixed`]) return "is-good";
  if (item.attempted) return "is-bad";
  return "";
}

function fieldLocked(item, field) {
  if (item.answered || item[`${field}Fixed`] || item[`${field}Ok`]) return true;
  return Boolean(item.attempted);
}

function quizAsk(item, field) {
  if (!state.settings.hints || item.attempted || item.answered) return "";
  if (item[`${field}Options`] || item[`${field}Fixed`] || item[`${field}Ok`]) return "";
  return `<div class="actions"><button class="ghost" type="button" data-action="quiz-show" data-field="${field}">Parādīt variantus</button></div>`;
}

function quizOptionList(item, field) {
  const options = item[`${field}Options`];
  if (!options || item.answered || item[`${field}Ok`] || item[`${field}Fixed`]) return "";
  const wrong = item[`${field}Wrong`] || [];
  return `<div class="options">${options.map((option, index) => {
    const missed = wrong.includes(index);
    return `<button class="option ${missed ? "is-bad" : ""}" type="button" data-action="quiz-option" data-field="${field}" data-index="${index}" ${missed ? "disabled" : ""}>${missed ? "✕ " : ""}${esc(option.text)}</button>`;
  }).join("")}</div>`;
}

function summaryView() {
  rememberRound();
  const total = state.queue.length;
  const counts = { self: 0, help: 0, weak: 0 };
  for (const item of state.queue) counts[pieceOutcome(item)] += 1;
  const title = state.settings.mode === "test"
    ? (total === 1 ? "Tests pabeigts. Noklausīts 1 gabals." : `Tests pabeigts. Noklausīti ${total} gabali.`)
    : (total === 1 ? "Vienīgais gabals ir noklausīts." : `Visi ${total} gabali ir noklausīti.`);
  const groups = [
    ["weak", "Jāatkārto"],
    ["help", "Ar variantiem"],
    ["self", "Sanāk labi"],
  ];
  return `
    <section class="card">
      <h2>Rezultāts</h2>
      <p class="lede">${title}</p>
      <div class="scores">
        <div class="score"><b>${counts.self}/${total}</b> pats zināja</div>
        <div class="score"><b>${counts.help}/${total}</b> ar variantiem</div>
        <div class="score"><b>${counts.weak}/${total}</b> jāatkārto</div>
      </div>
      <p class="analysis">${fieldTally("author", "Autors")}</p>
      <p class="analysis">${fieldTally("details", "Pārējā informācija")}</p>
      <p class="status" id="clip-status">Vari noklausīties jebkuru gabalu vēlreiz.</p>
      <div class="meter" aria-hidden="true"><span id="clip-bar"></span></div>
      ${groups.map(([key, label]) => outcomeGroup(key, label)).join("")}
      ${historyBlock()}
      <div class="actions" style="margin-top:18px">
        <button class="primary" type="button" data-action="again">Sākt no jauna</button>
        <button class="ghost" type="button" data-action="settings">Mainīt iestatījumus</button>
      </div>
    </section>
  `;
}

function outcomeGroup(key, label) {
  const items = state.queue.filter((item) => pieceOutcome(item) === key);
  if (!items.length) return "";
  return `
    <h3 class="group-title">${label}</h3>
    <div class="review">
      ${items.map((item) => reviewItem(item)).join("")}
    </div>
  `;
}

function fieldTally(field, label) {
  const counts = { self: 0, help: 0, miss: 0 };
  for (const item of state.queue) counts[fieldOutcome(item, field)] += 1;
  return `${label} — ${counts.self} pats, ${counts.help} ar variantiem, ${counts.miss} jāatkārto.`;
}

function fieldOutcome(item, field) {
  if (item[`${field}Fixed`] || (item[`${field}Ok`] && item[`${field}Options`])) return "help";
  if (item[`${field}Ok`]) return "self";
  return "miss";
}

function pieceOutcome(item) {
  const author = fieldOutcome(item, "author");
  const details = fieldOutcome(item, "details");
  if (author === "miss" || details === "miss") return "weak";
  if (author === "help" || details === "help") return "help";
  return "self";
}

function outcomeNote(item) {
  const author = fieldOutcome(item, "author");
  const details = fieldOutcome(item, "details");
  if (author === details && author === "self") return "";
  const phrase = (value) => (value === "self" ? "zināja pats" : value === "help" ? "ar variantiem" : "jāatkārto");
  return `Autors — ${phrase(author)}. Pārējā informācija — ${phrase(details)}.`;
}

function reviewItem(item) {
  const outcome = pieceOutcome(item);
  const kind = outcome === "self" ? "good" : outcome === "help" ? "part" : "bad";
  const label = outcome === "self" ? "Pats" : outcome === "help" ? "Ar variantiem" : "Jāatkārto";
  const note = outcomeNote(item);
  return `
    <article class="item">
      <header>
        <h3>${item.piece.n}. ${esc(item.piece.author)}</h3>
        <span class="mark ${kind}">${label}</span>
      </header>
      <p>${esc(answerText(item.piece))}</p>
      ${note ? `<p class="quiet">${esc(note)}</p>` : ""}
      <button class="tiny" type="button" data-action="play-piece" data-n="${item.piece.n}">Klausīties</button>
    </article>
  `;
}

function rememberRound() {
  if (state.historyLogged || !state.queue.length) return;
  const history = loadHistory();
  for (const item of state.queue) {
    const slot = historySlot(history, item.piece.n);
    slot.tries += 1;
    slot[pieceOutcome(item)] += 1;
    history[item.piece.n] = slot;
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  state.historyLogged = true;
  saveSession();
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    if (!saved || typeof saved !== "object") return {};
    return saved;
  } catch {
    return {};
  }
}

function historySlot(history, n) {
  const raw = history[n] || {};
  return {
    tries: Number(raw.tries) || 0,
    self: Number(raw.self) || 0,
    help: Number(raw.help) || 0,
    weak: Number(raw.weak) || 0,
  };
}

function historyBlock() {
  const rows = pieces.map((piece) => ({ piece, ...historySlot(loadHistory(), piece.n) })).filter((row) => row.tries >= 2);
  const trouble = (row) => row.weak + row.help;
  const repeat = rows
    .filter((row) => trouble(row) > row.self)
    .sort((a, b) => trouble(b) - trouble(a) || b.weak - a.weak || a.piece.n - b.piece.n)
    .slice(0, 6);
  const strong = rows
    .filter((row) => row.self > trouble(row))
    .sort((a, b) => b.self - a.self || a.piece.n - b.piece.n)
    .slice(0, 6);
  const even = rows
    .filter((row) => row.self > 0 && row.self === trouble(row))
    .sort((a, b) => b.tries - a.tries || a.piece.n - b.piece.n)
    .slice(0, 6);
  if (!repeat.length && !strong.length && !even.length) return "";
  return `
    <h3 class="group-title">No visām reizēm</h3>
    ${repeat.length ? `<p class="analysis">Biežāk jāatkārto</p><div class="review">${repeat.map(historyRow).join("")}</div>` : ""}
    ${strong.length ? `<p class="analysis">Sanāk labi arī citās reizēs</p><div class="review">${strong.map(historyRow).join("")}</div>` : ""}
    ${even.length ? `<p class="analysis">Tikpat bieži pats un ar palīdzību</p><div class="review">${even.map(historyRow).join("")}</div>` : ""}
  `;
}

function historyRow(row) {
  const trouble = row.weak + row.help;
  const line = row.self === row.tries
    ? `${row.self} no ${row.tries} reizēm pats`
    : trouble === row.tries
      ? `${trouble} no ${row.tries} reizēm vajag palīdzību vai atkārtojumu`
      : `${row.self} no ${row.tries} reizēm pats, ${trouble} ar palīdzību vai jāatkārto`;
  return `
    <article class="item">
      <header>
        <h3>${row.piece.n}. ${esc(row.piece.author)}</h3>
      </header>
      <p class="quiet">${line}</p>
    </article>
  `;
}

function verdictLine(ok, text) {
  const mark = ok ? "✓" : "✕";
  return `<p class="verdict ${ok ? "ok" : "no"}"><span class="tick" aria-hidden="true">${mark}</span><span>${text}</span></p>`;
}

function resultBlock(item) {
  const both = item.authorOk && item.detailsOk;
  const none = !item.authorOk && !item.detailsOk;
  const word = (ok) => (ok ? "pareizi" : "nepareizi");
  const lines = both
    ? verdictLine(true, "Pareizi")
    : none
      ? verdictLine(false, "Nepareizi")
      : verdictLine(item.authorOk, `Autors — ${word(item.authorOk)}`) + verdictLine(item.detailsOk, `Pārējā informācija — ${word(item.detailsOk)}`);
  const key = `
    <div class="answer-key">
      <p class="key-kicker">Pareizā atbilde</p>
      <p class="key-author">${esc(item.piece.author)}</p>
      <p class="key-details">${esc(answerText(item.piece))}</p>
    </div>`;
  return `<div class="result ${markKind(item)}">${lines}</div>${key}`;
}

function markKind(item) {
  if (item.authorOk && item.detailsOk) return "good";
  if (item.authorOk || item.detailsOk) return "part";
  return "bad";
}

function planText(settings) {
  const count = settings.to - settings.from + 1;
  if (!Number.isInteger(settings.from) || !Number.isInteger(settings.to) || settings.from < 1 || settings.to > 50 || settings.from > settings.to) {
    return "Numuriem jābūt no 1 līdz 50, un pirmais nedrīkst būt lielāks par otro.";
  }
  if (settings.mode === "test") {
    const n = Math.min(TEST_SIZE, count);
    if (n < TEST_SIZE) return `Izvēlēti tikai ${count}, tāpēc testā būs ${n === 1 ? "šis 1 gabals" : `visi ${n}`}, jauktā secībā.`;
    return `Testā būs ${n} nejauši gabali no ${settings.from}–${settings.to}.`;
  }
  if (count === 1) return `Būs 1 gabals: numurs ${settings.from}.`;
  return `Būs visi ${count} gabali no ${settings.from}–${settings.to}, katrs vienu reizi, jauktā secībā.`;
}

function onInput(event) {
  const draft = event.target.dataset.draft;
  if (draft) {
    state.editor[draft] = event.target.value;
    return;
  }
  const field = event.target.dataset.field;
  if (field === "assemble-author" || field === "assemble-part" || field === "assemble-work") {
    const card = currentAssemble();
    const key = field.slice("assemble-".length);
    if (!card || card[`${key}Status`] !== "open") return;
    card[`${key}Input`] = event.target.value;
    saveAssembleSession(false);
    return;
  }
  if (field === "assemble-from" || field === "assemble-to") {
    state.assemble[field === "assemble-from" ? "from" : "to"] = Number(event.target.value);
    saveAssembleSettings();
    const plan = document.querySelector("#assemble-plan");
    if (plan) {
      plan.textContent = assemblePlan(state.assemble);
      plan.classList.remove("warn");
    }
    return;
  }
  if (field === "author" || field === "details") {
    const item = current();
    if (!item || item.answered) return;
    item[field === "author" ? "authorInput" : "detailsInput"] = event.target.value;
    saveSession();
    return;
  }
  if (field === "from" || field === "to") {
    state.settings[field] = Number(event.target.value);
    saveSettings();
    const plan = document.querySelector("#plan-text");
    if (plan) plan.textContent = planText(state.settings);
  }
}

function onChange(event) {
  if (event.target.name === "assemble-direction") {
    state.assemble.direction = event.target.value === "part" ? "part" : "work";
    saveAssembleSettings();
    render();
    return;
  }
  if (event.target.name === "assemble-listen") {
    state.assemble.listen = event.target.value === "yes";
    saveAssembleSettings();
    const plan = document.querySelector("#assemble-plan");
    if (plan) plan.textContent = assemblePlan(state.assemble);
    return;
  }
  if (event.target.name === "hints") {
    state.settings.hints = event.target.checked;
    saveSettings();
    return;
  }
  if (event.target.name === "mode" || event.target.name === "feedback") {
    state.settings[event.target.name] = event.target.value;
    saveSettings();
    const plan = document.querySelector("#plan-text");
    if (plan) {
      plan.textContent = planText(state.settings);
      plan.classList.remove("warn");
    }
    return;
  }
  if (event.target.name?.startsWith("pick-")) {
    const n = Number(event.target.dataset.n);
    writeEntry(n, chooseClip(entryFor(n), event.target.value));
    render();
  }
}

function onSubmit(event) {
  event.preventDefault();
  if (event.target.id === "settings-form") {
    begin(false);
    return;
  }
  if (event.target.id === "assemble-form") {
    const settings = readAssembleForm();
    if (settings) startAssemble(settings);
    return;
  }
  if (event.target.id === "assemble-card-form") {
    const focused = document.activeElement?.dataset?.field;
    if (focused === "assemble-author") checkAssemble("author");
    else if (focused === "assemble-part") checkAssemble("part");
    else if (focused === "assemble-work") checkAssemble("work");
    return;
  }
  if (event.target.id === "answer-form") submitCurrent(false);
}

function onClick(event) {
  if (event.target.classList?.contains("sheet")) {
    closePiece();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "preset") {
    state.settings.from = 1;
    state.settings.to = Number(button.dataset.to);
    saveSettings();
    render();
  } else if (action === "assemble-preset") {
    state.assemble.from = 1;
    state.assemble.to = Number(button.dataset.to);
    saveAssembleSettings();
    render();
  } else if (action === "resume") {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (saved?.screen) state.screen = saved.screen;
    state.restored = false;
    render();
  } else if (action === "settings") {
    if (state.screen === "question" && !confirm("Pārtraukt šo reizi un mainīt iestatījumus?")) return;
    leaveQuiz();
  } else if (action === "goto-learn") {
    if (state.screen === "learn") return;
    if (state.screen === "question" && !confirm("Pārtraukt šo reizi un iet mācīties?")) return;
    if (state.screen === "assemble-card" && !confirm("Aiziet mācīties? Šo reizi varēs turpināt.")) return;
    if (state.screen === "question" || state.screen === "summary") {
      state.queue = [];
      state.restored = false;
      saveSession();
    }
    if (state.screen === "assemble-card") saveAssembleSession(true);
    stopPlayback();
    state.openN = null;
    state.screen = "learn";
    render();
  } else if (action === "goto-quiz") {
    if (state.screen === "settings" || state.screen === "question") return;
    if (state.screen === "assemble-card" && !confirm("Aiziet uz pārbaudi? Šo reizi varēs turpināt.")) return;
    if (state.screen === "assemble-card") saveAssembleSession(true);
    if (state.screen === "summary") {
      leaveQuiz();
      return;
    }
    stopPlayback();
    state.openN = null;
    state.screen = "settings";
    render();
  } else if (action === "goto-assemble") {
    if (state.screen === "assemble" || state.screen === "assemble-card") return;
    if (state.screen === "question" && !confirm("Pārtraukt šo reizi un iet savienot?")) return;
    if (state.screen === "question" || state.screen === "summary") {
      state.queue = [];
      state.restored = false;
      saveSession();
    }
    stopPlayback();
    state.openN = null;
    state.screen = "assemble";
    render();
  } else if (action === "again") {
    begin(true);
  } else if (action === "toggle-play") {
    togglePlay();
  } else if (action === "skip") {
    submitCurrent(true);
  } else if (action === "quiz-show") {
    showQuizOptions(button.dataset.field);
  } else if (action === "quiz-option") {
    pickQuizOption(button.dataset.field, Number(button.dataset.index));
  } else if (action === "next") {
    goNext();
  } else if (action === "play-piece") {
    const piece = pieces.find((entry) => entry.n === Number(button.dataset.n));
    const item = state.queue.find((entry) => entry.piece.n === piece.n);
    playItem(item);
  } else if (action === "learn-play") {
    const piece = pieces.find((entry) => entry.n === Number(button.dataset.n));
    toggleLearn(piece);
  } else if (action === "seek") {
    const piece = pieces.find((entry) => entry.n === Number(button.dataset.n));
    seekBy(piece, Number(button.dataset.by));
  } else if (action === "open-editor") {
    const piece = pieces.find((entry) => entry.n === Number(button.dataset.n));
    const bounds = clipBounds(piece);
    state.editor = { n: piece.n, name: "", from: secText(bounds.start), to: secText(bounds.end), error: "" };
    render();
    document.querySelector("[data-draft='name']")?.focus();
  } else if (action === "close-editor") {
    state.editor = { n: null, name: "", from: "", to: "", error: "" };
    render();
  } else if (action === "save-clip") {
    saveCustom(Number(button.dataset.n));
  } else if (action === "delete-clip") {
    const n = Number(button.dataset.n);
    writeEntry(n, removeClip(entryFor(n), button.dataset.id));
    render();
  } else if (action === "open-piece") {
    state.openN = Number(button.dataset.n);
    render();
    document.querySelector(".sheet-card")?.focus();
  } else if (action === "close-piece") {
    closePiece();
  } else if (action === "learn-step") {
    stepPiece(Number(button.dataset.by));
  } else if (action === "assemble-resume") {
    resumeAssemble();
  } else if (action === "assemble-setup") {
    if (state.screen === "assemble-card" && !confirm("Mainīt izvēli? Šo reizi varēs turpināt, kamēr nesāksi jaunu.")) return;
    if (state.screen === "assemble-card") saveAssembleSession(true);
    stopPlayback();
    state.screen = "assemble";
    render();
  } else if (action === "assemble-again") {
    startAssemble(state.assemble);
  } else if (action === "assemble-check") {
    checkAssemble(button.dataset.field);
  } else if (action === "assemble-show") {
    showAssembleOptions(button.dataset.field);
  } else if (action === "assemble-option") {
    pickAssembleOption(button.dataset.field, Number(button.dataset.index));
  } else if (action === "assemble-step") {
    stepAssemble(Number(button.dataset.by));
  } else if (action === "assemble-play") {
    toggleAssemblePlay(Number(button.dataset.n));
  } else if (action === "assemble-pick") {
    pickAssembleClip(Number(button.dataset.n));
  }
}

function closePiece() {
  stopPlayback();
  state.openN = null;
  state.editor = { n: null, name: "", from: "", to: "", error: "" };
  render();
}

function stepPiece(by) {
  const nextN = state.openN + by;
  if (nextN < 1 || nextN > pieces.length) return;
  const keepPlaying = playerState.playing && playerState.clip?.learn && playerState.clip.n === state.openN;
  const next = pieces.find((piece) => piece.n === nextN);
  state.editor = { n: null, name: "", from: "", to: "", error: "" };
  state.openN = nextN;
  if (keepPlaying && next) {
    playerState.playing = false;
    playerState.skipUntil = performance.now() + 1500;
    render();
    playLearn(next, null);
  } else {
    stopPlayback();
    render();
  }
  document.querySelector(".sheet-card")?.focus();
}

function advanceLearn() {
  const clip = playerState.clip;
  if (!clip?.learn || !playerState.playing) return;
  const next = clip.n < pieces.length ? pieces.find((piece) => piece.n === clip.n + 1) : null;
  playerState.playing = false;
  playerState.skipUntil = performance.now() + 1500;
  if (!next) {
    try {
      playerState.player?.pauseVideo();
    } catch {
      /* the player may already have stopped */
    }
    setLearnUi(clip.n, clip.duration, "Pēdējais gabals beidzās.");
    return;
  }
  state.openN = next.n;
  state.editor = { n: null, name: "", from: "", to: "", error: "" };
  render();
  playLearn(next, null);
  document.querySelector(".sheet-card")?.focus();
}

function leaveQuiz() {
  stopPlayback();
  state.screen = "settings";
  state.queue = [];
  state.restored = false;
  saveSession();
  render();
}

function saveCustom(n) {
  const piece = pieces.find((entry) => entry.n === n);
  const name = state.editor.name.trim();
  const from = parseSeconds(state.editor.from);
  const to = parseSeconds(state.editor.to);
  if (!name) {
    state.editor.error = "Iedod šai daļai nosaukumu.";
    render();
    return;
  }
  const error = rangeError(from, to, piece.duration);
  if (error) {
    state.editor.error = error;
    render();
    return;
  }
  const clip = { id: Math.random().toString(36).slice(2, 10), name, from, to };
  writeEntry(n, addClip(entryFor(n), clip));
  state.editor = { n: null, name: "", from: "", to: "", error: "" };
  render();
}

function begin(keepSettings) {
  const settings = keepSettings ? state.settings : readSettingsFromForm();
  if (!settings) return;
  state.settings = settings;
  saveSettings();
  const pool = pieces.filter((piece) => piece.n >= settings.from && piece.n <= settings.to);
  const shuffled = shuffle(pool);
  const size = settings.mode === "test" ? Math.min(TEST_SIZE, shuffled.length) : shuffled.length;
  state.queue = shuffled.slice(0, size).map((piece) => ({
    piece,
    ...selectedBounds(piece),
    authorInput: "",
    detailsInput: "",
    answered: false,
    authorOk: false,
    detailsOk: false,
    missing: [],
    swapped: false,
    authorInOtherField: false,
    heard: false,
    attempted: false,
    authorOptions: null,
    detailsOptions: null,
    authorWrong: [],
    detailsWrong: [],
    authorFixed: false,
    detailsFixed: false,
  }));
  state.index = 0;
  state.screen = "question";
  state.historyLogged = false;
  state.restored = false;
  stopPlayback();
  saveSession();
  render();
  document.querySelector("[data-field='author']")?.focus();
}

function readSettingsFromForm() {
  const from = Number(document.querySelector("[name='from']")?.value);
  const to = Number(document.querySelector("[name='to']")?.value);
  const mode = document.querySelector("[name='mode']:checked")?.value || state.settings.mode;
  const feedback = document.querySelector("[name='feedback']:checked")?.value || state.settings.feedback;
  const hints = document.querySelector("[name='hints']")?.checked === true;
  const next = { from, to, mode, feedback, hints };
  if (!validSettings(next)) {
    const plan = document.querySelector("#plan-text");
    if (plan) {
      plan.textContent = "Numuriem jābūt no 1 līdz 50, un pirmais nedrīkst būt lielāks par otro.";
      plan.classList.add("warn");
    }
    return null;
  }
  return next;
}

function submitCurrent(blank) {
  const item = current();
  if (!item || item.answered || item.attempted) return;
  if (blank) {
    item.authorInput = "";
    item.detailsInput = "";
    item.authorFixed = false;
    item.detailsFixed = false;
  } else {
    if (!item.authorFixed) item.authorInput = document.querySelector("[data-field='author']")?.value ?? item.authorInput;
    if (!item.detailsFixed) item.detailsInput = document.querySelector("[data-field='details']")?.value ?? item.detailsInput;
  }
  const result = checkAnswer(item.piece, item.authorInput, item.detailsInput);
  if (item.authorFixed) result.authorOk = true;
  if (item.detailsFixed) result.detailsOk = true;
  Object.assign(item, result, { attempted: true });
  const open = state.settings.feedback === "now" && (!item.authorOk || !item.detailsOk);
  item.answered = !open;
  if (open) {
    if (!item.authorOk) ensureQuizOptions(item, "author");
    if (!item.detailsOk) ensureQuizOptions(item, "details");
  }
  if (state.settings.feedback === "end") goNext();
  else {
    saveSession();
    render();
  }
}

function showQuizOptions(field) {
  const item = current();
  if (!item || item.answered || item.attempted || !state.settings.hints) return;
  if (field !== "author" && field !== "details") return;
  ensureQuizOptions(item, field);
  saveSession();
  render();
}

function ensureQuizOptions(item, field) {
  if (item[`${field}Options`]) return;
  const session = layers.filter((layer) => layer.n >= state.settings.from && layer.n <= state.settings.to);
  const layer = layers.find((entry) => entry.n === item.piece.n);
  const correct = field === "author" ? item.piece.author : prettyDetails(item.piece);
  const texts = field === "author" ? choiceTexts(layer, "author", session) : detailChoiceTexts(item.piece, session);
  item[`${field}Options`] = texts.map((text) => ({ text, correct: text === correct }));
  item[`${field}Wrong`] = [];
}

function detailChoiceTexts(piece, session) {
  const layer = layers.find((item) => item.n === piece.n);
  const correct = prettyDetails(piece);
  const ranked = [
    session.filter((item) => sameKind(item, layer)),
    layers.filter((item) => sameKind(item, layer)),
    layers.filter((item) => item.n !== piece.n && item.region === layer.region),
  ];
  const seen = new Set([normalize(correct)]);
  const picked = [];
  for (const group of ranked) {
    for (const item of shuffle(group)) {
      const text = prettyDetails(pieces.find((entry) => entry.n === item.n));
      const key = normalize(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      picked.push(text);
      if (picked.length === 4) return shuffle([correct, ...picked]);
    }
  }
  return shuffle([correct, ...picked]);
}

function sameKind(item, layer) {
  return item.n !== layer.n && item.region === layer.region && item.kind === layer.kind;
}

function prettyDetails(piece) {
  return answerText(piece).replace(/\s*\/\s*/g, " / ");
}

function pickQuizOption(field, index) {
  const item = current();
  const option = item?.[`${field}Options`]?.[index];
  if (!item || !option || item.answered || item[`${field}Ok`] || item[`${field}Fixed`]) return;
  if (option.correct) {
    item[`${field}Fixed`] = true;
    item[field === "author" ? "authorInput" : "detailsInput"] = option.text;
    if (!item.attempted && item.authorFixed && item.detailsFixed) {
      submitCurrent(false);
      return;
    }
    if (item.attempted && (item.authorOk || item.authorFixed) && (item.detailsOk || item.detailsFixed)) {
      item.answered = true;
    }
  } else if (!item[`${field}Wrong`].includes(index)) {
    item[`${field}Wrong`].push(index);
  }
  saveSession();
  render();
}

function goNext() {
  stopPlayback();
  if (state.index + 1 >= state.queue.length) {
    state.screen = "summary";
    saveSession();
    render();
    return;
  }
  state.index += 1;
  saveSession();
  render();
  document.querySelector("[data-field='author']")?.focus();
}

function current() {
  return state.queue[state.index];
}

function loadAssemble() {
  try {
    const saved = JSON.parse(localStorage.getItem(ASSEMBLE_KEY) || "null");
    if (saved && validAssemble(saved)) return { ...saved, direction: saved.direction === "part" ? "part" : "work" };
  } catch {
    /* keep the default */
  }
  return { from: 1, to: 20, listen: false, direction: "work" };
}

function validAssemble(value) {
  return (
    Number.isInteger(value.from) &&
    Number.isInteger(value.to) &&
    value.from >= 1 &&
    value.to <= 50 &&
    value.from <= value.to &&
    typeof value.listen === "boolean" &&
    (value.direction === undefined || value.direction === "work" || value.direction === "part")
  );
}

function saveAssembleSettings() {
  localStorage.setItem(ASSEMBLE_KEY, JSON.stringify(state.assemble));
}

function saveAssembleSession(paused) {
  if (!state.assembleQueue.length) {
    sessionStorage.removeItem(ASSEMBLE_SESSION_KEY);
    return;
  }
  sessionStorage.setItem(
    ASSEMBLE_SESSION_KEY,
    JSON.stringify({
      settings: state.assemble,
      index: state.assembleIndex,
      screen: state.screen,
      paused: Boolean(paused),
      queue: state.assembleQueue,
    }),
  );
}

function restoreAssembleSession() {
  if (state.screen === "question" || state.screen === "summary") return;
  try {
    const saved = JSON.parse(sessionStorage.getItem(ASSEMBLE_SESSION_KEY) || "null");
    if (!saved || saved.paused || !Array.isArray(saved.queue) || !saved.queue.length) return;
    if (!validAssemble(saved.settings)) return;
    if (!saved.queue.every((card) => layers.some((item) => item.n === card.n))) return;
    state.assemble = saved.settings;
    state.assembleQueue = saved.queue;
    state.assembleIndex = Math.min(saved.index || 0, saved.queue.length - 1);
    state.screen = "assemble-card";
  } catch {
    sessionStorage.removeItem(ASSEMBLE_SESSION_KEY);
  }
}

function pausedAssemble() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(ASSEMBLE_SESSION_KEY) || "null");
    if (!saved?.queue?.length) return null;
    return saved;
  } catch {
    return null;
  }
}

function assemblePlan(settings) {
  const listen = settings.listen ? " Ar klausīšanos." : " Bez klausīšanās.";
  if (settings.direction === "part") {
    const count = titledLayers().length;
    return `Būs visi ${count} gabali, kuriem daļai ir savs nosaukums. Redzi daļu, raksti lielo darbu un autoru.${listen}`;
  }
  if (!Number.isInteger(settings.from) || !Number.isInteger(settings.to) || settings.from < 1 || settings.to > 50 || settings.from > settings.to) {
    return "Numuriem jābūt no 1 līdz 50, un pirmais nedrīkst būt lielāks par otro.";
  }
  const count = settings.to - settings.from + 1;
  const order = count === 1
    ? `Būs 1 gabals: numurs ${settings.from}.`
    : `Būs visi ${count} gabali no ${settings.from}–${settings.to}, katrs vienu reizi, nejaušā secībā.`;
  return order + listen;
}

function assembleSetup() {
  const { from, to, listen, direction } = state.assemble;
  const fromPart = direction === "part";
  const saved = pausedAssemble();
  const lede = fromPart
    ? "Redzi daļas nosaukumu. Pieraksti lielo darbu pilnā vārdā — kopā ar to, kas tas ir, piemēram, balets vai opera — un autoru. Gabali nāk nejauši, katrs vienu reizi."
    : "Redzi lielo darbu pilnā nosaukumā, kopā ar to, kas tas ir. Pieraksti autoru. Ja darbam ir sava daļa, pieraksti arī to. Gabali nāk nejauši, katrs vienu reizi. Vari izlaist lauku un iet tālāk.";
  const range = fromPart
    ? ""
    : `
      <fieldset>
        <legend>Kurus gabalus savienot?</legend>
        <div class="range-row">
          <label class="field">No
            <input type="number" min="1" max="50" name="from" data-field="assemble-from" value="${from}" inputmode="numeric" />
          </label>
          <label class="field">līdz
            <input type="number" min="1" max="50" name="to" data-field="assemble-to" value="${to}" inputmode="numeric" />
          </label>
        </div>
        <div class="presets" style="margin-top:10px">
          ${[20, 30, 40, 50].map((end) => `<button type="button" class="chip ${to === end && from === 1 ? "is-on" : ""}" data-action="assemble-preset" data-to="${end}">1–${end}</button>`).join("")}
        </div>
      </fieldset>`;
  return `
    <p class="lede">${lede}</p>
    <form class="card" id="assemble-form">
      <fieldset>
        <legend>No kā sākt?</legend>
        <label class="radio"><input type="radio" name="assemble-direction" value="work" ${fromPart ? "" : "checked"} /> No lielā darba — raksti autoru un daļu</label>
        <label class="radio"><input type="radio" name="assemble-direction" value="part" ${fromPart ? "checked" : ""} /> No daļas nosaukuma — raksti lielo darbu un autoru</label>
      </fieldset>
      ${range}
      <fieldset style="margin-top:18px">
        <legend>Klausīšanās</legend>
        <label class="radio"><input type="radio" name="assemble-listen" value="no" ${listen ? "" : "checked"} /> Bez klausīšanās</label>
        <label class="radio"><input type="radio" name="assemble-listen" value="yes" ${listen ? "checked" : ""} /> Ar klausīšanos — jāatrod īstais ieraksts</label>
      </fieldset>
      <p class="plan" id="assemble-plan">${assemblePlan(state.assemble)}</p>
      <div class="actions" style="margin-top:16px">
        <button class="primary" type="submit">Sākt</button>
      </div>
    </form>
    ${saved ? `<div class="card"><p>Iepriekšējā savienošana vēl ir atvērta.</p><button class="ghost" type="button" data-action="assemble-resume">Turpināt</button></div>` : ""}
  `;
}

function assembleCard() {
  const card = currentAssemble();
  const layer = layerBy(card?.n);
  if (!card || !layer) return "";
  const total = state.assembleQueue.length;
  const atStart = state.assembleIndex === 0;
  const last = state.assembleIndex + 1 === total;
  const fromPart = state.assemble.direction === "part";
  const shown = fromPart ? layer.part : layer.prompt;
  const fields = fromPart
    ? `${assembleField(card, "work", "Lielais darbs")}${assembleField(card, "author", "Autors")}`
    : `${assembleField(card, "author", "Autors")}${layer.part ? assembleField(card, "part", "Daļa vai dziesma") : ""}`;
  return `
    <section class="card">
      <div class="progress">
        <strong>${state.assembleIndex + 1}. no ${total}</strong>
        <button class="tiny" type="button" data-action="assemble-setup">Mainīt izvēli</button>
      </div>
      <form id="assemble-card-form">
        <div class="piece-top">
          <span class="num">${String(layer.n).padStart(2, "0")}</span>
          <div>
            <p class="key-kicker">${fromPart ? "Daļa vai dziesma" : "Lielais darbs"}</p>
            <h2>${esc(shown)}</h2>
          </div>
        </div>
        <div class="stack">
          ${fields}
        </div>
        ${card.note ? `<p class="status">${esc(card.note)}</p>` : ""}
        ${assembleHearing(card)}
        <div class="actions" style="margin-top:16px">
          <button class="ghost" type="button" data-action="assemble-step" data-by="-1" ${atStart ? "disabled" : ""}>Iepriekšējais</button>
          <button class="ghost" type="button" data-action="assemble-step" data-by="1">${last ? "Pabeigt" : "Tālāk"}</button>
        </div>
      </form>
    </section>
  `;
}

function assembleDone() {
  const total = state.assembleQueue.length;
  const fromPart = state.assemble.direction === "part";
  const full = state.assembleQueue.filter((card) => {
    const layer = layerBy(card.n);
    if (!layer || card.authorStatus !== "done") return false;
    if (fromPart && card.workStatus !== "done") return false;
    if (!fromPart && layer.part && card.partStatus !== "done") return false;
    if (card.clips?.length > 1 && !card.clipDone) return false;
    return true;
  }).length;
  const line = total === 1 ? "Vienīgais gabals ir bijis." : `Visi ${total} gabali ir bijuši, katrs vienu reizi.`;
  return `
    <section class="card">
      <h2>Gatavs</h2>
      <p class="lede">${line} Līdz galam savienoti ${full}.</p>
      <div class="actions" style="margin-top:16px">
        <button class="primary" type="button" data-action="assemble-again">Sākt no jauna</button>
        <button class="ghost" type="button" data-action="assemble-setup">Mainīt izvēli</button>
      </div>
    </section>
  `;
}

function assembleField(card, field, label) {
  const status = card[`${field}Status`];
  const cls = status === "done" ? "is-good" : card[`${field}Miss`] ? "is-bad" : "";
  const buttons = status === "open"
    ? `<div class="actions">
        <button class="primary" type="button" data-action="assemble-check" data-field="${field}">Pārbaudīt</button>
        <button class="ghost" type="button" data-action="assemble-show" data-field="${field}">Parādīt variantus</button>
      </div>`
    : "";
  return `
    <div>
      <label class="field">${label}
        <input class="${cls}" type="text" data-field="assemble-${field}" value="${esc(card[`${field}Input`])}" autocomplete="off" autocapitalize="off" lang="lv" ${status === "open" ? "" : "readonly"} />
      </label>
      ${buttons}
      ${assembleOptionList(card, field)}
    </div>
  `;
}

function assembleOptionList(card, field) {
  const options = card[`${field}Options`];
  if (!options || card[`${field}Status`] === "done") return "";
  return `<div class="options">${options.map((option, index) => {
    const wrong = card[`${field}Wrong`].includes(index);
    const mark = wrong ? "✕ " : "";
    return `<button class="option ${wrong ? "is-bad" : ""}" type="button" data-action="assemble-option" data-field="${field}" data-index="${index}" ${wrong ? "disabled" : ""}>${mark}${esc(option.text)}</button>`;
  }).join("")}</div>`;
}

function assembleHearing(card) {
  if (!card.clips || card.clips.length < 2) return "";
  return `
    <section class="clips">
      <h3>Klausies un atzīmē īsto</h3>
      ${card.clips.map((n) => hearRow(card, n)).join("")}
      <p class="status" id="assemble-status"></p>
    </section>
  `;
}

function hearRow(card, n) {
  const wrong = card.clipWrong.includes(n);
  const good = card.clipDone && n === card.n;
  const cls = good ? "is-good" : wrong ? "is-bad" : "";
  const layer = layerBy(n);
  const name = layer ? layer.part || layer.prompt : "";
  const pick = good
    ? `<span class="hear-name">${esc(name)}</span>`
    : `<button class="ghost" type="button" data-action="assemble-pick" data-n="${n}" ${wrong || card.clipDone ? "disabled" : ""}>${wrong ? "Nav šis" : "Šis ir īstais"}</button>`;
  return `
    <div class="hear-row ${cls}">
      <button class="play compact" type="button" data-action="assemble-play" data-n="${n}">Klausīties</button>
      ${pick}
    </div>
  `;
}

function readAssembleForm() {
  const form = document.querySelector("#assemble-form");
  const direction = document.querySelector("[name='assemble-direction']:checked")?.value === "part" ? "part" : "work";
  const from = direction === "part" ? state.assemble.from : Number(form?.querySelector("[name='from']")?.value);
  const to = direction === "part" ? state.assemble.to : Number(form?.querySelector("[name='to']")?.value);
  const listen = document.querySelector("[name='assemble-listen']:checked")?.value === "yes";
  const next = { from, to, listen, direction };
  if (!validAssemble(next)) {
    const plan = document.querySelector("#assemble-plan");
    if (plan) {
      plan.textContent = "Numuriem jābūt no 1 līdz 50, un pirmais nedrīkst būt lielāks par otro.";
      plan.classList.add("warn");
    }
    return null;
  }
  return next;
}

function startAssemble(settings) {
  state.assemble = settings;
  saveAssembleSettings();
  const pool = settings.direction === "part"
    ? titledLayers()
    : layers.filter((item) => item.n >= settings.from && item.n <= settings.to);
  const order = shuffle(pool);
  state.assembleQueue = order.map((item) => makeAssembleCard(item, order, settings.listen));
  state.assembleIndex = 0;
  state.screen = "assemble-card";
  stopPlayback();
  saveAssembleSession(false);
  render();
  focusAssemble();
}

function titledLayers() {
  return layers.filter((item) => item.part && item.partShape === "title");
}

function focusAssemble() {
  const field = state.assemble.direction === "part" ? "assemble-work" : "assemble-author";
  document.querySelector(`[data-field='${field}']`)?.focus();
}

function makeAssembleCard(item, pool, listen) {
  const clips = listen ? clipNumbers(item, pool) : [];
  return {
    n: item.n,
    authorInput: "",
    partInput: "",
    workInput: "",
    authorStatus: "open",
    partStatus: "open",
    workStatus: "open",
    authorMiss: false,
    partMiss: false,
    workMiss: false,
    authorOptions: null,
    partOptions: null,
    workOptions: null,
    authorWrong: [],
    partWrong: [],
    workWrong: [],
    clips: clips.length > 1 ? clips : [],
    clipWrong: [],
    clipDone: false,
    note: "",
  };
}

function resumeAssemble() {
  const saved = pausedAssemble();
  if (!saved || !validAssemble(saved.settings)) return;
  state.assemble = saved.settings;
  state.assembleQueue = saved.queue;
  state.assembleIndex = Math.min(saved.index || 0, saved.queue.length - 1);
  state.screen = "assemble-card";
  saveAssembleSession(false);
  render();
  focusAssemble();
}

function currentAssemble() {
  return state.assembleQueue[state.assembleIndex];
}

function layerBy(n) {
  return layers.find((item) => item.n === n) || null;
}

function sessionLayers() {
  return state.assembleQueue.map((card) => layerBy(card.n)).filter(Boolean);
}

function readAssembleInputs() {
  const card = currentAssemble();
  if (!card) return;
  const author = document.querySelector("[data-field='assemble-author']");
  const part = document.querySelector("[data-field='assemble-part']");
  const work = document.querySelector("[data-field='assemble-work']");
  if (author && card.authorStatus === "open") card.authorInput = author.value;
  if (part && card.partStatus === "open") card.partInput = part.value;
  if (work && card.workStatus === "open") card.workInput = work.value;
}

function checkAssemble(field) {
  readAssembleInputs();
  const card = currentAssemble();
  const layer = layerBy(card?.n);
  if (!card || !layer || card[`${field}Status`] !== "open") return;
  if (field === "part" && !layer.part) return;
  if (field === "work" && state.assemble.direction !== "part") return;
  const value = card[`${field}Input`].trim();
  if (!value) {
    card[`${field}Miss`] = false;
    revealAssemble(card, layer, field);
  } else if (fieldOk(layer, field, value)) {
    card[`${field}Status`] = "done";
    card[`${field}Miss`] = false;
    card.note = "";
  } else {
    card[`${field}Miss`] = true;
    revealAssemble(card, layer, field);
    card.note = "";
  }
  saveAssembleSession(false);
  render();
}

function showAssembleOptions(field) {
  readAssembleInputs();
  const card = currentAssemble();
  const layer = layerBy(card?.n);
  if (!card || !layer || card[`${field}Status`] === "done") return;
  if (field === "part" && !layer.part) return;
  if (field === "work" && state.assemble.direction !== "part") return;
  revealAssemble(card, layer, field);
  saveAssembleSession(false);
  render();
}

function revealAssemble(card, layer, field) {
  if (!card[`${field}Options`]) {
    const correct = field === "author" ? layer.author : field === "work" ? layer.prompt : layer.part;
    card[`${field}Options`] = choiceTexts(layer, field, sessionLayers()).map((text) => ({
      text,
      correct: text === correct,
    }));
    card[`${field}Wrong`] = [];
  }
  card[`${field}Status`] = "variants";
}

function pickAssembleOption(field, index) {
  const card = currentAssemble();
  const option = card?.[`${field}Options`]?.[index];
  if (!card || !option || card[`${field}Status`] === "done") return;
  if (option.correct) {
    card[`${field}Status`] = "done";
    card[`${field}Input`] = option.text;
    card[`${field}Miss`] = false;
  } else if (!card[`${field}Wrong`].includes(index)) {
    card[`${field}Wrong`].push(index);
  }
  saveAssembleSession(false);
  render();
}

function pickAssembleClip(n) {
  const card = currentAssemble();
  if (!card || card.clipDone || card.clipWrong.includes(n)) return;
  if (n === card.n) card.clipDone = true;
  else card.clipWrong.push(n);
  saveAssembleSession(false);
  render();
}

function stepAssemble(by) {
  readAssembleInputs();
  stopPlayback();
  const next = state.assembleIndex + by;
  if (next < 0) return;
  if (next >= state.assembleQueue.length) {
    state.screen = "assemble-done";
    sessionStorage.removeItem(ASSEMBLE_SESSION_KEY);
    render();
    return;
  }
  state.assembleIndex = next;
  saveAssembleSession(false);
  render();
  focusAssemble();
}

function toggleAssemblePlay(n) {
  const piece = pieces.find((item) => item.n === n);
  if (!piece) return;
  const token = `assemble:${n}`;
  if (playerState.playing && playerState.clip?.token === token) {
    playerState.playing = false;
    markAssemblePlaying("Apturēts.");
    try {
      playerState.player?.pauseVideo();
    } catch {
      /* the player may not exist yet */
    }
    return;
  }
  if (playerState.clip?.token === token && playerState.ready) {
    playerState.playing = true;
    markAssemblePlaying("Skan");
    playerState.player.playVideo();
    return;
  }
  const bounds = selectedBounds(piece);
  playerState.clip = {
    id: piece.youtubeId,
    start: bounds.start,
    end: bounds.end,
    token,
    assemble: true,
    n: piece.n,
  };
  playerState.playing = true;
  if (!playerState.ready) {
    markAssemblePlaying("Atskaņotājs vēl gatavojas. Paspied vēlreiz pēc mirkļa.");
    return;
  }
  markAssemblePlaying("Ielādē… ja vispirms ir reklāma, pagaidi.");
  loadClip(playerState.clip);
}

function markAssemblePlaying(message) {
  const playingN = playerState.playing && playerState.clip?.assemble ? playerState.clip.n : null;
  document.querySelectorAll("[data-action='assemble-play']").forEach((button) => {
    const on = Number(button.dataset.n) === playingN;
    button.textContent = on ? "Apturēt" : "Klausīties";
    button.classList.toggle("is-on", on);
  });
  if (message) {
    const status = document.querySelector("#assemble-status");
    if (status) status.textContent = message;
  }
}

function togglePlay() {
  const item = state.screen === "question" ? current() : null;
  if (!item) return;
  if (playerState.playing && playerState.clip?.token === clipToken(item)) {
    playerState.player?.pauseVideo();
    playerState.playing = false;
    setPlayUi(item);
    return;
  }
  playItem(item);
}

function playItem(item) {
  item.heard = true;
  const bounds = selectedBounds(item.piece);
  item.start = bounds.start;
  item.end = bounds.end;
  const clip = {
    id: item.piece.youtubeId,
    start: item.start,
    end: item.end,
    token: clipToken(item),
    label: state.screen === "summary" ? `${item.piece.n}. gabals` : "Fragments",
  };
  playerState.clip = clip;
  playerState.playing = true;
  if (!playerState.ready) {
    setPlayUi(item, "Atskaņotājs vēl gatavojas. Paspied vēlreiz pēc mirkļa.");
    return;
  }
  setPlayUi(item, "Ielādē… ja vispirms ir reklāma, pagaidi.");
  loadClip(clip);
  saveSession();
}

function learnToken(n) {
  return `learn:${n}`;
}

function toggleLearn(piece) {
  const token = learnToken(piece.n);
  if (playerState.playing && playerState.clip?.token === token) {
    playerState.player?.pauseVideo();
    playerState.playing = false;
    setLearnUi(piece.n, null, "Apturēts.");
    return;
  }
  if (playerState.clip?.token === token && playerState.ready) {
    playerState.player.playVideo();
    playerState.playing = true;
    setLearnUi(piece.n, null, "Skan");
    return;
  }
  playLearn(piece, null);
}

function playLearn(piece, at) {
  const end = Math.max(piece.start + 1, piece.duration - 0.25);
  const startAt = at == null ? piece.start : Math.max(0, Math.min(end - 0.3, at));
  const token = learnToken(piece.n);
  clearOtherBars(piece.n);
  if (playerState.clip?.token === token && at != null) {
    playerState.clip.end = end;
    playerState.playing = true;
    setLearnUi(piece.n, startAt, "Skan");
    if (playerState.ready) {
      playerState.player.seekTo(startAt, true);
      playerState.player.playVideo();
    } else {
      playerState.clip.start = startAt;
    }
    return;
  }
  playerState.clip = {
    id: piece.youtubeId,
    start: startAt,
    end,
    token,
    learn: true,
    n: piece.n,
    duration: piece.duration,
  };
  playerState.playing = true;
  if (!playerState.ready) {
    setLearnUi(piece.n, startAt, "Atskaņotājs vēl gatavojas. Paspied vēlreiz pēc mirkļa.");
    return;
  }
  setLearnUi(piece.n, startAt, "Ielādē… ja vispirms ir reklāma, pagaidi.");
  loadClip(playerState.clip);
}

function seekBy(piece, delta) {
  let time = piece.start;
  if (playerState.clip?.token === learnToken(piece.n) && playerState.ready) {
    try {
      time = playerState.player.getCurrentTime();
    } catch {
      time = piece.start;
    }
  }
  playLearn(piece, time + delta);
}

function onPointerDown(event) {
  const scrub = event.target.closest("[data-scrub]");
  if (!scrub) return;
  playerState.scrub = scrub;
  moveScrub(event);
}

function onPointerMove(event) {
  if (!playerState.scrub) return;
  moveScrub(event);
}

function moveScrub(event) {
  const scrub = playerState.scrub;
  if (!scrub) return;
  const piece = pieces.find((entry) => entry.n === Number(scrub.dataset.scrub));
  if (!piece) return;
  const rect = scrub.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const target = ratio * piece.duration;
  playerState.scrubPiece = piece;
  playerState.scrubTo = target;
  setLearnUi(piece.n, target, null);
  const now = performance.now();
  if (now - (playerState.scrubAt || 0) < 140) return;
  playerState.scrubAt = now;
  playLearn(piece, target);
}

function onKeyDown(event) {
  if (state.screen === "learn" && state.openN && event.key === "Escape") {
    closePiece();
    return;
  }
  if (
    state.screen === "learn" &&
    state.openN &&
    (event.key === "ArrowRight" || event.key === "ArrowLeft") &&
    !event.target.closest?.("input, textarea, [data-scrub]")
  ) {
    event.preventDefault();
    stepPiece(event.key === "ArrowRight" ? 1 : -1);
    return;
  }
  const scrub = event.target.closest?.("[data-scrub]");
  if (!scrub) return;
  const piece = pieces.find((entry) => entry.n === Number(scrub.dataset.scrub));
  if (!piece) return;
  if (event.key === "ArrowRight") {
    event.preventDefault();
    seekBy(piece, 5);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    seekBy(piece, -5);
  }
}

function clipToken(item) {
  return `${item.piece.n}:${item.start}:${item.end}`;
}

function loadClip(clip) {
  playerState.player.loadVideoById({
    videoId: clip.id,
    startSeconds: clip.start,
    endSeconds: clip.end,
  });
}

function onPlayerState(event) {
  hidePlayerTitle();
  if (!playerState.clip) return;
  if (playerState.clip.learn) {
    const n = playerState.clip.n;
    if (event.data === YT.PlayerState.PLAYING) {
      playerState.playing = true;
      let time = playerState.clip.start;
      try {
        time = playerState.player.getCurrentTime();
      } catch {
        /* keep the requested time */
      }
      setLearnUi(n, time, "Skan");
    }
    if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.PAUSED) {
      if (performance.now() < playerState.skipUntil) return;
      let time = 0;
      try {
        time = playerState.player.getCurrentTime();
      } catch {
        time = 0;
      }
      if (playerState.playing && time >= playerState.clip.end - 1.5) {
        advanceLearn();
        return;
      }
      if (!playerState.playing) return;
      playerState.playing = false;
      setLearnUi(n, null, null);
    }
    return;
  }
  if (playerState.clip.assemble) {
    if (event.data === YT.PlayerState.PLAYING) {
      playerState.playing = true;
      markAssemblePlaying();
    }
    if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.PAUSED) {
      if (performance.now() < playerState.skipUntil) return;
      if (!playerState.playing && event.data === YT.PlayerState.PAUSED) return;
      playerState.playing = false;
      markAssemblePlaying(event.data === YT.PlayerState.ENDED ? "Fragments beidzās." : null);
    }
    return;
  }
  if (event.data === YT.PlayerState.PLAYING) {
    playerState.playing = true;
    setPlayUi(current() || playerState.clip, "Skan…");
  }
  if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.PAUSED) {
    const ended = event.data === YT.PlayerState.ENDED;
    playerState.playing = false;
    const item = state.queue.find((entry) => clipToken(entry) === playerState.clip?.token);
    setPlayUi(item, ended ? "Fragments beidzās. Vari klausīties vēlreiz." : null);
  }
}

function onPlayerError(event) {
  playerState.playing = false;
  const blocked = event.data === 101 || event.data === 150 || event.data === 153;
  const message = blocked
    ? "Šo ierakstu te nevar atskaņot."
    : "Neizdevās atskaņot. Paspied vēlreiz.";
  if (playerState.clip?.learn) setLearnUi(playerState.clip.n, null, message);
  else if (playerState.clip?.assemble) markAssemblePlaying(message);
  else {
    setPlayUi(
      current(),
      blocked
        ? "Šo ierakstu te nevar atskaņot. Atbildi vari ierakstīt tik un tā vai spiest Nezinu."
        : "Neizdevās atskaņot. Paspied Klausīties vēlreiz.",
    );
  }
  if (blocked) setTimeout(rebuildPlayer, 0);
}

function watchPlayback() {
  if (!playerState.ready || !playerState.clip || !playerState.playing) return;
  let time = 0;
  let code = -1;
  try {
    time = playerState.player.getCurrentTime();
    code = playerState.player.getPlayerState();
  } catch {
    return;
  }
  if (playerState.clip.learn) {
    const { end, n } = playerState.clip;
    if (performance.now() < playerState.skipUntil) return;
    if (code === YT.PlayerState.PLAYING && time >= end - 0.25 && time < end + 4) {
      advanceLearn();
      return;
    }
    if (code === YT.PlayerState.PLAYING) setLearnUi(n, time, `Skan · ${clock(time)}`);
    return;
  }
  if (playerState.clip.assemble) {
    const { start, end } = playerState.clip;
    if (code === YT.PlayerState.PLAYING && time >= end - 0.2 && time < end + 3) {
      playerState.player.pauseVideo();
      playerState.playing = false;
      markAssemblePlaying("Fragments beidzās.");
      return;
    }
    if (code === YT.PlayerState.PLAYING && time + 0.3 >= start) {
      const left = Math.max(0, end - time);
      markAssemblePlaying(`Skan · atlikušas ${Math.ceil(left)} s`);
    }
    return;
  }
  const { start, end } = playerState.clip;
  const item = state.queue.find((entry) => clipToken(entry) === playerState.clip.token);
  if (code === YT.PlayerState.PLAYING && time >= end - 0.2 && time < end + 3) {
    playerState.player.pauseVideo();
    playerState.playing = false;
    setPlayUi(item, "Fragments beidzās. Vari klausīties vēlreiz.");
    setBar(1);
    return;
  }
  if (code === YT.PlayerState.PLAYING && time + 0.3 >= start) {
    const left = Math.max(0, end - time);
    setPlayUi(item, `Skan · atlikušas ${Math.ceil(left)} s`);
    setBar((time - start) / (end - start));
  }
}

function setPlayUi(item, message) {
  const button = document.querySelector("#play-btn");
  if (button) {
    button.textContent = playLabel(item);
    button.classList.toggle("is-on", playerState.playing);
  }
  if (message) {
    const status = document.querySelector("#clip-status");
    if (status) status.textContent = message;
  }
}

function setLearnUi(n, time, message) {
  const piece = pieces.find((entry) => entry.n === n);
  if (!piece) return;
  const button = document.querySelector(`[data-action="learn-play"][data-n="${n}"]`);
  const playing = playerState.playing && playerState.clip?.token === learnToken(n);
  if (button) {
    button.textContent = playing ? "Apturēt" : "Klausīties visu";
    button.classList.toggle("is-on", playing);
  }
  if (time != null) {
    const clockFace = document.querySelector(`[data-time-for="${n}"]`);
    if (clockFace) clockFace.textContent = `${clock(time)} / ${clock(piece.duration)}`;
    const bar = document.querySelector(`[data-bar-for="${n}"]`);
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, time / piece.duration)) * 100}%`;
    const scrub = document.querySelector(`[data-scrub="${n}"]`);
    if (scrub) scrub.setAttribute("aria-valuenow", String(Math.round(time)));
  }
  if (message) {
    let status = document.querySelector(`#piece-${n} .learn-status`);
    if (!status) {
      status = document.createElement("p");
      status.className = "status learn-status";
      document.querySelector(`#piece-${n} .scrub`)?.after(status);
    }
    status.textContent = message;
  }
}

function clearOtherBars(n) {
  document.querySelectorAll("[data-bar-for]").forEach((bar) => {
    if (bar.dataset.barFor !== String(n)) bar.style.width = "0";
  });
  document.querySelectorAll("[data-action='learn-play']").forEach((button) => {
    if (button.dataset.n !== String(n)) {
      button.textContent = "Klausīties visu";
      button.classList.remove("is-on");
    }
  });
}

function playLabel(item) {
  if (playerState.playing && item && playerState.clip?.token === clipToken(item)) return "Apturēt";
  if (item?.heard) return "Klausīties vēlreiz";
  return "Klausīties";
}

function setBar(ratio) {
  const bar = document.querySelector("#clip-bar");
  if (bar) bar.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
}

function stopPlayback() {
  playerState.playing = false;
  playerState.clip = null;
  playerState.scrub = null;
  try {
    playerState.player?.pauseVideo();
  } catch {
    /* the player may not exist yet */
  }
}

function clock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

function secText(value) {
  return String(Math.round(value * 10) / 10).replace(".", ",");
}

function parseSeconds(value) {
  const n = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : NaN;
}

const PAGE_TITLE = "Mūzikas literatūra";

function hidePlayerTitle() {
  const frame = document.querySelector("#yt-host iframe");
  if (frame) {
    if (frame.title !== "Mūzikas fragments") frame.title = "Mūzikas fragments";
    if (frame.tabIndex !== -1) frame.tabIndex = -1;
  }
  if (document.title !== PAGE_TITLE) document.title = PAGE_TITLE;
}

new MutationObserver(hidePlayerTitle).observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["title"],
});

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
