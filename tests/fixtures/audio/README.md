# Audios de prueba (simulados)

Ficheros pequeños para las pruebas de transcripción (T186). No son WebM reales: la duración y la legibilidad las
deciden los dobles de ffprobe y ffmpeg (`src/lib/server/adapters/*/fake.ts`), y los binarios reales se verifican
aparte (ver informe de L08).

- `corto.webm`: audio normal.
- `sin-duracion.webm`: cabecera sin duración (N/A), como los WebM de MediaRecorder.
- `largo.webm`: supera el máximo de la app.
- `ilegible.webm`: no se puede leer.
