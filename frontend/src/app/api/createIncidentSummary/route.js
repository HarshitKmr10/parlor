import { AzureOpenAI } from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const json = await req.json();
  const { conversation } = json;

  const systemPrompt = `You are a Service Desk Analysis AI, designed to assist service desk agents by analyzing conversations in an IT context. Your task is to create a concise, informative summary suitable for a ServiceNow ticket. Please provide the following in plain text format:

1. Main Issue: Summarize the core problem or request in one sentence.
2. Key Details: Provide 3-5 key points about the issue, its context, or any solutions attempted.

Your response should be clear, concise, and directly usable in a ServiceNow ticket. Do not use any markdown or HTML formatting.`;

  const openai = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview',
  });

  const model = process.env.CONVERSATION_MODEL || 'gpt-4o-mini';

  const messagesWithSystemPrompt = [
    {
      content: systemPrompt,
      role: 'system',
    },
    {
      content: conversation,
      role: 'user',
    },
  ];

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: model,
      messages: messagesWithSystemPrompt,
      temperature: 0.7,
      max_tokens: 2048,
      stream: false,
    });

    const responseContent = chatCompletion.choices[0].message.content;

    return NextResponse.json({
      response: responseContent,
    });
  } catch (error) {
    console.error('Error with Azure OpenAI completion:', error);
    return NextResponse.json({
      error: 'Failed to generate summary for ServiceNow ticket.',
    });
  }
}
