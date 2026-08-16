"""Sensor platform for the Metroenergies (Unofficial) integration.

The sensor(s) below are placeholders: once the real data shape returned
by MetroenergiesApiClient.async_get_data() is known, adjust the keys,
device_class, state_class and unit_of_measurement accordingly so the
values plot correctly as a graph / feed the Energy dashboard.
"""
from __future__ import annotations

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import MetroenergiesDataUpdateCoordinator

SENSOR_KEY_CONSUMPTION = "consumption"


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up sensors from a config entry."""
    coordinator: MetroenergiesDataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]

    async_add_entities([MetroenergiesConsumptionSensor(coordinator, entry)])


class MetroenergiesConsumptionSensor(
    CoordinatorEntity[MetroenergiesDataUpdateCoordinator], SensorEntity
):
    """Placeholder sensor exposing a consumption value from metroenergies.fr."""

    _attr_has_entity_name = True
    _attr_device_class = SensorDeviceClass.ENERGY
    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_native_unit_of_measurement = "kWh"
    _attr_translation_key = SENSOR_KEY_CONSUMPTION

    def __init__(
        self,
        coordinator: MetroenergiesDataUpdateCoordinator,
        entry: ConfigEntry,
    ) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_{SENSOR_KEY_CONSUMPTION}"

    @property
    def native_value(self):
        """Return the current value from the coordinator's data."""
        return (self.coordinator.data or {}).get(SENSOR_KEY_CONSUMPTION)
