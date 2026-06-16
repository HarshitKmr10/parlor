import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

function CustomToolTip({ trigger, children }) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{trigger}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="rounded-sm bg-white p-3 shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px]"
            side="bottom"
          >
            {children}

            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export default CustomToolTip;
