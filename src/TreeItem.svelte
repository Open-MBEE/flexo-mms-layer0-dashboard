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
		gap: 4px;
		padding: 2px 6px 2px 2px;
		border-radius: 3px;
		white-space: nowrap;
		cursor: default;

		&:hover {
			background-color: rgba(0, 0, 0, 0.05);
		}

		&.selected {
			background-color: rgba(52, 88, 235, 0.15);

			.label {
				color: #3458eb;
				font-weight: 500;
			}
		}

		&.selectable {
			cursor: pointer;
		}
	}

	.twisty {
		flex: none;
		width: 16px;
		height: 16px;
		line-height: 16px;
		text-align: center;
		font-size: 10px;
		color: #666;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;

		:global(body &) {
			background-color: transparent;
			color: #666;
			border: none;
			padding: 0;
			font-size: 10px;
		}
	}

	.label {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.group .label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #666;
	}

	.count {
		font-size: 11px;
		color: #888;
		background-color: rgba(0, 0, 0, 0.06);
		border-radius: 8px;
		padding: 0 6px;
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
