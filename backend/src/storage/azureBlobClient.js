'use strict';

const { BlobServiceClient } = require('@azure/storage-blob');

let DefaultAzureCredential = null;
try {
  ({ DefaultAzureCredential } = require('@azure/identity'));
} catch (_) {
  DefaultAzureCredential = null;
}

const AUTH_AUTO = 'auto';
const AUTH_CONNECTION_STRING = 'connection_string';
const AUTH_MANAGED_IDENTITY = 'managed_identity';

function normalizeAzureStorageAuth(raw) {
  const value = String(raw || AUTH_AUTO).trim().toLowerCase().replace(/[-\s]+/g, '_');
  if (!value || value === AUTH_AUTO) return AUTH_AUTO;
  if (['connection_string', 'connectionstring', 'key'].includes(value)) {
    return AUTH_CONNECTION_STRING;
  }
  if (['managed_identity', 'managedidentity', 'workload_identity', 'workloadidentity', 'identity', 'aad', 'entra'].includes(value)) {
    return AUTH_MANAGED_IDENTITY;
  }
  throw new Error(`Unsupported AZURE_STORAGE_AUTH value: ${raw}`);
}

function storageBlobEndpoint({ endpoint, accountName } = {}) {
  const explicitEndpoint = endpoint || process.env.AZURE_STORAGE_BLOB_ENDPOINT;
  if (explicitEndpoint) {
    const trimmed = String(explicitEndpoint).trim();
    if (!trimmed) return null;
    return trimmed.replace(/\/+$/, '');
  }

  const resolvedAccountName = accountName || process.env.AZURE_STORAGE_ACCOUNT_NAME;
  if (!resolvedAccountName) return null;
  return `https://${String(resolvedAccountName).trim()}.blob.core.windows.net`;
}

function defaultAzureCredential() {
  if (!DefaultAzureCredential) {
    throw new Error('@azure/identity is required for Azure Storage managed identity authentication');
  }
  return new DefaultAzureCredential();
}

function createAzureBlobServiceClient({
  connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING,
  auth = process.env.AZURE_STORAGE_AUTH,
  endpoint,
  accountName,
} = {}) {
  const authMode = normalizeAzureStorageAuth(auth);
  const conn = connectionString || process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (authMode !== AUTH_MANAGED_IDENTITY && conn) {
    return {
      client: BlobServiceClient.fromConnectionString(conn),
      authMode: AUTH_CONNECTION_STRING,
      endpoint: null,
    };
  }

  if (authMode === AUTH_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is required when AZURE_STORAGE_AUTH=connection_string');
  }

  const blobEndpoint = storageBlobEndpoint({ endpoint, accountName });
  if (!blobEndpoint) {
    throw new Error(
      'Azure Blob managed identity authentication requires AZURE_STORAGE_BLOB_ENDPOINT or AZURE_STORAGE_ACCOUNT_NAME',
    );
  }

  return {
    client: new BlobServiceClient(blobEndpoint, defaultAzureCredential()),
    authMode: AUTH_MANAGED_IDENTITY,
    endpoint: blobEndpoint,
  };
}

module.exports = {
  AUTH_AUTO,
  AUTH_CONNECTION_STRING,
  AUTH_MANAGED_IDENTITY,
  createAzureBlobServiceClient,
  normalizeAzureStorageAuth,
  storageBlobEndpoint,
};
