<script lang="ts">
	import factory from '@graphy/core.data.factory';

	import type { Dict, SparqlBinding, SparqlResultsJson } from '#/util/types';
	import type { QueryPreset } from '#/app/queries';

	import { H_PREFIXES_DEFAULT, P_IRI_ROOT_CONTEXT, k_endpoint } from '#/app/layer0';
	import { A_PRESETS, prefix_header } from '#/app/queries';

	export let prefixes = H_PREFIXES_DEFAULT;

	// bumped by the dashboard whenever the endpoint changes; discards results from the previous store
	export let generation = 0;

	const SX_DEFAULT_QUERY = /* syntax: sparql */ `select ?graph (count(*) as ?triples) where {
	graph ?graph { ?s ?p ?o . }
}
group by ?graph
order by desc(?triples)
limit 50`;

	let g_preset: QueryPreset | null = A_PRESETS[0];
	let h_params: Dict = Object.fromEntries(A_PRESETS[0].params.map(g => [g.key, g.default]));
	let sx_query = dedent(A_PRESETS[0].build(h_params));
	let b_running = false;
	let e_query: Error | null = null;
	let g_results: SparqlResultsJson | null = null;
	let xt_elapsed = 0;
	let c_run = 0;

	$: reset(generation);

	function reset(_c_generation: number) {
		c_run += 1;
		b_running = false;
		e_query = null;
		g_results = null;
	}

	// the prefix header is prepended on submit, so the editor stays free of boilerplate
	$: sx_header = prefix_header(prefixes);

	// strip the template-literal indentation from generated queries; blank lines left by empty params are dropped
	function dedent(sx_text: string): string {
		const a_lines = sx_text.split('\n').filter(s => s.trim());
		const n_indent = Math.min(...a_lines.map(s => s.length - s.trimStart().length));
		return a_lines.map(s => s.slice(n_indent)).join('\n');
	}

	// prefix declarations the user typed at the top of the editor survive preset regeneration
	function prologue(sx_text: string): string {
		const a_lines = sx_text.split('\n');
		let i_end = 0;
		while(i_end < a_lines.length && /^\s*(prefix\s|base\s|$)/i.test(a_lines[i_end])) i_end++;
		const sx_prologue = a_lines.slice(0, i_end).join('\n').trim();
		return sx_prologue? `${sx_prologue}\n`: '';
	}

	function generate(): string {
		return g_preset? prologue(sx_query)+dedent(g_preset.build(h_params)): sx_query;
	}

	function select_preset(si_preset: string) {
		g_preset = A_PRESETS.find(g => si_preset === g.id) || null;
		if(!g_preset) {
			sx_query = prologue(sx_query)+SX_DEFAULT_QUERY;
			return;
		}

		h_params = Object.fromEntries(g_preset.params.map(g => [g.key, h_params[g.key] ?? g.default]));
		sx_query = generate();
	}

	function apply_params() {
		if(g_preset) sx_query = generate();
	}

	function edit_query(sx_edited: string) {
		sx_query = sx_edited;
		g_preset = null;
	}

	async function run() {
		if(b_running) return;

		b_running = true;
		e_query = null;
		g_results = null;

		const i_run = ++c_run;
		const xt_start = performance.now();
		try {
			const g_response = await k_endpoint.query(`${sx_header}\n\n${sx_query}`);
			if(i_run !== c_run) return;
			g_results = g_response;
		}
		catch(e_run) {
			if(i_run !== c_run) return;
			e_query = e_run as Error;
		}
		finally {
			if(i_run === c_run) {
				xt_elapsed = Math.round(performance.now() - xt_start);
				b_running = false;
			}
		}
	}

	function keydown(d_event: KeyboardEvent) {
		if('Enter' === d_event.key && (d_event.ctrlKey || d_event.metaKey)) {
			d_event.preventDefault();
			run();
		}
	}

	// layer 1 resource IRIs contain slashes past the prefix, so they cannot be prefixed names; show them relative to the root context
	function terse_iri(p_iri: string): string {
		const sx_terse = factory.namedNode(p_iri).terse(prefixes);
		if(!sx_terse.startsWith('<') || !p_iri.startsWith(`${P_IRI_ROOT_CONTEXT}/`)) return sx_terse;

		return `…/${p_iri.slice(P_IRI_ROOT_CONTEXT.length+1)}`;
	}

	function terse(g_binding: SparqlBinding): string {
		switch(g_binding.type) {
			case 'uri': return terse_iri(g_binding.value);
			case 'bnode': return `_:${g_binding.value}`;
			default: {
				if('xml:lang' in g_binding) return `"${g_binding.value}"@${g_binding['xml:lang']}`;
				if('datatype' in g_binding) {
					const p_datatype = g_binding.datatype;
					if(p_datatype.startsWith('http://www.w3.org/2001/XMLSchema#')) {
						const s_local = p_datatype.slice('http://www.w3.org/2001/XMLSchema#'.length);
						if(['integer', 'decimal', 'double', 'boolean'].includes(s_local)) return g_binding.value;
						if('dateTime' === s_local) return g_binding.value.replace('T', ' ').replace(/(\.\d+)?Z$/, ' UTC');
						if('string' === s_local) return g_binding.value;
					}
					return `"${g_binding.value}"^^${factory.namedNode(p_datatype).terse(prefixes)}`;
				}
				return g_binding.value;
			}
		}
	}
</script>

<style lang="less">
	.query {
		display: flex;
		flex-direction: column;
		gap: 1em;
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5em;
		align-items: center;

		button {
			background-color: #eee;
			color: #333;

			&.active {
				background-color: #3458eb;
				color: white;
			}
		}
	}

	.description {
		font-size: 13px;
		color: #666;
	}

	.params {
		display: flex;
		flex-wrap: wrap;
		gap: 1em;

		label {
			display: flex;
			flex-direction: column;
			font-size: 13px;
			gap: 2px;

			input {
				width: 20em;
				font-family: 'PT Mono';
				font-size: 12px;
				padding: 4px 6px;
			}

			.hint {
				color: #999;
				font-size: 11px;
			}
		}
	}

	textarea {
		width: 100%;
		min-height: 14em;
		box-sizing: border-box;
		font-family: 'PT Mono';
		font-size: 12px;
		padding: 8px;
		border: 1px solid rgba(0, 0, 0, 0.2);
		resize: vertical;
	}

	.prefixes {
		font-size: 11px;
		color: #999;

		code {
			font-family: 'PT Mono';
		}

		summary {
			cursor: pointer;
		}

		pre {
			margin: 0.5em 0 0;
			font-size: 11px;
		}
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 1em;

		.busy {
			background-color: #ebb734;
			cursor: wait;
		}

		.status {
			font-size: 13px;
			color: #666;
		}
	}

	.error {
		color: #b00020;
		white-space: pre-wrap;
		word-break: break-word;
		background-color: rgba(176, 0, 32, 0.06);
		padding: 8px 12px;
	}

	.empty {
		color: #999;
		font-style: italic;
	}

	.results {
		overflow: auto;
		max-height: 70vh;
		border: 1px solid rgba(0, 0, 0, 0.1);

		table {
			border-collapse: collapse;
			font-size: 12px;
			width: 100%;
		}

		th, td {
			text-align: left;
			padding: 4px 8px;
			border-bottom: 1px solid rgba(0, 0, 0, 0.08);
			vertical-align: top;
		}

		th {
			position: sticky;
			top: 0;
			background-color: #f4f4f4;
			font-family: 'PT Mono';
			font-weight: normal;
			color: #3a0770;
		}

		td {
			font-family: 'PT Mono';
			max-width: 40em;
			word-break: break-all;
		}

		td.uri {
			color: #3a0770;
		}

		td.literal {
			color: #2f7504;
			word-break: break-word;
		}

		td.unbound {
			color: #ccc;
		}

		tbody tr:nth-child(even) {
			background-color: rgba(0, 0, 0, 0.02);
		}
	}
</style>

<div class="query">
	<div class="presets">
		<span>Presets:</span>
		{#each A_PRESETS as g_each (g_each.id)}
			<button class:active={g_preset?.id === g_each.id} on:click={() => select_preset(g_each.id)}>{g_each.label}</button>
		{/each}
		<button class:active={!g_preset} on:click={() => select_preset('')}>Custom</button>
	</div>

	{#if g_preset}
		<div class="description">{g_preset.description}</div>

		{#if g_preset.params.length}
			<div class="params">
				{#each g_preset.params as g_param (g_param.key)}
					<label>
						<span>{g_param.label}</span>
						<input type="text" placeholder={g_param.placeholder || ''}
							value={h_params[g_param.key]}
							on:input={(d_event) => {
								h_params = {...h_params, [g_param.key]: d_event.currentTarget.value};
								apply_params();
							}}
							on:keydown={keydown}>
						{#if g_param.hint}
							<span class="hint">{g_param.hint}</span>
						{/if}
					</label>
				{/each}
			</div>
		{/if}
	{/if}

	<textarea spellcheck="false" value={sx_query}
		on:input={(d_event) => edit_query(d_event.currentTarget.value)}
		on:keydown={keydown}></textarea>

	<details class="prefixes">
		<summary>{Object.keys(prefixes).length} prefixes (e.g. <code>mms:</code>, <code>m-user:</code>) are declared automatically; add your own <code>prefix</code> lines at the top of the query for anything else</summary>
		<pre>{sx_header}</pre>
	</details>

	<div class="actions">
		<button class="run" class:busy={b_running} disabled={b_running} on:click={run}>Run query</button>
		<span class="status">
			{#if b_running}
				Running…
			{:else if g_results}
				{#if 'results' in g_results}
					{g_results.results.bindings.length} row{1 === g_results.results.bindings.length? '': 's'} in {xt_elapsed} ms
				{:else}
					answered in {xt_elapsed} ms
				{/if}
			{:else}
				Ctrl+Enter to run
			{/if}
		</span>
	</div>

	{#if e_query}
		<div class="error">{e_query.message}</div>
	{:else if g_results}
		{#if 'boolean' in g_results}
			<div class="results">
				<table>
					<thead><tr><th>result</th></tr></thead>
					<tbody><tr><td class="literal">{g_results.boolean}</td></tr></tbody>
				</table>
			</div>
		{:else if !g_results.results.bindings.length}
			<div class="empty">No results.</div>
		{:else}
			{@const a_vars = g_results.head.vars}
			<div class="results">
				<table>
					<thead>
						<tr>
							<th>#</th>
							{#each a_vars as s_var}
								<th>?{s_var}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each g_results.results.bindings as h_row, i_row}
							<tr>
								<td class="unbound">{i_row+1}</td>
								{#each a_vars as s_var}
									{@const g_binding = h_row[s_var]}
									{#if !g_binding}
										<td class="unbound">—</td>
									{:else if 'uri' === g_binding.type}
										<td class="uri" title={g_binding.value}>{terse(g_binding)}</td>
									{:else}
										<td class="literal">{terse(g_binding)}</td>
									{/if}
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>
