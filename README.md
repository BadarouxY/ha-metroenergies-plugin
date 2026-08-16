# Metroenergies (Unofficial) — Home Assistant Integration

Intégration Home Assistant **non officielle** permettant de récupérer des
données depuis [metroenergies.fr](https://metroenergies.fr/) (consommation,
etc.) pour les afficher sous forme de graphique dans Home Assistant.

> ⚠️ **Avertissement** : ce projet n'est ni affilié à, ni soutenu par,
> ni approuvé par Metroenergies. Il fonctionne en reproduisant des requêtes
> normalement effectuées par un navigateur sur le site, faute d'API publique
> officielle. Le site pouvant changer à tout moment, l'intégration peut
> cesser de fonctionner sans préavis. Utilisation à vos propres risques.

## Fonctionnalités

- Configuration via l'interface Home Assistant (Config Flow) avec vos
  identifiants du site.
- Récupération de l'historique de consommation depuis metroenergies.fr
  une fois par jour à heure fixe (21h30), plus une récupération immédiate
  au démarrage/ajout de l'intégration. Voir la section
  [Fréquence de mise à jour](#fréquence-de-mise-à-jour).
- Un capteur `sensor.metroenergies_unofficial_consommation` exposant la
  consommation du dernier jour, avec l'historique complet en attribut
  (`history`, liste de `{date, conso}`).
- Une carte Lovelace dédiée (`custom:metroenergies-card`), fournie et
  enregistrée automatiquement par l'intégration : sélecteur de période
  (jour/mois/année), plage configurable, échelle Y configurable, tooltip
  et mise en surbrillance au survol.

## Installation

### Via HACS (custom repository)

1. Dans HACS, ajouter ce dépôt comme "Custom repository" (catégorie
   Integration).
2. Installer "Metroenergies (Unofficial)".
3. Redémarrer Home Assistant.

### Manuellement

1. Copier le dossier `custom_components/metroenergies_unofficial` dans le
   dossier `custom_components` de votre configuration Home Assistant.
2. Redémarrer Home Assistant.

## Configuration

Paramètres → Appareils et services → Ajouter une intégration →
"Metroenergies (Unofficial)", puis renseigner votre identifiant et mot de
passe du site.

## Carte Lovelace

La carte `metroenergies-card` est fournie par l'intégration et s'enregistre
automatiquement — rien à installer en plus. Ajouter au dashboard :

```yaml
type: custom:metroenergies-card
entity: sensor.metroenergies_unofficial_consommation
title: Consommation
unit: kWh
default_period: day   # day | month | year
days: 30               # nb de jours affichés en vue "day"
months: 12              # nb de mois affichés en vue "month"
years: 5                 # nb d'années affichées en vue "year"
y_min: 0                  # optionnel, sinon calculé automatiquement
y_max: null                # optionnel, sinon calculé automatiquement
show_period_selector: true  # affiche les boutons Jour/Mois/Année
```

- Les boutons **Jour / Mois / Année** dans l'en-tête permettent de changer
  de granularité sans toucher à la config (les vues mois/année agrègent
  l'historique quotidien par somme).
- Le champ numérique à côté des boutons permet de taper directement le
  nombre de jours/mois/années affichés, sans éditer le YAML (`days`,
  `months`, `years` ne servent alors que de valeurs de départ).
- Survoler une barre affiche une infobulle avec la date/période et la
  valeur exacte, et la met en surbrillance.
- L'intégration récupère l'historique complet depuis une date de départ
  fixe très ancienne (`HISTORY_START` dans `api.py`, 1er janvier 2010) :
  le site ne renvoie que ce qui existe réellement, donc chacun récupère
  tout son historique quelle que soit l'ancienneté de son contrat.

## Fréquence de mise à jour

L'intégration ne fait **pas** de polling répété sur un intervalle glissant.
Elle interroge metroenergies.fr :

- une fois immédiatement, au démarrage de Home Assistant ou à l'ajout de
  l'intégration (pour avoir des données sans attendre le prochain 21h30) ;
- puis une fois par jour, à **21h30 heure locale du serveur Home Assistant**
  (`DAILY_REFRESH_HOUR` / `DAILY_REFRESH_MINUTE` dans `const.py`), heure à
  laquelle le site a normalement fini d'agréger la consommation du jour.

Ce comportement reproduit celui du script AppDaemon d'origine (qui tournait
une fois par jour via `run_daily`), plutôt qu'un intervalle de rafraîchissement
classique de type `DataUpdateCoordinator` (ex: toutes les X heures depuis le
dernier redémarrage). Pour changer l'heure, modifier les constantes dans
`const.py`.

## Licence

[MIT](LICENSE)
