import { readFileSync } from "node:fs";

export interface SeededMeeting {
  id: string;
  title: string;
  shareToken?: string;
}

export interface SeedArtifact {
  email: string;
  password: string;
  workspaceId: string;
  userId: string;
  meetings: SeededMeeting[];
}

/** Load the workspace the setup project seeded. */
export function loadSeeded(): SeedArtifact {
  return JSON.parse(readFileSync("e2e/.artifacts/seeded.json", "utf8")) as SeedArtifact;
}
