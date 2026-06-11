const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=500&dates=20260611-20260719";

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

function normalize(name = "") {
  return String(name)
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
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function cleanName(name = "") {
  const aliases = {
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
    "Congo DR": "DR Congo"
  };
  return aliases[name] || name;
}

function getTeamDisplayName(raw) {
  if (!raw) return "";
  return cleanName(raw.displayName || raw.shortDisplayName || raw.name || raw.abbreviation || "");
}

function isFinalCompetition(comp) {
  return comp?.status?.type?.completed === true || comp?.status?.type?.state === "post";
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
    home.won += 1; home.points += 3;
    away.lost += 1;
  } else if (awayGoals > homeGoals) {
    away.won += 1; away.points += 3;
    home.lost += 1;
  } else {
    home.drawn += 1; away.drawn += 1;
    home.points += 1; away.points += 1;
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

function buildEliminated(groups) {
  // Do NOT fade anyone out early.
  // Only eliminate 4th-place teams after every team in that group has played 3 matches.
  // Third-place best-8 advancement can be added after group play is complete.
  const eliminated = [];
  groups.forEach(group => {
    const groupComplete = group.teams.every(t => t.played >= 3);
    if (!groupComplete) return;
    group.teams.forEach(team => {
      if (team.place === 4) eliminated.push(normalize(team.team));
    });
  });
  return eliminated;
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
        date: event.date,
        status: comp?.status?.type?.description || event.status?.type?.description || "Scheduled",
        completed: isFinalCompetition(comp),
        home: getTeamDisplayName(home?.team),
        away: getTeamDisplayName(away?.team),
        homeScore: home?.score ?? null,
        awayScore: away?.score ?? null
      };
    }).filter(m => m.home && m.away);

    const table = initStandings();
    matches.filter(m => m.completed).forEach(m => applyMatchToStandings(table, m));

    const groups = buildGroups(table);
    const eliminated = buildEliminated(groups);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: ESPN_SCOREBOARD,
      matches,
      groups,
      eliminated,
      knockoutPointsByTeam: {}
    });
  } catch (error) {
    return res.status(500).json({
      updatedAt: new Date().toISOString(),
      error: error.message,
      matches: [],
      groups: [],
      eliminated: [],
      knockoutPointsByTeam: {}
    });
  }
}
