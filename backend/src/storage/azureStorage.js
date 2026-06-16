const { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');
const { createAzureBlobServiceClient } = require('./azureBlobClient');
const { awsClientConfigFromEnv } = require('../utils/awsCredentials');
const fs = require('fs');
const path = require('path');

class uploadToAzure {
  constructor(connectionString = null) {
    this.provider = process.env.LLM_PROVIDER || 'openai';
    console.log(`📦 Storage provider determined by LLM_PROVIDER: ${this.provider}`);

    // RCA #6: respect RECORDING_UPLOAD_DISABLED at constructor time so the
    // module loads cleanly when uploads aren't needed (local dev,
    // customers who don't archive video). Otherwise the SDK constructor
    // demands a connection string at module-import time even though the
    // rest of the upload path is already short-circuited downstream.
    const uploadDisabled =
      (process.env.RECORDING_UPLOAD_DISABLED || 'false').toLowerCase() === 'true';
    if (uploadDisabled) {
      console.log('☁️ Recording upload disabled — Azure/AWS SDK init skipped');
      this.disabled = true;
      return;
    }

    if (this.provider === 'aws_transcribe' || this.provider === 'bedrock') {
      // Use AWS S3 for Bedrock/AWS Transcribe
      this.initializeAWS();
    } else {
      // Use Azure for OpenAI and other providers
      this.initializeAzure(connectionString);
    }
  }

  initializeAzure(connectionString) {
    const { client, authMode, endpoint } = createAzureBlobServiceClient({ connectionString });
    this.blobServiceClient = client;
    console.log(`📦 Azure Blob Storage uploader initialized with ${authMode}${endpoint ? ` (${endpoint})` : ''}`);
  }

  initializeAWS() {
    if (!process.env.S3_BUCKET_NAME) {
      throw new Error('S3_BUCKET_NAME environment variable is required for AWS providers');
    }
    
    this.s3Client = new S3Client(awsClientConfigFromEnv());
    
    this.bucketName = process.env.S3_BUCKET_NAME;
    console.log(`📦 AWS S3 uploader initialized for bucket: ${this.bucketName}`);
  }

  async uploadFile(localFilePath, containerName, remoteFilePath) {
    if (this.provider === 'aws_transcribe' || this.provider === 'bedrock') {
      return await this.uploadToAWS(localFilePath, containerName, remoteFilePath);
    } else {
      return await this.uploadToAzure(localFilePath, containerName, remoteFilePath);
    }
  }

  async uploadToAzure(localFilePath, containerName, remoteFilePath) {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();

      const blockBlobClient = containerClient.getBlockBlobClient(remoteFilePath);
      await blockBlobClient.uploadFile(localFilePath);

      console.log(`✅ File uploaded to Azure: ${blockBlobClient.url}`);
      return blockBlobClient.url;
    } catch (error) {
      console.error('❌ Error uploading file to Azure:', error);
      throw error;
    }
  }

  async uploadToAWS(localFilePath, containerName, remoteFilePath) {
    try {
      // Ensure bucket exists (create if it doesn't)
      await this.ensureBucketExists();
      
      // Read the file content
      const fileContent = fs.readFileSync(localFilePath);
      
      // Construct S3 key (path) - combine containerName and remoteFilePath
      const s3Key = `${containerName}/${remoteFilePath}`;
      
      // Determine content type based on file extension
      const contentType = this.getContentType(localFilePath);
      
      // Upload to S3
      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType,
      };
      
      const uploadCommand = new PutObjectCommand(uploadParams);
      await this.s3Client.send(uploadCommand);
      
      // Return the S3 URL
      const s3Url = `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;
      console.log(`✅ File uploaded to S3: ${s3Url}`);
      
      return s3Url;
      
    } catch (error) {
      console.error('❌ Error uploading file to S3:', error);
      throw error;
    }
  }
  
  async ensureBucketExists() {
    try {
      // Try to check if bucket exists
      const headCommand = new HeadBucketCommand({ Bucket: this.bucketName });
      await this.s3Client.send(headCommand);
      console.log(`✅ S3 bucket ${this.bucketName} exists`);
    } catch (error) {
      if (error.name === 'NotFound') {
        // Bucket doesn't exist, create it
        console.log(`📦 Creating S3 bucket: ${this.bucketName}`);
        const createCommand = new CreateBucketCommand({ 
          Bucket: this.bucketName,
          CreateBucketConfiguration: {
            LocationConstraint: process.env.AWS_REGION || 'us-east-1'
          }
        });
        await this.s3Client.send(createCommand);
        console.log(`✅ S3 bucket ${this.bucketName} created`);
      } else {
        console.error('❌ Error checking/creating S3 bucket:', error);
        throw error;
      }
    }
  }
  
  getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
}

module.exports = { uploadToAzure };
