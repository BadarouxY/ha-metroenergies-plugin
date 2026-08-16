"""Client for retrieving data from metroenergies.fr.

This integration is not affiliated with or endorsed by Metroenergies.
It works by reproducing the requests made by a browser session against
the site, since no official public API is provided.
"""
from __future__ import annotations

import logging

import aiohttp

_LOGGER = logging.getLogger(__name__)


class MetroenergiesApiError(Exception):
    """Raised when a call to metroenergies.fr fails."""


class MetroenergiesAuthError(MetroenergiesApiError):
    """Raised when authentication against metroenergies.fr fails."""


class MetroenergiesApiClient:
    """Handles authentication and data retrieval from metroenergies.fr."""

    def __init__(
        self,
        session: aiohttp.ClientSession,
        username: str,
        password: str,
    ) -> None:
        self._session = session
        self._username = username
        self._password = password

    async def async_login(self) -> None:
        """Authenticate against metroenergies.fr.

        TODO: implement the real login flow once it is known
        (endpoint, payload, CSRF token, cookies, etc.).
        """
        raise NotImplementedError

    async def async_get_data(self) -> dict:
        """Fetch the latest data from metroenergies.fr.

        TODO: implement the real scraping/request logic and return
        a dict of values keyed by sensor id.
        """
        raise NotImplementedError
