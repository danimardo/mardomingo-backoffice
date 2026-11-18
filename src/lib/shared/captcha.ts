// Acción del widget de Turnstile del registro (C-25). El formulario la fija en `data-action` y el verificador del servidor
// exige la misma en la respuesta de siteverify: un token obtenido en otro formulario del mismo sitio no sirve aquí.
export const REGISTER_CAPTCHA_ACTION = 'register';
