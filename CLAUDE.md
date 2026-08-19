# Metroenergies (Unofficial) — notes pour Claude

Intégration Home Assistant custom (HACS) qui va chercher la consommation
sur metroenergies.fr (pas d'API officielle — on reproduit les requêtes du
site) et l'affiche via une carte Lovelace custom fournie par l'intégration.

Voir `README.md` pour la doc utilisateur complète (installation, options
de la carte, fréquence de mise à jour). Ce fichier-ci est pour l'agent :
architecture, où sont les pièges déjà corrigés.

## Structure

```
custom_components/metroenergies_unofficial/
  __init__.py       setup de l'entry : enregistre la carte Lovelace, crée le
                     coordinator, planifie le refresh quotidien
  api.py             MetroenergiesApiClient : login + fetch export sur
                     metroenergies.fr
  coordinator.py     DataUpdateCoordinator, pas de polling à intervalle —
                     update_interval=None, refresh déclenché depuis __init__.py
  config_flow.py     Config Flow (login/password) + reauth + reconfigure
  const.py           DOMAIN, clés de config, heure du refresh quotidien
  sensor.py          sensor.metroenergies_unofficial_consommation (attribut
                     `history` = liste de {date, conso})
  www/metroenergies-card.js   carte Lovelace custom (vanilla JS, pas de build)
```

## Pièges déjà corrigés (ne pas réintroduire)

- **Carte Lovelace enregistrée comme resource, pas via `add_extra_js_url`.**
  `add_extra_js_url` injecte juste un `<script>` sans attendre — ça course
  avec la création des cards par Lovelace et perd systématiquement sur
  mobile ("custom element not found"). On enregistre la carte comme
  resource storage (`_async_register_lovelace_resource` dans `__init__.py`),
  avec fallback `add_extra_js_url` seulement en mode YAML (pas de resource
  storage disponible). Voir le docstring de `_async_register_frontend_card`.
- **Cache navigateur sur le fichier de la carte** : l'URL est versionnée
  avec `?v={integration.version}` pour forcer le rechargement après une
  mise à jour — il faut donc bumper `version` dans `manifest.json` à chaque
  changement de `metroenergies-card.js`.
- **Décalage d'un jour sur les dates** : le timestamp de l'API représente
  minuit heure locale Europe/Paris pour le jour concerné. Le convertir
  directement en UTC décale à la veille au soir. Il faut passer par
  `dt_util.as_local(dt_util.utc_from_timestamp(...))` (voir `api.py`).
- **Refresh sur heure fixe, pas sur intervalle glissant** : le site
  n'agrège la conso du jour qu'en fin de journée, donc on interroge une
  fois par jour à 21h30 (heure serveur HA) via `async_track_time_change`,
  pas via `update_interval` du coordinator. Constantes dans `const.py`
  (`DAILY_REFRESH_HOUR`/`MINUTE`).
- **Historique récupéré depuis une date fixe très ancienne** (2010,
  `HISTORY_START` dans `api.py`) plutôt qu'une fenêtre glissante : le site
  ne renvoie que ce qui existe réellement, donc chacun récupère tout son
  historique quel que soit l'âge du contrat.
- **Reauth/reconfigure** : si les identifiants stockés ne marchent plus,
  `MetroenergiesAuthError` → `ConfigEntryAuthFailed` déclenche
  automatiquement le flow de reauth de HA (voir `coordinator.py` et
  `config_flow.async_step_reauth`). Un flow "Reconfigurer" existe aussi
  pour changer les identifiants manuellement à tout moment.

## Conventions du projet

- Pas de tests automatisés, pas de CI de build (juste `.github/`, à
  vérifier si besoin). Vérifier manuellement dans une instance HA si un
  changement touche le config flow, le coordinator ou la carte.
- `custom:metroenergies-card` est en JS vanilla, pas de framework/build
  step — éditer directement `www/metroenergies-card.js`.
- Bumper `version` dans `manifest.json` à chaque changement notable,
  surtout si `metroenergies-card.js` change (cache navigateur, voir
  ci-dessus).
- Ne pas committer/pusher ni créer de tag/release sans que ce soit
  explicitement demandé (voir mémoire `dont-auto-release`).
