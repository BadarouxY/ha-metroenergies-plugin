"""The Metroenergies (Unofficial) integration."""
from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.lovelace.const import LOVELACE_DATA, MODE_STORAGE
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_call_later, async_track_time_change
from homeassistant.loader import async_get_integration

from .api import MetroenergiesApiClient
from .const import (
    CONF_PASSWORD,
    CONF_USERNAME,
    DAILY_REFRESH_HOUR,
    DAILY_REFRESH_MINUTE,
    DOMAIN,
)
from .coordinator import MetroenergiesDataUpdateCoordinator

PLATFORMS: list[Platform] = [Platform.SENSOR]

CARD_URL = f"/{DOMAIN}/metroenergies-card.js"
CARD_PATH = Path(__file__).parent / "www" / "metroenergies-card.js"
_FRONTEND_REGISTERED = f"{DOMAIN}_frontend_registered"


async def _async_register_frontend_card(hass: HomeAssistant) -> None:
    """Serve the bundled card and auto-load it, once, for every dashboard.

    Registered as a Lovelace resource rather than via add_extra_js_url:
    Lovelace explicitly waits for its resources to finish loading before it
    creates any card, so the card's custom element is guaranteed to be
    defined in time. add_extra_js_url only injects a <script> tag with no
    such coordination, which races against Lovelace's own card creation --
    a race that faster desktops usually win but slower devices (observed
    consistently on mobile) reliably lose, surfacing as a permanent
    "custom element not found" error.

    Falls back to add_extra_js_url for YAML-mode dashboards, where there is
    no resource storage to register against.
    """
    if hass.data.get(_FRONTEND_REGISTERED):
        return

    integration = await async_get_integration(hass, DOMAIN)
    url = f"{CARD_URL}?v={integration.version}"

    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(CARD_PATH), cache_headers=True)]
    )

    lovelace = hass.data.get(LOVELACE_DATA)
    if lovelace is None or lovelace.resource_mode != MODE_STORAGE:
        add_extra_js_url(hass, url)
    else:
        await _async_register_lovelace_resource(hass, lovelace.resources, url)

    hass.data[_FRONTEND_REGISTERED] = True


async def _async_register_lovelace_resource(
    hass: HomeAssistant, resources: ResourceStorageCollection, url: str
) -> None:
    """Add (or update, on a version bump) our card as a Lovelace resource."""
    path = url.split("?", 1)[0]

    async def _try_register(_now=None) -> None:
        if not resources.loaded:
            async_call_later(hass, 5, _try_register)
            return

        existing = next(
            (r for r in resources.async_items() if r["url"].split("?", 1)[0] == path),
            None,
        )
        if existing is None:
            await resources.async_create_item({"res_type": "module", "url": url})
        elif existing["url"] != url:
            await resources.async_update_item(
                existing["id"], {"res_type": "module", "url": url}
            )

    await _try_register()


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Metroenergies (Unofficial) from a config entry."""
    await _async_register_frontend_card(hass)

    session = async_get_clientsession(hass)
    client = MetroenergiesApiClient(
        session,
        entry.data[CONF_USERNAME],
        entry.data[CONF_PASSWORD],
    )

    coordinator = MetroenergiesDataUpdateCoordinator(hass, entry, client)
    await coordinator.async_config_entry_first_refresh()

    async def _handle_daily_refresh(_now) -> None:
        await coordinator.async_request_refresh()

    entry.async_on_unload(
        async_track_time_change(
            hass,
            _handle_daily_refresh,
            hour=DAILY_REFRESH_HOUR,
            minute=DAILY_REFRESH_MINUTE,
            second=0,
        )
    )

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok
