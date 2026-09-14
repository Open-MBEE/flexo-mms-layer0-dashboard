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
			const dm_a = create_element<HTMLAnchorElement>('a', {href: URL.createObjectURL(d_blob)});
			dm_a.download = `${value(org.id)}_${value(repo.id)}_${value(ref.id)}_${value(ref.etag).slice(0, 6)}.ttl`;
			dm_a.dispatchEvent(new MouseEvent('click'));
		}
		finally {
			b_downloading = false;
		}
	}
</script>

<style lang="less">
	.uri {
		font-family: 'PT Mono';
		color: #3a0770;
		word-break: break-all;
	}

	.literal {
		color: #2f7504;
	}

	h4 {
		display: flex;
		align-items: center;
		gap: 0.6em;
		margin: 0.4em 0;
	}

	.badge {
		font-size: 11px;
		font-weight: normal;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: white;
		background-color: #3458eb;
		border-radius: 3px;
		padding: 2px 6px;

		&.Lock {
			background-color: #b35c00;
		}

		&.Scratch {
			background-color: #666;
		}
	}

	.props {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 2px 1.2em;
		margin: 0.6em 0 1em;
		font-size: 14px;

		dt {
			color: #666;
		}

		dd {
			margin: 0;
		}
	}

	.model-stats {
		margin: 0.5em 0;
	}

	[disabled] {
		opacity: 0.4;
	}
</style>

<h4>
	<span class="badge {ref.type}">{H_TYPE_LABELS[ref.type]}</span>
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

{#if Object.keys(ref.snapshots).length}
	<Tabs>
		<TabList>
			{#each Object.entries(ref.snapshots) as [p_snapshot, g_snapshot] (p_snapshot)}
				<Tab>{g_snapshot.type? terse(g_snapshot.type, h_prefixes_terse): p_snapshot}</Tab>
			{/each}
		</TabList>

		{#each Object.entries(ref.snapshots) as [p_snapshot, g_snapshot] (p_snapshot)}
			{@const p_model = g_snapshot.graph}
			<TabPanel>
				<div class="uri">{p_model}</div>

				{#await model_stats(p_model)}
					Loading...
				{:then g_model}
					<div class="model-stats">
						Triple count: {g_model.count}
					</div>

					{#if h_loaded_models[p_model]}
						<rdf-editor format="text/turtle" value={h_loaded_models[p_model]}></rdf-editor>
					{:else}
						<button class="load-model" disabled={b_loading} on:click={() => load_model(p_model)}>
							Load entire model into textarea
						</button>

						<button class="download-model" disabled={b_downloading} on:click={() => download_model(p_model)}>
							Download model to file
						</button>
					{/if}
				{:catch e_load}
					Failed to load:
					<pre>{e_load.stack}</pre>
				{/await}
			</TabPanel>
		{/each}
	</Tabs>
{:else}
	<p>This {H_TYPE_LABELS[ref.type]} has no snapshots.</p>
{/if}
