
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
} from 'discord.js';
import { getConfig } from '@discord-link-hunter/config';
import {
  canonicalizeDiscordInvite,
  LanguageCode,
  RankedInviteResult,
  SearchJob,
  SUPPORTED_LANGUAGES,
  TradingTopic,
  TRADING_TOPICS,
  verifyDiscordInvite,
} from '@discord-link-hunter/core';
import { getRepository, JobQueueManager } from '@discord-link-hunter/db';

export function buildResultsPageEmbed(
  jobId: string,
  results: RankedInviteResult[],
  page: number,
  totalPages: number,
  job?: SearchJob | null,
  excludedCount?: number
): EmbedBuilder {
  const startIndex = (page - 1) * 5;
  const pageResults = results.slice(startIndex, startIndex + 5);

  const title = job?.params?.topics?.length
    ? `🎯 Hunt Results: ${job.params.topics.join(', ').toUpperCase()} (${(job.params.languages || ['en']).join(', ').toUpperCase()})`
    : `🎯 Search Results: ${jobId}`;

  let description =
    `Job ID: \`${jobId}\`\n` +
    `Found **${results.length}** ranked communities (showing page ${page} of ${totalPages}).`;

  if (excludedCount && excludedCount > 0) {
    description += `\n⚠️ *${excludedCount} invalid or expired invitation${excludedCount > 1 ? 's were' : ' was'} excluded from recommendations.*`;
  }

  if (job?.languageFilterNotice) {
    description += `\n⚠️ *${job.languageFilterNotice}*`;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: `Page ${page} of ${totalPages} • Mode: ${job?.mode || 'live'} • View full details in dashboard`,
    })
    .setTimestamp();

  pageResults.forEach((res, i) => {
    const rank = startIndex + i + 1;
    const serverName = res.invite.community?.name || res.invite.code;
    const members = res.invite.community?.approximateMemberCount
      ? ` (${res.invite.community.approximateMemberCount.toLocaleString()} members)`
      : '';
    const link = `[${serverName}](${res.invite.canonicalUrl})`;
    const explanations =
      res.scoreBreakdown?.explanations?.slice(0, 2).join(' • ') ||
      'Verified invitation';

    const sourcePlatforms = Array.from(
      new Set(res.sources?.map((s) => s.sourcePlatformName || s.sourcePlatform).filter(Boolean))
    );
    const sourcesText = sourcePlatforms.length > 0 ? ` | Via: \`${sourcePlatforms.join(', ')}\`` : '';

    embed.addFields({
      name: `#${rank} • Score ${res.score}/100: ${serverName}`,
      value:
        `${link}${members}\n` +
        `Status: \`${res.invite.status}\` | Lang: \`${res.detectedLanguage}\`${sourcesText}\n` +
        `*${explanations}*`,
    });
  });

  return embed;
}

export function buildPaginationRow(
  jobId: string,
  page: number,
  totalPages: number,
  authorId: string,
  statusFilter?: string
): ActionRowBuilder<ButtonBuilder> {
  const statusSuffix = statusFilter && statusFilter !== 'valid' ? `:${statusFilter}` : '';
  const prevButton = new ButtonBuilder()
    .setCustomId(`page:${jobId}:${page - 1}:${authorId}${statusSuffix}`)
    .setLabel('◀ Previous')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 1);

  const indicatorButton = new ButtonBuilder()
    .setCustomId('page_noop')
    .setLabel(`Page ${page} of ${totalPages}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const nextButton = new ButtonBuilder()
    .setCustomId(`page:${jobId}:${page + 1}:${authorId}${statusSuffix}`)
    .setLabel('Next ▶')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page >= totalPages);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    prevButton,
    indicatorButton,
    nextButton
  );
}

export async function handleButtonInteraction(
  interaction: ButtonInteraction
): Promise<void> {
  const customId = interaction.customId;
  if (!customId.startsWith('page:') || customId === 'page_noop') {
    return;
  }

  const parts = customId.split(':');
  if (parts.length < 4) {
    return;
  }

  const [, jobId, targetPageStr, authorId, rawStatus] = parts;
  const statusFilter = rawStatus || 'valid';

  if (!jobId || !targetPageStr) {
    return;
  }

  const targetPage = parseInt(targetPageStr, 10);
  if (isNaN(targetPage) || targetPage < 1) {
    return;
  }

  // Anti-spam / Author-only check (instant in-memory verification before deferring)
  if (authorId && interaction.user.id !== authorId) {
    await interaction.reply({
      content: '⚠️ Only the user who ran this search can paginate results.',
      ephemeral: true,
    });
    return;
  }

  // Acknowledge the interaction immediately to prevent Discord's 3-second timeout!
  // deferUpdate() tells Discord the message update is in progress.
  await interaction.deferUpdate();

  try {
    const repo = getRepository();
    const [allResults, job] = await Promise.all([
      repo.getJobResults(jobId),
      repo.getJob(jobId),
    ]);

    if (!job && (!allResults || allResults.length === 0)) {
      await interaction.followUp({
        content: `❌ Search job \`${jobId}\` was not found.`,
        ephemeral: true,
      });
      return;
    }

    if (!allResults || allResults.length === 0) {
      await interaction.followUp({
        content: `❌ No results stored for job \`${jobId}\`.`,
        ephemeral: true,
      });
      return;
    }

    // Filter results according to active status filter
    let displayResults = allResults;
    let excludedCount = 0;
    if (statusFilter === 'valid') {
      displayResults = allResults.filter((r) => r.invite.status === 'valid');
      excludedCount = allResults.length - displayResults.length;
    } else if (statusFilter === 'expired_or_revoked') {
      displayResults = allResults.filter((r) => r.invite.status !== 'valid');
      excludedCount = allResults.length - displayResults.length;
    }

    const totalPages = Math.ceil(displayResults.length / 5) || 1;
    const page = Math.max(1, Math.min(targetPage, totalPages));

    const embed = buildResultsPageEmbed(jobId, displayResults, page, totalPages, job, excludedCount);
    const row = buildPaginationRow(jobId, page, totalPages, authorId, statusFilter);

    // After deferUpdate(), update the message via editReply()
    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  } catch (error: unknown) {
    console.error(`[Bot] Failed to paginate results for job ${jobId}:`, error);
    try {
      await interaction.followUp({
        content: '⚠️ Failed to load page results from database.',
        ephemeral: true,
      });
    } catch {
      // ignore
    }
  }
}

export const slashCommands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot and system health status'),

  new SlashCommandBuilder()
    .setName('hunt')
    .setDescription('Hunt for verified Discord trading communities')
    .addStringOption((opt) =>
      opt
        .setName('topic')
        .setDescription('Trading market topic')
        .setRequired(true)
        .addChoices(
          { name: 'Forex (FX)', value: 'forex' },
          { name: 'Gold / XAUUSD', value: 'xauusd' },
          { name: 'Stocks / Equities', value: 'stocks' },
          { name: 'Cryptocurrency', value: 'crypto' },
          { name: 'Futures', value: 'futures' },
          { name: 'Options', value: 'options' },
          { name: 'Indices', value: 'indices' },
          { name: 'Day Trading', value: 'day_trading' },
          { name: 'Education & Mentorship', value: 'education' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('language')
        .setDescription('Community language')
        .setRequired(false)
        .addChoices(
          { name: 'English (en)', value: 'en' },
          { name: 'German (de)', value: 'de' },
          { name: 'Spanish (es)', value: 'es' },
          { name: 'Portuguese (pt)', value: 'pt' },
          { name: 'French (fr)', value: 'fr' },
          { name: 'Arabic (ar)', value: 'ar' }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName('limit')
        .setDescription('Max number of invites to find (1-20)')
        .setRequired(false)
    ),

  // Depth 2 remains available internally, but is hidden from guild slash commands.

  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Check if a Discord invite link is active, safe, and valid')
    .addStringOption((opt) =>
      opt
        .setName('invite')
        .setDescription('Discord invite URL or code')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('results')
    .setDescription('View ranked results from a previous search job')
    .addStringOption((opt) =>
      opt
        .setName('job')
        .setDescription('Job ID')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('status')
        .setDescription('Filter by invite status (default: valid active only)')
        .setRequired(false)
        .addChoices(
          { name: 'Valid active communities (default)', value: 'valid' },
          { name: 'All communities (including expired/revoked)', value: 'all' },
          { name: 'Expired or revoked only', value: 'expired_or_revoked' }
        )
    ),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check the execution status of a search job')
    .addStringOption((opt) =>
      opt
        .setName('job')
        .setDescription('Job ID')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('export')
    .setDescription('Export search job results as CSV or JSON file')
    .addStringOption((opt) =>
      opt
        .setName('job')
        .setDescription('Job ID')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('format')
        .setDescription('Export format')
        .setRequired(true)
        .addChoices(
          { name: 'CSV', value: 'csv' },
          { name: 'JSON', value: 'json' }
        )
    ),

  new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Get link to the Discord Link Hunter Web Dashboard'),
];

export async function handleInteraction(
  interaction: ChatInputCommandInteraction
) {
  const config = getConfig();

  // Check user authorization if restricted
  if (config.ALLOWED_DISCORD_USER_IDS.length > 0) {
    if (!config.ALLOWED_DISCORD_USER_IDS.includes(interaction.user.id)) {
      await interaction.reply({
        content:
          '⛔ You are not authorized to use Discord Link Hunter commands on this server.',
        ephemeral: true,
      });
      return;
    }
  }

  const { commandName } = interaction;

  // PING
  if (commandName === 'ping') {
    const embed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle('🏓 Discord Link Hunter Status')
      .addFields(
        {
          name: 'Bot Latency',
          value: `${Date.now() - interaction.createdTimestamp}ms`,
          inline: true,
        },
        {
          name: 'Default Search Mode',
          value: `\`live\``,
          inline: true,
        },
        {
          name: 'Database',
          value: config.DATABASE_URL || config.DIRECT_URL ? 'PostgreSQL configured' : 'Local storage',
          inline: true,
        },
        {
          name: 'Serper Configured',
          value: config.SERPER_API_KEY ? '✅ Yes' : '❌ No',
          inline: true,
        },
        {
          name: 'Tavily Configured',
          value: config.TAVILY_API_KEY ? '✅ Yes' : '❌ No',
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // DASHBOARD
  if (commandName === 'dashboard') {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📊 Discord Link Hunter Dashboard')
      .setDescription(
        `Open the web dashboard at:\n**[${config.WEB_ORIGIN}](${config.WEB_ORIGIN})**\n\nMonitor live search jobs, sort by score, view score breakdowns, and export verified communities.`
      )
      .setFooter({
        text: 'Multi-provider Trading Discovery Platform',
      });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // Repository creation is deferred until after fast commands have returned.
  const repo = getRepository();
  const queue = new JobQueueManager(repo);

  // VERIFY does not require a database query. Keep acknowledgement prompt.
  if (commandName === 'verify') {
    await interaction.deferReply();

    const rawInvite = interaction.options.getString('invite', true);
    const canonical = canonicalizeDiscordInvite(rawInvite);

    if (!canonical) {
      await interaction.editReply({
        content:
          '❌ Invalid Discord invitation format. Please provide a link like `https://discord.gg/code`.',
      });
      return;
    }

    const verified = await verifyDiscordInvite(canonical.code);

    const embed = new EmbedBuilder()
      .setTitle(`Invite Verification: ${canonical.code}`)
      .setColor(verified.status === 'valid' ? 0x22c55e : 0xef4444)
      .addFields(
        {
          name: 'Status',
          value: `\`${verified.status}\``,
          inline: true,
        },
        {
          name: 'Canonical Link',
          value: `[discord.gg/${canonical.code}](${verified.canonicalUrl})`,
          inline: true,
        },
        {
          name: 'Details',
          value: verified.statusReason || 'N/A',
        }
      );

    if (verified.community) {
      embed.addFields(
        {
          name: 'Server Name',
          value: verified.community.name,
          inline: true,
        },
        {
          name: 'Members',
          value: verified.community.approximateMemberCount
            ? verified.community.approximateMemberCount.toLocaleString()
            : 'Hidden',
          inline: true,
        },
        {
          name: 'Online',
          value: verified.community.approximatePresenceCount
            ? verified.community.approximatePresenceCount.toLocaleString()
            : 'Hidden',
          inline: true,
        }
      );

      if (verified.community.description) {
        embed.setDescription(
          verified.community.description.slice(0, 300)
        );
      }
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // HUNT AND DEEPSEARCH
  if (commandName === 'hunt' || commandName === 'deepsearch') {
    await interaction.deferReply();

    const topic = interaction.options.getString(
      'topic',
      true
    ) as TradingTopic;

    const language = (
      interaction.options.getString('language') || 'en'
    ) as LanguageCode;

    const limit = Math.max(
      1,
      Math.min(interaction.options.getInteger('limit') || 5, 20)
    );

    const depth = commandName === 'deepsearch' ? 2 : 1;

    // User-facing searches are always Live; test fixtures remain in Vitest.
    const mode = 'live' as const;

    // Create job using the selected mode
    const job = await queue.createJob(
      {
        topics: [topic],
        languages: [language],
        limit,
        depth,
      },
      interaction.user.id,
      mode
    );

    // Initial response
    await interaction.editReply({
      content:
        `🔍 **Discovery Job Queued** (\`${job.id}\`)\n` +
        `Topic: \`${topic}\` | Language: \`${language}\` | ` +
        `Limit: \`${limit}\` | Depth: \`${depth}\` | ` +
        `Mode: **${mode.toUpperCase()}**\n` +
        `*Running search pipeline...*`,
    });

    // Execute search
    const finishedJob = await queue.processJob(job.id);

    if (finishedJob.status === 'failed') {
      await interaction.followUp({
        content:
          `❌ Search job \`${job.id}\` failed: ` +
          `${finishedJob.errorDetails || 'Unknown error'}`,
      });
      return;
    }

    // Default main community results to active, valid invitations
    const allResults = finishedJob.results;
    const validResults = allResults.filter((r) => r.invite.status === 'valid');
    const excludedCount = allResults.length - validResults.length;
    const displayResults = validResults;

    if (displayResults.length === 0) {
      let content = `🎯 **Hunt Completed for ${topic.toUpperCase()} (${language.toUpperCase()})**\nJob ID: \`${job.id}\`\nNo active valid communities matched all strict criteria.`;
      if (excludedCount > 0) {
        content += `\n⚠️ *${excludedCount} invalid or expired invitation${excludedCount > 1 ? 's were' : ' was'} excluded from recommendations.*`;
      }
      if (finishedJob.languageFilterNotice) {
        content += `\n⚠️ *${finishedJob.languageFilterNotice}*`;
      }
      await interaction.followUp({ content });
      return;
    }

    const totalResults = displayResults.length;
    const totalPages = Math.ceil(totalResults / 5) || 1;
    const embed = buildResultsPageEmbed(
      job.id,
      displayResults,
      1,
      totalPages,
      finishedJob,
      excludedCount
    );
    const components =
      totalPages > 1
        ? [buildPaginationRow(job.id, 1, totalPages, interaction.user.id, 'valid')]
        : [];

    await interaction.followUp({ embeds: [embed], components });
    return;
  }

  // STATUS
  if (commandName === 'status') {
    // Acknowledge Discord before querying Supabase
    await interaction.deferReply();

    const jobId = interaction.options.getString('job', true);
    const job = await repo.getJob(jobId);

    if (!job) {
      await interaction.editReply({
        content: `❌ Job \`${jobId}\` not found.`,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Job Status: ${job.id}`)
      .setColor(
        job.status === 'completed'
          ? 0x22c55e
          : job.status === 'failed'
            ? 0xef4444
            : 0x3b82f6
      )
      .addFields(
        {
          name: 'Status',
          value: `\`${job.status}\``,
          inline: true,
        },
        {
          name: 'Mode',
          value: `\`${job.mode}\``,
          inline: true,
        },
        {
          name: 'Queries Executed',
          value:
            `${job.progress.queriesExecuted}/` +
            `${job.progress.queriesPlanned}`,
          inline: true,
        },
        {
          name: 'URLs Discovered',
          value: `${job.progress.urlsDiscovered}`,
          inline: true,
        },
        {
          name: 'Invites Verified',
          value: `${job.progress.invitesVerified}`,
          inline: true,
        },
        {
          name: 'Valid Invites',
          value: `${job.progress.validInvitesFound}`,
          inline: true,
        }
      );

    if (job.progress.providerErrors.length > 0) {
      embed.addFields({
        name: 'Provider Errors',
        value: job.progress.providerErrors
          .map((e) => `• [${e.provider}] ${e.error}`)
          .slice(0, 3)
          .join('\n'),
      });
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // RESULTS
  if (commandName === 'results') {
    // Acknowledge Discord before querying saved results
    await interaction.deferReply();

    const jobId = interaction.options.getString('job', true);
    const statusOption = interaction.options.getString('status') || 'valid';
    const [results, job] = await Promise.all([
      repo.getJobResults(jobId),
      repo.getJob(jobId),
    ]);

    if (results.length === 0) {
      let content = `No results stored for job \`${jobId}\` yet.`;
      if (job?.languageFilterNotice) {
        content = `⚠️ ${job.languageFilterNotice}`;
      }
      await interaction.editReply({
        content,
      });
      return;
    }

    // Filter results by status (default: valid active only)
    let displayResults = results;
    let excludedCount = 0;
    if (statusOption === 'valid') {
      displayResults = results.filter((r) => r.invite.status === 'valid');
      excludedCount = results.length - displayResults.length;
    } else if (statusOption === 'expired_or_revoked') {
      displayResults = results.filter((r) => r.invite.status !== 'valid');
      excludedCount = results.length - displayResults.length;
    }

    if (displayResults.length === 0) {
      let content = `No communities with status \`${statusOption}\` stored for job \`${jobId}\`.`;
      if (excludedCount > 0) {
        content += `\n⚠️ *${excludedCount} invitation${excludedCount > 1 ? 's were' : ' was'} excluded by status filter.*`;
      }
      if (job?.languageFilterNotice) {
        content += `\n⚠️ ${job.languageFilterNotice}`;
      }
      await interaction.editReply({
        content,
      });
      return;
    }

    const totalResults = displayResults.length;
    const totalPages = Math.ceil(totalResults / 5) || 1;
    const embed = buildResultsPageEmbed(jobId, displayResults, 1, totalPages, job, excludedCount);
    const components =
      totalPages > 1
        ? [buildPaginationRow(jobId, 1, totalPages, interaction.user.id, statusOption)]
        : [];

    await interaction.editReply({ embeds: [embed], components });
    return;
  }

  // EXPORT
  if (commandName === 'export') {
    await interaction.deferReply();

    const jobId = interaction.options.getString('job', true);
    const format = interaction.options.getString('format', true);

    const results = await repo.getJobResults(jobId);

    if (results.length === 0) {
      await interaction.editReply({
        content: `No results available to export for job \`${jobId}\`.`,
      });
      return;
    }

    if (format === 'csv') {
      const headers = [
        'Score',
        'Canonical URL',
        'Status',
        'Name',
        'Members',
        'Language',
        'Topics',
      ];

      const rows = results.map((r) => [
        r.score,
        `"${r.invite.canonicalUrl}"`,
        `"${r.invite.status}"`,
        `"${(r.invite.community?.name || '').replace(/"/g, '""')}"`,
        r.invite.community?.approximateMemberCount || 0,
        `"${r.detectedLanguage}"`,
        `"${r.detectedTopics.join(', ')}"`,
      ]);

      const csvData = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

      const attachment = new AttachmentBuilder(
        Buffer.from(csvData),
        {
          name: `job-${jobId}-results.csv`,
        }
      );

      await interaction.editReply({
        content: `📄 Here is your CSV export for job \`${jobId}\`:`,
        files: [attachment],
      });
      return;
    }

    const jsonData = JSON.stringify(results, null, 2);

    const attachment = new AttachmentBuilder(
      Buffer.from(jsonData),
      {
        name: `job-${jobId}-results.json`,
      }
    );

    await interaction.editReply({
      content: `📦 Here is your JSON export for job \`${jobId}\`:`,
      files: [attachment],
    });
    return;
  }
}
