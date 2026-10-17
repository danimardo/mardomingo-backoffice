// Preparación de las pruebas unitarias: semilla fija para fast-check, así una propiedad que falla se repite igual.
import * as fc from 'fast-check';

fc.configureGlobal({ seed: 20261010, numRuns: 200 });
