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
		background-color: rgba(106, 27, 154, 0.12);
		color: #6a1b9a;
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

	table {
		width: 100%;
	}

	.type {
		font-size: 11px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--md-on-surface-medium);
	}

	.link {
		color: var(--md-primary);
		cursor: pointer;

		&:hover {
			text-decoration: underline;
		}
	}
</style>

<h4>
	<span class="chip badge">collection</span>
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
	<p class="missing">This collection does not collect any refs.</p>
{/if}
