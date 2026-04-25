const SUPABASE_URL = "https://kcpesymqnjahcazdozjv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjcGVzeW1xbmphaGNhemRvemp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwOTg1MTQsImV4cCI6MjA5MjY3NDUxNH0.-Vf4PFcr-rMxL7qAsHGz481UEwgDfDnRMmWQiMjv7iA";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let current = {};

function getMatchId() {
  return new URLSearchParams(window.location.search).get("id");
}

// CREATE MATCH
async function createMatch() {
  const matchId = Date.now().toString();

  const striker = { name: prompt("Striker name"), runs: 0, balls: 0 };
  const non_striker = { name: prompt("Non-Striker name"), runs: 0, balls: 0 };

  const data = {
    id: matchId,
    teamA: teamA.value,
    teamB: teamB.value,
    totalOvers: parseInt(overs.value),
    runs: 0,
    wickets: 0,
    balls: 0,
    history: [],
    innings: 1,
    target: null,
    striker,
    non_striker
  };

  await supabase.from("matches").insert([data]);

  window.location.href = `scorer.html?id=${matchId}`;
}

// LOAD MATCH
async function loadMatch() {
  const matchId = getMatchId();
  if (!matchId) return;

  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  updateUI(data);

  supabase.channel("match")
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "matches",
      filter: `id=eq.${matchId}`
    }, payload => {
      updateUI(payload.new);
    })
    .subscribe();
}

// UPDATE UI
function updateUI(data) {
  current = data;

  document.getElementById("teams").innerText =
    `${data.teamA} vs ${data.teamB}`;

  document.getElementById("score").innerText =
    `${data.runs}/${data.wickets}`;

  document.getElementById("overs").innerText =
    `${Math.floor(data.balls / 6)}.${data.balls % 6}/${data.totalOvers}`;

  document.getElementById("players").innerText =
    `${data.striker.name} (${data.striker.runs})* | ${data.non_striker.name} (${data.non_striker.runs})`;

  document.getElementById("history").innerText =
    data.history.join("  ");

  document.getElementById("stats").innerText =
    `CRR: ${calculateCRR()} | RRR: ${calculateRRR()}`;
}

// RUN
function addRun(run) {
  let striker = { ...current.striker };

  striker.runs += run;
  striker.balls += 1;

  let balls = current.balls + 1;

  let s = striker;
  let ns = current.non_striker;

  if (run % 2 === 1) [s, ns] = [ns, s];
  if (balls % 6 === 0) [s, ns] = [ns, s];

  updateMatch({
    runs: current.runs + run,
    balls,
    striker: s,
    non_striker: ns,
    history: [...current.history, run]
  });
}

// WICKET
function wicket(type) {
  const newName = prompt("New batsman");

  updateMatch({
    wickets: current.wickets + 1,
    balls: current.balls + 1,
    striker: { name: newName, runs: 0, balls: 0 },
    history: [...current.history, "W"]
  });
}

// UNDO
function undo() {
  if (!current.history.length) return;

  let last = current.history.slice(-1)[0];
  let history = current.history.slice(0, -1);

  let runs = current.runs;
  let balls = current.balls;
  let wickets = current.wickets;

  if (typeof last === "number") {
    runs -= last;
    balls -= 1;
  } else {
    wickets -= 1;
    balls -= 1;
  }

  updateMatch({ runs, balls, wickets, history });
}

// END INNINGS
function endInnings() {
  if (current.innings === 1) {
    updateMatch({
      innings: 2,
      target: current.runs + 1,
      runs: 0,
      wickets: 0,
      balls: 0,
      history: []
    });
    alert("Second innings started!");
  }
}

// UPDATE DB
async function updateMatch(update) {
  const matchId = getMatchId();

  await supabase.from("matches")
    .update(update)
    .eq("id", matchId);
}

// CALCULATIONS
function calculateCRR() {
  if (current.balls === 0) return 0;
  return (current.runs / (current.balls / 6)).toFixed(2);
}

function calculateRRR() {
  if (!current.target) return "-";

  let ballsLeft = current.totalOvers * 6 - current.balls;
  let runsNeeded = current.target - current.runs;

  if (ballsLeft <= 0) return "-";

  return (runsNeeded / (ballsLeft / 6)).toFixed(2);
}

loadMatch();