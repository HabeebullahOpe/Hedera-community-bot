const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getNFTData, fetchNFTMetadata } = require('../../services/hederaService');
const { getVerifiedWalletsByUser } = require('../../database/models/rules');

function getRarityTier(serial, maxSerial) {
  // Assign rarity tiers based on serial number position
  const percentile = (serial / maxSerial) * 100;

  if (percentile <= 5) return { tier: 'Mythic', emoji: '👑', color: 0xFF6B9D };
  if (percentile <= 15) return { tier: 'Legendary', emoji: '🏆', color: 0xFF8C42 };
  if (percentile <= 30) return { tier: 'Epic', emoji: '💜', color: 0xB19CD9 };
  if (percentile <= 50) return { tier: 'Rare', emoji: '💎', color: 0x3498DB };
  return { tier: 'Uncommon', emoji: '✨', color: 0x2ECC71 };
}

function formatAccountId(accountId) {
  if (!accountId) return 'Unknown';
  return accountId.includes('.') ? accountId : accountId;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('myrares')
    .setDescription('Show your rarest Hedera NFTs with rarity tiers')
    .addStringOption(option =>
      option.setName('accountid')
        .setDescription('Optional Hedera account ID to check')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      let accountId = interaction.options.getString('accountid');
      if (!accountId) {
        const verifiedWallets = await getVerifiedWalletsByUser(interaction.user.id, interaction.guildId);
        if (verifiedWallets.length === 0) {
          await interaction.editReply({
            content: '❌ You have not verified a wallet yet. Use `/verify-wallet` or pass an `accountid` option.'
          });
          return;
        }
        accountId = verifiedWallets[0].wallet_address;
      }

      // Fetch NFT data
      const nftData = await getNFTData(accountId);

      if (!nftData.ownsToken || nftData.serials.length === 0) {
        await interaction.editReply({
          content: '📭 No NFTs found in this wallet or wallet is not verified.'
        });
        return;
      }

      // Sort serials and compute rarity tiers
      const sortedSerials = [...nftData.serials].sort((a, b) => a - b);
      const maxSerial = Math.max(...sortedSerials);
      
      const rarityData = sortedSerials.slice(0, 12).map(serial => {
        const rarity = getRarityTier(serial, maxSerial);
        return {
          serial,
          ...rarity
        };
      });

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🔮 Your Rarest NFTs')
        .setDescription(`Showing ${rarityData.length} of ${nftData.serials.length} NFTs by rarity`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          {
            name: '💼 Wallet',
            value: `\`${accountId}\``,
            inline: false
          },
          {
            name: '📊 Total Holdings',
            value: `${nftData.serials.length} NFT${nftData.serials.length !== 1 ? 's' : ''}`,
            inline: true
          },
          {
            name: '🏷 Rarity Breakdown',
            value: Object.entries(nftData.tokenBreakdown || {})
              .filter(([, info]) => info.count > 0)
              .map(([tokenId, info]) => `• \`${tokenId}\`: ${info.count} item${info.count === 1 ? '' : 's'}`)
              .join('\n') || 'N/A',
            inline: true
          }
        );

      // Add rarity tier sections
      const legendaryCount = rarityData.filter(r => r.tier === 'Legendary').length;
      const epicCount = rarityData.filter(r => r.tier === 'Epic').length;
      const rareCount = rarityData.filter(r => r.tier === 'Rare').length;

      let tiersSummary = '';
      if (legendaryCount > 0) tiersSummary += `🏆 **Legendary:** ${legendaryCount}\n`;
      if (epicCount > 0) tiersSummary += `💜 **Epic:** ${epicCount}\n`;
      if (rareCount > 0) tiersSummary += `💎 **Rare:** ${rareCount}`;

      if (tiersSummary) {
        embed.addFields({
          name: '⭐ Rarity Distribution',
          value: tiersSummary,
          inline: false
        });
      }

      // Add top serials
      const serialsList = rarityData
        .map(r => `${r.emoji} **#${r.serial}** — *${r.tier}*`)
        .join('\n');

      embed.addFields({
        name: '✨ Rarest Serials',
        value: serialsList || 'No data',
        inline: false
      });

      embed.setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      });

      await interaction.editReply({ embeds: [embed] });
      console.log(`✅ Myrares command executed for ${accountId}`);

    } catch (error) {
      console.error('❌ Error executing myrares command:', error);
      await interaction.editReply({
        content: '❌ Something went wrong while fetching your rarity report. Please try again later.'
      });
    }
  }
};
