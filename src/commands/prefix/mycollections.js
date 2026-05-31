const { EmbedBuilder } = require('discord.js');
const { getNFTData } = require('../../services/hederaService');
const { getVerifiedWalletsByUser } = require('../../database/models/rules');
const { TOKEN_IDS } = require('../../utils/constants');

module.exports = {
  name: 'mycollections',
  description: 'Display your NFT collections with stats',
  
  async execute(message, args, client) {
    try {
      // Show typing indicator
      await message.channel.sendTyping();

      // Get user's verified wallet
      const userWallets = await getVerifiedWalletsByUser(message.author.id, message.guildId);
      if (!userWallets || userWallets.length === 0) {
        return message.reply('❌ You need to verify your wallet first using `/verify-wallet`');
      }

      const walletAddress = userWallets[0].wallet_address;
      console.log(`🔍 Fetching collections for ${message.author.tag} wallet: ${walletAddress}`);

      // Fetch NFT data
      const nftData = await getNFTData(walletAddress);
      if (!nftData.ownsToken || nftData.serials.length === 0) {
        return message.reply('📭 No NFTs found in your verified wallet.');
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`📦 ${message.author.username}'s NFT Collections`)
        .setDescription(`**Wallet:** \`${walletAddress}\``)
        .setThumbnail(message.author.displayAvatarURL());

      // Add collection stats
      let collectionCount = 0;
      let collectionsInfo = '';

      Object.entries(nftData.tokenBreakdown || {}).forEach(([tokenId, info]) => {
        if (info.count === 0) return;

        const serials = info.serials || [];
        const sortedSerials = serials.sort((a, b) => a - b);
        const minSerial = sortedSerials[0];
        const maxSerial = sortedSerials[sortedSerials.length - 1];
        const avgSerial = Math.round(
          sortedSerials.reduce((a, b) => a + b, 0) / sortedSerials.length
        );

        const tokenIndex = TOKEN_IDS.indexOf(tokenId);
        const collectionName = `Collection ${tokenIndex + 1}`;

        collectionsInfo += `\n🎨 **${collectionName}** (\`${tokenId}\`)\n`;
        collectionsInfo += `  • **Count:** ${info.count} NFT${info.count !== 1 ? 's' : ''}\n`;
        collectionsInfo += `  • **Serial Range:** #${minSerial} → #${maxSerial}\n`;
        collectionsInfo += `  • **Avg Serial:** #${avgSerial}\n`;
        if (minSerial <= 100) {
          collectionsInfo += `  • 🔥 **Contains low serials!**\n`;
        }

        collectionCount++;
      });

      if (collectionsInfo) {
        embed.addFields({
          name: '📊 Your Collections',
          value: collectionsInfo,
          inline: false
        });
      }

      // Add summary
      embed.addFields({
        name: '📈 Summary',
        value: `**Total Collections:** ${collectionCount}\n**Total NFTs:** ${nftData.serials.length}`,
        inline: false
      });

      embed.setFooter({
        text: `Updated at ${new Date().toLocaleString()}`,
        iconURL: message.author.displayAvatarURL()
      });

      await message.reply({ embeds: [embed] });
      console.log(`✅ Mycollections command executed for ${message.author.tag}`);

    } catch (error) {
      console.error('❌ Error in mycollections command:', error);
      message.reply('❌ Something went wrong. Please try again later.').catch(console.error);
    }
  }
};
