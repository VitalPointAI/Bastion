# 2. Background: Decentralized Autonomous Organizations and Web3 Technologies

This section introduces the foundational technologies that underpin BASTION's approach to military coordination. For readers unfamiliar with blockchain or decentralized systems, the following subsections provide the necessary context to understand how these technologies enable novel governance frameworks for command and control.

## 2.1 Blockchain Fundamentals

### What is a Blockchain?

A blockchain is a distributed ledger technology that maintains an identical copy of data across a network of computers rather than storing information in a single central location. When new information is added to a blockchain, every computer in the network receives and verifies this update, creating multiple redundant copies of the same data. This distributed architecture provides several properties critical to secure, multi-party coordination.

The term "blockchain" derives from its underlying data structure: information is grouped into discrete units called blocks, and each block is cryptographically linked to the previous block, forming an unbroken chain. This linking occurs through cryptographic hashing, a mathematical process that converts data of any size into a fixed-length string of characters. Even the smallest change to the original data produces a completely different hash value. Because each block contains the hash of the previous block, any attempt to alter historical data breaks the chain of hashes, immediately revealing the tampering.

This architectural design produces three key properties. First, immutability: once participants record data on a blockchain, they cannot alter or delete it without detection. The chain of cryptographic hashes ensures that any modification to historical records is evident to all network participants. Second, transparency: all participants in the network can see all transactions recorded on the blockchain, creating a shared source of truth. Third, distributed trust: the network operates without requiring participants to trust any single central authority, as consensus mechanisms ensure agreement on the current state of the ledger.

Consensus mechanisms are protocols that enable distributed network participants to agree on which transactions are valid and in what order they occurred. Proof-of-stake consensus, used by many modern blockchains including NEAR Protocol, requires network validators to commit economic stake as collateral. NEAR's consensus mechanism requires approvals from block producers whose cumulative stake exceeds two-thirds of the total epoch stake to validate blocks, with finality achieved when at least two consecutive blocks are built on top of a given block.[^dao1] Validators who attempt to approve fraudulent transactions risk losing their stake, aligning economic incentives with honest behavior. This approach provides security without the energy-intensive computation that earlier proof-of-work mechanisms require. Ethereum's transition from proof-of-work to proof-of-stake reduced its annualized electricity consumption by more than 99.98 percent, from approximately 78 TWh/year to 0.0026 TWh/year.[^dao2]

[^dao1]: NEAR Protocol, "Consensus," in *Nearcore Development Guide* (San Francisco: NEAR Foundation, 2024), https://nomicon.io/ChainSpec/Consensus.html.
[^dao2]: Ethereum Foundation, "Ethereum Energy Consumption," ethereum.org, 2024, https://ethereum.org/en/energy-consumption/.

### Why Blockchain Matters for Coordination

Traditional multi-party coordination requires either mutual trust between all parties or reliance on a trusted intermediary. Coalition military operations often lack both: national interests may conflict, and no single nation may be willing to cede control to another. Blockchain technology offers an alternative model where coordination rules are encoded transparently and enforced automatically, without requiring parties to trust each other or any central authority.

The immutable audit trail that blockchain provides creates accountability for all decisions and actions. Every vote, approval, or resource allocation is permanently recorded with a timestamp and cryptographic proof of its origin. This comprehensive record enables after-action review, supports attribution in disputes, and deters bad actors who know their actions will be permanently visible.

Blockchain-based coordination also provides resilience against disruption. Because the ledger is replicated across many nodes, the system continues to function even if individual nodes are compromised or communication links are severed. This property is particularly valuable in contested environments where adversaries may target communication infrastructure or attempt to corrupt centralized command systems.

## 2.2 Decentralized Autonomous Organizations (DAOs)

### What is a DAO?

A Decentralized Autonomous Organization (DAO) is an organization whose governance rules are encoded in software and executed automatically by a blockchain network. Unlike traditional organizations where decisions flow through hierarchical management structures, DAOs coordinate collective action through transparent proposals, voting mechanisms, and automated execution.

In a DAO, members submit proposals for consideration by the organization. These proposals might request funding for a project, propose changes to organizational rules, or authorize specific actions. Other members review the proposal and cast votes according to the organization's voting rules. When a proposal receives sufficient support, the underlying blockchain executes the associated action automatically without requiring any intermediary to implement the decision.

This structure eliminates the need for trusted executives or administrators who might delay, modify, or fail to implement decisions. The rules governing the organization are visible to all members, votes are recorded immutably, and outcomes follow deterministically from the voting results. Members can verify that the organization operates according to its stated rules rather than relying on promises from leadership.

DAOs exist on a spectrum of autonomy. Some DAOs require human approval for every action. Others operate semi-autonomously, executing certain routine decisions automatically while requiring human intervention for significant matters. The most autonomous DAOs implement complex rule sets that handle a wide range of scenarios without human involvement. The appropriate level of autonomy depends on the organization's purpose and the consequences of potential errors.[^dao3]

[^dao3]: Pedro Pinto, Antonio J. Pinto, and Ricardo Santos, "Decentralized Autonomous Organizations: A Systematic Literature Review," *Applied Sciences* 15, no. 2 (2025): 500, https://doi.org/10.3390/app15020500.

### Smart Contracts

Smart contracts are the software programs that encode a DAO's rules and execute its decisions. The term "smart contract" refers not to legal contracts but to programs that automatically execute predefined actions when specific conditions are met. These programs run on blockchain infrastructure, inheriting the blockchain's properties of immutability and transparency.

Once deployed to a blockchain, a smart contract cannot be altered. This immutability ensures that the rules governing an organization remain exactly as the members agreed upon them. No administrator can secretly modify voting thresholds, no insider can create exceptions for favored parties, and no external actor can corrupt the governance process. The rules are literally set in code, visible to all and enforced by mathematics rather than by fallible human institutions.

Smart contracts can encode complex conditional logic: if a proposal receives a two-thirds majority vote and at least five council members participate, then transfer these resources to that recipient. They can implement time delays, requiring that approved actions wait for a review period before execution. They can require multiple signatures from different parties before authorizing sensitive operations. All of these constraints operate automatically and cannot be bypassed without deploying an entirely new contract with different rules.

### DAO Governance Mechanisms

DAOs implement various mechanisms to ensure decisions reflect the collective will of their members while maintaining operational efficiency. Proposal submission typically requires meeting certain criteria: the proposer might need to hold a minimum stake in the organization or receive endorsements from existing members. These requirements prevent spam while ensuring that serious proposals receive consideration.

Voting on proposals can follow different rules depending on the decision's importance. Routine operational decisions might require simple majority approval. Constitutional changes that alter the organization's fundamental rules might require supermajority thresholds of two-thirds or even three-fourths agreement. The most consequential decisions might require unanimous consent from designated council members.

Quorum requirements ensure that decisions reflect broad participation rather than just the preferences of a small active minority. A proposal might require not only majority support among those who vote but also that a minimum percentage of all eligible members participate in the vote. This prevents decisions from being made when most members are unaware or uninvolved.

Time-locked execution provides a safeguard against hasty decisions and allows for error correction. When a proposal is approved, its execution might be delayed for a period during which members can review the decision. Some DAOs implement veto mechanisms allowing designated parties to block execution during this window if they identify problems.

Multi-signature requirements ensure that critical decisions cannot be made unilaterally. Certain actions might require approval from multiple independent parties, each holding a separate cryptographic key. This requirement ensures that sensitive operations proceed only when multiple designated authorities agree.

The balance between autonomous execution and human oversight represents a fundamental design choice. Fully autonomous execution maximizes speed and consistency but risks implementing flawed decisions. Required human approval introduces delays but provides opportunities for judgment and course correction. Effective DAO design matches the level of autonomy to the consequences of potential errors.

## 2.3 Web3 Principles

### User-Owned Data

Web3 represents a paradigm shift in how users interact with digital systems. In the current web model, users create accounts on platforms that corporations control, and those corporations own and control the data those users generate. Web3 inverts this model: users own their data and grant selective access to applications rather than surrendering ownership to platforms.

This ownership model relies on cryptographic key pairs. Users hold private keys that only they control, while public keys serve as their identity across multiple systems. When users interact with a Web3 application, they sign their actions with their private key, proving their identity without revealing sensitive credentials to the application. This architecture enables users to maintain a consistent identity across different systems while retaining control over their data and its use.

The interoperability this model enables allows applications to share information and coordinate actions without requiring users to create separate accounts or transfer data manually between services. A credential that one organization issues can be verified by another without either party needing to trust or communicate with the other, provided both recognize the cryptographic standards in use.

### Decentralization Benefits

Decentralized systems distribute control across multiple independent parties rather than concentrating authority in a single entity. This distribution provides resilience: the system continues to operate even when individual components fail. No single point of failure exists that an adversary could target to disable the entire system.

Decentralization also provides censorship resistance. When no single party controls the system, no single party can arbitrarily exclude participants or suppress information. This property matters when coordination must occur across organizational or national boundaries where any central authority might face pressure to favor certain parties.

Perhaps most importantly for coalition operations, decentralization reduces trust requirements. Parties that might not fully trust each other can still coordinate effectively when the rules of their interaction are encoded transparently and enforced automatically. Each party can verify for themselves that the system operates as promised rather than relying on assurances from others.

## 2.4 Defense Applications of Blockchain

### Current and Emerging Uses

Military organizations worldwide have begun exploring blockchain applications, though deployment remains limited compared to commercial adoption.[^dao4] The most mature applications focus on supply chain tracking, where blockchain's immutable record-keeping can verify the provenance and handling of components throughout complex logistics networks. The U.S. Department of Defense has piloted blockchain systems to track parts through the defense supply chain, ensuring authenticity and flagging potential counterfeit components.[^dao5]

[^dao4]: George Iakovakis, Konstantinos Koulouris, Ioannis Liontos, George Stampoulis, Georgios Kabassi, and Nikolaos Tsoukalas, "Blockchain Applications in the Military Domain: A Systematic Review," *Technologies* 13, no. 1 (2025): 23, https://doi.org/10.3390/technologies13010023.
[^dao5]: Defense Advanced Research Projects Agency, "DARPA Explores Blockchain Technology for Military Security," DARPA News, 2019; see also U.S. Government Accountability Office, *Blockchain: Emerging Technology Offers Benefits for Some Applications but Faces Challenges*, GAO-22-104625 (Washington, DC: GAO, March 2022), https://www.gao.gov/products/gao-22-104625.

Cybersecurity represents another active area of defense blockchain research. Blockchain-based identity management can reduce reliance on centralized authentication servers that present attractive targets for adversaries. Distributed logging and monitoring systems can resist tampering that might allow attackers to cover their tracks. Several nations are developing or have deployed blockchain-based systems for securing military communications and identity verification.[^dao6]

[^dao6]: Mohamad Salhani and James Obert, "Leveraging Blockchain Technology for Military Automation and Cybersecurity," *SSRN Electronic Journal* (2025), https://doi.org/10.2139/ssrn.5075783.

Coalition information sharing presents particular opportunities for blockchain adoption. When multiple nations must share intelligence or coordinate operations, blockchain can provide a shared record that no single nation controls while maintaining the security classifications and access controls each nation requires. NATO has explored federated blockchain approaches for this purpose.[^dao7]

[^dao7]: North Atlantic Treaty Organization, "Emerging and Disruptive Technologies," NATO Topics, last updated 2024, https://www.nato.int/cps/en/natohq/topics_184303.htm.

Research institutions and defense agencies have published substantial work examining blockchain's potential military applications. A comprehensive systematic review identified 43 peer-reviewed articles on blockchain applications in military domains, with applications spanning command and control, logistics, identity management, and cybersecurity.[^dao8] The majority of these applications focus on blockchain's data integrity properties rather than its governance capabilities.

[^dao8]: Iakovakis et al., "Blockchain Applications in the Military Domain," 23.

### Gap: DAO Governance for Command and Control

Despite growing interest in blockchain for defense applications, a notable gap exists in the literature and in practice: no existing systems combine DAO governance mechanisms with military command and control. Current blockchain defense applications use the technology primarily as a secure database, leveraging immutability and transparency for record-keeping but not exploiting the autonomous governance capabilities that distinguish DAOs from simple distributed ledgers.

This gap is significant because the coordination challenges facing coalition military operations extend beyond data integrity to governance itself. The challenge is not merely ensuring that records are accurate but ensuring that decisions follow agreed-upon rules, that resources are allocated fairly and efficiently, and that actions are authorized appropriately across national boundaries.

Similarly, while artificial intelligence is increasingly applied to military decision support, existing systems lack decentralized governance frameworks. AI tools can accelerate analysis and recommend courses of action, but the decisions ultimately flow through traditional hierarchical command structures. No existing systems combine AI augmentation with DAO governance to create a framework that is both intelligent and decentralized.

BASTION addresses this gap by integrating DAO governance with AI agent augmentation specifically for command and control applications. See Section 3 (Methodology) for a detailed description of how BASTION implements these principles through its layered architecture of strategic, operational, and tactical DAOs. See Section 4 (Results) for a demonstration of DAO governance in action through the physical proof-of-concept system.

## 2.5 Summary

This section has introduced the foundational technologies that enable BASTION's approach to military coordination:

- **Blockchain** provides immutable, transparent record-keeping distributed across multiple nodes, enabling coordination without central authority.
- **Decentralized Autonomous Organizations (DAOs)** build on blockchain to enable collective governance through encoded rules, transparent proposals, and automated execution.
- **Smart contracts** encode governance rules that execute automatically and cannot be altered after deployment.
- **Web3 principles** enable user-owned data and identity that can operate across organizational boundaries.

Defense applications of blockchain currently focus on data integrity for supply chains, cybersecurity, and information sharing. However, no existing systems apply DAO governance mechanisms to military command and control. This gap represents the opportunity that BASTION addresses: combining decentralized governance with AI augmentation to enable effective coordination across diverse national and organizational boundaries.

The following section (Section 2.2) examines the military coordination context, including traditional command and control structures and the specific challenges that modern coalition operations present. Together, these background sections provide the foundation for understanding BASTION's methodology and contributions in Section 3.

