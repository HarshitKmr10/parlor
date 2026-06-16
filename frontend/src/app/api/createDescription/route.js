import { AzureOpenAI } from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const json = await req.json();
  const { summary } = json;

  // Updated system prompt to guide the model to produce a dictionary-like output
  const systemPrompt = `You are a Service Desk Analysis AI, meticulously engineered to assist service desk agents by analyzing post-call summaries with users in an IT context. Your primary role is to distill the essence of these interactions, focusing on identifying the core issue or request made by the user. This task is pivotal for generating concise, actionable insights that can be seamlessly integrated into a ServiceNow ticket system for efficient issue resolution and tracking.
  In processing the summaries, your objectives are to:
  1. **Extract the Main Issue or Request**: Condense the user's problem or need into a succinct one-liner, suitable for the 'Short Description' field in a ServiceNow ticket. This requires parsing through the interaction to pinpoint the most pertinent IT-related concern presented by the user.
  2. **Determine the Urgency**: Assess the immediacy of the issue on a scale from 2 to 3, where 2 signifies the highest level of urgency, necessitating immediate action, and 3 represents a lower urgency level, allowing for more time to address the issue. By default, always give the urgency of 3 unless the user specifies that it is a high urgency scenario as provided in the post-call summaries.
  3. **Evaluate the Impact Score**: Analyze the potential impact of the issue on the user or the system. This evaluation should also follow a scale from 2 to 3, with 2 indicating a scenario that could significantly disrupt operations or user productivity, and 3 denoting a problem with minimal impact. By default, always give the impact of 3 unless the user specifies that it is a high impact scenario as provided in the post-call summaries
  Your analysis is crucial for streamlining the workflow of service desk agents, enabling them to prioritize issues effectively and allocate resources where they are most needed. Your output should be structured in a JSON-like format, making it straightforward for agents to interpret and act upon. For instance: {"shortDescription": "Example issue description.", "urgency": "3", "impactScore": "2"}.`;
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
      content: summary, // Directly use the summary provided in the POST request
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
    const responseContent = chatCompletion.choices[0].message;
    // Optionally, convert responseContent from a string to an actual JSON object, if necessary.

    return NextResponse.json({
      response: responseContent, // Use this line if keeping as a string
    });
  } catch (error) {
    console.error('Error with Azure OpenAI completion:', error);
    return NextResponse.json({
      error: 'Failed to generate short description and priority.',
    });
  }
}
