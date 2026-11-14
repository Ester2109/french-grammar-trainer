
/* =========================================
   FRENCH GRAMMAR TRAINER
   Complete JavaScript
========================================= */

const $ = id => document.getElementById(id);

/* =========================================
   GRAMMAR LABELS
========================================= */

const pronouns = [
  "je",
  "tu",
  "il / elle / on",
  "nous",
  "vous",
  "ils / elles"
];

const imperativePronouns = [
  "tu",
  "nous",
  "vous"
];

const moodNames = {
  indicatif: "Indicatif",
  subjonctif: "Subjonctif",
  conditionnel: "Conditionnel",
  imperatif: "Impératif",
  infinitif: "Infinitif",
  participe: "Participe",
  gerondif: "Gérondif",
  constructions: "Other constructions"
};

const tenseNames = {
  present: "Présent",
  passe_compose: "Passé composé",
  imparfait: "Imparfait",
  plus_que_parfait: "Plus-que-parfait",
  passe_simple: "Passé simple",
  passe_anterieur: "Passé antérieur",
  futur_simple: "Futur simple",
  futur_anterieur: "Futur antérieur",
  passe: "Passé",
  passe_premiere_forme: "Passé (1re forme)",
  passe_deuxieme_forme: "Passé (2e forme)",
  futur_proche: "Futur proche",
  passe_recent: "Passé récent",
  present_progressif: "Présent progressif"
};

const validMoods = Object.keys(moodNames);

/* =========================================
   GLOBAL VARIABLES
========================================= */

let verbs = {};
let sortedVerbNames = [];
let filteredVerbNames = [];

let mode = "practice";

// Choose verbs is the default Game Mode.
let gameType = "custom";

let selectedCustomVerbs = [];

let gameQuestions = [];
let currentQuestion = 0;

let totalCorrect = 0;
let totalAnswers = 0;
let mistakes = [];

let submitted = false;
let answersRevealed = false;

/* =========================================
   BASIC HELPERS
========================================= */

function show(id) {
  $(id).classList.remove("hidden");
}

function hide(id) {
  $(id).classList.add("hidden");
}

function normalize(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ");
}

function normalizeSearch(text) {
  return normalize(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getMoodName(mood) {
  return moodNames[mood] || mood;
}

function getTenseName(mood, tense) {
  return tenseNames[tense] || tense.replaceAll("_", " ");
}

function getLabels(mood, answers) {
  if (mood === "imperatif") {
    return imperativePronouns.slice(0, answers.length);
  }

  if (answers.length === 1) {
    return ["Form"];
  }

  return pronouns.slice(0, answers.length);
}

/* =========================================
   VALIDATE CONJUGATION ARRAYS
========================================= */

function isUsableAnswers(answers) {
  return (
    Array.isArray(answers) &&
    [1, 3, 6].includes(answers.length) &&
    answers.every(
      answer =>
        typeof answer === "string" &&
        answer.trim().length > 0
    )
  );
}

/* =========================================
   GET ALL AVAILABLE TENSES
========================================= */

function getAllTenses() {
  const result = [];
  const seen = new Set();

  for (const name of sortedVerbNames) {
    const verb = verbs[name];

    for (const mood of validMoods) {
      const tenses = verb?.[mood];

      if (!tenses || typeof tenses !== "object") {
        continue;
      }

      for (const [tense, answers] of Object.entries(tenses)) {
        if (!isUsableAnswers(answers)) {
          continue;
        }

        const key = `${mood}:${tense}`;

        if (!seen.has(key)) {
          seen.add(key);
          result.push({ mood, tense });
        }
      }
    }
  }

  return result;
}

/* =========================================
   SHUFFLE ARRAY
========================================= */

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

/* =========================================
   LOAD VERB DATABASE
========================================= */

async function loadVerbs() {
  try {
    const response = await fetch("verbs.json");

    if (!response.ok) {
      throw new Error("Could not load verbs.json");
    }

    const data = await response.json();

    verbs = data.verbs || data;

    sortedVerbNames = Object.keys(verbs)
      .filter(name => name !== "_meta")
      .sort((a, b) => a.localeCompare(b, "fr"));

    if (!sortedVerbNames.length) {
      throw new Error("The verb database is empty");
    }

    updatePracticeVerbs();
    populateGameTenses();
    renderSelectedCustomVerbs();

    console.log(
      `Loaded ${sortedVerbNames.length} French verbs.`
    );

  } catch (error) {
    console.error(error);

    $("mode-selection").innerHTML = `
      <p class="error-message">
        Could not load the verb database.
        Check that verbs.json is in the same folder
        and open the website using Live Server.
      </p>
    `;
  }
}

/* =========================================
   SEARCH AND FILTER VERBS
   USED BY PRACTICE MODE
========================================= */

function matchingVerbs(groupId, regularId, query = "") {
  const search = normalizeSearch(query);

  return sortedVerbNames.filter(name => {
    const verb = verbs[name];

    if (
      groupId !== "all" &&
      String(verb.group) !== groupId
    ) {
      return false;
    }

    if (
      regularId !== "all" &&
      String(verb.regular) !== regularId
    ) {
      return false;
    }

    if (!search) {
      return true;
    }

    if (normalizeSearch(name).includes(search)) {
      return true;
    }

    const translations = Array.isArray(verb.translation_en)
      ? verb.translation_en
      : typeof verb.translation_en === "string"
        ? [verb.translation_en]
        : [];

    return translations.some(
      translation =>
        normalizeSearch(translation).includes(search)
    );
  });
}

/* =========================================
   PRACTICE MODE VERB SELECTION
========================================= */

function updatePracticeVerbs() {
  const select = $("verb-select");
  const previousVerb = select.value;

  filteredVerbNames = matchingVerbs(
    $("practice-group").value,
    $("practice-regular").value,
    $("verb-search").value
  );

  const visibleVerbs = filteredVerbNames.slice(0, 200);

  if (
    previousVerb &&
    filteredVerbNames.includes(previousVerb) &&
    !visibleVerbs.includes(previousVerb)
  ) {
    visibleVerbs.unshift(previousVerb);
  }

  select.replaceChildren();

  for (const name of visibleVerbs) {
    select.add(new Option(name, name));
  }

  if (
    previousVerb &&
    visibleVerbs.includes(previousVerb)
  ) {
    select.value = previousVerb;
  }

  const count = filteredVerbNames.length;

  $("verb-count").textContent =
    `${count.toLocaleString("en-US")} verbs found` +
    (count > visibleVerbs.length
      ? " · Showing the first 200. Search to narrow the results."
      : "");

  select.disabled = count === 0;

  $("practice-random-btn").disabled = count === 0;

  populateMoods();
  populateTenses();

  if (count === 0) {
    clearPracticeExercise("No matching verbs");
    return;
  }

  if (
    mode === "practice" &&
    !$("exercise-area").classList.contains("hidden")
  ) {
    renderExercise();
  }
}

function selectPracticeVerb(name) {
  const select = $("verb-select");

  if (!verbs[name]) {
    return;
  }

  const exists = Array.from(select.options)
    .some(option => option.value === name);

  if (!exists) {
    select.add(new Option(name, name), 0);
  }

  select.value = name;

  populateMoods();
  populateTenses();

  if (mode === "practice") {
    renderExercise();
  }
}

function pickRandomPracticeVerb() {
  if (!filteredVerbNames.length) {
    return;
  }

  const index = Math.floor(
    Math.random() * filteredVerbNames.length
  );

  selectPracticeVerb(filteredVerbNames[index]);
}

function clearPracticeExercise(message) {
  $("answer-fields").replaceChildren();

  $("verb-title").textContent = message;
  $("verb-translation").textContent = "";
  $("tense-title").textContent = "";
  $("progress-label").textContent = "PRACTICE MODE";

  submitted = false;
  answersRevealed = false;

  $("submit-btn").textContent = "Check answers →";
  $("show-answers-btn").textContent = "Show answers";

  hide("submit-btn");
  hide("show-answers-btn");
  hide("feedback");
  hide("next-btn");
}

/* =========================================
   PRACTICE MODE MOODS
========================================= */

function populateMoods() {
  const select = $("mood-select");
  const previous = select.value;

  select.replaceChildren();

  const verb = verbs[$("verb-select").value];

  if (!verb) {
    return;
  }

  for (const mood of validMoods) {
    const tenses = verb[mood];

    if (
      tenses &&
      Object.values(tenses).some(isUsableAnswers)
    ) {
      select.add(
        new Option(getMoodName(mood), mood)
      );
    }
  }

  if (
    Array.from(select.options)
      .some(option => option.value === previous)
  ) {
    select.value = previous;
  }
}

/* =========================================
   PRACTICE MODE TENSES
========================================= */

function populateTenses() {
  const select = $("tense-select");
  const previous = select.value;

  select.replaceChildren();

  const verb = verbs[$("verb-select").value];
  const mood = $("mood-select").value;

  if (!verb?.[mood]) {
    return;
  }

  for (const [tense, answers] of Object.entries(verb[mood])) {
    if (!isUsableAnswers(answers)) {
      continue;
    }

    select.add(
      new Option(getTenseName(mood, tense), tense)
    );
  }

  if (
    Array.from(select.options)
      .some(option => option.value === previous)
  ) {
    select.value = previous;
  }
}

/* =========================================
   NAVIGATION
========================================= */

function openTrainer() {
  hide("categories");
  show("trainer");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function backToCategories() {
  hide("trainer");
  hide("exercise-panel");

  show("mode-selection");
  show("categories");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function changeMode() {
  hide("exercise-panel");
  hide("exercise-area");
  hide("final-results");

  show("mode-selection");
}

/* =========================================
   PRACTICE MODE
========================================= */

function startPractice() {
  if (!sortedVerbNames.length) {
    return;
  }

  mode = "practice";

  hide("mode-selection");
  hide("game-settings");
  hide("final-results");

  show("exercise-panel");
  show("practice-settings");
  show("exercise-area");

  renderExercise();
}

function getPracticeExercise() {
  return {
    verb: $("verb-select").value,
    mood: $("mood-select").value,
    tense: $("tense-select").value
  };
}

/* =========================================
   GAME MODE
========================================= */

function startGame() {
  if (!sortedVerbNames.length) {
    return;
  }

  mode = "game";

  // Always start in Choose verbs.
  gameType = "custom";

  hide("mode-selection");
  hide("practice-settings");
  hide("exercise-area");
  hide("final-results");

  show("exercise-panel");
  show("game-settings");

  hide("game-error");

  setGameType("custom");
}

/* =========================================
   SWITCH GAME TYPE
========================================= */

function setGameType(type) {
  gameType = type;

  const randomButton = $("game-random-mode-btn");
  const customButton = $("game-custom-mode-btn");

  randomButton.classList.toggle(
    "active",
    type === "random"
  );

  customButton.classList.toggle(
    "active",
    type === "custom"
  );

  randomButton.setAttribute(
    "aria-pressed",
    String(type === "random")
  );

  customButton.setAttribute(
    "aria-pressed",
    String(type === "custom")
  );

  if (type === "random") {
    show("game-random-settings");
    hide("game-custom-settings");
  } else {
    hide("game-random-settings");
    show("game-custom-settings");

    renderSelectedCustomVerbs();
    updateCustomVerbSearch();
  }

  hide("game-error");
}

/* =========================================
   CUSTOM GAME SEARCH
========================================= */

function updateCustomVerbSearch() {
  const query = $("game-custom-search").value.trim();
  const container = $("game-custom-search-results");

  container.replaceChildren();

  if (!query) {
    hide("game-custom-search-results");
    return;
  }

  const search = normalizeSearch(query);

  const matches = sortedVerbNames
    .filter(name => {
      if (selectedCustomVerbs.includes(name)) {
        return false;
      }

      if (normalizeSearch(name).includes(search)) {
        return true;
      }

      const translations = verbs[name].translation_en;

      if (Array.isArray(translations)) {
        return translations.some(
          translation =>
            normalizeSearch(translation).includes(search)
        );
      }

      if (typeof translations === "string") {
        return normalizeSearch(translations).includes(search);
      }

      return false;
    })
    .slice(0, 20);

  if (!matches.length) {
    const empty = document.createElement("p");

    empty.className = "game-custom-empty";
    empty.textContent = "No matching verbs found.";

    container.appendChild(empty);

    show("game-custom-search-results");
    return;
  }

  for (const name of matches) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "game-custom-result";

    const verbName = document.createElement("span");
    verbName.textContent = name;

    const addIcon = document.createElement("span");
    addIcon.textContent = "+";

    addIcon.setAttribute("aria-hidden", "true");

    button.append(verbName, addIcon);

    button.addEventListener("click", () => {
      addCustomVerb(name);
    });

    container.appendChild(button);
  }

  show("game-custom-search-results");
}

/* =========================================
   ADD CUSTOM VERB
========================================= */

function addCustomVerb(name) {
  if (!verbs[name]) {
    return;
  }

  if (selectedCustomVerbs.includes(name)) {
    return;
  }

  selectedCustomVerbs.push(name);

  $("game-custom-search").value = "";

  updateCustomVerbSearch();
  renderSelectedCustomVerbs();

  hide("game-error");

  $("game-custom-search").focus();
}

/* =========================================
   REMOVE CUSTOM VERB
========================================= */

function removeCustomVerb(name) {
  selectedCustomVerbs = selectedCustomVerbs.filter(
    verb => verb !== name
  );

  renderSelectedCustomVerbs();
  updateCustomVerbSearch();
}

/* =========================================
   DISPLAY SELECTED VERBS
========================================= */

function renderSelectedCustomVerbs() {
  const container = $("game-selected-verbs");
  const count = selectedCustomVerbs.length;

  container.replaceChildren();

  $("game-selected-count").textContent =
    `${count} ${count === 1 ? "verb" : "verbs"} selected`;

  if (count === 0) {
    const empty = document.createElement("p");

    empty.className = "game-custom-empty";
    empty.textContent = "No verbs selected yet.";

    container.appendChild(empty);
    return;
  }

  for (const name of selectedCustomVerbs) {
    const tag = document.createElement("span");
    tag.className = "game-selected-tag";

    const text = document.createElement("span");
    text.textContent = name;

    const removeButton = document.createElement("button");

    removeButton.type = "button";
    removeButton.className = "game-selected-remove";
    removeButton.textContent = "×";

    removeButton.setAttribute(
      "aria-label",
      `Remove ${name}`
    );

    removeButton.addEventListener("click", () => {
      removeCustomVerb(name);
    });

    tag.append(text, removeButton);
    container.appendChild(tag);
  }
}

/* =========================================
   GAME TENSE SELECTION
========================================= */

function populateGameTenses() {
  const container = $("tense-checkboxes");

  container.replaceChildren();

  const allTenses = getAllTenses();

  for (const mood of validMoods) {
    const tenses = allTenses.filter(
      item => item.mood === mood
    );

    if (!tenses.length) {
      continue;
    }

    const group = document.createElement("div");
    group.className = "tense-group";

    const title = document.createElement("h4");
    title.textContent = getMoodName(mood);

    group.appendChild(title);

    for (const { tense } of tenses) {
      const label = document.createElement("label");
      label.className = "tense-option";

      const checkbox = document.createElement("input");

      checkbox.type = "checkbox";
      checkbox.value = `${mood}:${tense}`;
      checkbox.checked = false;

      const span = document.createElement("span");
      span.textContent = getTenseName(mood, tense);

      label.append(checkbox, span);
      group.appendChild(label);
    }

    container.appendChild(group);
  }
}

function setAllTenses(checked) {
  document
    .querySelectorAll("#tense-checkboxes input")
    .forEach(input => {
      input.checked = checked;
    });
}

/* =========================================
   GET SELECTED TENSES
========================================= */

function getSelectedTenses() {
  return Array.from(
    document.querySelectorAll(
      "#tense-checkboxes input:checked"
    )
  ).map(input => input.value);
}

/* =========================================
   SHOW GAME ERROR
========================================= */

function showGameError(message) {
  $("game-error").textContent = message;
  show("game-error");
}

/* =========================================
   BUILD RANDOM GAME QUESTIONS
========================================= */

function buildRandomQuestions(selectedTenses) {
  const count = Number($("question-count").value);

  // No filters: use every verb in the database.
  const pool = [];

  for (const verb of sortedVerbNames) {
    const data = verbs[verb];

    for (const key of selectedTenses) {
      const [mood, tense] = key.split(":");

      const answers = data?.[mood]?.[tense];

      if (isUsableAnswers(answers)) {
        pool.push({
          verb,
          mood,
          tense
        });
      }
    }
  }

  if (!pool.length) {
    showGameError(
      "No exercises are available for the selected tenses."
    );

    return null;
  }

  shuffle(pool);

  const questions = [];

  // Avoid repeats until every available
  // combination has been used.
  while (questions.length < count) {
    const remaining = count - questions.length;

    questions.push(
      ...pool.slice(0, remaining)
    );

    if (questions.length < count) {
      shuffle(pool);
    }
  }

  return questions;
}

/* =========================================
   BUILD CUSTOM GAME QUESTIONS
========================================= */

function buildCustomQuestions(selectedTenses) {
  if (!selectedCustomVerbs.length) {
    showGameError(
      "Please select at least one verb."
    );

    return null;
  }

  const questions = [];
  const unavailableVerbs = [];

  for (const verb of selectedCustomVerbs) {
    const data = verbs[verb];

    let availableCount = 0;

    for (const key of selectedTenses) {
      const [mood, tense] = key.split(":");

      const answers = data?.[mood]?.[tense];

      if (isUsableAnswers(answers)) {
        // Every available combination becomes
        // a separate question.
        questions.push({
          verb,
          mood,
          tense
        });

        availableCount++;
      }
    }

    if (availableCount === 0) {
      unavailableVerbs.push(verb);
    }
  }

  if (unavailableVerbs.length) {
    showGameError(
      "No selected tense is available for: " +
      unavailableVerbs.join(", ") +
      ". Choose other tenses or remove these verbs."
    );

    return null;
  }

  if (!questions.length) {
    showGameError(
      "No exercises are available for this selection."
    );

    return null;
  }

  // Shuffle all verb + tense combinations.
  return shuffle(questions);
}

/* =========================================
   BEGIN GAME
========================================= */

function beginGame() {
  const selectedTenses = getSelectedTenses();

  if (!selectedTenses.length) {
    showGameError(
      "Please select at least one verb tense."
    );

    return;
  }

  let questions;

  if (gameType === "random") {
    questions = buildRandomQuestions(selectedTenses);
  } else {
    questions = buildCustomQuestions(selectedTenses);
  }

  if (!questions || !questions.length) {
    return;
  }

  gameQuestions = questions;

  currentQuestion = 0;
  totalCorrect = 0;
  totalAnswers = 0;
  mistakes = [];

  hide("game-error");
  hide("game-settings");

  show("exercise-area");

  renderExercise();
}

/* =========================================
   GET CURRENT EXERCISE
========================================= */

function getCurrentExercise() {
  if (mode === "game") {
    return gameQuestions[currentQuestion];
  }

  return getPracticeExercise();
}

/* =========================================
   RENDER EXERCISE
========================================= */

function renderExercise() {
  const exercise = getCurrentExercise();

  if (!exercise) {
    if (mode === "practice") {
      clearPracticeExercise("No verb selected");
    }

    return;
  }

  const { verb, mood, tense } = exercise;

  const answers = verbs[verb]?.[mood]?.[tense];

  if (!isUsableAnswers(answers)) {
    if (mode === "practice") {
      clearPracticeExercise(
        "No conjugation available"
      );
    }

    return;
  }

  submitted = false;
  answersRevealed = false;

  $("submit-btn").textContent = "Check answers →";
  $("show-answers-btn").textContent = "Show answers";

  $("verb-title").textContent = verb;

  const translations = verbs[verb]?.translation_en || [];

  $("verb-translation").textContent =
    Array.isArray(translations)
      ? translations.join(" · ")
      : String(translations);

  $("tense-title").textContent =
    `${getMoodName(mood)} — ${getTenseName(mood, tense)}`;

  $("progress-label").textContent =
    mode === "game"
      ? `QUESTION ${currentQuestion + 1} OF ${gameQuestions.length}`
      : "PRACTICE MODE";

  const labels = getLabels(mood, answers);
  const container = $("answer-fields");

  container.replaceChildren();

  answers.forEach((answer, index) => {
    const row = document.createElement("div");
    row.className = "answer-row";

    const label = document.createElement("label");

    label.htmlFor = `answer-${index}`;
    label.textContent = labels[index] || "Form";

    const input = document.createElement("input");

    input.type = "text";
    input.id = `answer-${index}`;
    input.className = "answer-input";
    input.autocomplete = "off";
    input.spellcheck = false;

    row.append(label, input);
    container.appendChild(row);
  });

  show("submit-btn");
  hide("feedback");
  hide("next-btn");

  // Answers can only be revealed in Practice Mode.
  if (mode === "practice") {
    show("show-answers-btn");
  } else {
    hide("show-answers-btn");
  }

  // Preserve search focus while typing.
  if (document.activeElement !== $("verb-search")) {
    container.querySelector("input")?.focus();
  }
}

/* =========================================
   SHOW ANSWERS
========================================= */

function showAnswers() {
  if (mode !== "practice") {
    return;
  }

  const exercise = getCurrentExercise();

  if (!exercise) {
    return;
  }

  const { verb, mood, tense } = exercise;
  const answers = verbs[verb]?.[mood]?.[tense];

  if (!isUsableAnswers(answers)) {
    return;
  }

  answersRevealed = true;
  submitted = false;

  answers.forEach((answer, index) => {
    const input = $(`answer-${index}`);

    input.value = answer;
    input.disabled = true;

    input.classList.remove(
      "correct",
      "incorrect"
    );

    input.classList.add("revealed");

    const correction = input.parentElement.querySelector(
      ".correction"
    );

    if (correction) {
      correction.remove();
    }
  });

  // Showing answers does not change
  // the Check answers button.
  $("submit-btn").textContent = "Check answers →";
  $("show-answers-btn").textContent = "Hide answers";

  show("submit-btn");
  hide("feedback");
  hide("next-btn");
}

/* =========================================
   TRY AGAIN
========================================= */

function tryAgain() {
  answersRevealed = false;
  submitted = false;

  const inputs = document.querySelectorAll(
    "#answer-fields .answer-input"
  );

  inputs.forEach(input => {
    input.value = "";
    input.disabled = false;

    input.classList.remove(
      "correct",
      "incorrect",
      "revealed"
    );

    const correction = input.parentElement.querySelector(
      ".correction"
    );

    if (correction) {
      correction.remove();
    }
  });

  $("submit-btn").textContent = "Check answers →";
  $("show-answers-btn").textContent = "Show answers";

  show("submit-btn");
  hide("feedback");
  hide("next-btn");

  inputs[0]?.focus();
}

/* =========================================
   NORMALIZE OPTIONAL SUBJECTS
========================================= */

function removeOptionalSubject(text, index, mood, length) {
  let answer = normalize(text);

  if (length !== 6 || mood === "imperatif") {
    return answer;
  }

  const prefixes = [
    ["je ", "j'"],
    ["tu "],
    ["il ", "elle ", "on "],
    ["nous "],
    ["vous "],
    ["ils ", "elles "]
  ];

  for (const prefix of prefixes[index]) {
    if (answer.startsWith(prefix)) {
      return answer.slice(prefix.length);
    }
  }

  return answer;
}

/* =========================================
   CHECK SINGLE ANSWER
========================================= */

function isCorrectAnswer(input, expected, index, mood, length) {
  const userAnswer = removeOptionalSubject(
    input,
    index,
    mood,
    length
  );

  const correctAnswer = normalize(expected);

  return userAnswer === correctAnswer;
}

/* =========================================
   CHECK ALL ANSWERS
========================================= */

function checkAnswers(event) {
  event.preventDefault();

  // Revealed answers cannot be scored.
  if (answersRevealed) {
    return;
  }

  // Practice Mode: Try again after checking.
  if (submitted && mode === "practice") {
    tryAgain();
    return;
  }

  if (submitted) {
    return;
  }

  const exercise = getCurrentExercise();

  if (!exercise) {
    return;
  }

  const { verb, mood, tense } = exercise;
  const answers = verbs[verb]?.[mood]?.[tense];

  if (!isUsableAnswers(answers)) {
    return;
  }

  const labels = getLabels(mood, answers);

  let correct = 0;

  answers.forEach((expected, index) => {
    const input = $(`answer-${index}`);
    const userAnswer = input.value;

    const valid = isCorrectAnswer(
      userAnswer,
      expected,
      index,
      mood,
      answers.length
    );

    input.disabled = true;

    if (valid) {
      input.classList.add("correct");
      correct++;
    } else {
      input.classList.add("incorrect");

      const correction = document.createElement("span");

      correction.className = "correction";
      correction.textContent =
        `Correct answer: ${expected}`;

      input.parentElement.appendChild(correction);

      if (mode === "game") {
        mistakes.push({
          verb,
          mood,
          tense,
          pronoun: labels[index],
          answer: userAnswer.trim() || "(blank)",
          expected
        });
      }
    }
  });

  submitted = true;

  if (mode === "game") {
    totalCorrect += correct;
    totalAnswers += answers.length;
  }

  const percentage = Math.round(
    (correct / answers.length) * 100
  );

  $("feedback").textContent =
    `${correct} / ${answers.length} correct (${percentage}%)`;

  show("feedback");

  if (mode === "practice") {
    $("submit-btn").textContent = "Try again ↻";
    show("submit-btn");
  } else {
    hide("submit-btn");

    $("next-btn").textContent =
      currentQuestion === gameQuestions.length - 1
        ? "See results →"
        : "Next question →";

    show("next-btn");
  }
}

/* =========================================
   NEXT GAME QUESTION
========================================= */

function nextQuestion() {
  currentQuestion++;

  if (currentQuestion >= gameQuestions.length) {
    finishGame();
  } else {
    renderExercise();
  }
}

/* =========================================
   FINAL GAME RESULTS
========================================= */

function finishGame() {
  hide("exercise-area");
  show("final-results");

  const percentage = totalAnswers
    ? Math.round((totalCorrect / totalAnswers) * 100)
    : 0;

  const container = $("final-results");

  container.replaceChildren();

  const title = document.createElement("h2");
  title.textContent = "Challenge completed!";

  const score = document.createElement("h3");
  score.textContent = `${percentage}%`;

  const summary = document.createElement("p");
  summary.textContent =
    `You got ${totalCorrect} out of ${totalAnswers} answers correct.`;

  container.append(title, score, summary);

  if (mistakes.length) {
    const heading = document.createElement("h3");

    heading.textContent = "Review your mistakes";
    heading.style.fontSize = "22px";

    const list = document.createElement("ul");
    list.className = "result-detail";

    mistakes.forEach(item => {
      const li = document.createElement("li");

      const itemHeading = document.createElement("strong");

      itemHeading.textContent =
        `${item.verb} — ${getMoodName(item.mood)}, ` +
        `${getTenseName(item.mood, item.tense)}`;

      const detail = document.createElement("div");

      detail.textContent =
        `${item.pronoun}: ${item.answer} → ${item.expected}`;

      li.append(itemHeading, detail);
      list.appendChild(li);
    });

    container.append(heading, list);
  } else {
    const perfect = document.createElement("p");

    perfect.textContent =
      "Perfect score! Excellent work!";

    container.appendChild(perfect);
  }

  const again = document.createElement("button");

  again.type = "button";
  again.className = "primary-button";
  again.textContent = "Play again →";

  again.addEventListener("click", startGame);

  container.appendChild(again);
}

/* =========================================
   EVENT LISTENERS
========================================= */

// Navigation
$("verbs-category").addEventListener(
  "click",
  openTrainer
);

$("back-button").addEventListener(
  "click",
  backToCategories
);

$("change-mode-btn").addEventListener(
  "click",
  changeMode
);

// Main modes
$("practice-btn").addEventListener(
  "click",
  startPractice
);

$("game-btn").addEventListener(
  "click",
  startGame
);

// Choose verbs / Random verbs
$("game-custom-mode-btn").addEventListener(
  "click",
  () => setGameType("custom")
);

$("game-random-mode-btn").addEventListener(
  "click",
  () => setGameType("random")
);

// Custom verb search
$("game-custom-search").addEventListener(
  "input",
  updateCustomVerbSearch
);

// Start challenge
$("start-game-button").addEventListener(
  "click",
  beginGame
);

// Select all tenses
$("select-all-btn").addEventListener(
  "click",
  () => setAllTenses(true)
);

// Deselect all tenses
$("deselect-all-btn").addEventListener(
  "click",
  () => setAllTenses(false)
);

// Check answers
$("conjugation-form").addEventListener(
  "submit",
  checkAnswers
);

// Next question
$("next-btn").addEventListener(
  "click",
  nextQuestion
);

// Show / hide answers in Practice Mode
$("show-answers-btn").addEventListener("click", () => {
  if (mode !== "practice") {
    return;
  }

  if (answersRevealed) {
    tryAgain();
  } else {
    showAnswers();
  }
});

// Practice verb selection
$("verb-select").addEventListener("change", () => {
  populateMoods();
  populateTenses();

  if (mode === "practice") {
    renderExercise();
  }
});

// Practice mood selection
$("mood-select").addEventListener("change", () => {
  populateTenses();

  if (mode === "practice") {
    renderExercise();
  }
});

// Practice tense selection
$("tense-select").addEventListener("change", () => {
  if (mode === "practice") {
    renderExercise();
  }
});

// Practice search
$("verb-search").addEventListener(
  "input",
  updatePracticeVerbs
);

// Practice group filter
$("practice-group").addEventListener(
  "change",
  updatePracticeVerbs
);

// Practice regularity filter
$("practice-regular").addEventListener(
  "change",
  updatePracticeVerbs
);

// Random verb in Practice Mode
$("practice-random-btn").addEventListener(
  "click",
  pickRandomPracticeVerb
);

/* =========================================
   INITIALIZATION
========================================= */

loadVerbs();
