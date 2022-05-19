

export type Dict<w_value=string> = Record<string, w_value>;

export type UrlString = `${'http' | 'https'}://${string}`;

export interface JsonObject {
	[k: string]: JsonValue | undefined;
}

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| JsonObject
	| undefined;

export interface PrimitiveObject {
	[k: string]: PrimitiveValue | PrimitiveValue[];
}

export type PrimitiveValue =
	| JsonValue
	| Function  // eslint-disable-line @typescript-eslint/ban-types
	| PrimitiveObject
	| PrimitiveValue[];


export type SparqlString = string;

export type SparqlBinding =
	| {
		type: 'uri';
		value: string;
	}
	| {
		type: 'literal';
		value: string;
	}
	| {
		type: 'literal';
		value: string;
		'xml:lang': string;
	}
	| {
		type: 'literal';
		value: string;
		datatype: string;
	}
	| {
		type: 'bnode';
		value: string;
	};

export interface QueryResult {
	type: string;
	value: string;
	datatype?: string;
	'xml:lang'?: string;
}

export type QueryRow = Record<string, QueryResult>;

export interface SparqlBindingMap {
	[variable: string]: SparqlBinding;
}

export type SparqlBindings = Array<SparqlBindingMap>;
