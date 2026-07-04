const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=500&dates=20260611-20260719";

// Final group-stage table/order based on the completed group stage.
// This avoids ESPN table parsing issues and correctly handles best third-place teams.
const GROUP_RESULTS = {
  "Group A": [
    { team: "Mexico", place: 1, advancing: true },
    { team: "South Africa", place: 2, advancing: true },
    { team: "Korea", place: 3, advancing: false },
    { team: "Czechia", place: 4, advancing: false }
  ],
  "Group B": [
    { team: "Switzerland", place: 1, advancing: true },
    { team: "Canada", place: 2, advancing: true },
    { team: "Bosnia & Herzegovina", place: 3, advancing: true, third: true },
    { team: "Qatar", place: 4, advancing: false }
  ],
  "Group C": [
    { team: "Brazil", place: 1, advancing: true },
    { team: "Morocco", place: 2, advancing: true },
    { team: "Scotland", place: 3, advancing: false },
    { team: "Haiti", place: 4, advancing: false }
  ],
  "Group D": [
    { team: "United States", place: 1, advancing: true },
    { team: "Australia", place: 2, advancing: true },
    { team: "Paraguay", place: 3, advancing: true, third: true },
    { team: "Türkiye", place: 4, advancing: false }
  ],
  "Group E": [
    { team: "Germany", place: 1, advancing: true },
    { team: "Côte d'Ivoire", place: 2, advancing: true },
    { team: "Ecuador", place: 3, advancing: true, third: true },
    { team: "Curaçao", place: 4, advancing: false }
  ],
  "Group F": [
    { team: "Netherlands", place: 1, advancing: true },
    { team: "Japan", place: 2, advancing: true },
    { team: "Sweden", place: 3, advancing: true, third: true },
    { team: "Tunisia", place: 4, advancing: false }
  ],
  "Group G": [
    { team: "Belgium", place: 1, advancing: true },
    { team: "Egypt", place: 2, advancing: true },
    { team: "Iran", place: 3, advancing: false },
    { team: "New Zealand", place: 4, advancing: false }
  ],
  "Group H": [
    { team: "Spain", place: 1, advancing: true },
    { team: "Cabo Verde", place: 2, advancing: true },
    { team: "Uruguay", place: 3, advancing: false },
    { team: "Saudi Arabia", place: 4, advancing: false }
  ],
  "Group I": [
    { team: "France", place: 1, advancing: true },
    { team: "Norway", place: 2, advancing: true },
    { team: "Senegal", place: 3, advancing: true, third: true },
    { team: "Iraq", place: 4, advancing: false }
  ],
  "Group J": [
    { team: "Argentina", place: 1, advancing: true },
    { team: "Austria", place: 2, advancing: true },
    { team: "Algeria", place: 3, advancing: true, third: true },
    { team: "Jordan", place: 4, advancing: false }
  ],
  "Group K": [
    { team: "Colombia", place: 1, advancing: true },
    { team: "Portugal", place: 2, advancing: true },
    { team: "DR Congo", place: 3, advancing: true, third: true },
    { team: "Uzbekistan", place: 4, advancing: false }
  ],
  "Group L": [
    { team: "England", place: 1, advancing: true },
    { team: "Croatia", place: 2, advancing: true },
    { team: "Ghana", place: 3, advancing: true, third: true },
    { team: "Panama", place: 4, advancing: false }
  ]
};

const ALIASES = {
  "USA": "United States",
  "United States of America": "United States",
  "South Korea": "Korea",
  "Korea Republic": "Korea",
  "Czech Republic": "Czechia",
  "Cape Verde": "Cabo Verde",
  "Cape Verde Islands": "Cabo Verde",
  "Curacao": "Curaçao",
  "Turkey": "Türkiye",
  "Ivory Coast": "Côte d'Ivoire",
  "Congo DR": "DR Congo",
  "Democratic Republic of Congo": "DR Congo",
  "Bosnia and Herzegovina": "Bosnia & Herzegovina"
};

function cleanName(name = "") {
  return ALIASES[name] || name;
}

function normalize(name = "") {
  return cleanName(String(name))
    .replace(/\bUSA\b/i, "United States")
    .replace(/\bUnited States of America\b/i, "United States")
    .replace(/\bSouth Korea\b/i, "Korea")
    .replace(/\bKorea Republic\b/i, "Korea")
    .replace(/\bCzech Republic\b/i, "Czechia")
    .replace(/\bCape Verde\b/i, "Cabo Verde")
    .replace(/\bCuracao\b/i, "Curaçao")
    .replace(/\bTurkey\b/i, "Türkiye")
    .replace(/\bIvory Coast\b/i, "Côte d'Ivoire")
    .replace(/\bCongo DR\b/i, "DR Congo")
    .replace(/\bBosnia and Herzegovina\b/i, "Bosnia & Herzegovina")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getTeamDisplayName(raw) {
  if (!raw) return "";
  return cleanName(raw.displayName || raw.shortDisplayName || raw.name || raw.abbreviation || "");
}

function isFinalCompetition(comp) {
  return comp?.status?.type?.completed === true || comp?.status?.type?.state === "post";
}

function localDate(dateString) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

function knockoutRoundInfo(match) {
  const d = localDate(match.date);
  if (!d) return null;

  if (d >= "2026-06-28" && d <= "2026-07-03") return { points: 2, label: "Round of 32" };
  if (d >= "2026-07-04" && d <= "2026-07-07") return { points: 3, label: "Round of 16" };
  if (d >= "2026-07-09" && d <= "2026-07-11") return { points: 4, label: "Quarterfinal" };
  if (d >= "2026-07-14" && d <= "2026-07-15") return { points: 5, label: "Semifinal" };
  if (d === "2026-07-18") return { points: 5, label: "3rd Place" };
  if (d === "2026-07-19") return { points: 8, label: "World Cup Final" };

  return null;
}

function getWinner(match) {
  if (!match.completed) return null;

  if (match.homeWinner) return match.home;
  if (match.awayWinner) return match.away;

  const hs = Number(match.homeScore);
  const as = Number(match.awayScore);

  if (Number.isFinite(hs) && Number.isFinite(as)) {
    if (hs > as) return match.home;
    if (as > hs) return match.away;
  }

  return null;
}

function buildGroups() {
  return Object.entries(GROUP_RESULTS).map(([name, teams]) => ({
    name,
    teams: teams.map(row => ({
      ...row,
      record: "",
      groupPoints: null,
      gd: null,
      played: 3
    }))
  }));
}

function buildKnockoutPoints(matches) {
  const points = {};
  const details = [];

  matches.forEach(match => {
    if (!match.completed) return;

    const round = knockoutRoundInfo(match);
    if (!round) return;

    const winner = getWinner(match);
    if (!winner) return;

    const key = normalize(winner);
    points[key] = (points[key] || 0) + round.points;

    details.push({
      team: winner,
      teamKey: key,
      points: round.points,
      round: round.label,
      match: `${match.home} vs ${match.away}`,
      eventId: match.id,
      date: match.date
    });
  });

  return { points, details };
}

function buildEliminated(groups, matches) {
  const eliminated = [];

  // Group-stage eliminated teams.
  groups.forEach(group => {
    group.teams.forEach(team => {
      if (!team.advancing) eliminated.push(normalize(team.team));
    });
  });

  // Knockout-stage losing teams.
  matches.forEach(match => {
    if (!match.completed) return;

    const round = knockoutRoundInfo(match);
    if (!round) return;

    const winner = getWinner(match);
    if (!winner) return;

    const loser = normalize(winner) === normalize(match.home) ? match.away : match.home;
    if (loser) eliminated.push(normalize(loser));
  });

  return [...new Set(eliminated)];
}

export default async function handler(req, res) {
  try {
    const response = await fetch(ESPN_SCOREBOARD, {
      headers: { "User-Agent": "Mozilla/5.0 HammettWorldCup/1.0" }
    });

    if (!response.ok) throw new Error(`ESPN returned ${response.status}`);

    const data = await response.json();
    const events = data.events || [];

    const matches = events.map(event => {
      const comp = event.competitions?.[0];
      const competitors = comp?.competitors || [];
      const home = competitors.find(c => c.homeAway === "home");
      const away = competitors.find(c => c.homeAway === "away");

      return {
        id: event.id,
        name: event.name || "",
        shortName: event.shortName || "",
        date: event.date,
        status: comp?.status?.type?.description || event.status?.type?.description || "Scheduled",
        completed: isFinalCompetition(comp),
        home: getTeamDisplayName(home?.team),
        away: getTeamDisplayName(away?.team),
        homeScore: home?.score ?? null,
        awayScore: away?.score ?? null,
        homeWinner: home?.winner === true,
        awayWinner: away?.winner === true
      };
    }).filter(m => m.home && m.away);

    const groups = buildGroups();
    const knockout = buildKnockoutPoints(matches);
    const eliminated = buildEliminated(groups, matches);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: ESPN_SCOREBOARD,
      matches,
      groups,
      eliminated,
      knockoutPointsByTeam: knockout.points,
      knockoutDetails: knockout.details
    });
  } catch (error) {
    const groups = buildGroups();
    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      error: error.message,
      matches: [],
      groups,
      eliminated: buildEliminated(groups, []),
      knockoutPointsByTeam: {},
      knockoutDetails: []
    });
  }
}
