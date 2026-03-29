# 2.13 Knowledge Graphs and Semantic Intelligence

The application of knowledge graph technologies to intelligence analysis has emerged as a significant research and operational priority as defense organizations confront the challenge of integrating heterogeneous information sources into coherent, queryable semantic models. BASTION's brain visualization and entity resolution capabilities are grounded in this research tradition. This section surveys the foundational concepts and relevant literature.

## 2.13.1 Knowledge Graphs for Intelligence Analysis and Sense-Making

A knowledge graph is a structured representation of entities (persons, places, organizations, capabilities, events) and the relationships between them, encoded as a graph of nodes and edges with typed predicates.[^kg1] In intelligence analysis, knowledge graphs serve as a substrate for sense-making, the process by which analysts construct coherent narratives from fragmentary, often contradictory, evidence. Traditional databases store facts in tabular structures optimized for known queries; knowledge graphs allow analysts to traverse relationship chains, identify indirect connections, and discover structural patterns that remain invisible in flat representations.[^kg1] Pirolli and Card formalized this iterative process of constructing coherent narratives from fragmentary evidence as the "sensemaking loop," identifying leverage points where technology can accelerate analyst cognition.[^kg2]

Military intelligence agencies have invested in knowledge graph infrastructure as a component of their all-source fusion capabilities. Projects such as IARPA's CAUSE (Causal, Counterfactual, and Contrastive Explanations) and DARPA's Big Mechanism program have explored graph-based approaches to causal reasoning over intelligence text.[^kg3] BASTION's RAFT (Retrieval-Augmented Fusion with Typing) graph extends this approach to the operational planning domain, capturing entities extracted from planning documents and intelligence feeds as a live graph that evolves with the operational situation.

## 2.13.2 JSON-LD and Semantic Web Standards in Defense Contexts

JSON-LD (JavaScript Object Notation for Linked Data) is a W3C standard that enables structured data to carry semantic context through linked namespaces and type definitions.[^jsonld1] JSON-LD documents are simultaneously valid JSON (parseable by any JSON library) and valid RDF (Resource Description Framework) serializations, enabling integration with semantic reasoning tools. This dual nature makes JSON-LD attractive for defense information exchange: it interoperates with web infrastructure and existing data pipelines while supporting the ontological richness required for cross-domain intelligence fusion.

Defense information architectures have historically relied on XML-based standards (UCORE, NIEM) for structured data exchange. The shift toward JSON-LD reflects broader trends in web-oriented architecture adoption within the defense enterprise and offers advantages in tooling maturity, developer accessibility, and integration with modern AI pipelines that process JSON natively.[^jsonld2] BASTION's knowledge graph uses JSON-LD for entity serialization, enabling direct export to RDF triple stores and compatibility with SPARQL-based query tools used in intelligence analysis platforms.

## 2.13.3 Graph Visualization: Force-Directed Layouts and Neural Canvas Approaches

Visualizing large knowledge graphs presents a fundamental challenge: graph drawing algorithms must balance aesthetic criteria (minimizing edge crossings, distributing nodes evenly) with semantic criteria (placing related entities near each other, highlighting high-importance nodes) within interactive performance constraints.[^viz1] Fruchterman-Reingold pioneered force-directed layout algorithms, and numerous variants have since refined them; these algorithms simulate physical systems where nodes repel each other and edges act as springs, converging to layouts that reveal graph structure without requiring explicit hierarchical or temporal arrangement.[^viz2]

BASTION's brain visualization extends force-directed layout with neural metaphor design. The implementation uses d3-force (via react-force-graph-3d) with adaptive simulation parameters that scale to graph size. Node importance (determined by eigenvalue centrality and a synthesized confidence score combining source document count, relationship count, and validity score) controls node scale and glow intensity: confidence drives a 0-20 pixel shadow blur, while nodes above 0.6 centrality receive emissive glow through Three.js MeshStandardMaterial. Edge weight (derived from relationship strength) controls both thickness (0.5 to 2.5 pixels proportional to strength) and opacity (0.1 to 0.5 in 3D rendering). Entity types render as distinct 3D geometries (spheres for entities, octahedra for objectives, dodecahedra for concepts) against a deep navy background with heat-map coloring for centrality, producing a visualization that resembles an abstract neural network. This design makes the semantic density of intelligence relationships visually interpretable to analysts without requiring graph theory expertise, reflecting research on cognitive fit between visualization metaphor and analyst mental models.[^viz3]

## 2.13.4 Entity Resolution and Confidence Scoring in Multi-Source Intelligence Fusion

Entity resolution (determining whether two references to a named entity (a person, organization, location, or military unit) in different documents refer to the same real-world entity) is a fundamental challenge in intelligence fusion.[^er1] Named entity references are noisy: transliterations vary, abbreviations are context-dependent, and adversaries deliberately introduce ambiguity. Entity resolution algorithms use string similarity, context embedding similarity, and structural graph evidence to make probabilistic merge decisions, producing entity clusters where each cluster represents a single real-world entity with multiple textual variants.

Confidence scoring in intelligence products follows NATO's Admiralty Code, which rates source reliability (A through F) independently of information quality (1 through 6).[^er2] BASTION applies this framework at the entity level: each entity in the knowledge graph carries source reliability ratings derived from the provenance of the documents that introduced it. Conflicting claims from different sources produce competing entity attributes with differential confidence, allowing analysts to inspect the evidentiary basis for each claim rather than receiving a single merged verdict. This approach reflects the intelligence community's emphasis on maintaining analytical uncertainty rather than prematurely collapsing ambiguity into false certainty.[^er3]

## 2.13.5 Ontology Alignment and Interoperability Standards

Defense knowledge graphs must interoperate with existing ontological frameworks to enable cross-system intelligence sharing. The Basic Formal Ontology (BFO) provides a foundational upper ontology that domain-specific defense ontologies extend.[^onto1] The Common Core Ontologies (CCO), developed under the Information Warfare Cross-Functional Team, provide mid-level ontologies for military domains including geospatial, temporal, and organizational concepts. The DoDAF/DM2 (DoD Architecture Framework Data Model) provides data architecture standards for system interoperability documentation.

BASTION's knowledge graph uses a pragmatic approach: it types entities using a vocabulary drawn from military planning doctrine (units, capabilities, objectives, lines of effort, tasks, constraints) rather than formalizing against BFO or CCO. This design decision prioritizes operational utility over formal ontological rigor; analysts and planners can contribute to and query the graph using familiar doctrinal terminology without ontology expertise. Future work (noted in Section 5) addresses alignment of BASTION's entity vocabulary with CCO for interoperability with other defense knowledge graph systems.[^onto2]

---

[^kg1]: Aidan Hogan et al., "Knowledge Graphs," *ACM Computing Surveys* 54, no. 4 (2021): 1-37, https://doi.org/10.1145/3447772.

[^kg2]: Pirolli, Peter and Stuart Card, "The Sensemaking Process and Leverage Points for Analyst Technology as Identified Through Cognitive Task Analysis," in *Proceedings of the 2005 International Conference on Intelligence Analysis* (McLean, VA: MITRE, 2005), https://analysis.mitre.org/proceedings/Final_Papers_Files/206_Camera_Ready_Paper.pdf.

[^kg3]: DARPA, "Big Mechanism," Defense Advanced Research Projects Agency, accessed March 2026, https://www.darpa.mil/research/programs/big-mechanism. See also IARPA, "CAUSE," Office of the Director of National Intelligence, https://www.iarpa.gov/research-programs/cause.

[^jsonld1]: Gregg Kellogg, Pierre-Antoine Champin, and Dave Longley, eds., "JSON-LD 1.1: A JSON-based Serialization for Linked Data," W3C Recommendation, July 16, 2020, https://www.w3.org/TR/json-ld11/.

[^jsonld2]: Department of Defense Chief Information Officer, "DoD Architecture Framework Version 2.02," Department of Defense, accessed March 2026, https://dodcio.defense.gov/Library/DoD-Architecture-Framework/. See also Department of Defense, *DoD Data Strategy* (Washington, DC: DoD CIO, October 2020), https://media.defense.gov/2020/Oct/08/2002514180/-1/-1/0/DOD-DATA-STRATEGY.PDF.

[^viz1]: Ivan Herman, Guy Melancon, and M. Scott Marshall, "Graph Visualization and Navigation in Information Visualization: A Survey," *IEEE Transactions on Visualization and Computer Graphics* 6, no. 1 (2000): 24-43, https://doi.org/10.1109/2945.841119.

[^viz2]: Thomas M. J. Fruchterman and Edward M. Reingold, "Graph Drawing by Force-Directed Placement," *Software: Practice and Experience* 21, no. 11 (1991): 1129-1164, https://doi.org/10.1002/spe.4380211102.

[^viz3]: Stuart K. Card, Jock D. Mackinlay, and Ben Shneiderman, eds., *Readings in Information Visualization: Using Vision to Think* (San Francisco: Morgan Kaufmann, 1999).

[^er1]: Ahmed K. Elmagarmid, Panagiotis G. Ipeirotis, and Vassilios S. Verykios, "Duplicate Record Detection: A Survey," *IEEE Transactions on Knowledge and Data Engineering* 19, no. 1 (2007): 1-16, https://doi.org/10.1109/TKDE.2007.250581.

[^er2]: NATO Standardization Office, "STANAG 2022: Intelligence Reports," 8th ed. (Brussels: NATO, 2017).

[^er3]: Richards J. Heuer Jr. and Randolph H. Pherson, *Structured Analytic Techniques for Intelligence Analysis*, 3rd ed. (Washington, DC: CQ Press, 2020).

[^onto1]: Barry Smith et al., "Basic Formal Ontology 2.0: Specification and User's Guide," National Center for Ontological Research, 2015, https://basic-formal-ontology.org/.

[^onto2]: Common Core Ontologies Working Group, "Common Core Ontologies," version 2.0, released November 6, 2024, https://github.com/CommonCoreOntology/CommonCoreOntologies.
