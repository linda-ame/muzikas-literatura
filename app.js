import { pieces, clipBounds } from "./pieces.js";
import { answerText, checkAnswer } from "./check.js";
import { DEFAULT_ID, addClip, blankEntry, chooseClip, rangeError, removeClip, resolveBounds, sanitizeEntry } from "./clips.js";

const TEST_SIZE = 10;
const SETTINGS_KEY = "ml-settings";
const SESSION_KEY = "ml-session";
const CLIPS_KEY = "ml-clips";

const state = {
  screen: "learn",
  settings: loadSettings(),
  queue: [],
  index: 0,
  restored: false,
  openN: null,
  editor: { n: null, name: "", from: "", to: "", error: "" },
};

const playerState = {
  ready: false,
  player: null,
  clip: null,
  playing: false,
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
render();

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (saved && validSettings(saved)) return saved;
  } catch {
    /* keep the default */
  }
  return { from: 1, to: 15, mode: "all", feedback: "now" };
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
      return { piece, ...item };
    });
    state.settings = saved.settings;
    state.queue = queue;
    state.index = Math.min(saved.index, queue.length - 1);
    state.screen = saved.screen === "summary" || saved.screen === "question" ? saved.screen : "settings";
    state.restored = state.screen !== "settings";
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function render() {
  const quiz = state.screen === "settings" || state.screen === "question" || state.screen === "summary";
  app.innerHTML = `
    ${shell(quiz ? "quiz" : "learn")}
    ${state.screen === "learn" ? learnView() : state.screen === "settings" ? settingsView() : state.screen === "summary" ? summaryView() : questionView()}
  `;
  if (state.screen !== "question" && state.screen !== "learn" && state.screen !== "summary") stopPlayback();
  document.body.classList.toggle("sheet-open", state.screen === "learn" && state.openN != null);
  if (state.screen === "learn" && playerState.clip?.learn) {
    setLearnUi(playerState.clip.n, null, playerState.playing ? "Skan" : null);
  }
}

function shell(active) {
  const whites = Array.from({ length: 10 }, (_, i) => `<i class="${i % 7 === 2 || i % 7 === 6 ? "" : "black"}"></i>`).join("");
  return `
    <header class="masthead">
      <div class="brand">
        <svg class="note" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="currentColor" d="M20 6h3.2v22.2a6.2 6.2 0 1 1-3.2-5.4V6zm12.4 5.2H36v16.6a6.2 6.2 0 1 1-3.6-5.6V11.2z"/>
        </svg>
        <h1>Mūzikas literatūra</h1>
      </div>
      <div class="piano" aria-hidden="true">${whites}</div>
    </header>
    <nav class="modes">
      <button type="button" data-action="goto-learn" class="${active === "learn" ? "is-on" : ""}">Mācīties</button>
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
          <button class="ghost" type="button" data-action="learn-step" data-by="-1" ${atStart ? "disabled" : ""}>Iepriekšējais</button>
          <button class="icon" type="button" data-action="close-piece" aria-label="Aizvērt">×</button>
          <button class="ghost" type="button" data-action="learn-step" data-by="1" ${atEnd ? "disabled" : ""}>Nākamais</button>
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
          ${[15, 30, 50].map((end) => `<button type="button" class="chip ${to === end && from === 1 ? "is-on" : ""}" data-action="preset" data-to="${end}">1–${end}</button>`).join("")}
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
        <label class="field">Autors
          <input type="text" name="author" data-field="author" value="${esc(item.authorInput)}" autocomplete="off" autocapitalize="off" lang="lv" ${show ? "readonly" : ""} />
        </label>
        <label class="field">Pārējā informācija
          <textarea name="details" data-field="details" lang="lv" rows="2" ${show ? "readonly" : ""}>${esc(item.detailsInput)}</textarea>
        </label>
        ${show ? resultBlock(item) : `
          <div class="actions">
            <button class="primary" type="submit">Iesniegt atbildi</button>
            <button class="ghost" type="button" data-action="skip">Nezinu</button>
          </div>
        `}
        ${show ? `<div class="actions"><button class="primary" type="button" data-action="next">${state.index + 1 === total ? "Skatīt rezultātu" : "Nākamais gabals"}</button></div>` : ""}
      </form>
    </section>
  `;
}

function summaryView() {
  const total = state.queue.length;
  const authors = state.queue.filter((item) => item.authorOk).length;
  const infos = state.queue.filter((item) => item.detailsOk).length;
  const both = state.queue.filter((item) => item.authorOk && item.detailsOk).length;
  const title = state.settings.mode === "test"
    ? (total === 1 ? "Tests pabeigts. Noklausīts 1 gabals." : `Tests pabeigts. Noklausīti ${total} gabali.`)
    : (total === 1 ? "Vienīgais gabals ir noklausīts." : `Visi ${total} gabali ir noklausīti.`);
  return `
    <section class="card">
      <h2>Rezultāts</h2>
      <p class="lede">${title}</p>
      <div class="scores">
        <div class="score"><b>${both}/${total}</b> abi pareizi</div>
        <div class="score"><b>${authors}/${total}</b> autors</div>
        <div class="score"><b>${infos}/${total}</b> pārējā informācija</div>
      </div>
      <p class="status" id="clip-status">Vari noklausīties jebkuru gabalu vēlreiz.</p>
      <div class="meter" aria-hidden="true"><span id="clip-bar"></span></div>
      <div class="review" style="margin-top:16px">
        ${state.queue.map((item) => reviewItem(item)).join("")}
      </div>
      <div class="actions" style="margin-top:18px">
        <button class="primary" type="button" data-action="again">Sākt no jauna</button>
        <button class="ghost" type="button" data-action="settings">Mainīt iestatījumus</button>
      </div>
    </section>
  `;
}

function reviewItem(item) {
  const kind = markKind(item);
  const label = kind === "good" ? "Pareizi" : kind === "part" ? "Daļēji" : "Nepareizi";
  return `
    <article class="item">
      <header>
        <h3>${item.piece.n}. ${esc(item.piece.author)}</h3>
        <span class="mark ${kind}">${label}</span>
      </header>
      <p>${esc(answerText(item.piece))}</p>
      <button class="tiny" type="button" data-action="play-piece" data-n="${item.piece.n}">Klausīties</button>
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
  const key = both ? "" : `
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
    if (state.screen === "question" || state.screen === "summary") {
      state.queue = [];
      state.restored = false;
      saveSession();
    }
    stopPlayback();
    state.screen = "learn";
    render();
  } else if (action === "goto-quiz") {
    if (state.screen === "learn") {
      stopPlayback();
      state.openN = null;
      state.screen = "settings";
      render();
    } else if (state.screen === "summary") {
      leaveQuiz();
    }
  } else if (action === "again") {
    begin(true);
  } else if (action === "toggle-play") {
    togglePlay();
  } else if (action === "skip") {
    submitCurrent(true);
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
  }
}

function closePiece() {
  stopPlayback();
  state.openN = null;
  state.editor = { n: null, name: "", from: "", to: "", error: "" };
  render();
}

function stepPiece(by) {
  const next = state.openN + by;
  if (next < 1 || next > pieces.length) return;
  stopPlayback();
  state.editor = { n: null, name: "", from: "", to: "", error: "" };
  state.openN = next;
  render();
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
  }));
  state.index = 0;
  state.screen = "question";
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
  const next = { from, to, mode, feedback };
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
  if (!item || item.answered) return;
  if (blank) {
    item.authorInput = "";
    item.detailsInput = "";
  } else {
    item.authorInput = document.querySelector("[data-field='author']")?.value ?? item.authorInput;
    item.detailsInput = document.querySelector("[data-field='details']")?.value ?? item.detailsInput;
  }
  const result = checkAnswer(item.piece, item.authorInput, item.detailsInput);
  Object.assign(item, result, { answered: true });
  if (state.settings.feedback === "end") goNext();
  else {
    saveSession();
    render();
  }
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
      playerState.playing = false;
      setLearnUi(n, null, event.data === YT.PlayerState.ENDED ? "Gabals beidzās." : null);
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
    const { end, n, duration } = playerState.clip;
    if (code === YT.PlayerState.PLAYING && time >= end - 0.25 && time < end + 4) {
      playerState.player.pauseVideo();
      playerState.playing = false;
      setLearnUi(n, duration, "Gabals beidzās.");
      return;
    }
    if (code === YT.PlayerState.PLAYING) setLearnUi(n, time, `Skan · ${clock(time)}`);
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
