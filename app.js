// app.js（全文）
// 出題モード:
//  - order  : 問番号順
//  - random : 全問題ランダム
//  - wrong  : 間違いだけ
//  - weak   : 苦手優先
//
// 追加:
//  - 正解/不正解の演出（choiceに correct/wrong、カードに celebrate/shake）
//  - 正解時にCSS紙吹雪（celebrateクラス）
//  - 連続正解(streak)でバッジ表示（3/5/10/20）
//  - 選択肢は毎回シャッフル（本文順不同OK）

const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = "denkain_stats_v2";

/* ===============================
   Utility
================================ */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

/* ===============================
   Stats
================================ */
function loadStats() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveStats(stats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}
function getStat(stats, qid) {
  if (!stats[qid]) {
    stats[qid] = { seen: 0, correct: 0, wrong: 0, streak: 0, last: null };
  }
  return stats[qid];
}

/* ===============================
   Weakness score
================================ */
function weaknessScore(stat) {
  const seen = stat?.seen || 0;
  const wrong = stat?.wrong || 0;
  const streak = stat?.streak || 0;

  const unseenBoost = seen === 0 ? 5 : 0;
  const wrongRate = seen > 0 ? wrong / seen : 0;
  const wrongBoost = wrongRate * 4;
  const streakPenalty = Math.max(0, 3 - streak) * 0.7;

  return 1 + unseenBoost + wrongBoost + streakPenalty;
}

/* ===============================
   Session order builder
================================ */
function buildSessionOrder(questions, stats, mode) {
  if (!questions.length) return [];

  if (mode === "order") {
    return questions
      .slice()
      .sort((a, b) => Number(a.no) - Number(b.no))
      .map(q => q.id);
  }

  if (mode === "random") {
    return shuffle(questions).map(q => q.id);
  }

  if (mode === "wrong") {
    return questions
      .filter(q => (stats[q.id]?.wrong || 0) > 0)
      .map(q => q.id);
  }

  if (mode === "weak") {
    return questions
      .slice()
      .sort((a, b) => weaknessScore(stats[b.id]) - weaknessScore(stats[a.id]))
      .map(q => q.id);
  }

  return [];
}

/* ===============================
   State
================================ */
let catalog = null;
let dataset = null;

let state = {
  year: null,
  term: null,
  subject: null,

  questions: [],
  order: [],
  index: 0,

  mode: "order",
  shuffledChoices: [],
  selectedChoiceId: null,
  checked: false,
};

/* ===============================
   Mode UI
================================ */
function setModeLabel() {
  const btn = $("#modeBtn");
  if (!btn) return;

  const labelMap = {
    order: "順番",
    random: "ランダム",
    wrong: "間違い",
    weak: "苦手優先",
  };
  btn.textContent = `モード: ${labelMap[state.mode]}`;
}

function toggleMode() {
  const order = ["order", "random", "wrong", "weak"];
  const idx = order.indexOf(state.mode);
  state.mode = order[(idx + 1) % order.length];
  setModeLabel();
  startSession();
}

/* ===============================
   Streak badge UI
================================ */
function ensureStreakBadge() {
  let el = $("#streakBadge");
  if (el) return el;

  // progressの横に置く（なければmetaの横）
  const progress = $("#progress");
  const meta = $("#meta");
  const anchor = progress?.parentElement || meta?.parentElement || document.body;

  el = document.createElement("span");
  el.id = "streakBadge";
  el.className = "streakBadge";
  el.style.display = "none";

  anchor.appendChild(el);
  return el;
}

function streakLabel(streak) {
  if (streak >= 20) return { text: `🔥 ${streak}連続！`, kind: "hot" };
  if (streak >= 10) return { text: `⚡ ${streak}連続！`, kind: "spark" };
  if (streak >= 5)  return { text: `✨ ${streak}連続！`, kind: "shine" };
  if (streak >= 3)  return { text: `🎯 ${streak}連続！`, kind: "hit" };
  return null;
}

function updateStreakBadge(streak) {
  const badge = ensureStreakBadge();
  const info = streakLabel(streak);

  if (!info) {
    badge.style.display = "none";
    badge.textContent = "";
    badge.classList.remove("hot", "spark", "shine", "hit", "pop");
    return;
  }

  badge.style.display = "inline-flex";
  badge.textContent = info.text;
  badge.classList.remove("hot", "spark", "shine", "hit");
  badge.classList.add(info.kind);

  // 毎回ポンと出す
  badge.classList.remove("pop");
  void badge.offsetWidth;
  badge.classList.add("pop");
}

/* ===============================
   Quiz flow
================================ */
function currentQuestion() {
  const qid = state.order[state.index];
  return state.questions.find(q => q.id === qid);
}

function clearChoiceEffects() {
  document.querySelectorAll(".choice").forEach(el => {
    el.classList.remove("selected", "correct", "wrong");
  });

  const card = $("#quizCard");
  if (card) {
    card.classList.remove("celebrate", "shake");
    void card.offsetWidth;
  }
}

function startSession() {
  const stats = loadStats();
  state.order = buildSessionOrder(state.questions, stats, state.mode);
  state.index = 0;

  if (!state.order.length) {
    $("#meta").textContent = "出題できる問題がありません。";
    $("#choices").innerHTML = "";
    $("#result").textContent = "";
    $("#progress").textContent = "";
    updateStreakBadge(0);
    return;
  }
  showQuestion();
}

function showQuestion() {
  const q = currentQuestion();
  if (!q) return;

  clearChoiceEffects();

  $("#meta").textContent = `${dataset?.meta?.label ? dataset.meta.label + "｜" : ""}問${q.no}`;
  $("#progress").textContent = `${state.index + 1} / ${state.order.length}`;

  $("#qimg").src = q.image || "";
  $("#qtext").textContent = q.text || "";

  state.shuffledChoices = shuffle(q.choices || []);
  state.selectedChoiceId = null;
  state.checked = false;

  renderChoices();
  $("#checkBtn").disabled = true;
  $("#nextBtn").disabled = true;
  $("#result").textContent = "";

  // 現在のstreak（最後に回答した問題のstreakでも、今回の問題とは別だがモチベ用に表示）
  // → ここでは表示を消さない（チェック時に更新）
}

function renderChoices() {
  const wrap = $("#choices");
  wrap.innerHTML = "";

  state.shuffledChoices.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "choice";
    div.dataset.cid = c.id;

    div.innerHTML = `
      <div class="idx">${i + 1}</div>
      <div class="body">${c.text || ""}</div>
    `;

    div.onclick = () => {
      if (state.checked) return;
      state.selectedChoiceId = c.id;
      $("#checkBtn").disabled = false;

      wrap.querySelectorAll(".choice").forEach(el => {
        el.classList.toggle("selected", el === div);
      });
    };

    wrap.appendChild(div);
  });
}

function applyAnswerEffects(q, ok) {
  const selectedId = state.selectedChoiceId;
  const correctId = q.answer;

  const selectedEl = document.querySelector(`.choice[data-cid="${selectedId}"]`);
  const correctEl  = document.querySelector(`.choice[data-cid="${correctId}"]`);
  const card = $("#quizCard");

  // いったん外して再付与（連続で同じ演出でも発火するように）
  document.querySelectorAll(".choice").forEach(el => el.classList.remove("correct", "wrong"));
  if (card) {
    card.classList.remove("celebrate", "shake");
    void card.offsetWidth;
  }

  if (ok) {
    if (selectedEl) selectedEl.classList.add("correct");
    if (card) card.classList.add("celebrate"); // ← これでCSS紙吹雪が出る
  } else {
    if (selectedEl) selectedEl.classList.add("wrong");
    if (correctEl)  correctEl.classList.add("correct");
    if (card) card.classList.add("shake");
  }

  // 演出クラスは一定時間で外す（次の問題に影響しないように）
  setTimeout(() => {
    if (card) card.classList.remove("celebrate", "shake");
  }, 650);
}

function checkAnswer() {
  const q = currentQuestion();
  if (!q || !state.selectedChoiceId || state.checked) return;

  const stats = loadStats();
  const st = getStat(stats, q.id);

  st.seen++;
  st.last = new Date().toISOString();

  const ok = state.selectedChoiceId === q.answer;

  if (ok) {
    st.correct++;
    st.streak = (st.streak || 0) + 1;
    $("#result").textContent = "✅ 正解！";
  } else {
    st.wrong++;
    st.streak = 0;

    // 正解が何番か（シャッフル後の表示番号）
    const idx = state.shuffledChoices.findIndex(c => c.id === q.answer);
    const no = idx >= 0 ? (idx + 1) : "?";
    $("#result").textContent = `❌ 不正解…（正解：${no}番）`;
  }

  saveStats(stats);

  state.checked = true;
  $("#checkBtn").disabled = true;
  $("#nextBtn").disabled = false;

  applyAnswerEffects(q, ok);
  updateStreakBadge(st.streak || 0);
}

function nextQuestion() {
  state.index++;
  if (state.index >= state.order.length) {
    $("#result").textContent = "🎉 最後まで完了！";
    return;
  }
  showQuestion();
}

/* ===============================
   Init (selectors)
================================ */
async function loadDataset() {
  const y = catalog.years.find(v => v.year === state.year);
  const t = y.terms.find(v => v.term === state.term);
  const s = t.subjects.find(v => v.id === state.subject);
  dataset = await fetchJSON(s.data);
  state.questions = dataset.questions || [];
}

async function initSelectors() {
  catalog = await fetchJSON("./data/catalog.json");

  const yearSel = $("#yearSelect");
  const termSel = $("#termSelect");
  const subjSel = $("#subjectSelect");

  yearSel.innerHTML = "";
  catalog.years.forEach(y => {
    const o = document.createElement("option");
    o.value = y.year;
    o.textContent = y.year;
    yearSel.appendChild(o);
  });

  yearSel.onchange = async () => {
    const y = catalog.years.find(v => v.year === yearSel.value);
    termSel.innerHTML = "";
    y.terms.forEach(t => {
      const o = document.createElement("option");
      o.value = t.term;
      o.textContent = t.label;
      termSel.appendChild(o);
    });
    termSel.onchange();
  };

  termSel.onchange = async () => {
    const y = catalog.years.find(v => v.year === yearSel.value);
    const t = y.terms.find(v => v.term === termSel.value);
    subjSel.innerHTML = "";
    t.subjects.forEach(s => {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.label;
      subjSel.appendChild(o);
    });
    subjSel.onchange();
  };

  subjSel.onchange = async () => {
    state.year = yearSel.value;
    state.term = termSel.value;
    state.subject = subjSel.value;
    updateStreakBadge(0);
    await loadDataset();
    startSession();
  };

  yearSel.onchange();
}

/* ===============================
   Boot
================================ */
$("#checkBtn").onclick = checkAnswer;
$("#nextBtn").onclick = nextQuestion;
$("#modeBtn").onclick = toggleMode;

setModeLabel();
ensureStreakBadge();
initSelectors();
