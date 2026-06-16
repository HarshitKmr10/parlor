import { AzureOpenAI } from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const json = await req.json();
    const { transcript, userName, ticketDetails = [] } = json;

    // Validate required fields
    if (!transcript || !userName) {
      return NextResponse.json({
        error: 'Missing required fields: transcript and userName are required.',
      }, { status: 400 });
    }

    // Updated system prompt to guide the model to produce a summary
  const systemPrompt = `You are an AI assistant designed to summarize IT service desk interactions. For each conversation, you will provide a structured summary including the issue, a brief description, and actions taken. Write in proper, well-formatted markdown. Ensure the headings are bold and use other formatting techniques for important words. Add a new line after each section like Issue, Description, and Actions Taken. The format should match the example provided:

  **Voice Virtual Agent Conversation Summary:**
  
  **Issue:**  
  [Brief issue description]
  
  **Description:**  
  [Detailed description of the issue, including any relevant context or user statements]
  
  **Actions Taken:**  
  - [First action taken]
  - [Second action taken]
  - [Additional actions as needed]

  At the end of the summary, add a new line and write the following:

  **Tickets:**
  ${
    ticketDetails.length > 0
      ? ticketDetails.map((ticket, index) => `    
  Ticket ${index + 1}:
  - **Ticket Number:** [${ticket.number}](https://${ticket.instance_name}.service-now.com/nav_to.do?uri=incident.do?sys_id=${ticket.sys_id})
  - **Description:** ${ticket.short_description}
  - **Status:** Ticket created during this conversation
  `).join('\n')
      : `
  - No new tickets were created during this conversation.
  ${
    transcript.toLowerCase().includes('previous ticket') || transcript.toLowerCase().includes('existing ticket') || transcript.toLowerCase().includes('previous issue') || transcript.toLowerCase().includes('existing issue')
      ? '- A previous ticket was referenced in the conversation. The issue may already have an existing ticket.'
      : ''
  }
  `
  }
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
      temperature: 0.2,
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

    // Handle specific Azure OpenAI errors
    if (error.status === 429) {
      return NextResponse.json({
        error: 'Rate limit exceeded. Please try again later.',
      }, { status: 429 });
    }

    if (error.status === 413) {
      return NextResponse.json({
        error: 'Request too large. Please reduce transcript size.',
      }, { status: 413 });
    }

    if (error.status === 401) {
      return NextResponse.json({
        error: 'Authentication failed. Invalid API key or endpoint.',
      }, { status: 401 });
    }
    
    return NextResponse.json({
      error: 'Failed to generate summary.',
    }, { status: 500 });
  }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({
      error: 'Invalid request format or server error.',
    }, { status: 500 });
  }
}
