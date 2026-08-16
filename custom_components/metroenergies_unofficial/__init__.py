"""The Metroenergies (Unofficial) integration."""
from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import MetroenergiesApiClient
from .const import CONF_PASSWORD, CONF_USERNAME, DOMAIN
from .coordinator import MetroenergiesDataUpdateCoordinator

PLATFORMS: list[Platform] = [Platform.SENSOR]

CARD_URL = f"/{DOMAIN}/metroenergies-card.js"
CARD_PATH = Path(__file__).parent / "www" / "metroenergies-card.js"
_FRONTEND_REGISTERED = f"{DOMAIN}_frontend_registered"


async def _async_register_frontend_card(hass: HomeAssistant) -> None:
    """Serve the bundled card and auto-load it, once, for every dashboard."""
    if hass.data.get(_FRONTEND_REGISTERED):
        return

    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(CARD_PATH), cache_headers=False)]
    )
    add_extra_js_url(hass, CARD_URL)
    hass.data[_FRONTEND_REGISTERED] = True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Metroenergies (Unofficial) from a config entry."""
    await _async_register_frontend_card(hass)

    session = async_get_clientsession(hass)
    client = MetroenergiesApiClient(
        session,
        entry.data[CONF_USERNAME],
        entry.data[CONF_PASSWORD],
    )

    coordinator = MetroenergiesDataUpdateCoordinator(hass, client)
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok
