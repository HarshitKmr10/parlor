// pages/api/getUser.ts
import { NextResponse, NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const json = await req.json();
  const { userId } = json;

  if (!userId) {
    return new NextResponse(
      JSON.stringify({ error: 'Requester ID is required' }),
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    user: [
      {
        id: 777,
        is_agent: false,
        first_name: 'Harry',
        last_name: 'Potter',
        job_title: 'Student',
        primary_email: 'harry.potter@hogwarts.edu',
        secondary_emails: [
          'harry.potter@freshservice.com',
          'harry.potter@freshworks.com',
        ],
        work_phone_number: '62442',
        mobile_phone_number: '77762442',
        department_ids: [554],
        can_see_all_tickets_from_associated_departments: false,
        reporting_manager_id: 656,
        address: 'Gryffindor Tower',
        time_zone: 'Edinburgh',
        time_format: '12h',
        language: 'en',
        location_id: 23,
        background_information: '',
        custom_fields: {
          quidditch_role: 'Seeker',
          hogsmeade_permission: true,
        },
        active: true,
        has_logged_in: false,
      },
    ],
  });

  //   const url = `https://akkodis-ai.freshservice.com/api/v2/requesters/${user_id}`;

  //   // Use environment variables for sensitive information
  //   const authToken = "Basic Nlhz1nyV1QE8NEGHD4A";

  //   try {
  //     const response = await fetch(url, {
  //       method: "GET",
  //       headers: {
  //         Accept: "application/json",
  //         Authorization: authToken,
  //       },
  //     }).then((res) => res.json());

  //     console.log("RESPOSNE: Response", response);

  //     // Check if the response was successful
  //     if (!response.ok) {
  //       console.error(`Error: ${response.status} - ${response.statusText}`);
  //     }

  //     const data = await response.json();
  //     console.log("DATA USER FRESH SERVICE: ", data);
  //     // return NextResponse.json({ success: true, user: data.result });
  //     return NextResponse.json({
  //       success: true,
  //       user: {
  //         id: 777,
  //         is_agent: false,
  //         first_name: "Harry",
  //         last_name: "Potter",
  //         job_title: "Student",
  //         primary_email: "harry.potter@hogwarts.edu",
  //         secondary_emails: [
  //           "harry.potter@freshservice.com",
  //           "harry.potter@freshworks.com",
  //         ],
  //         work_phone_number: "62442",
  //         mobile_phone_number: "77762442",
  //         department_ids: [554],
  //         can_see_all_tickets_from_associated_departments: false,
  //         reporting_manager_id: 656,
  //         address: "Gryffindor Tower",
  //         time_zone: "Edinburgh",
  //         time_format: "12h",
  //         language: "en",
  //         location_id: 23,
  //         background_information: "",
  //         custom_fields: {
  //           quidditch_role: "Seeker",
  //           hogsmeade_permission: true,
  //         },
  //         active: true,
  //         has_logged_in: false,
  //       },
  //     });
  //   } catch (error) {
  //     console.error("Error fetching users:", error);
  //     return NextResponse.json(
  //       {
  //         error: "Internal Server Error",
  //         details: error,
  //       },
  //       {
  //         status: 500,
  //       }
  //     );
  //   }
}
