require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import services and routes
const meetingJoinerService = require('../../services/meetingJoinerService');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'meeting-joiner',
    timestamp: new Date().toISOString() 
  });
});

// Basic meeting joiner routes
app.post('/api/meeting-joiner', async (req, res) => {
  try {
    const { meeting_url, org_id, meeting_id } = req.body;
    
    if (!meeting_url || !org_id) {
      return res.status(400).json({ 
        error: 'meeting_url and org_id are required' 
      });
    }

    const meetingJoiner = await meetingJoinerService.createMeetingJoiner({
      meeting_url,
      org_id,
      meeting_id
    });

    res.status(201).json(meetingJoiner);
  } catch (error) {
    console.error('Error creating meeting joiner:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Join a meeting endpoint
app.post('/api/meeting-joiner/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { credentials = {}, options = {} } = req.body;
    
    const result = await meetingJoinerService.joinMeeting(id, credentials, options);
    res.json(result);
  } catch (error) {
    console.error('Error joining meeting:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Start recording endpoint
app.post('/api/meeting-joiner/:id/record', async (req, res) => {
  try {
    const { id } = req.params;
    const { options = {} } = req.body;
    
    const result = await meetingJoinerService.startRecording(id, options);
    res.json(result);
  } catch (error) {
    console.error('Error starting recording:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get platform info for a URL
app.post('/api/meeting-joiner/platform-info', async (req, res) => {
  try {
    const { meeting_url } = req.body;
    
    if (!meeting_url) {
      return res.status(400).json({ error: 'meeting_url is required' });
    }
    
    const platformInfo = meetingJoinerService.getPlatformInfo(meeting_url);
    res.json(platformInfo);
  } catch (error) {
    console.error('Error getting platform info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get supported platforms
app.get('/api/meeting-joiner/platforms', (req, res) => {
  try {
    const platforms = meetingJoinerService.getSupportedPlatforms();
    res.json(platforms);
  } catch (error) {
    console.error('Error getting supported platforms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/meeting-joiner/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const meetingJoiner = await meetingJoinerService.getMeetingJoinerById(id);
    
    if (!meetingJoiner) {
      return res.status(404).json({ error: 'Meeting joiner not found' });
    }

    res.json(meetingJoiner);
  } catch (error) {
    console.error('Error fetching meeting joiner:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/meeting-joiner/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, ...additionalData } = req.body;
    
    if (!['not_joined', 'ongoing', 'completed'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be: not_joined, ongoing, or completed' 
      });
    }

    const meetingJoiner = await meetingJoinerService.updateStatus(id, status, additionalData);
    res.json(meetingJoiner);
  } catch (error) {
    console.error('Error updating meeting joiner status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/meeting-joiner/:id/transcript', async (req, res) => {
  try {
    const { id } = req.params;
    const { transcript } = req.body;

    const meetingJoiner = await meetingJoinerService.updateTranscript(id, transcript);
    res.json(meetingJoiner);
  } catch (error) {
    console.error('Error updating transcript:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/meeting-joiner/:id/participants', async (req, res) => {
  try {
    const { id } = req.params;
    const { participants } = req.body;

    const meetingJoiner = await meetingJoinerService.updateParticipants(id, participants);
    res.json(meetingJoiner);
  } catch (error) {
    console.error('Error updating participants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/meeting-joiner/org/:org_id', async (req, res) => {
  try {
    const { org_id } = req.params;
    const { status } = req.query;

    const meetingJoiners = await meetingJoinerService.getMeetingJoinersByOrg(org_id, status);
    res.json(meetingJoiners);
  } catch (error) {
    console.error('Error fetching meeting joiners by org:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/meeting-joiner/active', async (req, res) => {
  try {
    const activeMeetings = await meetingJoinerService.getActiveMeetings();
    res.json(activeMeetings);
  } catch (error) {
    console.error('Error fetching active meetings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Meeting Joiner Service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 