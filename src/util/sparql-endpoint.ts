import type {
	Dict,
	SparqlBindings,
} from '#/util/types';

import AsyncLockPool from './async-lock-pool';

interface AbortCallback {
	(d_controller: AbortController): void;
}

export interface SparqlEndpointConfig {
	endpoint: string;
	gsp?: string;
	prefixes?: Dict;
	concurrency?: number;
	variables?: Dict;
}

export type SparqlQuery = string | ((k_helper: SparqlQueryHelper) => string);

export class SparqlQueryHelper {
	static iri(p_iri: string): string {
		// prevent injection attacks
		return p_iri.replace(/\s+/g, '+').replace(/>/g, '_');
	}

	static literal(s_value: string, s_lang_or_datatype?: string): string {
		// post modifier
		let s_post = '';
		if(s_lang_or_datatype) {
			// language tag
			if(s_lang_or_datatype.startsWith('@')) {
				s_post = s_lang_or_datatype;
			}
			// datatype
			else {
				s_post = `^^${s_lang_or_datatype}`;
			}
		}

		// escape dirks
		return `"""${s_value.replace(/"/g, '\\"')}"""${s_post}`;
	}

	_h_variables: Dict;

	constructor(h_variables: Dict) {
		this._h_variables = h_variables;
	}

	var(si_key: string, s_default: string | null = null): string {
		if(!(si_key in this._h_variables)) {
			if(null !== s_default) return s_default;
			throw new Error(
				`SPARQL substitution variable not defined: '${si_key}'`
			);
		}
		return this._h_variables[si_key];
	}
}

export class SparqlEndpoint {
	_p_endpoint: string;
	_p_gsp: string;
	_h_prefixes: Dict;
	_kl_fetch: AsyncLockPool;
	_sq_prefixes: string;
	_k_helper: SparqlQueryHelper;

	constructor(gc_init: SparqlEndpointConfig) {
		this._p_endpoint = gc_init.endpoint;
		this._p_gsp = gc_init.gsp || this._p_endpoint+'/gsp/';
		this._h_prefixes = gc_init.prefixes || {};
		this._kl_fetch = new AsyncLockPool(gc_init.concurrency || 1);
		this._sq_prefixes = Object.entries(this._h_prefixes)
			.map(([si_prefix, p_iri]) => `prefix ${si_prefix}: <${p_iri}>\n`)
			.join('');
		this._k_helper = new SparqlQueryHelper(gc_init.variables || {});
	}

	set endpoint(p_endpoint: string) {
		this._p_endpoint = p_endpoint;
	}

	get endpoint(): string {
		return this._p_endpoint;
	}

	set gsp(p_gsp: string) {
		this._p_gsp = p_gsp;
	}

	get gsp(): string {
		return this._p_gsp;
	}

	async auth(): Promise<void> {
		// authenticate to access the named graph
		await fetch(`${this._p_endpoint}/auth`, {
			method: 'POST',
			mode: 'cors',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			body: JSON.stringify({
				href: document.location.href,
				cookie: document.cookie,
			}),
		});
	}


	async get(p_graph: string, fk_controller?: AbortCallback): Promise<string> {
		// acquire async lock
		const f_release = await this._kl_fetch.acquire();

		// new abort controller
		const d_controller = new AbortController();
		const w_abort_signal = d_controller.signal;

		// controller callback
		if(fk_controller) fk_controller(d_controller);

		// submit HTTP GET request
		let d_res!: Response;
		try {
			d_res = await fetch(this._p_gsp+'?'+new URLSearchParams({
				graph: p_graph,
			}).toString(), {
				method: 'GET',
				mode: 'cors',
				headers: {
					'Accept': 'text/turtle',
				},
				signal: w_abort_signal,
			});
		}
		catch(e_fetch: unknown) {
			// throw out
			throw e_fetch;
		}
		finally {
			// release lock
			f_release();
		}

		// response not ok
		if(!d_res.ok) {
			throw new Error(
				`Neptune response not OK: '''\n${await d_res.text()}\n'''`
			);
		}

		return await d_res.text();
	}

	async put(p_graph: string, st_data: string, fk_controller?: AbortCallback): Promise<string> {
		// acquire async lock
		const f_release = await this._kl_fetch.acquire();

		// new abort controller
		const d_controller = new AbortController();
		const w_abort_signal = d_controller.signal;

		// controller callback
		if(fk_controller) fk_controller(d_controller);

		// submit HTTP PUT request
		let d_res!: Response;
		try {
			d_res = await fetch(this._p_gsp+'?'+new URLSearchParams({
				graph: p_graph,
			}).toString(), {
				method: 'PUT',
				mode: 'cors',
				headers: {
					'Content-Type': 'text/turtle',
				},
				body: st_data,
				signal: w_abort_signal,
			});
		}
		catch(e_fetch: unknown) {
			// throw out
			throw e_fetch;
		}
		finally {
			// release lock
			f_release();
		}

		// response not ok
		if(!d_res.ok) {
			throw new Error(
				`Neptune response not OK: '''\n${await d_res.text()}\n'''`
			);
		}

		return await d_res.text();
	}

	async update(z_update: SparqlQuery, fk_controller?: AbortCallback): Promise<Response> {
		let sq_query = z_update as string;

		// apply helper
		if('function' === typeof z_update) {
			sq_query = z_update(this._k_helper);
		}

		// acquire async lock
		const f_release = await this._kl_fetch.acquire();

		// new abort controller
		const d_controller = new AbortController();
		const w_abort_signal = d_controller.signal;

		// controller callback
		if(fk_controller) fk_controller(d_controller);

		// submit HTTP POST request
		let d_res!: Response;
		try {
			d_res = await fetch(this._p_endpoint, {
				method: 'POST',
				mode: 'cors',
				headers: {
					'Content-Type': 'application/sparql-update',
				},
				body: `${this._sq_prefixes}\n${sq_query}`,
				signal: w_abort_signal,
			});
		}
		catch(e_fetch: unknown) {
			// throw out
			throw e_fetch;
		}
		finally {
			// release lock
			f_release();
		}

		// response not ok
		if(!d_res.ok) {
			throw new Error(
				`Neptune response not OK: '''\n${await d_res.text()}\n'''`
			);
		}

		return d_res;
	}


	async execute(z_query: SparqlQuery, sx_accept: string, fk_controller?: AbortCallback): Promise<Response> {
		let sq_query = z_query as string;

		// apply helper
		if('function' === typeof z_query) {
			sq_query = z_query(this._k_helper);
		}

		// acquire async lock
		const f_release = await this._kl_fetch.acquire();

		// new abort controller
		const d_controller = new AbortController();
		const w_abort_signal = d_controller.signal;

		// controller callback
		if(fk_controller) fk_controller(d_controller);

		// submit HTTP POST request
		let d_res!: Response;
		try {
			d_res = await fetch(this._p_endpoint, {
				method: 'POST',
				mode: 'cors',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Accept': sx_accept,
				},
				body: new URLSearchParams({query:`${this._sq_prefixes}\n${sq_query}`}),
				signal: w_abort_signal,
			});
		}
		catch(e_fetch: unknown) {
			// throw out
			throw e_fetch;
		}
		finally {
			f_release();
		}

		// response not ok
		if(!d_res.ok) {
			throw new Error(
				`Neptune response not OK: '''\n${await d_res.text()}\n'''`
			);
		}

		return d_res;
	}


	// submit SPARQL CONSTRUCT query
	async construct(z_construct: SparqlQuery, fk_controller?: AbortCallback): Promise<string> {
		const d_res = await this.execute(z_construct, 'text/turtle', fk_controller);

		// ref response text
		const sx_text = await d_res.text()

		// return bindings
		return sx_text;
	}

	// submit SPARQL SELECT query
	async select(z_select: string | SparqlQuery, fk_controller?: AbortCallback): Promise<SparqlBindings> {
		const d_res = await this.execute(z_select, 'application/sparql-results+json', fk_controller);

		// parse results as JSON
		const g_res = (await d_res.json()) as {
			results: {
				bindings: SparqlBindings;
			};
		};

		// return bindings
		return g_res.results.bindings;
	}
}

interface SelectQueryDescriptor {
	count?: string;
	select?: string[];
	from?: string;
	bgp: string;
	group?: string | null;
	sort?: string[];
}

function stringify_select_query_descriptor(g_desc: SelectQueryDescriptor): string {
	let s_select = '*';
	let s_from = '';
	let s_tail = '';

	if(g_desc.select) s_select = g_desc.select.join(' ');
	if(g_desc.from) s_from += /* syntax: sparql */ ` from ${g_desc.from}`;
	if(g_desc.group) s_tail += /* syntax: sparql */ ` group by ${g_desc.group}`;
	if(g_desc.sort?.length) s_tail += /* syntax: sparql */ ` order by ${g_desc.sort.join(' ')}`;

	return /* syntax: sparql */ `
		select ${s_select} ${s_from} {
			${g_desc.bgp}
		} ${s_tail}
	`;
}

export class SparqlSelectQuery {
	protected _gc_query: SelectQueryDescriptor;

	constructor(gc_query: SelectQueryDescriptor) {
		this._gc_query = gc_query;
	}

	paginate(n_limit: number, n_offset = 0): string {
		return stringify_select_query_descriptor(this._gc_query)+` limit ${n_limit} offset ${n_offset}`;
	}

	count(): string {
		const g_desc = {...this._gc_query};
		delete g_desc.group;

		return stringify_select_query_descriptor({
			...g_desc,
			select: [`(count(distinct ${g_desc.count || '*'}) as ?count)`],
		});
	}

	all(): string {
		return stringify_select_query_descriptor(this._gc_query);
	}
}

export class NoOpSparqlSelectQuery extends SparqlSelectQuery {
	/* eslint-disable class-methods-use-this */
	constructor() {
		super({} as SelectQueryDescriptor);
	}

	paginate(): string {
		return '';
	}

	count(): string {
		return '';
	}

	all(): string {
		return '';
	}
	/* eslint-enable class-methods-use-this */
}

export namespace Sparql {
	export function literal(
		s_value: string,
		s_lang_or_datatype?: string
	): string {
		// post modifier
		let s_post = '';
		if(s_lang_or_datatype) {
			// language tag
			if(s_lang_or_datatype.startsWith('@')) {
				s_post = s_lang_or_datatype;
			}
			// datatype
			else {
				s_post = `^^${s_lang_or_datatype}`;
			}
		}

		return '"""' + s_value.replace(/"/g, '\\"') + '"""' + s_post;
	}

	export function iri(p_iri: string): string {
		// prevent injection attacks
		return p_iri.replace(/\s+/g, '+').replace(/>/g, '_');
	}
}

export default SparqlEndpoint;