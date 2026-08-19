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
  (`history`, liste de `{date, conso, temp}`). `temp` est la température
  extérieure moyenne du jour à Grenoble (source : [Open-Meteo](https://open-meteo.com/),
  gratuit et sans clé) ; elle peut être absente pour les tout derniers
  jours, le temps que leur historique météo se stabilise.
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

- **Mot de passe oublié/changé sur le site** : si les identifiants stockés
  ne fonctionnent plus, Home Assistant déclenche automatiquement un écran
  de ré-authentification (notification "Nouvelle authentification requise"
  sur la carte de l'intégration) pour ressaisir le mot de passe, sans avoir
  à supprimer/recréer l'intégration.
- **Changer l'identifiant/mot de passe manuellement** : menu ⋮ sur
  l'intégration → "Reconfigurer", à tout moment, même si les identifiants
  actuels fonctionnent encore.

## Carte Lovelace

La carte `metroenergies-card` est fournie par l'intégration et s'enregistre
automatiquement — rien à installer en plus. Ajouter au dashboard :

```yaml
type: custom:metroenergies-card
entity: sensor.metroenergies_unofficial_consommation
```

Toutes les options ci-dessous sont aussi réglables sans YAML, via l'éditeur
visuel (bouton "Modifier" sur la carte dans l'éditeur de tableau de bord).

Options disponibles :

| Option | Défaut | Description |
| --- | --- | --- |
| `entity` | *(requis)* | Entité du capteur exposant l'attribut `history`. |
| `unit` | `kWh` | Unité affichée dans les infobulles. |
| `title` | *(absent)* | Titre au-dessus du graphique. Rien n'est affiché si non renseigné. |
| `custom_color` | *(déduit de `color`)* | Active la couleur ci-dessous. Décoché (ou en YAML sans `color` défini), la carte utilise la couleur du thème HA — un `<input type="color">` ne peut jamais être "vide" une fois touché, donc c'est cette case, pas le champ couleur, qui permet de revenir à la couleur par défaut depuis l'éditeur visuel. |
| `color` | `var(--primary-color)` | Couleur des barres, utilisée seulement si `custom_color` est actif. Réglable via le color picker de l'éditeur visuel, ou en YAML avec n'importe quelle valeur CSS (`#e67e22`, variable de thème HA...). |
| `default_period` | `day` | Période initiale : `day`, `month` ou `year`. |
| `days` | `30` | Valeur de départ du nombre de jours en vue "jour" (modifiable ensuite dans la carte, voir plus bas). |
| `months` | `12` | Valeur de départ du nombre de mois en vue "mois". |
| `years` | `5` | Valeur de départ du nombre d'années en vue "année". |
| `show_period_selector` | `true` | Affiche les boutons Jour/Mois/Année. |
| `default_mode` | `rolling` | Mode initial : `rolling` (glissant) ou `range` (plage de dates). |
| `show_mode_selector` | `true` | Affiche les boutons Glissant/Plage et les champs associés (nombre de jours/mois/années, ou dates de début/fin). Si `false`, la carte reste figée sur `default_mode` et les valeurs par défaut (`days`/`months`/`years`), sans aucun contrôle affiché. |

L'axe Y n'est pas configurable : son maximum est toujours recalculé
automatiquement (+15% au-dessus du maximum affiché) plutôt que fixé, pour
ne pas déformer le graphique selon la vue (jour/mois/année) affichée.

- Les boutons **Jour / Mois / Année** dans l'en-tête permettent de changer
  de granularité sans toucher à la config (les vues mois/année agrègent
  l'historique quotidien par somme).
- Les boutons **Glissant / Plage** choisissent comment cette granularité
  est bornée dans le temps :
  - **Glissant** (par défaut) : les N derniers jours/mois/années en
    partant d'aujourd'hui. Le champ numérique à côté permet de taper
    directement ce nombre, sans éditer le YAML (`days`, `months`, `years`
    ne servent alors que de valeurs de départ).
  - **Plage** : deux sélecteurs de date (début/fin) fixent un intervalle
    exact (ex. "l'hiver dernier"), affiché avec la granularité Jour/Mois/
    Année choisie — toutes les barres de l'intervalle sont affichées, pas
    seulement les N dernières.
- Survoler une barre affiche une infobulle avec la date/période et la
  valeur exacte, et la met en surbrillance.
- Le total de toutes les valeurs affichées (somme des barres visibles à
  l'écran) s'affiche sous le graphique.
- L'intégration récupère l'historique complet depuis une date de départ
  fixe très ancienne (`HISTORY_START` dans `api.py`, 1er janvier 2010) :
  le site ne renvoie que ce qui existe réellement, donc chacun récupère
  tout son historique quelle que soit l'ancienneté de son contrat.

## Fréquence de mise à jour

L'intégration ne fait **pas** de polling répété sur un intervalle glissant.
Elle interroge metroenergies.fr :

- une fois immédiatement, au démarrage de Home Assistant ou à l'ajout de
  l'intégration (pour avoir des données sans attendre le prochain 21h30) ;
- puis une fois par jour, à **21h30 heure locale du serveur Home Assistant**,
  heure à laquelle le site a normalement fini d'agréger la consommation du
  jour.

L'heure se change via `DAILY_REFRESH_HOUR` / `DAILY_REFRESH_MINUTE` dans
`const.py`.

## Licence

[MIT](LICENSE)
