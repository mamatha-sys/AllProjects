// Candidate <-> requirement matching, modelled on the reference prototype's
// computeMatch()/matchingCandidatesFor(): a 0-100 score built from must-have
// skill overlap, department/title keywords and years of experience, with the
// reasons and gaps that produced it so a recruiter can see why.

const MATCH_THRESHOLD = 70;

function splitList(value) {
  return String(value || '')
    .split(/[,;/|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function parseExperienceRange(value) {
  const range = String(value || '').match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (range) return { lo: Number(range[1]), hi: Number(range[2]) };
  const single = String(value || '').match(/(\d+(?:\.\d+)?)/);
  if (single) return { lo: Number(single[1]), hi: Number(single[1]) + 3 };
  return null;
}

function computeMatch(candidate, requirement) {
  const reasons = [];
  const gaps = [];

  // 1. Must-have skills — the heaviest signal (60% of the score).
  const required = splitList(requirement.skills);
  const candidateSkills = splitList(candidate.skills);
  let skillPct = 0.6; // neutral when the requirement lists no skills yet
  if (required.length) {
    const matched = required.filter((s) => candidateSkills.some((cs) => cs.includes(s) || s.includes(cs)));
    const missing = required.filter((s) => !matched.includes(s));
    skillPct = matched.length / required.length;
    if (matched.length) reasons.push(`Matches ${matched.length} of ${required.length} required skill(s): ${matched.join(', ')}`);
    if (missing.length) gaps.push(`Missing skill(s): ${missing.join(', ')}`);
  } else if (candidateSkills.length) {
    reasons.push('Requirement lists no must-have skills — scored on title and experience only');
  }

  // 2. Title / department keyword overlap (20%).
  const keywords = `${requirement.title} ${requirement.department || ''}`
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);
  const haystack = `${candidate.skills || ''} ${candidate.source || ''}`.toLowerCase();
  const hits = keywords.filter((kw) => haystack.includes(kw));
  const keywordPct = keywords.length ? hits.length / keywords.length : 0.5;
  if (hits.length) reasons.push(`Profile mentions ${hits.join(', ')}`);

  // 3. Years of experience (20%).
  let expPct = 0.6;
  const range = parseExperienceRange(requirement.experience);
  const years = Number(candidate.experienceYears);
  if (range && Number.isFinite(years) && years > 0) {
    if (years >= range.lo && years <= range.hi) {
      expPct = 1;
      reasons.push(`${years} yrs is inside the required ${range.lo}-${range.hi} yrs`);
    } else if (years > range.hi) {
      expPct = 0.75;
      gaps.push(`Over-qualified — ${years} yrs against a ${range.lo}-${range.hi} yrs requirement`);
    } else {
      expPct = Math.max(0.2, years / range.lo);
      gaps.push(`${years} yrs is below the required ${range.lo}-${range.hi} yrs`);
    }
  } else if (range) {
    gaps.push('Years of experience not on file');
  }

  const overall = Math.round((skillPct * 0.6 + keywordPct * 0.2 + expPct * 0.2) * 100);
  return { overall, reasons, gaps };
}

// Ranked list of candidates not already in this requirement's pipeline.
function rankCandidates(candidates, requirement, { excludeIds = new Set(), threshold = MATCH_THRESHOLD } = {}) {
  return candidates
    .filter((c) => !excludeIds.has(c.id))
    .map((c) => ({ ...c, match: computeMatch(c, requirement) }))
    .filter((c) => c.match.overall >= threshold)
    .sort((a, b) => b.match.overall - a.match.overall);
}

module.exports = { MATCH_THRESHOLD, computeMatch, rankCandidates };
