// Anuncios del panel (W18; T261; BE-FR-85): un banner por anuncio y el nombre de la app delante cuando lo hay.
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AnnouncementsBanner from './AnnouncementsBanner.svelte';

describe('AnnouncementsBanner', () => {
	it('muestra cada anuncio con el nombre de su app', () => {
		render(AnnouncementsBanner, {
			items: [
				{
					id: 'ann_1',
					level: 'info',
					message: 'Versión nueva disponible',
					appName: 'Secretario AI'
				},
				{ id: 'ann_2', level: 'critical', message: 'Mantenimiento mañana', appName: null }
			]
		});

		expect(screen.getByText(/Secretario AI:/)).toBeInTheDocument();
		expect(screen.getByText(/Versión nueva disponible/)).toBeInTheDocument();
		expect(screen.getByText('Mantenimiento mañana')).toBeInTheDocument();
	});
});
