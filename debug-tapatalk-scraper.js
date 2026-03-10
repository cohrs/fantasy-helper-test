import axios from 'axios';

async function debugTapatalkScraper() {
  console.log('🔍 Fetching Tapatalk page to debug scraper...\n');
  
  const TARGET_URL = "https://www.tapatalk.com/groups/asshatrotoleagues/2026-draft-player-list-t1235.html";
  
  try {
    const { data } = await axios.get(TARGET_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    let cleanContent = data.replace(/&nbsp;/g, " ")
      .replace(/&#160;/g, " ")
      .replace(/\u00A0/g, " ")
      .replace(/&middot;/g, "·");

    cleanContent = cleanContent.replace(/<\/?[^>]+(>|$)/g, "\n");
    const lines = cleanContent.split('\n');
    
    // Look for Colt Keith specifically
    console.log('🔍 Looking for Colt Keith entries...\n');
    
    const coltKeithLines = lines.filter(line => 
      line.toLowerCase().includes('colt') && line.toLowerCase().includes('keith')
    );
    
    if (coltKeithLines.length > 0) {
      console.log('✅ Found Colt Keith entries:');
      coltKeithLines.forEach((line, idx) => {
        console.log(`  ${idx + 1}. "${line.trim()}"`);
      });
    } else {
      console.log('❌ No Colt Keith entries found');
    }
    
    // Also look for some other Hulkamania picks to see the pattern
    console.log('\n🔍 Looking for other Hulkamania entries...\n');
    
    const hulkamaniaLines = lines.filter(line => 
      line.toLowerCase().includes('hulkamania')
    ).slice(0, 5); // Just first 5
    
    if (hulkamaniaLines.length > 0) {
      console.log('✅ Found Hulkamania entries:');
      hulkamaniaLines.forEach((line, idx) => {
        console.log(`  ${idx + 1}. "${line.trim()}"`);
      });
    }
    
    // Look for entries around rank 226 (Colt Keith's rank)
    console.log('\n🔍 Looking for entries around rank 226...\n');
    
    const rank226Lines = lines.filter(line => {
      const rankMatch = line.match(/(?:·*\s*)(\d+)\.\s+/);
      if (rankMatch) {
        const rank = parseInt(rankMatch[1]);
        return rank >= 224 && rank <= 228;
      }
      return false;
    });
    
    if (rank226Lines.length > 0) {
      console.log('✅ Found entries around rank 226:');
      rank226Lines.forEach((line, idx) => {
        console.log(`  ${idx + 1}. "${line.trim()}"`);
      });
    }
    
  } catch (error) {
    console.error('Error fetching Tapatalk:', error.message);
  }
}

debugTapatalkScraper();