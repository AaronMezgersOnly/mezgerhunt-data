const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

// Initialize data structure
const data = {
  lastUpdated: new Date().toISOString(),
  sources: ['Rennlist', 'PelicanParts'],
  listings: []
};

// Function to scrape Rennlist forums
async function scrapeRennlist() {
  try {
    console.log('Scraping Rennlist...');
    
    // Example URL - replace with actual Rennlist forum URL for Mezger engines
    const url = 'https://rennlist.com/forums/market/';
    
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // This is a simplified example - you'll need to adjust selectors based on actual site structure
    $('.threadbit').each((index, element) => {
      // Check if title contains Mezger-related keywords
      const title = $(element).find('.title').text().trim();
      if (title.toLowerCase().includes('mezger') || 
          title.toLowerCase().includes('gt3') || 
          title.toLowerCase().includes('turbo')) {
        
        const listing = {
          title: title,
          price: $(element).find('.price').text().trim() || 'Contact seller',
          url: 'https://rennlist.com' + $(element).find('a.title').attr('href'),
          source: 'Rennlist',
          date: $(element).find('.date').text().trim() || new Date().toISOString().split('T')[0],
          // Add placeholder for image
          imageUrl: '/placeholder.svg?height=200&width=200'
        };
        data.listings.push(listing);
      }
    });
    
    console.log(`Found ${data.listings.length} listings on Rennlist`);
  } catch (error) {
    console.error('Error scraping Rennlist:', error.message);
    // Continue execution even if this source fails
  }
}

// Function to scrape Pelican Parts
async function scrapePelicanParts() {
  try {
    console.log('Scraping Pelican Parts...');
    
    // Example URL - replace with actual Pelican Parts URL for Mezger engines
    const url = 'https://www.pelicanparts.com/classified/search.htm';
    
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // This is a simplified example - you'll need to adjust selectors based on actual site structure
    $('.classifiedListing').each((index, element) => {
      // Check if title contains Mezger-related keywords
      const title = $(element).find('.title').text().trim();
      if (title.toLowerCase().includes('mezger') || 
          title.toLowerCase().includes('gt3') || 
          title.toLowerCase().includes('turbo')) {
        
        const listing = {
          title: title,
          price: $(element).find('.price').text().trim() || 'Contact seller',
          url: $(element).find('a.title').attr('href'),
          source: 'Pelican Parts',
          date: $(element).find('.date').text().trim() || new Date().toISOString().split('T')[0],
          // Add placeholder for image
          imageUrl: '/placeholder.svg?height=200&width=200'
        };
        
        data.listings.push(listing);
      }
    });
    
    console.log(`Found ${data.listings.length} listings on Pelican Parts`);
  } catch (error) {
    console.error('Error scraping Pelican Parts:', error.message);
    // Continue execution even if this source fails
  }
}

// Add mock data for testing
function addMockData() {
  console.log('Adding mock data...');
  
  // Add some mock listings to ensure we have data even if scraping fails
  const mockListings = [
    {
      title: "2004 Porsche 996 GT3",
      price: "$89,500",
      url: "https://example.com/listing/123",
      source: "Mock Data",
      date: new Date().toISOString().split('T')[0],
      imageUrl: "/placeholder.svg?height=200&width=200"
    },
    {
      title: "2011 Porsche 997 GT3 RS 4.0",
      price: "$495,000",
      url: "https://example.com/listing/456",
      source: "Mock Data",
      date: new Date().toISOString().split('T')[0],
      imageUrl: "/placeholder.svg?height=200&width=200"
    },
    {
      title: "2007 Porsche 997 Turbo",
      price: "$110,000",
      url: "https://example.com/listing/789",
      source: "Mock Data",
      date: new Date().toISOString().split('T')[0],
      imageUrl: "/placeholder.svg?height=200&width=200"
    }
  ];
  
  data.listings = [...data.listings, ...mockListings];
  console.log(`Added ${mockListings.length} mock listings`);
}

// Main function to run all scrapers
async function runScrapers() {
  try {
    // Clear listings array before scraping
    data.listings = [];
    
    // Run scrapers
    await scrapeRennlist();
    await scrapePelicanParts();
    
    // If we didn't find any listings, add mock data
    if (data.listings.length === 0) {
      addMockData();
    }
    
    // Update timestamp
    data.lastUpdated = new Date().toISOString();
    
    // Write data to file
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
    console.log(`Successfully wrote ${data.listings.length} listings to data.json`);
    
  } catch (error) {
    console.error('Error running scrapers:', error);
    
    // Ensure we at least have mock data
    addMockData();
    
    // Write data to file even if there was an error
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
    console.log(`Wrote ${data.listings.length} listings to data.json after error`);
  }
}

// Run the scrapers
runScrapers();
