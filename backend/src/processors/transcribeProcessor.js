require('dotenv').config();

/**
 * Multi-Provider Transcription Processor
 * 
 * Supports multiple transcription providers:
 * - OpenAI Whisper
 * - Azure OpenAI Whisper
 * - AWS Transcribe
 * - AWS HealthScribe (Used as alternative to AWS Transcribe)
 * - Amazon Bedrock Nova Sonic
 * 
 * AWS HealthScribe Configuration (when used as AWS Transcribe alternative):
 * - Provider: 'healthscribe'
 * - Supported Language: US English (en-US) only
 * - Supported Regions: US East (N. Virginia) only
 * - Audio Format: Lossless audio (FLAC or WAV), PCM 16-bit, 16kHz+ sample rate
 * - Output: Standard transcription with speaker identification (Speaker_0, Speaker_1, etc.)
 * 
 * Required Environment Variables for HealthScribe:
 * - LLM_PROVIDER=healthscribe
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION=us-east-1 (required)
 * - S3_BUCKET_NAME (for input audio)
 * - AWS_ACCOUNT_ID (for auto-generating role ARN) OR HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN
 * 
 * Optional Environment Variables for HealthScribe:
 * - HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN (IAM role ARN, auto-generated if AWS_ACCOUNT_ID provided)
 * - HEALTHSCRIBE_ROLE_NAME (role name for auto-generation, defaults to 'HealthScribeDataAccessRole')
 * - HEALTHSCRIBE_OUTPUT_BUCKET (defaults to S3_BUCKET_NAME)
 * - HEALTHSCRIBE_SPECIALTY (PRIMARYCARE or ORTHOPEDICS, defaults to PRIMARYCARE)
 * - HEALTHSCRIBE_KMS_KEY_ID (for encryption)
 * - HEALTHSCRIBE_VOCABULARY_NAME (custom vocabulary)
 * - HEALTHSCRIBE_VOCABULARY_FILTER_NAME (vocabulary filter)
 * 
 * HealthScribe Output Features:
 * - Rich conversation transcripts with word-level timestamps
 * - Speaker role identification (CLINICIAN, PATIENT)
 * - Clinical document generation with sections:
 *   - Chief Complaint
 *   - History of Present Illness
 *   - Assessment
 *   - Treatment Plan
 * - Medical term extraction with categories
 * - Evidence mapping for AI-generated content
 * - Conversation characteristics analysis
 */

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const OpenAI = require('openai');
const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand, StartMedicalTranscriptionJobCommand, GetMedicalTranscriptionJobCommand, StartMedicalScribeJobCommand, GetMedicalScribeJobCommand } = require("@aws-sdk/client-transcribe");
const { TranscribeStreamingClient, StartMedicalStreamTranscriptionCommand, StartStreamTranscriptionCommand } = require("@aws-sdk/client-transcribe-streaming");
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require('uuid');
const { BedrockRuntimeClient, InvokeModelWithBidirectionalStreamCommand } = require("@aws-sdk/client-bedrock-runtime");
const { createAzureSpeechConfig } = require('./azureSpeechAuth');
const { awsClientConfigFromEnv } = require('../utils/awsCredentials');

// Azure Speech SDK import (conditional to avoid errors if not installed)
/** @type {import('microsoft-cognitiveservices-speech-sdk')|null} */
let azureSpeech = null;
try {
  azureSpeech = require('microsoft-cognitiveservices-speech-sdk');
} catch (error) {
  // Azure Speech SDK not installed - will be handled in provider initialization
}

// Utility function to check FFmpeg availability
function checkFfmpegAvailability() {
  const availablePaths = [];
  const errors = [];
  const isDocker = process.env.RUNNING_IN_DOCKER === 'true';
  
  // In Docker environments, prefer system FFmpeg first for better reliability
  if (isDocker) {
    console.log('🐳 Running in Docker - prioritizing system FFmpeg');
  }
  
  // Check system ffmpeg first in Docker, or as fallback in other environments
  const checkSystemFFmpeg = () => {
    try {
      const { execSync } = require('child_process');
      
      // Try different common paths for system ffmpeg
      const systemPaths = [
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg', 
        'ffmpeg' // Let system PATH resolve it
      ];
      
      for (const systemPath of systemPaths) {
        try {
          if (systemPath !== 'ffmpeg' && fs.existsSync(systemPath)) {
            // Verify executable permissions
            fs.accessSync(systemPath, fs.constants.F_OK | fs.constants.X_OK);
            availablePaths.push({ type: 'system', path: systemPath });
            console.log(`✅ System ffmpeg verified: ${systemPath}`);
            break;
          } else if (systemPath === 'ffmpeg') {
            // Test if ffmpeg is in PATH by running version command
            execSync('ffmpeg -version', { timeout: 5000, stdio: 'pipe' });
            availablePaths.push({ type: 'system', path: 'ffmpeg' });
            console.log(`✅ System ffmpeg available in PATH`);
            break;
          }
        } catch (pathError) {
          // Continue to next path
          continue;
        }
      }
      
      // If no system ffmpeg found, add error
      if (!availablePaths.some(p => p.type === 'system')) {
        errors.push('No system ffmpeg found in common paths or PATH');
      }
      
    } catch (error) {
      errors.push(`System ffmpeg check failed: ${error.message}`);
    }
  };
  
  // FFmpeg is provided by the operating system: the system package in the
  // Docker image, or a locally-installed ffmpeg for non-Docker dev. The
  // bundled ffmpeg-static (GPL-3.0) binary has been removed.
  checkSystemFFmpeg();
  
  console.log(`🔍 FFmpeg availability summary: ${availablePaths.length} paths found, ${errors.length} errors`);
  if (errors.length > 0) {
    console.warn('⚠️ FFmpeg detection errors:', errors);
  }
  
  return { availablePaths, errors };
}

class MultiProviderTranscriber {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || 'openai';
    this.chunkDuration = parseInt(process.env.TRANSCRIPTION_CHUNK_DURATION) || 10; // seconds
    this.chunkOverlap = parseInt(process.env.TRANSCRIPTION_OVERLAP) || 1; // seconds
    this.model = process.env.TRANSCRIPTION_MODEL || 'whisper-1';
    this.format = process.env.TRANSCRIPTION_FORMAT || 'verbose_json';
    this.language = process.env.TRANSCRIPTION_LANGUAGE || null;
    this.forceFallback = process.env.FORCE_TRANSCRIPTION_FALLBACK === 'true';
    
    // Check FFmpeg availability for Bedrock provider
    if (this.provider === 'bedrock') {
      const ffmpegCheck = checkFfmpegAvailability();
      console.log('🔍 FFmpeg availability check:');
      console.log('✅ Available paths:', ffmpegCheck.availablePaths);
      if (ffmpegCheck.errors.length > 0) {
        console.warn('⚠️ FFmpeg warnings:', ffmpegCheck.errors);
      }
      
      // Only enable fallback if NO ffmpeg is available at all
      if (ffmpegCheck.availablePaths.length === 0) {
        console.error('❌ No FFmpeg available - enabling fallback to AWS Transcribe');
        this.forceFallback = true;
      } else {
        console.log(`✅ FFmpeg available (${ffmpegCheck.availablePaths.length} paths) - Bedrock transcription enabled`);
        // Store the best available path for later use
        this.preferredFfmpegPath = ffmpegCheck.availablePaths[0]; // Use first available system FFmpeg
      }
    }
    
    if (this.forceFallback) {
      console.log('🔄 Transcription fallback mode enabled - will use AWS Transcribe for Bedrock failures');
    }
    
    // Log provider-specific initialization
    if (this.provider === 'healthscribe') {
      console.log('🎤 AWS HealthScribe initialized for general transcription');
      console.log(`   Region: ${this.awsRegion}`);
      console.log(`   Input Bucket: ${this.s3Bucket}`);
      console.log(`   Output Bucket: ${this.healthScribeOutputBucket}`);
    }
    
    if (this.provider === 'aws_transcribe_medical') {
      console.log('🏥 AWS Transcribe Medical initialized');
      console.log(`   Region: ${this.awsRegion}`);
      console.log(`   Medical Specialty: ${this.medicalSpecialty}`);
      console.log(`   S3 Bucket: ${this.s3Bucket}`);
      console.log(`   Mode: ${this.useStreaming ? '🚀 Streaming (Real-time)' : '📦 Batch Processing'}`);
      console.log(`   Chunk Duration: ${this.chunkDuration}s ${this.useStreaming ? '(Optimized for streaming)' : '(⚠️ Batch processing - consider 30s+ for better performance)'}`);
      
      // Performance warning for batch mode with small chunks
      if (!this.useStreaming && this.chunkDuration < 20) {
        console.warn('⚠️ Small chunk duration with batch AWS Transcribe Medical may cause high latency');
        console.warn('💡 Consider enabling streaming mode (TRANSCRIBE_MEDICAL_STREAMING=true)');
        console.warn('💡 Or use chunks of 20-30 seconds for better batch throughput');
      }
    }
    
    // Add minimum chunk duration check
    if (this.chunkDuration < 10) {
      console.warn('⚠️ Chunk duration too small, setting to minimum of 10 seconds');
      this.chunkDuration = 10;
    }
    
    // Ensure overlap is not too large relative to chunk duration
    if (this.chunkOverlap > this.chunkDuration * 0.1) {
      console.warn('⚠️ Chunk overlap too large, setting to 10% of chunk duration');
      this.chunkOverlap = Math.floor(this.chunkDuration * 0.1);
    }
    
    // Validate provider
    const validProviders = ['openai', 'azure_openai', 'azure_speech', 'aws_transcribe', 'aws_transcribe_medical', 'bedrock', 'healthscribe'];
    if (!validProviders.includes(this.provider)) {
      throw new Error(`Invalid LLM_PROVIDER: ${this.provider}. Must be one of: ${validProviders.join(', ')}`);
    }
    
    this.initializeClients();
  }

  // Helper method to construct default HealthScribe role ARN
  constructDefaultHealthScribeRoleArn() {
    // Try to get AWS account ID from credentials or use a common role name
    const accountId = process.env.AWS_ACCOUNT_ID;
    const defaultRoleName = process.env.HEALTHSCRIBE_ROLE_NAME || 'HealthScribeDataAccessRole';
    
    if (accountId) {
      return `arn:aws:iam::${accountId}:role/${defaultRoleName}`;
    }
    
    // If no account ID provided, we'll need to get it dynamically or use a placeholder
    console.warn('⚠️ No AWS_ACCOUNT_ID provided. You may need to set HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN manually.');
    console.warn('⚠️ Using placeholder ARN - replace with your actual role ARN');
    return `arn:aws:iam::YOUR_ACCOUNT_ID:role/${defaultRoleName}`;
  }

  initializeClients() {
    switch (this.provider) {
      case 'openai':
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('Missing OPENAI_API_KEY for OpenAI provider');
        }
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        break;
        
      case 'azure_openai':
        if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
          throw new Error('Missing AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT for Azure OpenAI provider');
        }
        this.openai = new OpenAI({
          apiKey: process.env.AZURE_OPENAI_API_KEY,
          baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${this.model}`,
          defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview' },
          defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
        });
        break;

      case 'azure_speech':
        if (!azureSpeech) {
          throw new Error('Azure Speech SDK not installed. Install with: npm install microsoft-cognitiveservices-speech-sdk');
        }

        const speechEndpoint = process.env.AZURE_SPEECH_ENDPOINT;
        const speechKey = process.env.AZURE_SPEECH_KEY;
        const speechRegion = process.env.AZURE_SPEECH_REGION;
        const containerEndpoint = process.env.AZURE_SPEECH_CONTAINER_ENDPOINT;

        const speechConfig = createAzureSpeechConfig({
          sdk: azureSpeech,
          endpoint: speechEndpoint,
          key: speechKey,
          region: speechRegion,
          containerEndpoint,
        });
        this.azureSpeechConfig = speechConfig.config;
        console.log(`🎤 Azure Speech initialized with ${speechConfig.authMode}${speechConfig.endpoint ? ` at ${speechConfig.endpoint}` : ''}`);

        // Optionally disable CRL check for private endpoints behind firewalls
        if (process.env.AZURE_SPEECH_DISABLE_CRL_CHECK === 'true') {
          this.azureSpeechConfig.setProperty("OPENSSL_DISABLE_CRL_CHECK", "true");
          console.log('⚠️ CRL check for Azure Speech has been disabled via OPENSSL_DISABLE_CRL_CHECK.');
        }

        // Set primary language
        this.azureSpeechConfig.speechRecognitionLanguage = this.language || 'en-US';
        console.log(`🎤 Azure Speech language: ${this.azureSpeechConfig.speechRecognitionLanguage}`);

        // Enable detailed results with word-level timestamps
        this.azureSpeechConfig.setProperty(azureSpeech.PropertyId.SpeechServiceResponse_RequestDetailedResultTrueFalse, "true");
        this.azureSpeechConfig.setProperty(azureSpeech.PropertyId.SpeechServiceResponse_RequestWordLevelTimestamps, "true");

        // Enable automatic punctuation and capitalization
        this.azureSpeechConfig.setProperty(azureSpeech.PropertyId.SpeechServiceResponse_PostProcessingOption, "TrueText");
        break;

      case 'aws_transcribe':
        // if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        //   throw new Error('Missing AWS credentials for AWS Transcribe provider');
        // }
        if (!process.env.S3_BUCKET_NAME) {
          throw new Error('Missing S3_BUCKET_NAME environment variable for AWS Transcribe provider');
        }
        this.awsRegion = process.env.AWS_REGION || 'us-east-1';
        this.s3Bucket = process.env.S3_BUCKET_NAME;
        // Streaming default ON: batch jobs add 8–15 s of poll-loop overhead
        // per chunk (StartTranscriptionJob → repeated GetTranscriptionJob),
        // streaming returns final results in roughly real-time. Set
        // TRANSCRIBE_STREAMING=false to opt out of streaming if the job
        // shape needs the batch S3 round-trip.
        this.useStreaming = process.env.TRANSCRIBE_STREAMING !== 'false';

        const awsTransConfig = awsClientConfigFromEnv({ region: this.awsRegion });

        this.transcribeClient = new TranscribeClient(awsTransConfig);

        this.s3Client = new S3Client(awsTransConfig);

        // Streaming client is shared across providers; only initialize once.
        if (!this.transcribeStreamingClient) {
          this.transcribeStreamingClient = new TranscribeStreamingClient(awsTransConfig);
        }
        break;
        
      case 'aws_transcribe_medical':
        // if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        //   throw new Error('Missing AWS credentials for AWS Transcribe Medical provider');
        // }
        if (!process.env.S3_BUCKET_NAME) {
          throw new Error('Missing S3_BUCKET_NAME environment variable for AWS Transcribe Medical provider');
        }
        
        this.awsRegion = process.env.AWS_REGION || 'us-east-1';
        this.s3Bucket = process.env.S3_BUCKET_NAME;
        this.medicalSpecialty = process.env.TRANSCRIBE_MEDICAL_SPECIALTY || 'PRIMARYCARE'; // PRIMARYCARE, CARDIOLOGY, NEUROLOGY, ONCOLOGY, RADIOLOGY, UROLOGY
        this.useStreaming = process.env.TRANSCRIBE_MEDICAL_STREAMING !== 'false'; // Default to streaming for better performance
        
        // Configure AWS credentials: use explicit env vars if provided,
        // otherwise fall back to the SDK default credential chain.
        const awsConfig = awsClientConfigFromEnv({ region: this.awsRegion });

        this.s3Client = new S3Client(awsConfig);
        this.transcribeClient = new TranscribeClient(awsConfig);

        // Initialize streaming client for real-time transcription
        if (this.useStreaming) {
          this.transcribeStreamingClient = new TranscribeStreamingClient(awsConfig);
        }
        break;
        
      case 'bedrock':
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
          throw new Error('Missing AWS credentials for Bedrock provider');
        }
        
        this.awsRegion = process.env.AWS_REGION || 'us-east-1';
        this.novaSonicModel = process.env.BEDROCK_MODEL_ID || 'amazon.nova-sonic-v1:0';
        
        const bedrockAwsConfig = awsClientConfigFromEnv({
          region: this.awsRegion,
          requireCredentials: true,
          providerName: 'Bedrock provider',
        });
        this.bedrockClient = new BedrockRuntimeClient(bedrockAwsConfig);
        
        // Also initialize S3 client in case fallback to AWS Transcribe is needed
        if (process.env.S3_BUCKET_NAME) {
          this.s3Bucket = process.env.S3_BUCKET_NAME;
          this.s3Client = new S3Client(bedrockAwsConfig);
          
          this.transcribeClient = new TranscribeClient(bedrockAwsConfig);
        }
        break;
        
      case 'healthscribe':
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
          throw new Error('Missing AWS credentials for HealthScribe provider');
        }
        if (!process.env.S3_BUCKET_NAME) {
          throw new Error('Missing S3_BUCKET_NAME environment variable for HealthScribe provider');
        }
        
        this.awsRegion = process.env.AWS_REGION || 'us-east-1';
        this.s3Bucket = process.env.S3_BUCKET_NAME;
        
        // Use environment variable if provided, otherwise construct default ARN
        this.healthScribeDataAccessRoleArn = process.env.HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN || 
          this.constructDefaultHealthScribeRoleArn();
          
        this.healthScribeOutputBucket = process.env.HEALTHSCRIBE_OUTPUT_BUCKET || this.s3Bucket;
        this.healthScribeSpecialty = process.env.HEALTHSCRIBE_SPECIALTY || 'PRIMARYCARE'; // PRIMARYCARE or ORTHOPEDICS
        
        // Validate the role ARN
        if (this.healthScribeDataAccessRoleArn.includes('YOUR_ACCOUNT_ID')) {
          console.error('❌ HealthScribe role ARN contains placeholder. Please either:');
          console.error('   1. Set AWS_ACCOUNT_ID environment variable, or');
          console.error('   2. Set HEALTHSCRIBE_DATA_ACCESS_ROLE_ARN directly');
          console.error(`   Current ARN: ${this.healthScribeDataAccessRoleArn}`);
          throw new Error('Invalid HealthScribe role ARN - contains placeholder');
        }
        
        const healthScribeAwsConfig = awsClientConfigFromEnv({
          region: this.awsRegion,
          requireCredentials: true,
          providerName: 'HealthScribe provider',
        });
        this.transcribeClient = new TranscribeClient(healthScribeAwsConfig);
        
        this.s3Client = new S3Client(healthScribeAwsConfig);
        break;
        
      default:
        throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }
  }

  async transcribeFile(filePath, realTimeCallback = null) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    console.log(`🎤 Starting transcription with provider: ${this.provider}`);
    console.log(`⏱️ Chunk duration: ${this.chunkDuration}s, Overlap: ${this.chunkOverlap}s`);
    console.log(`📊 Expected chunks per minute: ${Math.ceil(60 / (this.chunkDuration - this.chunkOverlap))}`);

    try {
      // If realTimeCallback is provided, use chunked transcription
      if (realTimeCallback) {
        return await this.transcribeWithChunks(filePath, realTimeCallback);
      } else {
        // Otherwise, transcribe the whole file
        return await this.transcribeWholeFile(filePath);
      }
    } catch (error) {
      console.error('❌ Error during transcription:', error);
      throw error;
    }
  }

  async transcribeWithChunks(filePath, realTimeCallback) {
    const tempDir = path.join(path.dirname(filePath), 'chunks');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Get audio duration
    const duration = await this.getAudioDuration(filePath);
    console.log(`🎵 Audio duration: ${duration}s`);

    const chunks = [];
    const transcriptSegments = [];
    let currentTime = 0;

    while (currentTime < duration) {
      const chunkEnd = Math.min(currentTime + this.chunkDuration, duration);
      const chunkPath = path.join(tempDir, `chunk_${currentTime}.wav`);
      
      console.log(`🔄 Processing chunk ${currentTime}s - ${chunkEnd}s`);
      
      // Extract chunk
      await this.extractAudioChunk(filePath, chunkPath, currentTime, chunkEnd - currentTime);
      
      // Transcribe chunk
      const chunkTranscript = await this.transcribeChunk(chunkPath, currentTime);
      
      if (chunkTranscript && chunkTranscript.segments) {
        transcriptSegments.push(...chunkTranscript.segments);
        
        // Call real-time callback if provided
        if (realTimeCallback) {
          await realTimeCallback({
            chunk: chunks.length,
            startTime: currentTime,
            endTime: chunkEnd,
            transcript: chunkTranscript,
            segments: chunkTranscript.segments
          });
        }
      }

      chunks.push({
        startTime: currentTime,
        endTime: chunkEnd,
        transcript: chunkTranscript
      });

      // Move to next chunk (with overlap)
      currentTime += this.chunkDuration - this.chunkOverlap;
    }

    // Cleanup chunk files
    this.cleanupChunks(tempDir);

    // Combine all segments
    const finalTranscript = {
      text: transcriptSegments.map(s => s.text).join(' '),
      segments: transcriptSegments,
      chunks: chunks.length,
      provider: this.provider,
      model: this.model,
      totalDuration: duration
    };

    // Save final transcript
    const outputPath = `${filePath}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(finalTranscript, null, 2));
    
    console.log(`✅ Chunked transcription completed: ${chunks.length} chunks processed`);
    return outputPath;
  }

  async transcribeWholeFile(filePath) {
    console.log(`🎤 Transcribing whole file with ${this.provider}`);
    
    const transcript = await this.transcribeChunk(filePath, 0);
    const outputPath = `${filePath}.json`;
    
    const finalTranscript = {
      ...transcript,
      provider: this.provider,
      model: this.model,
      chunks: 1
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(finalTranscript, null, 2));
    
    console.log(`✅ Whole file transcription completed`);
    return outputPath;
  }

  async transcribeChunk(chunkPath, startTimeOffset = 0) {
    try {
      // Check if we're in test mode (to avoid API calls during testing)
      if (process.env.TRANSCRIPTION_TEST_MODE === 'true') {
        console.log(`🧪 Test mode: Skipping API call for ${chunkPath}`);
        return {
          text: "This is test transcription text",
          segments: [
            {
              start: startTimeOffset,
              end: startTimeOffset + 5,
              text: "This is test transcription text"
            }
          ]
        };
      }
      
      // Check if audio file exists and has reasonable size
      if (!fs.existsSync(chunkPath)) {
        console.error(`❌ Audio chunk file not found: ${chunkPath}`);
        return { text: '', segments: [] };
      }
      
      const stats = fs.statSync(chunkPath);
      console.log(`🎤 Audio chunk stats: ${chunkPath} - ${stats.size} bytes (${(stats.size / 1024).toFixed(1)} KB)`);
      
      // If file is too small, it's likely silent or corrupted
      if (stats.size < 1000) { // Less than 1KB suggests no meaningful audio
        console.warn(`⚠️ Audio chunk too small (${stats.size} bytes), likely silent. Skipping transcription.`);
        return { text: '', segments: [] };
      }
      
      console.log(`🎤 Transcribing chunk: ${chunkPath} (${this.provider}) - ${(stats.size / 1024).toFixed(1)} KB`);
      
      let transcriptionResult;
      switch (this.provider) {
        case 'openai':
        case 'azure_openai':
          transcriptionResult = await this.transcribeWithOpenAI(chunkPath, startTimeOffset);
          break;
          
        case 'aws_transcribe':
          // Streaming returns final results in ~1s vs ~10-15s for batch
          // (which needs S3 upload + StartTranscriptionJob + poll loop).
          if (this.useStreaming && this.transcribeStreamingClient) {
            transcriptionResult = await this.transcribeWithAWSStream(chunkPath, startTimeOffset);
          } else {
            transcriptionResult = await this.transcribeWithAWS(chunkPath, startTimeOffset);
          }
          break;
          
        case 'aws_transcribe_medical':
          // Use streaming for better performance if available
          if (this.useStreaming) {
            transcriptionResult = await this.transcribeWithAWSMedicalStream(chunkPath, startTimeOffset);
          } else {
            // Performance optimization: Use OpenAI for very short chunks if available
            if (this.chunkDuration < 15 && process.env.OPENAI_API_KEY) {
              console.log(`🔄 Using OpenAI fallback for short chunk (${this.chunkDuration}s) to avoid AWS Medical overhead`);
              // Temporarily switch to OpenAI for this chunk
              const tempOpenAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
              const tempTranscription = await tempOpenAI.audio.transcriptions.create({
                file: fs.createReadStream(chunkPath),
                model: 'whisper-1',
                response_format: 'verbose_json',
                timestamp_granularities: ["word", "segment"],
              });
              
              // Adjust timestamps by startTimeOffset
              if (tempTranscription.segments) {
                tempTranscription.segments = tempTranscription.segments.map(segment => ({
                  ...segment,
                  start: segment.start + startTimeOffset,
                  end: segment.end + startTimeOffset
                }));
              }
              
              transcriptionResult = tempTranscription;
            } else {
              transcriptionResult = await this.transcribeWithAWSMedical(chunkPath, startTimeOffset);
            }
          }
          break;
          
        case 'bedrock':
          // Check if we should force fallback due to FFmpeg issues
          if (this.forceFallback && this.s3Bucket && this.transcribeClient) {
            console.log('🔄 Using AWS Transcribe fallback due to force fallback mode');
            transcriptionResult = await this.transcribeWithAWS(chunkPath, startTimeOffset);
          } else {
            transcriptionResult = await this.transcribeWithNovaSonic(chunkPath, startTimeOffset);
          }
          break;

        case 'azure_speech':
          transcriptionResult = await this.transcribeWithAzureSpeech(chunkPath, startTimeOffset);
          break;

        case 'healthscribe':
          transcriptionResult = await this.transcribeWithHealthScribe(chunkPath, startTimeOffset);
          break;

        default:
          throw new Error(`Unsupported provider: ${this.provider}`);
      }

      // Filter out very short or meaningless transcripts
      if (transcriptionResult && transcriptionResult.text) {
        const cleanText = transcriptionResult.text.trim();
        
        // Skip if text is too short (less than 10 characters)
        if (cleanText.length < 12) {
          console.log(`⏭️ Skipping short transcription: "${cleanText}" (${cleanText.length} chars)`);
          return { text: '', segments: [] };
        }
        
        // Skip if text contains only filler words, "you", or common transcription artifacts
        const meaninglessPattern = /^(you|You.|You|you.|um|uh|ah|hmm|well|so|like|okay|alright|thanks|thank you|yeah|yes|no|Thank you.|Thank you|Thank you very much|Thank you very much.|Thank you for having me.|Thank you for having me)(\s+\w+){0,2}$/i;
        if (meaninglessPattern.test(cleanText)) {
          console.log(`⏭️ Skipping meaningless transcription: "${cleanText}"`);
          return { text: '', segments: [] };
        }
        
        if (transcriptionResult.segments) {
          transcriptionResult.segments = transcriptionResult.segments.filter(segment => {
            const segmentText = segment.text?.trim() || '';
            return segmentText.length >= 10 && !meaninglessPattern.test(segmentText);
          });
        }

        console.log(`✅ Valid transcription: "${cleanText.substring(0, 50)}..." (${cleanText.length} chars)`);
      }
      
      return transcriptionResult;
    } catch (error) {
      console.error(`❌ Error transcribing chunk ${chunkPath} with ${this.provider}:`, error);
      console.error(`❌ Error details:`, error.message);
      
      // Log additional context for timeout errors
      if (error.message.includes('timed out')) {
        console.error(`⏰ Timeout occurred for chunk. Consider:`);
        console.error(`   - Increasing timeout in environment variables`);
        console.error(`   - Checking AWS service status`);
        console.error(`   - Using shorter audio chunks (reduce TRANSCRIPTION_CHUNK_DURATION)`);
        
        // For real-time processing, we might want to return empty result instead of failing completely
        if (startTimeOffset > 0) { // This indicates real-time processing
          console.warn(`⚠️ Returning empty result for real-time chunk due to timeout`);
          return { text: '', segments: [], timeout: true, error: error.message };
        }
      }
      
      if (error.response) {
        console.error(`❌ API Response:`, error.response.status, error.response.data);
      }
      
      throw error; // Propagate the error up instead of returning empty result
    }
  }

  async transcribeWithOpenAI(audioPath, startTimeOffset = 0) {
    const transcription = await this.openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: this.model,
      response_format: this.format,
      timestamp_granularities: ["word", "segment"],
    });

    // Adjust timestamps by startTimeOffset
    if (transcription.segments) {
      transcription.segments = transcription.segments.map(segment => ({
        ...segment,
        start: segment.start + startTimeOffset,
        end: segment.end + startTimeOffset
      }));
    }

    return transcription;
  }

  async transcribeWithAzureSpeech(audioPath, startTimeOffset = 0) {
    return new Promise((resolve, reject) => {
      try {
        const audioConfig = azureSpeech.AudioConfig.fromWavFileInput(fs.readFileSync(audioPath));
        const recognizer = new azureSpeech.SpeechRecognizer(this.azureSpeechConfig, audioConfig);

        recognizer.recognizeOnceAsync(
          (result) => {
            recognizer.close();

            if (result.reason === azureSpeech.ResultReason.RecognizedSpeech) {
              const text = result.text;
              const segments = [];
              const words = [];

              // Parse detailed JSON results if available
              try {
                const jsonResult = result.properties.getProperty(azureSpeech.PropertyId.SpeechServiceResponse_JsonResult);
                if (jsonResult) {
                  const parsed = JSON.parse(jsonResult);
                  if (parsed.NBest && parsed.NBest[0]) {
                    const best = parsed.NBest[0];
                    if (best.Words) {
                      best.Words.forEach(w => {
                        words.push({
                          word: w.Word,
                          start: (w.Offset / 10000000) + startTimeOffset,
                          end: ((w.Offset + w.Duration) / 10000000) + startTimeOffset
                        });
                      });
                    }
                  }
                }
              } catch (parseError) {
                console.warn('⚠️ Could not parse Azure Speech detailed results:', parseError.message);
              }

              // Create segment from the full result
              const offsetInSeconds = result.offset / 10000000;
              const durationInSeconds = result.duration / 10000000;
              segments.push({
                text: text,
                start: offsetInSeconds + startTimeOffset,
                end: offsetInSeconds + durationInSeconds + startTimeOffset,
                words: words.length > 0 ? words : undefined
              });

              resolve({
                text: text,
                segments: segments,
                words: words.length > 0 ? words : undefined
              });
            } else if (result.reason === azureSpeech.ResultReason.NoMatch) {
              console.log('⚠️ Azure Speech: No speech recognized in chunk');
              resolve({ text: '', segments: [] });
            } else {
              reject(new Error(`Azure Speech recognition failed: ${result.reason}`));
            }
          },
          (error) => {
            recognizer.close();
            reject(new Error(`Azure Speech error: ${error}`));
          }
        );
      } catch (error) {
        reject(new Error(`Azure Speech setup error: ${error.message}`));
      }
    });
  }

  async transcribeWithNovaSonic(audioPath, startTimeOffset = 0) {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`🎤 Starting Nova Sonic transcription for: ${audioPath} (attempt ${attempt + 1}/${maxRetries})`);
        
        // Generate unique IDs for the session
        const promptName = uuidv4();
        const contentName = uuidv4();
        const audioContentName = uuidv4();

        // Convert audio to PCM format
        console.log('🔄 Converting audio to PCM format...');
        const audioBuffer = await this.convertToPCM(audioPath);
        console.log(`✅ Audio converted (${audioBuffer.length} bytes)`);

        // Create bidirectional stream with HTTP2 handler
        const command = new InvokeModelWithBidirectionalStreamCommand({
          modelId: this.novaSonicModel,
          body: this.generateNovaChunks.bind(this)(audioBuffer, promptName, contentName, audioContentName)
        });

        console.log('🚀 Starting transcription stream...');
        const response = await this.bedrockClient.send(command);

        // Process responses
        const transcriptionSegments = [];
        let currentText = '';
        let segmentStart = startTimeOffset;
        let hasReceivedData = false;

        try {
          for await (const part of response.body) {
            if (part.chunk?.bytes) {
              hasReceivedData = true;
              const text = new TextDecoder().decode(part.chunk.bytes);
              const json = JSON.parse(text);
              
              if (json.event?.textOutput) {
                const content = json.event.textOutput.content;
                console.log('📝 Transcription:', content);
                
                // Add segment with timing
                transcriptionSegments.push({
                  text: content,
                  start: segmentStart,
                  end: segmentStart + 5, // Approximate duration
                  speaker: 'Transcription'
                });
                
                currentText += ' ' + content;
                segmentStart += 5; // Move window forward
              }
            }
          }

          // If we got here without error and received data, return the results
          if (hasReceivedData) {
            return {
              text: currentText.trim(),
              segments: transcriptionSegments
            };
          }

          // If we didn't receive any data, throw an error to trigger retry
          throw new Error('No transcription data received');

        } catch (streamError) {
          console.error('❌ Stream error:', streamError.message);
          
          // If we got some data before the stream error, return what we have
          if (hasReceivedData && transcriptionSegments.length > 0) {
            console.log('⚠️ Stream ended early but returning partial transcription');
            return {
              text: currentText.trim(),
              segments: transcriptionSegments,
              partial: true
            };
          }
          
          // Otherwise, throw the error to trigger retry
          throw streamError;
        }

      } catch (error) {
        lastError = error;
        const isThrottling = error.name === 'ThrottlingException' || 
                           error.message?.includes('Too many connections');
        const isStreamError = error.code === 'ERR_STREAM_PREMATURE_CLOSE';
        
        if ((isThrottling || isStreamError) && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
          console.log(`⏳ Nova Sonic error (${error.name}). Retrying in ${delay/1000} seconds... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If we've exhausted retries or it's a different error, throw it
        console.error(`❌ Error with Nova Sonic transcription:`, error);
        throw error;
      }
    }

    // If we get here, we've exhausted all retries
    throw lastError || new Error('Failed to transcribe after all retries');
  }

  // Helper method to convert audio to PCM format
  async convertToPCM(filePath) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      // Enhanced FFmpeg path selection with better fallback handling
      let ffmpegPath;
      let pathType = 'unknown';
      
      if (this.preferredFfmpegPath) {
        ffmpegPath = this.preferredFfmpegPath.path;
        pathType = this.preferredFfmpegPath.type;
        console.log(`🎵 Using preferred FFmpeg path (${pathType}): ${ffmpegPath}`);
      } else {
        // Use system FFmpeg (resolved via PATH).
        ffmpegPath = 'ffmpeg';
        pathType = 'system';
        console.log('🎵 Using system FFmpeg');
      }
      
      const executeFFmpegCommand = (path, type, isRetry = false) => {
        const retryText = isRetry ? ' (retry)' : '';
        console.log(`🎵 Starting FFmpeg conversion${retryText} with ${type}: ${path}`);
        
        const command = ffmpeg(filePath)
          .setFfmpegPath(path)
          .format('s16le')
          .audioFrequency(16000)
          .audioChannels(1)
          .on('start', cmdLine => console.log(`🎵 FFmpeg started${retryText}:`, cmdLine))
          .on('error', error => {
            console.error(`❌ FFmpeg ${type} error${retryText}:`, error);
            
            // Only attempt fallback if this wasn't already a retry and we have options
            if (!isRetry) {
              if (type !== 'system' && type !== 'system-docker') {
                console.log('🔄 Retrying with system ffmpeg...');
                executeFFmpegCommand('ffmpeg', 'system-fallback', true);
                return;
              }
            }
            
            // Final failure
            reject(new Error(`FFmpeg conversion failed with ${type}${retryText}. Please ensure FFmpeg is properly installed. Error: ${error.message}`));
          });

        const stream = command.pipe();
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`✅ Audio converted to PCM${retryText} with ${type} (${buffer.length} bytes)`);
          resolve(buffer);
        });
        stream.on('error', streamError => {
          console.error(`❌ Stream error${retryText} with ${type}:`, streamError);
          
          // Only attempt fallback if this wasn't already a retry
          if (!isRetry && type !== 'system' && type !== 'system-docker') {
            console.log('🔄 Retrying with system ffmpeg due to stream error...');
            chunks.length = 0; // Clear chunks for retry
            executeFFmpegCommand('ffmpeg', 'system-fallback', true);
          } else {
            reject(streamError);
          }
        });
      };
      
                    // Start the conversion process
       executeFFmpegCommand(ffmpegPath, pathType);
     });
   }

  // Helper method to generate Nova Sonic chunks
  async *generateNovaChunks(audioBuffer, promptName, contentName, audioContentName) {
    const encoder = new TextEncoder();
    const CHUNK_SIZE = 8192; // Increased from 4096 to reduce number of chunks
    const CHUNK_DELAY = 50; // milliseconds between chunks
    const SETUP_DELAY = 100; // milliseconds between setup events

    // Initial setup events
    const initEvents = [
      {
        event: {
          sessionStart: {
            inferenceConfiguration: {
              maxTokens: 2048, // Increased from 1024
              topP: 0.9,
              temperature: 0.7,
              timeoutInSeconds: 60 // Add explicit timeout
            }
          }
        }
      },
      {
        event: {
          promptStart: {
            promptName,
            textOutputConfiguration: {
              mediaType: "text/plain"
            },
            audioOutputConfiguration: {
              mediaType: "audio/lpcm",
              sampleRateHertz: 24000,
              sampleSizeBits: 16,
              channelCount: 1,
              voiceId: "matthew",
              encoding: "base64",
              audioType: "SPEECH"
            }
          }
        }
      },
      {
        event: {
          contentStart: {
            promptName,
            contentName,
            type: "TEXT",
            interactive: true,
            role: "SYSTEM",
            textInputConfiguration: {
              mediaType: "text/plain"
            }
          }
        }
      },
      {
        event: {
          textInput: {
            promptName,
            contentName,
            content: "You are a transcription assistant. Accurately transcribe audio verbatim."
          }
        }
      },
      {
        event: {
          contentEnd: {
            promptName,
            contentName
          }
        }
      },
      {
        event: {
          contentStart: {
            promptName,
            contentName: audioContentName,
            type: "AUDIO",
            interactive: true,
            role: "USER",
            audioInputConfiguration: {
              mediaType: "audio/lpcm",
              sampleRateHertz: 16000,
              sampleSizeBits: 16,
              channelCount: 1,
              audioType: "SPEECH",
              encoding: "base64"
            }
          }
        }
      }
    ];

    // Send initialization events with delays
    for (const evt of initEvents) {
      yield { chunk: { bytes: encoder.encode(JSON.stringify(evt)) } };
      await new Promise(r => setTimeout(r, SETUP_DELAY));
    }

    // Stream audio chunks with controlled pacing
    let totalBytesSent = 0;
    const startTime = Date.now();

    for (let offset = 0; offset < audioBuffer.length; offset += CHUNK_SIZE) {
      const slice = audioBuffer.slice(offset, offset + CHUNK_SIZE);
      const base64 = slice.toString('base64');
      
      const audioEvt = {
        event: {
          audioInput: {
            promptName,
            contentName: audioContentName,
            content: base64
          }
        }
      };
      
      yield { chunk: { bytes: encoder.encode(JSON.stringify(audioEvt)) } };
      
      totalBytesSent += slice.length;
      
      // Log progress every ~25% of the audio
      if (totalBytesSent % Math.floor(audioBuffer.length / 4) < CHUNK_SIZE) {
        const progress = Math.round((totalBytesSent / audioBuffer.length) * 100);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`📊 Streaming progress: ${progress}% (${totalBytesSent} bytes sent in ${elapsed}s)`);
      }
      
      await new Promise(r => setTimeout(r, CHUNK_DELAY));
    }

    // Closing events
    const endEvents = [
      {
        event: {
          contentEnd: {
            promptName,
            contentName: audioContentName
          }
        }
      },
      {
        event: {
          promptEnd: {
            promptName
          }
        }
      },
      {
        event: {
          sessionEnd: {}
        }
      }
    ];

    // Send closing events with delays
    for (const evt of endEvents) {
      yield { chunk: { bytes: encoder.encode(JSON.stringify(evt)) } };
      await new Promise(r => setTimeout(r, SETUP_DELAY));
    }

    console.log(`✅ Completed streaming ${totalBytesSent} bytes in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  }

  async transcribeWithAWS(audioPath, startTimeOffset = 0) {
    try {
      console.log(`🎤 Starting AWS Transcribe for: ${audioPath}`);
      
      // Generate unique job name and S3 key
      const jobName = `transcription-${uuidv4()}-${Date.now()}`;
      const s3Key = `temp-audio/${jobName}.wav`;
      const s3Uri = `s3://${this.s3Bucket}/${s3Key}`;
      
      // Upload audio file to S3
      console.log(`📤 Uploading audio to S3: ${s3Uri}`);
      await this.uploadAudioToS3(audioPath, s3Key);
      
      // Start transcription job
      console.log(`🚀 Starting transcription job: ${jobName}`);
      const jobParams = {
        TranscriptionJobName: jobName,
        LanguageCode: this.language || 'en-US',
        MediaFormat: 'wav',
        Media: {
          MediaFileUri: s3Uri,
        },
        // OutputBucketName: this.s3Bucket,
        Settings: {
          ShowSpeakerLabels: true,
          MaxSpeakerLabels: 10,
        },
      };
      
      const startCommand = new StartTranscriptionJobCommand(jobParams);
      await this.transcribeClient.send(startCommand);
      
      // Wait for transcription to complete
      console.log(`⏳ Waiting for transcription job to complete...`);
      const transcriptionResult = await this.waitForTranscriptionCompletion(jobName);
      
      // Clean up S3 file
      await this.cleanupS3File(s3Key);
      
      // Format the result to match OpenAI Whisper format
      const formattedResult = this.formatAWSTranscribeResult(transcriptionResult, startTimeOffset);
      
      console.log(`✅ AWS Transcribe completed for job: ${jobName}`);
      return formattedResult;
      
    } catch (error) {
      console.error('❌ AWS Transcribe error:', error);
      throw error;
    }
  }

  async transcribeWithHealthScribe(audioPath, startTimeOffset = 0) {
    try {
      console.log(`🏥 Starting AWS HealthScribe transcription for: ${audioPath}`);
      
      // Generate unique job name and S3 key
      const jobName = `healthscribe-${uuidv4()}-${Date.now()}`;
      const inputS3Key = `healthscribe-input/${jobName}.wav`;
      const outputS3Key = `healthscribe-output/${jobName}/`;
      const inputS3Uri = `s3://${this.s3Bucket}/${inputS3Key}`;
      const outputS3Uri = `s3://${this.healthScribeOutputBucket}/${outputS3Key}`;
      
      // Upload audio file to S3
      console.log(`📤 Uploading audio to S3 for HealthScribe: ${inputS3Uri}`);
      await this.uploadAudioToS3(audioPath, inputS3Key);
      
      // Start HealthScribe job (using simplified settings for general transcription)
      console.log(`🚀 Starting HealthScribe job: ${jobName}`);
      const jobParams = {
        MedicalScribeJobName: jobName,
        Media: {
          MediaFileUri: inputS3Uri,
        },
        OutputBucketName: this.healthScribeOutputBucket,
        OutputEncryptionKMSKeyId: process.env.HEALTHSCRIBE_KMS_KEY_ID, // Optional
        DataAccessRoleArn: this.healthScribeDataAccessRoleArn,
        Settings: {
          ShowSpeakerLabels: true,
          MaxSpeakerLabels: 10, // Support more speakers for general meetings
          ChannelIdentification: false,
          VocabularyName: process.env.HEALTHSCRIBE_VOCABULARY_NAME, // Optional custom vocabulary
          VocabularyFilterName: process.env.HEALTHSCRIBE_VOCABULARY_FILTER_NAME, // Optional vocabulary filter
        },
        // No channel definitions needed for general transcription
        Tags: [
          {
            Key: 'Application',
            Value: 'MeetingJoiner'
          },
          {
            Key: 'JobType',
            Value: 'GeneralTranscription'
          }
        ]
      };
      
      // Add specialty if specified
      if (this.healthScribeSpecialty) {
        jobParams.Settings.Specialty = this.healthScribeSpecialty;
      }
      
      const startCommand = new StartMedicalScribeJobCommand(jobParams);
      await this.transcribeClient.send(startCommand);
      
      // Wait for transcription to complete
      console.log(`⏳ Waiting for HealthScribe job to complete...`);
      const healthScribeResult = await this.waitForHealthScribeCompletion(jobName);
      
      // Clean up input S3 file
      await this.cleanupS3File(inputS3Key);
      
      // Format the result to match OpenAI Whisper format
      const formattedResult = this.formatHealthScribeResult(healthScribeResult, startTimeOffset);
      
      console.log(`✅ AWS HealthScribe completed for job: ${jobName}`);
      return formattedResult;
      
    } catch (error) {
      console.error('❌ AWS HealthScribe error:', error);
      throw error;
    }
  }

  async uploadAudioToS3(audioPath, s3Key) {
    try {
      const fileContent = fs.readFileSync(audioPath);
      const uploadParams = {
        Bucket: this.s3Bucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'audio/wav',
      };
      
      const uploadCommand = new PutObjectCommand(uploadParams);
      await this.s3Client.send(uploadCommand);
      console.log(`✅ Audio uploaded to S3: ${s3Key}`);
    } catch (error) {
      console.error('❌ Error uploading to S3:', error);
      throw error;
    }
  }

  async waitForTranscriptionCompletion(jobName, maxWaitTime = 300000) { // 5 minutes max
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const getJobCommand = new GetTranscriptionJobCommand({
          TranscriptionJobName: jobName,
        });
        
        const response = await this.transcribeClient.send(getJobCommand);
        const status = response.TranscriptionJob.TranscriptionJobStatus;
        
        console.log(`📊 Transcription job status: ${status}`);
        
        if (status === 'COMPLETED') {
          // Download the transcription result from S3
          const resultUri = response.TranscriptionJob.Transcript.TranscriptFileUri;
          console.log(`📥 Downloading transcription result from: ${resultUri}`);
          
          try {
            // First try using axios (for presigned URLs)
            const axios = require('axios');
            const resultResponse = await axios.get(resultUri);
            return resultResponse.data;
          } catch (axiosError) {
            console.log(`⚠️ Axios failed (${axiosError.response?.status}), trying S3 client...`);
            
            // Fallback: Parse S3 URL and use S3 client
            try {
              const url = new URL(resultUri);
              console.log(`🔍 Parsing S3 URL: ${resultUri}`);
              console.log(`🔍 URL hostname: ${url.hostname}`);
              console.log(`🔍 URL pathname: ${url.pathname}`);
              
              let bucketName, objectKey;
              
              // Handle different S3 URL formats
              if (url.hostname.includes('.s3.') || url.hostname.includes('.s3-')) {
                // Format: https://bucket-name.s3.region.amazonaws.com/path/to/file
                bucketName = url.hostname.split('.')[0];
                objectKey = url.pathname.substring(1); // Remove leading '/'
              } else if (url.hostname.startsWith('s3.') || url.hostname.startsWith('s3-')) {
                // Format: https://s3.region.amazonaws.com/bucket-name/path/to/file
                const pathParts = url.pathname.substring(1).split('/'); // Remove leading '/' and split
                bucketName = pathParts[0];
                objectKey = pathParts.slice(1).join('/');
              } else {
                throw new Error(`Unrecognized S3 URL format: ${resultUri}`);
              }
              
              console.log(`📥 Parsed S3 - Bucket: ${bucketName}, Key: ${objectKey}`);
              
              // Validate bucket and key
              if (!bucketName || bucketName.trim() === '') {
                throw new Error(`Invalid bucket name: '${bucketName}' from URL: ${resultUri}`);
              }
              if (!objectKey || objectKey.trim() === '') {
                throw new Error(`Invalid object key: '${objectKey}' from URL: ${resultUri}`);
              }
              
              const getObjectCommand = new GetObjectCommand({
                Bucket: bucketName.trim(),
                Key: objectKey.trim(),
              });
              
              const s3Response = await this.s3Client.send(getObjectCommand);
              const streamToString = (stream) => 
                new Promise((resolve, reject) => {
                  const chunks = [];
                  stream.on('data', (chunk) => chunks.push(chunk));
                  stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
                  stream.on('error', reject);
                });
              
              const bodyContents = await streamToString(s3Response.Body);
              return JSON.parse(bodyContents);
              
            } catch (s3Error) {
              console.error('❌ S3 client also failed:', s3Error);
              throw new Error(`Failed to download transcription result: ${axiosError.response?.status} ${axiosError.message}, S3 fallback: ${s3Error.message}`);
            }
          }
          
        } else if (status === 'FAILED') {
          const failureReason = response.TranscriptionJob.FailureReason;
          throw new Error(`Transcription job failed: ${failureReason}`);
        }
        
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (error) {
        console.error('❌ Error checking transcription status:', error);
        throw error;
      }
    }
    
    throw new Error(`Transcription job timed out after ${maxWaitTime / 1000} seconds`);
  }

  async transcribeWithAWSMedical(audioPath, startTimeOffset = 0) {
    try {
      console.log(`🏥 Starting AWS Transcribe Medical for: ${audioPath}`);
      const startTime = Date.now();
      
      // Generate unique job name and S3 key
      const jobName = `medical-transcription-${uuidv4()}-${Date.now()}`;
      const s3Key = `temp-medical-audio/${jobName}.wav`;
      const s3Uri = `s3://${this.s3Bucket}/${s3Key}`;
      
      // Upload audio file to S3
      console.log(`📤 Uploading audio to S3: ${s3Uri}`);
      await this.uploadAudioToS3(audioPath, s3Key);
      const uploadTime = Date.now();
      console.log(`⏱️ Upload completed in ${uploadTime - startTime}ms`);
      
      // Start medical transcription job
      console.log(`🚀 Starting medical transcription job: ${jobName}`);
      const jobParams = {
        MedicalTranscriptionJobName: jobName,
        LanguageCode: 'en-US', // Medical transcribe only supports US English
        MediaFormat: 'wav',
        Media: {
          MediaFileUri: s3Uri,
        },
        OutputBucketName: this.s3Bucket, // Required for medical transcription
        Specialty: this.medicalSpecialty,
        Type: 'CONVERSATION', // CONVERSATION or DICTATION
        Settings: {
          ShowSpeakerLabels: true,
          MaxSpeakerLabels: 10,
          VocabularyName: process.env.TRANSCRIBE_MEDICAL_VOCABULARY_NAME, // Optional custom vocabulary
        },
      };
      
      const startCommand = new StartMedicalTranscriptionJobCommand(jobParams);
      await this.transcribeClient.send(startCommand);
      const jobStartTime = Date.now();
      console.log(`⏱️ Job started in ${jobStartTime - uploadTime}ms`);
      
      // Wait for transcription to complete
      console.log(`⏳ Waiting for medical transcription job to complete...`);
      const transcriptionResult = await this.waitForMedicalTranscriptionCompletion(jobName);
      const transcriptionTime = Date.now();
      console.log(`⏱️ Transcription completed in ${transcriptionTime - jobStartTime}ms`);
      
      // Clean up S3 file
      await this.cleanupS3File(s3Key);
      
      // Format the result to match OpenAI Whisper format
      const formattedResult = this.formatAWSTranscribeResult(transcriptionResult, startTimeOffset);
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ AWS Transcribe Medical completed for job: ${jobName} (Total: ${totalTime}ms)`);
      return formattedResult;
      
    } catch (error) {
      console.error('❌ AWS Transcribe Medical error:', error);
      throw error;
    }
  }

  // Streaming variant of plain AWS Transcribe. Mirrors the medical
  // streaming method (transcribeWithAWSMedicalStream) but uses
  // StartStreamTranscriptionCommand and includes ShowSpeakerLabel for
  // diarisation. Falls back to batch on any streaming-related error so
  // a single bad chunk doesn't blank the meeting.
  async transcribeWithAWSStream(audioPath, startTimeOffset = 0) {
    try {
      console.log(`🚀 Starting AWS Stream Transcription for: ${audioPath}`);
      const startTime = Date.now();

      console.log(`🔄 Converting audio to PCM format for streaming...`);
      const pcmBuffer = await this.convertToPCMForStreaming(audioPath);
      console.log(`✅ Audio converted to PCM: ${pcmBuffer.length} bytes`);

      async function* audioStream() {
        const CHUNK_SIZE = 1024 * 4;
        for (let i = 0; i < pcmBuffer.length; i += CHUNK_SIZE) {
          const chunk = pcmBuffer.slice(i, i + CHUNK_SIZE);
          yield { AudioEvent: { AudioChunk: chunk } };
          // Pace at the wall-clock rate the chunk was captured. Without
          // this, the stream finishes sub-second and Transcribe returns
          // truncated results.
          await new Promise((r) => setTimeout(r, 25));
        }
      }

      const command = new StartStreamTranscriptionCommand({
        LanguageCode: process.env.TRANSCRIPTION_LANGUAGE || 'en-US',
        MediaSampleRateHertz: 16000,
        MediaEncoding: 'pcm',
        AudioStream: audioStream(),
        EnablePartialResultsStabilization: true,
        PartialResultsStability: 'high',
        ShowSpeakerLabel: true,
      });

      console.log(`🎯 Starting stream transcription...`);
      const response = await this.transcribeStreamingClient.send(command);

      const transcriptSegments = [];
      let fullTranscript = '';
      for await (const event of response.TranscriptResultStream) {
        if (!event.TranscriptEvent) continue;
        const results = event.TranscriptEvent.Transcript.Results || [];
        for (const result of results) {
          if (result.IsPartial) continue; // Final results only.
          for (const alt of (result.Alternatives || [])) {
            const transcript = alt.Transcript;
            if (!transcript || !transcript.trim()) continue;
            const items = alt.Items || [];
            const segStart = items.length > 0 ? parseFloat(items[0].StartTime || 0) : 0;
            const segEnd = items.length > 0
              ? parseFloat(items[items.length - 1].EndTime || (segStart + 1))
              : (segStart + 1);
            const segment = {
              start: segStart + startTimeOffset,
              end: segEnd + startTimeOffset,
              text: transcript.trim(),
              speaker: 'Unknown',
            };
            transcriptSegments.push(segment);
            fullTranscript += transcript + ' ';
            console.log(`📝 Stream segment: "${transcript}" (${segment.start}s - ${segment.end}s)`);
          }
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`✅ AWS Stream Transcription completed in ${totalTime}ms`);

      return {
        text: fullTranscript.trim(),
        segments: transcriptSegments,
        provider: 'aws_transcribe_stream',
        streamingMode: true,
      };
    } catch (error) {
      console.error('❌ AWS Stream Transcription error:', error?.message || error);
      const shouldFallback =
        error.name === 'UnknownOperationException' ||
        error.name === 'BadRequestException' ||
        (error.message && (
          error.message.includes('streaming') ||
          error.message.includes('numberOfChannels') ||
          error.message.includes('validation error')
        )) ||
        error.code === 'ERR_STREAM_PREMATURE_CLOSE';
      if (shouldFallback) {
        console.log('🔄 Falling back to AWS Transcribe batch due to streaming error');
        return await this.transcribeWithAWS(audioPath, startTimeOffset);
      }
      throw error;
    }
  }

  async transcribeWithAWSMedicalStream(audioPath, startTimeOffset = 0) {
    try {
      console.log(`🚀 Starting AWS Medical Stream Transcription for: ${audioPath}`);
      const startTime = Date.now();
      
      // Convert to PCM format for streaming (16kHz, 16-bit, mono)
      console.log(`🔄 Converting audio to PCM format for streaming...`);
      const pcmBuffer = await this.convertToPCMForStreaming(audioPath);
      console.log(`✅ Audio converted to PCM: ${pcmBuffer.length} bytes`);
      
      // Create audio stream generator
      async function* audioStream() {
        const CHUNK_SIZE = 1024 * 4; // 4KB chunks for better streaming performance
        for (let i = 0; i < pcmBuffer.length; i += CHUNK_SIZE) {
          const chunk = pcmBuffer.slice(i, i + CHUNK_SIZE);
          yield { AudioEvent: { AudioChunk: chunk } };
          // Small delay to simulate real-time streaming rate
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      }
      
      // Start streaming transcription
      const command = new StartMedicalStreamTranscriptionCommand({
        LanguageCode: 'en-US',
        MediaSampleRateHertz: 16000,
        MediaEncoding: 'pcm',
        Specialty: this.medicalSpecialty,
        Type: 'CONVERSATION',
        AudioStream: audioStream(),
        EnableChannelIdentification: false,
        ShowSpeakerLabel: true,
      });
      
      console.log(`🎯 Starting medical stream transcription...`);
      const response = await this.transcribeStreamingClient.send(command);
      
      // Process streaming response
      const transcriptSegments = [];
      let fullTranscript = '';
      
      for await (const event of response.TranscriptResultStream) {
        if (event.TranscriptEvent) {
          const results = event.TranscriptEvent.Transcript.Results;
          
          for (const result of results) {
            if (result.IsPartial === false) { // Only process final results
              for (const alternative of result.Alternatives) {
                const transcript = alternative.Transcript;
                
                if (transcript && transcript.trim().length > 0) {
                  // Extract timing information
                  const items = alternative.Items || [];
                  const segmentStartTime = items.length > 0 ? parseFloat(items[0].StartTime || 0) : 0;
                  const segmentEndTime = items.length > 0 ? parseFloat(items[items.length - 1].EndTime || segmentStartTime + 1) : segmentStartTime + 1;
                  
                  // Create segment
                  const segment = {
                    start: segmentStartTime + startTimeOffset,
                    end: segmentEndTime + startTimeOffset,
                    text: transcript.trim(),
                    speaker: 'Unknown' // Medical streaming provides speaker info differently
                  };
                  
                  transcriptSegments.push(segment);
                  fullTranscript += transcript + ' ';
                  
                  console.log(`📝 Stream segment: "${transcript}" (${segment.start}s - ${segment.end}s)`);
                }
              }
            }
          }
        }
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ AWS Medical Stream Transcription completed in ${totalTime}ms`);
      
      return {
        text: fullTranscript.trim(),
        segments: transcriptSegments,
        provider: 'aws_transcribe_medical_stream',
        streamingMode: true
      };
      
    } catch (error) {
      console.error('❌ AWS Medical Stream Transcription error:', error);
      
      // Fallback to batch processing for various error conditions
      const shouldFallback = 
        error.name === 'UnknownOperationException' ||
        error.name === 'BadRequestException' ||
        error.message.includes('streaming') ||
        error.message.includes('numberOfChannels') ||
        error.message.includes('validation error') ||
        error.code === 'ERR_STREAM_PREMATURE_CLOSE';
      
      if (shouldFallback) {
        console.log('🔄 Falling back to batch processing due to streaming error');
        console.log(`💡 Error was: ${error.message}`);
        return await this.transcribeWithAWSMedical(audioPath, startTimeOffset);
      }
      
      throw error;
    }
  }

  // Helper method to convert audio specifically for streaming
  async convertToPCMForStreaming(filePath) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      // Enhanced FFmpeg path selection for streaming (same logic as convertToPCM)
      let ffmpegPath;
      let pathType = 'unknown';
      
      if (this.preferredFfmpegPath) {
        ffmpegPath = this.preferredFfmpegPath.path;
        pathType = this.preferredFfmpegPath.type;
        console.log(`🎵 Using preferred FFmpeg path for streaming (${pathType}): ${ffmpegPath}`);
      } else {
        // Use system FFmpeg (resolved via PATH).
        ffmpegPath = 'ffmpeg';
        pathType = 'system';
        console.log('🎵 Using system FFmpeg for streaming');
      }
      
      const executeFFmpegCommand = (path, type, isRetry = false) => {
        const retryText = isRetry ? ' (retry)' : '';
        console.log(`🎵 Starting FFmpeg PCM conversion${retryText} for streaming with ${type}: ${path}`);
        
        const command = ffmpeg(filePath)
          .setFfmpegPath(path)
          .format('s16le')  // 16-bit PCM
          .audioFrequency(16000)  // 16kHz sample rate
          .audioChannels(1)  // Mono audio
          .on('start', cmdLine => console.log(`🎵 FFmpeg PCM conversion started${retryText}:`, cmdLine))
          .on('error', error => {
            console.error(`❌ FFmpeg PCM conversion error${retryText} with ${type}:`, error);
            
            // Only attempt fallback if this wasn't already a retry
            if (!isRetry && type !== 'system' && type !== 'system-docker') {
              console.log('🔄 Retrying PCM conversion with system ffmpeg...');
              executeFFmpegCommand('ffmpeg', 'system-fallback', true);
              return;
            }
            
            reject(new Error(`FFmpeg PCM conversion failed with ${type}${retryText}: ${error.message}`));
          });

        const stream = command.pipe();
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`✅ Audio converted to PCM for streaming${retryText} with ${type} (${buffer.length} bytes)`);
          resolve(buffer);
        });
        stream.on('error', error => {
          console.error(`❌ PCM stream error${retryText} with ${type}:`, error);
          
          // Only attempt fallback if this wasn't already a retry
          if (!isRetry && type !== 'system' && type !== 'system-docker') {
            console.log('🔄 Retrying PCM conversion with system ffmpeg due to stream error...');
            chunks.length = 0; // Clear chunks for retry
            executeFFmpegCommand('ffmpeg', 'system-fallback', true);
          } else {
            reject(error);
          }
        });
      };
      
      // Start the conversion process
      executeFFmpegCommand(ffmpegPath, pathType);
    });
  }

  async waitForMedicalTranscriptionCompletion(jobName, maxWaitTime = 300000) { // 5 minutes max
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const getJobCommand = new GetMedicalTranscriptionJobCommand({
          MedicalTranscriptionJobName: jobName,
        });
        
        const response = await this.transcribeClient.send(getJobCommand);
        const status = response.MedicalTranscriptionJob.TranscriptionJobStatus;
        
        console.log(`📊 Medical transcription job status: ${status}`);
        
        if (status === 'COMPLETED') {
          // Download the transcription result from S3
          const resultUri = response.MedicalTranscriptionJob.Transcript.TranscriptFileUri;
          console.log(`📥 Downloading medical transcription result from: ${resultUri}`);
          
          try {
            // First try using axios (for presigned URLs)
            const axios = require('axios');
            const resultResponse = await axios.get(resultUri);
            return resultResponse.data;
          } catch (axiosError) {
            console.log(`⚠️ Axios failed (${axiosError.response?.status}), trying S3 client...`);
            
            // Fallback: Use S3 client with known bucket and extracted object key
            try {
              const url = new URL(resultUri);
              console.log(`🔍 Full result URL: ${resultUri}`);
              console.log(`🔍 URL protocol: ${url.protocol}`);
              console.log(`🔍 URL hostname: ${url.hostname}`);
              console.log(`🔍 URL pathname: ${url.pathname}`);
              console.log(`🔍 URL search: ${url.search}`);
              
              // Extract object key from URL path
              let objectKey = url.pathname.substring(1); // Remove leading '/'
              
              // Handle case where the URL might have bucket name in the path
              // For URLs like: https://s3.region.amazonaws.com/bucket-name/path/to/file
              if (url.hostname.startsWith('s3.') && objectKey.startsWith(this.s3Bucket + '/')) {
                objectKey = objectKey.substring(this.s3Bucket.length + 1);
                console.log(`🔧 Removed bucket name from object key`);
              }
              
              // Use the bucket we know we configured (from env variable)
              const bucketName = this.s3Bucket;
              
              console.log(`📥 Using configured S3 bucket: ${bucketName}`);
              console.log(`📥 Final object key: ${objectKey}`);
              
              // Validate object key
              if (!objectKey || objectKey.trim() === '') {
                throw new Error(`Invalid object key: '${objectKey}' from URL: ${resultUri}`);
              }
              
              // First, let's check if the object exists by listing objects in the bucket
              console.log(`🔍 Checking if object exists in bucket...`);
              try {
                const listCommand = new ListObjectsV2Command({
                  Bucket: bucketName,
                  Prefix: objectKey.trim().split('/')[0], // Get the first part of the path
                  MaxKeys: 10
                });
                const listResult = await this.s3Client.send(listCommand);
                console.log(`📋 Objects in bucket with prefix '${objectKey.trim().split('/')[0]}':`, 
                  listResult.Contents?.map(obj => obj.Key) || ['No objects found']);
              } catch (listError) {
                console.log(`⚠️ Could not list objects: ${listError.message}`);
              }
              
              const getObjectCommand = new GetObjectCommand({
                Bucket: bucketName,
                Key: objectKey.trim(),
              });
              
              const s3Response = await this.s3Client.send(getObjectCommand);
              const streamToString = (stream) => 
                new Promise((resolve, reject) => {
                  const chunks = [];
                  stream.on('data', (chunk) => chunks.push(chunk));
                  stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
                  stream.on('error', reject);
                });
              
              const bodyContents = await streamToString(s3Response.Body);
              return JSON.parse(bodyContents);
              
            } catch (s3Error) {
              console.error('❌ S3 client also failed:', s3Error);
              throw new Error(`Failed to download transcription result: ${axiosError.response?.status} ${axiosError.message}, S3 fallback: ${s3Error.message}`);
            }
          }
          
        } else if (status === 'FAILED') {
          const failureReason = response.MedicalTranscriptionJob.FailureReason;
          throw new Error(`Medical transcription job failed: ${failureReason}`);
        }
        
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (error) {
        console.error('❌ Error checking medical transcription status:', error);
        throw error;
      }
    }
    
    // Log timeout with more details
    const elapsedTime = (Date.now() - startTime) / 1000;
    console.error(`❌ Medical transcription job '${jobName}' timed out after ${elapsedTime}s (max: ${maxWaitTime / 1000}s)`);
    console.error(`💡 Consider increasing TRANSCRIPTION_TIMEOUT or checking AWS service status`);
    throw new Error(`Medical transcription job timed out after ${maxWaitTime / 1000} seconds (job: ${jobName})`);
  }

  async waitForHealthScribeCompletion(jobName, maxWaitTime = 600000) { // 10 minutes max for medical transcription
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds - HealthScribe typically takes longer
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const getJobCommand = new GetMedicalScribeJobCommand({
          MedicalScribeJobName: jobName,
        });
        
        const response = await this.transcribeClient.send(getJobCommand);
        const status = response.MedicalScribeJob.MedicalScribeJobStatus;
        
        console.log(`📊 HealthScribe job status: ${status}`);
        
        if (status === 'COMPLETED') {
          // Download both transcript and clinical document
          const transcriptUri = response.MedicalScribeJob.MedicalScribeOutput.TranscriptFileUri;
          const clinicalDocumentUri = response.MedicalScribeJob.MedicalScribeOutput.ClinicalDocumentUri;
          
          console.log(`📥 Downloading HealthScribe results from: ${transcriptUri} and ${clinicalDocumentUri}`);
          
          // Fetch both results
          const axios = require('axios');
          const [transcriptResponse, clinicalResponse] = await Promise.all([
            axios.get(transcriptUri),
            axios.get(clinicalDocumentUri)
          ]);
          
          return {
            transcript: transcriptResponse.data,
            clinicalDocument: clinicalResponse.data,
            jobName: jobName
          };
          
        } else if (status === 'FAILED') {
          const failureReason = response.MedicalScribeJob.FailureReason;
          throw new Error(`HealthScribe job failed: ${failureReason}`);
        }
        
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (error) {
        console.error('❌ Error checking HealthScribe status:', error);
        throw error;
      }
    }
    
    throw new Error(`HealthScribe job timed out after ${maxWaitTime / 1000} seconds`);
  }

  async cleanupS3File(s3Key) {
    try {
      const deleteParams = {
        Bucket: this.s3Bucket,
        Key: s3Key,
      };
      
      const deleteCommand = new DeleteObjectCommand(deleteParams);
      await this.s3Client.send(deleteCommand);
      console.log(`🧹 Cleaned up S3 file: ${s3Key}`);
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup S3 file ${s3Key}:`, error.message);
    }
  }

  formatAWSTranscribeResult(awsResult, startTimeOffset = 0) {
    try {
      // AWS Transcribe returns results in a different format than OpenAI Whisper
      // We need to convert it to match the expected format
      
      const results = awsResult.results;
      if (!results || !results.transcripts || results.transcripts.length === 0) {
        return { text: '', segments: [] };
      }
      
      const fullText = results.transcripts[0].transcript;
      const segments = [];
      
      // If speaker labels are available, create segments with speaker information
      if (results.speaker_labels && results.speaker_labels.segments) {
        for (const speakerSegment of results.speaker_labels.segments) {
          const segment = {
            start: parseFloat(speakerSegment.start_time) + startTimeOffset,
            end: parseFloat(speakerSegment.end_time) + startTimeOffset,
            text: this.extractTextForTimeRange(
              results.items,
              speakerSegment.start_time,
              speakerSegment.end_time
            ),
            speaker: speakerSegment.speaker_label,
          };
          
          if (segment.text.trim().length > 0) {
            segments.push(segment);
          }
        }
      } else {
        // If no speaker labels, create one segment for the entire transcript
        const items = results.items || [];
        if (items.length > 0) {
          const startTime = parseFloat(items[0].start_time || 0) + startTimeOffset;
          const endTime = parseFloat(items[items.length - 1].end_time || 0) + startTimeOffset;
          
          segments.push({
            start: startTime,
            end: endTime,
            text: fullText,
            speaker: 'Unknown',
          });
        }
      }
      
      return {
        text: fullText,
        segments: segments,
      };
      
    } catch (error) {
      console.error('❌ Error formatting AWS Transcribe result:', error);
      return { text: '', segments: [] };
    }
  }

  formatHealthScribeResult(healthScribeResult, startTimeOffset = 0) {
    try {
      // Use HealthScribe like regular transcription - focus on transcript, ignore clinical document
      const transcript = healthScribeResult.transcript;
      
      if (!transcript || !transcript.Results) {
        return { text: '', segments: [] };
      }
      
      const results = transcript.Results;
      const fullText = results.Transcripts?.[0]?.Content || '';
      const segments = [];
      
      // Process conversation segments like regular AWS Transcribe
      if (results.Items) {
        let currentSegment = { text: '', startTime: 0, endTime: 0, speaker: 'Unknown' };
        
        results.Items.forEach(item => {
          if (item.Type === 'pronunciation' && item.Alternatives && item.Alternatives[0]) {
            const content = item.Alternatives[0].Content;
            const startTime = (parseFloat(item.StartTime) || 0) + startTimeOffset;
            const endTime = (parseFloat(item.EndTime) || 0) + startTimeOffset;
            
            // Simple speaker identification (Speaker_0, Speaker_1, etc.)
            const speaker = item.Speaker ? `Speaker_${item.Speaker}` : 'Unknown';
            
            // Check if this continues the current segment
            if (currentSegment.speaker === speaker && endTime - currentSegment.endTime < 2) {
              currentSegment.text += ' ' + content;
              currentSegment.endTime = endTime;
            } else {
              // Save current segment if it has content
              if (currentSegment.text.trim()) {
                segments.push({
                  start: currentSegment.startTime,
                  end: currentSegment.endTime,
                  text: currentSegment.text.trim(),
                  speaker: currentSegment.speaker
                });
              }
              
              // Start new segment
              currentSegment = {
                text: content,
                startTime: startTime,
                endTime: endTime,
                speaker: speaker
              };
            }
          }
        });
        
        // Add final segment
        if (currentSegment.text.trim()) {
          segments.push({
            start: currentSegment.startTime,
            end: currentSegment.endTime,
            text: currentSegment.text.trim(),
            speaker: currentSegment.speaker
          });
        }
      }
      
      // Return simple transcription result like AWS Transcribe
      return {
        text: fullText,
        segments: segments,
        provider: 'healthscribe',
        jobName: healthScribeResult.jobName
      };
      
    } catch (error) {
      console.error('❌ Error formatting HealthScribe result:', error);
      return { text: '', segments: [] };
    }
  }

  extractTextForTimeRange(items, startTime, endTime) {
    const start = parseFloat(startTime);
    const end = parseFloat(endTime);
    
    return items
      .filter(item => {
        if (item.type !== 'pronunciation') return false;
        const itemStart = parseFloat(item.start_time);
        const itemEnd = parseFloat(item.end_time);
        return itemStart >= start && itemEnd <= end;
      })
      .map(item => item.alternatives[0].content)
      .join(' ');
  }



  async getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration);
      });
    });
  }

  async extractAudioChunk(inputPath, outputPath, startTime, duration) {
    return new Promise((resolve, reject) => {
      // Use the same FFmpeg path detection as other methods
      let ffmpegPath;
      if (this.preferredFfmpegPath) {
        ffmpegPath = this.preferredFfmpegPath.path;
      } else {
        // Use system FFmpeg (resolved via PATH).
        ffmpegPath = 'ffmpeg';
      }

      const executeExtraction = (path, isRetry = false) => {
        const retryText = isRetry ? ' (retry)' : '';
        console.log(`🎬 Extracting audio chunk${retryText} with FFmpeg: ${path}`);
        
        ffmpeg(inputPath)
          .setFfmpegPath(path)
          .seekInput(startTime)
          .duration(duration)
          .audioCodec('pcm_s16le')
          .audioChannels(1)
          .audioFrequency(16000)
          .format('wav')
          .output(outputPath)
          .on('start', cmdLine => console.log(`🎬 Audio chunk extraction started${retryText}:`, cmdLine))
          .on('end', () => {
            console.log(`✅ Audio chunk extracted${retryText}: ${outputPath}`);
            resolve();
          })
          .on('error', error => {
            console.error(`❌ Audio chunk extraction error${retryText}:`, error);
            
            // Only attempt fallback if this wasn't already a retry and we're not using system FFmpeg
            if (!isRetry && path !== 'ffmpeg') {
              console.log('🔄 Retrying audio extraction with system ffmpeg...');
              executeExtraction('ffmpeg', true);
            } else {
              reject(error);
            }
          })
          .run();
      };
      
      executeExtraction(ffmpegPath);
    });
  }

  cleanupChunks(tempDir) {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`🧹 Cleaned up chunk directory: ${tempDir}`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup chunks: ${error.message}`);
    }
  }

  convertToText(jsonPath) {
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`File not found: ${jsonPath}`);
    }

    const transcriptData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const textOutputPath = jsonPath.replace('.json', '.txt');
    fs.writeFileSync(textOutputPath, transcriptData.text, 'utf-8');
    return textOutputPath;
  }
}

// NEW: Real-time streaming transcriber that processes audio during recording
class RealTimeStreamingTranscriber extends MultiProviderTranscriber {
  constructor() {
    super();
    this.isRecording = false;
    this.currentChunkNumber = 0;
    this.tempDir = null;
    this.callbacks = [];
    this.processedChunks = new Set(); // Track which chunks we've processed
    this.processingLock = false; // Simple lock to prevent concurrent processing
  }

  // Process a video chunk (called from bot script)
  async processVideoChunk(chunkData) {
    if (!this.isRecording) return;

    const chunkNumber = this.currentChunkNumber++;
    const chunkKey = `${chunkData.audioPath}_${chunkNumber}`;

    // Check if we've already processed this chunk
    if (this.processedChunks.has(chunkKey)) {
      console.log(`⏭️ Skipping already processed chunk ${chunkNumber}: ${chunkData.audioPath}`);
      return;
    }

    // Check if we're currently processing another chunk
    if (this.processingLock) {
      console.log(`⏳ Another chunk is being processed, waiting...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }

    this.processingLock = true;

    try {
      console.log(`🔄 Processing real-time chunk ${chunkNumber}: ${chunkData.startTime}s - ${chunkData.endTime}s`);

      // Mark this chunk as processed before we start
      this.processedChunks.add(chunkKey);

      // Call all callbacks with the result
      const processedChunkData = {
        ...chunkData,
        chunk: chunkNumber,
        isRealTime: true,
        timestamp: new Date().toISOString()
      };

      for (const callback of this.callbacks) {
        if (callback) {
          await callback(processedChunkData);
        }
      }
      
      console.log(`✅ Real-time chunk ${chunkNumber} processed and sent to callbacks`);
      
    } catch (error) {
      console.error(`❌ Error processing real-time chunk ${chunkNumber}:`, error);
      // Remove from processed set if it failed
      this.processedChunks.delete(chunkKey);
    } finally {
      this.processingLock = false;
    }
  }

  // Start real-time transcription streaming
  async startStreaming(outputDir, realtimeCallback) {
    this.isRecording = true;
    this.tempDir = path.join(outputDir, 'realtime_chunks');
    this.callbacks = Array.isArray(realtimeCallback) ? realtimeCallback : [realtimeCallback];
    this.processedChunks = new Set(); // Reset processed chunks
    this.processingLock = false;
    
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    console.log(`🎤 Starting real-time streaming transcription`);
    console.log(`📁 Chunk directory: ${this.tempDir}`);
  }

  // Stop streaming and cleanup
  async stopStreaming() {
    this.isRecording = false;
    console.log(`🛑 Stopping real-time transcription after ${this.currentChunkNumber} chunks`);
    
    // Cleanup
    this.cleanupChunks(this.tempDir);
    this.processedChunks.clear();
    this.processingLock = false;
  }
}

// Enhanced meeting processor that integrates real-time transcription
class RealTimeMeetingProcessor {
  constructor(meetingId = null) {
    this.streamingTranscriber = new RealTimeStreamingTranscriber();
    this.isProcessing = false;
    this.realtimeTranscripts = [];
    this.meetingId = meetingId;
    this.segmentCount = 0;
    this.csvRecords = []; // Initialize CSV records
    this.meetingStartTime = null; // Initialize meeting start time
    this.processedTimeRanges = new Map(); // Track processed time ranges to prevent overlap
    this.speakerDetector = null; // NEW: DOM-based speaker detection
    this.recordingStartTime = null; // NEW: Track recording start time
  }

  /**
   * Initialize speaker detection using new DOM-based approach
   * This replaces the old CSV-based speaker tracking
   * @param {Page} page - Puppeteer page object
   */
  initializeSpeakerDetection(page) {
    if (!page) {
      console.log('⚠️ No page provided, speaker detection disabled');
      return;
    }

    try {
      // Import the new speaker detection module
      const { SpeakerDetector } = require('../bot/bot_scripts/msteams/speaker_detection');

      this.speakerDetector = new SpeakerDetector(page);
      this.speakerDetector.startPolling();
      this.recordingStartTime = Date.now(); // Track when recording started

      console.log('✅ DOM-based speaker detection initialized and polling started');
    } catch (error) {
      console.error('❌ Failed to initialize speaker detection:', error.message);
      this.speakerDetector = null;
    }
  }

  /**
   * Get speaker at a specific time using the new speaker detector
   * @param {number} timestamp - Timestamp in seconds from recording start
   * @returns {string|null} - Speaker name or null
   */
  getSpeakerAtTime(timestamp) {
    if (this.speakerDetector && this.recordingStartTime) {
      // Convert relative timestamp to absolute time
      const absoluteTime = this.recordingStartTime + (timestamp * 1000);
      const speaker = this.speakerDetector.getSpeakerAtTime(absoluteTime, 5000);

      // Debug logging
      const historySize = this.speakerDetector.speakerHistory ? this.speakerDetector.speakerHistory.length : 0;
      console.log(`[getSpeakerAtTime] timestamp=${timestamp}s, absoluteTime=${absoluteTime}, historySize=${historySize}, speaker=${speaker || 'null'}`);

      return speaker;
    }

    console.log(`[getSpeakerAtTime] speakerDetector=${!!this.speakerDetector}, recordingStartTime=${this.recordingStartTime}`);
    return null;
  }

  // Start real-time processing during meeting
  async startRealTimeProcessing(meetingDir, csvRecords, meetingStartTime, externalCallbacks = [], meetingId = null) {
    this.isProcessing = true;
    this.realtimeTranscripts = [];
    this.meetingId = meetingId || this.meetingId;
    this.segmentCount = 0;
    this.csvRecords = csvRecords; // Store initial CSV records
    this.meetingStartTime = meetingStartTime; // Store meeting start time
    this.processedTimeRanges = new Map(); // Track processed time ranges to prevent overlap

    // Combine internal processing with external callbacks
    const allCallbacks = [
      // Internal callback for speaker mapping and database updates
      async (chunkData) => {
        // Enhanced logging for debugging
        console.log(`🔍 Processing chunk ${chunkData.chunk || 'unknown'} - segments: ${chunkData.segments ? chunkData.segments.length : 'null'}, text: "${(chunkData.text || '').substring(0, 50)}..."`);
        
        // Check if we have meaningful transcript data (segments OR text)
        const hasSegments = chunkData.segments && chunkData.segments.length > 0;
        const hasText = chunkData.text && chunkData.text.trim().length > 0;
        
        if (hasSegments || hasText) {
          // Get text from segments or use direct text
          const chunkText = hasSegments 
            ? chunkData.segments.map(s => s.text).join(' ').trim()
            : (chunkData.text || '').trim();
          
          console.log(`📝 Chunk ${chunkData.chunk} text: "${chunkText}" (${chunkText.length} chars)`);
          
          // Skip processing if chunk text is too short (less than 15 characters)
          if (chunkText.length < 15) {
            console.log(`⏭️ Skipping short chunk ${chunkData.chunk}: "${chunkText}" (${chunkText.length} chars)`);
            return;
          }
          
          // Create a unique identifier for this chunk using multiple factors
          const chunkId = `${chunkData.chunk || 'unknown'}_${chunkData.audioPath ? path.basename(chunkData.audioPath) : 'nopath'}_${chunkText.substring(0, 20).replace(/\s+/g, '_')}`;
          
          // Check if this specific chunk has already been processed
          if (this.processedTimeRanges.has(chunkId)) {
            console.log(`🔄 Skipping already processed chunk: ${chunkId}`);
            return;
          }
          
          // Skip processing if chunk only contains filler words or "you"
          const fillerPattern = /^(you|You.|You|you.|um|uh|ah|hmm|well|so|like|okay|alright|thanks|thank you|yeah|yes|no|Thank you.|Thank you|Thank you very much|Thank you very much.|Thank you for having me.|Thank you for having me)(\s+\w+)*$/i;
          if (fillerPattern.test(chunkText)) {
            console.log(`⏭️ Skipping filler chunk ${chunkData.chunk}: "${chunkText}"`);
            return;
          }
          
          // Mark this chunk as processed using the unique identifier
          this.processedTimeRanges.set(chunkId, true);
          
          // Import here to avoid circular dependency
          const { mapWordsToSpeakers } = require('./mapTranscriptstoSpeakers');
          const dbIntegration = require('../storage/dbIntegration');

          // NEW: Try speaker detection first, fallback to CSV
          let mappedChunkSegments = [];
          let speakerDetectionMethod = 'none';

          // PRIORITY 1: Use speaker from chunkData if provided by recording.js
          // Google Meet passes speaker info directly in chunkData.speaker
          if (chunkData.speaker && chunkData.speaker !== 'Unknown') {
            console.log(`🗣️ Using speaker from chunkData: ${chunkData.speaker}`);
            mappedChunkSegments = [{
              text: chunkText,
              startTime: chunkData.startTime,
              endTime: chunkData.endTime,
              speaker: chunkData.speaker,
              speakers: [chunkData.speaker],
              confidence: 0.9 // High confidence from DOM detection in recording.js
            }];
            speakerDetectionMethod = 'chunkData';
          }
          // PRIORITY 2: Try DOM-based speaker detection from RealTimeStreamingProcessor
          else if (this.speakerDetector && chunkData.startTime !== undefined) {
            const speaker = this.getSpeakerAtTime(chunkData.startTime);
            if (speaker) {
              console.log(`🗣️ Detected speaker via DOM detection: ${speaker}`);
              mappedChunkSegments = [{
                text: chunkText,
                startTime: chunkData.startTime,
                endTime: chunkData.endTime,
                speaker: speaker,
                speakers: [speaker],
                confidence: 0.9 // High confidence from DOM detection
              }];
              speakerDetectionMethod = 'dom';
            }
          }

          // Fallback to CSV-based speaker mapping if DOM detection didn't work
          if (mappedChunkSegments.length === 0 && this.csvRecords && this.csvRecords.length > 0) {
            console.log(`🎯 Fallback to CSV: Using ${this.csvRecords.length} CSV records for speaker mapping`);
            mappedChunkSegments = mapWordsToSpeakers(chunkText, this.csvRecords, this.meetingStartTime || meetingStartTime, chunkData.startTime);
            speakerDetectionMethod = 'csv';
          }

          // Last resort: create basic segments without speaker mapping
          if (mappedChunkSegments.length === 0) {
            console.log('⚠️ No speaker detection available - creating basic segments');
            mappedChunkSegments = [{
              text: chunkText,
              startTime: chunkData.startTime,
              endTime: chunkData.endTime,
              speaker: 'Unknown',
              speakers: ['Unknown'],
              confidence: 0.5
            }];
            speakerDetectionMethod = 'none';
          }

          console.log(`📊 Speaker detection method used: ${speakerDetectionMethod}`);
          
          const processedChunk = {
            ...chunkData,
            mappedSegments: mappedChunkSegments,
            text: chunkText,
            uniqueId: chunkId
          };
          
          this.realtimeTranscripts.push(processedChunk);
          console.log(`✨ Real-time chunk ${chunkData.chunk} processed with ${mappedChunkSegments.length} mapped segments - Total chunks stored: ${this.realtimeTranscripts.length}`);
          
          // Update database with new segments if meeting ID is available
          if (this.meetingId) {
            await this.updateDatabaseWithSegments(mappedChunkSegments, chunkData);
          }
          
          // Save intermediate results
          await this.saveIntermediateResults(meetingDir, processedChunk);
        } else {
          console.log(`⏭️ Skipping chunk ${chunkData.chunk} - no segments or text available`);
          console.log(`   Segments: ${chunkData.segments ? JSON.stringify(chunkData.segments) : 'null'}`);
          console.log(`   Text: "${chunkData.text || 'null'}"`);
        }
      },
      ...externalCallbacks
    ];

    await this.streamingTranscriber.startStreaming(meetingDir, allCallbacks);
  }

  // Update database with new transcript segments
  async updateDatabaseWithSegments(mappedSegments, chunkData) {
    try {
      // Import the JavaScript database integration
      const dbIntegration = require('../storage/dbIntegration');

      // Process each mapped segment and append to database
      for (const segment of mappedSegments) {
        // Skip segments with very short text. Threshold honors the same
        // MIN_SEGMENT_TEXT_LENGTH env override as appendTranscriptSegment.
        const segmentText = segment.text || '';
        const minLen = Number(process.env.MIN_SEGMENT_TEXT_LENGTH ?? 10);
        if (segmentText.trim().length < minLen) {
          console.log(`⏭️ Skipping short segment: "${segmentText}" (${segmentText.length} chars, min=${minLen})`);
          continue;
        }

        this.segmentCount++;
        
        const segmentData = {
          timestamp: new Date().toISOString(),
          speaker: segment.speaker || 'Unknown',
          text: segmentText,
          startTime: segment.startTime || chunkData.startTime,
          endTime: segment.endTime || chunkData.endTime,
          confidence: segment.confidence,
          chunk: chunkData.chunk,
          segmentNumber: this.segmentCount,
          isRealTime: true,

          originalChunkData: {
            audioPath: chunkData.audioPath,
            chunkDuration: chunkData.endTime - chunkData.startTime
          }
        };

        // Append this segment to the existing transcript in the database
        try {
          await dbIntegration.appendTranscriptSegment(this.meetingId, segmentData);
          console.log(`📝 Appended segment ${this.segmentCount} to database for meeting ${this.meetingId}`);
        } catch (dbError) {
          console.error(`💀 Database error for segment ${this.segmentCount}:`, dbError.message);
          // Continue processing other segments even if one fails
          continue;
        }
      }

    } catch (error) {
      console.error(`❌ Error updating database with segments:`, error);
      // Don't fail the transcription process if database update fails
    }
  }

  // Stop real-time processing
  async stopRealTimeProcessing() {
    this.isProcessing = false;
    await this.streamingTranscriber.stopStreaming();

    // NEW: Stop speaker detection
    if (this.speakerDetector) {
      console.log('🛑 Stopping speaker detection...');
      this.speakerDetector.stopPolling();

      // Get speaker summary before cleanup
      const speakingSummary = this.speakerDetector.getSpeakingSummary();
      if (Object.keys(speakingSummary).length > 0) {
        console.log('\n🎤 Speaker Time Summary:');
        Object.entries(speakingSummary)
          .sort((a, b) => b[1] - a[1])
          .forEach(([speaker, seconds]) => {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            console.log(`  ${speaker}: ${minutes}m ${secs}s`);
          });
      }

      this.speakerDetector = null;
    }
  }

  // **NEW: Update speaker mapping data during meeting**
  updateSpeakerMappingData(csvRecords, meetingStartTime) {
    this.csvRecords = csvRecords;
    this.meetingStartTime = meetingStartTime;
    console.log(`🎯 Updated speaker mapping data: ${csvRecords.length} records`);
  }

  // **MODIFIED: Only refine if segments weren't already processed well**
  async refineWithCompleteParticipantData(csvRecords, meetingStartTime) {
    try {
      console.log('🔄 Checking if transcript refinement is needed...');
      
      // Check if we already have good speaker mapping
      const hasGoodSpeakerMapping = this.realtimeTranscripts.some(chunk => 
        chunk.mappedSegments && chunk.mappedSegments.some(seg => 
          seg.speaker && seg.speaker !== 'Unknown'
        )
      );
      
      if (hasGoodSpeakerMapping) {
        console.log('✅ Transcript already has good speaker mapping, skipping refinement');
        return;
      }
      
      console.log('🔄 Refining transcript segments with complete participant data...');
      
      // Update our internal speaker mapping data
      this.csvRecords = csvRecords;
      this.meetingStartTime = meetingStartTime;
      
      // Only reprocess chunks that need better speaker mapping
      for (let i = 0; i < this.realtimeTranscripts.length; i++) {
        const chunk = this.realtimeTranscripts[i];
        
        if (chunk.text && chunk.text.trim() !== '' && !chunk.refined) {
          // Re-map speakers using complete CSV data
          const { mapWordsToSpeakers } = require('./mapTranscriptstoSpeakers');
          const refinedSegments = mapWordsToSpeakers(
            chunk.text, 
            csvRecords, 
            meetingStartTime, 
            chunk.startTime
          );
          
          // Update the chunk with refined speaker mapping
          this.realtimeTranscripts[i].mappedSegments = refinedSegments;
          this.realtimeTranscripts[i].refined = true;
          
          console.log(`✨ Refined chunk ${chunk.chunk}: ${refinedSegments.length} speaker segments`);
        }
      }
      
      console.log('✅ Transcript refinement completed');
      
    } catch (error) {
      console.error('❌ Error refining transcript with participant data:', error);
    }
  }

  // Method to be called from the audio recording pipeline
  processAudioData(audioData) {
    // This method is no longer used - we now process video chunks directly
    console.warn('⚠️ processAudioData is deprecated - use processVideoChunk instead');
  }

  // NEW: Method to handle video chunks from the bot script
  async handleVideoChunk(chunkData) {
    if (this.isProcessing) {
      await this.streamingTranscriber.processVideoChunk(chunkData);
    }
  }

  // Save intermediate results for each chunk
  async saveIntermediateResults(meetingDir, chunkData) {
    const intermediateFile = path.join(meetingDir, `realtime_chunk_${chunkData.chunk}.json`);
    fs.writeFileSync(intermediateFile, JSON.stringify(chunkData, null, 2));
  }

  // Get final combined results
  getFinalResults(meetingId) {
    console.log(`📊 Compiling final results for meeting ${meetingId}`);
    console.log(`📊 Total chunks in realtimeTranscripts: ${this.realtimeTranscripts.length}`);
    
    const finalMappedSegments = [];
    let totalTextLength = 0;
    
    this.realtimeTranscripts.forEach((chunk, index) => {
      console.log(`📊 Processing chunk ${index}: ${chunk.mappedSegments ? chunk.mappedSegments.length : 0} segments, text: "${(chunk.text || '').substring(0, 10)}..."`);
      
      if (chunk.mappedSegments && chunk.mappedSegments.length > 0) {
        finalMappedSegments.push(...chunk.mappedSegments);
        totalTextLength += chunk.text ? chunk.text.length : 0;
      } else if (chunk.text && chunk.text.trim().length > 0) {
        // Handle chunks that have text but no mapped segments
        console.log(`⚠️ Chunk ${index} has text but no mapped segments - creating basic segment`);
        const basicSegment = {
          text: chunk.text.trim(),
          startTime: chunk.startTime || 0,
          endTime: chunk.endTime || 0,
          speaker: 'Unknown',
          speakers: ['Unknown'],
          confidence: 0.5,
          isBasicSegment: true
        };
        finalMappedSegments.push(basicSegment);
        totalTextLength += chunk.text.length;
      }
    });

    console.log(`📊 Final compilation: ${finalMappedSegments.length} segments, ${totalTextLength} total characters`);

    const finalResults = {
      meetingId,
      provider: this.streamingTranscriber.provider,
      model: this.streamingTranscriber.model,
      totalChunks: this.realtimeTranscripts.length,
      segments: finalMappedSegments,
      realtimeChunks: this.realtimeTranscripts,
      processedInRealTime: true,
      totalCharacters: totalTextLength,
      compiledAt: new Date().toISOString()
    };

    console.log(`✅ Final results compiled: ${finalResults.segments.length} segments from ${finalResults.totalChunks} chunks`);
    return finalResults;
  }
}

// Legacy compatibility
class AudioTranscriber extends MultiProviderTranscriber {
  constructor(apiKey, model) {
    super();
    if (apiKey) {
      console.warn('⚠️ Passing apiKey directly is deprecated. Use environment variables instead.');
    }
  }
}

module.exports = { 
  AudioTranscriber, 
  MultiProviderTranscriber,
  RealTimeStreamingTranscriber,
  RealTimeMeetingProcessor
};
