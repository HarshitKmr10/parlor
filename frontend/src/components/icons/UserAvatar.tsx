import clsx from 'clsx';
import { useGlobalContext } from 'contexts/store';
import React from 'react';
import Image from 'next/image'; // Importing the Image component from Next.js

function UserAvatarLogo() {
  const { user } = useGlobalContext();
  return (
    <div className="relative h-10 w-10 rounded-md border overflow-hidden">
      {/* Next.js Image component with layout fill to adapt to the parent div's dimensions */}
      <Image
        src={user?.profile_pic || '/default-avatar.png'} // Default image if user profile pic is not available
        alt="User Logo"
        layout="fill"
        objectFit="cover" // Ensures the image covers the area of the div without distorting aspect ratio
      />
    </div>
  );
}

function UserTitle({ extra = '' }) {
  const { user } = useGlobalContext();
  return (
    <div className={clsx('flex items-center', extra)}>
      <div className="text-base font-medium text-textColor-light dark:text-textColor-dark">
        {user?.name}
      </div>
    </div>
  );
}

function UserHeading() {
  return (
    <div className="my-4 flex gap-3 items-center">
      <UserAvatarLogo />
      <UserTitle />
    </div>
  );
}

const UserAvatar = {
  logo: UserAvatarLogo,
  name: UserTitle,
  Full: UserHeading,
};

export default UserAvatar;
