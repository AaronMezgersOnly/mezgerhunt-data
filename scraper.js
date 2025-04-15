// scraper.js
import axios from 'axios';
import cheerio from 'cheerio';
import fs from 'fs/promises';

// Array to store all listings
const allListings = {
  cars: [],
  parts: [],
  lastUpdated: new Date().toISOString()
};

// Function to scrape Bring A Trailer
async function scrapeBringATrailer() {
  try {
    console.log('Scraping Bring A Trailer...');
    const response = await axios.get('https://bringatrailer.com/porsche/911-gt3-gt2/');
    const $ = cheerio.load(response.data);
    
    $('.bat-grid-item-image').each((index, element) => {
      const title = $(element).find('.bat-grid-item-title').text().trim();
      const priceText = $(element).find('.bat-grid-item-details-price').text().trim();
      const price = parseInt(priceText.replace(/\$|,/g, '')) || null;
      const link = $(element).find('a').attr('href');
      const imageUrl = $(element).find('img').attr('src');
      
      // Only add if it contains Mezger-related keywords
      if (title.match(/GT3|GT2|Turbo|Mezger/i)) {
        allListings.cars.push({
          id: `bat-${Date.now()}-${index}`,
          type: 'car',
          title,
          price,
          image: imageUrl,
          source: 'bringatrailer',
          link,
          dateScraped: new Date().toISOString(),
          status: 'active'
        });
      }
    });
    
    console.log(`Found ${allListings.cars.length} cars on Bring A Trailer`);
  } catch (error) {
    console.error('Error scraping Bring A Trailer:', error.message);
  }
}

// Function to scrape Pelican Parts
async function scrapePelicanParts() {
  try {
    console.log('Scraping Pelican Parts...');
    const response = await axios.get('https://www.pelicanparts.com/catalog/SuperCat/996/POR_996_ENGINE_pg1.htm');
    const $ = cheerio.load(response.data);
    
    $('.product-listing').each((index, element) => {
      const title = $(element).find('.product-title').text().trim();
      const priceText = $(element).find('.product-price').text().trim();
      const price = parseInt(priceText.replace(/\$|,/g, '')) || null;
      const link = 'https://www.pelicanparts.com' + $(element).find('a').attr('href');
      const imageUrl = $(element).find('img').attr('src');
      const partNumber = $(element).find('.product-number').text().trim();
      
      allListings.parts.push({
        id: `pelican-${Date.now()}-${index}`,
        type: 'part',
        title,
        partNumber,
        price,
        image: imageUrl,
        source: 'pelicanparts',
        link,
        dateScraped: new Date().toISOString(),
        status: 'active',
        inStock: $(element).find('.in-stock').length > 0
      });
    });
    
    console.log(`Found ${allListings.parts.length} parts on Pelican Parts`);
  } catch (error) {
    console.error('Error scraping Pelican Parts:', error.message);
  }
}

// Add more scraper functions for other sites

// Main function to run all scrapers
async function runScrapers() {
  // Reset listings
  allListings.cars = [];
  allListings.parts = [];
  allListings.lastUpdated = new Date().toISOString();
  
  // Run all scrapers
  await scrapeBringATrailer();
  await scrapePelicanParts();
  // Add more scrapers here
  
  // Save data to JSON file
  await fs.writeFile('data.json', JSON.stringify(allListings, null, 2));
  console.log('Data saved to data.json');

  // Add to your scraper.js
const axiosInstance = axios.create({
  headers: {
    'User-Agent': 'MezgerHunt Data Collector (contact@youremail.com)',
  },
  timeout: 30000
});

// Add delay between requests
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Use in your scraper functions
await delay(2000); // 2-second delay between requests
}

// Run the scrapers
runScrapers();