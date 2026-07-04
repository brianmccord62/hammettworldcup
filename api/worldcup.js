const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=500&dates=20260611-20260719";

const GROUPS = {
  "Group A": ["Mexico", "South Africa", "Korea", "Czechia"],
  "Group B": ["Canada", "Qatar", "Switzerland", "Bosnia & Herzegovina"],
  "Group C": ["Brazil", "Morocco", "Scotland", "Haiti"],
  "Group D": ["United States", "Paraguay", "Australia", "Türkiye"],
  "Group E": ["Germany", "Côte d'Ivoire", "Ecuador", "Curaçao"],
  "Group F": ["Netherlands", "Japan", "Tunisia", "Sweden"],
  "Group G": ["Belgium", "Iran", "Egypt", "New Zealand"],
  "Group H": ["Spain", "Saudi Arabia", "Uruguay", "Cabo Verde"],
  "Group I": ["France", "Senegal", "Norway", "Iraq"],
  "Group J": ["Argentina", "Algeria", "Austria", "Jordan"],
  "Group K": ["Portugal", "Colombia", "Uzbekistan", "DR Congo"],
  "Group L": ["England", "Croatia", "Panama", "Ghana"]
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

function teamGroup(team) {
  const key = normalize(team);
  for (const [groupName, teams] of Object.entries(GROUPS)) {
    if (teams.some(t => normalize(t) === key)) return groupName;
  }
  return null;
}

function isGroupStageMatch(match) {
  const d = localDate(match.date);
  if (!d || d > "2026-06-27") return false;

  const hg = teamGroup(match.home);
  const ag = teamGroup(match.away);
  return hg && ag && hg === ag;
}

// IMPORTANT:
// Do not use ESPN status text like "Final" to determine the round.
// "Final" just means the game is over.
// We use the World Cup knockout calendar instead.
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

  // ESPN winner flag handles penalty shootout advancement.
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

function initStandings() {
  const table = {};
  Object.entries(GROUPS).forEach(([groupName, teams]) => {
    teams.forEach(team => {
      table[normalize(team)] = {
        group: groupName,
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0
      };
    });
  });
  return table;
}

function applyMatchToStandings(table, match) {
  if (!isGroupStageMatch(match)) return;

  const homeKey = normalize(match.home);
  const awayKey = normalize(match.away);
  if (!table[homeKey] || !table[awayKey]) return;

  const homeGoals = Number(match.homeScore);
  const awayGoals = Number(match.awayScore);
  if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return;

  const home = table[homeKey];
  const away = table[awayKey];

  home.played += 1;
  away.played += 1;
  home.gf += homeGoals;
  home.ga += awayGoals;
  away.gf += awayGoals;
  away.ga += homeGoals;

  if (homeGoals > awayGoals) {
    home.won += 1;
    home.points += 3;
    away.lost += 1;
  } else if (awayGoals > homeGoals) {
    away.won += 1;
    away.points += 3;
    home.lost += 1;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }

  home.gd = home.gf - home.ga;
  away.gd = away.gf - away.ga;
}

function buildGroups(table) {
  const byGroup = {};
  Object.values(table).forEach(row => {
    if (!byGroup[row.group]) byGroup[row.group] = [];
    byGroup[row.group].push(row);
  });

  return Object.entries(byGroup).map(([name, rows]) => {
    const sorted = rows.sort((a, b) =>
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.team.localeCompare(b.team)
    );

    return {
      name,
      teams: sorted.map((row, idx) => ({
        team: row.team,
        place: idx + 1,
        advancing: idx < 2,
        third: idx === 2,
        record: `${row.won}-${row.drawn}-${row.lost}`,
        groupPoints: row.points,
        gd: row.gd,
        played: row.played
      }))
    };
  });
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

  groups.forEach(group => {
    const groupComplete = group.teams.every(t => t.played >= 3);
    if (!groupComplete) return;
    group.teams.forEach(team => {
      if (team.place === 4) eliminated.push(normalize(team.team));
    });
  });

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

    const table = initStandings();
    matches.filter(m => m.completed).forEach(m => applyMatchToStandings(table, m));

    const groups = buildGroups(table);
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
    return res.status(500).json({
      updatedAt: new Date().toISOString(),
      error: error.message,
      matches: [],
      groups: [],
      eliminated: [],
      knockoutPointsByTeam: {},
      knockoutDetails: []
    });
  }
}
