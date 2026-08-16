"""Data update coordinator for the Metroenergies (Unofficial) integration."""
from __future__ import annotations

import logging

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import MetroenergiesApiClient, MetroenergiesApiError
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


class MetroenergiesDataUpdateCoordinator(DataUpdateCoordinator[dict]):
    """Fetches data from metroenergies.fr.

    No fixed polling interval: an initial fetch happens at setup, and
    further refreshes are triggered once a day at a fixed clock time by
    __init__.py (see DAILY_REFRESH_HOUR/MINUTE in const.py), not on a
    rolling interval from whenever Home Assistant was last restarted.
    """

    def __init__(self, hass: HomeAssistant, client: MetroenergiesApiClient) -> None:
        self.client = client
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=None,
        )

    async def _async_update_data(self) -> dict:
        try:
            return await self.client.async_get_data()
        except MetroenergiesApiError as err:
            raise UpdateFailed(str(err)) from err
