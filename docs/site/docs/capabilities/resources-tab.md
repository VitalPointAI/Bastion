# Resources Tab

> Inventory Management and Network Device Onboarding — Phase 42

## Purpose

The Resources tab is the consolidated inventory and onboarding center for all
physical and digital assets in a BASTION problem set. Every piece of equipment,
personnel record, consumable item, or network-connected device is registered,
tracked, and assigned a decentralized identifier (`did:near:resource-{id}`) for
verifiable lifecycle management across coalition boundaries.

This tab bridges the gap between digital planning and physical execution — the
resources visible here are the same assets allocated in the Plan tab and rendered
as COP symbols.

---

## Components

### Equipment and Personnel Inventory

- **Equipment records**: Platform type, serial number, readiness status, owning
  unit, location, and maintenance history.
- **Personnel records**: Name, role, specialty, clearance level, and assignment.
- **Consumables tracking**: Ammunition, fuel, rations, and medical supplies with
  quantity-on-hand and consumption rates.
- Status indicators: Available, Allocated, Committed, In-Use, Non-Mission-Capable.
- Bulk import from standard logistics formats (LOGSTAT, SITREP annex).

### Resource Groups

- Resources are organized into **Resource Groups** that represent unit tables of
  organization and equipment (TOE), capabilities packages, or ad hoc task forces.
- Groups support search and filter by: unit, capability type, readiness status,
  and echelon.
- Group readiness is automatically calculated from member resource statuses.
- Groups link to the Plan tab's task organization for COA development.

### Network Device Discovery and Onboarding Pipeline

Supports automated discovery and registration of network-connected resources:

| Protocol | Discovery Method |
|---|---|
| **BLE** (Bluetooth Low Energy) | Passive scan for BASTION-compatible beacons |
| **WiFi** | mDNS service discovery on local network |
| **USB** | Plug-and-play device enumeration |
| **TAK/RF** | Team Awareness Kit and RF mesh integration |

- Discovered devices appear in the **Onboarding Queue** for staff review.
- Staff verify device identity and assign it to a resource group.
- On approval, the device receives a `did:near:resource-{id}` and is registered
  to the blockchain.
- DID-linked devices can be found and authenticated across coalition networks
  without central registry dependency.

### Resource Registry Statistics Dashboard

- Total resources by type: equipment, personnel, consumables, devices.
- Readiness breakdown: percentage available, allocated, and non-mission-capable.
- Onboarding pipeline status: discovered, pending review, registered.
- Resource utilization: which plans are drawing from which groups.
- Coalition visibility: which partner organizations can see which resources
  (governed by DAO information barriers).

### Capability Search

- Full-text and filter-based search across all registered resources.
- Search by: capability keyword, resource type, unit, status, or DID.
- Returns matching resources with their current status and allocation.
- Used by planners during COA development to check asset availability.

---

## DID-Based Resource Identity

Every registered resource has a **decentralized identifier** (`did:near:resource-{id}`)
recorded on the NEAR blockchain:

- **Verifiable**: Any coalition partner can verify a resource's registration and
  history without contacting a central authority.
- **Portable**: DIDs travel with the resource — a vehicle that transfers between
  units retains its identity and history.
- **Extensible**: Plugin architecture allows additional capability descriptors
  (e.g., sensor payloads, communication packages) to be attached to any DID.
- **Auditable**: All status changes and allocations are recorded as on-chain
  transactions, providing an immutable maintenance and usage log.

---

## Role Access

| Role | Access |
|---|---|
| **Commander** | Full visibility across all resource groups. Approves high-value onboarding. |
| **J4 Logistics** | Primary administrator. Manages inventory, maintenance status, and onboarding pipeline. |
| **J3 Operations** | Read access for planning. Requests resource allocation for COA development. |
| **Coalition partners** | Visibility governed by DAO information barriers. Can view shared resources. |

---

## Data Flow

```
Physical Assets / Network Devices
  (BLE, WiFi, USB, TAK/RF discovery)
        |
        v
  Onboarding Queue
  (Staff Review & DID Assignment)
        |
        v
  +------------------------------+
  | Resource Registry            |
  | DID: did:near:resource-{id}  |
  | Group Management             |
  | Capability Search            |
  | Readiness Dashboard          |
  +------------------------------+
        |
        v
  Plan Tab (Resource Allocation)
  COP Tab (Resource Symbols)
  Assess Tab (Readiness Reporting)
```

### Inputs

- Physical asset data (manual entry or bulk import)
- Network device discovery feeds (BLE, WiFi, USB, TAK/RF)
- Readiness updates from J4 logistics reporting
- Allocation requests from Plan tab COA development

### Outputs

- DID-registered resource records (blockchain)
- Readiness status for COP tab rendering
- Allocation data for Plan tab task organization
- Coalition-visible resource registry

---

## Doctrinal Reference

- **JP 4-0**, Joint Logistics — Resource Management
- **FM 4-0**, Sustainment — Logistics and Resource Tracking
- **JP 3-08**, Interorganizational Cooperation — Shared Resource Registries

---

*Part of the [BASTION Capability Tabs](/) documentation.*
