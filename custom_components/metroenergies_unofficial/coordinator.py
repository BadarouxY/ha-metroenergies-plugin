"""Data update coordinator for the Metroenergies (Unofficial) integration."""
from __future__ import annotations

import logging
from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import MetroenergiesApiClient, MetroenergiesApiError
from .const import DEFAULT_SCAN_INTERVAL_MINUTES, DOMAIN

_LOGGER = logging.getLogger(__name__)


class MetroenergiesDataUpdateCoordinator(DataUpdateCoordinator[dict]):
    """Coordinates fetching data from metroenergies.fr on a schedule."""

    def __init__(self, hass: HomeAssistant, client: MetroenergiesApiClient) -> None:
        self.client = client
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(minutes=DEFAULT_SCAN_INTERVAL_MINUTES),
        )

    async def _async_update_data(self) -> dict:
        try:
            return await self.client.async_get_data()
        except MetroenergiesApiError as err:
            raise UpdateFailed(str(err)) from err
