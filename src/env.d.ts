/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly ROOT_CONTEXT: string;
	readonly SPARQL_ENDPOINT: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}