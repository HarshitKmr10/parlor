import { useState } from 'react';
import { useGlobalContext } from 'contexts/store';
import { API } from 'api';
import { Meeting } from 'types/meetingTypes';

const useSubmitFormKnowledgeTransition = (router) => {
  const appId = 'ServiceDesk';
  const { user, selectedTeam } = useGlobalContext();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e, formData, contactMethod) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const meetingData = {
        title: formData.title,
        channel: "Meet",
        bot_name: formData.botName || 'FuturePath Meeting Bot',
        app_id: appId,
        team_id: selectedTeam.id,
        postcall_analysis_webhook: `${process.env.NEXT_PUBLIC_FRONTEND_IP}/webhook/intake`,
        link: formData.link,
      };
      const response = await API.KnowledgeAI.createKnowledgeAIMeeting(meetingData);
      router.push(`/knowledge/copilot?meetingId=${response.meeting_id}`);
      setLoading(false);
    } catch (err) {
      setError(`An error occurred while submitting the form`);
      setLoading(false);
      throw Error(
        `An error occurred while submitting the form: ${err.message}`,
      );
    }
  };

  return { loading, error, handleSubmit };
};

export default useSubmitFormKnowledgeTransition;
