// Add this to your server.js file

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
      return {
        partName: partKey,
        filename: filename,
        displayName: partKey.charAt(0).toUpperCase() + partKey.slice(1)
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
        return {
          partName: partKey,
          filename: filename,
          displayName: partKey.charAt(0).toUpperCase() + partKey.slice(1)
        };
      }
    }
  }
  
  return null;
}

// Setup image directory - you should store images in this folder
const IMAGES_DIR = path.join(__dirname, 'images', 'SD60M');

// Create directory if it doesn't exist
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

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

// Update your chat API endpoint to check for image requests
app.post('/api/chat', async (req, res) => {
  try {
    const { message, threadId } = req.body;
    
    // Check if the message is asking about a train part
    const trainPartRequest = identifyTrainPart(message);
    
    if (trainPartRequest) {
      // Handle train part request directly
      const imageUrl = `/api/train/image/${encodeURIComponent(trainPartRequest.filename)}`;
      
      // Prepare response
      const response = {
        message: `Here's the ${trainPartRequest.displayName} you requested.`,
        threadId: threadId || 'local',
        isTrainPart: true,
        trainPart: {
          name: trainPartRequest.partName,
          filename: trainPartRequest.filename,
          imageUrl: imageUrl
        }
      };
      
      return res.json(response);
    }
    
    // If not a train part request, proceed with OpenAI as before
    // ... rest of your existing OpenAI code
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error processing request' });
  }
});
