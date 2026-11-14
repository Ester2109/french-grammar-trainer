
const pronouns = ["je", "tu", "il / elle / on", "nous", "vous", "ils / elles"];

let verbs = {};
let mode = "practice";
let gameQuestions = [];
let currentQuestion = 0;
let totalCorrect = 0;
let totalAnswers = 0;
let submitted = false;

const $ = (id) => document.getElementById(id);

function show(element) {
  element.classList.remove("hidden");
}

function hide(element) {
  element.classList.add("hidden");
}

function normalize(text) {
  return text.trim().toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ");
}

async function loadVerbs() {
  try {
    const response = await fetch("verbs.json");
    if (!response.ok) throw new Error("Could not load verbs");
    verbs = await response.json();

    const select = $("verb-select");
    select.innerHTML = "";

    Object.keys(verbs).sort().forEach(verb => {
      const option = document.createElement("option");
      option.value = verb;
      option.textContent = verb;
      select.appendChild(option);
    });
  } catch (error) {
    $("mode-selection").innerHTML =
      "<p>Could not load verbs.json. Please run the website using a local server.</p>";
    console.error(error);
  }
}

function openTrainer() {
  hide($("categories"));
  show($("trainer"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function backToCategories() {
  hide($("trainer"));
  show($("categories"));
  hide($("exercise-panel"));
  show($("mode-selection"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startPractice() {
  if (!Object.keys(verbs).length) return;
  mode = "practice";
  show($("exercise-panel"));
  hide($("mode-selection"));
  hide($("game-settings"));
  show($("verb-select"));
  $("verb-select").parentElement.classList.remove("hidden");
  $("tense-select").disabled = false;
  $("verb-select").disabled = false;
  show($("exercise-area"));
  hide($("final-results"));
  renderExercise();
}

function startGame() {
  if (!Object.keys(verbs).length) return;
  mode = "game";
  show($("exercise-panel"));
  hide($("mode-selection"));
  show($("game-settings"));
  hide($("exercise-area"));
  hide($("final-results"));
  $("verb-select").parentElement.classList.add("hidden");
  $("tense-select").disabled = false;

  if (!$("start-game-button")) {
    const button = document.createElement("button");
    button.id = "start-game-button";
    button.className = "primary-button";
    button.textContent = "Start challenge →";
    button.addEventListener("click", beginGame);
    $("game-settings").appendChild(button);
  }
}

function beginGame() {
  const count = Number($("question-count").value);
  const tense = $("tense-select").value;
  const names = Object.keys(verbs);

  gameQuestions = Array.from({ length: count }, () => ({
    verb: names[Math.floor(Math.random() * names.length)],
    tense
  }));

  currentQuestion = 0;
  totalCorrect = 0;
  totalAnswers = 0;

  $("tense-select").disabled = true;
  hide($("game-settings"));
  show($("exercise-area"));
  renderExercise();
}

function getCurrentExercise() {
  if (mode === "game") {
    return gameQuestions[currentQuestion];
  }
  return {
    verb: $("verb-select").value,
    tense: $("tense-select").value
  };
}

function renderExercise() {
  const { verb, tense } = getCurrentExercise();
  if (!verb || !verbs[verb]?.[tense]) return;

  submitted = false;
  $("verb-title").textContent = verb;
  $("tense-title").textContent =
    $("tense-select").selectedOptions[0].textContent;

  $("progress-label").textContent = mode === "game"
    ? `Verb ${currentQuestion + 1} of ${gameQuestions.length}`
    : "PRACTICE MODE";

  const container = $("answer-fields");
  container.innerHTML = "";

  pronouns.forEach((pronoun, index) => {
    const row = document.createElement("div");
    row.className = "answer-row";

    const label = document.createElement("label");
    label.htmlFor = `answer-${index}`;
    label.textContent = pronoun;

    const input = document.createElement("input");
    input.type = "text";
    input.id = `answer-${index}`;
    input.className = "answer-input";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.required = false;

    row.append(label, input);
    container.appendChild(row);
  });

  show($("submit-btn"));
  hide($("feedback"));
  hide($("next-btn"));
  container.querySelector("input")?.focus();
}

function checkAnswers(event) {
  event.preventDefault();
  if (submitted) return;

  const { verb, tense } = getCurrentExercise();
  const correctAnswers = verbs[verb][tense];
  let correct = 0;

  pronouns.forEach((pronoun, index) => {
    const input = $(`answer-${index}`);
    const expected = correctAnswers[index];
    const answer = normalize(input.value);

    input.disabled = true;

    if (answer === normalize(expected)) {
      input.classList.add("correct");
      correct++;
    } else {
      input.classList.add("incorrect");
      const correction = document.createElement("span");
      correction.className = "correction";
      correction.textContent = `Correct answer: ${expected}`;
      input.parentElement.appendChild(correction);
    }
  });

  submitted = true;
  totalCorrect += correct;
  totalAnswers += 6;

  $("feedback").textContent = `You got ${correct} out of 6 correct!`;
  show($("feedback"));
  hide($("submit-btn"));

  if (mode === "game") {
    $("next-btn").textContent =
      currentQuestion === gameQuestions.length - 1
        ? "See results →"
        : "Next verb →";
    show($("next-btn"));
  }
}

function nextQuestion() {
  currentQuestion++;

  if (currentQuestion >= gameQuestions.length) {
    finishGame();
  } else {
    renderExercise();
  }
}

function finishGame() {
  hide($("exercise-area"));
  show($("final-results"));

  const percentage = Math.round(totalCorrect / totalAnswers * 100);

  $("final-results").innerHTML = `
    <div style="font-size:55px">🏆</div>
    <h2>Challenge completed!</h2>
    <h3>${percentage}%</h3>
    <p>You got ${totalCorrect} out of ${totalAnswers} conjugations correct.</p>
    <button class="primary-button" id="play-again">Play again →</button>
  `;

  $("play-again").addEventListener("click", startGame);
}

$("verbs-category").addEventListener("click", openTrainer);
$("back-button").addEventListener("click", backToCategories);
$("home-link").addEventListener("click", backToCategories);
$("practice-btn").addEventListener("click", startPractice);
$("game-btn").addEventListener("click", startGame);
$("conjugation-form").addEventListener("submit", checkAnswers);
$("next-btn").addEventListener("click", nextQuestion);

$("verb-select").addEventListener("change", () => {
  if (mode === "practice") renderExercise();
});

$("tense-select").addEventListener("change", () => {
  if (mode === "practice") renderExercise();
});

loadVerbs();
