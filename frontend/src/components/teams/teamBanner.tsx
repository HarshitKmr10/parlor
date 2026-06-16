// components/TeamBanner.tsx

import React from 'react';
import Image from 'next/image';
import { Card } from '@radix-ui/themes';
import { useGlobalContext } from 'contexts/store';
import TeamSelector from './TeamSelector';

function TeamBanner() {
  const { selectedTeam } = useGlobalContext();

  // Error handling: If selectedTeam is undefined, render a placeholder
  if (!selectedTeam) {
    return <Card className="mt-1 p-4">No team selected</Card>;
  }

  return (
    <Card className="mt-1">
      {/* Background and profile section */}
      <div
        className="relative flex h-28 w-full rounded-[16px] bg-cover"
        style={{
          backgroundImage: 'linear-gradient(to bottom, #868cff, #4318ff)', // Gradient background
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay image */}
        <div
          className="absolute inset-0 opacity-50 bg-cover bg-center"
          style={{ backgroundImage: 'url(\'/img/auth/background.png\')' }}
        />

        {/* Team logo */}
        <div className="absolute -bottom-10 left-10 h-[89px] w-[89px] rounded-xl border-2 border-black dark:border-4 dark:border-navy-800">
          <Image
            width={89}
            height={89}
            className="h-full w-full rounded-lg"
            src={selectedTeam.logo}
            alt={`${selectedTeam.name} logo`}
            // Add error handling for image load failure
            onError={(e) => {
              e.currentTarget.src = '/img/placeholder-logo.png'; // Replace with your placeholder image
            }}
          />
        </div>
      </div>

      {/* Team selector section */}
      <div className="mt-14 flex justify-between">
        <TeamSelector />
      </div>
    </Card>
  );
}

export default TeamBanner;
