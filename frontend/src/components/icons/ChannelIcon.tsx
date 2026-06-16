import React from 'react';
import { HiPhoneOutgoing as CallOutgoingIcon, HiPhoneIncoming as CallIncomingIcon } from 'react-icons/hi';
import { FaVideo as MeetIcon } from 'react-icons/fa6';

export function ChannelIcon({ channel }) {
  const values = {
    Phone: {
      icon: <CallOutgoingIcon className="inline text-lg text-red-500" />,
      title: 'Outgoing Call',
    },
    PhoneIncoming: {
      icon: <CallIncomingIcon className="inline text-lg text-green-500" />,
      title: 'Incoming Call',
    },
    Meet: {
      icon: <MeetIcon />,
      title: 'Online Meet',
    },
  };

  const currentValue = values[channel];

  return currentValue ? (
    <div className="flex gap-2 items-center text-brandLinear">
      {/* <CallIncomingIcon className="inline text-2xl" /> */}
      {/* <CallOutgoingIcon className="inline text-lg text-red-500" /> */}
      {currentValue.icon}
      <span>{currentValue.title}</span>
    </div>
  ) : null;
}
