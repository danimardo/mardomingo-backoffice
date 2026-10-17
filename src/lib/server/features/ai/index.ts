// API pública de `ai` (ARCHITECTURE.md §4): el chat de la v4 (E07), la vigilancia del catálogo, el arranque y el
// contrato de la ruta. Las demás funcionalidades y las rutas importan solo de aquí.
export {
	DEFAULT_RETRY_POLICY,
	interruptOperationsOnStartup,
	refreshModelCache,
	runChat,
	type AiDeps,
	type ChatContext,
	type RetryPolicy
} from './service';
export { ChatRequestBody, idempotencyKeyOf, type ChatResponseBody } from './contract';
export { consumptionPage, type ConsumptionPage, type ConsumptionRow } from './consumption';
export { exportOperations, type OperationExport } from './export';
export { AI_LOG_EVENTS, type AiLogFields } from './events';
export {
	runTranscription,
	runImage,
	type MediaDeps,
	type AudioUpload,
	type ImageInput
} from './media';
export {
	ImageRequestBody,
	transcriptionFormOf,
	type ImageResponseBody,
	type TranscriptionResponseBody
} from './contract';
export { consumptionRowDto, type ConsumptionRowDto } from './presenters';
export { operationStatsBetween, type OperationStatsFact } from './stats-facts';
export { operationCostFactsBetween, type OperationCostFact } from './cost-facts';
