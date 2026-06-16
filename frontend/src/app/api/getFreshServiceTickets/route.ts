import { NextResponse, NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const json = await req.json();
  const { requesterId } = json;

  if (!requesterId) {
    return new NextResponse(
      JSON.stringify({ error: 'Requester ID is required' }),
      { status: 400 },
    );
  }

  const url = `https://akkodis-ai.freshservice.com/api/v2/tickets?requester_id=${requesterId}`;

  // Use environment variables for sensitive information
  const authToken = 'Basic TmxoejFueVYxUUU4TkVHSEQ0QTpY';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authToken,
      },
    }).then((res) => res.json());

    if (response.tickets && response.tickets.length > 0) {
      return new NextResponse(
        JSON.stringify({ success: true, tickets: response.tickets }),
      );
    }

    return new NextResponse(
      JSON.stringify({
        error: 'No tickets found for the requester',
        details: response,
      }),
      { status: 404 },
    );
  } catch (error) {
    return new NextResponse(
      JSON.stringify({
        error: 'Internal Server Error',
        details: error.message,
      }),
      { status: 500 },
    );
  }
}
