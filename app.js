import { pieces, clipBounds } from "./pieces.js";
import { answerText, checkAnswer } from "./check.js";

const TEST_SIZE = 10;
const SETTINGS_KEY = "ml-settings";
const SESSION_KEY = "ml-session";

const state = {
  screen: "settings",
  settings: loadSettings(),
  queue: [],
  index: 0,
  restored: false,
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
    if (state.screen === "question" && state.queue[state.index]?.answered && state.settings.feedback === "now") {
      state.screen = "question";
    }
    state.restored = state.screen !== "settings";
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function render() {
  app.innerHTML =
    state.screen === "settings" ? settingsView() : state.screen === "summary" ? summaryView() : questionView();
  if (state.screen !== "question") stopPlayback();
}

function settingsView() {
  const { from, to, mode, feedback } = state.settings;
  return `
    <header class="masthead">
      <div>
        <p class="eyebrow">Pēc dzirdes</p>
        <h1>Mūzikas literatūra</h1>
        <p class="lede">Noklausies fragmentu un ieraksti autoru tā, kā sarakstā, bet otrajā laukā visu pārējo par šo gabalu.</p>
      </div>
    </header>
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
  return `
    <header class="masthead">
      <div>
        <p class="eyebrow">Saraksts ${state.settings.from}–${state.settings.to}</p>
        <h1>${state.settings.mode === "test" ? "Tests" : "Treniņš"}</h1>
      </div>
      <button class="ghost" type="button" data-action="settings">Mainīt iestatījumus</button>
    </header>
    <section class="card">
      <div class="progress">
        <strong>Gabals ${state.index + 1} no ${total}</strong>
        <span class="quiet">${state.settings.feedback === "now" ? "Atbilde redzama uzreiz" : "Atbildes būs beigās"}</span>
      </div>
      <div class="listen-row">
        <button class="listen ${playerState.playing ? "is-on" : ""}" id="play-btn" type="button" data-action="toggle-play">${playLabel(item)}</button>
      </div>
      <p class="status" id="clip-status">${item.heard ? "Vari klausīties vēlreiz vai rakstīt atbildi." : "Fragments ilgst apmēram pusminūti. Ja vispirms ir reklāma, pagaidi."}</p>
      <div class="meter" aria-hidden="true"><span id="clip-bar"></span></div>
      <form id="answer-form" class="stack">
        <label class="field">Autors
          <input type="text" name="author" data-field="author" value="${esc(item.authorInput)}" autocomplete="off" autocapitalize="off" lang="lv" ${show ? "readonly" : ""} />
        </label>
        <label class="field">Pārējā informācija
          <textarea name="details" data-field="details" lang="lv" placeholder="žanrs, nosaukums, daļa — viss, kas sarakstā ir aiz autora" ${show ? "readonly" : ""}>${esc(item.detailsInput)}</textarea>
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
    <header class="masthead">
      <div>
        <p class="eyebrow">Saraksts ${state.settings.from}–${state.settings.to}</p>
        <h1>Rezultāts</h1>
        <p class="lede">${title}</p>
      </div>
    </header>
    <section class="card">
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
      <p class="quiet">Tava atbilde: ${esc(item.authorInput || "—")} / ${esc(item.detailsInput || "—")}</p>
      ${item.missing?.length && !item.detailsOk ? `<p class="quiet">Pietrūkst: ${esc(item.missing.join(", "))}</p>` : ""}
      <button class="tiny" type="button" data-action="play-piece" data-n="${item.piece.n}">Klausīties</button>
    </article>
  `;
}

function resultBlock(item) {
  const kind = markKind(item);
  const heading = item.swapped
    ? "Lauki ir samainīti vietām."
    : kind === "good"
      ? "Pareizi."
      : kind === "part"
        ? "Daļēji pareizi."
        : "Nepareizi.";
  return `
    <div class="result ${kind}">
      <h3>${heading}</h3>
      ${item.authorInOtherField && !item.swapped ? `<p>Autors ir ierakstīts otrajā laukā.</p>` : ""}
      <p><strong>Autors.</strong> ${item.authorOk ? "Pareizi." : `Jābūt: ${esc(item.piece.author)}`}</p>
      <p><strong>Pārējā informācija.</strong> ${item.detailsOk ? "Pareizi." : `Jābūt: ${esc(answerText(item.piece))}`}</p>
      ${!item.detailsOk && item.missing.length ? `<p>Pietrūkst: ${esc(item.missing.join(", "))}</p>` : ""}
    </div>
  `;
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
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "preset") {
    state.settings.from = 1;
    state.settings.to = Number(button.dataset.to);
    saveSettings();
    render();
  } else if (action === "resume") {
    state.screen = sessionStorage.getItem(SESSION_KEY) ? state.screen : "settings";
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (saved?.screen) state.screen = saved.screen;
    state.restored = false;
    render();
  } else if (action === "settings") {
    if (state.screen === "question" && !confirm("Pārtraukt šo reizi un mainīt iestatījumus?")) return;
    stopPlayback();
    state.screen = "settings";
    state.queue = [];
    state.restored = false;
    saveSession();
    render();
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
  }
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
    ...clipBounds(piece),
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
  setPlayUi(
    current(),
    blocked
      ? "Šo ierakstu te nevar atskaņot. Atbildi vari ierakstīt tik un tā vai spiest Nezinu."
      : "Neizdevās atskaņot. Paspied Klausīties vēlreiz.",
  );
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
  try {
    playerState.player?.pauseVideo();
  } catch {
    /* the player may not exist yet */
  }
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
