'use strict';

function getAwsCredentialsFromEnv() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const hasAnyExplicitCredential = Boolean(accessKeyId || secretAccessKey || sessionToken);

  if (!hasAnyExplicitCredential) {
    return undefined;
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must both be set when using explicit AWS credentials'
    );
  }

  const credentials = {
    accessKeyId,
    secretAccessKey,
  };

  if (sessionToken) {
    credentials.sessionToken = sessionToken;
  }

  return credentials;
}

function requireAwsCredentialsFromEnv(providerName = 'AWS provider') {
  const credentials = getAwsCredentialsFromEnv();
  if (!credentials) {
    throw new Error(
      `AWS credentials (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY) are required for ${providerName}`
    );
  }
  return credentials;
}

function awsClientConfigFromEnv({
  region = process.env.AWS_REGION || 'us-east-1',
  requireCredentials = false,
  providerName = 'AWS provider',
} = {}) {
  const credentials = requireCredentials
    ? requireAwsCredentialsFromEnv(providerName)
    : getAwsCredentialsFromEnv();

  return {
    region,
    ...(credentials ? { credentials } : {}),
  };
}

module.exports = {
  awsClientConfigFromEnv,
  getAwsCredentialsFromEnv,
  requireAwsCredentialsFromEnv,
};
