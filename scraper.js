import fs from 'fs/promises';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

// Configuration
const config = {
  sources: [
    {
      name: 'bringatrailer',
      displayName: 'Bring A Trailer',
      url: 'https://bringatrailer.com/porsche/911-gt3-gt2-turbo-mezger/',
      type: 'car'
    },
    {
      name: 'rennlist',
      displayName: 'Rennlist',
      url: 'https://rennlist.com/forums/market/vehicles-for-sale/',
      type: 'car'
    },
    {
      name: 'pelicanparts',
      displayName: 'Pelican Parts',
      url: 'https://www.pelicanparts.com/Porsche/catalog/SuperCat_Porsche_911_997_Engine.htm',
      type: 'part'
    }
  ],
  outputPath: './data.json',
  searchTerms: {
    cars: ['gt3', 'gt3 rs', 'gt2', 'gt2 rs', 'turbo', 'mezger'],
    parts: ['engine', 'mezger', 'gt3', 'gt2', 'turbo']
  }
};

// Main scraper function
async function runScraper() {
  console.log('Starting Mezger Engine Listings Scraper...');
  
  // Initialize data structure
  const data = {
    cars: [],
    parts: [],
    lastUpdated: new Date().toISOString()
  };
  
  // Try to load existing data if available
  try {
    const existingData = JSON.parse(await fs.readFile(config.outputPath, 'utf8'));
    data.cars = existingData.cars || [];
    data.parts = existingData.parts || [];
    console.log(`Loaded ${data.cars.length} existing car listings and ${data.parts.length} existing part listings.`);
  } catch (error) {
    console.log('No existing data found or error reading file. Starting fresh.');
  }
  
  // Process each source
  for (const source of config.sources) {
    console.log(`Processing source: ${source.displayName} (${source.url})`);
    
    try {
      // Fetch the page
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${source.url}: ${response.status} ${response.statusText}`);
      }
      
      const html = await response.text();
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Extract listings based on source type
      if (source.type === 'car') {
        await scrapeCarListings(document, source, data);
      } else if (source.type === 'part') {
        await scrapePartListings(document, source, data);
      }
    } catch (error) {
      console.error(`Error processing ${source.name}:`, error);
    }
  }
  
  // Add some demo data for testing
  addDemoData(data);
  
  // Save the data
  await fs.writeFile(config.outputPath, JSON.stringify(data, null, 2));
  console.log(`Data saved to ${config.outputPath}`);
  console.log(`Total: ${data.cars.length} cars and ${data.parts.length} parts`);
}

// Function to scrape car listings (customize for each source)
async function scrapeCarListings(document, source, data) {
  // This is a simplified example - you'll need to customize for each source
  const listings = document.querySelectorAll('.listing-item, .auction-item, .car-listing');
  console.log(`Found ${listings.length} potential car listings on ${source.name}`);
  
  for (const listing of listings) {
    try {
      // Extract data based on the source's HTML structure
      // This is just an example - adjust selectors for each source
      const title = listing.querySelector('.listing-title, .item-title')?.textContent?.trim() || 'Unknown Model';
      
      // Skip if not a Mezger engine car
      if (!isMezgerCar(title)) continue;
      
      const price = extractPrice(listing.querySelector('.price, .amount')?.textContent);
      const link = listing.querySelector('a')?.href || '#';
      const image = listing.querySelector('img')?.src || '';
      const year = extractYear(title);
      const location = listing.querySelector('.location')?.textContent?.trim() || '';
      
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
        image,
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
  }
}

// Function to scrape part listings (customize for each source)
async function scrapePartListings(document, source, data) {
  // This is a simplified example - you'll need to customize for each source
  const listings = document.querySelectorAll('.part-item, .product-listing');
  console.log(`Found ${listings.length} potential part listings on ${source.name}`);
  
  for (const listing of listings) {
    try {
      // Extract data based on the source's HTML structure
      const title = listing.querySelector('.part-title, .product-name')?.textContent?.trim() || 'Unknown Part';
      
      // Skip if not a Mezger engine part
      if (!isMezgerPart(title)) continue;
      
      const price = extractPrice(listing.querySelector('.price, .amount')?.textContent);
      const link = listing.querySelector('a')?.href || '#';
      const image = listing.querySelector('img')?.src || '';
      const partNumber = listing.querySelector('.part-number, .sku')?.textContent?.trim() || '';
      const description = listing.querySelector('.description, .details')?.textContent?.trim() || '';
      
      // Create a unique ID for the listing
      const id = `${source.name}-${Buffer.from(link).toString('base64').substring(0, 10)}`;
      
      // Check if we already have this listing
      const existingIndex = data.parts.findIndex(part => part.id === id);
      
      // Determine stock status
      let status = 'in_stock';
      const stockText = listing.querySelector('.stock, .availability')?.textContent?.toLowerCase() || '';
      if (stockText.includes('out of stock') || stockText.includes('sold out')) {
        status = 'out_of_stock';
      } else if (stockText.includes('back order') || stockText.includes('pre-order')) {
        status = 'back_ordered';
      }
      
      const partListing = {
        id,
        type: 'part',
        title,
        partNumber,
        price,
        description,
        image,
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
  }
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
  // Add demo cars if we have fewer than 5 cars
  if (data.cars.length < 5) {
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
  
  // Add demo parts if we have fewer than 5 parts
  if (data.parts.length < 5) {
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
