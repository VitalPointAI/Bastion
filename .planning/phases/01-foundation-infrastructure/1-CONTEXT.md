# Phase 1: Foundation & Infrastructure - Context

**Gathered:** 2026-01-11
**Status:** Ready for research

<vision>
## How This Should Work

A fully integrated blockchain + TEE stack working seamlessly from day one. NEAR and Phala operate together as a unified foundation, with smart contracts deployed and the confidential backend running in the TEE environment. Everything is ready for building features on top.

The integration is transparent - developers interact with the system without explicitly managing the privacy layer. When sensitive operations occur, they automatically route to Phala TEE for confidential computing. The complexity is abstracted away, handled based on data classification policies.

This creates a complete foundation where the blockchain and privacy layers work together invisibly, providing a clean development surface for building the coalition operations platform.

</vision>

<essential>
## What Must Be Nailed

All three foundational elements are equally critical and non-negotiable:

- **Blockchain smart contract foundation** - NEAR smart contracts must be working correctly with proper state management, gas handling, and upgrade patterns
- **Privacy-preserving backend execution** - Phala TEE must actually protect sensitive data in a confidential computing environment, proving classified workloads can run securely
- **End-to-end communication flow** - Data must flow smoothly from frontend through blockchain to TEE backend and back, with proper encryption and verification at each layer

These are foundational pillars - compromising on any of them undermines the entire system's viability for defense applications.

</essential>

<boundaries>
## What's Out of Scope

- **Production deployment patterns** - This phase focuses on getting the core stack working in local/dev environments; production hardening, high availability, and disaster recovery are deferred to later phases
- **Advanced smart contract features** - Only basic contract infrastructure needed to support identity and DAO functionality; full feature implementation happens in subsequent phases
- **Performance optimization** - Focus is on correctness and integration; optimization and scaling are deferred
- **Complete containerization strategy** - While components may be containerized, comprehensive orchestration and deployment architecture comes later

</boundaries>

<specifics>
## Specific Ideas

- Follow NEAR and Phala ecosystem standards - use recommended patterns, libraries, and starter templates from both ecosystems
- Don't reinvent solutions - leverage proven patterns from the NEAR and Phala communities
- Idiomatic development following each platform's best practices
- Use ecosystem tooling and development workflows as intended

</specifics>

<notes>
## Additional Context

The transparent privacy layer is key to the developer experience - the system should "just work" with security handled automatically based on data classification. This abstraction is what enables rapid development of coalition features without every developer needing to understand TEE internals.

The emphasis on all three foundational elements being equally important reflects the reality that this is a defense system - partial security or incomplete integration isn't acceptable even in v1.

</notes>

---

*Phase: 01-foundation-infrastructure*
*Context gathered: 2026-01-11*
