import { RetrievalMode, VectorFieldOptions, GPT4VInput } from 'api/chat';

export const chatAppRequestContextSettings = {
  promptTemplate: '',
  retrieveCount: 7,
  retrievalMode: RetrievalMode.Vectors,
  useSemanticRanker: true,
  shouldStream: false,
  useSemanticCaptions: false,
  excludeCategory: '',
  vectorFieldList: [VectorFieldOptions.Embedding],
  suggestFollowupQuestions: true,
  useOidSecurityFilter: false,
  useGroupsSecurityFilter: false,
  gpt4vInput: GPT4VInput.TextAndImages,
  useGPT4V: false,
};
