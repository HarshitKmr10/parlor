'use strict';

const path = require('node:path');

const { ObjectStorage } = require(path.join('..', 'src', 'storage', 'objectStorage'));

describe('ObjectStorage', () => {
  const ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ENV };
  });

  test('does not select Azure from AZURE_STORAGE_AUTH=auto alone', () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.AZURE_STORAGE_BLOB_ENDPOINT;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AUDIO_ARCHIVE_S3_BUCKET;
    delete process.env.S3_BUCKET_NAME;
    process.env.AZURE_STORAGE_AUTH = 'auto';

    const storage = new ObjectStorage({ logger: { warn() {} } });

    expect(storage.isReady()).toBe(false);
    expect(storage.backend).toBeNull();
  });

  test('fails closed when explicit Azure auth is misconfigured', () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.AZURE_STORAGE_BLOB_ENDPOINT;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    process.env.AUDIO_ARCHIVE_S3_BUCKET = 'fallback-bucket';
    process.env.AWS_ACCESS_KEY_ID = 'aws-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret';
    process.env.AZURE_STORAGE_AUTH = 'managed_identity';

    expect(() => new ObjectStorage({ logger: { warn() {} } }))
      .toThrow(/AZURE_STORAGE_BLOB_ENDPOINT or AZURE_STORAGE_ACCOUNT_NAME/);
  });

  test('fails closed when Azure selector env is present in auto mode', () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.AZURE_STORAGE_BLOB_ENDPOINT;
    process.env.AZURE_STORAGE_ACCOUNT_NAME = '';
    process.env.AUDIO_ARCHIVE_S3_BUCKET = 'fallback-bucket';
    process.env.AWS_ACCESS_KEY_ID = 'aws-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret';
    process.env.AZURE_STORAGE_AUTH = 'auto';
    process.env.AZURE_STORAGE_BLOB_ENDPOINT = 'not a url';

    expect(() => new ObjectStorage({ logger: { warn() {} } }))
      .toThrow();
  });

  test('selects S3 from bucket name with default AWS credential chain', () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.AZURE_STORAGE_BLOB_ENDPOINT;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
    process.env.AZURE_STORAGE_AUTH = 'auto';
    process.env.S3_BUCKET_NAME = 'archive-bucket';

    const storage = new ObjectStorage({ logger: { warn() {} } });

    expect(storage.isReady()).toBe(true);
    expect(storage.backend).toBe('s3');
  });
});
