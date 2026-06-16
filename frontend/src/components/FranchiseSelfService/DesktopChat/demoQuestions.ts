export const demoQuestions: Record<string, Array<{
  ask: string;        // example user message
  keywords: string[]; // match ANY (lowercase compare)
  stockKeywords?: string[]; // optional branch (unused here, left for future)
}>> = {
  // INC5200001 — POS1 Receipt Printer - No Power
  INC5200001: [
    {
      ask: "The POS1 receipt printer won't power on at our store.",
      keywords: ["printer", "pos1", "receipt", "won't", "start"]
    },
    {
      ask: "Can you give me the power and cable troubleshooting steps?",
      keywords: ["resolve", "fix", "steps", "power", "cable", "brick", "outlet"]
    },
    {
      ask: "I need to create a ticket.",
      keywords: ["create", "ticket", "report", "new", "submit", "open", "issue"]
    },
    {
      ask: "PC101, Printer not powering on",
      keywords: ["pc", "101"]
    },
    {
      ask: "System 102",
      keywords: ["system", "102"]
    },
    {
      ask: "Computer 103",
      keywords: ["computer", "103"]
    },
    {
      ask: "Unable to add a user in CrunchTime — no locations appear.",
      keywords: ["crunchtime", "user", "add", "locations", "appear", "network", "enterprise"]
    }
  ],

  // INC5200002 — POS21 Receipt Printer - Not Feeding Paper
  INC5200002: [
    {
      ask: "POS21 receipt printer won't feed paper and the red error light is blinking.",
      keywords: ["printer", "paper", "feed", "pos21", "error", "blinking"]
    },
    {
      ask: "What steps should I try for the jams and red light indicators?",
      keywords: ["resolve", "fix", "steps",  "jam", "light",  "indicator", "cutter"]
    },
    {
      ask: "I need to create a ticket",
      keywords: ["create", "ticket", "pos21", "paper", "feed", "issue", "report"]
    },
    {
      ask: "PC201, Paper get's jammed",
      keywords: ["pc", "201"]
    },
    {
      ask: "System 202",
      keywords: ["system", "202"]
    },
    {
      ask: "Computer 203",
      keywords: ["computer", "203"]
    },
    {
      ask: "Employee can't log in after setup — what should I check?",
      keywords: ["employee", "login",  "setup", "check", "oracle", "crunchtime", "emc", "sync"]
    }
  ],

  // INC5200003 — POS2 Receipt Printer - Incorrect Port Mapping
  INC5200003: [
    {
      ask: "POS2 printer is detected but print jobs are failing ",
      keywords: ["printer", "pos2", "detected", "fail", "jobs", "port"]
    },
    {
      ask: "Give me driver troubleshooting steps .",
      keywords: ["give",  "driver", "troubleshooting", "steps", "settings", "usb", "com"]
    },
    {
      ask: "I need to create a ticket",
      keywords: ["create", "ticket",   "configuration", "issue", "report"]
    },
    {
      ask: "PC301 , Incorrect Port mapping",
      keywords: ["pc", "301"]
    },
    {
      ask: "System 302",
      keywords: ["system", "302"]
    },
    {
      ask: "Computer 303",
      keywords: ["computer", "303"]
    }
  ],

  // INC5200004 — Cash Drawer Fault — Applied EMC Workaround
  INC5200004: [
    {
      ask: "Our cash drawer sensor is failing can you help?",
      keywords: ["cash", "drawer", "sensor", "failing", "emc"]
    },
    {
      ask: "What are the troubleshooting steps and What's the workaround procedure?",
      keywords: ["troubleshooting", "steps","resolve", "fix", "steps", "emc", "workaround", "procedure", "p1535"]
    },
    {
      ask: "I need to create a ticket for this issue.",
      keywords: ["create", "ticket", "cash", "drawer", "sensor", "issue", "report"]
    },
    {
      ask: "PC401 , drawer sensor is failing",
      keywords: ["pc", "401"]
    },
    {
      ask: "System 402",
      keywords: ["system", "402"]
    },
    {
      ask: "Computer 403",
      keywords: ["computer", "403"]
    }
  ],

  // INC5200005 — KDS2 Receipt Printer - Faded Receipts
  INC5200005: [
    {
      ask: "KDS2 printer receipts are very light and unreadable during rush.",
      keywords: ["kds2", "printer", "receipts", "light", "unreadable", "rush"]
    },
    {
      ask: "What are the troubleshooting steps and how do I fix it",
      keywords: ["troubleshooting","step", "resolve", "fix", "steps",  "thermal", "paper", "head", "quality"]
    },
    {
      ask: "I need to create a ticket for this issue.",
      keywords: ["create", "ticket",  "quality", "issue", "report"]
    },
    {
      ask: "PC501 Faded Receipts",
      keywords: ["pc", "501"]
    },
  ],

  // INC5200006 — Device Unreachable — POS Switch Rack 1
  INC5200006: [
    {
      ask: "Multiple POS terminals are offline and the switch in Rack 1 is unreachable.",
      keywords: ["pos", "POS",  "terminals", "offline",  "rack", "unreachable"]
    },
    {
      ask: "What network troubleshooting steps should I try first?",
      keywords: ["troubleshooting", "resolve", "fix", "steps",  "power", "cable", "uplink"]
    },
    {
      ask: "I need to create a ticket for this POS switch network issue.",
      keywords: ["create", "ticket",  "issue", "report"]
    },
    {
      ask: "PC601 Device Unreachable",
      keywords: ["pc", "601"]
    },
  ],
};