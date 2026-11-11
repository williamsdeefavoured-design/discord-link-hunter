import {
  DiscoveredInvite,
  LanguageCode,
  RankedInviteResult,
  ScoreBreakdown,
  TradingTopic,
  VerifiedInvite,
} from './types.js';
import { detectLanguageFromText, detectTopicsFromText } from './languages.js';

export function calculateInviteScore(
  invite: VerifiedInvite,
  sources: DiscoveredInvite[],
  requestedTopics: TradingTopic[],
  requestedLanguages: LanguageCode[]
): { score: number; scoreBreakdown: ScoreBreakdown; detectedTopics: TradingTopic[]; detectedLanguage: LanguageCode } {
  const explanations: string[] = [];

  // Combine textual evidence for topic and language detection
  const textCorpus = [
    invite.community?.name || '',
    invite.community?.description || '',
    invite.channelName || '',
    ...sources.map((s) => s.contextSnippet || ''),
  ].join(' ');

  const detectedTopics = detectTopicsFromText(textCorpus);
  const detectedLanguage = detectLanguageFromText(textCorpus);

  // 1. Topic Relevance (max 35 points)
  let topicRelevance = 0;
  const topicOverlap = requestedTopics.filter((t) => detectedTopics.includes(t));
  if (topicOverlap.length > 0) {
    const fraction = Math.min(1, topicOverlap.length / requestedTopics.length);
    topicRelevance = Math.round(20 + 15 * fraction);
    explanations.push(`Matched topics: ${topicOverlap.join(', ')} (+${topicRelevance} pts)`);
  } else if (detectedTopics.length > 0) {
    topicRelevance = 15;
    explanations.push(`Detected other trading topics: ${detectedTopics.join(', ')} (+15 pts)`);
  } else {
    topicRelevance = 5;
    explanations.push('Generic context, minimal trading keyword matches (+5 pts)');
  }

  // 2. Invite Validity (max 20 points, with penalty for expired/invalid)
  let inviteValidity = 0;
  if (invite.status === 'valid') {
    inviteValidity = 20;
    explanations.push('Confirmed active Discord community (+20 pts)');
  } else if (invite.status === 'unknown' || invite.status === 'unavailable') {
    inviteValidity = 5;
    explanations.push(`Verification undetermined (${invite.status}) (+5 pts)`);
  } else if (invite.status === 'rate_limited') {
    inviteValidity = 5;
    explanations.push('Verification rate-limited, pending retry (+5 pts)');
  } else {
    // expired or invalid receives a steep penalty so it never outranks active communities
    inviteValidity = -40;
    explanations.push(`Invite is invalid/expired (${invite.status}) (-40 pts penalty)`);
  }

  // 3. Language Match (max 15 points)
  let languageMatch = 0;
  if (requestedLanguages.includes(detectedLanguage)) {
    languageMatch = 15;
    explanations.push(`Matches target language [${detectedLanguage}] (+15 pts)`);
  } else if (detectedLanguage === 'en') {
    languageMatch = 8;
    explanations.push(`English community matched secondary preference (+8 pts)`);
  } else {
    languageMatch = 4;
    explanations.push(`Language detected as [${detectedLanguage}] (+4 pts)`);
  }

  // 4. Source Credibility / Provenance (max 10 points)
  let sourceCredibility = 0;
  const distinctSources = new Set(sources.map((s) => s.sourceDomain).filter(Boolean));
  if (distinctSources.size >= 2) {
    sourceCredibility = 10;
    explanations.push(`Found across ${distinctSources.size} independent domains (+10 pts)`);
  } else if (distinctSources.size === 1) {
    sourceCredibility = 7;
    explanations.push(`Discovered on ${Array.from(distinctSources)[0]} (+7 pts)`);
  } else {
    sourceCredibility = 5;
    explanations.push('Single discovery source (+5 pts)');
  }

  // 5. Freshness (max 10 points)
  let freshness = 0;
  const lastVerifiedTime = new Date(invite.lastVerifiedAt).getTime();
  const ageHours = (Date.now() - lastVerifiedTime) / (1000 * 60 * 60);
  if (ageHours < 24) {
    freshness = 10;
    explanations.push('Verified within the last 24 hours (+10 pts)');
  } else if (ageHours < 168) {
    freshness = 7;
    explanations.push('Verified within the past week (+7 pts)');
  } else {
    freshness = 4;
    explanations.push('Verified over a week ago (+4 pts)');
  }

  // 6. Activity / Size Signal (max 10 points)
  // Only rewarded when verifiable metadata exists!
  let activitySignal = 0;
  const members = invite.community?.approximateMemberCount;
  const presences = invite.community?.approximatePresenceCount;

  if (members !== null && members !== undefined) {
    if (members >= 5000) {
      activitySignal = 10;
      explanations.push(`Large verified community (${members.toLocaleString()} members) (+10 pts)`);
    } else if (members >= 1000) {
      activitySignal = 8;
      explanations.push(`Medium verified community (${members.toLocaleString()} members) (+8 pts)`);
    } else if (members >= 100) {
      activitySignal = 6;
      explanations.push(`Active community (${members.toLocaleString()} members) (+6 pts)`);
    } else {
      activitySignal = 4;
      explanations.push(`Emerging community (${members.toLocaleString()} members) (+4 pts)`);
    }
  } else {
    // Missing metadata treated conservatively and neutrally: 0 points, no fictional points!
    activitySignal = 0;
    explanations.push('Member counts private or not provided by Discord (+0 pts)');
  }

  const rawTotal = topicRelevance + inviteValidity + languageMatch + sourceCredibility + freshness + activitySignal;
  const total = Math.max(0, Math.min(100, rawTotal));

  const scoreBreakdown: ScoreBreakdown = {
    topicRelevance,
    inviteValidity,
    languageMatch,
    sourceCredibility,
    freshness,
    activitySignal,
    total,
    explanations,
  };

  return {
    score: total,
    scoreBreakdown,
    detectedTopics,
    detectedLanguage,
  };
}

/**
 * Deterministic comparator for ranked invite results.
 * 1. Score descending
 * 2. Active/valid invites ahead of invalid/expired
 * 3. Member count descending (when available)
 * 4. Invite code alphabetical ascending
 */
export function compareRankedResults(a: RankedInviteResult, b: RankedInviteResult): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  const aValid = a.invite.status === 'valid' ? 1 : 0;
  const bValid = b.invite.status === 'valid' ? 1 : 0;
  if (bValid !== aValid) {
    return bValid - aValid;
  }
  const aMembers = a.invite.community?.approximateMemberCount || 0;
  const bMembers = b.invite.community?.approximateMemberCount || 0;
  if (bMembers !== aMembers) {
    return bMembers - aMembers;
  }
  return a.invite.code.localeCompare(b.invite.code);
}

export function rankInviteResults(
  verifiedInvites: { invite: VerifiedInvite; sources: DiscoveredInvite[] }[],
  requestedTopics: TradingTopic[],
  requestedLanguages: LanguageCode[]
): RankedInviteResult[] {
  const ranked = verifiedInvites.map(({ invite, sources }) => {
    const { score, scoreBreakdown, detectedTopics, detectedLanguage } = calculateInviteScore(
      invite,
      sources,
      requestedTopics,
      requestedLanguages
    );

    return {
      invite,
      sources,
      score,
      scoreBreakdown,
      detectedTopics,
      detectedLanguage,
      isVerifiedFact: invite.status === 'valid',
    };
  });

  // Sort deterministically using compareRankedResults
  ranked.sort(compareRankedResults);

  return ranked;
}

