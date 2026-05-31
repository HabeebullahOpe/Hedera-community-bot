const axios = require('axios');
const { TOKEN_IDS, HEDERA_MIRROR_NODE_URL } = require('../utils/constants');

async function getNFTData(accountId) {
  try {
    console.log(`🌐 Checking NFTs for account: ${accountId}`);
    console.log(`🎯 Token IDs: ${TOKEN_IDS.join(', ')}`);

    let totalQuantity = 0;
    let allSerials = [];
    const tokenBreakdown = {};

    // Query each token ID and combine results
    for (const tokenId of TOKEN_IDS) {
      try {
        const url = `${HEDERA_MIRROR_NODE_URL}/api/v1/accounts/${accountId}/nfts?token.id=${tokenId}`;
        console.log(`🔍 Querying: ${url}`);

        const response = await axios.get(url);
        const nfts = response.data.nfts || [];

        console.log(`📊 Token ${tokenId}: ${nfts.length} NFTs found`);

        const serials = nfts.map(nft => nft.serial_number);
        tokenBreakdown[tokenId] = {
          count: nfts.length,
          serials
        };

        totalQuantity += nfts.length;
        allSerials = allSerials.concat(serials);
      } catch (tokenError) {
        console.error(`❌ Error querying token ${tokenId}:`, tokenError.message);
        tokenBreakdown[tokenId] = {
          count: 0,
          serials: []
        };
        // Continue with other tokens even if one fails
      }
    }

    console.log(`📈 Combined results: ${totalQuantity} total NFTs across all configured tokens`);

    return {
      ownsToken: totalQuantity > 0,
      quantity: totalQuantity,
      serials: allSerials,
      tokenBreakdown
    };
  } catch (error) {
    console.error('❌ Hedera API error:', error.message);
    console.error('❌ Full error:', error);
    return { ownsToken: false, quantity: 0, serials: [], tokenBreakdown: {} };
  }
}

async function fetchNFTMetadata(tokenId, serial) {
  try {
    console.log(`🔍 Fetching metadata for NFT ${tokenId}:${serial}`);
    
    // Step 1: Get NFT metadata from mirror node
    const url = `${HEDERA_MIRROR_NODE_URL}/api/v1/tokens/${tokenId}/nfts/${serial}`;
    const response = await axios.get(url);
    const nftData = response.data;

    if (!nftData || !nftData.metadata) {
      console.warn(`⚠️ No metadata found for ${tokenId}:${serial}`);
      return null;
    }

    // Step 2: Decode metadata (base64 encoded)
    let metadataString;
    try {
      metadataString = Buffer.from(nftData.metadata, 'base64').toString('utf-8');
    } catch (decodeError) {
      console.error(`❌ Failed to decode metadata for ${tokenId}:${serial}`, decodeError.message);
      return null;
    }

    // Step 3: Check if it's an IPFS hash or JSON
    if (metadataString.startsWith('ipfs://')) {
      const ipfsHash = metadataString.replace('ipfs://', '');
      const ipfsUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
      console.log(`📦 Fetching IPFS metadata from ${ipfsUrl}`);

      try {
        const ipfsResponse = await axios.get(ipfsUrl, { timeout: 5000 });
        const metadata = ipfsResponse.data;
        console.log(`✅ Successfully fetched IPFS metadata for ${tokenId}:${serial}`);
        return metadata;
      } catch (ipfsError) {
        console.error(`❌ Failed to fetch IPFS metadata for ${tokenId}:${serial}:`, ipfsError.message);
        return null;
      }
    }

    // Step 4: Try to parse as JSON
    try {
      const metadata = JSON.parse(metadataString);
      console.log(`✅ Successfully parsed metadata for ${tokenId}:${serial}`);
      return metadata;
    } catch (parseError) {
      console.error(`❌ Failed to parse metadata for ${tokenId}:${serial}:`, parseError.message);
      return { image: metadataString };
    }

  } catch (error) {
    console.error(`❌ Error fetching NFT metadata:`, error.message);
    return null;
  }
}

module.exports = { getNFTData, fetchNFTMetadata };
