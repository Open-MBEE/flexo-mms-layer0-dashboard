import type { Dict } from '#/util/types';

import { Sparql } from '#/util/sparql-endpoint';

import { H_PREFIXES_DEFAULT } from '#/app/layer0';

export interface PresetParam {
	key: string;
	label: string;
	default: string;
	placeholder?: string;
	hint?: string;
}

export interface QueryPreset {
	id: string;
	label: string;
	description: string;
	params: PresetParam[];
	build(h_params: Dict): string;
}

export const N_LIMIT_DEFAULT = 50;
export const N_LIMIT_MAX = 5000;

export const prefix_header = (h_prefixes: Dict): string => Object.entries(h_prefixes)
	.map(([si_prefix, p_iri]) => `prefix ${si_prefix}: <${p_iri}>`)
	.join('\n');

// clamp a user-supplied limit into a sane range for the results table
export function limit(s_limit: string): number {
	const n_limit = Number.parseInt(s_limit, 10);
	if(Number.isNaN(n_limit) || n_limit < 1) return N_LIMIT_DEFAULT;
	return Math.min(n_limit, N_LIMIT_MAX);
}

// render a user-supplied IRI or prefixed name (e.g. `ex:Block`) as a SPARQL term
export function term(s_input: string): string {
	const s_trim = s_input.trim();

	if(s_trim.startsWith('<') && s_trim.endsWith('>')) return `<${Sparql.iri(s_trim.slice(1, -1))}>`;
	if(/^[a-z][a-z0-9+.-]*:\/\//i.test(s_trim)) return `<${Sparql.iri(s_trim)}>`;
	if(/^[\w.-]*:[\w.%-]*$/.test(s_trim)) return s_trim;

	return `<${Sparql.iri(s_trim)}>`;
}

// users may be given as a bare id (`jason`), a prefixed name, or a full IRI
export function user_term(s_input: string): string {
	const s_trim = s_input.trim();

	if(/^[\w.-]+$/.test(s_trim)) return `<${H_PREFIXES_DEFAULT['m-user']}${Sparql.iri(s_trim)}>`;

	return term(s_trim);
}

// commits may be given as a bare transaction id (`txn1`), a prefixed name, or a full IRI
export function commit_pattern(s_input: string, s_var: string): string {
	const s_trim = s_input.trim();

	if(/^[\w.-]+$/.test(s_trim)) return `${s_var} a mms:Commit ; mms:id ${Sparql.literal(s_trim)} .`;

	return `values ${s_var} { ${term(s_trim)} }`;
}

// layer 1 keeps each repo's refs and commits in `<repo>/graphs/Metadata`
const SX_REPO_FROM_GRAPH = 'bind(if(contains(str(?graph), "/repos/"), iri(strbefore(str(?graph), "/graphs/")), ?unbound) as ?repo)';

const G_PARAM_USER: PresetParam = {
	key: 'user',
	label: 'User',
	default: '',
	placeholder: 'jason  |  m-user:jason  |  https://…/users/jason',
	hint: 'leave empty for all users',
};

const G_PARAM_LIMIT: PresetParam = {
	key: 'limit',
	label: 'Limit',
	default: `${N_LIMIT_DEFAULT}`,
};

export const A_PRESETS: QueryPreset[] = [
	{
		id: 'activity',
		label: 'Recent activity',
		description: 'Commits and created orgs, repos, collections, branches, tags/locks and scratches, newest first.',
		params: [G_PARAM_USER, G_PARAM_LIMIT],
		build: (h) => /* syntax: sparql */ `
			select ?when ?activity ?user ?resource ?repo ?message where {
				${h.user.trim() ? `values ?user { ${user_term(h.user)} }` : ''}
				{
					graph ?graph {
						?resource a mms:Commit ;
							mms:submitted ?when ;
							mms:createdBy ?user .
						optional { ?resource mms:message ?message . }
					}
					bind("commit" as ?activity)
				}
				union {
					graph ?graph {
						?resource a ?type ;
							mms:created ?when ;
							mms:createdBy ?user .
						filter(?type in (mms:Org, mms:Repo, mms:Collection, mms:Branch, mms:Lock, mms:Scratch))
						filter not exists { ?resource a mms:Lock . filter not exists { ?resource mms:id ?id . } }
					}
					bind(concat("created ", lcase(strafter(str(?type), str(mms:)))) as ?activity)
				}
				${SX_REPO_FROM_GRAPH}
			}
			order by desc(?when)
			limit ${limit(h.limit)}
		`,
	},
	{
		id: 'commits',
		label: 'Recent commits',
		description: 'Commit log across every repository, optionally narrowed to one user or one repo.',
		params: [
			G_PARAM_USER,
			{
				key: 'repo',
				label: 'Repo',
				default: '',
				placeholder: 'https://…/orgs/openmbee/repos/demo',
				hint: 'repo IRI; leave empty for all repos',
			},
			G_PARAM_LIMIT,
		],
		build: (h) => /* syntax: sparql */ `
			select ?when ?commit ?user ?repo ?message ?parent where {
				${h.user.trim() ? `values ?user { ${user_term(h.user)} }` : ''}
				graph ?graph {
					?commit a mms:Commit ;
						mms:submitted ?when .
					optional { ?commit mms:createdBy ?user . }
					optional { ?commit mms:message ?message . }
					optional { ?commit mms:parent ?parent . }
				}
				${SX_REPO_FROM_GRAPH}
				${h.repo.trim() ? `filter(?repo = ${term(h.repo)})` : ''}
			}
			order by desc(?when)
			limit ${limit(h.limit)}
		`,
	},
	{
		id: 'changes-by-type',
		label: 'Recent changes by type',
		description: 'Elements of a given rdf:type whose triples were inserted or deleted by a commit; the type may be asserted in the diff itself or in the model at that commit.',
		params: [
			{
				key: 'type',
				label: 'rdf:type',
				default: '',
				placeholder: 'https://example.org/Block  |  mms:Branch',
				hint: 'full IRI, or a prefixed name using a declared prefix',
			},
			G_PARAM_USER,
			G_PARAM_LIMIT,
		],
		build: (h) => {
			const sx_type = h.type.trim() ? term(h.type) : '?type';

			return /* syntax: sparql */ `
				select distinct ?when ?element ?change ?commit ?user ?repo ?message where {
					${h.user.trim() ? `values ?user { ${user_term(h.user)} }` : ''}
					{
						graph ?graph { ?commit mms:data/mms:insGraph ?diff . }
						bind("insert" as ?change)
					}
					union {
						graph ?graph { ?commit mms:data/mms:delGraph ?diff . }
						bind("delete" as ?change)
					}
					graph ?graph {
						?commit a mms:Commit ;
							mms:submitted ?when .
						optional { ?commit mms:createdBy ?user . }
						optional { ?commit mms:message ?message . }
					}
					graph ?diff { ?element ?property ?value . }
					filter exists {
						{ graph ?diff { ?element a ${sx_type} . } }
						union {
							graph ?graph { ?lock mms:commit ?commit ; mms:snapshot/mms:graph ?model . }
							graph ?model { ?element a ${sx_type} . }
						}
					}
					${SX_REPO_FROM_GRAPH}
				}
				order by desc(?when) ?element
				limit ${limit(h.limit)}
			`;
		},
	},
	{
		id: 'commit-diff',
		label: 'Commit diff',
		description: 'Triples inserted and deleted by one commit; give a second, older commit to list every change on the path between them (newest commit first).',
		params: [
			{
				key: 'commit',
				label: 'Commit',
				default: '',
				placeholder: 'txn2  |  https://…/repos/demo/commits/txn2',
			},
			{
				key: 'from',
				label: 'Since commit',
				default: '',
				placeholder: 'txn1',
				hint: 'older ancestor; its own changes are excluded',
			},
			G_PARAM_LIMIT,
		],
		build: (h) => /* syntax: sparql */ `
			select ?when ?commit ?change ?subject ?property ?value where {
				graph ?graph {
					${h.from.trim() ? /* syntax: sparql */ `
					${commit_pattern(h.commit.trim() || '<urn:missing-commit>', '?target')}
					${commit_pattern(h.from, '?from')}
					?target mms:parent* ?commit .
					filter not exists { ?from mms:parent* ?commit . }
					` : commit_pattern(h.commit.trim() || '<urn:missing-commit>', '?commit')}
					?commit mms:submitted ?when .
				}
				{
					graph ?graph { ?commit mms:data/mms:insGraph ?diff . }
					bind("insert" as ?change)
				}
				union {
					graph ?graph { ?commit mms:data/mms:delGraph ?diff . }
					bind("delete" as ?change)
				}
				graph ?diff { ?subject ?property ?value . }
			}
			order by desc(?when) desc(?change) ?subject ?property
			limit ${limit(h.limit)}
		`,
	},
	{
		id: 'element-history',
		label: 'Element history',
		description: 'Every commit that inserted or deleted a triple about one element, with the triples that changed.',
		params: [
			{
				key: 'element',
				label: 'Element',
				default: '',
				placeholder: 'https://example.org/b  |  m-user:jason',
				hint: 'full IRI, or a prefixed name using a declared prefix',
			},
			G_PARAM_LIMIT,
		],
		build: (h) => /* syntax: sparql */ `
			select ?when ?change ?property ?value ?commit ?user ?repo where {
				values ?element { ${term(h.element.trim() || '<urn:missing-element>')} }
				{
					graph ?graph { ?commit mms:data/mms:insGraph ?diff . }
					bind("insert" as ?change)
				}
				union {
					graph ?graph { ?commit mms:data/mms:delGraph ?diff . }
					bind("delete" as ?change)
				}
				graph ?diff { ?element ?property ?value . }
				graph ?graph {
					?commit mms:submitted ?when .
					optional { ?commit mms:createdBy ?user . }
				}
				${SX_REPO_FROM_GRAPH}
			}
			order by desc(?when) ?change ?property
			limit ${limit(h.limit)}
		`,
	},
];
