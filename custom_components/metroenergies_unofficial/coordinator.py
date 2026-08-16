"""Data update coordinator for the Metroenergies (Unofficial) integration."""
from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import MetroenergiesApiClient, MetroenergiesApiError, MetroenergiesAuthError
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


class MetroenergiesDataUpdateCoordinator(DataUpdateCoordinator[dict]):
    """Fetches data from metroenergies.fr.

    No fixed polling interval: an initial fetch happens at setup, and
    further refreshes are triggered once a day at a fixed clock time by
    __init__.py (see DAILY_REFRESH_HOUR/MINUTE in const.py), not on a
    rolling interval from whenever Home Assistant was last restarted.
    """

    def __init__(
        self, hass: HomeAssistant, entry: ConfigEntry, client: MetroenergiesApiClient
    ) -> None:
        self.client = client
        super().__init__(
            hass,
            _LOGGER,
            config_entry=entry,
            name=DOMAIN,
            update_interval=None,
        )

    async def _async_update_data(self) -> dict:
        try:
            return await self.client.async_get_data()
        except MetroenergiesAuthError as err:
            # Lets Home Assistant automatically prompt the user to
            # re-enter their credentials (config_flow.async_step_reauth)
            # instead of just leaving the entity silently unavailable.
            raise ConfigEntryAuthFailed(str(err)) from err
        except MetroenergiesApiError as err:
            raise UpdateFailed(str(err)) from err
