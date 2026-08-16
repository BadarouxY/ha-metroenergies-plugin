"""Config flow for the Metroenergies (Unofficial) integration."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import MetroenergiesApiClient, MetroenergiesAuthError, MetroenergiesApiError
from .const import CONF_PASSWORD, CONF_USERNAME, DOMAIN

_LOGGER = logging.getLogger(__name__)

STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_USERNAME): str,
        vol.Required(CONF_PASSWORD): str,
    }
)


class MetroenergiesConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Metroenergies (Unofficial)."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step: ask for site credentials."""
        errors: dict[str, str] = {}

        if user_input is not None:
            await self.async_set_unique_id(user_input[CONF_USERNAME])
            self._abort_if_unique_id_configured()

            session = async_get_clientsession(self.hass)
            client = MetroenergiesApiClient(
                session,
                user_input[CONF_USERNAME],
                user_input[CONF_PASSWORD],
            )

            try:
                await client.async_login()
            except MetroenergiesAuthError:
                errors["base"] = "invalid_auth"
            except MetroenergiesApiError:
                errors["base"] = "cannot_connect"
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Unexpected error during config flow login")
                errors["base"] = "unknown"
            else:
                return self.async_create_entry(
                    title=user_input[CONF_USERNAME],
                    data=user_input,
                )

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_DATA_SCHEMA,
            errors=errors,
        )
