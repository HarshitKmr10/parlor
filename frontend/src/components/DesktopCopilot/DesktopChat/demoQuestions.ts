export const demoQuestions: Record<string, Array<{
  ask: string;        // example user message
  keywords: string[]; // match ANY (lowercase compare)
  stockKeywords?: string[]; // optional branch (unused here, left for future)
}>> = {
  // INC0128768 — Boarding pass scan @ Gate 42
  INC0128768: [
    {
      ask: "I'm having trouble scanning the boarding pass at Gate 42.",
      keywords: ["issue", "scan", "boarding", "reader", "barcode", "qr", "gate"]
    },
    {
      ask: "How can I fix this quickly—can you give steps to reset Wi-Fi and relaunch the app?",
      keywords: ["resolve", "fix", "steps", "help", "reset", "relaunch", "portal", "time"]
    },
    {
      ask: "It still fails—can you schedule a technician?",
      keywords: ["yes", "worked", "still", "fail", "schedule", "onsite", "dispatch"]
    }
  ],

  // INC0140258 — Wi-Fi can't connect at Gate 30
  INC0140258: [
    {
      ask: "I can’t connect to the Wi-Fi at Gate 30.",
      keywords: ["wifi", "connect", "internet", "gate", "portal", "ssid"]
    },
    {
      ask: "Please share the steps to fix it (captive portal/DNS).",
      keywords: ["resolve", "fix", "steps", "flush", "portal", "forget", "rejoin", "dns"]
    },
    {
      ask: "Still not working—can you open an onsite/NetOps request?",
      keywords: ["yes", "worked", "still", "fail", "schedule", "onsite", "netops"]
    }
  ],

  // INC0140983 — Can't connect to company network
  INC0140983: [
    {
      ask: "I can’t reach the company network/VPN from my laptop.",
      keywords: ["network", "company", "vpn", "intranet", "connect", "access"]
    },
    {
      ask: "Can you send me the VPN/DNS reset steps?",
      keywords: ["resolve", "fix", "steps", "vpn", "dns", "profile", "adapter", "reset"]
    },
    {
      ask: "No change—please arrange a tech for NIC/cable/port.",
      keywords: ["yes", "worked", "still", "fail", "schedule", "onsite", "nic", "cable", "port"]
    }
  ],

  // INC0146034 — Zscaler shows “Disabled” in office (Dalian)
  INC0146034: [
    {
      ask: "Zscaler shows ‘Disabled’ when I’m on the office network in Dalian.",
      keywords: ["zscaler", "disable", "disabled", "office", "dalian", "tunnel"]
    },
    {
      ask: "How do I reset or reinstall the Zscaler client?",
      keywords: ["resolve", "fix", "steps", "reinstall", "reset", "service", "driver"]
    },
    {
      ask: "Still broken—can you book a desk-side check?",
      keywords: ["yes", "worked", "still", "fail", "schedule", "onsite", "desk", "dispatch"]
    }
  ],

  // INC0140515 — Can't connect to Zscaler VPN
  INC0140515: [
    {
      ask: "I can’t connect to the Zscaler VPN.",
      keywords: ["zscaler", "vpn", "connect", "login", "tunnel", "auth"]
    },
    {
      ask: "Can you give me the SSO and credential cache refresh steps?",
      keywords: ["resolve", "fix", "steps", "sso", "cache", "cred", "policy"]
    },
    {
      ask: "Still failing—please escalate for cert/policy push or onsite.",
      keywords: ["yes", "worked", "still", "fail", "schedule", "onsite", "cert", "policy"]
    }
  ],

  // INC0146287 — No internet ~1 hour
  INC0146287: [
    {
      ask: "I’ve had no internet on my device for about an hour.",
      keywords: ["internet", "down", "outage", "no", "offline", "disconnect"]
    },
    {
      ask: "Send endpoint repair steps (renew IP/driver test).",
      keywords: ["resolve", "fix", "steps", "renew", "driver", "ipconfig", "adapter"]
    },
    {
      ask: "Still offline—please schedule onsite for AP/switch.",
      keywords: ["yes", "worked", "still", "fail", "schedule", "onsite", "ap", "switch", "uplink"]
    }
  ],
};