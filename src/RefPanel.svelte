<script lang="ts">
	import '@rdfjs-elements/rdf-editor';
	import {
		Tabs,
		Tab,
		TabList,
		TabPanel,
	} from 'svelte-tabs';

	import factory from '@graphy/core.data.factory';

	import type { Dict } from './util/types';
	import type {
		OrgStruct,
		RepoStruct,
		RefStruct,
	} from '#/app/layer0';

	import {
		H_PREFIXES_DEFAULT,
		prefixes as repo_prefixes,
		download,
		model_stats,
		value,
	} from '#/app/layer0';
	import { dd as create_element } from './util/dom';

	export let org: OrgStruct;
	export let repo: RepoStruct;
	export let ref: RefStruct;
	export let prefixes: Dict = H_PREFIXES_DEFAULT as Dict;

	const H_TYPE_LABELS = {
		Branch: 'branch',
		Lock: 'tag / lock',
		Scratch: 'scratch',
	};

	// Object.entries drops graphy's symbol-keyed prefix cache, which a spread would copy over stale
	$: h_prefixes_terse = {
		...Object.fromEntries(Object.entries(prefixes)),
		...repo_prefixes({org: value(org.id), repo: value(repo.id)}),
	};

	function terse(sv1_term: string, h_prefixes: Dict): string {
		return factory.c1(sv1_term).terse(h_prefixes);
	}

	interface ModelTab {
		key: string;
		label: string;
		graph: string;
	}

	// each ref exposes one graph per snapshot, except scratches which expose their single graph directly
	$: a_models = ((): ModelTab[] => {
		if('Scratch' === ref.type) {
			return ref.graph? [{key: ref.graph, label: 'scratch', graph: ref.graph}]: [];
		}

		return Object.entries(ref.snapshots).map(([p_snapshot, g_snapshot]) => ({
			key: p_snapshot,
			label: g_snapshot.type? terse(g_snapshot.type, h_prefixes_terse): p_snapshot,
			graph: g_snapshot.graph,
		}));
	})();

	let h_loaded_models: Dict = {};
	let b_loading = false;
	let b_downloading = false;

	async function fetch_model(p_model: string): Promise<string> {
		const {pretty: st_model} = await download(`
			construct { ?s ?p ?o }
			where {
				graph <${p_model}> {
					?s ?p ?o .
				}
			}
		`);

		return st_model;
	}

	async function load_model(p_model: string) {
		b_loading = true;
		try {
			h_loaded_models = {
				...h_loaded_models,
				[p_model]: await fetch_model(p_model),
			};
		}
		finally {
			b_loading = false;
		}
	}

	async function download_model(p_model: string) {
		b_downloading = true;
		try {
			const st_model = await fetch_model(p_model);
			const d_blob = new Blob([st_model], {type:'text/plain'});
			const p_blob = URL.createObjectURL(d_blob);
			try {
				const dm_a = create_element<HTMLAnchorElement>('a', {href: p_blob});
				dm_a.download = `${value(org.id)}_${value(repo.id)}_${value(ref.id)}_${value(ref.etag).slice(0, 6)}.ttl`;
				dm_a.dispatchEvent(new MouseEvent('click'));
			}
			finally {
				setTimeout(() => URL.revokeObjectURL(p_blob), 0);
			}
		}
		finally {
			b_downloading = false;
		}
	}
</script>

<style lang="less">
	h4 {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		margin: 4px 0 8px;
		font-size: 20px;
	}

	.uri {
		font-size: 12px;
	}

	.badge {
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background-color: var(--md-primary-tint);
		color: var(--md-primary);

		&.Lock {
			background-color: rgba(239, 108, 0, 0.14);
			color: var(--md-warning);
		}

		&.Scratch {
			background-color: rgba(0, 0, 0, 0.08);
			color: var(--md-on-surface-medium);
		}
	}

	.props {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 4px 24px;
		margin: 16px 0;
		font-size: 14px;

		dt {
			color: var(--md-on-surface-medium);
		}

		dd {
			margin: 0;
		}
	}

	.model-stats {
		margin: 12px 0;
		color: var(--md-on-surface-medium);
	}

	.model-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>

<h4>
	<span class="chip badge {ref.type}">{H_TYPE_LABELS[ref.type]}</span>
	<span class="literal">{value(ref.id)}</span>
	{#if value(ref.title)}
		<span class="literal">— {value(ref.title)}</span>
	{/if}
</h4>

<div class="uri">{ref.iri}</div>

<dl class="props">
	{#if ref.etag && value(ref.etag)}
		<dt>etag</dt>
		<dd class="literal">{value(ref.etag)}</dd>
	{/if}
	{#if ref.commit}
		<dt>commit</dt>
		<dd class="uri">{terse(ref.commit, h_prefixes_terse)}</dd>
	{/if}
	{#if ref.created}
		<dt>created</dt>
		<dd class="literal">{value(ref.created)}</dd>
	{/if}
	{#if ref.createdBy}
		<dt>created by</dt>
		<dd class="uri">{terse(ref.createdBy, h_prefixes_terse)}</dd>
	{/if}
</dl>

{#if a_models.length}
	<Tabs>
		<TabList>
			{#each a_models as g_model_tab (g_model_tab.key)}
				<Tab>{g_model_tab.label}</Tab>
			{/each}
		</TabList>

		{#each a_models as g_model_tab (g_model_tab.key)}
			{@const p_model = g_model_tab.graph}
			<TabPanel>
				<div class="uri">{p_model}</div>

				{#await model_stats(p_model)}
					<div class="loading">Counting triples…</div>
				{:then g_model}
					<div class="model-stats">
						Triple count: <b>{g_model.count}</b>
					</div>

					{#if h_loaded_models[p_model]}
						<rdf-editor format="text/turtle" value={h_loaded_models[p_model]}></rdf-editor>
					{:else}
						<div class="model-actions">
							<button class="load-model" disabled={b_loading} on:click={() => load_model(p_model)}>
								Load entire model into textarea
							</button>

							<button class="download-model outlined" disabled={b_downloading} on:click={() => download_model(p_model)}>
								Download model to file
							</button>
						</div>
					{/if}
				{:catch e_load}
					<div class="banner">
						Failed to load:
						<pre>{e_load.stack}</pre>
					</div>
				{/await}
			</TabPanel>
		{/each}
	</Tabs>
{:else}
	<p class="missing">This {H_TYPE_LABELS[ref.type]} has no snapshots.</p>
{/if}
