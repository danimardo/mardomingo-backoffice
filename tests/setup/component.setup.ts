// Preparación de las pruebas de componente: limpia el DOM entre pruebas (Testing Library sin globales de Vitest).
import { cleanup } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

afterEach(() => {
	cleanup();
});
