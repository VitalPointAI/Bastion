## 2.5 Knowledge Graphs and Semantic Intelligence

The application of knowledge graph technologies to intelligence analysis has emerged as a significant research and operational priority as defense organizations confront the challenge of integrating heterogeneous information sources into coherent, queryable semantic models. BASTION's brain visualization and entity resolution capabilities are grounded in this research tradition. This section surveys the foundational concepts and relevant literature.

### 2.5.1 Knowledge Graphs for Intelligence Analysis and Sense-Making

A knowledge graph is a structured representation of entities (persons, places, organizations, capabilities, events) and the relationships between them, encoded as a graph of nodes and edges with typed predicates.[^kg1] In intelligence analysis, knowledge graphs serve as a substrate for sense-making — the process by which analysts construct coherent narratives from fragmentary, often contradictory, evidence. Where traditional databases store facts in tabular structures optimized for known queries, knowledge graphs allow analysts to traverse relationship chains, identify indirect connections, and discover structural patterns that would be invisible in flat representations.[^kg2]

Military intelligence agencies have invested in knowledge graph infrastructure as a component of their all-source fusion capabilities. Projects such as IARPA's CAUSE (Causal, Counterfactual, and Contrastive Explanations) and DARPA's Big Mechanism program have explored graph-based approaches to causal reasoning over intelligence text.[^kg3] BASTION's RAFT (Retrieval-Augmented Fusion with Typing) graph extends this approach to the operational planning domain, capturing entities extracted from planning documents and intelligence feeds as a live graph that evolves with the operational situation.

### 2.5.2 JSON-LD and Semantic Web Standards in Defense Contexts

JSON-LD (JavaScript Object Notation for Linked Data) is a W3C standard that enables structured data to carry semantic context through the use of linked namespaces and type definitions.[^jsonld1] JSON-LD documents are simultaneously valid JSON (parseable by any JSON library) and valid RDF (Resource Description Framework) serializations, enabling integration with semantic reasoning tools. This dual nature makes JSON-LD attractive for defense information exchange: it is interoperable with web infrastructure and existing data pipelines while supporting the ontological richness required for cross-domain intelligence fusion.

Defense information architectures have historically relied on XML-based standards (UCORE, NIEM) for structured data exchange. The shift toward JSON-LD reflects broader trends in web-oriented architecture adoption within the defense enterprise and offers advantages in tooling maturity, developer accessibility, and integration with modern AI pipelines that process JSON natively.[^jsonld2] BASTION's knowledge graph uses JSON-LD for entity serialization, enabling direct export to RDF triple stores and compatibility with SPARQL-based query tools used in intelligence analysis platforms.

### 2.5.3 Graph Visualization: Force-Directed Layouts and Neural Canvas Approaches

Visualizing large knowledge graphs presents a fundamental challenge: graph drawing algorithms must balance aesthetic criteria (minimizing edge crossings, distributing nodes evenly) with semantic criteria (placing related entities near each other, highlighting high-importance nodes) within interactive performance constraints.[^viz1] Force-directed layout algorithms, pioneered by Fruchterman-Reingold and refined through numerous variants, simulate physical systems where nodes repel each other and edges act as springs, converging to layouts that reveal graph structure without requiring explicit hierarchical or temporal arrangement.[^viz2]

BASTION's brain visualization extends force-directed layout with neural metaphor design: node importance (determined by connectivity degree and evidence weight) controls node size and glow intensity, while edge weight (derived from co-occurrence frequency and confidence scores) controls edge thickness and opacity. The result is a visualization that resembles a neural network or brain scan, making the semantic density of intelligence relationships visually interpretable to analysts without requiring graph theory expertise. This design choice reflects research on cognitive fit between visualization metaphor and analyst mental models — analysts who think about intelligence as a network of connections benefit from a visualization that renders those connections as spatial, visceral relationships.[^viz3]

### 2.5.4 Entity Resolution and Confidence Scoring in Multi-Source Intelligence Fusion

Entity resolution — determining whether two references to a named entity (a person, organization, location, or military unit) in different documents refer to the same real-world entity — is a fundamental challenge in intelligence fusion.[^er1] Named entity references are noisy: transliterations vary, abbreviations are context-dependent, and adversaries deliberately introduce ambiguity. Entity resolution algorithms use string similarity, context embedding similarity, and structural graph evidence to make probabilistic merge decisions, producing entity clusters where each cluster represents a single real-world entity with multiple textual variants.

Confidence scoring in intelligence products follows NATO's Admiralty Code, which rates source reliability (A through F) independently of information quality (1 through 6).[^er2] BASTION applies this framework at the entity level: each entity in the knowledge graph carries source reliability ratings derived from the provenance of the documents that introduced it. Conflicting claims from different sources produce competing entity attributes with differential confidence, allowing analysts to inspect the evidentiary basis for each claim rather than receiving a single merged verdict. This approach reflects the intelligence community's emphasis on maintaining analytical uncertainty rather than prematurely collapsing ambiguity into false certainty.[^er3]

### 2.5.5 Ontology Alignment and Interoperability Standards

Defense knowledge graphs must interoperate with existing ontological frameworks to enable cross-system intelligence sharing. The Basic Formal Ontology (BFO) provides a foundational upper ontology that domain-specific defense ontologies extend.[^onto1] The Common Core Ontologies (CCO), developed under the Information Warfare Cross-Functional Team, provide mid-level ontologies for military domains including geospatial, temporal, and organizational concepts. The DoDAF/DM2 (DoD Architecture Framework Data Model) provides data architecture standards for system interoperability documentation.

BASTION's knowledge graph uses a pragmatic approach: entities are typed using a vocabulary drawn from military planning doctrine (units, capabilities, objectives, lines of effort, tasks, constraints) rather than formalizing against BFO or CCO. This design decision prioritizes operational utility over formal ontological rigor — analysts and planners can contribute to and query the graph using familiar doctrinal terminology without ontology expertise. Future work (noted in Section 5) addresses alignment of BASTION's entity vocabulary with CCO for interoperability with other defense knowledge graph systems.[^onto2]

---

[^kg1]: [CITATION NEEDED] - Reference on knowledge graph definition, graph database fundamentals, and entity-relationship representation.

[^kg2]: [CITATION NEEDED] - Reference on knowledge graphs for intelligence sense-making and relationship discovery in analytical workflows.

[^kg3]: [CITATION NEEDED] - Reference on IARPA CAUSE or DARPA Big Mechanism programs and graph-based causal reasoning in intelligence analysis.

[^jsonld1]: W3C, "JSON-LD 1.1: A JSON-based Serialization for Linked Data," W3C Recommendation, July 2020. https://www.w3.org/TR/json-ld11/

[^jsonld2]: [CITATION NEEDED] - Reference on JSON-LD adoption in defense information architecture and comparison with XML-based standards.

[^viz1]: [CITATION NEEDED] - Reference on graph visualization algorithms, aesthetic criteria, and interactive performance constraints.

[^viz2]: Fruchterman, T.M.J. and Reingold, E.M., "Graph Drawing by Force-Directed Placement," Software: Practice and Experience, 21(11), 1991. [CITATION NEEDED - verify full citation]

[^viz3]: [CITATION NEEDED] - Reference on cognitive fit between visualization metaphor and analyst mental models in intelligence analysis.

[^er1]: [CITATION NEEDED] - Reference on entity resolution techniques in information extraction and intelligence fusion.

[^er2]: NATO Standardization Agreement (STANAG) 2022, "Intelligence Reports" (Brussels: NATO, current edition). [CITATION NEEDED - verify Admiralty Code STANAG reference]

[^er3]: [CITATION NEEDED] - Reference on maintaining analytical uncertainty in intelligence products and avoiding premature confidence collapse.

[^onto1]: [CITATION NEEDED] - Reference on Basic Formal Ontology (BFO) and its use as upper ontology for defense domain extensions.

[^onto2]: [CITATION NEEDED] - Reference on Common Core Ontologies (CCO) for military domain knowledge representation and DoDAF alignment.
