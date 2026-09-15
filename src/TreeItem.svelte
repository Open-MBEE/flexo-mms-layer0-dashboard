<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let label: string;
	export let count: number | null = null;
	export let expandable = false;
	export let expanded = false;
	export let selectable = true;
	export let selected = false;
	export let group = false;

	const dispatch = createEventDispatcher<{select: void; toggle: void}>();

	function activate() {
		if(selectable) {
			dispatch('select');
		}
		else if(expandable) {
			dispatch('toggle');
		}
	}
</script>

<style lang="less">
	li {
		list-style: none;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 32px;
		padding: 0 8px 0 4px;
		border-radius: 0 16px 16px 0;
		white-space: nowrap;
		cursor: default;
		transition: background-color 0.15s;

		&:hover {
			background-color: var(--md-hover);
		}

		&.selected {
			background-color: var(--md-primary-tint);

			.label {
				color: var(--md-primary);
				font-weight: 500;
			}
		}

		&.selectable {
			cursor: pointer;
		}
	}

	// the twisty is a plain glyph, not a Material button
	.twisty {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		width: 20px;
		height: 20px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background-color: transparent;
		color: var(--md-on-surface-medium);
		font-size: 10px;
		box-shadow: none;
		cursor: pointer;

		&:hover {
			background-color: rgba(0, 0, 0, 0.08);
			box-shadow: none;
		}
	}

	span.twisty:hover {
		background-color: transparent;
	}

	.label {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.group .label {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--md-on-surface-medium);
	}

	.count {
		min-width: 8px;
		padding: 0 7px;
		border-radius: 10px;
		background-color: rgba(0, 0, 0, 0.08);
		color: var(--md-on-surface-medium);
		font-size: 11px;
		font-weight: 500;
		line-height: 18px;
		text-align: center;
	}

	ul {
		margin: 0;
		padding-left: 16px;
	}
</style>

<li>
	<div class="row" class:selected class:selectable class:group>
		{#if expandable}
			<button type="button" class="twisty" on:click|stopPropagation={() => dispatch('toggle')} aria-label={expanded? 'Collapse': 'Expand'}>
				{expanded? '▼': '▶'}
			</button>
		{:else}
			<span class="twisty"></span>
		{/if}

		<span class="label" on:click={activate} on:dblclick={() => expandable && dispatch('toggle')}>{label}</span>

		{#if null !== count}
			<span class="count">{count}</span>
		{/if}
	</div>

	{#if expandable && expanded}
		<ul>
			<slot></slot>
		</ul>
	{/if}
</li>
