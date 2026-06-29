# PSV4.6 micro-patch Bubulle mobile + content-visibility

Base : PSV4.6-low-risk-perf, elle-même basée sur la V4.5.3 stable.

## Changements

- Bubulle masqué sous 768 px via CSS.
- Bubulle non initialisé sous 768 px via early return JS.
- `content-visibility: auto` ajouté sur les grosses sections de l’accueil en mobile.
- Cache-busters CSS/JS mis à jour dans les pages HTML.

## Non modifié

- Aucune structure HTML de rails.
- Aucun JS catalogue.
- Aucun comportement desktop de Bubulle.
- Aucun design global.

## Test conseillé

1. Accueil téléphone : Bubulle absent.
2. Accueil PC : Bubulle présent.
3. Rails horizontaux : toujours OK.
4. Catalogue complet : pagination OK.
5. Détail film : vérifier Bubulle absent mobile / présent PC.
