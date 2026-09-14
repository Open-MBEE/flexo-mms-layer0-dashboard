<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import type {
		OrgStruct,
		CollectionStruct,
	} from '#/app/layer0';

	import {
		parse_ref_iri,
		value,
	} from '#/app/layer0';

	export let org: OrgStruct;
	export let collection: CollectionStruct;

	const dispatch = createEventDispatcher<{navigate: string}>();

	const H_TYPE_LABELS = {
		Branch: 'branch',
		Lock: 'tag / lock',
		Scratch: 'scratch',
	};

	$: a_rows = collection.collects.map((p_ref) => {
		const g_parsed = parse_ref_iri(p_ref);
		const g_repo = g_parsed? org.repos[g_parsed.repo]: null;

		return {
			iri: p_ref,
			parsed: g_parsed,
			repo: g_repo,
		};
	});
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
		background-color: #7a2ea8;
		border-radius: 3px;
		padding: 2px 6px;
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

	table {
		border-collapse: collapse;
		font-size: 14px;

		th, td {
			text-align: left;
			padding: 4px 12px 4px 0;
			border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		}

		th {
			font-weight: 500;
			color: #666;
		}
	}

	.type {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #666;
	}

	.link {
		color: #3458eb;
		cursor: pointer;
		text-decoration: underline;
	}

	.missing {
		color: #999;
		font-style: italic;
	}
</style>

<h4>
	<span class="badge">collection</span>
	<span class="literal">{value(collection.id)}</span>
	{#if value(collection.title)}
		<span class="literal">— {value(collection.title)}</span>
	{/if}
</h4>

<div class="uri">{collection.iri}</div>

<dl class="props">
	{#if value(collection.etag)}
		<dt>etag</dt>
		<dd class="literal">{value(collection.etag)}</dd>
	{/if}
	<dt>org</dt>
	<dd class="uri">{collection.org}</dd>
	<dt>collects</dt>
	<dd>{collection.collects.length} ref{1 === collection.collects.length? '': 's'}</dd>
</dl>

{#if a_rows.length}
	<table>
		<thead>
			<tr>
				<th>Repo</th>
				<th>Type</th>
				<th>Ref</th>
				<th>IRI</th>
			</tr>
		</thead>
		<tbody>
			{#each a_rows as g_row (g_row.iri)}
				<tr>
					<td>
						{#if g_row.repo}
							<span class="literal">{value(g_row.repo.id)}</span>
						{:else if g_row.parsed}
							<span class="missing">{g_row.parsed.repo}</span>
						{:else}
							<span class="missing">—</span>
						{/if}
					</td>
					<td class="type">{g_row.parsed? H_TYPE_LABELS[g_row.parsed.type]: '—'}</td>
					<td>
						{#if g_row.repo && g_row.parsed}
							<span class="link" on:click={() => dispatch('navigate', g_row.iri)}>{g_row.parsed.id}</span>
						{:else if g_row.parsed}
							{g_row.parsed.id}
						{:else}
							<span class="missing">—</span>
						{/if}
					</td>
					<td class="uri">{g_row.iri}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p>This collection does not collect any refs.</p>
{/if}
