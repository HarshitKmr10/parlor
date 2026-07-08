# Connector setup — OAuth apps & SSO

Step-by-step instructions for a self-hoster to create the OAuth
apps/credentials this codebase actually expects. Every scope, redirect URI,
and env var below is read directly from the implementation (`backend/src/api/
product/calendar_oauth.py`, `backend/src/sso/oidc.py`) — not generic OAuth
boilerplate. See `docs/API-CONTRACT.md` for the corresponding API routes.

All of this is optional: the stack boots fine with none of it configured
(calendar `connect` returns `501 calendar_provider_not_configured`; SSO
`/status` returns `enabled: false`).

---

## 1. Google Calendar OAuth

What the backend requests, verified against `calendar_oauth.py`:

- **Scopes**: `openid email https://www.googleapis.com/auth/calendar.readonly`
- **Authorize URL**: `https://accounts.google.com/o/oauth2/v2/auth`
- **Token URL**: `https://oauth2.googleapis.com/token`
- **Userinfo URL**: `https://openidconnect.googleapis.com/v1/userinfo`
- **Redirect URI pattern**: `{CALENDAR_OAUTH_REDIRECT_BASE}/api/v1/calendar/callback/google`
- Always requests `access_type=offline&prompt=consent` so a refresh token comes back on every connect (needed for the calendar poller to keep working after the access token expires).

### Steps

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create a project (or pick an existing one), then **Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Name: anything (e.g. "Parlor calendar connect").
3. Under **Authorized redirect URIs**, add exactly:
   - Dev: `http://localhost:8001/api/v1/calendar/callback/google` (matches the default `API_PORT=8001` in `.env.example`; adjust the port if you changed it)
   - Prod: `https://<your-domain>/api/v1/calendar/callback/google`
   - This must match `CALENDAR_OAUTH_REDIRECT_BASE` + the fixed suffix exactly — the backend builds the redirect URI itself (`redirect_uri()` in `calendar_oauth.py`), so there's no separate "redirect URI" env var to independently misconfigure.
4. Enable the **Google Calendar API** for the project (APIs & Services → Library → search "Google Calendar API" → Enable). The `calendar.readonly` scope requires it.
5. If your app is in "Testing" publish status, add the accounts that will connect calendars as **Test users**, or submit for verification if you plan to go beyond a handful of internal users (Google's consent screen otherwise blocks non-test users from unverified apps requesting calendar scopes).
6. Copy the **Client ID** and **Client Secret** into your env:
   ```
   GOOGLE_CLIENT_ID=<client id>
   GOOGLE_CLIENT_SECRET=<client secret>
   CALENDAR_OAUTH_REDIRECT_BASE=http://localhost:8001   # or your public https origin
   ```
7. Restart the backend. `GET /api/v1/calendar/connect/google` (authenticated) now 302s to Google's consent screen instead of 501.

---

## 2. Microsoft / Azure AD Calendar OAuth

What the backend requests, verified against `calendar_oauth.py`:

- **Scopes**: `openid email offline_access Calendars.Read`
- **Authorize URL**: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
- **Token URL**: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
- **Userinfo URL**: `https://graph.microsoft.com/v1.0/me` (Microsoft Graph)
- **Redirect URI pattern**: `{CALENDAR_OAUTH_REDIRECT_BASE}/api/v1/calendar/callback/microsoft`
- Uses the **`common`** multi-tenant authority — this app registration accepts both personal Microsoft accounts and any Azure AD (work/school) tenant's users, not just one organization's directory.

### Steps

1. Go to the [Azure Portal → Azure Active Directory → App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) → **New registration**.
2. Name it (e.g. "Parlor calendar connect").
3. Under **Supported account types**, choose **Accounts in any organizational directory and personal Microsoft accounts** — this matches the `common` authority the code hard-codes. If you pick a single-tenant option instead, authorization for accounts outside that tenant will fail even though the code doesn't restrict it.
4. Under **Redirect URI**, choose platform **Web** and add exactly:
   - Dev: `http://localhost:8001/api/v1/calendar/callback/microsoft`
   - Prod: `https://<your-domain>/api/v1/calendar/callback/microsoft`
5. After creation, go to **Certificates & secrets → New client secret**. Copy the secret **value** immediately (it's hidden after you navigate away).
6. Go to **API permissions → Add a permission → Microsoft Graph → Delegated permissions**, and add:
   - `openid`, `email` (usually pre-granted under "User.Read"-adjacent defaults, but confirm they're listed)
   - `offline_access`
   - `Calendars.Read`
   Grant admin consent if your tenant requires it for `Calendars.Read`.
7. Copy the **Application (client) ID** and the secret value into your env:
   ```
   MS_CLIENT_ID=<application (client) id>
   MS_CLIENT_SECRET=<client secret value>
   CALENDAR_OAUTH_REDIRECT_BASE=http://localhost:8001   # or your public https origin
   ```
8. Restart the backend. `GET /api/v1/calendar/connect/microsoft` (authenticated) now 302s to Microsoft's consent screen instead of 501.

> Note: `.env.example` also lists `MS_TENANT_ID` and `GOOGLE_REDIRECT_URI` under a legacy/duplicate block — neither is read by `calendar_oauth.py` today (the redirect URI is always derived from `CALENDAR_OAUTH_REDIRECT_BASE`, and the authority is hard-coded to `common`). Only `MS_CLIENT_ID` / `MS_CLIENT_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `CALENDAR_OAUTH_REDIRECT_BASE` have any effect.

---

## 3. Generic OIDC SSO (Okta, Azure AD, or any OIDC-compliant IdP)

The backend implements plain OAuth2 authorization-code + OIDC userinfo — it
is **not** tied to one vendor's SDK (`backend/src/sso/oidc.py`). Any IdP that
exposes standard authorize/token/userinfo endpoints works, including Okta,
Azure AD / Entra ID, and Google Workspace. Configure exactly one IdP per
deployment via env vars; there's no per-workspace SSO config today.

Required env vars (`oidc_config_from_env()` treats SSO as disabled — `GET
/api/v1/auth/sso/status` returns `enabled: false` — unless **all** of these
are set):

```
SSO_OIDC_CLIENT_ID=
SSO_OIDC_CLIENT_SECRET=
SSO_OIDC_AUTHORIZE_URL=
SSO_OIDC_TOKEN_URL=
SSO_OIDC_USERINFO_URL=
SSO_OIDC_REDIRECT_URI=
```

Optional:

```
SSO_OIDC_ISSUER=            # informational only, not verified against tokens
SSO_OIDC_PROVIDER=oidc      # label returned by /status, e.g. "okta"
SSO_OIDC_SCOPES=openid email profile   # default; must include "openid email" at minimum
```

The redirect URI you register with the IdP must point at wherever the **web
app** handles the SSO callback and then calls `POST /api/v1/auth/sso/exchange`
with the `code`/`state` it received — `SSO_OIDC_REDIRECT_URI` must match that
web-app callback route byte-for-byte (it's compared by the IdP, not by this
backend). Use your web app's own callback path, e.g.
`https://<your-domain>/auth/sso/callback`.

The IdP's userinfo response **must** include an `email` claim
(`profile_from_userinfo()` in `oidc.py` rejects the exchange with
`sso_no_email` otherwise); `name` or `preferred_username` are used for
display name if present, falling back to the email's local part.

### 3a. Okta example

1. In the Okta Admin Console: **Applications → Applications → Create App Integration**.
2. Sign-in method: **OIDC - OpenID Connect**. Application type: **Web Application**.
3. **Sign-in redirect URIs**: add your web app's callback, e.g. `https://<your-domain>/auth/sso/callback`.
4. Assign the app to the users/groups who should get SSO access.
5. After creation, note the **Client ID** and **Client secret** (General tab / Client Credentials).
6. Find your Okta org's OIDC endpoints under **Security → API → Authorization Servers** (or the default org authorization server) — they follow the pattern:
   - Authorize: `https://<okta-domain>/oauth2/default/v1/authorize` (or `https://<okta-domain>/oauth2/v1/authorize` for the org-level default)
   - Token: `https://<okta-domain>/oauth2/default/v1/token`
   - Userinfo: `https://<okta-domain>/oauth2/default/v1/userinfo`
   - Issuer: `https://<okta-domain>/oauth2/default`
   (Confirm the exact paths from your org's `/.well-known/openid-configuration` discovery document — Okta's URL shape varies between the "default" custom authorization server and org-level authorization.)
7. Set:
   ```
   SSO_OIDC_CLIENT_ID=<client id>
   SSO_OIDC_CLIENT_SECRET=<client secret>
   SSO_OIDC_AUTHORIZE_URL=https://<okta-domain>/oauth2/default/v1/authorize
   SSO_OIDC_TOKEN_URL=https://<okta-domain>/oauth2/default/v1/token
   SSO_OIDC_USERINFO_URL=https://<okta-domain>/oauth2/default/v1/userinfo
   SSO_OIDC_ISSUER=https://<okta-domain>/oauth2/default
   SSO_OIDC_REDIRECT_URI=https://<your-domain>/auth/sso/callback
   SSO_OIDC_PROVIDER=okta
   ```

### 3b. Azure AD / Entra ID example

1. [Azure Portal → Azure Active Directory → App registrations → New registration].
2. Supported account types: pick per your org's needs (single-tenant is fine for SSO, unlike the calendar app above which needs multi-tenant).
3. **Redirect URI**: platform **Web**, value = your web app's callback, e.g. `https://<your-domain>/auth/sso/callback`.
4. **Certificates & secrets → New client secret** — copy the value immediately.
5. **API permissions**: default `User.Read` (Microsoft Graph, delegated) is enough for `openid email profile` claims; add it if not already present.
6. Endpoints (from the app's **Endpoints** panel, or `https://login.microsoftonline.com/<tenant-id>/v2.0/.well-known/openid-configuration`):
   ```
   SSO_OIDC_CLIENT_ID=<application (client) id>
   SSO_OIDC_CLIENT_SECRET=<client secret value>
   SSO_OIDC_AUTHORIZE_URL=https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/authorize
   SSO_OIDC_TOKEN_URL=https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token
   SSO_OIDC_USERINFO_URL=https://graph.microsoft.com/oidc/userinfo
   SSO_OIDC_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
   SSO_OIDC_REDIRECT_URI=https://<your-domain>/auth/sso/callback
   SSO_OIDC_PROVIDER=azure-ad
   ```
   Use `https://graph.microsoft.com/oidc/userinfo` (the OIDC-flavored userinfo endpoint), not the general Graph `/me` endpoint used by the *calendar* integration above — it's a different response shape and this is the one that reliably returns an `email` claim for the OIDC login flow.

> Google Workspace as an SSO IdP works the same way via Google's standard
> OIDC discovery document (`https://accounts.google.com/.well-known/openid-configuration`):
> `SSO_OIDC_AUTHORIZE_URL=https://accounts.google.com/o/oauth2/v2/auth`,
> `SSO_OIDC_TOKEN_URL=https://oauth2.googleapis.com/token`,
> `SSO_OIDC_USERINFO_URL=https://openidconnect.googleapis.com/v1/userinfo`,
> `SSO_OIDC_SCOPES=openid email profile`. This is a **separate** OAuth client
> registration from the Google Calendar one in section 1 — don't reuse the
> same client ID/secret for both, since the calendar app's redirect URI and
> scopes are backend-owned while the SSO app's redirect URI is web-app-owned.
