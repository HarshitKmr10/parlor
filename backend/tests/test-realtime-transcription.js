#!/usr/bin/env node

/**
 * Test Real-Time Transcription Setup
 * This script tests the real-time transcription configuration without joining a meeting
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { RealTimeMeetingProcessor } = require('./transcribeProcessor');

async function testRealTimeTranscription() {
  console.log('🧪 Testing Real-Time Transcription System');
  console.log('========================================');
  
  const realTimeProcessor = new RealTimeMeetingProcessor();
  
  try {
    // Create test directory
    const testDir = path.join(__dirname, 'test_realtime');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    console.log(`🎤 Provider: ${realTimeProcessor.streamingTranscriber.provider}`);
    console.log(`📋 Model: ${realTimeProcessor.streamingTranscriber.model}`);
    console.log(`⏱️ Chunk Duration: ${realTimeProcessor.streamingTranscriber.chunkDuration}s`);
    
    // Mock CSV records for testing
    const mockCsvRecords = [
      { displayName: 'John Doe', joinTime: new Date() },
      { displayName: 'Jane Smith', joinTime: new Date() }
    ];
    
    const meetingStartTime = new Date();
    
    // Real-time callback for testing
    const testCallback = async (chunkData) => {
      console.log(`📡 Received real-time chunk ${chunkData.chunk}:`);
      console.log(`   ⏰ Time: ${chunkData.startTime}s - ${chunkData.endTime}s`);
      console.log(`   📝 Text: "${chunkData.text}"`);
      console.log(`   🔢 Segments: ${chunkData.segments?.length || 0}`);
      console.log(`   📁 Audio Path: ${chunkData.audioPath}`);
      
      // Simulate external integration
      if (chunkData.text && chunkData.text.trim().length > 0) {
        console.log(`   🌐 [EXTERNAL] Sending to WebSocket/API: "${chunkData.text.substring(0, 50)}..."`);
      }
      
      console.log('');
    };
    
    // Start real-time processing
    console.log('🚀 Starting real-time transcription...');
    await realTimeProcessor.startRealTimeProcessing(
      testDir, 
      mockCsvRecords, 
      meetingStartTime, 
      [testCallback]
    );
    
    // Simulate audio chunks being processed
    console.log('🎵 Simulating audio chunks...');
    
    // Test with different chunk scenarios
    const testChunks = [
      {
        chunk: 0,
        startTime: 0,
        endTime: 10,
        audioPath: 'test_chunk_0.wav',
        transcript: {
          text: 'Hello, welcome to our meeting today.',
          segments: [
            { start: 0, end: 2, text: 'Hello,' },
            { start: 2.5, end: 7, text: ' welcome to our meeting' },
            { start: 7.5, end: 10, text: ' today.' }
          ]
        }
      },
      {
        chunk: 1,
        startTime: 10,
        endTime: 20,
        audioPath: 'test_chunk_1.wav',
        transcript: {
          text: 'We have several important topics to discuss.',
          segments: [
            { start: 10, end: 13, text: 'We have several' },
            { start: 13.5, end: 17, text: ' important topics' },
            { start: 17.5, end: 20, text: ' to discuss.' }
          ]
        }
      },
      {
        chunk: 2,
        startTime: 20,
        endTime: 30,
        audioPath: 'test_chunk_2.wav',
        transcript: {
          text: '', // Silent chunk
          segments: []
        }
      },
      {
        chunk: 3,
        startTime: 30,
        endTime: 40,
        audioPath: 'test_chunk_3.wav',
        transcript: {
          text: 'Thank you for your attention.',
          segments: [
            { start: 30, end: 33, text: 'Thank you' },
            { start: 33.5, end: 37, text: ' for your' },
            { start: 37.5, end: 40, text: ' attention.' }
          ]
        }
      }
    ];
    
    // Process chunks with realistic timing
    for (const chunkData of testChunks) {
      console.log(`🎬 Processing chunk ${chunkData.chunk}...`);
      await realTimeProcessor.handleVideoChunk(chunkData);
      
      // Simulate real-time delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Stop processing
    console.log('🛑 Stopping real-time transcription...');
    await realTimeProcessor.stopRealTimeProcessing();
    
    // Get final results
    const finalResults = realTimeProcessor.getFinalResults('test-meeting-123');
    console.log('📊 Final Results:');
    console.log(`   🔢 Total Chunks: ${finalResults.totalChunks}`);
    console.log(`   📝 Total Segments: ${finalResults.segments.length}`);
    console.log(`   🎤 Provider: ${finalResults.provider}`);
    console.log(`   🤖 Model: ${finalResults.model}`);
    console.log(`   ⚡ Processed in Real-Time: ${finalResults.processedInRealTime}`);
    
    // Save test results
    const resultsPath = path.join(testDir, 'test_results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(finalResults, null, 2));
    console.log(`💾 Results saved to: ${resultsPath}`);
    
    console.log('✅ Real-time transcription test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  testRealTimeTranscription().then(() => {
    console.log('🎉 Test completed!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testRealTimeTranscription };

// Check for command line flags
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node test-realtime-transcription.js');
  console.log('');
  console.log('This script tests your real-time transcription configuration.');
  console.log('');
  console.log('Environment variables required:');
  console.log('  LLM_PROVIDER         - openai, azure_openai, or bedrock');
  console.log('  OPENAI_API_KEY       - For OpenAI provider');
  console.log('  AZURE_OPENAI_API_KEY - For Azure OpenAI provider');
  console.log('  AZURE_OPENAI_ENDPOINT- For Azure OpenAI provider');
  console.log('  AWS_ACCESS_KEY_ID    - For Bedrock provider');
  console.log('  AWS_SECRET_ACCESS_KEY- For Bedrock provider');
  process.exit(0); 
} 