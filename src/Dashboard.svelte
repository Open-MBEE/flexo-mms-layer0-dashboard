<script lang="ts">
	import InspectGraph from './InspectGraph.svelte';
	import TreeItem from './TreeItem.svelte';
	import RefPanel from './RefPanel.svelte';
	import CollectionPanel from './CollectionPanel.svelte';
	import QueryPanel from './QueryPanel.svelte';

	import '@rdfjs-elements/rdf-editor';
	import {
		Tabs,
		Tab,
		TabList,
		TabPanel,
	} from 'svelte-tabs';

	import type { Dict } from './util/types';
	import { onMount } from 'svelte';

	import type {
		ClusterData,
		OrgStruct,
		RepoStruct,
		RepoMetadata,
		RefStruct,
		RefType,
	} from '#/app/layer0';

	import {
		H_PREFIXES_DEFAULT,
		prefixes,
		load_cluster,
		load_repo,
		parse_ref_iri,
		value,
		k_endpoint,
	} from '#/app/layer0';

	type Selection =
		| {type: 'cluster'}
		| {type: 'registry'}
		| {type: 'org'; org: string}
		| {type: 'repo'; org: string; repo: string}
		| {type: 'collection'; org: string; collection: string}
		| {type: 'ref'; org: string; repo: string; ref: string};

	let g_cluster: ClusterData | null = null;
	let e_cluster: Error | null = null;
	let g_selection: Selection = {type: 'cluster'};

	// repo metadata is loaded lazily the first time a repo is expanded or selected
	let h_repos: Dict<RepoMetadata> = {};
	let h_repo_errors: Dict<Error> = {};
	const h_repo_pending: Dict<Promise<void>> = {};

	// tree expansion state keyed by node id; nodes absent from the dict use their default
	let h_expanded: Dict<boolean> = {};

	// bumped on every reload so responses from a previous endpoint are discarded
	let c_generation = 0;

	$: h_prefixes_share = (g_cluster?.prefixes || H_PREFIXES_DEFAULT) as typeof H_PREFIXES_DEFAULT;

	async function reload() {
		const i_generation = ++c_generation;

		g_cluster = null;
		e_cluster = null;
		h_repos = {};
		h_repo_errors = {};
		for(const p_repo of Object.keys(h_repo_pending)) delete h_repo_pending[p_repo];
		h_expanded = {};
		g_selection = {type: 'cluster'};

		try {
			const g_loaded = await load_cluster();
			if(i_generation === c_generation) g_cluster = g_loaded;
		}
		catch(e_load) {
			if(i_generation === c_generation) e_cluster = e_load as Error;
		}
	}

	onMount(() => {
		reload();
	});

	// takes the dict as an argument so template expressions re-evaluate when it changes
	function is_expanded(h_state: Dict<boolean>, si_node: string, b_default=false): boolean {
		return si_node in h_state? h_state[si_node]: b_default;
	}

	function toggle(si_node: string, b_default=false) {
		h_expanded = {
			...h_expanded,
			[si_node]: !is_expanded(h_expanded, si_node, b_default),
		};
	}

	function expand(...a_nodes: string[]) {
		h_expanded = {
			...h_expanded,
			...Object.fromEntries(a_nodes.map(si_node => [si_node, true])),
		};
	}

	function without<w_value>(h_dict: Dict<w_value>, si_key: string): Dict<w_value> {
		return Object.fromEntries(Object.entries(h_dict).filter(([si_entry]) => si_entry !== si_key));
	}

	function ensure_repo(g_org: OrgStruct, g_repo: RepoStruct, b_force=false): Promise<void> {
		const p_repo = g_repo.iri;
		if(h_repos[p_repo] && !b_force) return Promise.resolve();
		if(p_repo in h_repo_pending) return h_repo_pending[p_repo];

		const i_generation = c_generation;

		const dp_load: Promise<void> = load_repo(g_org, g_repo)
			.then((g_metadata) => {
				if(i_generation !== c_generation) return;
				h_repo_errors = without(h_repo_errors, p_repo);
				h_repos = {...h_repos, [p_repo]: g_metadata};
			})
			.catch((e_load) => {
				if(i_generation !== c_generation) return;
				h_repo_errors = {...h_repo_errors, [p_repo]: e_load as Error};
			})
			.finally(() => {
				if(h_repo_pending[p_repo] === dp_load) delete h_repo_pending[p_repo];
			});

		return h_repo_pending[p_repo] = dp_load;
	}

	function refresh_selected_repo(): Promise<void> {
		if(!g_selected_org || !g_selected_repo) return Promise.resolve();
		return ensure_repo(g_selected_org, g_selected_repo, true);
	}

	function select_org(g_org: OrgStruct) {
		g_selection = {type: 'org', org: g_org.iri};
	}

	function select_repo(g_org: OrgStruct, g_repo: RepoStruct) {
		g_selection = {type: 'repo', org: g_org.iri, repo: g_repo.iri};
		ensure_repo(g_org, g_repo);
	}

	function select_collection(g_org: OrgStruct, p_collection: string) {
		g_selection = {type: 'collection', org: g_org.iri, collection: p_collection};
	}

	function select_ref(g_org: OrgStruct, g_repo: RepoStruct, p_ref: string) {
		g_selection = {type: 'ref', org: g_org.iri, repo: g_repo.iri, ref: p_ref};
		ensure_repo(g_org, g_repo);
	}

	function toggle_repo(g_org: OrgStruct, g_repo: RepoStruct) {
		toggle(g_repo.iri);
		if(is_expanded(h_expanded, g_repo.iri)) ensure_repo(g_org, g_repo);
	}

	// jumps to a ref referenced by IRI (e.g. from a collection), expanding the tree along the way
	function navigate_to_ref(p_ref: string) {
		const g_parsed = parse_ref_iri(p_ref);
		if(!g_parsed || !g_cluster) return;

		for(const g_org of Object.values(g_cluster.orgs)) {
			const g_repo = g_org.repos[g_parsed.repo];
			if(!g_repo) continue;

			expand(g_org.iri, `${g_org.iri}#repos`, g_repo.iri, `${g_repo.iri}#${g_parsed.type}`, `${g_repo.iri}#${g_parsed.type}.auto`);
			select_ref(g_org, g_repo, p_ref);
			return;
		}
	}

	interface RefGroup {
		type: RefType;
		label: string;
		auto: boolean;
		always: boolean;
	}

	const A_REF_GROUPS: RefGroup[] = [
		{type: 'Branch', label: 'Branches', auto: false, always: true},
		{type: 'Lock', label: 'Tags / locks', auto: false, always: true},
		{type: 'Scratch', label: 'Scratches', auto: false, always: false},
		{type: 'Lock', label: 'Commit locks', auto: true, always: false},
	];

	function refs_of(g_metadata: RepoMetadata, s_type: RefType, b_auto=false): [string, RefStruct][] {
		return Object.entries(g_metadata.refs).filter(([, g_ref]) => s_type === g_ref.type && b_auto === g_ref.auto);
	}

	function is_selected(g_selection: Selection, g_target: Selection): boolean {
		return JSON.stringify(g_selection) === JSON.stringify(g_target);
	}

	function ref_label(g_ref: RefStruct): string {
		return value(g_ref.id) || g_ref.iri.slice(g_ref.iri.lastIndexOf('/')+1);
	}

	$: g_selected_org = g_cluster && 'org' in g_selection? g_cluster.orgs[g_selection.org]: null;
	$: g_selected_repo = g_selected_org && 'repo' in g_selection? g_selected_org.repos[g_selection.repo]: null;
	$: g_selected_collection = g_selected_org && 'collection' in g_selection? g_selected_org.collections[g_selection.collection]: null;
	$: g_selected_metadata = g_selected_repo? h_repos[g_selected_repo.iri]: null;
	$: g_selected_ref = g_selected_metadata && 'ref' in g_selection? g_selected_metadata.refs[g_selection.ref]: null;
</script>

<style lang="less">
	.app-bar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 16px 32px;
		min-height: 64px;
		padding: 8px 24px;
		background-color: var(--md-primary);
		color: var(--md-on-primary);
		box-shadow: var(--md-elevation-4);

		.title {
			display: flex;
			align-items: baseline;
			gap: 10px;
			margin-right: auto;
			font-size: 20px;
			font-weight: 500;
			letter-spacing: 0.0125em;

			small {
				font-size: 13px;
				font-weight: 400;
				opacity: 0.8;
			}
		}
	}

	.endpoints {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;

		label {
			display: flex;
			flex-direction: column;
			gap: 2px;
			color: rgba(255, 255, 255, 0.8);
			font-size: 11px;
			letter-spacing: 0.06em;
			text-transform: uppercase;
		}

		input {
			width: 22em;
			padding: 6px 10px;
			border-color: transparent;
			background-color: rgba(255, 255, 255, 0.16);
			color: var(--md-on-primary);
			font-family: var(--md-font-mono);
			font-size: 12px;

			&:hover {
				background-color: rgba(255, 255, 255, 0.24);
				border-color: transparent;
			}

			&:focus {
				background-color: var(--md-surface);
				color: var(--md-on-surface);
				border-color: transparent;
				box-shadow: none;
			}
		}
	}

	.content {
		padding: 24px;
	}

	.surface {
		padding: 0 24px 24px;
		background-color: var(--md-surface);
		border-radius: var(--md-radius);
		box-shadow: var(--md-elevation-1);
	}

	.cluster-iri {
		margin: 4px 0 16px;
		font-size: 12px;
	}

	.cluster {
		display: flex;
		align-items: stretch;
		gap: 24px;
		min-height: 60vh;
	}

	.tree {
		flex: 0 0 300px;
		max-width: 40vw;
		overflow: auto;
		padding-right: 16px;
		border-right: 1px solid var(--md-divider);
		font-size: 14px;

		ul {
			margin: 0;
			padding: 0;
		}

		.section {
			margin: 16px 0 4px;
			padding-left: 8px;
		}

		.status {
			padding: 4px 8px 4px 28px;
			color: var(--md-on-surface-disabled);
			font-style: italic;
		}

		.error {
			padding: 4px 8px 4px 28px;
			color: var(--md-error);
		}
	}

	.detail {
		flex: 1 1 auto;
		min-width: 0;
	}

	.breadcrumb {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
		font-size: 13px;
		color: var(--md-on-surface-medium);

		.crumb {
			color: var(--md-primary);
			cursor: pointer;

			&:hover {
				text-decoration: underline;
			}
		}
	}

	.detail .uri {
		font-size: 12px;
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

	.link {
		color: var(--md-primary);
		cursor: pointer;

		&:hover {
			text-decoration: underline;
		}
	}

	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin: 16px 0;

		.chip b {
			margin-right: 5px;
			color: var(--md-primary);
		}
	}
</style>

<header class="app-bar">
	<div class="title">Flexo MMS <small>Layer 0 Dashboard</small></div>

	<div class="endpoints">
		<label>
			Query endpoint
			<input type="text" id="query-url" spellcheck="false" value={k_endpoint.endpoint} on:change={(d_event) => {
				k_endpoint.endpoint = d_event.currentTarget.value;
				reload();
			}}>
		</label>
		<label>
			GSP endpoint
			<input type="text" id="gsp-url" spellcheck="false" value={k_endpoint.gsp} on:change={(d_event) => {
				k_endpoint.gsp = d_event.currentTarget.value;
				reload();
			}}>
		</label>
	</div>
</header>

<main class="content">
	<div class="surface">
	<Tabs>
		<TabList>
			<Tab>Cluster</Tab>

			<Tab>Transactions</Tab>

			<Tab>Access Control</Tab>

			<Tab>Query</Tab>
		</TabList>

		<!-- cluster -->
		<TabPanel>
			{#if e_cluster}
				<div class="banner">
					Failed to load cluster:
					<pre>{e_cluster.stack}</pre>
				</div>
			{:else if !g_cluster}
				<div class="loading">Loading cluster…</div>
			{:else}
				<div class="uri cluster-iri">{g_cluster.cluster}</div>

				<div class="cluster">
					<!-- tree -->
					<nav class="tree">
						<ul>
							<TreeItem label="Cluster metadata"
								selected={'cluster' === g_selection.type}
								on:select={() => g_selection = {type: 'cluster'}} />

							<TreeItem label="Graph registry"
								selected={'registry' === g_selection.type}
								on:select={() => g_selection = {type: 'registry'}} />
						</ul>

						<div class="section overline">Organizations</div>

						<ul>
							{#each Object.entries(g_cluster.orgs) as [p_org, g_org] (p_org)}
								{@const si_repos = `${p_org}#repos`}
								{@const si_collections = `${p_org}#collections`}

								<TreeItem label={value(g_org.id)}
									expandable
									expanded={is_expanded(h_expanded, p_org, true)}
									selected={is_selected(g_selection, {type: 'org', org: p_org})}
									on:toggle={() => toggle(p_org, true)}
									on:select={() => select_org(g_org)}>

									<!-- repos -->
									<TreeItem label="Repositories" group
										count={Object.keys(g_org.repos).length}
										expandable selectable={false}
										expanded={is_expanded(h_expanded, si_repos, true)}
										on:toggle={() => toggle(si_repos, true)}>

										{#each Object.entries(g_org.repos) as [p_repo, g_repo] (p_repo)}
											{@const g_metadata = h_repos[p_repo]}

											<TreeItem label={value(g_repo.id)}
												expandable
												expanded={is_expanded(h_expanded, p_repo)}
												selected={is_selected(g_selection, {type: 'repo', org: p_org, repo: p_repo})}
												on:toggle={() => toggle_repo(g_org, g_repo)}
												on:select={() => select_repo(g_org, g_repo)}>

												{#if h_repo_errors[p_repo]}
													<li class="error">Failed to load: {h_repo_errors[p_repo].message}</li>
												{:else if !g_metadata}
													<li class="status">Loading…</li>
												{:else}
													{#each A_REF_GROUPS as g_group (g_group.label)}
														{@const a_refs = refs_of(g_metadata, g_group.type, g_group.auto)}
														{@const si_group = `${p_repo}#${g_group.type}${g_group.auto? '.auto': ''}`}

														{#if g_group.always || a_refs.length}
															<TreeItem label={g_group.label} group
																count={a_refs.length}
																expandable selectable={false}
																expanded={is_expanded(h_expanded, si_group, !g_group.auto)}
																on:toggle={() => toggle(si_group, !g_group.auto)}>

																{#each a_refs as [p_ref, g_ref] (p_ref)}
																	<TreeItem label={ref_label(g_ref)}
																		selected={is_selected(g_selection, {type: 'ref', org: p_org, repo: p_repo, ref: p_ref})}
																		on:select={() => select_ref(g_org, g_repo, p_ref)} />
																{:else}
																	<li class="status">none</li>
																{/each}
															</TreeItem>
														{/if}
													{/each}
												{/if}
											</TreeItem>
										{:else}
											<li class="status">none</li>
										{/each}
									</TreeItem>

									<!-- collections -->
									<TreeItem label="Collections" group
										count={Object.keys(g_org.collections).length}
										expandable selectable={false}
										expanded={is_expanded(h_expanded, si_collections, true)}
										on:toggle={() => toggle(si_collections, true)}>

										{#each Object.entries(g_org.collections) as [p_collection, g_collection] (p_collection)}
											<TreeItem label={value(g_collection.id)}
												count={g_collection.collects.length}
												selected={is_selected(g_selection, {type: 'collection', org: p_org, collection: p_collection})}
												on:select={() => select_collection(g_org, p_collection)} />
										{:else}
											<li class="status">none</li>
										{/each}
									</TreeItem>
								</TreeItem>
							{:else}
								<li class="status">No organizations found</li>
							{/each}
						</ul>
					</nav>

					<!-- detail pane -->
					<section class="detail">
						{#if 'cluster' === g_selection.type}
							<h3>Cluster metadata</h3>
							<rdf-editor format="text/turtle" value={g_cluster.pretty}></rdf-editor>

						{:else if 'registry' === g_selection.type}
							<h3>Graph registry</h3>
							<rdf-editor format="text/turtle" value={g_cluster.registry}></rdf-editor>

						{:else if !g_selected_org}
							<p class="missing">Selected organization no longer exists.</p>

						{:else}
							{@const g_org = g_selected_org}

							<div class="breadcrumb">
								<span class="crumb" on:click={() => select_org(g_org)}>{value(g_org.id)}</span>
								{#if g_selected_repo}
									{@const g_repo = g_selected_repo}
									<span>/</span>
									<span class="crumb" on:click={() => select_repo(g_org, g_repo)}>{value(g_repo.id)}</span>
								{/if}
								{#if g_selected_collection}
									<span>/</span>
									<span>{value(g_selected_collection.id)}</span>
								{/if}
								{#if g_selected_ref}
									<span>/</span>
									<span>{ref_label(g_selected_ref)}</span>
								{/if}
							</div>

							{#if 'org' === g_selection.type}
								<h3 class="literal">{value(g_selected_org.title) || value(g_selected_org.id)}</h3>
								<div class="uri">{g_selected_org.iri}</div>

								<dl class="props">
									<dt>id</dt>
									<dd class="literal">{value(g_selected_org.id)}</dd>
									{#if value(g_selected_org.etag)}
										<dt>etag</dt>
										<dd class="literal">{value(g_selected_org.etag)}</dd>
									{/if}
									<dt>repositories</dt>
									<dd>
										{#each Object.entries(g_selected_org.repos) as [p_repo, g_repo], i_repo (p_repo)}
											{#if i_repo}, {/if}
											<span class="link" on:click={() => select_repo(g_org, g_repo)}>{value(g_repo.id)}</span>
										{:else}
											<span class="missing">none</span>
										{/each}
									</dd>
									<dt>collections</dt>
									<dd>
										{#each Object.entries(g_selected_org.collections) as [p_collection, g_collection], i_collection (p_collection)}
											{#if i_collection}, {/if}
											<span class="link" on:click={() => select_collection(g_org, p_collection)}>{value(g_collection.id)}</span>
										{:else}
											<span class="missing">none</span>
										{/each}
									</dd>
								</dl>

							{:else if 'collection' === g_selection.type}
								{#if g_selected_collection}
									<CollectionPanel org={g_selected_org} collection={g_selected_collection}
										on:navigate={(d_event) => navigate_to_ref(d_event.detail)} />
								{:else}
									<p class="missing">Selected collection no longer exists.</p>
								{/if}

							{:else if !g_selected_repo}
								<p class="missing">Selected repository no longer exists.</p>

							{:else if h_repo_errors[g_selected_repo.iri]}
								<div class="banner">
									Failed to load repository metadata:
									<pre>{h_repo_errors[g_selected_repo.iri].stack}</pre>
								</div>

							{:else if !g_selected_metadata}
								<div class="loading">Loading repository metadata…</div>

							{:else if 'repo' === g_selection.type}
								{@const p_metadata = `${prefixes({org: value(g_selected_org.id), repo: value(g_selected_repo.id)})['mor-graph']}Metadata`}

								<h3 class="literal">{value(g_selected_repo.title) || value(g_selected_repo.id)}</h3>
								<div class="uri">{g_selected_repo.iri}</div>

								<div class="summary">
									<span class="chip"><b>{refs_of(g_selected_metadata, 'Branch').length}</b> branches</span>
									<span class="chip"><b>{refs_of(g_selected_metadata, 'Lock').length}</b> tags / locks</span>
									<span class="chip"><b>{refs_of(g_selected_metadata, 'Scratch').length}</b> scratches</span>
									<span class="chip"><b>{refs_of(g_selected_metadata, 'Lock', true).length}</b> commit locks</span>
								</div>

								{#key g_selected_repo.iri}
									<InspectGraph graph={p_metadata} preload={g_selected_metadata.pretty} prefixes={h_prefixes_share}
										reload={refresh_selected_repo}>
										<svelte:fragment slot="actions">
											<button class="new-branch success">New Branch</button>
										</svelte:fragment>
									</InspectGraph>
								{/key}

							{:else if g_selected_ref}
								{#key g_selected_ref.iri}
									<RefPanel org={g_selected_org} repo={g_selected_repo} ref={g_selected_ref} prefixes={h_prefixes_share} />
								{/key}

							{:else}
								<p class="missing">Selected ref was not found in this repository's metadata.</p>
							{/if}
						{/if}
					</section>
				</div>
			{/if}
		</TabPanel>

		<!-- transactions -->
		<TabPanel>
			<InspectGraph graph={`${H_PREFIXES_DEFAULT['m-graph']}Transactions`} sort="-created" />
		</TabPanel>

		<!-- access control -->
		<TabPanel>
			<Tabs>
				<TabList>
					<Tab>Agents</Tab>
					<Tab>Policies</Tab>
					<Tab>Definitions</Tab>
				</TabList>

				<!-- agents -->
				<TabPanel>
					<InspectGraph graph={H_PREFIXES_DEFAULT['m-graph']+'AccessControl.Agents'} />
				</TabPanel>

				<!-- policies -->
				<TabPanel>
					<InspectGraph graph={H_PREFIXES_DEFAULT['m-graph']+'AccessControl.Policies'} />
				</TabPanel>

				<!-- definitions -->
				<TabPanel>
					<InspectGraph graph={H_PREFIXES_DEFAULT['m-graph']+'AccessControl.Definitions'} />
				</TabPanel>
			</Tabs>
		</TabPanel>

		<!-- query -->
		<TabPanel>
			<QueryPanel prefixes={h_prefixes_share} generation={c_generation} />
		</TabPanel>
	</Tabs>
	</div>
</main>
