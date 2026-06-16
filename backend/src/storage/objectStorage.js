'use strict';

// Tiny object-storage adapter for the AudioArchiver. Exposes a single
// `uploadObject({ key, body, contentType })` async method backed by either
// Azure Blob Storage or S3 depending on what env vars are present.
//
// Why not use the existing storage/azureStorage.js: that module is a class
// designed for the legacy WAV-chunk → STT pipeline (it both uploads AND
// downloads back into the transcriber). The archiver's needs are simpler
// — append-only writes by key — so a small interface shim here keeps
// AudioArchiver decoupled from the legacy class lifecycle.

class ObjectStorage {
  constructor({ logger = console } = {}) {
    this.logger = logger;
    this.backend = null;
    this._init();
  }

  _init() {
    // Prefer Azure when either the legacy connection string or managed
    // identity endpoint/account env is present. Fall back to S3 if configured.
    const containerName = process.env.AZURE_AUDIO_CONTAINER_NAME
      || process.env.AZURE_STORAGE_CONTAINER_NAME
      || 'meeting-recordings';
    const storageAuth = String(process.env.AZURE_STORAGE_AUTH || '').trim().toLowerCase();
    const azureSelected = Boolean(
      process.env.AZURE_STORAGE_CONNECTION_STRING
      || process.env.AZURE_STORAGE_BLOB_ENDPOINT
      || process.env.AZURE_STORAGE_ACCOUNT_NAME
      || (storageAuth && storageAuth !== 'auto')
    );
    if (azureSelected) {
      const { createAzureBlobServiceClient } = require('./azureBlobClient');
      this._azure = {
        client: createAzureBlobServiceClient().client,
        containerName,
      };
      this.backend = 'azure';
      return;
    }

    const bucket = process.env.AUDIO_ARCHIVE_S3_BUCKET || process.env.S3_BUCKET_NAME;
    if (bucket) {
      try {
        const { awsClientConfigFromEnv } = require('../utils/awsCredentials');
        const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
        this._s3 = {
          client: new S3Client(awsClientConfigFromEnv()),
          bucket,
          PutObjectCommand,
        };
        this.backend = 's3';
        return;
      } catch (err) {
        this.logger.warn?.('[teams.objstorage] s3 init failed', err?.message);
      }
    }
  }

  async uploadObject({ key, body, contentType }) {
    if (!this.backend) throw new Error('ObjectStorage: no backend configured');
    if (this.backend === 'azure') {
      const containerClient = this._azure.client.getContainerClient(this._azure.containerName);
      await containerClient.createIfNotExists().catch(() => {});
      const blockBlob = containerClient.getBlockBlobClient(key);
      await blockBlob.uploadData(body, {
        blobHTTPHeaders: { blobContentType: contentType },
      });
      return;
    }
    if (this.backend === 's3') {
      await this._s3.client.send(new this._s3.PutObjectCommand({
        Bucket: this._s3.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }));
      return;
    }
    throw new Error(`ObjectStorage: unknown backend ${this.backend}`);
  }

  isReady() {
    return this.backend != null;
  }
}

module.exports = { ObjectStorage };
