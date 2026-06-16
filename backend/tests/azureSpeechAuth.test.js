'use strict';

const path = require('node:path');

const {
  AUTH_KEY,
  AUTH_MANAGED_IDENTITY,
  createAzureSpeechConfig,
  normalizeAzureSpeechAuth,
  speechEndpointUrl,
} = require(path.join('..', 'src', 'processors', 'azureSpeechAuth'));

function fakeSpeechSdk() {
  return {
    SpeechConfig: {
      fromHost: jest.fn((endpoint) => ({ kind: 'host', endpoint })),
      fromEndpoint: jest.fn((endpoint, auth) => ({ kind: 'endpoint', endpoint, auth })),
      fromSubscription: jest.fn((key, region) => ({ kind: 'subscription', key, region })),
    },
  };
}

describe('azureSpeechAuth', () => {
  const ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ENV };
    delete process.env.AZURE_SPEECH_AUTH;
  });

  afterEach(() => {
    process.env = { ...ENV };
  });

  test('normalizes managed identity aliases', () => {
    expect(normalizeAzureSpeechAuth('managed-identity')).toBe(AUTH_MANAGED_IDENTITY);
    expect(normalizeAzureSpeechAuth('workload_identity')).toBe(AUTH_MANAGED_IDENTITY);
  });

  test('normalizes key aliases', () => {
    expect(normalizeAzureSpeechAuth('subscription-key')).toBe(AUTH_KEY);
    expect(normalizeAzureSpeechAuth('api_key')).toBe(AUTH_KEY);
  });

  test('converts HTTPS endpoint to WSS for streaming adapters', () => {
    expect(speechEndpointUrl('https://speech.example.com', { preferWebSocket: true }).toString())
      .toBe('wss://speech.example.com/');
  });

  test('uses subscription key when region and key are configured', () => {
    const sdk = fakeSpeechSdk();

    const result = createAzureSpeechConfig({
      sdk,
      key: 'speech-key',
      region: 'eastus',
    });

    expect(result.authMode).toBe(AUTH_KEY);
    expect(result.config).toEqual({ kind: 'subscription', key: 'speech-key', region: 'eastus' });
    expect(sdk.SpeechConfig.fromSubscription).toHaveBeenCalledWith('speech-key', 'eastus');
  });

  test('auto mode uses endpoint plus key when endpoint is configured', () => {
    const sdk = fakeSpeechSdk();

    const result = createAzureSpeechConfig({
      sdk,
      endpoint: 'https://speech.example.com',
      key: 'speech-key',
      region: 'eastus',
    });

    expect(result.authMode).toBe(AUTH_KEY);
    expect(result.endpoint).toBe('https://speech.example.com/');
    expect(sdk.SpeechConfig.fromEndpoint).toHaveBeenCalledWith(
      new URL('https://speech.example.com/'),
      'speech-key',
    );
  });

  test('streaming compatibility option keeps region plus key ahead of endpoint', () => {
    const sdk = fakeSpeechSdk();

    const result = createAzureSpeechConfig({
      sdk,
      endpoint: 'https://speech.example.com',
      key: 'speech-key',
      region: 'eastus',
      preferRegionKeyInAuto: true,
    });

    expect(result.authMode).toBe(AUTH_KEY);
    expect(result.config).toEqual({ kind: 'subscription', key: 'speech-key', region: 'eastus' });
    expect(sdk.SpeechConfig.fromEndpoint).not.toHaveBeenCalled();
  });

  test('uses endpoint plus key for private endpoint key auth', () => {
    const sdk = fakeSpeechSdk();

    const result = createAzureSpeechConfig({
      sdk,
      auth: 'key',
      endpoint: 'https://speech.example.com',
      key: 'speech-key',
    });

    expect(result.authMode).toBe(AUTH_KEY);
    expect(result.endpoint).toBe('https://speech.example.com/');
    expect(sdk.SpeechConfig.fromEndpoint).toHaveBeenCalledWith(
      new URL('https://speech.example.com/'),
      'speech-key',
    );
  });

  test('uses endpoint plus managed identity when requested', () => {
    const sdk = fakeSpeechSdk();

    const result = createAzureSpeechConfig({
      sdk,
      auth: 'managed_identity',
      endpoint: 'https://speech.example.com',
    });

    expect(result.authMode).toBe(AUTH_MANAGED_IDENTITY);
    expect(result.endpoint).toBe('https://speech.example.com/');
    expect(result.config.auth.getToken).toEqual(expect.any(Function));
  });

  test('uses endpoint plus managed identity for streaming adapters', () => {
    const sdk = fakeSpeechSdk();

    const result = createAzureSpeechConfig({
      sdk,
      auth: 'managed_identity',
      endpoint: 'https://speech.example.com',
      preferWebSocket: true,
    });

    expect(result.authMode).toBe(AUTH_MANAGED_IDENTITY);
    expect(result.endpoint).toBe('wss://speech.example.com/');
    expect(sdk.SpeechConfig.fromEndpoint).toHaveBeenCalledWith(
      new URL('wss://speech.example.com/'),
      result.config.auth,
    );
  });

  test('does not use region-only managed identity in auto mode', () => {
    const sdk = fakeSpeechSdk();

    expect(() => createAzureSpeechConfig({
      sdk,
      region: 'eastus',
    })).toThrow(/AZURE_SPEECH_ENDPOINT/);
  });

  test('requires endpoint for managed identity', () => {
    const sdk = fakeSpeechSdk();

    expect(() => createAzureSpeechConfig({
      sdk,
      auth: 'managed_identity',
      region: 'eastus',
    })).toThrow(/AZURE_SPEECH_ENDPOINT/);
  });

  test('uses container endpoint when configured', () => {
    const sdk = fakeSpeechSdk();

    const result = createAzureSpeechConfig({
      sdk,
      containerEndpoint: 'http://speech-container:5000',
    });

    expect(result.authMode).toBe('container');
    expect(sdk.SpeechConfig.fromHost).toHaveBeenCalledWith(new URL('http://speech-container:5000'));
  });
});
