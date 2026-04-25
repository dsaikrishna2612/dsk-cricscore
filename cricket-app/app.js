const SUPABASE_URL = "https://kcpesymqnjahcazdozjv.supabase.co";
const SUPABASE_KEY = "sb_publishable_k90Rr5o4zcJCmM6ppocI_w_ADTjDyp8";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let current = {};

class Match {
  constructor(data) {
    Object.assign(this, data);
  }

  getOvers() {
    return Math.floor(this.balls / 6) + "." + (this.balls % 6);
  }
}

function getMatchId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

// CREATE MATCH
async function createMatch() {
  const matchId = Date.now().toString();

  const striker = { name: prompt("Striker name"), runs: 0, balls: 0 };
  const non_striker = { name: prompt("Non-Striker name"), runs: 0, balls: 0 };
  const bowler = { name: prompt("Bowler name"), balls: 0, runs: 0 };

  const data = {
    id: matchId,
    teamA: teamA.value,
    teamB: teamB.value,
    totalOvers: parseInt(overs.value),
    target: parseInt(target.value) || null,
    striker,
    non_striker,
    bowler
  };

  await supabase.from("matches").insert([data]);

  window.location.href = `scorer.html?id=${matchId}`;
}

// LOAD MATCH + REALTIME
async function loadMatch() {
  const matchId = getMatchId();
  if (!matchId) return;

  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  updateUI(data);

  supabase
    .channel("match-" + matchId)
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

  const match = new Match(data);

  document.getElementById("teams").innerText =
    match.teamA + " vs " + match.teamB;

  document.getElementById("score").innerText =
    match.runs + "/" + match.wickets;

  document.getElementById("overs").innerText =
    match.getOvers() + "/" + match.totalOvers;

  document.getElementById("players").innerText =
    `${current.striker.name} (${current.striker.runs})* | ${current.non_striker.name} (${current.non_striker.runs})`;

  document.getElementById("history").innerText =
    current.history.map(formatBall).join("  ");
}

// FORMAT BALL
function formatBall(ball) {
  if (typeof ball === "number") return ball;

  if (ball.type === "bowled") return `B ${ball.batsman}`;
  if (ball.type === "caught") return `C ${ball.batsman}`;
  if (ball.type === "runout") return `RO ${ball.batsman}`;

  return "";
}

// UPDATE MATCH
async function updateMatch(update) {
  const matchId = getMatchId();

  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  let updated = {
    ...data,
    ...update,
    updated_at: new Date()
  };

  await supabase.from("matches").update(updated).eq("id", matchId);
}

// RUN LOGIC
function addRun(run) {
  let striker = { ...current.striker };

  striker.runs += run;
  striker.balls += 1;

  let newBalls = current.balls + 1;

  let newStriker = striker;
  let newNonStriker = current.non_striker;

  if (run % 2 === 1) {
    [newStriker, newNonStriker] = [newNonStriker, newStriker];
  }

  if (newBalls % 6 === 0) {
    [newStriker, newNonStriker] = [newNonStriker, newStriker];
  }

  let newHistory = [...current.history, run];

  updateMatch({
    runs: current.runs + run,
    balls: newBalls,
    striker: newStriker,
    non_striker: newNonStriker,
    history: newHistory
  });
}

// WICKET
function wicket(type) {
  const newName = prompt("New batsman name");

  let newHistory = [...current.history, {
    type,
    batsman: current.striker.name
  }];

  updateMatch({
    wickets: current.wickets + 1,
    balls: current.balls + 1,
    striker: { name: newName, runs: 0, balls: 0 },
    history: newHistory
  });
}

// UNDO
function undo() {
  if (!current.history.length) return;

  let last = current.history[current.history.length - 1];
  let newHistory = current.history.slice(0, -1);

  let updated = {
    history: newHistory,
    runs: current.runs,
    wickets: current.wickets,
    balls: current.balls
  };

  if (typeof last === "number") {
    updated.runs -= last;
    updated.balls -= 1;
  } else {
    updated.wickets -= 1;
    updated.balls -= 1;
  }

  updateMatch(updated);
}

// INIT
loadMatch();