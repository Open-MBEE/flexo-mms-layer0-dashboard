<script lang="ts">
	import InspectGraph from './InspectGraph.svelte';
	
	import '@rdfjs-elements/rdf-editor'; 
	import {
		Tabs,
		Tab,
		TabList,
		TabPanel,
	} from 'svelte-tabs';

	import read_ttl from '@graphy/content.ttl.read';
	import write_ttl from '@graphy/content.ttl.write';
	import dataset from '@graphy/memory.dataset.fast';
	import factory from '@graphy/core.data.factory';
	import SparqlEndpoint from './util/sparql-endpoint';
	import type { Dict } from './util/types';
	import { onMount, setContext } from 'svelte';

	import {
		P_IRI_MMS,
		P_IRI_ROOT_CONTEXT,
		P_IRI_SPARQL_ENDPOINT,
		H_PREFIXES_DEFAULT,
		SV1_MMS,
		SV1_DCT,
		SV1_RDF,
		first,
		prefixes,
		download,
		k_endpoint,
		type OrgStruct,
		type ClusterObject,
		type Downloaded,
	} from '#/app/layer0';

	function terse(sv1_term: string): string {
		return factory.c1(sv1_term).terse(h_prefixes_share);
	}

	function value(sv1_term: string): string {
		return factory.c1(sv1_term).value;
	}

	let p_cluster = '';
	let st_cluster = '';
	let h_orgs_repos: Dict<OrgStruct> = {};
	let h_prefixes_share: Dict = {};


	async function reload() {
		const h_orgs_repos_local: Dict<OrgStruct> = {};

		const g_downloaded = await download(`
			construct { ?s ?p ?o }
			where {
				graph m-graph:Cluster {
					?s ?p ?o
				}
			}
		`, {}, (g_quad) => {
			if('mms:org' === g_quad.predicate.concise(H_PREFIXES_DEFAULT)) {
				const p_org = g_quad.object.value;
				const g_org = h_orgs_repos_local[p_org] = h_orgs_repos_local[p_org] || {repos: {}};
				g_org.repos[g_quad.subject.value] = {} as RepoStruct;
			}
			else if('mms:Cluster' === g_quad.object.concise(H_PREFIXES_DEFAULT)) {
				p_cluster = g_quad.subject.value;
			}
		});

		st_cluster = g_downloaded.pretty;
		h_prefixes_share = g_downloaded.prefixes;
		const hc3_cluster = g_downloaded.triples;

		for(const [p_org, g_org] of Object.entries(h_orgs_repos_local)) {
			const hc2_org = hc3_cluster['>'+p_org];

			Object.assign(g_org, {
				id: first(hc2_org[SV1_MMS+'id']),
				title: first(hc2_org[SV1_DCT+'title']),
				etag: first(hc2_org[SV1_MMS+'etag']),
			});

			for(const [p_repo, g_repo] of Object.entries(g_org.repos)) {
				const hc2_repo = hc3_cluster['>'+p_repo];

				Object.assign(g_repo, {
					id: first(hc2_repo[SV1_MMS+'id']),
					title: first(hc2_repo[SV1_DCT+'title']),
					etag: first(hc2_repo[SV1_MMS+'etag']),
					pairs: hc2_repo,
				});
			}

			// sort repos
			g_org.repos = Object.fromEntries(Object.entries(g_org.repos).sort(([p_repo_a], [p_repo_b]) => p_repo_a.localeCompare(p_repo_b)));
		}

		h_orgs_repos = h_orgs_repos_local;
	}

	onMount(() => {
		reload();
	});

	const SQ_REPO_METADATA = `
		construct { ?s ?p ?o }
		where {
			graph mor-graph:Metadata {
				?s ?p ?o
			}
		}
	`;

	interface BranchStruct extends ClusterObject {
		commit: string;
		snapshots: Dict<{
			type: string;
			graph: string;
		}>;
	}

	async function download_repo(g_org, g_repo): Promise<Downloaded & {branches:Dict<BranchStruct>}> {
		const h_branches: Dict<BranchStruct> = {};

		const g_download = await download(SQ_REPO_METADATA, {
			org: value(g_org.id),
			repo: value(g_repo.id),
		}, (g_quad) => {
			if('mms:Branch' === g_quad.object.concise(H_PREFIXES_DEFAULT)) {
				const p_branch = g_quad.subject.value;
				h_branches[p_branch] = h_branches[p_branch] = {} as BranchStruct;
			}
		});

		const {
			pretty: st_repo,
			triples: hc3_repo,
		} = g_download;

		for(const [p_branch, g_branch] of Object.entries(h_branches)) {
			const hc2_branch = hc3_repo['>'+p_branch];

			Object.assign(g_branch, {
				id: first(hc2_branch[SV1_MMS+'id'], '"'),
				title: first(hc2_branch[SV1_DCT+'title'], '"'),
				etag: first(hc2_branch[SV1_MMS+'etag'], '"'),
				commit: first(hc2_branch[SV1_MMS+'commit'], '"'),
				snapshots: [...(hc2_branch[SV1_MMS+'snapshot'] || [])].reduce((h_out, sv1_snapshot) => {
					const hc2_snapshot = hc3_repo[sv1_snapshot];
					return {
						...h_out,
						[value(sv1_snapshot)]: {
							type: first(hc2_snapshot[SV1_RDF+'type']),
							graph: value(first(hc2_snapshot[SV1_MMS+'graph'])),
						},
					};
				}, {}),
			});
		}

		return {
			...g_download,
			branches: h_branches,
		};
	}

	async function model_stats(p_graph: string) {
		const a_results = await k_endpoint.select(`
			select (count(*) as ?count) {
				graph <${p_graph}> {
					?s ?p ?o .
				}
			}
		`);
		
		return {
			count: +a_results[0].count.value,
		};
	}
</script>

<style lang="less">
	@import url('https://fonts.googleapis.com/css2?family=PT+Mono&family=Poppins&family=Roboto&display=swap');

	body {
		button {
			:global(&) {
				background-color: #3458eb;
				color: white;
				border: 1px solid rgba(0, 0, 0, 0.2);
				font-size: 14px;
				padding: 6px 10px;
				cursor: pointer;
			}
		}
	}

	main {
		font-family: Roboto;
	}

	.uri {
		font-family: 'PT Mono';
		color: #3a0770;
	}

	.literal {
		color: #2f7504;
	}

	.repos {
		display: flex;

		.repo {

		}
	}
</style>

<main>
	<Tabs>
		<TabList>
			<Tab>Cluster</Tab>

			<Tab>Transactions</Tab>

			<Tab>Access Control</Tab>
		</TabList>

		<!-- cluster -->
		<TabPanel>
			<h2 class="uri">{p_cluster}</h2>

			<Tabs>
				<TabList>
					<!-- cluster metadata -->
					<Tab>(cluster metadata)</Tab>

					<!-- each org -->
					{#each Object.entries(h_orgs_repos) as [p_org, g_org]}
						<Tab>{value(g_org.id)}</Tab>
					{/each}
				</TabList>

				<!-- cluster metadata tab -->
				<TabPanel>
					<rdf-editor format="text/turtle" value={st_cluster}></rdf-editor>
				</TabPanel>

				<!-- each org -->
				{#each Object.entries(h_orgs_repos) as [p_org, g_org]}
					<!-- org -->
					<TabPanel>
						<h3 class="literal">{terse(g_org.title)}</h3>

						<!-- org info -->


						<!-- repos -->
						<Tabs>
							<TabList>
								<!-- each repo -->
								{#each Object.entries(g_org.repos) as [p_repo, g_repo]}
									<Tab>{value(g_repo.id)}</Tab>
								{/each}
							</TabList>

							<!-- each repo -->
							{#each Object.entries(g_org.repos) as [p_repo, g_repo]}
								{@const g_prefixes = prefixes({org:value(g_org.id), repo:value(g_repo.id)})}
								{@const p_metadata = `${g_prefixes['mor-graph']}Metadata`}

								<TabPanel>
									<h4 class="literal">{terse(g_repo.title)}</h4>

									{#await download_repo(g_org, g_repo)}
										Loading...
									{:then gd_repo}
										<!-- repo panel -->
										<Tabs>
											<TabList>
												<Tab>(repo metadata)</Tab>

												{#each Object.entries(gd_repo.branches) as [p_branch, g_branch]}
													<Tab>{value(g_branch.id)}</Tab>
												{/each}
											</TabList>

											<!-- all metadata -->
											<TabPanel>
												<InspectGraph graph={p_metadata} preload={gd_repo.pretty} prefixes={h_prefixes_share} />
											</TabPanel>

											{#each Object.entries(gd_repo.branches) as [p_branch, g_branch]}
												<TabPanel>
													<h6 class="literal">{terse(g_branch.id)}</h6>

													<Tabs>
														<TabList>
															{#each Object.entries(g_branch.snapshots) as [p_snapshot, g_snapshot]}
																<Tab>{terse(g_snapshot.type)}</Tab>
															{/each}
														</TabList>

														{#each Object.entries(g_branch.snapshots) as [p_snapshot, g_snapshot]}
															<TabPanel>
																<div class="uri">{g_snapshot.graph}</div>

																{#await model_stats(g_snapshot.graph)}
																	Loading...
																{:then g_model}
																	Triple count: {g_model.count}
																{:catch e_load}
																	Failed to load:
																	<pre>{e_load.stack}</pre>
																{/await}
															</TabPanel>
														{/each}
													</Tabs>
												</TabPanel>
											{/each}
										</Tabs>
									{:catch e_download}
										Failed to load:
										<pre>{e_download.stack}</pre>
									{/await}
								</TabPanel>
							{/each}
						</Tabs>
					</TabPanel>
				{/each}
			</Tabs>
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
	</Tabs>

</main>
