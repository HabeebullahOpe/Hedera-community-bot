const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getNFTData } = require('../../services/hederaService');
const { getVerifiedWalletsByUser } = require('../../database/models/rules');

function formatSerialList(serials, max = 20) {
  if (!serials || serials.length === 0) return 'None';
  const list = serials.slice(0, max).map(serial => `#${serial}`).join(', ');
  return serials.length > max ? `${list}, ... (+${serials.length - max} more)` : list;
}

function buildCollectionFields(tokenBreakdown) {
  const lines = Object.entries(tokenBreakdown || {})
    .filter(([, info]) => info.count > 0)
    .map(([tokenId, info]) => `• \\`${tokenId}\\`: ${info.count} item${info.count === 1 ? '' : 's'}`);

  return lines.length > 0 ? lines.join('\n') : 'No configured NFTs found for this wallet.';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mynfts')
    .setDescription('Show your Hedera NFT holdings in a clean summary')
    .addStringOption(option =>
      option.setName('accountid')
        .setDescription('Optional Hedera account ID to inspect')
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
            content: '❌ You have not verified a wallet yet. Use `/verify-wallet` or pass an `accountid` option to inspect your NFTs.'
          });
          return;
        }
        accountId = verifiedWallets[0].wallet_address;
      }

      const nftData = await getNFTData(accountId);
      const collectionFields = buildCollectionFields(nftData.tokenBreakdown);
      const serialsText = formatSerialList(nftData.serials, 20);

      const embed = new EmbedBuilder()
        .setColor('#22C55E')
        .setTitle('📦 Your NFT Collection')
        .setDescription('A snapshot of your Hedera NFT holdings for the configured token collections.')
        .addFields(
          {
            name: '💼 Wallet',
            value: `\`${accountId}\``,
            inline: false
          },
          {
            name: '📊 Total NFTs',
            value: `${nftData.quantity}`,
            inline: true
          },
          {
            name: '🔗 Collections',
            value: collectionFields,
            inline: false
          },
          {
            name: '✨ Serial Numbers',
            value: serialsText,
            inline: false
          }
        )
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Error executing mynfts command:', error);
      await interaction.editReply({
        content: '❌ Something went wrong while fetching your NFTs. Please try again later.'
      });
    }
  }
};
