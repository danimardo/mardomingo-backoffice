// Audio WAV real para las pruebas HTTP (T187): PCM de 16 bits, mono y 8 kHz, en silencio. ffprobe lee la duración de su
// cabecera, así que el servidor construido (con ffprobe y ffmpeg reales) lo puede medir y convertir. El tamaño es de
// 16 KB por segundo: 300 s ocupan unos 4,6 MB, por debajo de la subida máxima.

const SAMPLE_RATE = 8_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

/** Un WAV de silencio de `seconds` segundos. */
export function silentWav(seconds: number): Uint8Array {
	const samples = Math.round(seconds * SAMPLE_RATE);
	const dataSize = samples * CHANNELS * (BITS_PER_SAMPLE / 8);
	const buffer = Buffer.alloc(44 + dataSize);
	buffer.write('RIFF', 0);
	buffer.writeUInt32LE(36 + dataSize, 4);
	buffer.write('WAVE', 8);
	buffer.write('fmt ', 12);
	buffer.writeUInt32LE(16, 16);
	buffer.writeUInt16LE(1, 20);
	buffer.writeUInt16LE(CHANNELS, 22);
	buffer.writeUInt32LE(SAMPLE_RATE, 24);
	buffer.writeUInt32LE((SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE) / 8, 28);
	buffer.writeUInt16LE((CHANNELS * BITS_PER_SAMPLE) / 8, 32);
	buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
	buffer.write('data', 36);
	buffer.writeUInt32LE(dataSize, 40);
	return new Uint8Array(buffer);
}
