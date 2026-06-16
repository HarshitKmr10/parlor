import { Button } from '@radix-ui/themes';
import InputField from 'components/fields/InputField';
// import TextField from 'components/fields/TextField';
import { useGlobalContext } from 'contexts/store';
import { usePathname } from 'next/navigation';
import React, { useState } from 'react';
import Modal from 'react-modal';

// Make sure to bind modal to your appElement (http://reactcommunity.org/react-modal/accessibility/)
// Modal.setAppElement("#root");

function FeedbackModal({ isOpen, onRequestClose }) {
  const [logFeedback, setFeedback] = useState('');
  const { user } = useGlobalContext();
  const pathname = usePathname();
  const pathSegments = pathname.split('/');

  const sessionId = pathSegments[1] !== 'agent-assist' ? null : pathSegments.pop();

  const handleSubmit = async () => {
    const jsonData = {
      user_id: user?.id,
      session_id: sessionId,
      feedback: logFeedback,
    };

    const reportIssuesEndpoint = `${process.env.NEXT_PUBLIC_FRONTEND_IP}/service_desk/report_issues`;
    const response = await fetch(reportIssuesEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user?.access_token}`, // Ensure this token is correctly configured
      },
      body: JSON.stringify(jsonData),
    });

    if (response.ok) {
      onRequestClose();
      setFeedback('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      className="relative max-h-[75vh] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1/2 bg-white dark:bg-navy-700 p-5 rounded-2xl shadow-lg overflow-y-auto"
      contentLabel="Feedback Form"
    >
      <button onClick={onRequestClose} className="absolute top-0 right-0 p-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 stroke-textColor-light dark:stroke-textColor-dark"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      <div className="flex flex-col justify-between h-full">
        <div>
          {sessionId !== null && sessionId !== 'agent-assist' && (
            <InputField
              id="sessionId"
              label="Session ID"
              name="sessionId"
              value={sessionId}
              onChange={() => {}}
              placeholder="Session ID"
              disabled
            />
          )}

          {/* <TextField
            id="description"
            label="Describe the issue"
            name="description"
            value={logFeedback}
            onChange={(e) => setFeedback(e.target.value)}
            isResizable
            rows={5}
            extra="overflow-y-auto"
          /> */}
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={handleSubmit} color="indigo">
            Submit Feedback
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default FeedbackModal;
