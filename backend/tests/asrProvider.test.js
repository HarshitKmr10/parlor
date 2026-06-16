'use strict';

const path = require('node:path');
const {
  pickAsrAdapterFactory, resolveProvider,
  PROVIDER_AWS, PROVIDER_AZURE,
} = require(path.join(
  '..', 'src', 'processors', 'csrcAttribution', 'asrProvider',
));

describe('asrProvider', () => {
  const ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ENV };
  });

  test('default is AWS', () => {
    delete process.env.ASR_PROVIDER;
    delete process.env.MSTEAMS_ASR_PROVIDER;
    expect(resolveProvider()).toBe(PROVIDER_AWS);
  });

  test('explicit param wins over env', () => {
    process.env.ASR_PROVIDER = 'azure';
    process.env.MSTEAMS_ASR_PROVIDER = 'azure';
    expect(resolveProvider('aws')).toBe(PROVIDER_AWS);
  });

  test('ASR_PROVIDER env switches to azure', () => {
    delete process.env.MSTEAMS_ASR_PROVIDER;
    process.env.ASR_PROVIDER = 'azure';
    expect(resolveProvider()).toBe(PROVIDER_AZURE);
  });

  test('MSTEAMS_ASR_PROVIDER fallback for backward compat', () => {
    delete process.env.ASR_PROVIDER;
    process.env.MSTEAMS_ASR_PROVIDER = 'azure';
    expect(resolveProvider()).toBe(PROVIDER_AZURE);
  });

  test('unknown provider strings fall back to default', () => {
    process.env.ASR_PROVIDER = 'whisper';
    expect(resolveProvider()).toBe(PROVIDER_AWS);
  });

  test('case-insensitive matching', () => {
    process.env.ASR_PROVIDER = 'Azure';
    expect(resolveProvider()).toBe(PROVIDER_AZURE);
  });

  test('pickAsrAdapterFactory returns matching provider tag', () => {
    const aws = pickAsrAdapterFactory({ provider: 'aws' });
    expect(aws.provider).toBe(PROVIDER_AWS);
    expect(typeof aws.factory).toBe('function');

    const az = pickAsrAdapterFactory({ provider: 'azure' });
    expect(az.provider).toBe(PROVIDER_AZURE);
    expect(typeof az.factory).toBe('function');
  });

  // Note: we don't actually CALL the returned factory in tests because
  // that would lazy-load real SDKs (AWS / microsoft-cognitiveservices-
  // speech-sdk) and the latter isn't installed in every dev workspace.
  // The factory contract is verified by the integration test suites
  // for AWS (existing) and Azure (existing).
});
