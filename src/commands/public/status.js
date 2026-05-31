const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getVerifiedWalletsByUser } = require('../../database/models/rules');
const { getNFTData } = require('../../services/hederaService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check your wallet verification status'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const userVerifications = await getVerifiedWalletsByUser(interaction.user.id, interaction.guildId);

      const statusEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📊 Your Verification Status')
        .setThumbnail(interaction.user.displayAvatarURL());

      if (userVerifications.length === 0) {
        // User is not verified
        statusEmbed
          .setColor('#ff9900')
          .setDescription('❌ **Not Verified**\n\nYou haven\'t verified any wallets yet!')
          .addFields(
            {
              name: '🔐 Get Started',
              value: 'Use `/verify-wallet` to connect your Hedera wallet and get roles!',
              inline: false
            },
            {
              name: '❓ Need Help?',
              value: 'Use `/help` for detailed instructions.',
              inline: false
            }
          );
      } else {
        // User has verified wallets
        statusEmbed
          .setColor('#00ff00')
          .setDescription('✅ **Verified!**\n\nHere are your verified wallets:');

        for (let i = 0; i < userVerifications.length; i++) {
          const verification = userVerifications[i];
          const walletNumber = userVerifications.length > 1 ? ` #${i + 1}` : '';
          
          // Get current roles for this user
          const currentRoles = interaction.member.roles.cache
            .filter(role => role.name !== '@everyone')
            .map(role => role.name)
            .join(', ') || 'None';

          statusEmbed.addFields(
            {
              name: `💼 Wallet${walletNumber}`,
              value: `**Address:** \`${verification.wallet_address}\`\n` +
                     `**Tokens:** ${verification.last_nft_count}\n` +
                     `**Serials:** ${verification.last_serials || 'None'}\n` +
                     `**Last Checked:** <t:${Math.floor(new Date(verification.last_checked).getTime() / 1000)}:R>`,
              inline: userVerifications.length === 1 ? false : true
            }
          );
        }

        // Add current roles
        const currentRoles = interaction.member.roles.cache
          .filter(role => role.name !== '@everyone')
          .map(role => role.name)
          .join(', ') || 'None';

        statusEmbed.addFields(
          {
            name: '🎭 Current Roles',
            value: currentRoles,
            inline: false
          },
          {
            name: '🔄 Auto-Updates',
            value: 'Your roles are automatically updated every 30 minutes based on your current token holdings.',
            inline: false
          }
        );
      }

      statusEmbed.setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      });

      await interaction.editReply({ embeds: [statusEmbed] });

      console.log(`✅ Status command used by ${interaction.user.tag}`);

    } catch (error) {
      console.error('❌ Error in status command:', error);
      
      const errorMessage = 'Sorry, there was an error retrieving your status. Please try again or contact an admin.';
      
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};
