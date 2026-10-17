// Adaptador de GitHub: lectura pública de los releases de un repositorio para las descargas (L14; sin token). El repositorio debe
// ser público. La respuesta se valida: lo que no tenga la forma esperada no se cuenta.
import * as z from 'zod';

const ReleasesBody = z.array(
	z.object({ assets: z.array(z.object({ download_count: z.number().int().nonnegative() })) })
);

export async function fetchPublicReleases(repo: string): Promise<z.infer<typeof ReleasesBody>> {
	const response = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, {
		headers: { accept: 'application/vnd.github+json', 'user-agent': 'cuenta-mardomingo-stats' }
	});
	if (!response.ok) throw new Error(`GitHub respondió ${String(response.status)} para ${repo}`);
	return ReleasesBody.parse(await response.json());
}
