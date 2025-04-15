const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

// Helper function for delays
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Define websites to scrape
const carListingSites = [
  // Your existing sites...
  
  {
    name: 'Bring a Trailer',
    url: 'https://bringatrailer.com/porsche/911-gt3-gt2/',
    selector: '.postcard',
    titleSelector: '.postcard-title',
    priceSelector: '.postcard-sold-price',
    linkSelector: 'a.postcard-image-link',
    baseUrl: '',
    customPriceExtractor: (element, $) => {
      const soldPrice = $(element).find('.postcard-sold-price').text().trim();
      if (soldPrice) {
        return soldPrice;
      } else {
        const bidPrice = $(element).find('.postcard-bid-price').text().trim();
        return bidPrice || 'Auction in progress';
      }
    }
  }
];

// Additional BaT URLs to scrape
const batAdditionalUrls = [
  'https://bringatrailer.com/porsche/911-turbo/',
  'https://bringatrailer.com/porsche/996/',
  'https://bringatrailer.com/porsche/997/'
];

// Rest of your code...

// Main scraping function
async function scrapeWebsites() {
  const allListings = {
    cars: [],
    parts: [],
    lastUpdated: new Date().toISOString()
  };

  // Scrape car listings
  for (const site of carListingSites) {
    try {
      console.log(`Scraping ${site.name}...`);
      const listings = await scrapeSite(site, 'car');
      allListings.cars = [...allListings.cars, ...listings];
      console.log(`Found ${listings.length} car listings on ${site.name}`);
      await delay(2000); // Add delay between sites
    } catch (error) {
      console.error(`Error scraping ${site.name}:`, error.message);
    }
  }
  
  // Scrape additional BaT URLs
  for (const url of batAdditionalUrls) {
    const batSite = {
      name: 'Bring a Trailer',
      url: url,
      selector: '.postcard',
      titleSelector: '.postcard-title',
      priceSelector: '.postcard-sold-price',
      linkSelector: 'a.postcard-image-link',
      baseUrl: '',
      customPriceExtractor: (element, $) => {
        const soldPrice = $(element).find('.postcard-sold-price').text().trim();
        if (soldPrice) {
          return soldPrice;
        } else {
          const bidPrice = $(element).find('.postcard-bid-price').text().trim();
          return bidPrice || 'Auction in progress';
        }
      }
    };
    
    try {
      console.log(`Scraping Bring a Trailer - ${url}...`);
      const listings = await scrapeSite(batSite, 'car');
      allListings.cars = [...allListings.cars, ...listings];
      console.log(`Found ${listings.length} car listings on Bring a Trailer - ${url}`);
      await delay(2000); // Add delay between requests
    } catch (error) {
      console.error(`Error scraping Bring a Trailer - ${url}:`, error.message);
    }
  }

  // Scrape parts listings
  // ... your existing parts scraping code ...

  // Save all listings to data.json
  fs.writeFileSync('data.json', JSON.stringify(allListings, null, 2));
  console.log(`Saved ${allListings.cars.length} car listings and ${allListings.parts.length} part listings to data.json`);
}

// Function to scrape a single site
async function scrapeSite(site, type) {
  // Your updated scrapeSite function with customPriceExtractor support
  // ... code from above ...
}

// Enhanced Mezger detection
function isMezgerRelated(title, description = '') {
  const keywords = ['mezger', 'gt3', 'gt2', 'turbo', '996', '997', 'porsche'];
  const mezgerModels = ['996 gt3', '997 gt3', '996 gt2', '997 gt2', '996 turbo', '997 turbo'];
  
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();
  
  // Check for keywords
  if (keywords.some(keyword => lowerTitle.includes(keyword))) {
    return true;
  }
  
  // Check for specific Mezger models
  if (mezgerModels.some(model => lowerTitle.includes(model))) {
    return true;
  }
  
  // Check description if available
  if (description && mezgerModels.some(model => lowerDesc.includes(model))) {
    return true;
  }
  
  return false;
}

// Helper function to extract price from text
function extractPrice(text) {
  if (!text || text === 'Auction in progress') return text;
  
  const priceMatch = text.match(/\$\s?[\d,]+(\.\d{2})?/);
  return priceMatch ? priceMatch[0] : 'Price not specified';
}

// Run the scraper
scrapeWebsites();