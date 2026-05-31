const { EmbedBuilder } = require('discord.js');
const { getNFTData, fetchNFTMetadata } = require('../../services/hederaService');
const { getVerifiedWalletsByUser } = require('../../database/models/rules');
const axios = require('axios');
const sharp = require('sharp');
const { HEDERA_MIRROR_NODE_URL, TOKEN_IDS } = require('../../utils/constants');

module.exports = {
  name: 'myrares',
  description: 'Display all your NFTs with images in a grid',
  
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
      console.log(`🔍 Fetching NFTs for ${message.author.tag} wallet: ${walletAddress}`);

      // Fetch NFT data
      const nftData = await getNFTData(walletAddress);
      if (!nftData.ownsToken || nftData.serials.length === 0) {
        return message.reply('📭 No NFTs found in your verified wallet.');
      }

      const sortedSerials = [...nftData.serials].sort((a, b) => a - b);
      const tokenId = Object.keys(nftData.tokenBreakdown || {})[0];

      // Fetch all NFT metadata and images
      console.log(`📸 Fetching metadata and images for ${sortedSerials.length} NFTs...`);
      const nftMetadata = [];
      const imageUrls = [];

      for (let i = 0; i < sortedSerials.length; i++) {
        const serial = sortedSerials[i];
        try {
          const metadata = await fetchNFTMetadata(tokenId, serial);
          if (metadata?.image) {
            imageUrls.push({
              serial,
              url: metadata.image,
              name: metadata.name || `NFT #${serial}`
            });
            nftMetadata.push({ serial, metadata });
          }
        } catch (e) {
          console.warn(`⚠️ Could not fetch image for serial ${serial}`);
        }
      }

      console.log(`✅ Successfully fetched ${imageUrls.length} NFT images`);

      if (imageUrls.length === 0) {
        return message.reply('❌ Could not fetch images for your NFTs. Please try again later.');
      }

      // Create title embed with stats
      const titleEmbed = new EmbedBuilder()
        .setColor(0xFF6B9D)
        .setTitle(`🔮 ${message.author.username}'s NFTs (${sortedSerials.length})`)
        .setDescription(`**Wallet:** \`${walletAddress}\``)
        .setThumbnail(message.author.displayAvatarURL())
        .addFields({
          name: '📊 Collection Stats',
          value: `**Total NFTs:** ${sortedSerials.length}\n**Serial Range:** #${sortedSerials[0]} → #${sortedSerials[sortedSerials.length - 1]}`,
          inline: false
        })
        .setFooter({
          text: `${sortedSerials.length} NFTs found across 0.0.9656742`,
          iconURL: message.author.displayAvatarURL()
        });

      // Try to create a grid image from the first batch
      let gridImage = null;
      try {
        gridImage = await createNFTGrid(imageUrls.slice(0, 48)); // First 48 NFTs in grid
      } catch (gridError) {
        console.warn('⚠️ Could not create grid image:', gridError.message);
      }

      // Send title embed
      const titleMsg = await message.reply({ embeds: [titleEmbed] });

      // If we have a grid image, send it
      if (gridImage) {
        const gridEmbed = new EmbedBuilder()
          .setImage('attachment://nft-grid.png')
          .setFooter({
            text: `${imageUrls.slice(0, 48).length} NFTs displayed`,
          });

        await message.reply({
          embeds: [gridEmbed],
          files: [{
            attachment: gridImage,
            name: 'nft-grid.png'
          }]
        });
      }

      // Send detailed list of all NFTs
      const maxSerial = Math.max(...sortedSerials);
      const detailText = sortedSerials.map(serial => {
        const percentile = (serial / maxSerial) * 100;
        let tier = '✨';
        if (percentile <= 5) tier = '👑';
        else if (percentile <= 15) tier = '🏆';
        else if (percentile <= 30) tier = '💜';
        else if (percentile <= 50) tier = '💎';

        return `${tier} #${serial}`;
      }).join(' ');

      const detailEmbed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('✨ All NFT Serials')
        .setDescription(detailText)
        .setFooter({
          text: `${sortedSerials.length} total NFTs`,
          iconURL: message.author.displayAvatarURL()
        });

      await message.reply({ embeds: [detailEmbed] });

      console.log(`✅ Myrares command executed for ${message.author.tag}`);

    } catch (error) {
      console.error('❌ Error in myrares command:', error);
      message.reply('❌ Something went wrong. Please try again later.').catch(console.error);
    }
  }
};

async function createNFTGrid(nftList, gridSize = 10) {
  if (nftList.length === 0) return null;

  try {
    // Thumbnail size
    const thumbSize = 80;
    const padding = 2;
    const perRow = Math.ceil(Math.sqrt(nftList.length));

    // Create a canvas-like approach using sharp
    const images = [];
    const cols = Math.min(perRow, 10);
    const rows = Math.ceil(nftList.length / cols);

    // Fetch and resize images
    for (const nft of nftList) {
      try {
        const response = await axios.get(nft.url, { responseType: 'arraybuffer', timeout: 5000 });
        const resized = await sharp(response.data)
          .resize(thumbSize, thumbSize, { fit: 'cover' })
          .png()
          .toBuffer();

        images.push(resized);
      } catch (e) {
        console.warn(`⚠️ Could not fetch image for ${nft.serial}:`, e.message);
        // Add placeholder
        images.push(await createPlaceholder(thumbSize));
      }
    }

    // Build grid
    const canvasWidth = cols * (thumbSize + padding) + padding;
    const canvasHeight = rows * (thumbSize + padding) + padding;

    let composite = sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 3,
        background: { r: 30, g: 30, b: 30 }
      }
    });

    const compositeInput = [];
    for (let i = 0; i < images.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = col * (thumbSize + padding) + padding;
      const y = row * (thumbSize + padding) + padding;

      compositeInput.push({
        input: images[i],
        left: x,
        top: y
      });
    }

    const gridBuffer = await composite.composite(compositeInput).png().toBuffer();
    return gridBuffer;

  } catch (error) {
    console.error('❌ Error creating grid:', error.message);
    return null;
  }
}

async function createPlaceholder(size) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 50, g: 50, b: 50 }
    }
  })
    .composite([{
      input: Buffer.from(`<svg width="${size}" height="${size}"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="12">?</text></svg>`),
      left: 0,
      top: 0
    }])
    .png()
    .toBuffer();
}

        inline: false
      });

      // Add collection breakdown
      let collectionsText = Object.entries(nftData.tokenBreakdown || {})
        .filter(([, info]) => info.count > 0)
        .map(([tokenId, info]) => `• \`${tokenId}\`: ${info.count} NFT${info.count !== 1 ? 's' : ''}`)
        .join('\n');

      embed.addFields({
        name: '📦 Collections',
        value: collectionsText || 'N/A',
        inline: false
      });

      // Add main image if available
      if (mainImage) {
        embed.setImage(mainImage);
        embed.setFooter({ 
          text: `${mainName || 'Featured NFT'} • Showing top 9 of ${nftData.serials.length}`,
          iconURL: message.author.displayAvatarURL()
        });
      } else {
        embed.setFooter({
          text: `Showing top 9 of ${nftData.serials.length} • ${new Date().toLocaleString()}`,
          iconURL: message.author.displayAvatarURL()
        });
      }

      await message.reply({ embeds: [embed] });
      console.log(`✅ Myrares command executed for ${message.author.tag}`);

    } catch (error) {
      console.error('❌ Error in myrares command:', error);
      message.reply('❌ Something went wrong. Please try again later.').catch(console.error);
    }
  }
};
