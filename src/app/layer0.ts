import type { Dict } from "#/util/types";

import SparqlEndpoint, { Sparql } from "#/util/sparql-endpoint";

import read_ttl from '@graphy/content.ttl.read';
import write_ttl from '@graphy/content.ttl.write';
import dataset from '@graphy/memory.dataset.fast';
import factory from '@graphy/core.data.factory';


interface Term {
	concise(h_prefixes: Dict): string;
	terse(h_prefixes: Dict): string;
	value: string;
	termType: string;
}

interface Quad {
	subject: Term;
	predicate: Term;
	object: Term;
	graph: Term;
}

// c1 terms (e.g. `"master`, `>http://...`) as produced by graphy; unwrap with `factory.c1(...).value`
export interface ClusterObject {
	iri: string;
	id: string;
	title: string;
	etag: string;
}

export interface OrgStruct extends ClusterObject {
	repos: Dict<RepoStruct>;
	collections: Dict<CollectionStruct>;
};

export interface RepoStruct extends ClusterObject {
	org: string;
	pairs: Dict<Set<string>>;
};

export interface CollectionStruct extends ClusterObject {
	org: string;
	collects: string[];
};

export type RefType = 'Branch' | 'Lock' | 'Scratch';

export interface SnapshotStruct {
	type: string;
	graph: string;
}

export interface RefStruct extends ClusterObject {
	type: RefType;
	commit: string;
	created: string;
	createdBy: string;
	snapshots: Dict<SnapshotStruct>;
	// locks layer 1 creates automatically for every commit (`mor-lock:Commit.<txn>`)
	auto: boolean;
}

type Triples = Dict<Dict<Set<string>>>;

export interface Downloaded {
	pretty: string;
	prefixes: Dict;
	triples: Triples;
}

export interface ClusterData {
	cluster: string;
	pretty: string;
	registry: string;
	prefixes: Dict;
	orgs: Dict<OrgStruct>;
}

export interface RepoMetadata extends Downloaded {
	refs: Dict<RefStruct>;
}


export const P_IRI_MMS = 'https://mms.openmbee.org/rdf';

export const P_IRI_ROOT_CONTEXT = import.meta.env.VITE_ROOT_CONTEXT;
export const P_IRI_SPARQL_ENDPOINT = import.meta.env.VITE_SPARQL_ENDPOINT;
export const P_IRI_SPARQL_GSP_ENDPOINT = import.meta.env.VITE_SPARQL_GSP_ENDPOINT;

if(!P_IRI_ROOT_CONTEXT || !P_IRI_SPARQL_ENDPOINT) {
	throw new Error('Environment variables not defined');
}


export const H_PREFIXES_DEFAULT = {
	rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
	rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
	owl: 'http://www.w3.org/2002/07/owl#',
	xsd: 'http://www.w3.org/2001/XMLSchema#',
	dct: 'http://purl.org/dc/terms/',

	mms: `${P_IRI_MMS}/ontology/`,
	'mms-txn': `${P_IRI_MMS}/ontology/txn.`,
	'mms-object': `${P_IRI_MMS}/objects/`,
	'mms-datatype': `${P_IRI_MMS}/datatypes/`,

	'm': `${P_IRI_ROOT_CONTEXT}/`,
	'm-object': `${P_IRI_ROOT_CONTEXT}/objects/`,
	'm-graph': `${P_IRI_ROOT_CONTEXT}/graphs/`,
	'm-org': `${P_IRI_ROOT_CONTEXT}/orgs/`,
	'm-user': `${P_IRI_ROOT_CONTEXT}/users/`,
	'm-group': `${P_IRI_ROOT_CONTEXT}/groups/`,
	'm-policy': `${P_IRI_ROOT_CONTEXT}/policies/`,
};


export const SV1_MMS = `>${H_PREFIXES_DEFAULT['mms']}`;
export const SV1_DCT = `>${H_PREFIXES_DEFAULT['dct']}`;
export const SV1_RDF = `>${H_PREFIXES_DEFAULT['rdf']}`;

export const prefixes = (gc_prefixes: Dict) => {
	const h_out: Dict = {};

	if(gc_prefixes.org) {
		const p_org = h_out['mo'] = `${P_IRI_ROOT_CONTEXT}/orgs/${gc_prefixes.org}`;

		if(gc_prefixes.collection) {
			const p_repo = h_out['moc'] = `${p_org}/collections/${gc_prefixes.collection}`;
			h_out['moc-graph'] = `${p_repo}/graphs`;
		}

		if(gc_prefixes.repo) {
			const p_repo = `${p_org}/repos/${gc_prefixes.repo}`;
			Object.assign(h_out, {
				'mor': p_repo,
				'mor-commit': `${p_repo}/commits/`,
				'mor-branch': `${p_repo}/branches/`,
				'mor-lock': `${p_repo}/locks/`,
				'mor-snapshot': `${p_repo}/snapshots/`,
				'mor-graph': `${p_repo}/graphs/`,
			});

			if(gc_prefixes.branch) {
				h_out['morb'] = `${p_repo}/branches/${gc_prefixes.branch}`;
			}

			if(gc_prefixes.diff) {
				h_out['mord'] = `${p_repo}/diffs/${gc_prefixes.diff}`;
			}

			if(gc_prefixes.lock) {
				h_out['morl'] = `${p_repo}/locks/${gc_prefixes.lock}`;
			}

			if(gc_prefixes.commit) {
				const p_commit = h_out['morc'] = `${p_repo}/commits/${gc_prefixes.commit}`;
				h_out['morc-data'] = `${p_commit}/data`;
			}
		}
	}

	return h_out;
};

export const k_endpoint = new SparqlEndpoint({
	endpoint: P_IRI_SPARQL_ENDPOINT,
	gsp: P_IRI_SPARQL_GSP_ENDPOINT,
	prefixes: {},
});


export function first<w_return>(asi: Iterable<w_return>, w_fallback: any=undefined) { return [...(asi || [w_fallback])][0]; }

export const value = (sv1_term: string): string => factory.c1(sv1_term).value;

const last_segment = (p_iri: string) => p_iri.slice(p_iri.lastIndexOf('/')+1);

const has_type = (hc2: Dict<Set<string>>, s_class: string) => !!hc2?.[SV1_RDF+'type']?.has(SV1_MMS+s_class);

const sort_by_key = <w_value>(h_dict: Dict<w_value>): Dict<w_value> => Object.fromEntries(
	Object.entries(h_dict).sort(([si_a], [si_b]) => si_a.localeCompare(si_b))
);

const R_REF_IRI = /^(.*\/orgs\/[^/]+\/repos\/[^/]+)\/(branches|locks|scratches)\/([^/]+)$/;

const H_REF_TYPES: Dict<RefType> = {
	branches: 'Branch',
	locks: 'Lock',
	scratches: 'Scratch',
};

export interface ParsedRefIri {
	repo: string;
	type: RefType;
	id: string;
}

// splits a ref IRI such as `.../orgs/o/repos/r/locks/v1` into its repo IRI, ref type and id
export function parse_ref_iri(p_ref: string): ParsedRefIri | null {
	const m_ref = R_REF_IRI.exec(p_ref);
	if(!m_ref) return null;

	return {
		repo: m_ref[1],
		type: H_REF_TYPES[m_ref[2]],
		id: decodeURIComponent(m_ref[3]),
	};
}

function cluster_object(hc3: Triples, p_iri: string): ClusterObject {
	const hc2 = hc3['>'+p_iri] || {};

	return {
		iri: p_iri,
		id: first(hc2[SV1_MMS+'id'], '"'+last_segment(p_iri)),
		title: first(hc2[SV1_DCT+'title'], '"'),
		etag: first(hc2[SV1_MMS+'etag'], '"'),
	};
}

// downloads `m-graph:Cluster` and `m-graph:Graphs`; groups repos and collections under their orgs
export async function load_cluster(): Promise<ClusterData> {
	const g_cluster = await download(`
		construct { ?s ?p ?o }
		where {
			graph m-graph:Cluster {
				?s ?p ?o
			}
		}
	`);

	const g_registry = await download(`
		construct { ?s ?p ?o }
		where {
			graph m-graph:Graphs {
				?s ?p ?o
			}
		}
	`);

	const hc3_cluster = g_cluster.triples || {};
	const h_orgs: Dict<OrgStruct> = {};
	let p_cluster = '';

	const org_of = (p_org: string): OrgStruct => h_orgs[p_org] = h_orgs[p_org] || {
		...cluster_object(hc3_cluster, p_org),
		repos: {},
		collections: {},
	};

	for(const [sc1_subject, hc2] of Object.entries(hc3_cluster)) {
		if('>' !== sc1_subject[0]) continue;
		const p_subject = sc1_subject.slice(1);

		if(has_type(hc2, 'Cluster')) {
			p_cluster = p_subject;
		}
		else if(has_type(hc2, 'Org')) {
			org_of(p_subject);
		}
		else if(has_type(hc2, 'Repo')) {
			const p_org = value(first(hc2[SV1_MMS+'org'], '>'));
			org_of(p_org).repos[p_subject] = {
				...cluster_object(hc3_cluster, p_subject),
				org: p_org,
				pairs: hc2,
			};
		}
		else if(has_type(hc2, 'Collection')) {
			const p_org = value(first(hc2[SV1_MMS+'org'], '>'));
			org_of(p_org).collections[p_subject] = {
				...cluster_object(hc3_cluster, p_subject),
				org: p_org,
				collects: [...(hc2[SV1_MMS+'collects'] || [])].map(value).sort(),
			};
		}
	}

	for(const g_org of Object.values(h_orgs)) {
		g_org.repos = sort_by_key(g_org.repos);
		g_org.collections = sort_by_key(g_org.collections);
	}

	return {
		cluster: p_cluster,
		pretty: g_cluster.pretty,
		registry: g_registry.pretty,
		prefixes: g_cluster.prefixes,
		orgs: sort_by_key(h_orgs),
	};
}

// downloads a repo's `mor-graph:Metadata` and extracts its branches, locks and scratches
export async function load_repo(g_org: OrgStruct, g_repo: RepoStruct): Promise<RepoMetadata> {
	const g_download = await download(`
		construct { ?s ?p ?o }
		where {
			graph mor-graph:Metadata {
				?s ?p ?o
			}
		}
	`, {
		org: value(g_org.id),
		repo: value(g_repo.id),
	});

	const hc3_repo = g_download.triples || {};
	const h_refs: Dict<RefStruct> = {};

	for(const [sc1_subject, hc2] of Object.entries(hc3_repo)) {
		if('>' !== sc1_subject[0]) continue;
		const p_subject = sc1_subject.slice(1);

		const s_type = (['Branch', 'Lock', 'Scratch'] as RefType[]).find(s => has_type(hc2, s));
		if(!s_type) continue;

		h_refs[p_subject] = {
			...cluster_object(hc3_repo, p_subject),
			type: s_type,
			commit: first(hc2[SV1_MMS+'commit'], ''),
			created: first(hc2[SV1_MMS+'created'], ''),
			createdBy: first(hc2[SV1_MMS+'createdBy'], ''),
			auto: 'Lock' === s_type && last_segment(p_subject).startsWith('Commit.'),
			snapshots: [...(hc2[SV1_MMS+'snapshot'] || [])].reduce((h_out, sv1_snapshot) => {
				const hc2_snapshot = hc3_repo[sv1_snapshot] || {};
				return {
					...h_out,
					[value(sv1_snapshot)]: {
						type: first(hc2_snapshot[SV1_RDF+'type'], ''),
						graph: value(first(hc2_snapshot[SV1_MMS+'graph'], '>')),
					},
				};
			}, {} as Dict<SnapshotStruct>),
		};
	}

	return {
		...g_download,
		refs: sort_by_key(h_refs),
	};
}

export async function model_stats(p_graph: string): Promise<{count: number}> {
	const a_results = await k_endpoint.select(`
		select (count(*) as ?count) {
			graph <${p_graph}> {
				?s ?p ?o .
			}
		}
	`);

	return {
		count: +a_results[0].count.value,
	};
}



export async function download(
	sq_construct: string,
	h_data: Dict={},
	fk_data: ((g_quad: Quad) => void)=()=>{},
	fk_quads: ((hc3: any, ds_writer?: any) => any)=(hc3)=>hc3
): Promise<Downloaded> {
	let st_pretty = '';

	const h_prefixes = {
		...H_PREFIXES_DEFAULT,
		...prefixes(h_data),
	};

	const st_pretext = Object.entries(h_prefixes)
		.map(([si_prefix, p_iri]) => `prefix ${si_prefix}: <${p_iri}>\n`)
		.join('');

	const s_ttl = await k_endpoint.construct(st_pretext+sq_construct);

	// parse the turtle, load into a dataset
	const y_ds = await new Promise((fk_resolve) => {
		const y_dataset = dataset();

		read_ttl(s_ttl, {
			data(g_quad: Quad) {
				fk_data(g_quad);
				y_dataset.add(g_quad);
			},
			eof() {
				fk_resolve(y_dataset);
			},
		});
	});

	return new Promise((fk_resolve) => {
		// pretty-print
		const ds_writer = write_ttl({
			prefixes: h_prefixes,
		});

		// serialize
		ds_writer.on('data', (s_chunk: string) => {
			st_pretty += s_chunk;
		});

		const hc3_triples = fk_quads(y_ds._h_quad_tree['*'], ds_writer);

		ds_writer.on('end', () => {
			fk_resolve({
				pretty: st_pretty,
				prefixes: h_prefixes,
				triples: hc3_triples,
			});
		});
		
		ds_writer.write({
			type: 'c3',
			value: hc3_triples,
		});

		ds_writer.end();
	});
}

