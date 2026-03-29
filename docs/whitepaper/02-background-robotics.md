# 2.12 Edge Computing and Military Robotics

The integration of autonomous robotic systems into military operations has accelerated significantly over the past decade, driven by advances in edge computing hardware, neural inference acceleration, and wireless mesh networking. BASTION's physical demonstration layer engages this domain directly, deploying commercial edge computing platforms and mobile robotic vehicles within a governance-bound autonomous system. This section surveys the academic and doctrinal foundations underpinning that integration.

## 2.12.1 Edge Computing in Military Contexts

Edge computing relocates computational workloads from centralized data centers to nodes proximate to sensors, actuators, and operators.[^ec1] In military contexts, the fragility of long-haul communications in contested environments and the latency requirements of autonomous systems that must make sub-second decisions motivate this shift. The NVIDIA Jetson platform (specifically the Jetson Orin Nano used in BASTION's demonstration) delivers up to 40 TOPS (trillion operations per second) of AI inference compute in a form factor appropriate for dismounted or vehicle-mounted edge deployment.[^ec2] At this compute density, deep learning inference tasks such as object detection, scene classification, and pose estimation execute locally without round-trip latency to cloud or datacenter infrastructure.

Military applications of edge computing extend beyond robotics to include forward-deployed sensor fusion, encrypted radio relay with local AI processing, and autonomous target recognition at the tactical edge. The U.S. Army's Project Convergence and the Joint All-Domain Command and Control (JADC2) initiative both emphasize moving AI inference capabilities forward to reduce the sensor-to-decision cycle time.[^ec3] BASTION's architecture operationalizes this principle by running the robot vision pipeline entirely on the Jetson device, forwarding only high-level intent signals (threat type, position estimate, confidence score) to the command-and-control layer rather than raw video streams.

## 2.12.2 Autonomous Ground Vehicles in Military Applications

Unmanned Ground Vehicles (UGVs) have transitioned from experimental platforms to accepted elements of joint doctrine. The Department of Defense's Unmanned Systems Integrated Roadmap identifies UGVs as essential contributors to reconnaissance, logistics, and counter-IED operations.[^ugv1] Contemporary doctrine addresses human-machine teaming in the ground domain, distinguishing between teleoperated systems (human controlled at all times), supervised autonomous systems (human-on-the-loop), and fully autonomous systems (human-out-of-the-loop for bounded task execution).[^ugv2]

BASTION's robotic demonstration uses Sphero RVR+ platforms (commercially available differential-drive mobile robots with open SDK access) to represent tactical autonomous platforms. While not military-grade systems, this choice reflects a principled decision to validate the governance and coordination architecture using available hardware before scaling to operational platforms. The architecture's DAO-governed mission assignment, intent translation, and authority position enforcement are hardware-agnostic and transfer directly to military UGV platforms.[^ugv3]

Human-machine teaming in ground maneuver contexts requires governance frameworks that specify: which decisions humans must authorize before robotic action, which actions robots may execute autonomously within defined parameters, and how humans can override or abort autonomous execution at any point. These governance requirements map precisely to BASTION's three authority positions (human-in-the-loop, on-the-loop, out-of-the-loop) described in Section 3.4.

## 2.12.3 DDIL Environments and Edge AI Resilience

Denied, Degraded, Intermittent, and Limited (DDIL) communications environments represent the baseline assumption for contested military operations.[^ddil1] Electronic warfare, terrain masking, adversary jamming, and network saturation all degrade or eliminate connectivity between robotic platforms and command elements. Effective autonomous systems must therefore operate under disconnected conditions while remaining bound by pre-authorized policy constraints.

Edge AI resilience in DDIL environments requires local inference capability (addressed by the Jetson's onboard neural engine), local mission state persistence (so robots retain their assignment when connectivity is lost), and conservative fallback behaviors that engage when communication is interrupted. BASTION's robot bridge architecture implements this pattern: the Python robot agent maintains mission state locally, executes within pre-authorized parameters when the central API is unreachable, and attempts reconnection on a configurable interval. This design reflects the broader principle that governance constraints must be enforced at the edge rather than relying on persistent uplink to a central authority.[^ddil2]

Research on military AI resilience emphasizes that autonomous systems should fail toward safety (defaulting to halt, hold position, or return-to-base behaviors) when operating outside the parameters of their mission authorization.[^ddil3] BASTION enforces this through the mission intent translation layer, which explicitly bounds robot behavior to the authorized mission type before command execution begins. Strike missions require explicit human approval regardless of connectivity status; the approval bit must be set before mission execution commences.

## 2.12.4 Swarm Robotics and Doctrinal Formation Concepts

Swarm robotics applies principles from biological collective behavior (flocking, stigmergy, distributed task allocation) to multi-robot coordination.[^swarm1] Military swarm applications include coordinated reconnaissance, distributed target acquisition, and mass saturation of adversary defensive systems. Academic literature distinguishes between reactive swarms (each robot responds to local sensor input without communication) and communicating swarms (robots share state over a mesh network and coordinate through explicit protocols).[^swarm2]

BASTION's swarm implementation belongs to the communicating swarm category. A designated swarm leader robot receives mission assignments from the DAO and translates them into formation commands distributed over a UDP peer mesh. Follower robots receive formation type, reference position, and interval parameters, then compute their individual positions relative to the leader using geometric formation models. This approach mirrors military doctrine's concept of movement formations, standardized spatial arrangements that provide specific tactical advantages.

Joint doctrine recognizes six primary ground movement formations: column (depth for road movement), line (maximum firepower to the front), wedge (all-around security with firepower focused forward), echelon left/right (oblique movement with protection on one flank), vee (observation and firepower to front and flanks), and staggered column (depth with mutual flank protection).[^swarm3] BASTION implements all six formations as first-class swarm behaviors, allowing the DAO to select the doctrinally appropriate formation based on mission type, threat axis, and terrain conditions expressed in the planning documents.

## 2.12.5 Self-Registration and Mesh Networking for Autonomous Platforms

Autonomous platforms that enter a network must be discoverable, authenticated, and authorized before they can receive mission assignments or contribute sensor data. This onboarding challenge mirrors the broader military resource management problem: how does a command element know what assets are available, where they are, and whether they are authorized for a given mission?

BASTION addresses robot onboarding through mDNS-based self-registration.[^mesh1] When a robot agent initializes, it broadcasts a service announcement on the local network containing its capability manifest (sensors, mobility type, communication range, current readiness). The robot bridge service discovers this announcement, validates the robot against the resource registry, and presents it to the DAO for authorization. This self-registration pattern extends the resource DID architecture (described in Section 3.10) to physical platforms, treating robots as blockchain-anchored resource entities with verifiable identity and capability claims.

Mesh networking enables robots to relay commands and sensor data through peer nodes when direct uplink to the control system is unavailable. BASTION's UDP peer mesh provides direct robot-to-robot communication for formation coordination, independent of the central API. This architecture ensures that formation integrity is maintained during periods of partial connectivity; the swarm can continue coordinated movement even when individual robots temporarily lose contact with the command element.[^mesh2]

## 2.12.6 Neural Vision Pipelines at the Tactical Edge

Computer vision systems based on convolutional neural networks (CNNs) have achieved human-level performance on object detection and classification benchmarks, enabling autonomous threat recognition without continuous human supervision.[^vis1] NVIDIA's detectNet architecture, used in BASTION's robot vision pipeline, runs inference on a live camera feed to detect and classify objects against a trained label set, returning bounding box coordinates and confidence scores in real time. The Jetson Orin Nano's dedicated Deep Learning Accelerator (DLA) executes these inference workloads in parallel with the main CPU, enabling concurrent vision processing and communication without performance degradation.

Military applications of neural vision at the edge span perimeter security, route clearance, counter-drone, and dismounted operations.[^vis2] Deploying neural vision in operational contexts presents challenges not only of model accuracy but also of adversarial robustness: deep learning models carry susceptibility to adversarial perturbations that cause misclassification. BASTION's implementation addresses this by treating vision outputs as intelligence estimates rather than authoritative decisions; confidence scores from the vision pipeline feed into the knowledge graph as entity attributes subject to source reliability assessment (the same NATO Admiralty Code framework applied to OSINT). This framing correctly places the human authority question at the mission authorization layer rather than at the sensor layer.

---

[^ec1]: Weisong Shi, Jie Cao, Quan Zhang, Youhuizi Li, and Lanyu Xu, "Edge Computing: Vision and Challenges," *IEEE Internet of Things Journal* 3, no. 5 (October 2016): 637-646, https://doi.org/10.1109/JIOT.2016.2579198.

[^ec2]: NVIDIA Corporation, "Jetson Orin Nano Series," technical specifications, 2023, https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/.

[^ec3]: John R. Hoehn, "Joint All-Domain Command and Control (JADC2)," Congressional Research Service, In Focus IF11493, updated January 21, 2022, https://crsreports.congress.gov/product/pdf/IF/IF11493.

[^ugv1]: U.S. Department of Defense, *Unmanned Systems Integrated Roadmap, FY2013-2038*, Reference Number 14-S-0553 (Washington, DC: Department of Defense, 2013), https://apps.dtic.mil/sti/citations/ADA592015.

[^ugv2]: U.S. Department of Defense, *DoD Directive 3000.09: Autonomy in Weapon Systems* (Washington, DC: Department of Defense, January 25, 2023), https://www.esd.whs.mil/portals/54/documents/dd/issuances/dodd/300009p.pdf.

[^ugv3]: National Research Council, *Technology Development for Army Unmanned Ground Vehicles* (Washington, DC: The National Academies Press, 2002), https://doi.org/10.17226/10592.

[^ddil1]: U.S. Army Training and Doctrine Command, *TRADOC Pamphlet 525-3-1: The U.S. Army in Multi-Domain Operations 2028* (Fort Eustis, VA: TRADOC, December 6, 2018), https://adminpubs.tradoc.army.mil/pamphlets/TP525-3-1.pdf.

[^ddil2]: Mahadev Satyanarayanan, "The Emergence of Edge Computing," *Computer* 50, no. 1 (January 2017): 30-39, https://doi.org/10.1109/MC.2017.9.

[^ddil3]: Paul Scharre, *Army of None: Autonomous Weapons and the Future of War* (New York: W. W. Norton, 2018).

[^swarm1]: Marco Dorigo, Guy Theraulaz, and Vito Trianni, "Swarm Robotics: Past, Present, and Future," *Proceedings of the IEEE* 109, no. 7 (July 2021): 1152-1165, https://doi.org/10.1109/JPROC.2021.3072740.

[^swarm2]: Manuele Brambilla, Eliseo Ferrante, Mauro Birattari, and Marco Dorigo, "Swarm Robotics: A Review from the Swarm Engineering Perspective," *Swarm Intelligence* 7, no. 1 (March 2013): 1-41, https://doi.org/10.1007/s11721-012-0075-2.

[^swarm3]: Headquarters, Department of the Army, *Army Doctrine Publication 3-90: Offense and Defense* (Washington, DC: Department of the Army, July 31, 2019), https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN34017-ADP_3-90-000-WEB-1.pdf.

[^mesh1]: Stuart Cheshire and Marc Krochmal, "Multicast DNS," RFC 6762, Internet Engineering Task Force, February 2013, https://datatracker.ietf.org/doc/html/rfc6762.

[^mesh2]: Chai Keong Toh, *Ad Hoc Mobile Wireless Networks: Protocols and Systems*, 2nd ed. (Upper Saddle River, NJ: Prentice Hall, 2002).

[^vis1]: Joseph Redmon, Santosh Divvala, Ross Girshick, and Ali Farhadi, "You Only Look Once: Unified, Real-Time Object Detection," in *Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR)* (Las Vegas, NV: IEEE, 2016), 779-788, https://doi.org/10.1109/CVPR.2016.91.

[^vis2]: Zhi Zhou, Xu Chen, En Li, Liekang Zeng, Ke Luo, and Junshan Zhang, "Edge Intelligence: Paving the Last Mile of Artificial Intelligence with Edge Computing," *Proceedings of the IEEE* 107, no. 8 (August 2019): 1738-1762, https://doi.org/10.1109/JPROC.2019.2918951.
