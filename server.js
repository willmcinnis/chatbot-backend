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

// Function to check if a message is asking about a train part
async function identifyTrainPart(message) {
  try {
    const metadata = await fetchTrainMetadata();
    const lowercaseMessage = message.toLowerCase();
    
    // Common action phrases that indicate asking about a part
    const actionPhrases = [
      'show me', 'show the', 'display', 'what is', 'what does', 
      'can i see', 'picture of', 'image of', 'how does', 'tell me about'
    ];
    
    // Check if message contains action phrases
    const hasActionPhrase = actionPhrases.some(phrase => 
      lowercaseMessage.includes(phrase)
    );
    
    if (!hasActionPhrase) {
      return null;
    }
    
    // Check for train parts and their aliases
    for (const [partKey, partData] of Object.entries(metadata)) {
      // Check main part name
      if (lowercaseMessage.includes(partKey.toLowerCase())) {
        // Check for views if available
        const viewType = identifyView(lowercaseMessage, partData.views || ['default']);
        return {
          partName: partKey,
          viewType: viewType || 'default',
          metadata: partData
        };
      }
      
      // Check aliases
      const aliases = partData.aliases || [];
      for (const alias of aliases) {
        if (lowercaseMessage.includes(alias.toLowerCase())) {
          // Check for views if available
          const viewType = identifyView(lowercaseMessage, partData.views || ['default']);
          return {
            partName: partKey,
            viewType: viewType || 'default',
            metadata: partData
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error identifying train part:', error);
    return null;
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
    const trainPartRequest = await identifyTrainPart(message);
    
    if (trainPartRequest) {
      // Handle train part request directly
      const partData = trainPartRequest.metadata;
      const imageUrl = `/api/train/image/${trainPartRequest.partName}/${trainPartRequest.viewType}`;
      
      // Prepare response
      const response = {
        message: `Here's the ${partData.displayName || trainPartRequest.partName}${
          trainPartRequest.viewType !== 'default' ? ` (${trainPartRequest.viewType} view)` : ''
        }. ${partData.description || ''}`,
        threadId: threadId || 'local',
        isTrainPart: true,
        trainPart: {
          name: trainPartRequest.partName,
          view: trainPartRequest.viewType,
          imageUrl: imageUrl,
          metadata: partData
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
