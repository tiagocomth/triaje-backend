/**
 * Deterministic, keyword-based fallback provider.
 *
 * It does NOT use an LLM — it exists so the whole pipeline runs and every
 * endpoint is testable when neither Ollama nor Groq is available. Results are
 * plausible but obviously not as good as a real model. Keep it last in
 * AI_PROVIDER_CHAIN; remove it there to force a real provider.
 */

// Common tech/role skills we know how to look for, with default importance.
const SKILL_LIBRARY = [
  { name: 'Python', aliases: ['python', 'django', 'flask', 'fastapi'], base: 5 },
  { name: 'JavaScript', aliases: ['javascript', 'js', 'node', 'nodejs', 'node.js'], base: 4 },
  { name: 'TypeScript', aliases: ['typescript', 'ts'], base: 4 },
  { name: 'React', aliases: ['react', 'react.js', 'reactjs'], base: 4 },
  { name: 'PostgreSQL', aliases: ['postgres', 'postgresql', 'psql'], base: 4 },
  { name: 'SQL', aliases: ['sql', 'mysql', 'sqlite'], base: 3 },
  { name: 'AWS', aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'ecs'], base: 4 },
  { name: 'Docker', aliases: ['docker', 'container', 'kubernetes', 'k8s'], base: 3 },
  { name: 'Go', aliases: ['golang', ' go '], base: 4 },
  { name: 'Java', aliases: ['java', 'spring'], base: 4 },
  { name: 'Leadership', aliases: ['leadership', 'lead', 'mentor', 'manage', 'team lead'], base: 3 },
  { name: 'English', aliases: ['english', 'fluent', 'c1', 'c2'], base: 2 },
  { name: 'Communication', aliases: ['communication', 'stakeholder', 'collaborat'], base: 2 },
  { name: 'Testing', aliases: ['testing', 'unit test', 'tdd', 'pytest', 'jest'], base: 3 },
];

const countOccurrences = (haystack, needle) =>
  haystack.split(needle).length - 1;

/** Sum alias hits for a skill within some text. */
function skillHits(text, skill) {
  return skill.aliases.reduce((sum, a) => sum + countOccurrences(text, a), 0);
}

function extractCriteria(jobDescription) {
  const text = ` ${jobDescription.toLowerCase()} `;
  const emphasised = /required|must have|must-have|strong|senior|expert/;

  const found = [];
  for (const skill of SKILL_LIBRARY) {
    const hits = skillHits(text, skill);
    if (hits === 0) continue;

    // Nudge weight up when the JD emphasises the skill or mentions it a lot.
    let weight = skill.base;
    if (hits >= 3) weight += 1;
    const idx = text.indexOf(skill.aliases[0]);
    const around = text.slice(Math.max(0, idx - 40), idx + 40);
    if (emphasised.test(around)) weight += 1;

    found.push({ name: skill.name, weight: Math.min(5, weight), hits });
  }

  // Most-mentioned first, cap at 8; fall back to a generic set if none matched.
  found.sort((a, b) => b.hits - a.hits || b.weight - a.weight);
  const criteria = found.slice(0, 8).map(({ name, weight }) => ({ name, weight }));

  if (criteria.length === 0) {
    return [
      { name: 'Relevant Experience', weight: 5 },
      { name: 'Technical Skills', weight: 4 },
      { name: 'Communication', weight: 2 },
    ];
  }
  return criteria;
}

/** Guess the candidate's name from the first plausible line of the CV. */
function guessName(cvText) {
  for (const rawLine of cvText.split('\n')) {
    const line = rawLine.trim();
    if (line.length < 3 || line.length > 60) continue;
    if (/@|http|\d{3}/.test(line)) continue; // skip emails/urls/phones
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && /^[A-Za-zÀ-ÿ.'-]+$/.test(words[0])) {
      return line;
    }
  }
  return 'Unknown candidate';
}

/** Guess a job title from common title keywords. */
function guessTitle(cvText) {
  const m = cvText.match(
    /\b((?:senior|junior|lead|principal|staff)?\s*(?:software|backend|frontend|full[- ]?stack|data)?\s*(?:engineer|developer|scientist|architect|manager))\b/i,
  );
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function scoreCandidate({ cvText, criteria }) {
  const text = ` ${cvText.toLowerCase()} `;
  const yearsMatch = text.match(/(\d{1,2})\+?\s*years?/);
  const years = yearsMatch ? Number(yearsMatch[1]) : 0;

  const breakdown = criteria.map((c) => {
    const skill = SKILL_LIBRARY.find(
      (s) => s.name.toLowerCase() === c.name.toLowerCase(),
    );
    const hits = skill ? skillHits(text, skill) : countOccurrences(text, c.name.toLowerCase());

    let score;
    let justification;
    if (hits === 0) {
      score = 25;
      justification = `No clear mention of ${c.name} in the CV.`;
    } else {
      // Base on presence, bump with repetition and overall experience.
      score = Math.min(100, 55 + hits * 12 + Math.min(years, 10) * 2);
      justification = `Found ${hits} mention(s) of ${c.name}${
        years ? ` and ~${years} years of experience` : ''
      }.`;
    }
    return { name: c.name, weight: c.weight, score, justification };
  });

  return { name: guessName(cvText), title: guessTitle(cvText), breakdown };
}

export default {
  name: 'heuristic',
  isAvailable: () => true,
  extractCriteria,
  scoreCandidate,
};
