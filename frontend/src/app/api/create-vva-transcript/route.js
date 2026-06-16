import { AzureOpenAI } from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const json = await req.json();
  const { transcript, userName } = json;

  // Updated system prompt to guide the model to produce a summary
  const systemPrompt = `You are an AI assistant designed to format IT service desk interactions into styled HTML. For each conversation, you will convert the plain text transcript into HTML, ensuring proper line breaks and preserving the content. Use appropriate HTML tags for the structure and styling to enhance readability. The format should match the example provided:

  **Example Input:**
  AI: Hello. Thanks for calling IT service desk. This is Susan. May I assist you today? User: Hello. AI: Hi there. Could you please provide me with your employee ID so I can assist you further? User: 9 5 0 1 4. AI: Give me a moment. AI: It seems there was an issue verifying your employee ID. Could you please provide your employee ID again? User: Uh, no. Just forward the call to human agent. AI: Transferring the call now.

  **Example Output:**
  <div class="transcript">
    <p><strong>AI:</strong> Hello. Thanks for calling IT service desk. This is Susan. May I assist you today?</p>
    <p><strong>User:</strong> Hello.</p>
    <p><strong>AI:</strong> Hi there. Could you please provide me with your employee ID so I can assist you further?</p>
    <p><strong>User:</strong> 9 5 0 1 4.</p>
    <p><strong>AI:</strong> Give me a moment.</p>
    <p><strong>AI:</strong> It seems there was an issue verifying your employee ID. Could you please provide your employee ID again?</p>
    <p><strong>User:</strong> Uh, no. Just forward the call to human agent.</p>
    <p><strong>AI:</strong> Transferring the call now.</p>
  </div>

  **Transcript to be formatted:**
  AI: Hello. Thanks for calling IT service desk. This is Susan. May I assist you today? User: Hello. AI: Hi there. Could you please provide me with your employee ID so I can assist you further? User: 9 5 0 1 4. AI: Give me a moment. AI: It seems there was an issue verifying your employee ID. Could you please provide your employee ID again? User: Uh, no. Just forward the call to human agent. AI: Transferring the call now.
  `;

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
      content: `Transcript:\n${transcript}\nUser Name: ${userName}`, // Provide the transcript and user name
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

    // Directly use the model's response assuming it's correctly formatted
    const responseContent = chatCompletion.choices[0].message.content;

    return NextResponse.json({
      response: responseContent,
    });
  } catch (error) {
    console.error('Error with Azure OpenAI completion:', error);
    return NextResponse.json({
      error: 'Failed to generate summary.',
    });
  }
}
