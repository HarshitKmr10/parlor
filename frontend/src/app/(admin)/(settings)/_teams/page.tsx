'use client';

import React from 'react';
// import Card from 'components/card';
// import TextField from 'components/fields/TextField';
import withAuth from 'components/withAuth';
import { useGlobalContext } from 'contexts/store';
import TeamBanner from 'components/teams/teamBanner';
import { Card } from '@radix-ui/themes';

// Modal.setAppElement("#root");

function Teams() {
  const { selectedTeam } = useGlobalContext();

  return (
    <div className="mt-16 grid h-full w-full grid-cols-4 gap-[20px] rounded-[20px] md:mt-3 xl:mt-0">
      {/* Assuming each of these divs is a column */}
      <div className="col-span-2 h-full w-full rounded-2xl">
        {/* <JobOrdersCard/> */}

        <TeamBanner />
      </div>

      <Card>
        {/* background and profile */}
        <div className="w-full px-[8px] mb-4">
          <h4 className="text-xl font-bold text-navy-700 dark:text-white">
            Team Description
          </h4>
          <p className="mt-1 text-base text-gray-600">
            About Team Description based on which job description will be
            created using AI
          </p>
        </div>
        {/* <TextField
          id="jobDescription"
          label=""
          value={selectedTeam?.description}
          onChange={() => {}}
          // rows={10}
          // height={150}
          // maxTextAreaHeight={'60vh'}
          // minTextAreaHeight={'200vh'}
          className="flex-grow"
          isResizable={false}
        /> */}
      </Card>

      {/* Chart component that spans two columns */}
      <div className="col-span-4 w-full rounded-2xl -mt-10" />
    </div>
  );
}

export default withAuth(Teams);
