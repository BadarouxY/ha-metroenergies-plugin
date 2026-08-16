"""Sensor platform for the Metroenergies (Unofficial) integration."""
from __future__ import annotations

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
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
    """Exposes the latest daily consumption, with the full history as an attribute."""

    _attr_has_entity_name = True
    _attr_device_class = SensorDeviceClass.ENERGY
    _attr_state_class = SensorStateClass.TOTAL
    _attr_native_unit_of_measurement = "kWh"
    _attr_translation_key = SENSOR_KEY_CONSUMPTION

    def __init__(
        self,
        coordinator: MetroenergiesDataUpdateCoordinator,
        entry: ConfigEntry,
    ) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_{SENSOR_KEY_CONSUMPTION}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="Metroenergies (Unofficial)",
            manufacturer="Metroenergies (non officiel)",
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def native_value(self):
        """Return the latest day's consumption."""
        return (self.coordinator.data or {}).get("latest")

    @property
    def extra_state_attributes(self):
        """Return the full consumption history for graphing."""
        return {"history": (self.coordinator.data or {}).get("history", [])}
