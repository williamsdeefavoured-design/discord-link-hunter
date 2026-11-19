import {
  CountryEvidence,
  DetectedLanguage,
  DiscoveredInvite,
  LanguageCode,
  RankedInviteResult,
  ScoreBreakdown,
  TradingTopic,
  VerifiedInvite,
} from './types.js';
import {
  detectLanguageEvidence,
  detectTopicsFromText,
  hasGeneralTradingContext,
  hasNonTradingContext,
} from './languages.js';
import { detectCountryEvidence, matchesCountryFilter } from './countries.js';

export function calculateInviteScore(
  invite: VerifiedInvite,
  sources: DiscoveredInvite[],
  requestedTopics: TradingTopic[],
  requestedLanguages: LanguageCode[]
): {
  score: number;
  scoreBreakdown: ScoreBreakdown;
  detectedTopics: TradingTopic[];
  detectedLanguage: DetectedLanguage;
  countryEvidence: CountryEvidence;
} {
  const explanations: string[] = [];

  // Discord server metadata is stronger evidence than search-result snippets:
  // search snippets can contain the user's query without describing the server.
  const serverText = [
    invite.community?.name || '',
    invite.community?.description || '',
    invite.channelName || '',
  ].filter(Boolean).join(' ');
  const sourceText = sources.map((source) => source.contextSnippet || '').filter(Boolean).join(' ');

  const countryEvidence =
    invite.community?.countryEvidence || detectCountryEvidence(invite.community?.description ?? '', invite.canonicalUrl);

  const serverTopics = detectTopicsFromText(serverText);
  const sourceTopics = detectTopicsFromText(sourceText);
  const serverTopicMatches = requestedTopics.filter((topic) => serverTopics.includes(topic));
  const sourceTopicMatches = requestedTopics.filter((topic) => sourceTopics.includes(topic));
  const directTopicMatch = serverTopicMatches.length > 0;

  // Detect misleading source snippets:
  // External search snippets are supporting evidence, not definitive proof of server content.
  // 1. If server metadata indicates non-trading content (e.g. anime, gaming, memes)
  // 2. OR if server metadata explicitly describes non-trading content without market context
  // 3. OR if server metadata has a description but zero trading context
  // then any external snippet mentioning the query topic is treated as uncorroborated / misleading.
  const hasServerContradiction = hasNonTradingContext(serverText);
  const hasServerTradingContext = hasGeneralTradingContext(serverText) || serverTopics.length > 0;
  // A Forex server may also discuss Options or Gold; the presence of a different
  // trading topic is NOT evidence that it never discusses the requested topic.
  // Source-only evidence is deliberately lower-scored and labelled as unconfirmed.
  const hasExplicitDifferentServerTopic =
    !directTopicMatch && serverTopics.length > 0 && Boolean(invite.community?.description);
  const isMisleadingSnippet =
    !directTopicMatch &&
    sourceTopicMatches.length > 0 &&
    (hasServerContradiction || hasExplicitDifferentServerTopic ||
      (!hasServerTradingContext && Boolean(invite.community?.description)));

  const sourceOnlyTopicMatch = !directTopicMatch && sourceTopicMatches.length > 0 && !isMisleadingSnippet;

  const detectedTopics = Array.from(new Set<TradingTopic>([
    ...serverTopics,
    ...(sourceOnlyTopicMatch ? sourceTopicMatches : []),
  ]));

  // 1. Topic relevance (0-35). A source snippet alone cannot prove a match.
  let topicRelevance = 0;
  if (requestedTopics.length === 0) {
    explanations.push('No topic filter requested (+0 pts)');
  } else if (directTopicMatch) {
    const fraction = serverTopicMatches.length / requestedTopics.length;
    topicRelevance = Math.round(20 + 15 * fraction);
    explanations.push(`Server metadata matches requested topic(s): ${serverTopicMatches.join(', ')} (+${topicRelevance} pts)`);
  } else if (sourceOnlyTopicMatch) {
    topicRelevance = 10;
    explanations.push(`Potential topic match: requested topic appears in external snippets, not verified in server metadata (+10 pts)`);
  } else if (isMisleadingSnippet) {
    explanations.push('Requested topic appears only in search snippets; server metadata indicates non-trading or unrelated content (+0 pts)');
  } else {
    explanations.push('Requested topic not found in available evidence (+0 pts)');
  }

  // 2. Invite validity (up to 20). Valid means an active invite, not a safety audit.
  let inviteValidity = 0;
  if (invite.status === 'valid') {
    inviteValidity = 20;
    explanations.push('Discord invite verified as active (+20 pts)');
  } else if (['unknown', 'unavailable', 'rate_limited'].includes(invite.status)) {
    inviteValidity = 0;
    explanations.push(`Invite could not be verified (${invite.status}) (+0 pts)`);
  } else {
    inviteValidity = -40;
    explanations.push(`Invite invalid or expired (${invite.status}) (-40 pts)`);
  }

  // 3. Language relevance (0-15). Never treat an English fallback as evidence.
  // Use community metadata first; external snippets are lower-confidence signals.
  const serverLanguage = detectLanguageEvidence(serverText);
  const sourceLanguage = detectLanguageEvidence(sourceText);
  // A short generic name ("Trading Group") can have weak English hints even
  // when the source post is clearly written in another language. Prefer a high-
  // confidence source classification over medium server boilerplate, but never
  // override high-confidence server evidence with a conflicting source snippet.
  const preferSource =
    sourceLanguage.language !== null &&
    (serverLanguage.language === null ||
      (serverLanguage.confidence !== 'high' && sourceLanguage.confidence === 'high'));
  const languageEvidence = preferSource ? sourceLanguage : serverLanguage;
  const languageFromServer = !preferSource && serverLanguage.language !== null;
  const hasTargetLanguage = requestedLanguages.length > 0;
  const languageKnown = languageEvidence.language !== null;
  const languageMatches = languageKnown && requestedLanguages.includes(languageEvidence.language!);

  let languageMatch = 0;
  if (!hasTargetLanguage) {
    explanations.push('No language filter requested (+0 pts)');
  } else if (!languageKnown) {
    explanations.push('Language cannot be established from available text (+0 pts)');
  } else if (languageMatches && languageFromServer) {
    languageMatch = 15;
    explanations.push(`Server text suggests requested language [${languageEvidence.language}] (${languageEvidence.confidence} confidence) (+15 pts)`);
  } else if (languageMatches) {
    languageMatch = 4;
    explanations.push(`Potential language match: public source snippets suggest [${languageEvidence.language}], not verified in server metadata (+4 pts)`);
  } else {
    explanations.push(`Available text suggests [${languageEvidence.language}], not requested language(s) [${requestedLanguages.join(', ')}] (+0 pts)`);
  }

  // Retain explicit 'unknown' state when evidence is insufficient
  const detectedLanguage: DetectedLanguage = languageEvidence.language ?? 'unknown';

  // 4. Provenance (up to 10). Multiple domains are discovery evidence, not proof
  // that the domains are independent or that their claims are correct.
  const sourceDomains = new Set(sources.map((source) => source.sourceDomain).filter(Boolean));
  let sourceCredibility = 0;
  if (sourceDomains.size >= 2) {
    sourceCredibility = 10;
    explanations.push(`Invite discovered on ${sourceDomains.size} distinct source domains (+10 pts)`);
  } else if (sourceDomains.size === 1) {
    sourceCredibility = 7;
    explanations.push(`Invite discovered on ${[...sourceDomains][0]} (+7 pts)`);
  } else {
    explanations.push('No source-domain provenance available (+0 pts)');
  }

  // 5. Freshness (up to 10). Missing/invalid/future timestamps receive zero.
  let freshness = 0;
  const verifiedAt = Date.parse(invite.lastVerifiedAt || '');
  const ageHours = (Date.now() - verifiedAt) / (1000 * 60 * 60);
  if (Number.isFinite(ageHours) && ageHours >= 0) {
    if (ageHours <= 24) freshness = 10;
    else if (ageHours <= 168) freshness = 7;
    else freshness = 4;
  }
  explanations.push(`Verification timestamp freshness (+${freshness} pts)`);

  // 6. Size/activity metadata (up to 10). Member count does not establish
  // actual chat activity; live presence is an additional, separate signal.
  let activitySignal = 0;
  const members = invite.community?.approximateMemberCount;
  const online = invite.community?.approximatePresenceCount;
  if (typeof members === 'number' && Number.isFinite(members) && members >= 0) {
    if (members >= 5000) activitySignal = 10;
    else if (members >= 1000) activitySignal = 8;
    else if (members >= 100) activitySignal = 6;
    else activitySignal = 4;
    explanations.push(`Community size reported by Discord: ${members.toLocaleString()} (+${activitySignal} pts)`);
  } else {
    explanations.push('Member counts private or not provided by Discord (+0 pts)');
  }
  if (typeof online === 'number' && Number.isFinite(online) && online > 0) {
    activitySignal = Math.min(10, activitySignal + 2);
    explanations.push('Discord reports members currently online (+2 pts, subject to 10-point category cap)');
  }

  let total = Math.max(0, Math.min(100,
    topicRelevance + inviteValidity + languageMatch + sourceCredibility + freshness + activitySignal
  ));

  // Guardrails: unrelated, wrong-language, or unverified results must not look
  // like excellent matches merely because their invite is active or large.
  function capScore(max: number, why: string) {
    if (total > max) {
      total = max;
      explanations.push(`Final score capped at ${max}: ${why}`);
    }
  }

  if (requestedTopics.length > 0 && !directTopicMatch) {
    capScore(sourceOnlyTopicMatch ? 59 : 34, 'requested topic is not supported by server metadata');
  }
  if (hasTargetLanguage) {
    if (!languageKnown) {
      capScore(74, 'community language is unknown');
    } else if (!languageMatches) {
      capScore(49, 'requested language does not match available language evidence');
    } else if (!languageFromServer) {
      capScore(74, 'requested language appears only in external snippets');
    }
  }
  if (invite.status !== 'valid') {
    capScore(35, 'Discord invite is not verified as active');
  }
  if (!['valid', 'unknown', 'unavailable', 'rate_limited'].includes(invite.status)) {
    total = 0;
    explanations.push('Final score set to 0: invitation is invalid or expired');
  }

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

  return { score: total, scoreBreakdown, detectedTopics, detectedLanguage, countryEvidence };
}

/** Valid invites first, then descending score, member count and invite code. */
export function compareRankedResults(a: RankedInviteResult, b: RankedInviteResult): number {
  const aValid = a.invite.status === 'valid' ? 1 : 0;
  const bValid = b.invite.status === 'valid' ? 1 : 0;
  if (bValid !== aValid) return bValid - aValid;
  const preferenceOrder = Number(b.scoreBreakdown.preferenceMatch !== false) - Number(a.scoreBreakdown.preferenceMatch !== false);
  if (preferenceOrder !== 0) return preferenceOrder;
  if (b.score !== a.score) return b.score - a.score;
  const aMembers = a.invite.community?.approximateMemberCount || 0;
  const bMembers = b.invite.community?.approximateMemberCount || 0;
  if (bMembers !== aMembers) return bMembers - aMembers;
  return a.invite.code.localeCompare(b.invite.code);
}

/**
 * Validates whether a result has credible topic evidence.
 * Must have topicRelevance > 0 and contain at least one requested topic.
 */
export function hasCredibleTopicEvidence(
  res: RankedInviteResult,
  requestedTopics: TradingTopic[]
): boolean {
  if (requestedTopics.length === 0) return true;
  if (res.scoreBreakdown.topicRelevance <= 0) return false;
  return requestedTopics.some((topic) => res.detectedTopics.includes(topic));
}

export function rankInviteResults(
  verifiedInvites: { invite: VerifiedInvite; sources: DiscoveredInvite[] }[],
  requestedTopics: TradingTopic[],
  requestedLanguages: LanguageCode[],
  options?: { strictFilter?: boolean; country?: string; onCountryRejected?: () => void; onRelevanceRejected?: () => void }
): RankedInviteResult[] {
  const ranked = verifiedInvites.map(({ invite, sources }) => {
    const { score, scoreBreakdown, detectedTopics, detectedLanguage, countryEvidence } =
      calculateInviteScore(invite, sources, requestedTopics, requestedLanguages);

    return {
      invite,
      sources,
      score,
      scoreBreakdown,
      detectedTopics,
      detectedLanguage,
      countryEvidence,
      isVerifiedFact: invite.status === 'valid',
    };
  });

  ranked.sort(compareRankedResults);

  // Deduplicate communities by Discord Guild ID while preserving multi-source provenance
  const deduplicated = deduplicateCommunityResults(ranked);

  if (options?.strictFilter === false) {
    return deduplicated;
  }

  // Strict relevance filtering:
  // A candidate must satisfy:
  // 1. Credible requested-language evidence (if requestedLanguages specified)
  // 2. Credible requested-topic evidence (if requestedTopics specified)
  // 3. Credible requested-country evidence (if country specified and not 'all')
  // Never fill missing slots with English, unknown language, unrelated topic, or other/unknown country.
  return deduplicated.filter((res) => {
    // 1. Language relevance check
    if (requestedLanguages.length > 0) {
      if (
        res.detectedLanguage === 'unknown' ||
        !requestedLanguages.includes(res.detectedLanguage as LanguageCode)
      ) {
        if (res.invite.status === 'valid') options?.onRelevanceRejected?.();
        return false;
      }
    }

    // 2. Topic relevance check
    if (requestedTopics.length > 0) {
      if (!hasCredibleTopicEvidence(res, requestedTopics)) {
        if (res.invite.status === 'valid') options?.onRelevanceRejected?.();
        return false;
      }
    }

    // 3. Country relevance check
    if (options?.country && options.country !== 'all') {
      if (!matchesCountryFilter(res.countryEvidence, options.country)) {
        if (res.invite.status === 'valid') options.onCountryRejected?.();
        return false;
      }
    }

    return true;
  });
}

/**
 * Deduplicates community results by Discord guild ID (`invite.community.id`).
 *
 * Rules:
 * - When `community.id` is present, multiple invites for the same guild are merged.
 * - The highest-scoring / valid invite is retained as the primary record.
 * - Alternative invite codes are preserved in `alternateInviteCodes`.
 * - Multi-source provenance is preserved by merging all `sources` from all duplicates.
 * - NEVER deduplicates solely by server name or member count. Distinct guilds with identical names
 *   or member counts MUST remain separate entries.
 * - Invites without a guild ID are preserved individually by invite code.
 */
export function deduplicateCommunityResults(
  results: RankedInviteResult[]
): RankedInviteResult[] {
  const guildMap = new Map<string, RankedInviteResult>();
  const deduplicated: RankedInviteResult[] = [];

  for (const item of results) {
    const guildId = item.invite.community?.id?.trim();

    if (!guildId) {
      // No guild ID available (e.g. invalid invite or missing metadata)
      // Keep individual result without deduplicating by server name or member count
      deduplicated.push({
        ...item,
        alternateInviteCodes: item.alternateInviteCodes || [],
      });
      continue;
    }

    const existing = guildMap.get(guildId);
    if (!existing) {
      // First time seeing this guild ID
      const cloned: RankedInviteResult = {
        ...item,
        alternateInviteCodes: [...(item.alternateInviteCodes || [])],
        sources: [...item.sources],
      };
      guildMap.set(guildId, cloned);
      deduplicated.push(cloned);
    } else {
      // Duplicate guild ID found! Merge with existing primary record.
      // 1. Record alternate invite code if different from primary code
      if (!existing.alternateInviteCodes) {
        existing.alternateInviteCodes = [];
      }
      if (item.invite.code && item.invite.code !== existing.invite.code) {
        if (!existing.alternateInviteCodes.includes(item.invite.code)) {
          existing.alternateInviteCodes.push(item.invite.code);
        }
      }
      if (item.alternateInviteCodes && item.alternateInviteCodes.length > 0) {
        for (const code of item.alternateInviteCodes) {
          if (code !== existing.invite.code && !existing.alternateInviteCodes.includes(code)) {
            existing.alternateInviteCodes.push(code);
          }
        }
      }

      // 2. Merge sources (preserving multi-source provenance without duplicate source URLs)
      const existingUrls = new Set(existing.sources.map((s) => s.sourceUrl));
      for (const s of item.sources) {
        if (!existingUrls.has(s.sourceUrl)) {
          existing.sources.push(s);
          existingUrls.add(s.sourceUrl);
        }
      }

      // 3. If the newly seen invite is higher scoring or is valid while existing is invalid, promote it
      if (
        (item.invite.status === 'valid' && existing.invite.status !== 'valid') ||
        (item.score > existing.score && (item.invite.status === existing.invite.status || item.invite.status === 'valid'))
      ) {
        const oldCode = existing.invite.code;
        if (oldCode && !existing.alternateInviteCodes.includes(oldCode)) {
          existing.alternateInviteCodes.push(oldCode);
        }
        existing.alternateInviteCodes = existing.alternateInviteCodes.filter((c) => c !== item.invite.code);
        existing.invite = item.invite;
        existing.score = item.score;
        existing.scoreBreakdown = item.scoreBreakdown;
        existing.detectedTopics = Array.from(new Set([...existing.detectedTopics, ...item.detectedTopics]));
        existing.detectedLanguage = item.detectedLanguage;
        existing.isVerifiedFact = item.isVerifiedFact;
        if (item.countryEvidence && item.countryEvidence.status !== 'unknown') {
          existing.countryEvidence = item.countryEvidence;
        }
      } else if (
        (!existing.countryEvidence || existing.countryEvidence.status === 'unknown') &&
        item.countryEvidence &&
        item.countryEvidence.status !== 'unknown'
      ) {
        // Upgrade country evidence from duplicate invite if existing is unknown
        existing.countryEvidence = item.countryEvidence;
      }
    }
  }

  return deduplicated;
}
