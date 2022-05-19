import type { Dict } from "#/util/types";

import SparqlEndpoint from "#/util/sparql-endpoint";

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

interface ClusterObject {
	id: string;
	title: string;
	etag: string;
}

interface OrgStruct extends ClusterObject {
	repos: Dict<RepoStruct>;
};

interface RepoStruct extends ClusterObject {
	org: string;
	pairs: Dict<Set<string>>;
};

type Triples = Dict<Dict<Set<string>>>;

interface Downloaded {
	pretty: string;
	prefixes: Dict;
	triples: Triples;
}


export const P_IRI_MMS = 'https://mms.openmbee.org/rdf';

export const P_IRI_ROOT_CONTEXT = 'https://mms5.jpl.nasa.gov';

export const P_IRI_SPARQL_ENDPOINT = 'https://mms5-proxy.jpl.nasa.gov/sparql';

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
	prefixes: {},
});

export function first<w_return>(asi: Iterable<w_return>, w_fallback: any=undefined) { return [...(asi || [w_fallback])][0]; }



export async function download(
	sq_construct: string,
	h_data: Dict,
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


let p_cluster = '';
let st_cluster = '';
let h_orgs_repos: Dict<OrgStruct> = {};