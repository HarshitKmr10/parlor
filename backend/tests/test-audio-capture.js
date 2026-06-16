#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const { RealTimeMeetingProcessor } = require('./transcribeProcessor');

const execPromise = promisify(exec);

async function testAudioCapture() {
  console.log('🧪 Testing Audio Capture and Transcription');
  console.log('============================================');
  
  const testDir = path.join(__dirname, 'test_audio');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Create a test processor
  const processor = new RealTimeMeetingProcessor();
  
  console.log(`🎙️ Provider: ${processor.streamingTranscriber.provider}`);
  console.log(`🤖 Model: ${processor.streamingTranscriber.model}`);
  
  // Check API key configuration
  if (processor.streamingTranscriber.provider === 'openai') {
    const hasKey = !!process.env.OPENAI_API_KEY;
    console.log(`🔑 OpenAI API Key configured: ${hasKey ? 'YES' : 'NO'}`);
    if (!hasKey) {
      console.error('❌ Missing OPENAI_API_KEY - transcription will fail');
      return;
    }
  }
  
  // Test with real video files if available
  const testAudioPath = path.join(__dirname, 'meeting_data');
  let latestDir = null;
  
  if (fs.existsSync(testAudioPath)) {
    const dirs = fs.readdirSync(testAudioPath)
      .filter(dir => fs.statSync(path.join(testAudioPath, dir)).isDirectory())
      .sort()
      .reverse();
    
    if (dirs.length > 0) {
      latestDir = path.join(testAudioPath, dirs[0]);
      console.log(`📁 Found latest meeting data: ${latestDir}`);
      
      // Look for video chunks first, then audio chunks
      const chunkDirs = [
        { dir: path.join(latestDir, 'video_chunks'), type: 'video', ext: '.mp4' },
        { dir: path.join(latestDir, 'realtime_chunks'), type: 'audio', ext: '.wav' },
        { dir: path.join(latestDir, 'chunks'), type: 'audio', ext: '.wav' }
      ];
      
      for (const { dir: chunkDir, type, ext } of chunkDirs) {
        if (fs.existsSync(chunkDir)) {
          const chunks = fs.readdirSync(chunkDir)
            .filter(file => file.endsWith(ext))
            .sort();
          
          console.log(`🎬 Found ${chunks.length} ${type} chunks in ${chunkDir}`);
          
          for (const chunk of chunks.slice(0, 2)) { // Test first 2 chunks
            const chunkPath = path.join(chunkDir, chunk);
            const stats = fs.statSync(chunkPath);
            console.log(`📊 Chunk: ${chunk} - ${stats.size} bytes (${(stats.size / 1024).toFixed(1)} KB)`);
            
            if (stats.size > 1000) {
              if (type === 'video') {
                console.log(`🎬 Testing video chunk transcription: ${chunk}...`);
                await testVideoChunkTranscription(chunkPath, processor);
              } else {
                console.log(`🎤 Testing audio chunk transcription: ${chunk}...`);
                await testAudioChunkTranscription(chunkPath, processor);
              }
            } else {
              console.log(`⚠️ Chunk too small, skipping`);
            }
            console.log('---');
          }
          break; // Only test the first directory found
        }
      }
    }
  }
  
  if (!latestDir) {
    console.log('📝 No existing audio/video files found - would need to run a real meeting to capture content');
  }
  
  console.log('🏁 Audio capture test completed');
}

async function testVideoChunkTranscription(videoPath, processor) {
  try {
    // Extract audio from video chunk (same as bot script does)
    const audioPath = videoPath.replace('.mp4', '_test.wav');
    
    const audioExtractionCmd = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y`;
    await execPromise(audioExtractionCmd);
    
    if (fs.existsSync(audioPath)) {
      const audioStats = fs.statSync(audioPath);
      console.log(`   🎵 Extracted audio: ${(audioStats.size / 1024).toFixed(1)} KB`);
      
      const result = await processor.streamingTranscriber.transcribeChunk(audioPath, 0);
      console.log(`   ✅ Transcription result:`, {
        text: result.text || '(empty)',
        segments: result.segments?.length || 0,
        language: result.language
      });
      
      if (result.segments && result.segments.length > 0) {
        result.segments.forEach((seg, i) => {
          console.log(`      Segment ${i}: "${seg.text}" (${seg.start}s - ${seg.end}s)`);
        });
      }
      
      // Cleanup
      fs.unlinkSync(audioPath);
    } else {
      console.log(`   ❌ Audio extraction failed`);
    }
  } catch (error) {
    console.error(`   ❌ Video chunk test failed:`, error.message);
  }
}

async function testAudioChunkTranscription(audioPath, processor) {
  try {
    const result = await processor.streamingTranscriber.transcribeChunk(audioPath, 0);
    console.log(`   ✅ Transcription result:`, {
      text: result.text || '(empty)',
      segments: result.segments?.length || 0,
      language: result.language
    });
    
    if (result.segments && result.segments.length > 0) {
      result.segments.forEach((seg, i) => {
        console.log(`      Segment ${i}: "${seg.text}" (${seg.start}s - ${seg.end}s)`);
      });
    }
  } catch (error) {
    console.error(`   ❌ Audio transcription failed:`, error.message);
  }
}

if (require.main === module) {
  testAudioCapture().catch(console.error);
}

module.exports = { testAudioCapture }; 