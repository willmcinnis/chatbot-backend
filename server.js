const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Enable CORS with more specific options
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Enhanced OpenAI client setup with better error handling
const setupOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY in environment variables');
    throw new Error('OpenAI API key is required');
  }
  
  const assistantId = process.env.ASSISTANT_ID;
  
  if (!assistantId) {
    console.error('Missing ASSISTANT_ID in environment variables');
    throw new Error('Assistant ID is required');
  }
  
  console.log(`Setting up OpenAI client with Assistant ID: ${assistantId.substring(0, 5)}...`);
  
  return new OpenAI({
    apiKey: apiKey,
    timeout: 60000, // 60 second timeout
    maxRetries: 3
  });
};

// Set up OpenAI client with enhanced error checking
const openai = setupOpenAI();

// Define a mapping for user-friendly terms to actual filenames
const trainPartMappings = {
  // Map common terms to the specific filenames
  'alerter': 'SD60M ALERTER Q2518.jpg',
  'distributed power': 'SD60M DISTRIBUTED POWER LSI RACK.jpg',
  'computer screen': 'SD60M HVC 60 SERIES COMPUTER SCREEN.jpg',
  'circuit breaker panel': 'SD60M HVC CIRCUIT BREAKER PANEL.jpg',
  'isolation panel behind': 'SD60M HVC ISOLATION PANEL BEHIND.jpg',
  'isolation panel inside': 'SD60M HVC ISOLATION PANEL INSIDE.jpg',
  'relay panel right wall': 'SD60M HVC RELAY PANEL RIGHT WALL.jpg',
  'relay panel right': 'SD60M HVC RELAY PANEL RIGHT.jpg',
  'relay panel upper middle': 'SD60M HVC RELAY PANEL UPPER MIDDLE.jpg',
  'relay panel upper right': 'SD60M HVC RELAY PANEL UPPER RIGHT.jpg',
  'relay panel': 'SD60M HVC RELAY PANEL.jpg',
  'smartstart': 'SD60M HVC SMARTSTART 2E.jpg',
  'event recorder': 'SD60M QUANTUM EVENT RECORDER.jpg',
  'remote card download': 'SD60M QUANTUM REMOTE CARD DOWNLOAD.jpg',
  'resistors': 'SD60M RESISTORS & DIODES LSI RACK.jpg',
  'sub-base fast break': 'SD60M SUB-BASE FAST BREAK REAR.jpg',
  'tb30s board': 'SD60M TB30S BOARD PANEL STYLE.jpg',
  'terminal board': 'SD60M TERMINAL BOARD 30S X STYLE.jpg',
  'dc-dc converter': 'SD60M WILMORE DC-DC CONVERTER.jpg'
};

// Define a mapping for SD-60 schematic pages
const schematicMappings = {
  '13': 'WD03463 SD-60 PAGE 13.png',
  '14': 'WD03463 SD-60 PAGE 14.png',
  '15': 'WD03463 SD-60 PAGE 15.png',
  '16': 'WD03463 SD-60 PAGE 16.png',
  '17': 'WD03463 SD-60 PAGE 17.png',
  '18': 'WD03463 SD-60 PAGE 18.png',
  '19': 'WD03463 SD-60 PAGE 19.png',
  '20': 'WD03463 SD-60 PAGE 20.png',
  '21': 'WD03463 SD-60 PAGE 21.png',
  '22': 'WD03463 SD-60 PAGE 22.png',
  '23': 'WD03463 SD-60 PAGE 23.png',
  '24': 'WD03463 SD-60 PAGE 24.png',
  '25': 'WD03463 SD-60 PAGE 25.png',
  '26': 'WD03463 SD-60 PAGE 26.png',
  '27': 'WD03463 SD-60 PAGE 27.png',
  '28': 'WD03463 SD-60 PAGE 28.png',
  '29': 'WD03463 SD-60 PAGE 29.png',
  '30': 'WD03463 SD-60 PAGE 30.png',
  '31': 'WD03463 SD-60 PAGE 31.png',
  '32': 'WD03463 SD-60 PAGE 32.png',
  '33': 'WD03463 SD-60 PAGE 33.png',
  '34': 'WD03463 SD-60 PAGE 34.png',
  '35': 'WD03463 SD-60 PAGE 35.png',
  '36': 'WD03463 SD-60 PAGE 36.png',
  '37': 'WD03463 SD-60 PAGE 37.png',
  '38': 'WD03463 SD-60 PAGE 38.png',
  '39': 'WD03463 SD-60 PAGE 39.png',
  '40': 'WD03463 SD-60 PAGE 40.png',
  '41': 'WD03463 SD-60 PAGE 41.png',
  '42': 'WD03463 SD-60 PAGE 42.png',
  '43': 'WD03463 SD-60 PAGE 43.png',
  '44': 'WD03463 SD-60 PAGE 44.png',
  '45': 'WD03463 SD-60 PAGE 45.png',
  '46': 'WD03463 SD-60 PAGE 46.png',
  '47': 'WD03463 SD-60 PAGE 47.png',
  '48': 'WD03463 SD-60 PAGE 48.png',
  '50': 'WD03463 SD-60 PAGE 50.png',
  '51': 'WD03463 SD-60 PAGE 51.png',
  '53': 'WD03463 SD-60 PAGE 53.png',
  '56': 'WD03463 SD-60 PAGE 56.png',
  '57': 'WD03463 SD-60 PAGE 57.png',
  '58': 'WD03463 SD-60 PAGE 58.png',
  '59': 'WD03463 SD-60 PAGE 59.png',
  '60': 'WD03463 SD-60 PAGE 60.png',
  '62': 'WD03463 SD-60 PAGE 62.png'
};

// Define a mapping for IETMS schematic pages
const ietmsMappings = {
  '2': '24-2-19294 PTC IETMS PAGE 2.png',
  '3': '24-2-19294 PTC IETMS PAGE 3.png',
  '4': '24-2-19294 PTC IETMS PAGE 4.png',
  '5': '24-2-19294 PTC IETMS PAGE 5.png',
  '6': '24-2-19294 PTC IETMS PAGE 6.png',
  '7': '24-2-19294 PTC IETMS PAGE 7.png',
  '8': '24-2-19294 PTC IETMS PAGE 8.png',
  '9': '24-2-19294 PTC IETMS PAGE 9.png',
  '10': '24-2-19294 PTC IETMS PAGE 10.png'
};

// Load metadata for train parts
let trainPartMetadata = {};
try {
  // Path to metadata file
  const metadataPath = path.join(__dirname, 'metadata.json');
  if (fs.existsSync(metadataPath)) {
    const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
    trainPartMetadata = JSON.parse(metadataContent);
  } else {
    console.warn('Metadata file not found, using default descriptions');
  }
} catch (error) {
  console.error('Error loading metadata file:', error);
}

// Function to identify train part from user message
function identifyTrainPart(message) {
  const lowercaseMessage = message.toLowerCase();
  
  // Check if the message is a request to show an image
  const imageRequestPhrases = [
    'show me an image of',
    'show me a picture of',
    'show me the',
    'can i see the',
    'display the',
    'show a photo of',
    'let me see the'
  ];
  
  let isImageRequest = false;
  for (const phrase of imageRequestPhrases) {
    if (lowercaseMessage.includes(phrase)) {
      isImageRequest = true;
      break;
    }
  }
  
  if (!isImageRequest) {
    return null;
  }
  
  // Check for train parts in the message
  for (const [partKey, filename] of Object.entries(trainPartMappings)) {
    if (lowercaseMessage.includes(partKey.toLowerCase())) {
      // Get metadata if available
      const metadata = trainPartMetadata[partKey] || {
        displayName: partKey.charAt(0).toUpperCase() + partKey.slice(1),
        description: `SD60M ${partKey.charAt(0).toUpperCase() + partKey.slice(1)}`
      };
      
      return {
        partName: partKey,
        filename: filename,
        displayName: metadata.displayName,
        description: metadata.description,
        type: 'trainPart'
      };
    }
  }
  
  // Check for partial matches in filenames (fallback)
  for (const [partKey, filename] of Object.entries(trainPartMappings)) {
    const filenameLower = filename.toLowerCase();
    // Extract words from the message that might be part of a filename
    const words = lowercaseMessage.split(' ');
    
    for (const word of words) {
      if (word.length > 3 && filenameLower.includes(word)) {
        // Get metadata if available
        const metadata = trainPartMetadata[partKey] || {
          displayName: partKey.charAt(0).toUpperCase() + partKey.slice(1),
          description: `SD60M ${partKey.charAt(0).toUpperCase() + partKey.slice(1)}`
        };
        
        return {
          partName: partKey,
          filename: filename,
          displayName: metadata.displayName,
          description: metadata.description,
          type: 'trainPart'
        };
      }
    }
  }
  
  return null;
}

// Function to identify schematic page from user message
function identifySchematic(message) {
  const lowercaseMessage = message.toLowerCase();
  
  // Check if the message is a request to show a schematic
  const schematicRequestPhrases = [
    'show me a schematic',
    'show me the schematic',
    'show schematic',
    'can i see schematic',
    'display schematic',
    'show me diagram',
    'schematic page',
    'page',
    'sd-60 page',
    'sd60 page'
  ];
  
  // Don't check for schematic requests if it's specifically asking for IETMS
  if (lowercaseMessage.includes('ietms') || lowercaseMessage.includes('ptc')) {
    return null;
  }
  
  let isSchematicRequest = false;
  for (const phrase of schematicRequestPhrases) {
    if (lowercaseMessage.includes(phrase)) {
      isSchematicRequest = true;
      break;
    }
  }
  
  if (!isSchematicRequest) {
    return null;
  }
  
  // Look for page numbers in the message
  const pageRegex = /page\s+(\d+)/i;
  const pageMatch = message.match(pageRegex);
  
  if (pageMatch && pageMatch[1]) {
    const pageNumber = pageMatch[1];
    
    // Check if we have this page in our mapping
    if (schematicMappings[pageNumber]) {
      return {
        pageNumber: pageNumber,
        filename: schematicMappings[pageNumber],
        displayName: `SD-60 Schematic Page ${pageNumber}`,
        description: `Electrical schematic diagram for the SD-60, page ${pageNumber}`,
        type: 'schematic'
      };
    }
  }
  
  // Alternative regex to find just numbers that might be page references
  const numRegex = /\b(\d+)\b/g;
  const numbers = [...message.matchAll(numRegex)];
  
  for (const match of numbers) {
    const pageNumber = match[1];
    if (schematicMappings[pageNumber]) {
      return {
        pageNumber: pageNumber,
        filename: schematicMappings[pageNumber],
        displayName: `SD-60 Schematic Page ${pageNumber}`,
        description: `Electrical schematic diagram for the SD-60, page ${pageNumber}`,
        type: 'schematic'
      };
    }
  }
  
  return null;
}

// Function to identify IETMS schematic page from user message
function identifyIETMSSchematic(message) {
  const lowercaseMessage = message.toLowerCase();
  
  // Check if the message is a request to show an IETMS schematic
  const ietmsRequestPhrases = [
    'show me a schematic of ietms',
    'show me the schematic of ietms',
    'show me the ietms schematic',
    'show ietms schematic',
    'can i see ietms schematic',
    'display ietms schematic',
    'show me ietms diagram',
    'ietms page',
    'ptc ietms',
    'ptc page',
    'show me the schematic of ptc'
  ];
  
  let isIETMSRequest = false;
  for (const phrase of ietmsRequestPhrases) {
    if (lowercaseMessage.includes(phrase) || 
        (lowercaseMessage.includes('schematic') && 
         (lowercaseMessage.includes('ietms') || lowercaseMessage.includes('ptc')))) {
      isIETMSRequest = true;
      break;
    }
  }
  
  if (!isIETMSRequest) {
    return null;
  }
  
  // Look for page numbers in the message
  const pageRegex = /page\s+(\d+)/i;
  const pageMatch = message.match(pageRegex);
  
  if (pageMatch && pageMatch[1]) {
    const pageNumber = pageMatch[1];
    
    // Check if we have this page in our mapping
    if (ietmsMappings[pageNumber]) {
      return {
        pageNumber: pageNumber,
        filename: ietmsMappings[pageNumber],
        displayName: `PTC IETMS Schematic Page ${pageNumber}`,
        description: `PTC IETMS schematic diagram, page ${pageNumber}`,
        type: 'ietms'
      };
    }
  }
  
  // Alternative regex to find just numbers that might be page references
  const numRegex = /\b(\d+)\b/g;
  const numbers = [...message.matchAll(numRegex)];
  
  for (const match of numbers) {
    const pageNumber = match[1];
    if (ietmsMappings[pageNumber]) {
      return {
        pageNumber: pageNumber,
        filename: ietmsMappings[pageNumber],
        displayName: `PTC IETMS Schematic Page ${pageNumber}`,
        description: `PTC IETMS schematic diagram, page ${pageNumber}`,
        type: 'ietms'
      };
    }
  }
  
  // If no specific page is requested, default to page 2 (first page)
  if (ietmsMappings['2']) {
    return {
      pageNumber: '2',
      filename: ietmsMappings['2'],
      displayName: `PTC IETMS Schematic Page 2`,
      description: `PTC IETMS schematic diagram, page 2 (first page)`,
      type: 'ietms'
    };
  }
  
  return null;
}

// Setup image directories
const IMAGES_DIR = path.join(__dirname, 'Train-Images');
const SCHEMATICS_DIR = path.join(__dirname, 'Train-Schematics');
const IETMS_DIR = path.join(__dirname, 'IETMS-Schematics');

// Create directories if they don't exist
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

if (!fs.existsSync(SCHEMATICS_DIR)) {
  fs.mkdirSync(SCHEMATICS_DIR, { recursive: true });
}

if (!fs.existsSync(IETMS_DIR)) {
  fs.mkdirSync(IETMS_DIR, { recursive: true });
}

// Simple test route
app.get('/', (req, res) => {
  res.json({ message: 'Backend server is running' });
});

// API endpoint to get train metadata
app.get('/api/train/metadata', async (req, res) => {
  try {
    res.json(trainPartMetadata);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error fetching train metadata' });
  }
});

// Endpoint to serve train images directly from the filesystem
app.get('/api/train/image/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const imagePath = path.join(IMAGES_DIR, filename);
    
    console.log(`Attempting to serve image: ${imagePath}`);
    
    // Check if file exists
    if (fs.existsSync(imagePath)) {
      // Set appropriate headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'image/jpeg');
      return res.sendFile(imagePath);
    } else {
      console.error(`Image not found: ${imagePath}`);
      return res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Endpoint to serve schematic images
app.get('/api/schematic/image/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const imagePath = path.join(SCHEMATICS_DIR, filename);
    
    console.log(`Attempting to serve schematic: ${imagePath}`);
    
    // Check if file exists
    if (fs.existsSync(imagePath)) {
      // Set appropriate headers for PNG with transparency
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'image/png');
      // Disable caching to ensure fresh images are served
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.sendFile(imagePath);
    } else {
      console.error(`Schematic not found: ${imagePath}`);
      return res.status(404).json({ error: 'Schematic not found' });
    }
  } catch (error) {
    console.error('Error serving schematic:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Endpoint to serve IETMS schematic images
app.get('/api/ietms/image/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const imagePath = path.join(IETMS_DIR, filename);
    
    console.log(`Attempting to serve IETMS schematic: ${imagePath}`);
    
    // Check if file exists
    if (fs.existsSync(imagePath)) {
      // Set appropriate headers for PNG with transparency
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'image/png');
      // Disable caching to ensure fresh images are served
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.sendFile(imagePath);
    } else {
      console.error(`IETMS schematic not found: ${imagePath}`);
      return res.status(404).json({ error: 'IETMS schematic not found' });
    }
  } catch (error) {
    console.error('Error serving IETMS schematic:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Enhanced chat API that checks for train part, schematic, and IETMS requests
app.post('/api/chat', async (req, res) => {
  try {
    const { message, threadId } = req.body;
    
    // First check if the message is asking about a train part
    const trainPartRequest = identifyTrainPart(message);
    
    if (trainPartRequest) {
      // Handle train part request directly
      // Use absolute URL with backend domain for the image
      const backendUrl = process.env.BACKEND_URL || 'https://chatbot-backend-kucx.onrender.com';
      const imageUrl = `${backendUrl}/api/train/image/${encodeURIComponent(trainPartRequest.filename)}`;
      
      console.log(`Train part identified: ${trainPartRequest.partName}, Image URL: ${imageUrl}`);
      
      // Prepare response with description removed
      const response = {
        message: `Here's the ${trainPartRequest.displayName}`, // Remove description
        threadId: threadId || 'local',
        isTrainPart: true,
        trainPart: {
          name: trainPartRequest.partName,
          displayName: trainPartRequest.displayName,
          filename: trainPartRequest.filename,
          imageUrl: imageUrl,
          // Still including description in the data, but not displaying it
          description: '' 
        }
      };
      
      return res.json(response);
    }
    
    // Then check if the message is asking about an IETMS schematic
    // We check IETMS before regular schematics because it's more specific
    const ietmsRequest = identifyIETMSSchematic(message);
    
    if (ietmsRequest) {
      // Handle IETMS schematic request directly
      // Use absolute URL with backend domain for the image
      const backendUrl = process.env.BACKEND_URL || 'https://chatbot-backend-kucx.onrender.com';
      const imageUrl = `${backendUrl}/api/ietms/image/${encodeURIComponent(ietmsRequest.filename)}`;
      
      console.log(`IETMS schematic identified: ${ietmsRequest.pageNumber}, Image URL: ${imageUrl}`);
      
      // Prepare response
      const response = {
        message: `Here's the ${ietmsRequest.displayName}`,
        threadId: threadId || 'local',
        isTrainPart: true, // Reuse the same frontend handling
        trainPart: {
          name: `ietms_page_${ietmsRequest.pageNumber}`,
          displayName: ietmsRequest.displayName,
          filename: ietmsRequest.filename,
          imageUrl: imageUrl,
          description: ietmsRequest.description
        }
      };
      
      return res.json(response);
    }
    
    // Then check if the message is asking about a regular schematic
    const schematicRequest = identifySchematic(message);
    
    if (schematicRequest) {
      // Handle schematic request directly
      // Use absolute URL with backend domain for the image
      const backendUrl = process.env.BACKEND_URL || 'https://chatbot-backend-kucx.onrender.com';
      const imageUrl = `${backendUrl}/api/schematic/image/${encodeURIComponent(schematicRequest.filename)}`;
      
      console.log(`Schematic identified: ${schematicRequest.pageNumber}, Image URL: ${imageUrl}`);
      
      // Prepare response
      const response = {
        message: `Here's the ${schematicRequest.displayName}`,
        threadId: threadId || 'local',
        isTrainPart: true, // Reuse the same frontend handling
        trainPart: {
          name: `schematic_page_${schematicRequest.pageNumber}`,
          displayName: schematicRequest.displayName,
          filename: schematicRequest.filename,
          imageUrl: imageUrl,
          description: schematicRequest.description
        }
      };
      
      return res.json(response);
    }
    
    // If not a train part, IETMS, or schematic request, proceed with OpenAI
    let thread;
    
    // Create or retrieve thread
    if (!threadId) {
      thread = await openai.beta.threads.create();
    } else {
      thread = { id: threadId };
    }
    
    // Add message to thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message
    });
    
    // Run assistant with improved error handling
    try {
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: process.env.ASSISTANT_ID
      });
      
      // Wait for completion with timeout and error handling
      let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout
      
      while (runStatus.status !== 'completed' && attempts < maxAttempts) {
        // Add more detailed logging
        console.log(`Run status: ${runStatus.status}, attempt ${attempts + 1}/${maxAttempts}`);
        
        if (runStatus.status === 'failed') {
          console.error('Run failed with error:', runStatus.last_error);
          throw new Error(`Assistant run failed: ${runStatus.last_error?.message || 'Unknown error'}`);
        }
        
        if (runStatus.status === 'expired') {
          throw new Error('Assistant run expired: took too long to complete');
        }
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        // Refresh status
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Assistant run timed out after 30 seconds');
      }
      
      // Get messages
      const messages = await openai.beta.threads.messages.list(thread.id);
      
      if (messages.data.length === 0) {
        throw new Error('No response received from assistant');
      }
      
      const lastMessage = messages.data[0];
      
      res.json({
        message: lastMessage.content[0].text.value,
        threadId: thread.id,
        isTrainPart: false
      });
    } catch (error) {
      console.error('OpenAI Assistant Error:', error);
      
      // Create a fallback response
      res.json({
        message: "I'm having trouble connecting to my knowledge base right now. Please try again in a moment, or try asking a different question.",
        threadId: thread.id,
        isTrainPart: false
      });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error processing request: ' + error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
