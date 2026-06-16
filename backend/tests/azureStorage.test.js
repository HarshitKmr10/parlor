'use strict';

const { uploadToAzure } = require('../src/storage/azureStorage');

describe('uploadToAzure AWS mode', () => {
  const ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ENV };
  });

  test('uses S3 with default AWS credential chain when static keys are absent', () => {
    process.env.LLM_PROVIDER = 'aws_transcribe';
    process.env.S3_BUCKET_NAME = 'meeting-audio';
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;

    const uploader = new uploadToAzure();

    expect(uploader.bucketName).toBe('meeting-audio');
    expect(uploader.s3Client).toBeDefined();
  });

  test('rejects partial explicit AWS credentials', () => {
    process.env.LLM_PROVIDER = 'aws_transcribe';
    process.env.S3_BUCKET_NAME = 'meeting-audio';
    process.env.AWS_SESSION_TOKEN = 'session-token';
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    expect(() => new uploadToAzure()).toThrow(
      /AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY/
    );
  });
});
