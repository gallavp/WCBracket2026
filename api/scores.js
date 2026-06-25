// Vercel serverless function — proxies football-data.org for live World Cup results.
// Required env var: FOOTBALL_API_KEY  (register free at https://www.football-data.org)
// Add it in Vercel: Project Settings → Environment Variables

const NAME_MAP = {
  'Korea Republic':                'South Korea',
  'United States':                 'United States',
  'USA':                           'United States',
  'Turkey':                        'Türkiye',
  "Côte d'Ivoire":                 'Ivory Coast',
  "Cote d'Ivoire":                 'Ivory Coast',
  'IR Iran':                       'Iran',
  'Bosnia and Herzegovina':        'Bosnia-Herzegovina',
  'Bosnia & Herzegovina':          'Bosnia-Herzegovina',
  'Congo DR':                      'DR Congo',
  'Congo, DR':                     'DR Congo',
  'Democratic Republic of Congo':  'DR Congo',
  'Republic of Korea':             'South Korea',
  'Czech Republic':                'Czechia',
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
    const [mRes, scRes] = await Promise.all([
      fetch(`${BASE}/matches`,          { headers }),
      fetch(`${BASE}/scorers?limit=100`, { headers }).catch(() => null),
    ]);

    if (!mRes.ok) return res.status(502).json({ error: `Matches API error ${mRes.status}` });

    const md    = await mRes.json();
    const scData = (scRes && scRes.ok) ? await scRes.json().catch(() => null) : null;

    const result = {
      groups: {}, thirdPlace: [],
      r32: [], r16: [], qf: [], sf: [],
      champion: '', thirdPlaceWinner: '',
      groupStandings: {},
      allMatches: [],
      syncedAt: new Date().toISOString(),
    };

    const GMAP = {
      GROUP_A:'A', GROUP_B:'B', GROUP_C:'C', GROUP_D:'D',
      GROUP_E:'E', GROUP_F:'F', GROUP_G:'G', GROUP_H:'H',
      GROUP_I:'I', GROUP_J:'J', GROUP_K:'K', GROUP_L:'L',
    };

    // ── Build group standings from individual match results ──────────────────
    // This avoids depending on the /standings endpoint, which often only
    // activates after all group-stage matches are complete.
    const groupMatchCount = {};  // gk -> total scheduled matches
    const groupTable      = {};  // gk -> { teamName -> row }

    for (const m of (md.matches || [])) {
      if (m.stage !== 'GROUP_STAGE') continue;
      const gk = GMAP[m.group]; if (!gk) continue;

      groupMatchCount[gk] = (groupMatchCount[gk] || 0) + 1;

      const h = normName(m.homeTeam?.name || '');
      const a = normName(m.awayTeam?.name || '');
      if (!groupTable[gk]) groupTable[gk] = {};
      if (h && !groupTable[gk][h]) groupTable[gk][h] = {team:h,played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0};
      if (a && !groupTable[gk][a]) groupTable[gk][a] = {team:a,played:0,won:0,draw:0,lost:0,gf:0,ga:0,pts:0};

      if (m.status === 'FINISHED') {
        const hg = m.score?.fullTime?.home ?? 0;
        const ag = m.score?.fullTime?.away ?? 0;
        const ht = groupTable[gk][h];
        const at = groupTable[gk][a];
        ht.played++; at.played++;
        ht.gf += hg; ht.ga += ag;
        at.gf += ag; at.ga += hg;
        if      (hg > ag) { ht.won++; ht.pts += 3; at.lost++; }
        else if (hg < ag) { at.won++; at.pts += 3; ht.lost++; }
        else              { ht.draw++; ht.pts++;    at.draw++; at.pts++; }
      }
    }

    const thirds = [];

    for (const [gk, teams] of Object.entries(groupTable)) {
      const rows = Object.values(teams).sort((a, b) =>
        b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
      );

      // Full standings table for the Groups tab
      result.groupStandings[gk] = rows.map(r => ({
        team: r.team, played: r.played, won: r.won, draw: r.draw, lost: r.lost,
        gd: r.gf - r.ga, gf: r.gf, ga: r.ga, pts: r.pts,
      }));

      // Third-place candidate (3rd-ranked team in each group)
      if (rows.length >= 3) {
        thirds.push({ group: gk, pts: rows[2].pts, gd: rows[2].gf - rows[2].ga, gf: rows[2].gf });
      }

      // Finalise 1st/2nd only when every match in the group is finished
      const finishedCount = Object.values(teams).reduce((s, t) => s + t.played, 0) / 2;
      const totalMatches  = groupMatchCount[gk] || 6;
      if (finishedCount === totalMatches && rows.length >= 2) {
        result.groups[gk] = { first: rows[0].team, second: rows[1].team };
      }
    }

    thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    result.thirdPlace = thirds.slice(0, 8).map(t => t.group);

    // ── Full match list (Schedule tab) + knockout results ───────────────────
    result.allMatches = (md.matches || []).map(m => ({
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

    for (const m of (md.matches || [])) {
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

    // ── Top scorers (Golden Boot tab) ────────────────────────────────────────
    result.topScorers = (scData?.scorers || []).map(s => ({
      name:    s.player?.name || '',
      team:    s.team?.name   || '',
      goals:   s.goals        ?? 0,
      assists: s.assists       ?? 0,
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
