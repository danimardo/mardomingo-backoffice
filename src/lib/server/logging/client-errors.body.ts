// Lectura de un cuerpo con tope (W52): no se confía solo en `content-length`; se corta al pasar del máximo.

/** Texto del cuerpo, o `null` si excede `maxBytes` (por cabecera o leyendo) o no se puede leer. */
export async function readTextCapped(
	request: Pick<Request, 'headers' | 'body'>,
	maxBytes: number
): Promise<string | null> {
	const declared = Number(request.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > maxBytes) return null;
	if (!request.body) return '';

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel();
				return null;
			}
			chunks.push(value);
		}
	} catch {
		return null;
	}
	const decoder = new TextDecoder();
	return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode();
}
