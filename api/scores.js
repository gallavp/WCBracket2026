// Vercel serverless function — proxies football-data.org for live World Cup results.
// Required env var: FOOTBALL_API_KEY  (register free at https://www.football-data.org)
// Add it in Vercel: Project Settings → Environment Variables

const NAME_MAP = {
  'Korea Republic':           'South Korea',
  'United States':            'United States',
  'USA':                      'United States',
  'Turkey':                   'Türkiye',
  "Côte d'Ivoire":            'Ivory Coast',
  "Cote d'Ivoire":            'Ivory Coast',
  'IR Iran':                  'Iran',
  'Bosnia and Herzegovina':   'Bosnia-Herzegovina',
  'Bosnia & Herzegovina':     'Bosnia-Herzegovina',
  'Congo DR':                 'DR Congo',
  'Congo, DR':                'DR Congo',
  'Democratic Republic of Congo': 'DR Congo',
  'Republic of Korea':        'South Korea',
  'Czech Republic':           'Czechia',
};

function normName(n) { return NAME_MAP[n] || n; }

function getWinner(match) {
  const { score } = match;
  if (!score) return null;
  if (score.penalties && score.penalties.home != null) {
    return score.penalties.home > score.penalties.away
      ? match.homeTeam.name : match.awayTeam.name;
  }
  if (score.winner === 'HOME_TEAM') return match.homeTeam.name;
  if (score.winner === 'AWAY_TEAM') return match.awayTeam.name;
  return null;
}

module.exports = async function handler(req, res) {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) {
    return res.status(503).json({ error: 'FOOTBALL_API_KEY not configured' });
  }

  const headers = { 'X-Auth-Token': key };
  const BASE = 'https://api.football-data.org/v4/competitions/2000';

  try {
    const [sRes, mRes] = await Promise.all([
      fetch(`${BASE}/standings`, { headers }),
      fetch(`${BASE}/matches`,   { headers }),
    ]);

    if (!sRes.ok) return res.status(502).json({ error: `Standings API error ${sRes.status}` });
    if (!mRes.ok) return res.status(502).json({ error: `Matches API error ${mRes.status}` });

    const sd = await sRes.json();
    const md = await mRes.json();

    const result = {
      groups: {}, thirdPlace: [],
      r32: [], r16: [], qf: [], sf: [],
      champion: '', thirdPlaceWinner: '', topScorer: '',
      groupStandings: {},
      allMatches: [],
      syncedAt: new Date().toISOString(),
    };

    const GMAP = {
      GROUP_A:'A', GROUP_B:'B', GROUP_C:'C', GROUP_D:'D',
      GROUP_E:'E', GROUP_F:'F', GROUP_G:'G', GROUP_H:'H',
      GROUP_I:'I', GROUP_J:'J', GROUP_K:'K', GROUP_L:'L',
    };

    const thirds = [];

    if (sd.standings) {
      for (const standing of sd.standings) {
        if (standing.type !== 'TOTAL') continue;
        const gk = GMAP[standing.group]; if (!gk) continue;
        const t = standing.table;

        // Group winners/runners-up (used for scoring)
        if (t.length >= 2) {
          result.groups[gk] = {
            first:  normName(t[0].team.name),
            second: normName(t[1].team.name),
          };
        }

        // Third-place candidates
        if (t.length >= 3) {
          thirds.push({
            group: gk,
            pts:   t[2].points,
            gd:    t[2].goalDifference,
            gf:    t[2].goalsFor,
          });
        }

        // Full standings table for the Groups view + probability computation
        result.groupStandings[gk] = t.map(entry => ({
          team:   normName(entry.team.name),
          played: entry.playedGames,
          won:    entry.won,
          draw:   entry.draw,
          lost:   entry.lost,
          gd:     entry.goalDifference,
          gf:     entry.goalsFor,
          ga:     entry.goalsAgainst,
          pts:    entry.points,
        }));
      }
    }

    thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    result.thirdPlace = thirds.slice(0, 8).map(t => t.group);

    if (md.matches) {
      // Full schedule for the Schedule tab
      result.allMatches = md.matches.map(m => ({
        id:        m.id,
        utcDate:   m.utcDate,
        status:    m.status,
        minute:    m.minute || null,
        stage:     m.stage,
        group:     m.group || null,
        matchday:  m.matchday || null,
        homeTeam:  normName(m.homeTeam?.name || ''),
        awayTeam:  normName(m.awayTeam?.name || ''),
        homeScore: m.score?.fullTime?.home ?? null,
        awayScore: m.score?.fullTime?.away ?? null,
        venue:     m.venue || null,
      }));

      for (const m of md.matches) {
        if (m.stage === 'GROUP_STAGE' || m.status !== 'FINISHED') continue;
        const winner = getWinner(m);
        if (!winner) continue;
        const wn = normName(winner);
        switch (m.stage) {
          case 'ROUND_OF_32':    result.r32.push(wn); break;
          case 'ROUND_OF_16':    result.r16.push(wn); break;
          case 'QUARTER_FINALS': result.qf.push(wn);  break;
          case 'SEMI_FINALS':    result.sf.push(wn);  break;
          case 'FINAL':          result.champion = wn; break;
          case 'THIRD_PLACE':    result.thirdPlaceWinner = wn; break;
        }
      }
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
