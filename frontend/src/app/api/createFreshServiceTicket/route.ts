import { NextResponse, NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const json = await req.json();
  const {
    subject, description, requesterId, priority, status,
  } = json;
  const ticketData = {
    description,
    subject,
    requesterId,
    priority,
    status,
  };

  const url = 'https://akkodis-ai.freshservice.com/api/v2/tickets';

  // Use environment variables for sensitive information
  const authToken = 'Basic Nml0S3JkMEZ1amRTRFRUeUpS';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: authToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ticketData),
    }).then((res) => res.json());

    if (response.ticket) {
      const ticketLink = `https://akkodis-ai.freshservice.com/a/tickets/${response.ticket.id}`;
      return NextResponse.json({ success: true, ticketLink });
    }
    return NextResponse.json(
      {
        error: 'Failed to create incident',
        details: response,
      },
      {
        status: 500,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error.message,
      },
      {
        status: 500,
      },
    );
  }
}
