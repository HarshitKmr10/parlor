"""OIDC single sign-on.

Pure helpers (authorize-URL building, state signing, claims->profile mapping)
are unit-tested; the routes wire them to the existing user/session machinery.
Enterprise SAML maps onto the same profile->session path once an IdP is wired.
"""

from .oidc import (
    OidcConfig,
    build_authorize_url,
    oidc_config_from_env,
    profile_from_userinfo,
    sign_state,
    verify_state,
)

__all__ = [
    "OidcConfig",
    "build_authorize_url",
    "oidc_config_from_env",
    "profile_from_userinfo",
    "sign_state",
    "verify_state",
]
