

**PRODUCT SPECIFICATION**

**Manufacturing Execution System (MES)**

BLDC Outrunner Motor Factory

**CONFIDENTIAL — INTERNAL DOCUMENT**

Version 1.0  |  Draft

2026

# **Document Control**

## **Revision History**

| Version | Date | Author | Description |
| :---- | :---- | :---- | :---- |
| 1.0 | 2026 | — | Initial draft |
|  |  |  |  |
|  |  |  |  |

## **Document Purpose**

This document defines the complete product specification for a custom Manufacturing Execution System (MES) to be developed for a BLDC outrunner motor manufacturing facility. It describes what the system must do — every feature, function, and data requirement — without prescribing implementation technology or architecture. This specification is the authoritative reference for development, testing, and future change control.

## **Intended Audience**

* Development team (engineers building the system)

* Factory operations and production management

* Quality and supply chain teams

* Executives and stakeholders reviewing system scope

## **Scope**

The MES described in this specification covers the complete digital lifecycle of a BLDC outrunner motor from purchase order through shipping, including: procurement and receiving, incoming quality control, inventory management, production work orders, in-process data capture, serialization and traceability, end-of-line testing, and packaging and shipping. The MES is not responsible for accounting, payroll, or customer relationship management, though it must expose data interfaces sufficient to integrate with those systems.

# **1\. System Overview**

## **1.1 Product Vision**

The MES is the operational backbone of the motor factory. It connects every stage of the production process — procurement, receiving, quality control, kitting, production, inspection, test, serialization, and shipping — into a single system of record. Every motor that leaves the facility carries a traceable digital history from raw material to finished product. The system is designed to scale from low-volume hand-assembly to high-volume semi-automated production without requiring re-architecture. The system is designed to accommodate at least 3 motor SKUs, which have a mix of custom and common subcomponents.

## **1.2 Design Philosophy**

* Operator-first: every interface used on the factory floor must be operable by a non-technical user in under 30 seconds of training for routine tasks.

* Data integrity over speed: the system enforces completeness and correctness at the point of entry. No record can advance to the next stage with missing required fields.

* Extensibility by default: adding a new data field, a new inspection dimension, a new process step, or a new product variant must be achievable by an administrator without software development.

* Composability by default: functions are coupled loosely but codebase is not monolithic.

* Traceability as a first-class feature: every serialized component and every production event is linked. Any motor serial number can be fully exploded to reveal every sub-component, every measurement, every operator touch, and every timestamp.

* Minimal operator burden: data capture must be as automated as possible. Manual data entry is used only where automation is not feasible. The system must never require more manual input than is necessary.

## **1.3 Key User Roles**

| Role | Primary Responsibilities in MES |
| :---- | :---- |
| Administrator | System configuration, user management, product and BOM management, form/field customization |
| Buyer / Engineer | Place purchase orders, upload drawings, define CTQ inspection dimensions, manage BOMs |
| Receiving Manager | Match incoming shipments to open orders, initiate receiving records |
| Quality Inspector (IQC) | Perform and record incoming inspections, disposition nonconforming material |
| Supply Chain / Inventory Manager | Monitor inventory levels, manage kitting, respond to replenishment alerts |
| Production Manager | Create and manage work orders, monitor production status and yield |
| Production Operator | Record in-process data, scan parts, enter test results via mobile/web interface |
| Shipping Coordinator | Generate packing lists, labels, and shipping records for completed work orders |

# **2\. Procurement and Purchase Order Management**

## **2.1 Overview**

The procurement module manages the creation and ingestion of purchase orders (POs) and links them to the parts, suppliers, and quality requirements defined elsewhere in the system. A PO in the MES is the origin record for all downstream receiving, inspection, and inventory transactions.

## **2.2 Purchase Order Data Model**

Each purchase order record must capture, at minimum, the following fields:

* PO number (system-generated or manually entered, unique)

* Order date

* Buyer / requester name

* Supplier name and supplier ID (linked to supplier master)

* One or more line items, each containing:

  * Internal part number and revision (linked to part master)

  * Supplier part number

  * Ordered quantity and unit of measure

  * Unit cost and total line cost

  * Country of origin

  * Expected lead time (days) and calculated ETA date

  * Lot / batch number assigned at time of order (or upon receiving)

  * Link to revision-controlled drawing (PDF upload)

  * CTQ inspection dimensions (see Section 4\)

  * Notes / special handling instructions

* PO-level fields: currency, payment terms, shipping method, total PO value

* Status: Draft, Submitted, Partially Received, Fully Received, Closed, Cancelled

## **2.3 PO Creation**

A buyer or engineer must be able to create a new PO through a web form. The form must support:

* Searching the part master to select parts by part number, description, or keyword

* Auto-populating supplier information from the supplier master when a preferred supplier exists for the part

* Adding multiple line items in a single PO

* Uploading a PDF drawing per line item

* Defining or selecting existing CTQ inspection dimensions per line item (see Section 4.3)

* Specifying lot number manually or deferring to auto-generation at receiving

## **2.4 Automatic Data Ingestion**

The MES must support automatic ingestion of PO data from external sources, including:

* CSV or Excel file upload using a configurable field mapping template

* Email parsing: a designated email inbox from which the system can extract structured PO data from supplier order confirmations

* API endpoint: a REST API endpoint that accepts PO data in JSON format, suitable for direct integration with supplier portals or procurement tools

Ingested POs must be reviewed and confirmed by a buyer before they activate. Discrepancies between ingested data and the part master must be flagged for review.

## **2.5 Supplier Master**

The system must maintain a supplier master record for each supplier, containing:

* Supplier name, ID, and contact information

* Country of origin

* Historical on-time delivery rate (calculated from PO ETA vs. actual received date)

* Historical quality acceptance rate (calculated from IQC results)

* Preferred parts (list of part numbers typically sourced from this supplier)

* Notes and qualification status

## **2.6 Lead Time Tracking**

The MES must automatically calculate and maintain actual lead time data for each supplier-part combination based on historical PO records (time from PO submission to received date). This data must be surfaced in the inventory management and replenishment modules (see Section 6).

# **3\. Receiving**

## **3.1 Overview**

The receiving module allows the receiving manager to match incoming physical shipments to open purchase orders and record the details of the receipt. Receiving is the event that transitions parts from 'on order' to 'pending inspection' status.

## **3.2 Receiving Workflow**

1. The receiving manager opens the Receiving interface on a web or mobile device.

2. They search for the relevant purchase order using any of: PO number, supplier name, part number, expected delivery date, or tracking number. Results are displayed in a simple list sorted by ETA.

3. They select the matching PO and confirm or adjust the received quantity per line item.

4. They record the actual delivery date, carrier, tracking number, and any condition notes (e.g., damaged packaging).

5. They confirm receipt. The system automatically transitions the part status to Pending Incoming Inspection and notifies the assigned quality inspector.

6. If a shipment contains multiple POs or partial deliveries, the interface must support splitting and partial receiving.

## **3.3 Receiving Record**

Each receiving event produces a receiving record containing: PO number, line item(s), received quantity, receiving date, carrier, tracking number, receiver name, and condition notes. Receiving records are permanent and immutable once confirmed.

## **3.4 Part Marking and Labeling**

For parts that require internal identification labels, the MES must auto-generate labels immediately upon confirmation of receipt. The label content is configurable per part type and may include any combination of:

* Internal part number

* Part revision

* Supplier name and supplier part number

* Lot number (auto-generated or from PO)

* Serial number within lot (sequential, zero-padded, configurable format)

* Received date

* Country of origin

* PO number

* QR code or barcode encoding any of the above fields

Label format (dimensions, font, fields displayed, barcode type) must be configurable by an administrator per part category. The system must support printing to standard label printers.

## **3.5 Discrepancy Handling**

If the received quantity does not match the ordered quantity, the system must flag the discrepancy and prompt the receiver to document the reason. Short shipments may be left as open for a subsequent delivery. Over-shipments must be reviewed before the excess quantity is admitted to inventory.

# **4\. Incoming Quality Control (IQC)**

## **4.1 Overview**

The IQC module guides a quality inspector through dimensional and attribute inspections of received parts before they are admitted to inventory. The system specifies exactly what to measure, captures the data, evaluates conformance against tolerances, and records the disposition of each lot.

## **4.2 Inspection Triggering**

When a receiving event is confirmed, the system automatically creates an IQC record for each line item and notifies the assigned quality inspector via dashboard alert and (optionally) email or SMS. The inspector can see a queue of all pending inspections sorted by received date.

## **4.3 CTQ Dimension Definition**

Critical-to-quality (CTQ) inspection dimensions are defined per part number and revision. Each CTQ dimension record contains:

* Dimension name / description (e.g., 'Shaft diameter', 'Bearing bore ID', 'Wire resistance per meter')

* Nominal value and unit of measure

* Upper specification limit (USL) and lower specification limit (LSL)

* Measurement tool required (e.g., micrometer, CMM, ohmmeter)

* Measurement method note (free text)

* Sample size rule (inspect all, inspect n per lot, AQL level, or skip)

* Whether this dimension is a safety-critical characteristic (triggers different disposition rules)

CTQ dimensions must be editable by engineers and revision-controlled. When a new part revision is created, the previous revision's CTQ set is copied as a starting point.

## **4.4 Drawing-Based CTQ Extraction (Assisted)**

When a PDF engineering drawing is uploaded with a PO line item, the system must present the inspector or engineer with a tool to review the drawing and semi-automatically extract CTQ dimensions. The system may use optical character recognition or AI-assisted parsing to suggest dimension values from the drawing. All suggested values must be confirmed by a human before they are saved. This feature is not required for system launch but must be architecturally supported from day one.

## **4.5 Inspection Execution**

The inspection interface must:

* Display the part name, drawing (PDF viewer embedded), lot number, and total received quantity

* Display the required sample size and which units to inspect

* Present one CTQ dimension at a time with: dimension name, nominal, LSL, USL, unit, measurement tool, and method note

* Accept numeric entry with immediate pass/fail indication relative to the tolerance band

* Allow the inspector to flag any measurement for review or add a note

* Support entry of multiple samples per dimension

* Track which inspector performed the measurement and the timestamp of each entry

## **4.6 Inspection Disposition**

Upon completing all required measurements, the system calculates an overall lot disposition and presents it to the inspector for confirmation:

* Conforming: all measured dimensions are within tolerance. Parts may be moved to inventory.

* Nonconforming — Rework: one or more dimensions are out of tolerance but the lot is reworkable. The system creates a nonconformance record (NCR) and holds the lot.

* Nonconforming — Use As Is (UAI): disposition by engineering deviation. Requires engineer sign-off in the system.

* Nonconforming — Scrap: parts do not conform and cannot be reworked. The system records the scrap event and deducts quantity from inventory.

All dispositions are recorded permanently and linked to the receiving record and lot number.

## **4.7 Nonconformance Records (NCR)**

Every nonconforming lot generates a Nonconformance Record containing:

* NCR number (auto-generated)

* Linked PO and receiving record

* Part number, revision, lot number, quantity affected

* Failed dimension(s) and measured values

* Disposition and disposition rationale

* Corrective action assigned (free text \+ responsible party \+ due date)

* Supplier notification status

* Resolution date and outcome

# **5\. Part Master and Bill of Materials**

## **5.1 Part Master**

The part master is the central catalog of every part and material used in the factory. Each part record contains:

* Internal part number (format: 510-XXXXX per existing numbering convention)

* Part name and description

* Revision (letter-based, e.g., A, B, C)

* Part category (Magnetic, Electrical, Electronics, Mechanical, Hardware, Process Materials, Tooling, Packaging, Other)

* Unit of measure

* Preferred supplier(s) and supplier part numbers

* Country of origin

* Country of origin of subcomponents and processing steps for magnets

* Current inventory quantity and location

* Minimum stock level (reorder point)

* Target stock level

* Standard cost

* Drawing PDF (current revision)

* CTQ inspection dimensions (linked, see Section 4.3)

* Serialization requirement: None, Lot-level, or Unit-level (individual serial number)

* Hazardous material flag and handling notes

* Active / Obsolete status

## **5.2 Bill of Materials (BOM)**

The BOM defines the complete list of parts and quantities required to build each motor model. The BOM must be:

* Revision-controlled: each BOM has a revision, and historical revisions are preserved

* Multi-level: the BOM reflects the subassembly structure of the motor (e.g., Stator Subassembly, Rotor Subassembly, Wire Harness, Base Assembly, Final Assembly)

* Motor-model specific: each motor model (identified by model number) has its own BOM

* Variant-aware: the BOM must support optional or variant components (e.g., optional preload spacer, choice of enamel stripping method consumables)

* Contain the detail sufficient to translate engineering BOM to a buildable manufacturing BOM

The BOM subassembly structure must reflect the actual manufacturing process:

* Wire Harness subassembly: lead wires, MR30-F connector, shroud, heatshrink

* Stator subassembly: stator lamination stack, magnet wire (various diameters), powder coat, wire harness

* Rotor subassembly: bell, iron ring, NdFeB arc magnets, adhesive, Ti-6Al-4V shaft, balancing compound

* Base subassembly: aluminum base, bearings, adhesive (if used)

* Final assembly: stator subassembly, rotor subassembly, base subassembly, retaining screw, shim washers, packaging components

## **5.3 BOM Change Management**

All BOM changes must be made through a controlled change process:

* An engineer proposes a change, specifying affected parts, quantities, and effective date

* The change is reviewed and approved by an authorized approver

* Upon approval, a new BOM revision is created. The previous revision remains accessible.

* Work orders created after the effective date automatically use the new BOM revision

* Active work orders are flagged if the BOM changes during their execution

# **6\. Inventory Management**

## **6.1 Inventory Record**

The inventory module maintains a real-time count of every part in the facility. Each inventory record contains:

* Part number and revision

* Lot number

* Quantity on hand

* Storage location (bin, shelf, rack — configurable location hierarchy)

* Date received

* Inspection status (Pending IQC, Conforming, Nonconforming, Quarantine)

* Reservation status (Available, Reserved for Work Order)

## **6.2 Inventory Transactions**

All changes to inventory quantity must be recorded as immutable transactions with a timestamp, user, and reason code. Transaction types include: Receive, Issue to Work Order, Return from Work Order, Scrap, Adjustment (with mandatory note), and Transfer between locations.

## **6.3 Inventory Dashboard**

The inventory dashboard must provide the following views:

* All parts: current quantity on hand, on order, reserved, and available (on hand minus reserved)

* Low stock alert: parts at or below reorder point, sorted by urgency

* Parts with no stock and no open PO (stockout risk)

* Slow-moving inventory: parts with no transactions in the last N days (configurable)

* Expiry tracking for adhesives and process chemicals with shelf-life limits

## **6.4 Buildable Units Calculation**

The system must calculate, for each active motor model, how many complete units could be built from current available (unreserved) inventory. This calculation must:

* Use the current active BOM revision

* Exclude inventory reserved for other work orders

* Identify the limiting component (the part with the lowest available quantity relative to its BOM quantity)

* Display the result prominently on the inventory dashboard

* Be recalculated in real time whenever inventory changes

## **6.5 Replenishment and Demand Forecasting**

The inventory module must provide replenishment intelligence based on actual production data:

* Consumption rate: calculated from the rolling average of parts issued to work orders over the past 30, 60, and 90 days (configurable window)

* Days of stock remaining: current available inventory divided by daily consumption rate

* Reorder trigger: when days of stock remaining falls below actual lead time plus a configurable safety buffer, the system raises a replenishment alert

* Suggested order quantity: calculated to bring stock to target level, accounting for minimum order quantities defined in the supplier master

* Production forecast: if a production plan exists (planned work orders), the system uses planned consumption instead of or in addition to historical consumption to project forward

* The system must not automatically place orders; it must surface actionable recommendations for human review and action

## **6.6 FIFO and Lot Control**

The system must enforce First-In, First-Out (FIFO) inventory consumption by default, issuing the oldest conforming lot first when multiple lots of the same part are available. The system must also allow an authorized user to override FIFO with documented justification. Every inventory transaction must preserve the lot number, maintaining full lot traceability.

# **7\. Work Order Management**

## **7.1 Work Order Creation**

A production manager or administrator initiates a work order specifying:

* Motor model (links to the active BOM)

* Quantity to build

* Target start date and target completion date

* Customer name and customer order reference (optional, used for shipping documents)

* Priority level

* Notes

Upon creation, the system automatically:

* Allocates (reserves) the required inventory quantities per the BOM, respecting FIFO lot selection

* Checks inventory availability and alerts if any component is insufficient, identifying the shortage

* Generates kitting instructions (see Section 7.2)

* Checks the latest production process 

* Creates a production traveler document (see Section 7.3)

## **7.2 Kitting Instructions**

Kitting instructions are a printed or on-screen pick list specifying exactly which parts to pull from inventory, including:

* Part number and description

* Required quantity

* Lot number(s) to pull (FIFO-selected by the system)

* Storage location (bin/shelf)

* Destination workstation

* Checkbox confirmation for each line item

The kitting instructions must distinguish between subassembly kits (e.g., Rotor Kit, Stator Kit) so components are staged at the correct workstation. The supply chain manager confirms each line item as pulled, and the MES records the confirmation and deducts the quantity from reserved inventory. Parts move to Work In Progress (WIP) status.

## **7.3 Production Traveler**

The production traveler is a document (printable or digital) that accompanies the work order through the factory. It contains the work order number, motor model, quantity, BOM revision, all process steps in sequence, space for operator sign-off at each step, and data entry fields for in-process measurements. The traveler serves as the physical audit trail and must be retained per quality records policy.

## **7.4 Work Order Status**

Work orders pass through the following statuses: Draft, Released, Kitting, In Production, In Testing, Rework, Complete, Shipped, Cancelled. Each status transition is timestamped and attributed to a user.

## **7.5 Work Order Dashboard**

The production manager dashboard must display all active work orders with: status, motor model, quantity (planned vs. built vs. passed QC), current stage, aging (days since release), and any alerts (shortages, failures, overdue steps).

# **8\. In-Process Production Data Capture**

## **8.1 Overview**

The production data capture module provides operators with simple, task-focused interfaces for recording data at each manufacturing step. The module must accommodate the full process flow of BLDC outrunner motor production across all eight process categories: Stator Production, Stator Electrical Assembly, Wire Harness, Base Assembly, Rotor Assembly, Final Assembly, and Packaging.

## **8.2 Process Step Configuration**

An administrator must be able to configure the complete list of production process steps, their sequence, and the data to be captured at each step — without software development. Each process step record contains:

* Step name and description

* Process category / workstation assignment

* Sequence number within the work order flow

* Whether the step is mandatory or optional

* Data fields to capture (each field has a name, type, unit, and optional pass/fail limits)

* Whether the step requires operator sign-off (name \+ timestamp)

* Whether the step triggers a QC disposition decision

* Cycle time target (used for performance tracking)

The following process steps are defined for the current motor production process and must be pre-configured at system launch:

| Category | Step | Key Data to Capture |
| :---- | :---- | :---- |
| Stator Production | Stamp laminations | Operator, qty stamped, die condition flag |
| Stator Production | Press interlocking laminations | Operator, press force (if instrumented), qty |
| Stator Production | Bake oil off | Oven ID, temperature, duration, batch qty |
| Stator Production | Powder coat | Coating line ID, batch qty, visual inspection pass/fail |
| Stator Electrical Assembly | Winding | Machine ID, wire diameter, winding program ID, qty |
| Stator Electrical Assembly | Trim wires | Operator, wire length confirmation |
| Stator Electrical Assembly | Enamel removal | Method used, operator, visual inspection pass/fail |
| Stator Electrical Assembly | Electrical test (stator) | Phase resistance (3 phases), inductance (3 phases), insulation resistance, pass/fail |
| Stator Electrical Assembly | Attach leads | Method used, operator, pull test result (if performed) |
| Wire Harness | Cut/strip/twist/tin wires | Machine ID, wire gauge, batch qty |
| Wire Harness | Solder connector | Operator, solder temp, visual inspection pass/fail |
| Wire Harness | Slide heatshrink | Operator, confirmation |
| Base Assembly | Insert bearings | Press ID, press force (N), operator, pass/fail |
| Base Assembly | Apply adhesive (if used) | Adhesive lot, dispense weight or volume |
| Base Assembly | Press stator onto base | Press ID, press force (N), operator, pass/fail |
| Base Assembly | Route wires and heatshrink | Operator, visual inspection confirmation |
| Base Assembly | Bake heatshrink | Oven ID, temperature, duration |
| Rotor Assembly | Apply adhesive | Adhesive type and lot number, dispense confirmation |
| Rotor Assembly | Press ring onto bell | Press ID, press force (N), operator, pass/fail |
| Rotor Assembly | Insert magnets | Magnet lot number, polarity sequence verified (yes/no), qty |
| Rotor Assembly | Curing step | Cure method, temperature or UV dose, duration |
| Rotor Assembly | Press shaft into bell | Press ID, press force (N), insertion depth, pass/fail |
| Rotor Assembly | Balance rotor (initial) | Balancer machine ID, initial imbalance (g·mm), plane 1 & 2 |
| Rotor Assembly | Balance rotor (final) | Final imbalance (g·mm), balance grade achieved, compound type and qty applied |
| Final Assembly | Insert rotor onto base | Press ID, operator, magnetic snap check |
| Final Assembly | Add retaining screw | Torque value (N·m), torque tool ID, pass/fail |
| Final Assembly | EOL electrical test | Back-EMF waveform (file or key metrics), phase resistance, insulation resistance, no-load RPM vs. voltage curve, max vibration (g), pass/fail vs. reference curve |
| Packaging | Laser engrave motor serial | Serial number engraved, laser program ID, visual confirmation |
| Packaging | Pack and label | Packaging type (bulk/retail), box ID, operator confirmation |

## **8.3 Operator Interface Requirements**

Operator-facing data capture screens must:

* Be accessible on mobile devices (phones and tablets) and desktop browsers

* Display only the information and fields relevant to the current step — no clutter

* Support barcode and QR code scanning for part identification and serial number entry

* Support camera-based scanning as an alternative to typed serial number entry

* Auto-populate fields where data is available from connected equipment or prior steps

* Provide clear visual pass/fail feedback immediately upon data entry

* Allow operators to add free-text notes to any step

* Require no login beyond a simple operator PIN or badge scan for routine data entry

## **8.4 Automated Data Ingestion from Equipment**

Where manufacturing equipment is capable of outputting data electronically (e.g., servo press force-displacement curves, winding machines, balancing machines, EOL test stations), the MES must support automatic ingestion of that data. The data ingestion framework must:

* Support USB, serial (RS-232), Ethernet, and file-drop (CSV/JSON from a watched folder) as ingestion methods

* Allow an administrator to define the mapping between equipment output fields and MES data fields

* Flag ingested data for operator review if values are outside specification, before saving

* Store raw equipment output files alongside the parsed data records

* Be extensible: adding a new equipment integration must not require core system changes, only a new mapping configuration

## **8.5 Cycle Time Tracking**

The MES must track cycle time per process step with minimal operator burden. The following methods must be supported, selectable per step by an administrator:

* Automatic: the system records the timestamp when the operator opens the step form and when they submit it. Elapsed time is calculated automatically.

* Station scan: the operator scans their badge or a station barcode at the start and end of a step. Suitable for steps where the operator is away from a screen.

* Batch-level: for high-volume steps where individual tracking is impractical, the operator records the batch start time, batch end time, and batch quantity. The system calculates average cycle time per unit.

* Exception-only: the system assumes an expected cycle time. The operator only records a step if it took significantly longer than expected or if a failure occurred. Suitable for mature, stable processes.

Cycle time data must be visible on the workstation performance dashboard (see Section 12.2).

## **8.6 In-Process Failure and Rework Handling**

At any step that includes a pass/fail decision, an operator may record a failure. When a failure is recorded:

* The system creates a nonconformance event linked to the work order, step, and unit serial number (or lot)

* The unit is flagged as Rework Required and may not advance to the next step

* A rework record is opened, specifying the failure mode and proposed corrective action

* Upon rework completion, the step must be re-inspected and the result recorded

* If a unit is scrapped, the system records the scrap event, updates inventory accordingly, and decrements the work order completed quantity

* First-pass yield (FPY) per step is automatically calculated from pass/fail records

# **9\. Serialization and Traceability**

## **9.1 Serialization Levels**

The MES must support three levels of part traceability, configurable per part:

* No traceability: consumables and low-value materials (e.g., flux, heatshrink) are tracked only at lot level for inventory purposes and not individually serialized.

* Lot-level traceability: parts are tracked by lot number. All units in a lot are assumed to be interchangeable. A motor built with lot-level parts carries the lot number of each constituent part.

* Unit-level traceability: each individual part carries a unique serial number. The motor's traceability record links the exact serial number of each unit-level component.

## **9.2 Subassembly Serial Number Assignment**

Subassemblies (Stator, Rotor, Wire Harness, Base) each receive a unique subassembly serial number generated by the MES at the time the subassembly is completed and passes inspection. The serial number format is configurable per subassembly type.

## **9.3 Serial Number Entry Methods**

When an operator needs to associate a component serial number with a work order step, the following entry methods must be supported:

* Manual keyboard entry of the serial number

* Barcode or QR code scan via device camera or handheld scanner

* Automatic from kit: if the kitting process has already associated specific serial numbers with the work order, the system pre-populates the serial numbers for operator confirmation only

## **9.4 Motor Final Serial Number**

Upon passing the end-of-line (EOL) electrical test, the MES automatically generates a final motor serial number. The serial number format is configurable by an administrator and must support:

* Numeric sequential

* Date-coded (e.g., YYYYMMDD-XXXX)

* Model-coded (e.g., model prefix \+ sequential number)

* Custom prefix/suffix

The generated serial number is transmitted to the laser engraving station as the trigger for engraving. The engraving confirmation (operator or automatic) is recorded in the MES and linked to the motor's full production record.

## **9.5 Full Traceability Record**

The complete traceability record for a finished motor must include, in a single queryable view:

* Motor serial number and model

* Work order number and BOM revision

* Final EOL test results and pass/fail status

* Subassembly serial numbers and their constituent component lot and serial numbers

* All in-process measurement data, operator names, and timestamps

* All nonconformance events and their dispositions

* Shipping record (customer, ship date, carrier, tracking number)

This record must be exportable as a PDF certificate of conformance for customer delivery.

## **9.6 Traceability Query Interface**

The system must provide a traceability search tool accessible to engineers and quality personnel. The search must accept any of: motor serial number, subassembly serial number, component lot number, work order number, or date range. Results must display the full production genealogy and flag any associated quality events.

# **10\. End-of-Line (EOL) Test Integration**

## **10.1 Overview**

Every completed motor must pass a final electrical and mechanical test before receiving a serial number and proceeding to packaging. The EOL test module manages the test specification, data capture, pass/fail evaluation, and traceability linkage for every motor tested.

## **10.2 EOL Test Specification**

The EOL test specification is defined per motor model and revision and contains:

* Back-EMF waveform limits (amplitude, THD, symmetry between phases)

* Phase-to-phase resistance (nominal, min, max)

* Phase-to-phase inductance (nominal, min, max)

* Insulation resistance (minimum value at specified test voltage)

* Hi-pot / dielectric withstand test voltage and maximum leakage current

* No-load RPM vs. voltage curve and allowable deviation from reference

* Maximum vibration level (g RMS) at specified test speed

* Thermal class validation (if applicable): temperature rise at specified load

* Noise / acoustic limit (if applicable)

## **10.3 EOL Data Capture**

EOL test data may be entered manually by an operator or ingested automatically from the test station instrument. The system must support:

* Manual entry of individual numeric results with pass/fail evaluation

* File upload of test report from the test station instrument

* Direct instrument integration via the equipment ingestion framework (Section 8.4)

All raw data files from the test instrument must be stored alongside the test record.

## **10.4 EOL Pass/Fail Logic**

The system evaluates each measured parameter against the test specification. A motor passes EOL only if every parameter is within its specification. If any parameter fails, the motor is flagged as Failed — EOL and routed to the rework queue. The rework record must capture the failure parameter, the measured value, and the corrective action taken, and the motor must be re-tested after rework.

## **10.5 EOL Serial Number Gate**

Motor serial number generation (Section 9.4) is gated on EOL pass. A motor that has not passed EOL may not receive a permanent serial number, may not be engraved, and may not be packed for shipment.

# **11\. Shipping and Fulfillment**

## **11.1 Work Order Completion**

A work order is eligible for shipping when all units have passed EOL testing and packaging is complete. The shipping coordinator reviews the completed work order and initiates the shipping process.

## **11.2 Packing List Generation**

The MES automatically generates a packing list for each shipment. The packing list must include:

* Company name and contact information (configured in system settings)

* Customer name, address, and customer PO number (entered with the work order)

* Ship date

* Motor model and description

* Quantity shipped

* Motor serial numbers of all units in the shipment

* Box count and gross weight (entered at shipping)

* Any special handling or regulatory notes

## **11.3 Shipping Label Generation**

The system must generate shipping labels in standard formats compatible with major carriers. Labels must include the customer name and address, shipper address, shipment weight and dimensions, carrier service level, and a carrier-compatible barcode or QR code. Integration with carrier APIs (UPS, FedEx, USPS) for label purchase and tracking number generation is required.

## **11.4 Certificate of Conformance**

At the shipping coordinator's request, the system generates a Certificate of Conformance (CoC) PDF for the shipment. The CoC must include the motor model, serial numbers, EOL test pass confirmation, and a statement that the units conform to the applicable product specification.

## **11.5 Shipping Record**

Each shipment creates an immutable shipping record containing: ship date, carrier, tracking number, customer, motor serial numbers shipped, packing list PDF, and CoC PDF. The shipping record transitions the associated motors and work order to Shipped status.

# **12\. Analytics, Dashboards, and Reporting**

## **12.1 Executive / Operations Dashboard**

A high-level real-time dashboard visible to management must display:

* Units produced today, this week, this month vs. target

* Active work orders and their status

* Overall first-pass yield (current month)

* Open NCRs by age and severity

* Inventory health summary: number of parts at risk of stockout

* On-time delivery rate for current open customer orders

## **12.2 Workstation Performance Dashboard**

Each workstation has a performance view showing:

* Units processed today and this week

* Average cycle time vs. target

* First-pass yield at this station

* Open rework items

* Downtime events (if tracked)

## **12.3 Quality Analytics**

The quality module must provide:

* First-pass yield by process step over time (trend chart)

* Statistical process control (Cp, Cpk) tracking for each step with drift detection

* Pareto chart of failure modes by frequency (and station, tool, tester, software, component version)

* NCR aging report

* Supplier quality scorecard: acceptance rate, on-time delivery, NCR rate per supplier

* EOL test failure rate by motor model and failure parameter

## **12.4 Inventory and Supply Chain Reports**

Standard inventory reports must include:

* Current stock levels vs. reorder points for all parts

* Open POs with ETA and days overdue

* Actual lead time vs. quoted lead time by supplier and part

* Inventory turns rate by part category

* Cost of inventory on hand

## **12.5 Production History and Lot Reports**

The system must be able to generate, on demand:

* Full production history for any date range, motor model, or work order

* Lot genealogy report for any component lot (which motors contain this lot)

* Reverse genealogy: given a motor serial number, list every component lot and serial

* Operator productivity report: units processed and FPY by operator over a time period

* Event stream: station events, WIP moves, downtime, stoppages, consumptions

* Time series/high volume: EOL test inputs

* Blob storage for large raw test files and indexed summaries \- queryable with classical and probabilistic (ie LLM) tools

* Golden keys: serial, operation ID, timestamp windows, resource ID, material lots

## **12.6 Custom Report Builder**

An administrator must be able to build custom tabular reports by selecting data fields from across the MES database, applying filters, and scheduling the report for periodic email delivery. No SQL knowledge should be required.

# **13\. System Administration**

## **13.1 User Management**

* Create, edit, deactivate user accounts

* Role-based access control: each role has a defined set of permitted actions

* Two-factor authentication support

* Audit log of all user logins and actions

## **13.2 Configuration Management**

All system configuration must be manageable through the administrator interface without code changes:

* Motor models and BOMs

* Process step definitions and data capture forms

* Serial number formats and generation rules

* Label templates and print configurations

* CTQ dimension templates

* Inventory reorder parameters

* Workstation definitions and assignments

* Notification rules and recipients

## **13.3 Data Retention and Archival**

Production records, inspection records, and shipping records must be retained indefinitely by default. The system must support configurable archival policies that move old records to lower-cost storage while keeping them queryable. Export of any record set in CSV, Excel, or PDF format must be available to authorized users.

## **13.4 Audit Trail**

Every data change in the system must be logged with: the previous value, the new value, the user who made the change, and the timestamp. The audit trail is immutable and accessible to administrators. Changes to safety-critical fields (EOL test results, IQC dispositions, serial number records) must require a reason code.

## **13.5 Notifications and Alerts**

The system must support configurable notifications delivered via in-app dashboard alert, email, and (optionally) SMS. Standard alert triggers include:

* New IQC inspection pending

* Part stock below reorder point

* Work order overdue

* EOL test failure

* NCR opened or overdue

* PO delivery overdue

* New user account created

## **13.6 CI/CD**

The MES has multiple test environments where changes can be developed and tested before deploying to production environment in use. 

# **14\. Integration Requirements**

## **14.1 Integration Principles**

The MES must expose a documented REST API for all core data objects (parts, POs, work orders, inventory, production records, test results, serial numbers). This API must support third-party integration without modification to the MES core. Authentication must use industry-standard token-based methods.

## **14.2 Required Integrations at Launch**

* Label printers: standard thermal label printers via network print queue or direct API

* Laser engraver: serial number transmission to the laser engraving station via the equipment ingestion framework

* Shipping carriers: UPS, FedEx, and USPS label generation and tracking via carrier APIs

* Email: outbound email for notifications and report delivery

* Must be able to ingest MQTT data (such as from a variety of production machines), but specific mapping of certain datastreams to certain stations or inspection steps is not in scope for launch.

* Grafana or other good open source data science visualization tool

## **14.3 Planned Future Integrations**

* ERP / accounting system: export of purchase order costs, inventory valuation, and labor data

* CAD / PLM system: automated drawing and BOM import from Onshape (current CAD platform)

* EOL test instruments: direct data ingestion from the combined electrical tester / dynamometer

* Servo press stations: automatic ingestion of press force and displacement data

* Dynamic balancing machines: automatic ingestion of balance measurement data

* E-commerce / order management: automatic work order creation from customer orders (e.g., Shopify)

## **14.4 Webhook Support**

The system must support outbound webhooks for key events (e.g., EOL pass, work order complete, NCR opened) so that external systems can subscribe to MES events without polling.

# **15\. Non-Functional Requirements**

## **15.1 Availability and Reliability**

* The system must be available during all scheduled production hours with a target uptime of 99.5% or greater

* Planned maintenance windows must be schedulable outside production hours

* In the event of server unavailability, operators must be able to continue recording data on a local fallback mode (e.g., offline-capable mobile app that syncs when connectivity is restored)

## **15.2 Performance**

* All operator-facing pages must load within 2 seconds on a standard factory Wi-Fi network

* Database queries backing dashboards must complete within 5 seconds for up to 5 years of production history

* The system must support at least 20 simultaneous active users without performance degradation

## **15.3 Security**

* All data in transit must be encrypted using TLS 1.2 or higher

* All data at rest must be encrypted

* Access to production data must require authenticated login; role-based access must be enforced at the API level, not only the UI level

* Security patches must be applied within 30 days of release for critical vulnerabilities

## **15.4 Extensibility**

* Adding a new data field to any form must not require a software release — it must be achievable through the admin configuration interface

* Adding a new process step or reordering steps must be achievable through configuration

* Adding a new motor model and BOM must be achievable through the admin interface

* The system's data model must be documented such that a developer unfamiliar with the system can add a new integration within one day of reading the documentation

## **15.5 Usability**

* A new operator must be able to complete a routine data entry task with no more than 5 minutes of instruction

* All operator-facing screens must be usable on a 5-inch smartphone screen with gloves

* The system must support light and dark display modes for different factory lighting conditions

* Error messages must be plain-language descriptions of the problem and the corrective action required

## **15.6 Data Integrity**

* No production record may be deleted; only marked inactive or superseded

* All serial number assignments are permanent and must never be reused

* All inventory transactions are immutable once confirmed

* Database backups must occur at least daily, with point-in-time recovery capability for the prior 30 days

# **16\. Future Capabilities (Post-Launch Roadmap)**

The following capabilities are out of scope for the initial system launch but must be considered in the architectural design to avoid rework:

| Capability | Description |
| :---- | :---- |
| Production planning and scheduling | Formal production scheduling, capacity planning, and constraint-based scheduling across workstations |
| Onshape BOM sync | Automatic BOM import and change detection from the Onshape CAD system (current platform) |
| Advanced SPC | Statistical process control charts (Xbar-R, Cp/Cpk) for continuous measurement data from in-process inspections |
| Customer portal | Read-only portal for customers to view order status, CoCs, and production data for their motors |
| Preventive maintenance | Equipment maintenance tracking: maintenance schedules, work orders, and maintenance history linked to production records |
| Automated optical inspection (AOI) integration | Integration with vision systems for automated defect detection at key process steps |
| Multi-site support | Support for multiple factory locations with cross-site inventory visibility and inter-site transfer |
| Operator training records | Track which operators are qualified for which process steps and enforce qualification requirements at step assignment |
| CO2 and materials reporting | Track carbon and materials data for ESG reporting and customer sustainability questionnaires |
| Defense contractor compliance (eg ITAR, CMMC) | As needed basis, the regulatory requirements imposed on suppliers to defense contractor primes. |
| JIT | JIT timing for customers \- assume level batch builds for this release. |
| Robust cybersecurity | Network and application level \- ensure basic protections consistent with business critical SaaS webapps for launch |
| Predictive maintenance | Anomaly detection based on machine data and inspection data |

**17\. Integration Tests**

The following tests are initially defined to perform integration tests on the MES:

| \# | Integration Test |
| :---- | :---- |
| 1 | Lot-controlled receiving → QA hold → release → directed putaway → pick |
| 2 | Kit build → kit verification → line-side staging → issue to WIP by scan |
| 3 | Serial creation → full genealogy capture through each process step pulling from latest production process for stator/rotor/final assembly → input from any machine step via MQTT interface |
| 4 | Recipe download → as-run parameter capture → test capture → auto-hold on fail |
| 5 | Rework loop (eg replace bearing / rebalance) with updated genealogy and re-test |
| 6 | Financial reconciliation (Order demand → PO receipts → consumption → completion → variance) |

# **18\. Glossary**

| Term | Definition |
| :---- | :---- |
| BOM | Bill of Materials — the complete list of parts and quantities required to build one motor unit |
| CoC | Certificate of Conformance — a document attesting that a product meets its specification |
| CTQ | Critical-to-Quality — a characteristic whose measurement is required for incoming inspection |
| EOL | End-of-Line — the final test station where a completed motor is electrically and mechanically validated |
| FIFO | First-In, First-Out — inventory consumption order: oldest lot is consumed first |
| FPY | First-Pass Yield — the fraction of units that pass a process step without requiring rework |
| IQC | Incoming Quality Control — inspection of received parts before they enter inventory |
| MES | Manufacturing Execution System — the software system described by this specification |
| NCR | Nonconformance Record — a documented record of a part or assembly that does not meet specification |
| PO | Purchase Order — an order placed with a supplier for parts or materials |
| SPC | Statistical Process Control — the use of statistical methods to monitor and control a manufacturing process |
| WIP | Work In Progress — parts or assemblies that have been pulled from inventory into active production |
| UAI | Use As Is — a disposition for nonconforming material approved for use without rework |

End of Document