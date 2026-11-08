# Martina Maiorino — Selected works

Portfolio statico e sfogliabile dedicato a cinque ambiti: Architettura virtuale, Architettura degli interni, Design 1, Design 2 e Futuro architettura.

## Anteprima locale

Servire la cartella con un server HTTP statico. Le preview 3D usano moduli JavaScript e richiedono HTTP oppure HTTPS.

## Preview 3D

Ulisse, NODI e il padiglione hanno un pulsante per attivare un modello interattivo con rotazione, zoom e ripristino della camera. I modelli e il visualizzatore vengono caricati solo alla prima apertura; video e tavole restano sempre disponibili. Durante lo sfoglio si usa un fermo immagine per evitare di duplicare le scene WebGL.

I file `assets/models/*.glb` sono copie web esportate dagli originali Blender, senza modificare i sorgenti. NODI è presentato come studio volumetrico con materiali neutri perché le texture esterne non erano disponibili. I materiali di Ulisse e del padiglione sono adattati al rendering in tempo reale.

`scripts/export-web-model.py` permette di ripetere l'esportazione con Blender in background. La libreria locale model-viewer 4.4.0 è distribuita con licenza Apache 2.0, conservata in `assets/vendor/model-viewer-LICENSE.txt`.

## Pubblicazione

Il workflow `.github/workflows/deploy.yml` pubblica automaticamente il sito su GitHub Pages a ogni push sul branch `main`.
