<script lang="ts">
	import factory from '@graphy/core.data.factory';

	import {
		H_PREFIXES_DEFAULT,
		SV1_MMS,
		download,
		first,
		k_endpoint,
	} from '#/app/layer0';

	export let graph: string;
	export let sort = '';
	export let preload = '';
	export let prefixes = H_PREFIXES_DEFAULT;

	let c_reloads = 0;

	const b_reverse = '-' === sort[0]? 1: 0;
	const s_sort = b_reverse? sort.slice(1): sort;

	let dm_editor: HTMLTextAreaElement;
	let dm_actions: HTMLDivElement;

	async function overwrite(d_event: MouseEvent) {
		const dm_overwrite = dm_actions.querySelector('.overwrite');
		dm_overwrite.classList.add('busy');
		const st_editor = dm_editor.value;
		const p_graph = dm_editor.dataset.graph;
		await k_endpoint.put(graph, st_editor);
		dm_overwrite.classList.remove('busy');
	}

	function terse(sv1_term: string): string {
		return factory.c1(sv1_term).terse(prefixes);
	}

	function value(sv1_term: string): string {
		return factory.c1(sv1_term).value;
	}

	const mms_prop = (hc2, s_prop) => value(first(hc2[SV1_MMS+s_prop]));

	async function refresh(d_event: MouseEvent) {
		dm_actions.querySelector('.refresh').classList.add('busy');
		c_reloads += 1;
	}

	async function download_graph() {
		const g_download = await download(`
			construct { ?s ?p ?o }
			where {
				graph <${graph}> {
					?s ?p ?o .
				}
			}
		`, {}, () => {}, (hc3_triples, ds_writer) => {
			if(!hc3_triples) {
				throw new Error(`No such graph exists in triplestore`);
			}

			if(s_sort) {
				ds_writer.write({
					type: 'comment',
					value: `Sorted in ${b_reverse? 'reverse ': ' '}'${s_sort}' order (most recent transactions appear at the top)`,
				});

				return Object.fromEntries(Object.entries(hc3_triples).sort(([p_a, hc2_a], [p_b, hc2_b]) => {
					return mms_prop(hc2_a, s_sort) < mms_prop(hc2_b, s_sort)? (b_reverse? 1: -1): (b_reverse? -1: 1);
				}));
			}
			else {
				return Object.fromEntries(Object.entries(hc3_triples).sort(([p_a], [p_b]) => {
					return p_a < p_b? (b_reverse? 1: -1): (b_reverse? -1: 1);
				}));
			}
		});


		dm_actions.querySelector('.refresh').classList.remove('busy');

		return g_download;
	}
</script>

<style lang="less">
	.graph {
		span {
			font-family: 'PT Mono';
			background-color: rgba(0, 0, 0, 0.12);
			padding: 4px 6px;
		}
	}

	.actions {
		padding: 12px 20px;

		:global([class^="new-"]) {
			background-color: #31d12c;
		}
	}

	:global(.busy) {
		background-color: #ebb734;
		cursor: wait;
	}
</style>

<div class="graph">
	<span>{graph}</span>
</div>

<div class="actions" bind:this={dm_actions}>
	<button class="refresh" on:click={refresh}>Refresh</button>
	<button class="overwrite" on:click={overwrite}>Overwrite</button>
	<slot name="actions"></slot>
</div>

{#key c_reloads}
	{#if preload}
		<rdf-editor bind:this={dm_editor} autoParse format="text/turtle" value={preload} ></rdf-editor>
	{:else}
		{#await download_graph()}
			Loading...
		{:then g_download}
			<rdf-editor bind:this={dm_editor} autoParse format="text/turtle" value={g_download.pretty} ></rdf-editor>
		{:catch e_download}
			Failed to load:
			<pre>{e_download.stack}</pre>
		{/await}
	{/if}
{/key}