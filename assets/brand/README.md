# Brand assets

Icônes/logo destinés à la soumission au dépôt communautaire
[home-assistant/brands](https://github.com/home-assistant/brands), pour que
HACS et Home Assistant affichent une icône pour cette intégration.

- `icon.png` (256×256) / `icon@2x.png` (512×512) : le symbole seul (éclair),
  fond transparent.
- `logo.png` / `logo@2x.png` : logo complet ("METROENERGIES unofficial"),
  fond transparent.
- `source/original.png` : image source fournie par l'utilisateur, non
  destinée à être soumise telle quelle.

## Pour soumettre

1. Fork de https://github.com/home-assistant/brands
2. Copier `icon.png`, `icon@2x.png`, `logo.png`, `logo@2x.png` dans
   `custom_integrations/metroenergies_unofficial/` du fork (le nom du
   dossier doit correspondre exactement au `domain` du `manifest.json`).
3. Ouvrir une pull request vers `home-assistant/brands`.
4. Une fois mergée, HACS et Home Assistant afficheront l'icône
   automatiquement (peut prendre un peu de temps après le merge, le temps
   que le CDN des brands se mette à jour).
