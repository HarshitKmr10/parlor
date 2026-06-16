'use strict';

let DefaultAzureCredential = null;
try {
  ({ DefaultAzureCredential } = require('@azure/identity'));
} catch (_) {
  DefaultAzureCredential = null;
}

const AUTH_AUTO = 'auto';
const AUTH_KEY = 'key';
const AUTH_MANAGED_IDENTITY = 'managed_identity';

function normalizeAzureSpeechAuth(raw) {
  const value = String(raw || AUTH_AUTO).trim().toLowerCase().replace(/[-\s]+/g, '_');
  if (!value || value === AUTH_AUTO) return AUTH_AUTO;
  if (['key', 'api_key', 'subscription_key', 'subscription'].includes(value)) return AUTH_KEY;
  if (['managed_identity', 'managedidentity', 'workload_identity', 'workloadidentity', 'identity', 'aad', 'entra'].includes(value)) {
    return AUTH_MANAGED_IDENTITY;
  }
  throw new Error(`Unsupported AZURE_SPEECH_AUTH value: ${raw}`);
}

function speechEndpointUrl(raw, { preferWebSocket = false } = {}) {
  if (!raw) return null;
  let value = String(raw).trim();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  if (preferWebSocket && value.startsWith('https://')) {
    value = value.replace('https://', 'wss://');
  }
  return new URL(value);
}

function defaultAzureCredential() {
  if (!DefaultAzureCredential) {
    throw new Error('@azure/identity is required for Azure Speech managed identity authentication');
  }
  return new DefaultAzureCredential();
}

function createAzureSpeechConfig({
  sdk,
  endpoint,
  key,
  region,
  containerEndpoint,
  auth = process.env.AZURE_SPEECH_AUTH,
  preferWebSocket = false,
  preferRegionKeyInAuto = false,
} = {}) {
  if (!sdk?.SpeechConfig) {
    throw new Error('Azure Speech SDK is required to create a SpeechConfig');
  }

  const authMode = normalizeAzureSpeechAuth(auth);
  const wantsManagedIdentity = authMode === AUTH_MANAGED_IDENTITY;
  const wantsKey = authMode === AUTH_KEY;

  if (containerEndpoint) {
    if (wantsManagedIdentity) {
      throw new Error('AZURE_SPEECH_AUTH=managed_identity is not supported with AZURE_SPEECH_CONTAINER_ENDPOINT');
    }
    return {
      config: sdk.SpeechConfig.fromHost(new URL(containerEndpoint)),
      authMode: 'container',
      endpoint: containerEndpoint,
    };
  }

  if (preferRegionKeyInAuto && !wantsManagedIdentity && !wantsKey && key && region) {
    return {
      config: sdk.SpeechConfig.fromSubscription(key, region),
      authMode: AUTH_KEY,
      endpoint: null,
    };
  }

  if (wantsManagedIdentity) {
    const endpointUrl = speechEndpointUrl(endpoint, { preferWebSocket });
    if (!endpointUrl) {
      throw new Error('AZURE_SPEECH_ENDPOINT is required when AZURE_SPEECH_AUTH=managed_identity');
    }
    return {
      config: sdk.SpeechConfig.fromEndpoint(endpointUrl, defaultAzureCredential()),
      authMode: AUTH_MANAGED_IDENTITY,
      endpoint: endpointUrl.toString(),
    };
  }

  const endpointUrl = speechEndpointUrl(endpoint, { preferWebSocket });
  if (endpointUrl) {
    if (!key) {
      if (wantsKey) {
        throw new Error('AZURE_SPEECH_KEY is required when AZURE_SPEECH_AUTH=key');
      }
      return {
        config: sdk.SpeechConfig.fromEndpoint(endpointUrl, defaultAzureCredential()),
        authMode: AUTH_MANAGED_IDENTITY,
        endpoint: endpointUrl.toString(),
      };
    }

    return {
      config: sdk.SpeechConfig.fromEndpoint(endpointUrl, key),
      authMode: AUTH_KEY,
      endpoint: endpointUrl.toString(),
    };
  }

  if (key && region) {
    return {
      config: sdk.SpeechConfig.fromSubscription(key, region),
      authMode: AUTH_KEY,
      endpoint: null,
    };
  }

  throw new Error(
    'Azure Speech requires AZURE_SPEECH_ENDPOINT with managed identity or AZURE_SPEECH_KEY plus AZURE_SPEECH_REGION',
  );
}

module.exports = {
  AUTH_AUTO,
  AUTH_KEY,
  AUTH_MANAGED_IDENTITY,
  createAzureSpeechConfig,
  normalizeAzureSpeechAuth,
  speechEndpointUrl,
};
