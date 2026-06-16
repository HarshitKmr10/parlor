'use strict';

const path = require('node:path');

const {
  AUTH_CONNECTION_STRING,
  AUTH_MANAGED_IDENTITY,
  createAzureBlobServiceClient,
  normalizeAzureStorageAuth,
  storageBlobEndpoint,
} = require(path.join('..', 'src', 'storage', 'azureBlobClient'));

describe('azureBlobClient', () => {
  const ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ENV };
    delete process.env.AZURE_STORAGE_AUTH;
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.AZURE_STORAGE_BLOB_ENDPOINT;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
  });

  afterEach(() => {
    process.env = { ...ENV };
  });

  test('normalizes managed identity aliases', () => {
    expect(normalizeAzureStorageAuth('managed-identity')).toBe(AUTH_MANAGED_IDENTITY);
    expect(normalizeAzureStorageAuth('workload_identity')).toBe(AUTH_MANAGED_IDENTITY);
  });

  test('builds default blob endpoint from account name', () => {
    expect(storageBlobEndpoint({ accountName: 'meetingstore' }))
      .toBe('https://meetingstore.blob.core.windows.net');
  });

  test('uses connection string when present in auto mode', () => {
    const accountKey = Buffer.alloc(64, 1).toString('base64');
    const connectionString = [
      'DefaultEndpointsProtocol=https',
      'AccountName=meetingstore',
      `AccountKey=${accountKey}`,
      'EndpointSuffix=core.windows.net',
    ].join(';');

    const result = createAzureBlobServiceClient({ connectionString });

    expect(result.authMode).toBe(AUTH_CONNECTION_STRING);
    expect(result.client).toBeDefined();
  });

  test('uses managed identity when configured with account name', () => {
    const result = createAzureBlobServiceClient({
      auth: 'managed_identity',
      accountName: 'meetingstore',
      connectionString: '',
    });

    expect(result.authMode).toBe(AUTH_MANAGED_IDENTITY);
    expect(result.endpoint).toBe('https://meetingstore.blob.core.windows.net');
    expect(result.client).toBeDefined();
  });

  test('requires endpoint or account name for managed identity', () => {
    expect(() => createAzureBlobServiceClient({
      auth: 'managed_identity',
      connectionString: '',
    })).toThrow(/AZURE_STORAGE_BLOB_ENDPOINT or AZURE_STORAGE_ACCOUNT_NAME/);
  });
});
