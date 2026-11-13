
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  AttachmentBuilder,
} from 'discord.js';
import { getConfig } from '@discord-link-hunter/config';
import {
  canonicalizeDiscordInvite,
  LanguageCode,
  SUPPORTED_LANGUAGES,
  TradingTopic,
  TRADING_TOPICS,
  verifyDiscordInvite,
} from '@discord-link-hunter/core';
import { getRepository, JobQueueManager } from '@discord-link-hunter/db';

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
    )
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Use Mock for testing or Live for real research API requests')
        .setRequired(false)
        .addChoices(
          { name: 'Mock (no research API credits)', value: 'mock' },
          { name: 'Live (uses research API credits)', value: 'live' }
        )
    ),

  new SlashCommandBuilder()
    .setName('deepsearch')
    .setDescription('Deep search exploration for hidden trading communities (Depth 2)')
    .addStringOption((opt) =>
      opt
        .setName('topic')
        .setDescription('Trading topic')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('language')
        .setDescription('Target language')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Use Mock for testing or Live for real research API requests')
        .setRequired(false)
        .addChoices(
          { name: 'Mock (no research API credits)', value: 'mock' },
          { name: 'Live (uses research API credits)', value: 'live' }
        )
    ),

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
  const repo = getRepository();
  const queue = new JobQueueManager(repo);

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
          value: `\`${config.SEARCH_MODE}\``,
          inline: true,
        },
        {
          name: 'Database',
          value: repo.isMock ? 'Mock / In-Memory' : 'Supabase Postgres',
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

  // VERIFY
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

    // Explicit per-command mode.
    // Mock is the safe default.
    const mode = (
      interaction.options.getString('mode') || 'mock'
    ) as 'mock' | 'live';

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

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(
        `🎯 Hunt Results: ${topic.toUpperCase()} (${language.toUpperCase()})`
      )
      .setDescription(
        `Job ID: \`${job.id}\`\n` +
        `Found **${finishedJob.results.length}** ranked communities ` +
        `(from ${finishedJob.progress.queriesExecuted} queries).`
      )
      .setFooter({
        text:
          `Mode: ${finishedJob.mode} | ` +
          'View full details in dashboard',
      });

    finishedJob.results.slice(0, 5).forEach((res, i) => {
      const serverName =
        res.invite.community?.name || res.invite.code;

      const members = res.invite.community?.approximateMemberCount
        ? ` (${res.invite.community.approximateMemberCount.toLocaleString()} members)`
        : '';

      const link = `[${serverName}](${res.invite.canonicalUrl})`;

      embed.addFields({
        name: `#${i + 1} • Score ${res.score}/100: ${serverName}`,
        value:
          `${link}${members}\n` +
          `Status: \`${res.invite.status}\` | ` +
          `Lang: \`${res.detectedLanguage}\`\n` +
          `*${res.scoreBreakdown.explanations
            .slice(0, 2)
            .join(' • ')}*`,
      });
    });

    await interaction.followUp({ embeds: [embed] });
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
    const results = await repo.getJobResults(jobId);

    if (results.length === 0) {
      await interaction.editReply({
        content: `No results stored for job \`${jobId}\` yet.`,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Stored Results for ${jobId}`)
      .setColor(0x5865f2)
      .setDescription(
        `Displaying top ${Math.min(results.length, 5)} ` +
        `of ${results.length} total results:`
      );

    results.slice(0, 5).forEach((r, idx) => {
      embed.addFields({
        name:
          `#${idx + 1} - Score ${r.score}/100: ` +
          `${r.invite.community?.name || r.invite.code}`,
        value:
          `Link: ${r.invite.canonicalUrl}\n` +
          `Status: \`${r.invite.status}\` | ` +
          `Members: ${r.invite.community?.approximateMemberCount || 'Hidden'}`,
      });
    });

    await interaction.editReply({ embeds: [embed] });
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
