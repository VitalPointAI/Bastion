# Resource Registry

The Resource Registry tracks operational assets (vehicles, sensors, weapons, comms, logistics) as decentralized identifiers with plugin-based behavior and DAO-governed allocation.

## Resource DIDs

Each resource is assigned a DID in the format:

```
did:near:resource-{uuid}
```

Resources carry two key types:

- **Blinded key** — used for privacy-preserving proofs of resource ownership without revealing identity.
- **Public key** — used for open verification and COP display.

## Registry Architecture

The registry is a **singleton** service providing:

- **DID lookup** — resolve a resource DID to its full record (type, status, location, capabilities).
- **Capability queries** — find all resources matching a capability set (e.g., "ISR-capable, range > 500nm").
- **Area queries** — find all resources within a geographic bounding box or radius.

## Plugin Interface

Resource types are defined through plugins. Each plugin implements:

| Component | Description |
|-----------|-------------|
| **Schema** | JSON schema defining the resource's data fields |
| **State machine** | Valid states and transitions (e.g., Available -> Deployed -> Maintenance) |
| **Capabilities** | Declared capability tags for query matching |
| **Data handler** | Ingestion and transformation logic for telemetry data |
| **COP renderer** | How the resource appears on the Common Operating Picture |

## Built-in Plugins

| Plugin | Description |
|--------|-------------|
| `AutonomousVehicle` | UAVs, UGVs, USVs with waypoint and mission state |
| `SensorPlatform` | ISR sensors with coverage area and collection schedule |
| `WeaponSystem` | Weapons with engagement envelopes and ammunition state |
| `Comms` | Communication nodes with frequency, bandwidth, and link state |
| `Logistics` | Supply nodes with inventory levels and distribution capacity |

## COP Integration

Resources render on the Common Operating Picture using **MIL-STD-2525D** military symbology:

- Each plugin defines a default symbol code based on resource type and affiliation.
- Position updates from telemetry automatically move symbols on the map.
- Status changes (e.g., degraded, destroyed) update the symbol modifier.

## Telemetry Ingestion

Resources can push telemetry data that feeds into AI agent context:

- Position, heading, speed for mobile assets.
- Sensor readings and detection events.
- Fuel/ammo/supply levels.
- AI staff agents consume this data for situational awareness and recommendations.

## DAO-Governed Allocation

Resource allocation follows governance workflows:

1. A staff officer submits a resource allocation proposal (which resources, to which unit, for what mission).
2. The proposal goes through the DAO voting process with role-weighted votes.
3. On approval, the registry updates resource assignment and notifies relevant agents.

## Readiness Tracking

Each resource tracks operational readiness:

| Status | Meaning |
|--------|---------|
| **FMC** | Fully Mission Capable |
| **PMC** | Partially Mission Capable (with degradation details) |
| **NMC** | Not Mission Capable |

Additional tracked fields:

- **Location** — current position (lat/lon) or assigned area.
- **Degradation** — specific subsystems that are degraded and impact on capabilities.
