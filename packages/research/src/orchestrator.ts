import {
  DiscoveredInvite,
  extractDiscordInvites,
  identifySourcePlatform,
  PotentialCommunityLead,
  RankedInviteResult,
  rankInviteResults,
  SearchJobParams,
  SearchJobProgress,
  VerifiedInvite,
  verifyDiscordInvite,
} from '@discord-link-hunter/core';
import { QueryPlanner } from './query-planner.js';
import { QueryPlanItem, SearchProvider } from './types.js';

export interface SearchOrchestratorOptions {
  primaryProvider: SearchProvider;
  secondaryProvider?: SearchProvider;
  queryPlanner?: QueryPlanner;
  maxConcurrent?: number;
  verifyInviteFn?: (code: string) => Promise<VerifiedInvite>;
  isSimulated?: boolean;
}

export interface OrchestrationResult {
  results: RankedInviteResult[];
  progress: SearchJobProgress;
  potentialLeads?: PotentialCommunityLead[];
  dryRun?: boolean;
  plannedQueries?: QueryPlanItem[];
  estimatedRequests?: number;
  estimatedCredits?: number;
  dryRunExplanation?: string;
  languageFilterNotice?: string;
  providerUsage?: Record<string, number>;
}

export class SearchOrchestrator {
  private primaryProvider: SearchProvider;
  private secondaryProvider?: SearchProvider;
  private queryPlanner: QueryPlanner;
  private maxConcurrent: number;
  private verifyInviteFn: (code: string) => Promise<VerifiedInvite>;
  private isSimulated: boolean;

  constructor(options: SearchOrchestratorOptions) {
    this.primaryProvider = options.primaryProvider;
    this.secondaryProvider = options.secondaryProvider;
    this.queryPlanner = options.queryPlanner || new QueryPlanner();
    this.maxConcurrent = options.maxConcurrent || 2;
    this.verifyInviteFn = options.verifyInviteFn || verifyDiscordInvite;
    this.isSimulated = options.isSimulated ?? (options.primaryProvider.name === 'mock');
  }

  async executeJob(
    params: SearchJobParams,
    onProgress?: (progress: SearchJobProgress) => void
  ): Promise<OrchestrationResult> {
    const plan = this.queryPlanner.generatePlan(params);

    const progress: SearchJobProgress = {
      queriesPlanned: plan.length,
      queriesAttempted: 0,
      queriesSuccessful: 0,
      queriesFailed: 0,
      urlsDiscovered: 0,
      invitesExtracted: 0,
      uniqueInvites: 0,
      invitesChecked: 0,
      validInvites: 0,
      invalidInvites: 0,
      restrictedOrUnverified: 0,
      potentialLeadsCount: 0,
      leadsWithoutInvite: 0,
      queriesExecuted: 0,
      invitesVerified: 0,
      validInvitesFound: 0,
      providerErrors: [],
    };

    if (params.dryRun) {
      const estimatedRequests = plan.length + (params.depth > 1 ? 3 : 0);
      const estimatedCredits = estimatedRequests;
      const dryRunExplanation =
        'Dry Run generated the multilingual query strategy without dispatching external network requests. ' +
        'Zero queries were sent to Serper/Tavily, no Discord invite endpoints were pinged, ' +
        'and zero API credits were consumed. Review the query plan and estimated usage below before launching.';

      return {
        results: [],
        progress,
        dryRun: true,
        plannedQueries: plan,
        estimatedRequests,
        estimatedCredits,
        dryRunExplanation,
      };
    }

    const discoveredInvitesMap = new Map<string, DiscoveredInvite[]>();
    const potentialLeads: PotentialCommunityLead[] = [];
    const seenLeadUrls = new Set<string>();
    const providerUsage: Record<string, number> = {
      serper: 0,
      tavily: 0,
      mock: 0,
    };

    let primaryDisabled = false;

    // Execute queries in bounded concurrent batches
    for (let i = 0; i < plan.length; i += this.maxConcurrent) {
      const batch = plan.slice(i, i + this.maxConcurrent);

      await Promise.all(
        batch.map(async (item) => {
          progress.queriesAttempted++;
          progress.queriesExecuted = progress.queriesAttempted;

          try {
            let searchResult: any = null;

            // Attempt primary provider if available and not permanently broken
            if (!primaryDisabled && this.primaryProvider.isAvailable()) {
              providerUsage[this.primaryProvider.name] = (providerUsage[this.primaryProvider.name] || 0) + 1;
              searchResult = await this.primaryProvider.search(item.query, {
                language: item.language,
                limit: params.limit,
                depth: params.depth,
              });

              if (searchResult?.isPermanentError) {
                primaryDisabled = true;
              }
            }

            // Automatic Failover:
            // If primary failed, was unavailable, or returned 0 items, failover to secondary provider
            const primaryFailed = !searchResult || searchResult.statusCode !== 200 || searchResult.items.length === 0;
            if (primaryFailed && this.secondaryProvider?.isAvailable()) {
              if (searchResult?.error) {
                progress.providerErrors.push({
                  provider: this.primaryProvider.name,
                  error: searchResult.error,
                  timestamp: new Date().toISOString(),
                });
              }

              providerUsage[this.secondaryProvider.name] = (providerUsage[this.secondaryProvider.name] || 0) + 1;
              searchResult = await this.secondaryProvider.search(item.query, {
                language: item.language,
                limit: params.limit,
                depth: params.depth,
              });
            }

            if (searchResult.error || searchResult.statusCode !== 200) {
              progress.queriesFailed++;
              progress.providerErrors.push({
                provider: searchResult.provider,
                error: searchResult.error || `HTTP ${searchResult.statusCode}`,
                timestamp: new Date().toISOString(),
              });
            } else {
              progress.queriesSuccessful++;
            }

            progress.urlsDiscovered += searchResult.items.length;

            // Extract invites from search snippets and links
            for (const itemResult of searchResult.items) {
              const combinedText = `${itemResult.title}\n${itemResult.snippet}\n${itemResult.url}`;
              const extracted = extractDiscordInvites(combinedText, itemResult.url, searchResult.provider);

              if (extracted.length > 0) {
                for (const invite of extracted) {
                  progress.invitesExtracted++;
                  const existing = discoveredInvitesMap.get(invite.code) || [];
                  existing.push(invite);
                  discoveredInvitesMap.set(invite.code, existing);
                }
              } else {
                // Requirement 5 & 9: Never assume a site-search result proves an invite exists.
                // Collect discovered public discussions as potential community leads without confirmed invites.
                if (itemResult.url && !seenLeadUrls.has(itemResult.url)) {
                  seenLeadUrls.add(itemResult.url);
                  const platformConfig = identifySourcePlatform(itemResult.url);
                  const platformId = platformConfig?.id || 'general_web';
                  const platformName = platformConfig?.name || 'General Web';
                  const category = platformConfig?.category || 'general_web';

                  const lowerText = combinedText.toLowerCase();
                  const hasCommunityIndicator =
                    lowerText.includes('discord') ||
                    lowerText.includes('community') ||
                    lowerText.includes('server') ||
                    lowerText.includes('chat') ||
                    lowerText.includes('channel') ||
                    lowerText.includes('group') ||
                    lowerText.includes('trader') ||
                    lowerText.includes('trading');

                  if (hasCommunityIndicator) {
                    let domain = '';
                    try {
                      domain = new URL(itemResult.url).hostname;
                    } catch {
                      // ignore
                    }

                    potentialLeads.push({
                      id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                      sourcePlatform: platformId,
                      sourcePlatformName: platformName,
                      sourceCategory: category,
                      sourceUrl: itemResult.url,
                      sourceDomain: domain,
                      title: itemResult.title,
                      snippet: itemResult.snippet,
                      topic: item.topic,
                      language: item.language,
                      discoveredAt: new Date().toISOString(),
                      hasConfirmedInvite: false,
                      reason: `Discussion or creator post discovered on ${platformName}, but no valid Discord invitation link was exposed in the public snippet/page.`,
                    });
                  }
                }
              }
            }

            progress.uniqueInvites = discoveredInvitesMap.size;
            progress.potentialLeadsCount = potentialLeads.length;
            progress.leadsWithoutInvite = potentialLeads.length;
            if (onProgress) onProgress({ ...progress });
          } catch (err: any) {
            progress.queriesFailed++;
            progress.providerErrors.push({
              provider: this.primaryProvider.name,
              error: err.message || 'Search execution failed',
              timestamp: new Date().toISOString(),
            });
            if (onProgress) onProgress({ ...progress });
          }
        })
      );
    }

    // Secondary expansion via Tavily if requested and depth > 1
    if (params.depth > 1 && this.secondaryProvider?.isAvailable()) {
      const topInvites = Array.from(discoveredInvitesMap.entries()).slice(0, 3);
      for (const [code] of topInvites) {
        try {
          providerUsage[this.secondaryProvider.name] = (providerUsage[this.secondaryProvider.name] || 0) + 1;
          const expansionResult = await this.secondaryProvider.search(`discord.gg/${code} trading`, {
            limit: 5,
            depth: 2,
          });
          for (const itemResult of expansionResult.items) {
            const combinedText = `${itemResult.title}\n${itemResult.snippet}\n${itemResult.url}`;
            const extracted = extractDiscordInvites(combinedText, itemResult.url, 'tavily');
            for (const inv of extracted) {
              progress.invitesExtracted++;
              const existing = discoveredInvitesMap.get(inv.code) || [];
              existing.push(inv);
              discoveredInvitesMap.set(inv.code, existing);
            }
          }
        } catch {
          // non-critical expansion failure
        }
      }
      progress.uniqueInvites = discoveredInvitesMap.size;
    }

    // Verify unique discovered invites
    const verifiedList: { invite: VerifiedInvite; sources: DiscoveredInvite[] }[] = [];
    const entries = Array.from(discoveredInvitesMap.entries());

    // Bound invite verifications
    const targetCodes = entries.slice(0, Math.min(params.limit * 2, entries.length));

    for (const [code, sources] of targetCodes) {
      try {
        const verified = await this.verifyInviteFn(code);
        progress.invitesChecked++;
        progress.invitesVerified = progress.invitesChecked;

        if (verified.status === 'valid') {
          // If minMembers filter requested, check threshold
          if (params.minMembers && verified.community?.approximateMemberCount) {
            if (verified.community.approximateMemberCount >= params.minMembers) {
              progress.validInvites++;
              progress.validInvitesFound = progress.validInvites;
              verifiedList.push({ invite: verified, sources });
            } else {
              progress.restrictedOrUnverified++;
              verifiedList.push({ invite: verified, sources });
            }
          } else {
            progress.validInvites++;
            progress.validInvitesFound = progress.validInvites;
            verifiedList.push({ invite: verified, sources });
          }
        } else if (verified.status === 'expired_or_revoked') {
          progress.invalidInvites++;
          verifiedList.push({ invite: verified, sources });
        } else {
          progress.restrictedOrUnverified++;
          verifiedList.push({ invite: verified, sources });
        }
      } catch (err: any) {
        progress.invitesChecked++;
        progress.invitesVerified = progress.invitesChecked;
        progress.restrictedOrUnverified++;
        verifiedList.push({
          invite: {
            code,
            canonicalUrl: `https://discord.gg/${code}`,
            status: 'unknown',
            statusReason: `Verification exception: ${err.message}`,
            lastVerifiedAt: new Date().toISOString(),
          },
          sources,
        });
      }

      if (onProgress) onProgress({ ...progress });
    }

    // Rank verified results with strict language relevance
    const ranked = rankInviteResults(verifiedList, params.topics, params.languages);
    for (const r of ranked) {
      if (this.isSimulated) {
        r.isSimulated = true;
      }
    }

    const finalResults = ranked.slice(0, params.limit);

    let languageFilterNotice: string | undefined;
    const hasTopics = Boolean(params.topics && params.topics.length > 0);
    const hasLanguages = Boolean(params.languages && params.languages.length > 0);

    if (hasTopics || hasLanguages) {
      const validVerifiedCount = verifiedList.filter((v) => v.invite.status === 'valid').length;
      const excludedCount = Math.max(0, validVerifiedCount - finalResults.length);
      progress.languageFilteredOutCount = excludedCount;

      if (finalResults.length < params.limit && excludedCount > 0) {
        const topicLabel = hasTopics ? params.topics.map((t) => t.toUpperCase()).join(', ') : null;
        const langLabel = hasLanguages ? params.languages.map((l) => l.toUpperCase()).join(', ') : null;

        if (topicLabel && langLabel) {
          languageFilterNotice = `Strict relevance filter active [Topic: ${topicLabel}, Lang: ${langLabel}]: Found ${finalResults.length} matching communities. ${excludedCount} verified communities were excluded because they lacked credible evidence matching the requested trading topic or language.`;
        } else if (topicLabel) {
          languageFilterNotice = `Strict topic filter active [${topicLabel}]: Found ${finalResults.length} matching communities. ${excludedCount} verified communities were excluded because they lacked credible evidence matching the requested trading topic.`;
        } else if (langLabel) {
          languageFilterNotice = `Strict language filter active [${langLabel}]: Found ${finalResults.length} matching communities. ${excludedCount} verified communities in other or unconfirmed languages were excluded to guarantee language relevance.`;
        }
      }
    }

    return {
      results: finalResults,
      progress,
      potentialLeads,
      languageFilterNotice,
      providerUsage,
    };
  }
}

