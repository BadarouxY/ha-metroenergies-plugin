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
- Récupération périodique (toutes les 6h) de l'historique de consommation
  depuis metroenergies.fr.
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
- Survoler une barre affiche une infobulle avec la date/période et la
  valeur exacte, et la met en surbrillance.
- La vue "année" est limitée par la fenêtre d'historique récupérée par
  l'intégration (2 ans glissants, voir `HISTORY_WINDOW` dans `api.py`) —
  à étendre si besoin de plus de recul.

## Licence

[MIT](LICENSE)
