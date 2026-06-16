export const demoResponses = {
  // ───────────────────────────────────────────
  // INC5200001 — POS1 Receipt Printer - No Power (AI → TECH if hardware issue)
  // ───────────────────────────────────────────
  INC5200001: {
    // Ticket Creation Flow
    createTicket: {
      requestInfo: `## 🎫 **Create Ticket for POS1 Printer Issue**

I've verified your request to create a ticket for the POS1 receipt printer power issue.

Before proceeding, I need your PC ID to ensure proper ticket creation. Could you please provide your PC ID?

### **Issue Summary**
Based on our conversation, I understand the issue is:

You are experiencing a power failure with the POS1 receipt printer at your store. The troubleshooting steps provided included checking power connections, testing outlets, inspecting power bricks, and attempting power cycling procedures. The printer won't power on and requires further IT support.

Please provide your PC ID to complete the ticket creation! 🚀`,

      ticketCreated: (systemNumber, issueDescription, priority = "Medium", storeLocation = "Store Location") => {
        const ticketId = `INC${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`;
        
        return `## ✅ **Incident Ticket Created Successfully**

**Incident Number:** ${ticketId}

**Subject/Summary:** ${issueDescription}

**Description:**
User is experiencing a ${issueDescription.toLowerCase()} at ${storeLocation}. System/PC: ${systemNumber}. Troubleshooting steps attempted include power connection verification, outlet testing, power brick inspection, and power cycling procedures. Issue remains unresolved and requires further IT support.

**Current State:** New

**Priority:** ${priority}

Your issue has been logged and IT support will follow up.

If you have any additional details or updates, please let me know!`;
      }
    },
    performanceAnalysis: `## 🔍 **POS Printer Power Issue Analysis**

### **Primary Symptoms:**
- Receipt printer won't power on at POS1 station
- Power indicator light is off or not visible
- No response to power button presses
- Power brick may appear loose or damaged

### **Root Cause Analysis:**
**Most Likely:** Power supply or connection issue
- **Power Brick Failure:** External power adapter may be faulty
- **Loose Connections:** Power cable not securely connected
- **Outlet Issues:** Power outlet may not be functional
- **Internal Power Supply:** Printer's internal power supply may have failed

### **Secondary Factors to Investigate:**
- **Cable Integrity:** Check for damaged or frayed power cables
- **Outlet Testing:** Verify outlet works with other devices
- **Power Brick Condition:** Look for physical damage or overheating
- **Recent Changes:** Check for recent power surges or outages

### **Evidence Collection Required:**
- Power indicator light status
- Power brick condition and temperature
- Cable connection security
- Outlet functionality test results
- Any recent power-related incidents
- Store location and POS station details`,

    ramStockCheck: `## ⚡ **Power & Connection Troubleshooting Steps**

### **Step 1: Power Connection Verification**
1) **Check Power Cable:** Ensure power cable is securely connected to both printer and outlet
2) **Test Outlet:** Plug another device (phone charger) into the same outlet
3) **Inspect Power Brick:** Look for damage, overheating, or loose connections
4) **Secure Connections:** Firmly push in all power connections

### **Step 2: Power Brick Testing**
1) **Different Outlet:** Try the power brick in a different outlet
2) **Different Cable:** Test with a known-good power cable if available
3) **Power Brick Swap:** If possible, test with another printer's power brick
4) **Visual Inspection:** Check for burnt smell or visible damage

### **Step 3: Basic Power Cycle**
1) **Unplug Everything:** Remove power cable from printer
2) **Wait 30 Seconds:** Allow any residual power to dissipate
3) **Reconnect Power:** Firmly connect power cable
4) **Press Power Button:** Hold power button for 5 seconds

### **Step 4: Power Verification**
1) **Check LED:** Look for power indicator light
2) **Listen for Sounds:** Any startup sounds or fan noise
3) **Display Check:** Look for any display activity
4) **Test Print:** If powered on, attempt a test print

**Expected Outcome:** Printer should power on with visible indicator light and startup sounds`,

    resolutionPlan: `## 🛠️ **How to resolve**

#### **Power Supply Replacement:**
- Replace external power brick with new unit
- Test printer with known-good power supply
- Verify correct voltage and amperage ratings
- Document power brick model and specifications

#### **Internal Hardware Issues:**
- **Internal Power Supply:** May need printer internal power board replacement
- **Main Board:** Check for burnt components or failed capacitors
- **Connection Issues:** Inspect internal power connections
- **Fuse Replacement:** Check and replace any blown fuses

#### **Environmental Factors:**
- **Power Surge Protection:** Install surge protector for POS equipment
- **Power Quality:** Check for voltage fluctuations
- **Environmental Conditions:** Ensure proper ventilation and temperature`,

    genericResponse: `I'll guide you through the power connection and cable troubleshooting steps first. If the POS1 receipt printer still won't power on after checking the connections and power brick, I can help you create a ticket for further assistance.`,

    crunchTimeUserGuide: `## 👤 **How to Add a New User in CrunchTime!**

### **Steps to add a new user properly in CrunchTime!:**

1. **Open Enterprise Manager** → Click **Application Users** from the Quick Links section.

2. **In the Location drop-down**, select your **Network Name** — users can't be added unless this is chosen.

3. Click the **(+) icon** to create a new user.

4. **On the User tab**, enter required details and add an **email address** for password resets.

5. Select the appropriate **User Group** and access options (e.g., TeamworX Manager Console).

6. **Go to the Locations tab**, click **(+)**, and pick applicable locations.

7. Use **Shift** for consecutive or **Ctrl** for multiple selections.

8. Move selections using arrows, then click **Save**.

9. If locations still don't appear, confirm your access rights or contact **Unified Service Desk (USD)** at **1-800-700-1225**.

---

### **📚 References:**
- 📄 <a href="https://knowledgebasestaging.blob.core.windows.net/knowledgebaseassist/c42ad28d-098c-4d02-a271-9117a5bda3e7/de65a964-c01c-49e6-b153-134e0675f9d5/DD%20Simphony%20Self-Service%20-%20DD%20RSVP%20Self-Service_%20CrunchTime!%20User%20Guide%20-%20Application%20Users_58d67353.pdf?se=2025-10-15T09%3A42%3A35Z&sp=r&sv=2025-05-05&sr=b&sig=7YIhBKNizsrRCyuWdSsivGBWDRTV1BoJT2ZDTO0KdI0%3D" target="_blank" style="color: #0066cc; text-decoration: none; border-bottom: 1px solid #0066cc;">KB0003038 – DD RSVP Self-Service: CrunchTime! User Guide</a>`,
  },

  // ───────────────────────────────────────────
  // INC5200002 — POS21 Receipt Printer - Not Feeding Paper (AI → TECH if hardware issue)
  // ───────────────────────────────────────────
  INC5200002: {
    // Ticket Creation Flow
    createTicket: {
      requestInfo: `## 🎫 **Create Ticket for POS21 Paper Feed Issue**

I'd be happy to help you create a ticket for the POS21 receipt printer paper feed issue! To get started, I'll need some information:

### **Required Information:**
- **System/PC Number:** What's the system or PC number for the POS21 station?
- **Issue Description:** Please describe the paper feed problem you're encountering


Please provide the system/PC number and a brief description of the issue, and I'll create a ticket for you! 🚀`,

      ticketCreated: (systemNumber, issueDescription, priority = "Medium", storeLocation = "Store Location") => {
        const ticketId = `INC${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`;
        
        return `## ✅ **Incident Ticket Created Successfully**

**Incident Number:** ${ticketId}

**Subject/Summary:** ${issueDescription}

**Description:**
User is experiencing a ${issueDescription.toLowerCase()} at ${storeLocation}. System/PC: ${systemNumber}. Troubleshooting steps attempted include paper roll inspection, paper jam clearing, sensor cleaning, and self-test procedures. Issue remains unresolved and requires further IT support.

**Current State:** New

**Priority:** ${priority}

Your issue has been logged and IT support will follow up.

If you have any additional details or updates, please let me know!`;
      }
    },
    performanceAnalysis: `## 🔍 **Receipt Printer Paper Feed Issue Analysis**

### **Primary Symptoms:**
- POS21 receipt printer powers on but won't feed paper
- Red error LED is blinking continuously
- No paper movement when print jobs are sent
- Printer may make clicking sounds but no paper advancement

### **Root Cause Analysis:**
**Most Likely:** Paper feed mechanism or sensor issue
- **Paper Jam:** Paper stuck in feed mechanism or cutter area
- **Paper Sensor:** Dirty or malfunctioning paper-out sensor
- **Feed Motor:** Paper feed motor may be stuck or failing
- **Cutter Blade:** Jammed cutter blade preventing paper advancement

### **Secondary Factors to Investigate:**
- **Paper Installation:** Paper roll may be incorrectly loaded
- **Paper Quality:** Poor quality or damaged thermal paper
- **Mechanical Wear:** Worn feed rollers or mechanism
- **Error Codes:** Specific error patterns in LED indicators

### **Evidence Collection Required:**
- LED indicator status and blinking pattern
- Paper roll installation and condition
- Any visible paper jams or obstructions
- Printer model and serial number
- Store location and POS station details
- Recent paper changes or maintenance`,

    ramStockCheck: `## ⚡ **Paper Feed Troubleshooting Steps**

### **Step 1: Paper Roll Inspection**
1) **Open Printer Cover:** Carefully open the printer cover
2) **Check Paper Roll:** Verify paper roll is correctly installed
3) **Paper Orientation:** Ensure paper is loaded with correct side facing up
4) **Remove Obstructions:** Look for any jammed paper or debris

### **Step 2: Paper Jam Clearing**
1) **Remove Jammed Paper:** Gently pull out any stuck paper
2) **Check Cutter Area:** Look for paper stuck around cutter blades
3) **Clean Mechanism:** Remove any paper fragments or debris
4) **Reset Cutter:** Manually reset cutter blade if accessible

### **Step 3: Sensor Cleaning**
1) **Locate Sensors:** Find paper-out and feed sensors
2) **Clean Sensors:** Use dry cloth to clean sensor surfaces
3) **Check Connections:** Verify sensor cables are secure
4) **Test Sensors:** Manually trigger sensors to test response

### **Step 4: Self-Test Procedure**
1) **Hold Feed Button:** Press and hold FEED button while powering on
2) **Run Self-Test:** Allow printer to complete self-test sequence
3) **Observe Behavior:** Watch for paper movement and error indicators
4) **Check Results:** Note any error codes or failure patterns

**Expected Outcome:** Printer should feed paper properly during self-test and respond to print commands`,

    resolutionPlan: `## 🛠️ **How to resolve**

#### **Mechanical Component Replacement:**
- **Feed Motor:** Replace paper feed motor assembly
- **Feed Rollers:** Replace worn feed rollers
- **Paper Sensors:** Replace malfunctioning paper sensors
- **Cutter Assembly:** Replace jammed or damaged cutter

#### **Advanced Diagnostics:**
- **Motor Testing:** Test feed motor with multimeter
- **Sensor Calibration:** Calibrate paper sensors
- **Mechanism Lubrication:** Lubricate moving parts
- **Alignment Check:** Verify proper component alignment

#### **Preventive Measures:**
- **Paper Quality:** Use recommended thermal paper
- **Regular Maintenance:** Implement cleaning schedule
- **Environmental Control:** Maintain proper temperature/humidity
- **Usage Monitoring:** Track paper consumption patterns`,


    genericResponse: `I'll guide you through the paper jam clearing and sensor cleaning steps first. If the POS21 printer still won't feed paper after these troubleshooting steps, I can help you create a ticket for further assistance.`,

    employeeLoginGuide: `## 👤 **Steps to Add and Sync a New User Properly in CrunchTime**

### **1. Verify employee setup in Oracle R&A:**
- Go to **Labor → Human Resources → Employee** and confirm the record has the correct **Home Store**, **Hire Status**, and **Employee Role**.
- Make sure a valid **9-digit POS Password** and **Magnetic Card Number** are entered — both must match.

### **2. Confirm location access in Enterprise Manager:**
- In **Enterprise Manager → Application Users**, select your **Network Name** from the Location drop-down before adding or modifying users.
- Ensure the user has the proper store locations assigned, and that changes were **saved and synced overnight**.

### **3. Verify EMC installation and login:**
- Check that **EMC is installed on a Windows-based PC** (not Mac) that meets system requirements — Windows 7–10, .NET 4.6 or higher, 1 GHz CPU, and at least 1 GB RAM.
- Confirm you're using the correct **EMC server URL** and credentials provided by NCR.

### **4. Sync verification:**
- Wait around **15 minutes** for employee data to sync from Oracle R&A to CrunchTime Net-Chef.
- Check under **Labor → Employee Maintenance** in Net-Chef to ensure the user appears correctly.

### **5. If the issue continues:**
- Contact **Unified Service Desk (USD)** at **1-800-700-1225** for assistance.

---

### **📚 References:**
- 📄 <a href="https://knowledgebasestaging.blob.core.windows.net/knowledgebaseassist/c42ad28d-098c-4d02-a271-9117a5bda3e7/de65a964-c01c-49e6-b153-134e0675f9d5/DD%20Simphony%20Self-Service%20-%20DD%20RSVP%20Self-Service_%20CrunchTime!%20User%20Guide%20-%20Application%20Users_58d67353.pdf?se=2025-10-15T09%3A42%3A35Z&sp=r&sv=2025-05-05&sr=b&sig=7YIhBKNizsrRCyuWdSsivGBWDRTV1BoJT2ZDTO0KdI0%3D" target="_blank" style="color: #0066cc; text-decoration: none; border-bottom: 1px solid #0066cc;">KB0003038 – DD RSVP Self-Service: CrunchTime! User Guide – Application Users</a>
- 📄 <a href="https://knowledgebasestaging.blob.core.windows.net/knowledgebaseassist/c42ad28d-098c-4d02-a271-9117a5bda3e7/de65a964-c01c-49e6-b153-134e0675f9d5/DD%20Simphony%20Self-Service%20-%20Dunkin%20RSVP%20Self-Service_%20Employee%20Set%20Up%20Guide_ccbf4884.pdf?se=2025-10-15T09%3A42%3A35Z&sp=r&sv=2025-05-05&sr=b&sig=M59I1ZlGfaagOwP73cEM1pstPvbE4%2BuQc75ZBefUV%2Bc%3D" target="_blank" style="color: #0066cc; text-decoration: none; border-bottom: 1px solid #0066cc;">KB0003049 – DD RSVP Self-Service: Employee Set Up Guide</a>
- 📄 <a href="https://knowledgebasestaging.blob.core.windows.net/knowledgebaseassist/c42ad28d-098c-4d02-a271-9117a5bda3e7/de65a964-c01c-49e6-b153-134e0675f9d5/DD%20Simphony%20Self-Service%20-%20DD%20RSVP%20Self-Service_%20Downloading%20EMC_7d3dc6f7.pdf?se=2025-10-15T09%3A42%3A35Z&sp=r&sv=2025-05-05&sr=b&sig=amsmhubs2z3YvJlF/RAVeF10ptMEZ1JE0PRhahkKxh4%3D" target="_blank" style="color: #0066cc; text-decoration: none; border-bottom: 1px solid #0066cc;">KB0003045 – DD RSVP Self-Service: Downloading EMC</a>`,
  },

  // ───────────────────────────────────────────
  // INC5200003 — POS2 Receipt Printer - Incorrect Port Mapping (AI → TECH if needed)
  // ───────────────────────────────────────────
  INC5200003: {
    // Ticket Creation Flow
    createTicket: {
      requestInfo: `## 🎫 **Create Ticket for POS2 Port Configuration Issue**

I'd be happy to help you create a ticket for the POS2 printer port configuration issue! To get started, I'll need some information:

### **Required Information:**
- **System/PC Number:** What's the system or PC number for the POS2 station?
- **Issue Description:** Please describe the printer configuration problem you're encountering


Please provide the system/PC number and a brief description of the issue, and I'll create a ticket for you! 🚀`,

      ticketCreated: (systemNumber, issueDescription, priority = "Medium", storeLocation = "Store Location") => {
        const ticketId = `INC${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`;
        
        return `## ✅ **Incident Ticket Created Successfully**

**Incident Number:** ${ticketId}

**Subject/Summary:** ${issueDescription}

**Description:**
User is experiencing a ${issueDescription.toLowerCase()} at ${storeLocation}. System/PC: ${systemNumber}. Troubleshooting steps attempted include port verification, driver verification, port reassignment, and POS software configuration. Issue remains unresolved and requires further IT support.

**Current State:** New

**Priority:** ${priority}

Your issue has been logged and IT support will follow up.

If you have any additional details or updates, please let me know!`;
      }
    },
    performanceAnalysis: `## 🔍 **POS Printer Port Configuration Analysis**

### **Primary Symptoms:**
- POS2 printer is detected by system but print jobs fail
- Printer appears in device list but won't print receipts
- Likely wrong COM/USB port mapping after device swap
- Print queue shows jobs but no physical output

### **Root Cause Analysis:**
**Most Likely:** Port mapping or driver configuration issue
- **Port Mismatch:** Printer assigned to wrong COM/USB port
- **Driver Issues:** Incorrect or outdated printer driver installed
- **Device Swap:** Port mapping not updated after hardware replacement
- **POS Software:** POS application not configured for correct port

### **Secondary Factors to Investigate:**
- **Driver Version:** Check for latest compatible driver
- **Port Assignment:** Verify correct port assignment in Windows
- **POS Configuration:** POS software printer settings
- **Device Manager:** Check for driver conflicts or errors

### **Evidence Collection Required:**
- Current port assignment (COM/USB)
- Printer driver version and model
- POS software version
- Device Manager status
- Any error messages in print queue
- Store location and POS station details`,

    ramStockCheck: `## ⚡ **Port & Driver Configuration Steps**

### **Step 1: Port Verification**
1) **Device Manager:** Open Device Manager and locate printer
2) **Check Port:** Right-click printer → Properties → Ports tab
3) **Current Port:** Note current port assignment (COM1, USB001, etc.)
4) **Available Ports:** Check what ports are available

### **Step 2: Driver Verification**
1) **Driver Properties:** Right-click printer → Properties → Advanced
2) **Driver Version:** Check installed driver version
3) **Driver Update:** Update driver if newer version available
4) **Driver Rollback:** If recent update, consider rolling back

### **Step 3: Port Reassignment**
1) **Change Port:** In Device Manager, change to correct port
2) **Test Port:** Try different available ports (COM1, COM2, USB001, etc.)
3) **Apply Changes:** Save changes and restart printer service
4) **Verify Detection:** Confirm printer is detected on new port

### **Step 4: POS Software Configuration**
1) **POS Settings:** Open POS software printer settings
2) **Port Selection:** Select correct port for POS2 printer
3) **Driver Selection:** Choose correct printer driver/model
4) **Test Print:** Send test print from POS software

**Expected Outcome:** Printer should be detected on correct port and respond to print commands`,

    resolutionPlan: `## 🛠️ **How to resolve**

#### **Advanced Driver Management:**
- **Driver Cleanup:** Remove all printer drivers and reinstall
- **Registry Cleanup:** Clean printer-related registry entries
- **Driver Conflicts:** Resolve driver conflicts with other devices
- **Windows Updates:** Apply pending Windows updates

#### **POS Software Configuration:**
- **Software Reinstall:** Reinstall POS software if corrupted
- **Configuration Reset:** Reset POS printer configuration
- **Database Repair:** Repair POS database if corrupted
- **Service Restart:** Restart all POS-related services

#### **Hardware Verification:**
- **Cable Testing:** Test USB/serial cables with known-good printer
- **Port Testing:** Test different USB/serial ports on POS terminal
- **Printer Testing:** Test printer with different POS terminal
- **Firmware Update:** Update printer firmware if available`,


    genericResponse: `I'll guide you through the port verification and driver configuration steps first. If the POS2 printer still won't print after checking the port mapping and driver settings, I can help you create a ticket for further assistance.`,
  },

  // ───────────────────────────────────────────
  // INC5200004 — Cash Drawer Fault — Applied EMC Workaround (AI → TECH if needed)
  // ───────────────────────────────────────────
  INC5200004: {
    // Ticket Creation Flow
    createTicket: {
      requestInfo: `## 🎫 **Create Ticket for Cash Drawer Sensor Issue**

I'd be happy to help you create a ticket for the cash drawer sensor issue! To get started, I'll need some information:

### **Required Information:**
- **System/PC Number:** What's the system or PC number for the cash drawer station?
- **Issue Description:** Please describe the cash drawer sensor problem you're encountering


Please provide the system/PC number and a brief description of the issue, and I'll create a ticket for you! 🚀`,

      ticketCreated: (systemNumber, issueDescription, priority = "Medium", storeLocation = "Store Location") => {
        const ticketId = `INC${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`;
        
        return `## ✅ **Incident Ticket Created Successfully**

**Incident Number:** ${ticketId}

**Subject/Summary:** ${issueDescription}

**Description:**
User is experiencing a ${issueDescription.toLowerCase()} at ${storeLocation}. System/PC: ${systemNumber}. Troubleshooting steps attempted include EMC workaround verification, transaction flow testing, staff training confirmation, and Oracle escalation preparation. Issue remains unresolved and requires further IT support.

**Current State:** New

**Priority:** ${priority}

Your issue has been logged and IT support will follow up.

If you have any additional details or updates, please let me know!`;
      }
    },
    performanceAnalysis: `## 🔍 **Cash Drawer Sensor Failure Analysis**

### **Primary Symptoms:**
- Cash drawer sensor failing intermittently or completely
- Drawer may not open automatically after transactions
- Manual drawer operation required to continue sales
- EMC workaround has been applied to maintain operations

### **Root Cause Analysis:**
**Most Likely:** Cash drawer sensor hardware failure or misalignment
- **Sensor Wear:** Mechanical sensor has reached end of life
- **Alignment Issues:** Drawer mechanism misaligned affecting sensor trigger
- **Wiring Problems:** Loose or damaged sensor wiring connections
- **EMC Configuration:** Workaround applied but permanent fix needed

### **Current Workaround Status:**
- **P1535 Procedure Applied:** Cash drawer requirement disabled in EMC
- **Manual Operation:** Store staff must manually open drawer for each transaction
- **Sales Continuity:** Operations maintained but inefficient
- **Oracle Escalation:** Pending for hardware replacement or advanced troubleshooting

### **Evidence Collection Required:**
- Drawer sensor physical condition
- Wiring connection integrity
- EMC workaround configuration status
- Frequency of manual interventions required
- Store approval for extended manual operation
- Oracle escalation ticket number if applicable`,

    ramStockCheck: `## ⚡ **EMC Workaround Verification & Management**

### **Step 1: Verify Current Workaround Status**
1) **Check EMC Configuration:** Verify "Require Cash Drawer to be Closed Before New Transaction" is disabled
2) **Test Transaction Flow:** Complete a test sale to confirm manual drawer operation works
3) **Staff Training:** Ensure all staff know to manually open drawer for each transaction
4) **Documentation:** Record current workaround implementation date and responsible staff

### **Step 2: Monitor Workaround Effectiveness**
1) **Sales Continuity:** Confirm no sales are being lost due to drawer issues
2) **Staff Efficiency:** Monitor impact on transaction speed and customer service
3) **Manual Interventions:** Track frequency of manual drawer operations required
4) **Error Tracking:** Note any additional issues that arise from manual operation

### **Step 3: Oracle Escalation Preparation**
1) **Ticket Status:** Check Oracle escalation ticket status and expected resolution timeline
2) **Hardware Documentation:** Prepare sensor model, serial number, and failure details
3) **Business Impact:** Document operational impact and customer service concerns
4) **Replacement Planning:** Coordinate hardware replacement scheduling with store operations

**Success Criteria:**
- Manual drawer operation maintains sales continuity
- No customer service disruptions due to drawer issues
- Oracle escalation progressing toward permanent resolution
- Staff properly trained on temporary procedures`,

    resolutionPlan: `## 🛠️ **How to resolve**

#### **Cash Drawer Hardware Replacement:**
- **Sensor Replacement:** Install new cash drawer sensor assembly
- **Wiring Verification:** Check and repair any damaged sensor wiring
- **Mechanical Alignment:** Ensure proper drawer mechanism alignment
- **EMC Re-enablement:** Re-enable automatic drawer operation in EMC

#### **Oracle Escalation Management:**
- **Hardware Coordination:** Work with Oracle for sensor replacement parts
- **Installation Scheduling:** Coordinate technician visit with store operations
- **Testing Protocol:** Verify sensor operation after replacement
- **EMC Configuration:** Restore normal cash drawer functionality`,


    genericResponse: `I can help you verify the current EMC workaround status and ensure your team is properly trained on manual drawer operations. If you need further assistance with the cash drawer sensor replacement, I can help you create a ticket for Oracle coordination.`,
  },

  // ───────────────────────────────────────────
  // INC5200005 — KDS2 Receipt Printer - Faded Receipts (AI → TECH if needed)
  // ───────────────────────────────────────────
  INC5200005: {
    // Ticket Creation Flow
    createTicket: {
      requestInfo: `## 🎫 **Create Ticket for KDS2 Printer Quality Issue**

I'd be happy to help you create a ticket for the KDS2 printer quality issue! To get started, I'll need some information:

### **Required Information:**
- **System/PC Number:** What's the system or PC number for the KDS2 station?
- **Issue Description:** Please describe the print quality problem you're encountering


Please provide the system/PC number and a brief description of the issue, and I'll create a ticket for you! 🚀`,

      ticketCreated: (systemNumber, issueDescription, priority = "Medium", storeLocation = "Store Location") => {
        const ticketId = `INC${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`;
        
        return `## ✅ **Incident Ticket Created Successfully**

**Incident Number:** ${ticketId}

**Subject/Summary:** ${issueDescription}

**Description:**
User is experiencing a ${issueDescription.toLowerCase()} at ${storeLocation}. System/PC: ${systemNumber}. Troubleshooting steps attempted include paper roll replacement, thermal head cleaning, self-test and adjustment, and validation testing. Issue remains unresolved and requires further IT support.

**Current State:** New

**Priority:** ${priority}

Your issue has been logged and IT support will follow up.

If you have any additional details or updates, please let me know!`;
      }
    },
    performanceAnalysis: `## 🔍 **KDS2 Faded Receipts Analysis**

### **Primary Symptoms:**
- KDS2 receipt printer producing very light, faded prints
- Receipts difficult or impossible to read during rush periods
- Print quality degrading over time
- Thermal paper may appear worn or damaged

### **Root Cause Analysis:**
**Most Likely:** Thermal paper depletion or thermal head contamination
- **Paper Quality:** Thermal paper roll may be low quality or expired
- **Thermal Head:** Print head may be dirty or contaminated
- **Paper Orientation:** Paper may be loaded with wrong side facing thermal head
- **Print Settings:** Darkness level may need adjustment

### **Secondary Factors to Investigate:**
- **Paper Age:** Check thermal paper expiration date and storage conditions
- **Head Cleanliness:** Inspect thermal head for debris or contamination
- **Temperature:** Environmental temperature affecting thermal printing
- **Usage Patterns:** High-volume printing wearing down thermal head

### **Evidence Collection Required:**
- Print quality samples (before/after troubleshooting)
- Thermal paper roll model and expiration date
- Thermal head condition and cleanliness
- Recent print volume and usage patterns
- Environmental conditions (temperature, humidity)
- Printer self-test results`,

    ramStockCheck: `## ⚡ **Thermal Paper & Print Quality Fix**

### **Step 1: Paper Roll Replacement**
1) **Remove Old Paper:** Take out the current thermal paper roll
2) **Check Paper Quality:** Inspect for damage, moisture, or expiration date
3) **Install New Roll:** Load fresh thermal paper with correct orientation
4) **Verify Loading:** Ensure paper is properly threaded through the mechanism

### **Step 2: Thermal Head Cleaning**
1) **Power Off:** Turn off the printer and unplug power cable
2) **Clean Head:** Use isopropyl alcohol and cotton swab to clean thermal head
3) **Remove Debris:** Clear any paper dust or residue from print mechanism
4) **Dry Completely:** Allow thermal head to dry before powering on

### **Step 3: Self-Test & Adjustment**
1) **Run Self-Test:** Hold FEED button while powering on printer
2) **Check Print Quality:** Examine self-test output for darkness and clarity
3) **Adjust Darkness:** Use printer menu to increase darkness level if needed
4) **Test Print:** Print a sample receipt to verify quality improvement

### **Step 4: Validation Testing**
1) **Multiple Prints:** Print several test receipts to ensure consistency
2) **Rush Simulation:** Test print quality during high-volume periods
3) **Quality Check:** Verify receipts are readable and professional looking
4) **Staff Training:** Ensure staff know proper paper loading procedures

**Success Criteria:**
- Receipts print with clear, dark text
- No fading or light printing issues
- Consistent quality across multiple prints
- Self-test shows optimal print darkness`,

    resolutionPlan: `## 🛠️ **How to resolve**

### **Hardware Issues (Tech Required)**
**If print quality remains poor after troubleshooting:**

#### **Thermal Head Replacement:**
- **Head Assessment:** Thermal head may need replacement due to wear
- **Professional Cleaning:** Deep cleaning of thermal head assembly
- **Print Mechanism:** Check for mechanical issues affecting print quality
- **Calibration:** Recalibrate print darkness and alignment settings

#### **Advanced Troubleshooting:**
- **Paper Quality Testing:** Test with different thermal paper brands/types
- **Environmental Factors:** Check for temperature/humidity issues
- **Printer Settings:** Adjust advanced print settings and darkness levels
- **Component Replacement:** Replace thermal head or entire print mechanism`,


    genericResponse: `I'll guide you through the thermal paper replacement and thermal head cleaning steps first. If the KDS2 printer still produces faded receipts after these troubleshooting steps, I can help you create a ticket for further assistance.`,
  },

  // ───────────────────────────────────────────
  // INC5200006 — Device Unreachable — POS Switch Rack 1 (AI → TECH if needed)
  // ───────────────────────────────────────────
  INC5200006: {
    // Ticket Creation Flow
    createTicket: {
      requestInfo: `## 🎫 **Create Ticket for POS Switch Network Issue**

I'd be happy to help you create a ticket for the POS switch network issue! To get started, I'll need some information:

### **Required Information:**
- **System/PC Number:** What's the system or PC number for the affected POS terminals?
- **Issue Description:** Please describe the network connectivity problem you're encountering


Please provide the system/PC number and a brief description of the issue, and I'll create a ticket for you! 🚀`,

      ticketCreated: (systemNumber, issueDescription, priority = "Critical", storeLocation = "Store Location") => {
        const ticketId = `INC${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`;
        
        return `## ✅ **Incident Ticket Created Successfully**

**Incident Number:** ${ticketId}

**Subject/Summary:** ${issueDescription}

**Description:**
User is experiencing a ${issueDescription.toLowerCase()} at ${storeLocation}. System/PC: ${systemNumber}. Troubleshooting steps attempted include power and physical checks, network connectivity tests, emergency operations procedures, and documentation for escalation. Issue remains unresolved and requires further IT support.

**Current State:** New

**Priority:** ${priority}

Your issue has been logged and IT support will follow up.

If you have any additional details or updates, please let me know!`;
      }
    },
    performanceAnalysis: `## 🔍 **POS Switch Network Outage Analysis**

### **Primary Symptoms:**
- Multiple POS terminals offline simultaneously
- POS switch in Rack 1 not responding to network requests
- Store operations severely impacted by terminal unavailability
- Network connectivity completely lost to affected POS stations

### **Root Cause Analysis:**
**Most Likely:** POS switch hardware failure or power issue
- **Switch Power:** Power supply failure or UPS issue affecting switch
- **Uplink Failure:** Network cable or connection to core network failed
- **Hardware Malfunction:** Switch hardware failure requiring replacement
- **Firmware Issues:** Switch firmware corruption or configuration problems

### **Secondary Factors to Investigate:**
- **Power Infrastructure:** Check UPS status and power delivery to switch
- **Cable Integrity:** Inspect network cables and connections
- **Switch Health:** Check for hardware errors, overheating, or damage
- **Network Configuration:** Verify VLAN settings and network policies
- **Environmental Factors:** Check for power surges, temperature issues

### **Evidence Collection Required:**
- Number of affected POS terminals
- Switch LED indicator status (power, link, activity)
- UPS status and power delivery confirmation
- Network cable condition and connectivity
- Switch model, serial number, and firmware version
- Time of outage and duration of impact`,

    ramStockCheck: `## ⚡ **POS Switch Emergency Troubleshooting**

### **Step 1: Power & Physical Checks**
1) **Power Verification:** Check if switch power LED is on and UPS is functioning
2) **Cable Inspection:** Verify all network cables are securely connected
3) **LED Status:** Check switch LED indicators for power, link, and activity
4) **Physical Damage:** Look for signs of overheating, damage, or loose connections

### **Step 2: Network Connectivity Tests**
1) **Uplink Verification:** Check connection from switch to core network
2) **Port Testing:** Test individual switch ports with known-good cables
3) **Power Cycle:** Attempt switch power cycle (off for 30 seconds, then on)
4) **Alternative Connection:** Try connecting POS terminals to backup switch if available

### **Step 3: Emergency Operations**
1) **Backup Switch:** Deploy backup switch if available to restore operations
2) **Manual Transactions:** Implement manual transaction procedures if needed
3) **Customer Communication:** Notify customers of temporary service limitations
4) **Staff Coordination:** Ensure staff are trained on emergency procedures

### **Step 4: Documentation & Escalation**
1) **Impact Assessment:** Document number of affected terminals and customers
2) **Switch Details:** Record switch model, serial number, and configuration
3) **Timeline:** Note exact time of outage and duration of impact
4) **Emergency Contact:** Notify NetOps team immediately for urgent response

**Success Criteria:**
- Switch power and connectivity restored
- POS terminals back online and operational
- Network connectivity stable for 15+ minutes
- All affected terminals passing network tests`,

    resolutionPlan: `## 🛠️ **How to resolve**

#### **Switch Hardware Replacement:**
- **Switch Replacement:** Install replacement POS switch
- **Configuration Transfer:** Migrate network configuration and VLAN settings
- **Cable Verification:** Test and replace any damaged network cables
- **Uplink Restoration:** Restore connection to core network infrastructure

#### **Infrastructure Assessment:**
- **UPS Evaluation:** Check UPS functionality and battery backup
- **Power Distribution:** Verify stable power delivery to network equipment
- **Environmental Factors:** Check for temperature, humidity, or power surge issues
- **Network Redundancy:** Implement backup switch configuration if available`,


    genericResponse: `I'll guide you through the emergency switch troubleshooting steps first, including power cycling and cable checks. Since this is affecting multiple POS terminals, I can help you create a ticket for NetOps emergency response to restore your store operations.`,
  },
};
