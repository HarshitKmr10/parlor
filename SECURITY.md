# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting for this repository:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability**.
3. Describe the issue, the affected component (`backend`, `ai-service`,
   `web`, `desktop-capture`, or `mcp`), and steps to reproduce if possible.

This opens a private advisory visible only to maintainers until a fix is
ready, which is the right channel for anything involving credentials,
authentication/authorization bypass, injection, or data exposure.

If GitHub private reporting isn't enabled on this repository yet, please open
a regular issue titled `[security] contact request` with no vulnerability
details, and a maintainer will follow up with a private channel.

## Scope

This is a self-hosted project — you are responsible for the security of your
own deployment (secrets management, network exposure, TLS termination, etc.).
Reports about the project's own code (the FastAPI backend, the ai-service,
the Next.js web app, the desktop capture client, the MCP server, and the
bundled Docker Compose / Helm packaging) are in scope. Issues that only
apply to a specific self-hosted misconfiguration (e.g., an intentionally
exposed dev-mode default) are still welcome, but may be resolved by
documentation rather than a code change.

Recording-consent compliance is also on the operator: the bot-join feature
(and the botless capture client) record conversations, and consent
requirements vary by jurisdiction. This isn't a security vulnerability class
we track here, but see the README's "Recording consent" section before
enabling bot-join against real calls with other participants.

## Supported versions

This project does not yet maintain long-lived release branches; security
fixes are applied to `main`. If you're running an older commit, please
upgrade before reporting an issue that may already be fixed.
