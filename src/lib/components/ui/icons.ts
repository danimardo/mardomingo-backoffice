// Iconos de la interfaz de cuenta (ADR 0009, T456). El nombre es la API pública de `Icon`; cada uno se
// resuelve a un icono de `@lucide/svelte` importado por su ruta individual, para que el bundler solo
// incluya los usados (nunca `import * as` ni el índice del paquete; lo impide ESLint).
import type { Component } from 'svelte';
import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
import ArrowRight from '@lucide/svelte/icons/arrow-right';
import Check from '@lucide/svelte/icons/check';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import Clock from '@lucide/svelte/icons/clock';
import Copy from '@lucide/svelte/icons/copy';
import Edit from '@lucide/svelte/icons/pencil';
import ExternalLink from '@lucide/svelte/icons/external-link';
import Filter from '@lucide/svelte/icons/funnel';
import Home from '@lucide/svelte/icons/house';
import Info from '@lucide/svelte/icons/info';
import Refresh from '@lucide/svelte/icons/refresh-cw';
import Search from '@lucide/svelte/icons/search';
import Settings from '@lucide/svelte/icons/settings';
import Shield from '@lucide/svelte/icons/shield-check';
import Trash from '@lucide/svelte/icons/trash-2';
import History from '@lucide/svelte/icons/history';
import Layers from '@lucide/svelte/icons/layers';
import Lock from '@lucide/svelte/icons/lock';
import Receipt from '@lucide/svelte/icons/receipt';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Support from '@lucide/svelte/icons/life-buoy';
import User from '@lucide/svelte/icons/user-round';
import Wallet from '@lucide/svelte/icons/wallet';
import X from '@lucide/svelte/icons/x';
import XCircle from '@lucide/svelte/icons/circle-x';

/** Props que `Icon` pasa al icono de Lucide. */
export interface LucideProps {
	size?: number | string;
	strokeWidth?: number | string;
	'aria-hidden'?: 'true' | 'false' | boolean;
	'aria-label'?: string;
	role?: string;
	focusable?: string;
	[key: string]: unknown;
}

const ICON_TABLE = Object.freeze({
	check: Check,
	'alert-triangle': AlertTriangle,
	'x-circle': XCircle,
	info: Info,
	close: X,
	search: Search,
	'chevron-down': ChevronDown,
	'external-link': ExternalLink,
	'arrow-right': ArrowRight,
	shield: Shield,
	settings: Settings,
	home: Home,
	clock: Clock,
	refresh: Refresh,
	copy: Copy,
	edit: Edit,
	trash: Trash,
	filter: Filter,
	history: History,
	layers: Layers,
	lock: Lock,
	receipt: Receipt,
	sparkles: Sparkles,
	support: Support,
	user: User,
	wallet: Wallet
} as const);

export type IconName = keyof typeof ICON_TABLE;

export const ICONS: Readonly<Record<IconName, Component<LucideProps>>> = ICON_TABLE;
