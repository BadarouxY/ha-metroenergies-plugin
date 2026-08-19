"""Constants for the Metroenergies (Unofficial) integration."""

DOMAIN = "metroenergies_unofficial"

CONF_USERNAME = "username"
CONF_PASSWORD = "password"

# metroenergies.fr aggregates the day's consumption once it's over, so we
# fetch once a day, shortly before midnight, rather than polling repeatedly.
DAILY_REFRESH_HOUR = 21
DAILY_REFRESH_MINUTE = 30

# Metroenergies is the Grenoble metropolitan heat network, so every account
# is in the Grenoble area regardless of the individual user - no need for a
# per-user location setting for outdoor temperature.
WEATHER_LATITUDE = 45.19
WEATHER_LONGITUDE = 5.72
