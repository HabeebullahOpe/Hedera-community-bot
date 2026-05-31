const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRulesByGuild } = require('../../database/models/rules');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with verification and see server rules'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      // Get all rules from database for this guild
      const rules = await getRulesByGuild(interaction.guildId);

      // Create help embed
      // TODO: Customize this help message for your community
      const helpEmbed = new EmbedBuilder()
        .setColor('#00ff00') // Customize this color for your brand
        .setTitle('🆘 Help & Information')
        .setDescription('Learn how to verify your wallet and unlock roles based on your token holdings!')
        .addFields(
          {
            name: '🔐 How to Verify Your Wallet',
            value: 'Use the `/verify-wallet` command with your Hedera account ID to link your wallet and automatically receive roles based on your token holdings.\n\n' +
                   '**Example:**\n' +
                   '`/verify-wallet accountid:0.0.1231234`\n\n' +
                   '**What happens next?**\n' +
                   '• Bot checks your token holdings on Hedera\n' +
                   '• Roles are assigned based on server rules\n' +
                   '• Your roles update automatically every 30 minutes',
            inline: false
          }
        );

      // Add rules section
      if (rules.length > 0) {
        let rulesText = '';
        rules.forEach((rule, index) => {
          const ruleNumber = index + 1;
          const role = interaction.guild.roles.cache.get(rule.role_id);
          const roleName = role ? role.name : 'Unknown Role';

          if (rule.type === 'quantity') {
            rulesText += `**${ruleNumber}.** Own **${rule.value}+ Token(s)** → Get **${roleName}** role\n`;
          } else if (rule.type === 'serial') {
            rulesText += `**${ruleNumber}.** Own **Token #${rule.value}** → Get **${roleName}** role\n`;
          }
        });

        helpEmbed.addFields({
          name: '📋 Server Role Rules',
          value: rulesText || 'No role rules configured yet.',
          inline: false
        });
      } else {
        helpEmbed.addFields({
          name: '📋 Server Role Rules',
          value: 'No role rules have been set up yet.\n\nAdmins can use `/set-rules` to create automatic role assignment rules based on token holdings.',
          inline: false
        });
      }

      // Add footer with additional info
      const { TOKEN_IDS } = require('../../utils/constants');
      helpEmbed.addFields(
        {
          name: '🎯 Token Collection Info',
          value: `**Token IDs:** \`${TOKEN_IDS.join('`, `')}\`\n**Network:** Hedera Mainnet`,
          inline: true
        },
        {
          name: '🔄 Automatic Role Updates',
          value: 'Your roles sync automatically every 30 minutes based on your current token holdings!',
          inline: true
        },
        {
          name: '📊 Check Verification Status',
          value: 'Use `/status` anytime to check if your wallet is verified and see your current roles!',
          inline: true
        },
        {
          name: '✨ Explore Your NFTs',
          value: 'Use `/mynfts` to see your NFT holdings and `/myrare` to get a rarity-style summary of your wallet.',
          inline: true
        }
      );

      helpEmbed.setFooter({
        text: 'Need help? Contact a server admin or moderator!',
        iconURL: interaction.client.user.displayAvatarURL()
      });

      await interaction.editReply({ embeds: [helpEmbed] });

      console.log(`✅ Help command used by ${interaction.user.tag}`);

    } catch (error) {
      console.error('❌ Error in help command:', error);
      
      const errorMessage = 'Sorry, there was an error retrieving help information. Please try again or contact an admin.';
      
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};
