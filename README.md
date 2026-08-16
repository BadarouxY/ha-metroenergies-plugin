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
  (`history`, liste de `{date, conso}`) prêt à être graphé (ex: avec
  [apexcharts-card](https://github.com/RomRider/apexcharts-card)).

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

Cette intégration n'embarque pas sa propre carte de graphique : elle expose
les données et laisse le choix de la carte d'affichage. La carte recommandée
est [apexcharts-card](https://github.com/RomRider/apexcharts-card)
(disponible via HACS, catégorie "Frontend"), qui permet de configurer
finement la plage de jours, les échelles et la mise en surbrillance des
valeurs :

```yaml
type: custom:apexcharts-card
header:
  title: Consommation Metroenergies
graph_span: 2months
series:
  - entity: sensor.metroenergies_unofficial_consommation
    type: column
    name: Consommation
    data_generator: |
      const data = entity.attributes.history || [];
      return data.map(entry => [new Date(entry.date), entry.conso]);
yaxis:
  - min: 0
    decimals: 0
    apex_config:
      labels:
        formatter: |
          EVAL: (val) => `${val} kWh`
apex_config:
  xaxis:
    labels:
      format: dd/MM
```

`graph_span` contrôle la plage affichée (ex: `30d`, `2months`), et le reste
des options d'apexcharts-card (couleurs, seuils, tooltips, zoom...)
s'applique normalement.

## Licence

[MIT](LICENSE)
