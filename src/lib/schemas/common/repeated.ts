// Campo que puede llegar una vez, varias veces o no llegar (p. ej. un grupo de casillas). Siempre lista.
import * as z from 'zod';

export function repeatedField<T extends z.ZodType>(item: T) {
	return z.preprocess((value) => (value === undefined ? [] : [value].flat()), z.array(item));
}
