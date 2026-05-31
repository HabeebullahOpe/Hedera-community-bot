const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getNFTData } = require('../../services/hederaService');
const { getVerifiedWalletsByUser } = require('../../database/models/rules');

function formatSerials(serials, max = 12) {
  if (!serials || serials.length === 0) return 'None';
  const formatted = serials.slice(0, max).map(serial => `#${serial}`).join(', ');
  return serials.length > max ? `${formatted}, ... (+${serials.length - max} more)` : formatted;
}

function buildRarityBadge(nftData) {
  if (!nftData.ownsToken) {
    return {
      title: 'No NFTs Found',
      description: 'This wallet does not currently hold any configured Hedera NFTs.'
    };
  }

  const quantity = nftData.quantity;
  const lowSerials = nftData.serials.filter(serial => Number(serial) > 0 && Number(serial) <= 10);

  let title = 'Common Collector';
  let emoji = '🪙';
  let text = 'You are building a collection! Keep holding and discovering rarer pieces.';

  if (quantity === 1) {
    title = 'Mythic Holder';
    emoji = '🌟';
    text = 'A rare single piece is powerful. This wallet stands out!';
  } else if (quantity <= 3) {
    title = 'Legendary Holder';
    emoji = '💎';
    text = 'A very rare collection with strong rarity potential.';
  } else if (quantity <= 6) {
    title = 'Epic Collector';
    emoji = '⚡';
    text = 'A strong collection with excellent rarity flavor.';
  } else if (quantity <= 12) {
    title = 'Rare Collector';
    emoji = '✨';
    text = 'A rare collection with good depth across token drops.';
  } else {
    title = 'Uncommon Collector';
    emoji = '🔥';
    text = 'A broad collection that shows strong support and participation.';
  }

  if (lowSerials.length > 0) {
    text += `\n\n💎 Low serial rarity detected: ${formatSerials(lowSerials, 5)}`;
  }

  return {
    title: `${emoji} ${title}`,
    description: text
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('myrare')
    .setDescription('See a fun rarity-style summary for your Hedera NFTs')
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

      const nftData = await getNFTData(accountId);
      const rarity = buildRarityBadge(nftData);
      const tokenSummary = Object.entries(nftData.tokenBreakdown || {})
        .filter(([, info]) => info.count > 0)
        .map(([tokenId, info]) => `• \`${tokenId}\`: ${info.count} item${info.count === 1 ? '' : 's'}`)
        .join('\n') || 'No configured NFTs found.';

      const embed = new EmbedBuilder()
        .setColor('#7C3AED')
        .setTitle('🔮 NFT Rarity Report')
        .setDescription(rarity.description)
        .addFields(
          {
            name: '💼 Wallet',
            value: `\`${accountId}\``,
            inline: false
          },
          {
            name: '📦 Total NFTs',
            value: `${nftData.quantity}`,
            inline: true
          },
          {
            name: '🏷 Rarity Tier',
            value: rarity.title,
            inline: true
          },
          {
            name: '🧩 Collection Breakdown',
            value: tokenSummary,
            inline: false
          },
          {
            name: '✨ Serial Highlights',
            value: formatSerials(nftData.serials, 12),
            inline: false
          }
        )
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ Error executing myrare command:', error);
      await interaction.editReply({
        content: '❌ Something went wrong while fetching your rarity report. Please try again later.'
      });
    }
  }
};
