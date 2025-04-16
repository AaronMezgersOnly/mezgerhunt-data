// Mezger Search - Web Scraper
import fs from 'fs/promises';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Configuration
const config = {
  sources: [
    {
      name: 'bringatrailer',
      displayName: 'Bring A Trailer',
      url: 'https://bringatrailer.com/porsche/911-gt3-gt2-turbo-mezger/',
      type: 'car',
      auctionUrl: 'https://bringatrailer.com/porsche/911-gt3-gt2-turbo-mezger/?q=mezger',
      completedUrl: 'https://bringatrailer.com/porsche/911-gt3-gt2-turbo-mezger/filters/?q=mezger'
    },
    {
      name: 'pelicanparts',
      displayName: 'Pelican Parts',
      url: 'https://www.pelicanparts.com/Porsche/catalog/SuperCat_Porsche_911_997_Engine.htm',
      type: 'part'
    }
  ],
  dataOutputPath: './data.json',
  auctionsOutputPath: './auctions.json',
  searchTerms: {
    cars: ['gt3', 'gt3 rs', 'gt2', 'gt2 rs', 'turbo', 'mezger'],
    parts: ['engine', 'mezger', 'gt3', 'gt2', 'turbo']
  },
  requestDelay: 2000, // 2 second delay between requests
  userAgent: 'MezgerSearch Data Collector (contact@youremail.com)'
};

// Create axios instance with custom headers
const axiosInstance = axios.create({
  headers: {
    'User-Agent': config.userAgent,
  },
  timeout: 30000
});

// Helper function to add delay between requests
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main scraper function
async function runScraper() {
  console.log('Starting Mezger Search Scraper...');

  // Initialize data structure
  const data = {
    cars: [],
    parts: [],
    lastUpdated: new Date().toISOString()
  };

  // Initialize auctions structure
  const auctions = [];

  // Try to load existing data if available
  try {
    const existingData = JSON.parse(await fs.readFile(config.dataOutputPath, 'utf8'));
    data.cars = existingData.cars || [];
    data.parts = existingData.parts || [];
    console.log(`Loaded ${data.cars.length} existing car listings and ${data.parts.length} existing part listings.`);
  } catch (error) {
    console.log('No existing data found or error reading file. Starting fresh.');
  }

  // Try to load existing auctions if available
  try {
    const existingAuctions = JSON.parse(await fs.readFile(config.auctionsOutputPath, 'utf8'));
    // Only keep auctions that haven't ended yet
    const now = new Date();
    const validAuctions = existingAuctions.filter(auction => {
      const endTime = new Date(auction.endTime);
      return endTime > now;
    });
    auctions.push(...validAuctions);
    console.log(`Loaded ${validAuctions.length} valid existing auction listings.`);
  } catch (error) {
    console.log('No existing auctions found or error reading file. Starting fresh.');
  }

  // Process each source
  for (const source of config.sources) {
    console.log(`Processing source: ${source.displayName} (${source.url})`);
    
    try {
      // Add delay between sources
      if (config.sources.indexOf(source) > 0) {
        console.log(`Waiting ${config.requestDelay}ms before next request...`);
        await delay(config.requestDelay);
      }
      
      if (source.name === 'bringatrailer') {
        // First scrape active auctions
        console.log(`Scraping active auctions from ${source.displayName}...`);
        await scrapeBATActiveAuctions(source, auctions);
        
        // Then scrape completed listings
        console.log(`Scraping completed listings from ${source.displayName}...`);
        await scrapeBATCompletedListings(source, data);
      } else {
        await scrapeWithCheerio(source, data);
      }
    } catch (error) {
      console.error(`Error processing ${source.name}:`, error);
    }
  }

  // Add some demo data for testing if needed
  if (data.cars.length < 3 || data.parts.length < 3) {
    addDemoData(data);
  }

  // Save the data
  await fs.writeFile(config.dataOutputPath, JSON.stringify(data, null, 2));
  console.log(`Data saved to ${config.dataOutputPath}`);
  console.log(`Total: ${data.cars.length} cars and ${data.parts.length} parts`);

  // Save the auctions
  await fs.writeFile(config.auctionsOutputPath, JSON.stringify(auctions, null, 2));
  console.log(`Auctions saved to ${config.auctionsOutputPath}`);
  console.log(`Total: ${auctions.length} active auctions`);
}

// Scrape using cheerio (better for simpler sites)
async function scrapeWithCheerio(source, data) {
  const response = await axiosInstance.get(source.url);
  const $ = cheerio.load(response.data);

  if (source.name === 'bringatrailer') {
    await scrapeBringATrailer($, source, data);
  } else if (source.name === 'pelicanparts') {
    await scrapePelicanParts($, source, data);
  } else {
    // Generic cheerio scraper for other sites
    if (source.type === 'car') {
      await scrapeGenericCarListings($, source, data);
    } else {
      await scrapeGenericPartListings($, source, data);
    }
  }
}

// Specific scraper for Bring A Trailer active auctions
async function scrapeBATActiveAuctions(source, auctions) {
  try {
    const response = await axiosInstance.get(source.auctionUrl);
    const $ = cheerio.load(response.data);
    
    // Find all auction listings
    const auctionListings = $('.auction-item');
    console.log(`Found ${auctionListings.length} potential active auctions on Bring A Trailer`);
    
    for (const element of auctionListings.toArray()) {
      try {
        const auctionEl = $(element);
        
        // Extract basic info
        const title = auctionEl.find('.auction-title').text().trim();
        
        // Skip if not a Mezger engine car
        if (!isMezgerCar(title)) continue;
        
        // Extract link
        const link = auctionEl.find('a.auction-link').attr('href') || '';
        if (!link) continue;
        
        // Create a unique ID for the listing
        const id = `bat-${Buffer.from(link).toString('base64').substring(0, 10)}`;
        
        // Check if we already have this auction
        const existingIndex = auctions.findIndex(auction => auction.id === id);
        if (existingIndex >= 0) {
          console.log(`Auction already exists: ${title}`);
          continue;
        }
        
        // Get more details from the auction page
        console.log(`Fetching details for auction: ${title}`);
        await delay(config.requestDelay); // Be nice to the server
        
        const auctionDetails = await fetchBATAuctionDetails(link);
        if (!auctionDetails) continue;
        
        // Extract model from title
        const model = extractModelFromTitle(title);
        
        // Create auction object
        const auctionListing = {
          id,
          type: 'auction',
          model,
          title,
          description: auctionDetails.description,
          currentBid: auctionDetails.currentBid,
          year: extractYear(title),
          mileage: auctionDetails.mileage,
          location: auctionDetails.location,
          engine: auctionDetails.engine || '3.6L Mezger Flat-6',
          transmission: auctionDetails.transmission,
          exteriorColor: auctionDetails.exteriorColor,
          interiorColor: auctionDetails.interiorColor,
          vin: auctionDetails.vin,
          status: 'auction',
          endTime: auctionDetails.endTime,
          bidCount: auctionDetails.bidCount,
          images: auctionDetails.images,
          source: 'auction',
          sourceDisplay: 'Bring A Trailer',
          link,
          dateAdded: new Date().toISOString()
        };
        
        // Add to auctions array
        auctions.push(auctionListing);
        console.log(`Added new auction: ${title}`);
      } catch (error) {
        console.error('Error processing BAT auction listing:', error);
      }
    }
    
    console.log(`Processed ${auctions.length} active auctions from Bring A Trailer`);
  } catch (error) {
    console.error('Error scraping BAT active auctions:', error);
  }
}

// Specific scraper for Bring A Trailer completed listings
async function scrapeBATCompletedListings(source, data) {
  try {
    const response = await axiosInstance.get(source.completedUrl);
    const $ = cheerio.load(response.data);
    
    // Find all completed listings
    const completedListings = $('.bat-grid-item-image');
    console.log(`Found ${completedListings.length} potential completed listings on Bring A Trailer`);
    
    for (const element of completedListings.toArray()) {
      try {
        const listingEl = $(element);
        
        // Extract basic info
        const title = listingEl.find('.bat-grid-item-title').text().trim();
        
        // Skip if not a Mezger engine car
        if (!isMezgerCar(title)) continue;
        
        // Extract link and price
        const link = listingEl.find('a').attr('href') || '';
        if (!link) continue;
        
        const priceText = listingEl.find('.bat-grid-item-details-price').text().trim();
        const price = extractPrice(priceText);
        
        // Create a unique ID for the listing
        const id = `bat-${Buffer.from(link).toString('base64').substring(0, 10)}`;
        
        // Check if we already have this listing
        const existingIndex = data.cars.findIndex(car => car.id === id);
        if (existingIndex >= 0) {
          console.log(`Listing already exists: ${title}`);
          continue;
        }
        
        // Get more details from the listing page
        console.log(`Fetching details for listing: ${title}`);
        await delay(config.requestDelay); // Be nice to the server
        
        const listingDetails = await fetchBATListingDetails(link);
        if (!listingDetails) continue;
        
        // Extract model from title
        const model = extractModelFromTitle(title);
        
        // Create car listing object
        const carListing = {
          id,
          type: 'vehicle',
          model,
          title,
          description: listingDetails.description,
          price,
          year: extractYear(title),
          mileage: listingDetails.mileage,
          location: listingDetails.location,
          engine: listingDetails.engine || '3.6L Mezger Flat-6',
          transmission: listingDetails.transmission,
          exteriorColor: listingDetails.exteriorColor,
          interiorColor: listingDetails.interiorColor,
          vin: listingDetails.vin,
          status: 'sold',
          images: listingDetails.images,
          source: 'auction',
          sourceDisplay: 'Bring A Trailer',
          link,
          dateAdded: new Date().toISOString(),
          soldDate: listingDetails.soldDate,
          soldPrice: price
        };
        
        // Add to cars array
        data.cars.push(carListing);
        console.log(`Added new car listing: ${title}`);
      } catch (error) {
        console.error('Error processing BAT completed listing:', error);
      }
    }
    
    console.log(`Processed ${data.cars.length} car listings from Bring A Trailer`);
  } catch (error) {
    console.error('Error scraping BAT completed listings:', error);
  }
}

// Fetch details from a BAT auction page
async function fetchBATAuctionDetails(url) {
  try {
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);
    
    // Extract auction details
    const description = $('.listing-details-content p').first().text().trim();
    
    // Extract current bid
    const bidText = $('.current-bid').text().trim();
    const currentBid = extractPrice(bidText) || 0;
    
    // Extract bid count
    const bidCountText = $('.bid-count').text().trim();
    const bidCount = parseInt(bidCountText.match(/\d+/)?.[0] || '0', 10);
    
    // Extract end time
    const endTimeText = $('.listing-available-countdown').attr('data-end') || '';
    const endTime = endTimeText ? new Date(endTimeText).toISOString() : new Date(Date.now() + 86400000).toISOString(); // Default to 24h from now
    
    // Extract specs
    const specs = {};
    $('.listing-essentials-items li').each((i, el) => {
      const label = $(el).find('.label').text().trim().toLowerCase();
      const value = $(el).find('.value').text().trim();
      
      if (label.includes('mileage')) specs.mileage = value;
      else if (label.includes('vin')) specs.vin = value;
      else if (label.includes('location')) specs.location = value;
      else if (label.includes('transmission')) specs.transmission = value;
      else if (label.includes('exterior')) specs.exteriorColor = value;
      else if (label.includes('interior')) specs.interiorColor = value;
      else if (label.includes('engine')) specs.engine = value;
    });
    
    // Extract images
    const images = [];
    $('.carousel-inner .item img').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !images.includes(src)) {
        images.push(src);
      }
    });
    
    // If no carousel images, try gallery images
    if (images.length === 0) {
      $('.gallery-image').each((i, el) => {
        const src = $(el).attr('src');
        if (src && !images.includes(src)) {
          images.push(src);
        }
      });
    }
    
    return {
      description,
      currentBid,
      bidCount,
      endTime,
      images,
      ...specs
    };
  } catch (error) {
    console.error(`Error fetching BAT auction details for ${url}:`, error);
    return null;
  }
}

// Fetch details from a BAT listing page
async function fetchBATListingDetails(url) {
  try {
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);
    
    // Extract listing details
    const description = $('.listing-details-content p').first().text().trim();
    
    // Extract sold date
    const soldDateText = $('.listing-available-sold').text().trim();
    const soldDateMatch = soldDateText.match(/Sold on (\d+\/\d+\/\d+)/);
    const soldDate = soldDateMatch ? new Date(soldDateMatch[1]).toISOString() : new Date().toISOString();
    
    // Extract specs
    const specs = {};
    $('.listing-essentials-items li').each((i, el) => {
      const label = $(el).find('.label').text().trim().toLowerCase();
      const value = $(el).find('.value').text().trim();
      
      if (label.includes('mileage')) specs.mileage = value;
      else if (label.includes('vin')) specs.vin = value;
      else if (label.includes('location')) specs.location = value;
      else if (label.includes('transmission')) specs.transmission = value;
      else if (label.includes('exterior')) specs.exteriorColor = value;
      else if (label.includes('interior')) specs.interiorColor = value;
      else if (label.includes('engine')) specs.engine = value;
    });
    
    // Extract images
    const images = [];
    $('.carousel-inner .item img').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !images.includes(src)) {
        images.push(src);
      }
    });
    
    // If no carousel images, try gallery images
    if (images.length === 0) {
      $('.gallery-image').each((i, el) => {
        const src = $(el).attr('src');
        if (src && !images.includes(src)) {
          images.push(src);
        }
      });
    }
    
    return {
      description,
      soldDate,
      images,
      ...specs
    };
  } catch (error) {
    console.error(`Error fetching BAT listing details for ${url}:`, error);
    return null;
  }
}

// Extract model from title
function extractModelFromTitle(title) {
  const lowerTitle = title.toLowerCase();
  
  // Check for specific models
  if (lowerTitle.includes('996') && lowerTitle.includes('gt3') && lowerTitle.includes('rs')) {
    return '996-gt3-rs';
  } else if (lowerTitle.includes('996') && lowerTitle.includes('gt3')) {
    return '996-gt3';
  } else if (lowerTitle.includes('996') && lowerTitle.includes('gt2')) {
    return '996-gt2';
  } else if (lowerTitle.includes('996') && lowerTitle.includes('turbo')) {
    return '996-turbo';
  } else if (lowerTitle.includes('997') && lowerTitle.includes('gt3') && lowerTitle.includes('rs')) {
    return '997-gt3-rs';
  } else if (lowerTitle.includes('997') && lowerTitle.includes('gt3')) {
    return '997-gt3';
  } else if (lowerTitle.includes('997') && lowerTitle.includes('gt2') && lowerTitle.includes('rs')) {
    return '997-gt2-rs';
  } else if (lowerTitle.includes('997') && lowerTitle.includes('gt2')) {
    return '997-gt2';
  } else if (lowerTitle.includes('997') && lowerTitle.includes('turbo')) {
    return '997-turbo';
  } else if (lowerTitle.includes('mezger') && (lowerTitle.includes('engine') || lowerTitle.includes('part'))) {
    return 'mezger-engine';
  }
  
  // Default fallback
  if (lowerTitle.includes('996')) {
    return '996-mezger';
  } else if (lowerTitle.includes('997')) {
    return '997-mezger';
  } else {
    return 'mezger-engine';
  }
}

// Specific scraper for Bring A Trailer
async function scrapeBringATrailer($, source, data) {
  console.log('Using specialized scraper for Bring A Trailer');

  $('.bat-grid-item-image').each((index, element) => {
    try {
      const title = $(element).find('.bat-grid-item-title').text().trim();
      
      // Skip if not a Mezger engine car
      if (!isMezgerCar(title)) return;
      
      const priceText = $(element).find('.bat-grid-item-details-price').text().trim();
      const price = extractPrice(priceText);
      const link = $(element).find('a').attr('href') || '#';
      const imageUrl = $(element).find('img').attr('src') || '';
      const year = extractYear(title);
      
      // Create a unique ID for the listing
      const id = `${source.name}-${Buffer.from(link).toString('base64').substring(0, 10)}`;
      
      // Check if we already have this listing
      const existingIndex = data.cars.findIndex(car => car.id === id);
      
      const carListing = {
        id,
        type: 'car',
        title,
        price,
        year,
        image: imageUrl,
        source: source.name,
        sourceDisplay: source.displayName,
        link,
        dateScraped: new Date().toISOString(),
        status: 'active'
      };
      
      if (existingIndex >= 0) {
        // Update existing listing
        data.cars[existingIndex] = {
          ...data.cars[existingIndex],
          ...carListing,
          // Preserve original scraped date
          dateScraped: data.cars[existingIndex].dateScraped
        };
        console.log(`Updated car listing: ${title}`);
      } else {
        // Add new listing
        data.cars.push(carListing);
        console.log(`Added new car listing: ${title}`);
      }
    } catch (error) {
      console.error('Error processing BAT listing:', error);
    }
  });

  console.log(`Processed ${data.cars.length} car listings from Bring A Trailer`);
}

// Specific scraper for Pelican Parts
async function scrapePelicanParts($, source, data) {
  console.log('Using specialized scraper for Pelican Parts');

  $('.product-listing').each((index, element) => {
    try {
      const title = $(element).find('.product-title').text().trim();
      
      // Skip if not a Mezger engine part
      if (!isMezgerPart(title)) return;
      
      const priceText = $(element).find('.product-price').text().trim();
      const price = extractPrice(priceText);
      const link = 'https://www.pelicanparts.com' + $(element).find('a').attr('href');
      const imageUrl = $(element).find('img').attr('src') || '';
      const partNumber = $(element).find('.product-number').text().trim();
      
      // Determine stock status
      let status = 'in_stock';
      const stockText = $(element).find('.stock-status').text().toLowerCase();
      if (stockText.includes('out of stock') || stockText.includes('sold out')) {
        status = 'out_of_stock';
      } else if (stockText.includes('back order') || stockText.includes('pre-order')) {
        status = 'back_ordered';
      }
      
      // Create a unique ID for the listing
      const id = `${source.name}-${Buffer.from(link).toString('base64').substring(0, 10)}`;
      
      // Check if we already have this listing
      const existingIndex = data.parts.findIndex(part => part.id === id);
      
      const partListing = {
        id,
        type: 'part',
        title,
        partNumber,
        price,
        image: imageUrl,
        source: source.name,
        sourceDisplay: source.displayName,
        link,
        dateScraped: new Date().toISOString(),
        status
      };
      
      if (existingIndex >= 0) {
        // Update existing listing
        data.parts[existingIndex] = {
          ...data.parts[existingIndex],
          ...partListing,
          // Preserve original scraped date
          dateScraped: data.parts[existingIndex].dateScraped
        };
        console.log(`Updated part listing: ${title}`);
      } else {
        // Add new listing
        data.parts.push(partListing);
        console.log(`Added new part listing: ${title}`);
      }
    } catch (error) {
      console.error('Error processing Pelican Parts listing:', error);
    }
  });

  console.log(`Processed ${data.parts.length} part listings from Pelican Parts`);
}

// Generic car listings scraper with cheerio
async function scrapeGenericCarListings($, source, data) {
  const selectors = {
    container: '.listing-item, .auction-item, .car-listing',
    title: '.listing-title, .item-title',
    price: '.price, .amount',
    link: 'a',
    image: 'img',
    location: '.location'
  };

  const listings = $(selectors.container);
  console.log(`Found ${listings.length} potential car listings on ${source.name}`);

  listings.each((index, element) => {
    try {
      const title = $(element).find(selectors.title).text().trim() || 'Unknown Model';
      
      // Skip if not a Mezger engine car
      if (!isMezgerCar(title)) return;
      
      const priceText = $(element).find(selectors.price).text().trim();
      const price = extractPrice(priceText);
      const link = $(element).find(selectors.link).attr('href') || '#';
      const imageUrl = $(element).find(selectors.image).attr('src') || '';
      const year = extractYear(title);
      const location = $(element).find(selectors.location).text().trim() || '';
      
      // Create a unique ID for the listing
      const id = `${source.name}-${Buffer.from(link).toString('base64').substring(0, 10)}`;
      
      // Check if we already have this listing
      const existingIndex = data.cars.findIndex(car => car.id === id);
      
      const carListing = {
        id,
        type: 'car',
        title,
        price,
        year,
        location,
        image: imageUrl,
        source: source.name,
        sourceDisplay: source.displayName,
        link,
        dateScraped: new Date().toISOString(),
        status: 'active'
      };
      
      if (existingIndex >= 0) {
        // Update existing listing
        data.cars[existingIndex] = {
          ...data.cars[existingIndex],
          ...carListing,
          // Preserve original scraped date
          dateScraped: data.cars[existingIndex].dateScraped
        };
        console.log(`Updated car listing: ${title}`);
      } else {
        // Add new listing
        data.cars.push(carListing);
        console.log(`Added new car listing: ${title}`);
      }
    } catch (error) {
      console.error('Error processing car listing:', error);
    }
  });
}

// Generic part listings scraper with cheerio
async function scrapeGenericPartListings($, source, data) {
  const selectors = {
    container: '.part-item, .product-listing',
    title: '.part-title, .product-name',
    price: '.price, .amount',
    link: 'a',
    image: 'img',
    partNumber: '.part-number, .sku',
    description: '.description, .details',
    stock: '.stock, .availability'
  };

  const listings = $(selectors.container);
  console.log(`Found ${listings.length} potential part listings on ${source.name}`);

  listings.each((index, element) => {
    try {
      const title = $(element).find(selectors.title).text().trim() || 'Unknown Part';
      
      // Skip if not a Mezger engine part
      if (!isMezgerPart(title)) return;
      
      const priceText = $(element).find(selectors.price).text().trim();
      const price = extractPrice(priceText);
      const link = $(element).find(selectors.link).attr('href') || '#';
      const imageUrl = $(element).find(selectors.image).attr('src') || '';
      const partNumber = $(element).find(selectors.partNumber).text().trim() || '';
      const description = $(element).find(selectors.description).text().trim() || '';
      
      // Determine stock status
      let status = 'in_stock';
      const stockText = $(element).find(selectors.stock).text().toLowerCase();
      if (stockText.includes('out of stock') || stockText.includes('sold out')) {
        status = 'out_of_stock';
      } else if (stockText.includes('back order') || stockText.includes('pre-order')) {
        status = 'back_ordered';
      }
      
      // Create a unique ID for the listing
      const id = `${source.name}-${Buffer.from(link).toString('base64').substring(0, 10)}`;
      
      // Check if we already have this listing
      const existingIndex = data.parts.findIndex(part => part.id === id);
      
      const partListing = {
        id,
        type: 'part',
        title,
        partNumber,
        price,
        description,
        image: imageUrl,
        source: source.name,
        sourceDisplay: source.displayName,
        link,
        dateScraped: new Date().toISOString(),
        status
      };
      
      if (existingIndex >= 0) {
        // Update existing listing
        data.parts[existingIndex] = {
          ...data.parts[existingIndex],
          ...partListing,
          // Preserve original scraped date
          dateScraped: data.parts[existingIndex].dateScraped
        };
        console.log(`Updated part listing: ${title}`);
      } else {
        // Add new listing
        data.parts.push(partListing);
        console.log(`Added new part listing: ${title}`);
      }
    } catch (error) {
      console.error('Error processing part listing:', error);
    }
  });
}

// Helper function to check if a car has a Mezger engine
function isMezgerCar(title) {
  const lowerTitle = title.toLowerCase();
  // Mezger engine was used in these models
  return (
    (lowerTitle.includes('911') || lowerTitle.includes('996') || lowerTitle.includes('997')) &&
    (lowerTitle.includes('gt3') || lowerTitle.includes('gt2') || lowerTitle.includes('turbo') || lowerTitle.includes('mezger'))
  );
}

// Helper function to check if a part is for a Mezger engine
function isMezgerPart(title) {
  const lowerTitle = title.toLowerCase();
  return (
    lowerTitle.includes('mezger') ||
    (lowerTitle.includes('engine') && 
     (lowerTitle.includes('gt3') || lowerTitle.includes('gt2') || lowerTitle.includes('turbo'))) ||
    (  && 
     (lowerTitle.includes('gt3') || lowerTitle.includes('gt2') || lowerTitle.includes('turbo'))) ||
    (lowerTitle.includes('part') && 
     (lowerTitle.includes('gt3') || lowerTitle.includes('gt2') || lowerTitle.includes('turbo')))
  );
}

// Helper function to extract price
function extractPrice(priceText) {
  if (!priceText) return null;

  // Remove currency symbols and commas, then parse as float
  const matches = priceText.match(/[\d,]+(\.\d+)?/);
  if (matches) {
    return parseFloat(matches[0].replace(/,/g, ''));
  }
  return null;
}

// Helper function to extract year
function extractYear(title) {
  const matches = title.match(/\b(19|20)\d{2}\b/);
  return matches ? parseInt(matches[0]) : null;
}

// Add some demo data for testing
function addDemoData(data) {
  // Add demo cars if we have fewer than 3 cars
  if (data.cars.length < 3) {
    const demoCars = [
      {
        id: "demo-gt3-1",
        type: "car",
        title: "2004 Porsche 996 GT3",
        price: 89500,
        year: 2004,
        mileage: "45,000 miles",
        location: "Los Angeles, CA",
        image: "https://images.squarespace-cdn.com/content/v1/5f6b0fad5f8e2f57a7d7acf7/1600889300037-ZCJZ4BXKVL5LDPVF9ZQL/996+GT3.jpg",
        source: "demo",
        sourceDisplay: "Demo Listing",
        link: "#",
        dateScraped: new Date().toISOString(),
        status: "active"
      },
      {
        id: "demo-gt3rs-1",
        type: "car",
        title: "2007 Porsche 997 GT3 RS",
        price: 195000,
        year: 2007,
        mileage: "18,500 miles",
        location: "San Francisco, CA",
        image: "https://images.squarespace-cdn.com/content/v1/5f6b0fad5f8e2f57a7d7acf7/1600889300037-ZCJZ4BXKVL5LDPVF9ZQL/997+GT3+RS.jpg",
        source: "demo",
        sourceDisplay: "Demo Listing",
        link: "#",
        dateScraped: new Date().toISOString(),
        status: "active"
      }
    ];
    
    // Add demo cars that don't already exist
    for (const car of demoCars) {
      if (!data.cars.some(c => c.id === car.id)) {
        data.cars.push(car);
        console.log(`Added demo car: ${car.title}`);
      }
    }
  }

  // Add demo parts if we have fewer than 3 parts
  if (data.parts.length < 3) {
    const demoParts = [
      {
        id: "demo-part-1",
        type: "part",
        title: "GT3 RS 4.0 Titanium Connecting Rods",
        partNumber: "997-GT3-CON-RODS",
        price: 3500,
        description: "Genuine Porsche titanium connecting rods as used in the 997 GT3 RS 4.0.",
        image: "https://images.squarespace-cdn.com/content/v1/5f6b0fad5f8e2f57a7d7acf7/1600889300037-ZCJZ4BXKVL5LDPVF9ZQL/Connecting+Rods.jpg",
        source: "demo",
        sourceDisplay: "Demo Listing",
        link: "#",
        dateScraped: new Date().toISOString(),
        status: "in_stock"
      },
      {
        id: "demo-part-2",
        type: "part",
        title: "Mezger Engine Oil Filter",
        partNumber: "OEM-99610722553",
        price: 19.99,
        description: "Genuine Porsche oil filter for Mezger engines.",
        image: "https://images.squarespace-cdn.com/content/v1/5f6b0fad5f8e2f57a7d7acf7/1600889300037-ZCJZ4BXKVL5LDPVF9ZQL/Oil+Filter.jpg",
        source: "demo",
        sourceDisplay: "Demo Listing",
        link: "#",
        dateScraped: new Date().toISOString(),
        status: "in_stock"
      }
    ];
    
    // Add demo parts that don't already exist
    for (const part of demoParts) {
      if (!data.parts.some(p => p.id === part.id)) {
        data.parts.push(part);
        console.log(`Added demo part: ${part.title}`);
      }
    }
  }
}

// Run the scraper
runScraper().catch(error => {
  console.error('Scraper failed:', error);
  process.exit(1);
});
