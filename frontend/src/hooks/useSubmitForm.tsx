import { useState } from 'react';
import { CONTACT_METHODS } from 'config/constants';
import { useGlobalContext } from 'contexts/store';
import { API } from 'api';
import { Dictionary } from '@fullcalendar/core/internal';
import { Meeting } from 'types/meetingTypes';
import useCallUtils from './useCallUtils';

const useSubmitForm = (router) => {
  const appId = 'ServiceDesk';
  const { user, selectedTeam } = useGlobalContext();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const { joinCall } = useCallUtils();

  const handleSubmit = async (e, formData, contactMethod) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const buildFormData = (
      channelType: string,
      additionalData: Dictionary,
    ) => ({
      title: formData.title,
      channel: channelType,
      bot_name: formData.botName || 'Service Desk AI Bot',
      app_id: appId,
      ...additionalData,
    });

    try {
      let response: Meeting;
      if (contactMethod === CONTACT_METHODS.phoneNumber) {
        const formDataPhone = buildFormData('Phone', {
          phone: formData.phoneNumber,
          postcall_analysis_webhook: `${process.env.NEXT_PUBLIC_FRONTEND_IP}/webhook/intake`,
        });
        response = await API.Meetings.CreateCall(formDataPhone, user);
      } else {
        const formDataMeet = buildFormData('Meet', {
          link: formData.link,
          postcall_analysis_webhook: `${process.env.NEXT_PUBLIC_FRONTEND_IP}/webhook/intake`,
        });
        response = await API.Meetings.CreateMeeting(formDataMeet, user);
      }

      if (response) {
        const data = response;
        await API.Teams.CreateIntakeMeeting(
          user,
          data.meeting_id,
          selectedTeam,
        );
        if (data) {
          await joinCall(data.meeting_id, data.channel);

          const queryParameters = new URLSearchParams({
            meetingId: data.meeting_id,
          }).toString();

          router.push(`/copilot?${queryParameters}`);
        }
      } else {
        console.error('Network response was not ok.');
        throw Error('Network response was not ok.');
      }

      setLoading(false);
    } catch (err) {
      setError(`An error occurred while submitting the form: ${err.message}`);
      setLoading(false);
      throw Error(
        `An error occurred while submitting the form: ${err.message}`,
      );
    }
  };

  return { loading, error, handleSubmit };
};

export default useSubmitForm;
