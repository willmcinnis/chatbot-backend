const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Enable CORS for all origins during testing
app.use(cors());
app.use(express.json());

// Set up OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// GitHub repository information
const GITHUB_USER = 'willmcinnis'; // Replace with your GitHub username
const GITHUB_REPO = 'train-images';
const GITHUB_BRANCH = 'main';

// Cache settings
const CACHE_DIR = path.join(__dirname, 'train-images');
const METADATA_CACHE_PATH = path.join(CACHE_DIR, 'metadata.json');
const METADATA_CACHE_TTL = 3600000; // 1 hour in milliseconds

// Create cache directory if it doesn't exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// In-memory cache for train part metadata
let trainMetadataCache = null;
let lastMetadataFetch = 0;

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
        description: metadata.description
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
          description: metadata.description
        };
      }
    }
  }
  
  return null;
}

// Function to fetch and cache metadata from GitHub
async function fetchTrainMetadata() {
  try {
    // Check if cache is still valid
    const now = Date.now();
    if (
      trainMetadataCache &&
      lastMetadataFetch > 0 &&
      now - lastMetadataFetch < METADATA_CACHE_TTL
    ) {
      return trainMetadataCache;
    }

    // Check if cached file exists and is recent
    if (
      fs.existsSync(METADATA_CACHE_PATH) &&
      now - fs.statSync(METADATA_CACHE_PATH).mtimeMs < METADATA_CACHE_TTL
    ) {
      const cachedData = JSON.parse(fs.readFileSync(METADATA_CACHE_PATH, 'utf-8'));
      trainMetadataCache = cachedData;
      lastMetadataFetch = now;
      return cachedData;
    }

    // Fetch from GitHub if cache is invalid or expired
    const metadataUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/metadata.json`;
    const response = await axios.get(metadataUrl);
    
    // Update cache
    trainMetadataCache = response.data;
    lastMetadataFetch = now;
    
    // Save to file cache
    fs.writeFileSync(METADATA_CACHE_PATH, JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error fetching train metadata:', error);
    
    // If we have a cached version, return that despite the error
    if (trainMetadataCache) {
      return trainMetadataCache;
    }
    
    // If we have a file cache, return that
    if (fs.existsSync(METADATA_CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(METADATA_CACHE_PATH, 'utf-8'));
    }
    
    // Otherwise return an empty object
    return {};
  }
}

// Helper function to identify view type from message
function identifyView(message, availableViews) {
  for (const view of availableViews) {
    if (message.includes(view.toLowerCase())) {
      return view;
    }
  }
  return null;
}

// Function to get image URL from GitHub
function getGitHubImageUrl(partName, viewType) {
  return `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${partName}/${viewType}.jpg`;
}

// Setup image directory - you should store images in this folder
const IMAGES_DIR = path.join(__dirname, 'images', 'SD60M');

// Create directory if it doesn't exist
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Simple test route
app.get('/', (req, res) => {
  res.json({ message: 'Backend server is running' });
});

// API endpoint to get train metadata
app.get('/api/train/metadata', async (req, res) => {
  try {
    const metadata = await fetchTrainMetadata();
    res.json(metadata);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error fetching train metadata' });
  }
});

// Endpoint to serve train images directly from the filesystem
app.get('/api/train/image/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const imagePath = path.join(IMAGES_DIR, filename);
    
    // Check if file exists
    if (fs.existsSync(imagePath)) {
      return res.sendFile(imagePath);
    } else {
      return res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// API endpoint to get train part image
app.get('/api/train/image/:partName/:viewType', async (req, res) => {
  try {
    const { partName, viewType } = req.params;
    
    // Create cache folder for this part if it doesn't exist
    const partCacheDir = path.join(CACHE_DIR, partName);
    if (!fs.existsSync(partCacheDir)) {
      fs.mkdirSync(partCacheDir, { recursive: true });
    }
    
    // Path to cached image
    const cachedImagePath = path.join(partCacheDir, `${viewType}.jpg`);
    
    // Check if we have a cached version
    if (fs.existsSync(cachedImagePath)) {
      return res.sendFile(cachedImagePath);
    }
    
    // Fetch image from GitHub
    const imageUrl = getGitHubImageUrl(partName, viewType);
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    
    // Save to cache
    fs.writeFileSync(cachedImagePath, response.data);
    
    // Send image
    res.set('Content-Type', 'image/jpeg');
    res.send(response.data);
  } catch (error) {
    console.error('Error fetching train image:', error);
    res.status(404).send('Image not found');
  }
});

// Enhanced chat API that checks for train part requests
app.post('/api/chat', async (req, res) => {
  try {
    const { message, threadId } = req.body;
    
    // Check if the message is asking about a train part
    const trainPartRequest = identifyTrainPart(message);
    
    if (trainPartRequest) {
      // Handle train part request directly
      const imageUrl = `/api/train/image/${encodeURIComponent(trainPartRequest.filename)}`;
      
      // Prepare response with description
      const response = {
        message: `Here's the ${trainPartRequest.displayName}. ${trainPartRequest.description || ''}`,
        threadId: threadId || 'local',
        isTrainPart: true,
        trainPart: {
          name: trainPartRequest.partName,
          displayName: trainPartRequest.displayName,
          filename: trainPartRequest.filename,
          imageUrl: imageUrl,
          description: trainPartRequest.description || ''
        }
      };
      
      return res.json(response);
    }
    
    // If not a train part request, proceed with OpenAI
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
    
    // Run assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.ASSISTANT_ID
    });
    
    // Wait for completion
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      
      if (runStatus.status === 'failed') {
        throw new Error('Assistant run failed');
      }
    }
    
    // Get messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];
    
    res.json({
      message: lastMessage.content[0].text.value,
      threadId: thread.id,
      isTrainPart: false
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error processing request' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
