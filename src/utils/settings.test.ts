import { beforeEach, describe, expect, it } from 'vitest';
import { AI_CONFIG_KEY, loadAIProviderConfig } from './settings';
import { defaultLMStudioConfig } from './lmstudio';
import { defaultMiniMaxConfig } from './minimax';

describe('loadAIProviderConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('fills new provider defaults for an existing LM Studio configuration', () => {
    localStorage.setItem(
      AI_CONFIG_KEY,
      JSON.stringify({
        provider: 'lmstudio',
        lmStudio: { ...defaultLMStudioConfig, modelName: 'local-model' },
      }),
    );

    expect(loadAIProviderConfig()).toEqual({
      provider: 'lmstudio',
      lmStudio: { ...defaultLMStudioConfig, modelName: 'local-model' },
      minimax: defaultMiniMaxConfig,
    });
  });

  it('fills missing nested fields when a provider configuration is partial', () => {
    localStorage.setItem(
      AI_CONFIG_KEY,
      JSON.stringify({
        provider: 'minimax',
        minimax: { apiKey: 'test-key' },
      }),
    );

    expect(loadAIProviderConfig()).toEqual({
      provider: 'minimax',
      lmStudio: defaultLMStudioConfig,
      minimax: { ...defaultMiniMaxConfig, apiKey: 'test-key' },
    });
  });
});
