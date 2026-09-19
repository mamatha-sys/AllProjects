// Candidate <-> requirement matching, ported from the reference prototype's
// computeMatch() (line 1464) and matchingCandidatesFor() (line 6390).
//
// The prototype scores 14 signals and combines 12 weighted components. An
// earlier version of this file used an invented 60% skills / 20% keywords /
// 20% experience formula; that has been replaced, because the prototype is the
// specification. The weights below are the prototype's W object verbatim.

const MATCH_THRESHOLD = 70; // prototype MATCH_THRESHOLD (line 6383)
// Requirement and candidate detail screens list *suggestions* down to 50%.
const SUGGESTION_THRESHOLD = 50;

// Prototype weights, verbatim (line 1592). They sum to 1.00.
const WEIGHTS = {
  mand: 0.28,
  good: 0.07,
  exp: 0.12,
  relev: 0.08,
  edu: 0.07,
  loc: 0.1,
  mode: 0.05,
  emp: 0.04,
  sal: 0.09,
  notice: 0.06,
  jp: 0.02,
  avail: 0.02,
};

const lc = (v) => String(v == null ? '' : v).toLowerCase();

function splitList(value) {
  return String(value || '')
    .split(/[,;|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Straight-line distances between the cities the prototype operates in, used
// for its nearby-city fallback (locationProximity).
const CITY_DISTANCES_KM = {
  'hyderabad|bengaluru': 570,
  'hyderabad|pune': 560,
  'bengaluru|pune': 840,
  'hyderabad|warangal': 145,
  'hyderabad|vijayawada': 275,
  'bengaluru|mysuru': 145,
  'pune|mumbai': 150,
};

function locationProximity(fromCity, toCity) {
  const a = lc(fromCity).trim();
  const b = lc(toCity).trim();
  if (!a || !b) return null;
  if (a === b) return { km: 0, band: 'same city' };
  const km = CITY_DISTANCES_KM[[a, b].sort().join('|')];
  if (km == null) return null;
  const band = km <= 25 ? 'same metro' : km <= 100 ? 'nearby' : km <= 200 ? 'regional' : 'far';
  return { km, band };
}

// "₹14L - ₹20L" -> { lo: 14, hi: 20 }
function reqSalaryRange(requirement) {
  const nums = String(requirement.salary || '').match(/(\d+(?:\.\d+)?)/g);
  if (!nums || nums.length < 2) return null;
  return { lo: Number(nums[0]), hi: Number(nums[1]) };
}

function parseSalary(value) {
  const m = String(value || '').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function noticeDays(value) {
  const s = lc(value);
  if (!s) return null;
  if (s.includes('immediate')) return 0;
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function joiningDays(value) {
  const s = lc(value);
  if (!s) return 30;
  if (s.includes('immediate')) return 0;
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : 30;
}

function parseExperienceRange(value) {
  const range = String(value || '').match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (range) return { lo: Number(range[1]), hi: Number(range[2]) };
  return null;
}

function computeMatch(candidate, requirement) {
  const reasons = []; // why it matched
  const gaps = []; // what reduced the score

  const candSkills = splitList(candidate.skills);

  /* 1. Mandatory skills (heaviest single signal) */
  const mand = splitList(requirement.skills);
  const mandMatched = mand.filter((s) => candSkills.includes(s));
  const mandMissing = mand.filter((s) => !candSkills.includes(s));
  const mandPct = mand.length ? mandMatched.length / mand.length : 0.6;
  if (mandMatched.length) {
    reasons.push(`Matches ${mandMatched.length} of ${mand.length} mandatory skill(s): ${mandMatched.join(', ')}`);
  }
  if (mandMissing.length) gaps.push(`Missing mandatory skill(s): ${mandMissing.join(', ')}`);

  /* 2. Good-to-have skills (lighter) */
  const good = splitList(requirement.goodToHaveSkills);
  const goodMatched = good.filter((s) => candSkills.includes(s));
  const goodPct = good.length ? goodMatched.length / good.length : 0.5;
  if (goodMatched.length) {
    reasons.push(`Also has ${goodMatched.length} good-to-have skill(s): ${goodMatched.join(', ')}`);
  } else if (good.length) {
    gaps.push(`No good-to-have skills matched (${good.join(', ')})`);
  }

  /* 3. Total experience */
  let expPct = 0.6;
  let expReason = `Required ${requirement.experience}; candidate experience not on file`;
  const totalExp = Number(candidate.experienceYears) || 0;
  const range = parseExperienceRange(requirement.experience);
  if (range) {
    const { lo, hi } = range;
    if (totalExp >= lo && totalExp <= hi) {
      expPct = 1;
      expReason = `${totalExp} yrs is inside the required ${requirement.experience}`;
      reasons.push(expReason);
    } else if (totalExp > hi) {
      expPct = 0.75;
      expReason = `${totalExp} yrs is above the required ${requirement.experience}`;
      gaps.push('Over-qualified on total experience');
    } else if (totalExp > 0) {
      expPct = Math.max(0.2, totalExp / lo);
      expReason = `${totalExp} yrs is below the required ${requirement.experience}`;
      gaps.push(expReason);
    }
  }

  /* 4. Relevant experience */
  const relev = Number(candidate.relevantExperienceYears);
  let relevPct = 0.6;
  let relevReason = 'Relevant experience not on file';
  if (Number.isFinite(relev) && range) {
    const { lo } = range;
    if (relev >= lo) {
      relevPct = 1;
      relevReason = `${relev} yrs relevant experience meets the ${lo}+ yr bar`;
      reasons.push(relevReason);
    } else {
      relevPct = Math.max(0.2, relev / lo);
      relevReason = `${relev} yrs relevant vs ${lo} yrs required`;
      gaps.push(relevReason);
    }
  }

  /* 5. Education */
  let eduPct = 0.5;
  let eduReason = 'Education not on file';
  if (candidate.education) {
    const need = lc(requirement.education);
    if (!need || need === '—' || need === 'any degree') {
      eduPct = 0.85;
      eduReason = `Education on file: ${candidate.education}`;
    } else if (lc(candidate.education).includes(need.split(',')[0].trim())) {
      eduPct = 1;
      eduReason = `Education matches (${requirement.education})`;
      reasons.push(eduReason);
    } else {
      eduPct = 0.6;
      eduReason = `Education is ${candidate.education}; role asks for ${requirement.education}`;
      gaps.push(eduReason);
    }
  } else {
    gaps.push('No education on file');
  }

  /* 6/7. Current + preferred location */
  let locPct = 0.5;
  let locReason = 'Location preference not on file';
  let locKm = null;
  let locBand = null;
  const pref = lc(candidate.preferredLocation);
  const curr = lc(candidate.location);
  const reqLoc = lc(requirement.location);
  if (requirement.workMode === 'Remote') {
    locPct = 1;
    locReason = 'Remote role — no location constraint';
    reasons.push(locReason);
  } else if (pref && reqLoc && pref.includes(reqLoc)) {
    locPct = 1;
    locReason = `Preferred location matches ${requirement.location}`;
    reasons.push(locReason);
  } else if (curr && reqLoc && curr.includes(reqLoc)) {
    locPct = 0.9;
    locReason = `Currently in ${requirement.location}`;
    reasons.push(locReason);
  } else {
    const pNear = locationProximity(candidate.preferredLocation, requirement.location);
    const cNear = locationProximity(candidate.location, requirement.location);
    const best = [pNear, cNear].filter(Boolean).sort((x, y) => x.km - y.km)[0];
    if (best) {
      const fromCity = pNear && best === pNear ? candidate.preferredLocation : candidate.location;
      locKm = best.km;
      locBand = best.band;
      if (best.km <= 25) {
        locPct = 0.95;
        locReason = `${fromCity} is ${best.km} km from ${requirement.location} (${best.band})`;
        reasons.push(locReason);
      } else if (best.km <= 50) {
        locPct = 0.85;
        locReason = `${fromCity} is ${best.km} km from ${requirement.location} (${best.band})`;
        reasons.push(locReason);
      } else if (best.km <= 100) {
        locPct = 0.7;
        locReason = `${fromCity} is ${best.km} km from ${requirement.location} (${best.band}) — commutable with relocation`;
        reasons.push(locReason);
      } else if (best.km <= 200) {
        locPct = 0.5;
        locReason = `${fromCity} is ${best.km} km from ${requirement.location} (${best.band}) — relocation needed`;
        gaps.push(locReason);
      } else {
        locPct = 0.3;
        locReason = `${fromCity} is ${best.km} km from ${requirement.location} — outside the nearby radius`;
        gaps.push(locReason);
      }
    } else if (pref || curr) {
      locPct = 0.4;
      locReason = `Candidate in ${candidate.location || '—'} (prefers ${candidate.preferredLocation || '—'}); role is in ${requirement.location}`;
      gaps.push(locReason);
    }
  }

  /* 8. Work mode */
  let modePct = 0.7;
  let modeReason = 'No work-mode preference on file';
  if (candidate.preferredWorkMode) {
    if (lc(candidate.preferredWorkMode) === lc(requirement.workMode)) {
      modePct = 1;
      modeReason = `Work mode matches (${requirement.workMode})`;
      reasons.push(modeReason);
    } else {
      modePct = 0.45;
      modeReason = `Prefers ${candidate.preferredWorkMode}; role is ${requirement.workMode}`;
      gaps.push(modeReason);
    }
  }

  /* 9. Employment type */
  let empPct = 0.7;
  let empReason = 'No employment-type preference on file';
  if (candidate.preferredEmploymentType && requirement.employmentType) {
    if (lc(candidate.preferredEmploymentType) === lc(requirement.employmentType)) {
      empPct = 1;
      empReason = `Employment type matches (${requirement.employmentType})`;
      reasons.push(empReason);
    } else {
      empPct = 0.5;
      empReason = `Prefers ${candidate.preferredEmploymentType}; role is ${requirement.employmentType}`;
      gaps.push(empReason);
    }
  }

  /* 10/11. Current + expected salary against the band */
  let salPct = 0.6;
  let salReason = 'Salary expectation not on file';
  const band = reqSalaryRange(requirement);
  const expSal = parseSalary(candidate.expectedSalary);
  const curSal = parseSalary(candidate.currentSalary);
  if (band && expSal != null) {
    if (expSal >= band.lo && expSal <= band.hi) {
      salPct = 1;
      salReason = `Expected ₹${expSal}L sits inside the ${requirement.salary} band`;
      reasons.push(salReason);
    } else if (expSal < band.lo) {
      salPct = 0.9;
      salReason = `Expected ₹${expSal}L is below the band (${requirement.salary})`;
    } else {
      salPct = Math.max(0.2, band.hi / expSal);
      salReason = `Expected ₹${expSal}L exceeds the ${requirement.salary} band`;
      gaps.push(salReason);
    }
  } else if (band && curSal != null) {
    salPct = curSal <= band.hi ? 0.8 : 0.4;
    salReason = `Current ₹${curSal}L vs band ${requirement.salary}`;
    if (curSal > band.hi) gaps.push(salReason);
  }

  /* 12. Notice period vs joining timeline */
  let notPct = 0.7;
  let notReason = 'Notice period not on file';
  const nd = noticeDays(candidate.noticePeriod);
  const jd = joiningDays(requirement.joiningTimeline);
  if (nd != null) {
    if (nd <= jd) {
      notPct = 1;
      notReason = `${candidate.noticePeriod} fits the ${requirement.joiningTimeline || 'joining'} timeline`;
      reasons.push(notReason);
    } else {
      notPct = Math.max(0.25, jd / Math.max(nd, 1));
      notReason = `${candidate.noticePeriod} is longer than the ${requirement.joiningTimeline || 'required'} timeline`;
      gaps.push(notReason);
    }
  }

  /* 13. Job preference */
  let jpPct = 0.7;
  let jpReason = 'No job preference on file';
  if (candidate.jobPreference && requirement.jobPreference) {
    const cp = splitList(candidate.jobPreference);
    const rp = splitList(requirement.jobPreference);
    const hit = cp.some((x) => rp.includes(x));
    jpPct = hit ? 1 : 0.5;
    jpReason = hit
      ? `Job preference matches (${requirement.jobPreference})`
      : `Prefers ${candidate.jobPreference}; role is ${requirement.jobPreference}`;
    (hit ? reasons : gaps).push(jpReason);
  }

  /* 14. Availability */
  let availPct = 0.8;
  let availReason = 'Availability not stated';
  if (candidate.availability) {
    const ok = !lc(candidate.availability).includes('not');
    availPct = ok ? 1 : 0.4;
    availReason = `Availability: ${candidate.availability}`;
    (ok ? reasons : gaps).push(availReason);
  }

  const W = WEIGHTS;
  const overall = Math.round(
    (mandPct * W.mand +
      goodPct * W.good +
      expPct * W.exp +
      relevPct * W.relev +
      eduPct * W.edu +
      locPct * W.loc +
      modePct * W.mode +
      empPct * W.emp +
      salPct * W.sal +
      notPct * W.notice +
      jpPct * W.jp +
      availPct * W.avail) *
      100
  );

  return {
    overall,
    reasons,
    gaps,
    matchedSkills: mandMatched,
    missingSkills: mandMissing,
    goodMatched,
    goodMissing: good.filter((s) => !candSkills.includes(s)),
    skillsPct: Math.round(mandPct * 100),
    goodPct: Math.round(goodPct * 100),
    expPct: Math.round(expPct * 100),
    expReason,
    relevPct: Math.round(relevPct * 100),
    relevReason,
    eduPct: Math.round(eduPct * 100),
    eduReason,
    locPct: Math.round(locPct * 100),
    locReason,
    locKm,
    locBand,
    modePct: Math.round(modePct * 100),
    modeReason,
    empPct: Math.round(empPct * 100),
    empReason,
    salPct: Math.round(salPct * 100),
    salReason,
    notPct: Math.round(notPct * 100),
    notReason,
    jpPct: Math.round(jpPct * 100),
    jpReason,
    availPct: Math.round(availPct * 100),
    availReason,
  };
}

// Ranked list of candidates not already in this requirement's pipeline.
function rankCandidates(candidates, requirement, { excludeIds = new Set(), threshold = MATCH_THRESHOLD } = {}) {
  return candidates
    .filter((c) => !excludeIds.has(c.id))
    .map((c) => ({ ...c, match: computeMatch(c, requirement) }))
    .filter((c) => c.match.overall >= threshold)
    .sort((a, b) => b.match.overall - a.match.overall);
}

module.exports = { MATCH_THRESHOLD, SUGGESTION_THRESHOLD, WEIGHTS, computeMatch, rankCandidates };
