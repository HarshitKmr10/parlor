'use strict';

const {
  awsClientConfigFromEnv,
  getAwsCredentialsFromEnv,
  requireAwsCredentialsFromEnv,
} = require('../src/utils/awsCredentials');

describe('awsCredentials', () => {
  const ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ENV };
  });

  test('includes session token with explicit temporary credentials', () => {
    process.env.AWS_ACCESS_KEY_ID = 'aws-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret';
    process.env.AWS_SESSION_TOKEN = 'aws-session';

    expect(getAwsCredentialsFromEnv()).toEqual({
      accessKeyId: 'aws-key',
      secretAccessKey: 'aws-secret',
      sessionToken: 'aws-session',
    });
  });

  test('returns no explicit credentials when credential env vars are absent', () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;

    expect(getAwsCredentialsFromEnv()).toBeUndefined();
    expect(awsClientConfigFromEnv()).toEqual({ region: 'us-east-1' });
  });

  test('rejects partial explicit credentials', () => {
    process.env.AWS_ACCESS_KEY_ID = 'aws-key';
    delete process.env.AWS_SECRET_ACCESS_KEY;
    process.env.AWS_SESSION_TOKEN = 'aws-session';

    expect(() => getAwsCredentialsFromEnv()).toThrow(
      /AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY/
    );
  });

  test('builds client config with default region and optional credentials', () => {
    process.env.AWS_ACCESS_KEY_ID = 'aws-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret';
    process.env.AWS_SESSION_TOKEN = 'aws-session';
    delete process.env.AWS_REGION;

    expect(awsClientConfigFromEnv()).toEqual({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'aws-key',
        secretAccessKey: 'aws-secret',
        sessionToken: 'aws-session',
      },
    });
  });

  test('throws a provider-specific error when credentials are required', () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    expect(() => requireAwsCredentialsFromEnv('Bedrock provider')).toThrow(
      /Bedrock provider/
    );
  });
});
