"""Client for retrieving data from metroenergies.fr.

This integration is not affiliated with or endorsed by Metroenergies.
It reproduces the requests made by the metroenergies.fr web app, since no
official public API is provided.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import aiohttp
from homeassistant.util import dt as dt_util

from .const import WEATHER_LATITUDE, WEATHER_LONGITUDE

_LOGGER = logging.getLogger(__name__)

LOGIN_URL = "https://www.metroenergies.fr/S2G-MT-Usager-Back/rest/mt/usager/account/login"
EXPORT_URL = "https://www.metroenergies.fr/S2G-MT-Usager-Back/rest/mt/usager/conso/exporter"
WEATHER_URL = "https://archive-api.open-meteo.com/v1/archive"

REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=30)

# The site does not expose a "since account creation" query, so we ask from
# a fixed date far before any real contract could have started; the site
# just returns whatever history actually exists after that, whatever the
# account's age.
HISTORY_START = datetime(2010, 1, 1, tzinfo=timezone.utc)


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

    async def _async_login(self) -> str:
        """Log in and return the session token."""
        headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json, text/plain, */*",
            "Origin": "https://www.metroenergies.fr",
            "Referer": "https://www.metroenergies.fr/home",
        }
        payload = {"username": self._username, "password": self._password}

        try:
            resp = await self._session.post(
                LOGIN_URL, headers=headers, data=payload, timeout=REQUEST_TIMEOUT
            )
        except aiohttp.ClientError as err:
            raise MetroenergiesApiError(f"Cannot reach metroenergies.fr: {err}") from err

        if resp.status in (401, 403):
            raise MetroenergiesAuthError("Invalid username or password")
        if resp.status != 200:
            raise MetroenergiesApiError(f"Login failed with status {resp.status}")

        data = await resp.json(content_type=None)
        for item in data.get("response", []):
            token = item.get("tokenID")
            if token:
                return token

        raise MetroenergiesAuthError("Login response did not contain a token")

    async def async_login(self) -> None:
        """Validate the configured credentials (used by the config flow)."""
        await self._async_login()

    async def _async_get_temperatures(
        self, start_date: str, end_date: str
    ) -> dict[str, float]:
        """Fetch daily mean outdoor temperature for Grenoble from Open-Meteo.

        start_date/end_date are the first and last dates actually present
        in the consumption history (as "YYYY-MM-DD" strings), not a fixed
        window: there is no point asking Open-Meteo for temperatures on
        days metroenergies.fr has no consumption for (either before the
        contract started, or the last day or two if it hasn't finished
        aggregating yet) since async_get_data only ever looks up a date
        that's already a history entry - anything else is wasted payload.

        Best-effort enrichment, not the integration's core data: Open-Meteo
        is a separate free/keyless service from metroenergies.fr itself, so
        any failure here is logged and swallowed rather than failing the
        whole update (and with it the consumption sensor) over a weather
        API hiccup. Its ERA5-based archive also lags a few days behind
        today, so the most recent entries may briefly have no temperature
        until a later daily refresh picks it up.
        """
        params = {
            "latitude": WEATHER_LATITUDE,
            "longitude": WEATHER_LONGITUDE,
            "start_date": start_date,
            "end_date": end_date,
            "daily": "temperature_2m_mean",
            "timezone": "Europe/Paris",
        }
        try:
            resp = await self._session.get(
                WEATHER_URL, params=params, timeout=REQUEST_TIMEOUT
            )
            if resp.status != 200:
                raise MetroenergiesApiError(
                    f"Weather fetch failed with status {resp.status}"
                )
            raw = await resp.json(content_type=None)
        except (aiohttp.ClientError, MetroenergiesApiError) as err:
            _LOGGER.warning("Could not fetch outdoor temperature: %s", err)
            return {}

        daily = raw.get("daily", {})
        dates = daily.get("time", [])
        temps = daily.get("temperature_2m_mean", [])
        return {date: temp for date, temp in zip(dates, temps) if temp is not None}

    async def async_get_data(self) -> dict:
        """Fetch and normalize consumption history from metroenergies.fr."""
        token = await self._async_login()

        date_fin = datetime.now(timezone.utc)

        params = {
            "dateDebut": str(int(HISTORY_START.timestamp() * 1000)),
            "dateFin": str(int(date_fin.timestamp() * 1000)),
            "decimalSeparor": ".",
            "fluids": "E",
            "separor": "",
            "format": "json",
        }
        headers = {
            "Authorization": token,
            "Accept": "application/json, text/plain, */*",
        }

        try:
            resp = await self._session.get(
                EXPORT_URL, headers=headers, params=params, timeout=REQUEST_TIMEOUT
            )
        except aiohttp.ClientError as err:
            raise MetroenergiesApiError(f"Cannot reach metroenergies.fr: {err}") from err

        if resp.status != 200:
            raise MetroenergiesApiError(f"Export failed with status {resp.status}")

        raw = await resp.json(content_type=None)

        history: list[dict] = []
        for entry in raw.get("response", []):
            conso = entry.get("conso") or 0
            if not conso:
                continue
            # The API's timestamp represents local midnight (Europe/Paris)
            # for that calendar day. Converting it via UTC directly would
            # shift it to the evening before, flipping the date back by
            # one day - convert to Home Assistant's configured local
            # timezone first instead.
            entry_date = dt_util.as_local(
                dt_util.utc_from_timestamp(entry["date"] / 1000)
            ).strftime("%Y-%m-%d")
            history.append({"date": entry_date, "conso": conso})

        if history:
            temperatures = await self._async_get_temperatures(
                history[0]["date"], history[-1]["date"]
            )
            for entry in history:
                temp = temperatures.get(entry["date"])
                if temp is not None:
                    entry["temp"] = round(temp, 1)

        return {
            "latest": history[-1]["conso"] if history else None,
            "history": history,
        }
