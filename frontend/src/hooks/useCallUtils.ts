import { API } from "api";
import { useGlobalContext } from "contexts/store";

class CallUtilsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallUtilsError";
  }
}

function useCallUtils() {
  const { device, user } = useGlobalContext();

  const initiateCall = async (phoneNumber: string, meeting_id: string) => {
    if (!device) {
      const error = new CallUtilsError("Device not available");
      console.error(error);
      console.error("Device not available for call");
      throw error;
    }
    if (!phoneNumber) {
      const error = new CallUtilsError("Phone number is required");
      console.error(error);
      console.error("Phone number is required for call");
      throw error;
    }

    try {
      
      const call = await device.connect({
        params: {
          To: phoneNumber,
          meeting_id,
        },
      });
      
      
      return call;
    } catch (error) {
      console.error("Error initiating call:", error);
      console.error("Failed to initiate call");
      throw new CallUtilsError("Failed to initiate call");
    }
  };

  const handleMeetCallJoin = async (meetingId: string, channel: string) => {
    try {
      if (!user) {
        throw new CallUtilsError("User information is missing");
      }

      const meeting = await API.Meetings.GetMeetingsByID(meetingId, user);

      if (meeting.analysis_status === "not_started") {
        if (channel === "Meet") {
          await API.Meetings.JoinMeeting(meeting, user);
        } else if (channel === "Phone") {
          if (!device) {
            throw new CallUtilsError("Device not available for phone call");
          }
          await initiateCall(meeting.phone_number, meeting.meeting_id);
        } else {
          throw new CallUtilsError("Invalid channel specified");
        }
      } else {
        throw new CallUtilsError("Meeting has already started or is invalid");
      }
    } catch (error) {
      console.error("Error in handleMeetCallJoin:", error);
      if (error instanceof CallUtilsError) {
        console.error(error.message);
      } else {
        console.error("Failed to join meeting");
      }
      throw error;
    }
  };

  const joinCall = async (meetingId: string, channel: string) => {
    try {
      await handleMeetCallJoin(meetingId, channel);
    } catch (error) {
      console.error("Error joining call:", error);
      if (error instanceof CallUtilsError) {
        console.error(error.message);
      } else {
        console.error("An unexpected error occurred while joining the call");
      }
      throw error;
    }
  };

  return {
    joinCall,
  };
}

export default useCallUtils;
