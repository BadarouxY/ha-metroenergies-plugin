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
  (`history`).
- Une carte Lovelace dédiée (`custom:metroenergies-card`), fournie et
  enregistrée automatiquement par l'intégration — pas besoin d'installer
  une carte tierce.

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

Ajouter une carte au dashboard avec :

```yaml
type: custom:metroenergies-card
entity: sensor.metroenergies_unofficial_consommation
title: Consommation Metroenergies
days: 30
```

## Licence

[MIT](LICENSE)
