import React from 'react';

interface Props {
  name: string;
  image?: string;
}

const UserAvatar = ({ name, image }: Props) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return image ? (
    <img src={image} alt={name} className="h-8 w-8 rounded-full object-cover" />
  ) : (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-xs text-white">
      {initials}
    </div>
  );
};

export default UserAvatar;
