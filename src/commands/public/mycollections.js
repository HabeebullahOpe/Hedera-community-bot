const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getNFTData } = require('../../services/hederaService');
const { getVerifiedWalletsByUser } = require('../../database/models/rules');
const { TOKEN_IDS } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mycollections')
    .setDescription('Show your NFT collections grouped by collection type')
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

      // Fetch NFT data
      const nftData = await getNFTData(accountId);

      if (!nftData.ownsToken) {
        await interaction.editReply({
          content: '📭 No NFTs found in this wallet or wallet is not verified.'
        });
        return;
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('📦 Your NFT Collections')
        .setDescription('A breakdown of your Hedera NFT holdings by collection')
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields({
          name: '💼 Wallet',
          value: `\`${accountId}\``,
          inline: false
        });

      let totalValue = 0;
      let fieldCount = 0;

      // Add collection breakdown
      Object.entries(nftData.tokenBreakdown || {}).forEach(([tokenId, info]) => {
        if (info.count === 0) return;

        const serials = info.serials || [];
        const sortedSerials = serials.sort((a, b) => a - b);
        const minSerial = sortedSerials[0];
        const maxSerial = sortedSerials[sortedSerials.length - 1];
        const avgSerial = Math.round(
          sortedSerials.reduce((a, b) => a + b, 0) / sortedSerials.length
        );

        // Build collection field
        let collectionValue = `**Count:** ${info.count} NFT${info.count !== 1 ? 's' : ''}\n`;
        collectionValue += `**Serial Range:** #${minSerial} → #${maxSerial}\n`;
        collectionValue += `**Average Serial:** #${avgSerial}\n`;
        collectionValue += `**Rarity:** ${minSerial <= 100 ? '🔥 Contains low serials!' : '✨ Standard distribution'}`;

        // Find matching token name if available
        const tokenIndex = TOKEN_IDS.indexOf(tokenId);
        const collectionName = `Collection ${tokenIndex + 1}`;

        embed.addFields({
          name: `🎨 ${collectionName}`,
          value: `\`${tokenId}\`\n${collectionValue}`,
          inline: false
        });

        fieldCount++;
      });

      // Add summary footer
      embed.addFields({
        name: '📊 Summary',
        value: `**Total NFTs:** ${nftData.serials.length}\n**Total Collections:** ${fieldCount}`,
        inline: false
      });

      embed.setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      });

      await interaction.editReply({ embeds: [embed] });
      console.log(`✅ Mycollections command executed for ${accountId}`);

    } catch (error) {
      console.error('❌ Error executing mycollections command:', error);
      await interaction.editReply({
        content: '❌ Something went wrong while fetching your collections. Please try again later.'
      });
    }
  }
};
