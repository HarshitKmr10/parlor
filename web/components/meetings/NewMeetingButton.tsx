"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { NewMeetingModal } from "./NewMeetingModal";

export function NewMeetingButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button size="sm" className="shrink-0" onClick={() => setIsOpen(true)}>
        <PlusIcon className="h-4 w-4" />
        <span className="hidden sm:inline">New meeting</span>
        <span className="sm:hidden">New</span>
      </Button>
      <NewMeetingModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
