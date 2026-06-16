export const demoResponses = {
  // ───────────────────────────────────────────
  // INC0128768 — Boarding pass scan @ Gate 42 (AI → TECH if still failing)
  // ───────────────────────────────────────────
  INC0128768: {
    performanceAnalysis: `## 🔍 **Scan Issue Analysis**

### **Primary Symptoms:**
- Scanner hardware fails to read boarding pass barcodes/QR codes
- Wi-Fi connectivity restored after device restart
- App may show "No read" or timeout errors
- Potential intermittent scanning success

### **Root Cause Analysis:**
**Most Likely:** App session token expired due to captive portal reauthentication failure
- **Token Lifecycle:** Mobile apps typically cache auth tokens for 24-48 hours
- **Captive Portal Impact:** When device reconnects to AA-OPS network, portal may not properly refresh app tokens
- **Session State:** App remains logged in but loses backend API access

### **Secondary Factors to Investigate:**
- **Time Synchronization:** Device time drift >2 minutes can invalidate tokens
- **Hardware State:** Scanner lens contamination, HID/wedge mode configuration
- **App State:** Offline mode activation, safe mode restrictions
- **Network Configuration:** AP-specific settings, roaming thresholds

### **Evidence Collection Required:**
- Exact error messages from scanner app logs
- App version and build number
- Device ID and serial number
- AP name and signal strength at Gate 42
- Local device time vs. server time
- Last successful scan timestamp`,

    ramStockCheck: `## 🌐 **Network/App Token Reset Procedure**

### **Step 1: Network Reauthentication**
1) **Airplane Mode Reset:** Enable airplane mode for 10 seconds, then disable
2) **Reconnect to AA-OPS:** Manually select and connect to AA-OPS network
3) **Captive Portal Trigger:** Open any website (e.g., google.com) to force captive portal
4) **Complete Authentication:** Enter credentials if prompted, accept terms

### **Step 2: App Session Reset**
1) **Sign Out:** Completely sign out of scanner application
2) **Clear Cache:** If prompted, clear app cache and temporary data
3) **Sign Back In:** Re-authenticate with fresh credentials
4) **Verify Permissions:** Ensure app has camera/scanner permissions

### **Step 3: System Configuration**
1) **Time Sync:** Verify "Set time automatically" is enabled
2) **Time Zone:** Confirm correct timezone (EST/CST/PST)
3) **App Restart:** Force-close and relaunch scanner app
4) **Background Refresh:** Ensure app background refresh is enabled

### **Step 4: Testing Protocol**
1) **Test Scan:** Attempt to scan a test boarding pass
2) **Multiple Attempts:** Try scanning 2-3 different passes
3) **Error Monitoring:** Note any error messages or timeouts
4) **Success Validation:** Confirm successful scans without "no read" errors

**Expected Outcome:** Scanner should successfully read barcodes/QR codes with <2 second response time`,

    resolutionPlan: `## 🛠️ **Resolution Plan & Escalation Path**

### **Hardware/Configuration Issues (Tech Required)**
**If scanning still fails after token reset:**

#### **Device Profile Re-provisioning:**
- Reset device enrollment in MDM system
- Re-push scanner app configuration
- Verify device compliance policies
- Update device certificates if expired

#### **Hardware Diagnostics:**
- **Scanner Mode:** Verify HID/wedge mode is correctly configured
- **Lens Cleaning:** Clean scanner lens with appropriate cleaning solution
- **Hardware Test:** Run built-in scanner diagnostic tests
- **Power Cycle:** Complete device power cycle (not just restart)

#### **Network Configuration:**
- Verify Router-specific scanner configuration
- Check for network policy changes
- Validate device network profile
- Test scanner on different router if available`,

    onsiteScheduling: `## 📅 **Onsite Technician Scheduled**

### **Visit Details:**
- **Date:** ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- **Time:** 2:00–3:00 PM local time
- **Duration:** 1 hour
- **Location:** Gate 42 scanner station
- **Service ID:** ONS-${Date.now().toString().slice(-6)}
- **SR Number:** SR-${Date.now().toString().slice(-8)}

### **Scheduled Tasks:**
1. **Device Profile Re-provisioning**
2. **Hardware Inspection & Maintenance**
   
3. **Configuration Verification**
   
4. **Testing & Validation**
  

### **Success Criteria:**
- Scanner successfully reads barcodes/QR codes
- Response time <2 seconds per scan
- No error messages in app logs
- Stable operation for 10+ minutes`,

    genericResponse: `I can guide you through the scanner token reset and app re-provisioning steps now. If the boarding pass scanner still fails after these steps, I'll dispatch an onsite technician to check the hardware and device profile configuration.`,
  },

  // ───────────────────────────────────────────
  // INC0140258 — Wi-Fi cannot connect at Gate 30 (AI)
  // ───────────────────────────────────────────
  INC0140258: {
    performanceAnalysis: `## 🔍 **Wi-Fi Connection Triage**

### **Primary Symptoms:**
- Device unable to connect to Wi-Fi network at Gate 30
- Connection attempts fail or timeout
- May show "Authentication failed" or "No internet access"
- Device may connect but cannot browse or access services

### **Root Cause Analysis:**
**Most Likely:** Captive portal authentication failure or session mismatch
- **DHCP Issues:** Stale IP release preventing proper network access
- **DNS Cache:** Corrupted DNS cache blocking domain resolution
- **Session Timeout:** Captive portal session expired without proper renewal
- **Certificate Issues:** Outdated or invalid network certificates

### **Environmental Factors:**
- **AP Health:** Check if other users in the same area are affected
- **AP Status:** Verify AP LED indicators (green = healthy, red = issues)
- **SSID Visibility:** Confirm network is broadcasting and discoverable
- **Recent Changes:** Check for recent password updates or certificate changes
- **Signal Strength:** Verify adequate signal strength (-70 dBm or better)

### **Network Configuration Issues:**
- **Roaming Thresholds:** Device may not properly roam between APs
- **Channel Interference:** 2.4GHz/5GHz channel conflicts
- **Power Settings:** AP power levels may be too low
- **Client Limits:** AP may have reached maximum client capacity`,

    ramStockCheck: `## ⚡ **Wi-Fi Connection Recovery Steps**

### **Step 1: Network Interface Reset**
1) **Airplane Mode:** Enable for 10 seconds, then disable
2) **Forget Network:** Remove SSID from saved networks
3) **Reconnect:** Manually select and connect to the SSID
4) **Enter Credentials:** Use current network password

### **Step 2: DNS Cache Clear**
**Windows:**
- Open Command Prompt as Administrator
- Run: \`ipconfig /flushdns\`
- Run: \`ipconfig /release\` then \`ipconfig /renew\`

**Mac:**
- Open Terminal
- Run: \`sudo dscacheutil -flushcache\`
- Run: \`sudo killall -HUP mDNSResponder\`


### **Step 3: Captive Portal Authentication**
1) **Trigger Portal:** Open any website (google.com, apple.com)
2) **Complete Auth:** Enter credentials if prompted
3) **Accept Terms:** Accept any terms of service
4) **Verify Redirect:** Should redirect to intended site

### **Step 4: Network Validation**
1) **IP Address:** Verify valid IP (not 169.254.x.x)
2) **Gateway:** Ping gateway IP address
3) **DNS Resolution:** Test with \`nslookup google.com\`
4) **Internet Access:** Browse both intranet and public sites

**Success Criteria:**
- Stable IP address assigned
- Gateway responds to ping
- DNS resolves external domains
- Can browse both internal and external websites`,

    resolutionPlan: `## 🛠️ **Resolution Plan & Escalation Path**

### **Persistent Issues (NetOps Escalation)**
**If connection remains intermittent or fails:**

#### **AP-Level Diagnostics:**
- **Channel Optimization:** Check for 2.4GHz/5GHz channel conflicts
- **Power Adjustment:** Recalibrate AP transmit power levels
- **Client Roaming:** Adjust roaming thresholds for better handoff
- **Load Balancing:** Verify client distribution across APs

#### **Network Infrastructure:**
- **Switch Port Health:** Check for CRC errors, packet drops
- **Uplink Connectivity:** Verify AP uplink to core network
- **DHCP Scope:** Check for available IP addresses
- **VLAN Configuration:** Verify proper VLAN assignment

#### **Environmental Factors:**
- **Interference Sources:** Check for microwave, Bluetooth, other 2.4GHz devices
- **Physical Obstacles:** Verify no new barriers blocking signal
- **AP Placement:** Consider repositioning for better coverage
- **Antenna Orientation:** Check antenna alignment and direction`,

    onsiteScheduling: `## 📅 **NetOps Field Visit Scheduled**

### **Visit Details:**
- **Date:** ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- **Time:** 11:00–11:30 AM
- **Duration:** 30 minutes
- **Location:** Gate 30 Wi-Fi coverage area
- **Service ID:** ONS-${Date.now().toString().slice(-6)}
- **SR Number:** SR-${Date.now().toString().slice(-8)}

### **Scheduled Tasks:**
1. **AP Health Assessment**

2. **Network Infrastructure Review**

3. **RF Environment Analysis**

4. **Performance Optimization**


### **Validation Testing:**
- RSSI measurements from multiple locations
- Throughput testing (speedtest.net)
- 5-minute stability test
- Multiple client connection test
- Roaming handoff verification`,

    genericResponse: `I'll guide you through the DNS flush and captive portal authentication steps first. If the Wi-Fi connection at Gate 30 remains unstable after these steps, I'll escalate to NetOps to tune the access point radio and check the network port configuration.`,
  },

  // ───────────────────────────────────────────
  // INC0140983 — Unable to connect to company network (AI → TECH if NIC/cable)
  // ───────────────────────────────────────────
  INC0140983: {
    performanceAnalysis: `## 🔍 **Corporate Network Access Analysis**

### **Primary Symptoms:**
- Unable to access internal company resources
- VPN connection may appear connected but no internal access
- May show "Connected" status but no actual network functionality

### **Root Cause Analysis:**
**Most Likely:** VPN profile configuration drift or DNS resolution issues
- **Profile Drift:** VPN client configuration has become outdated
- **Split-Tunnel Issues:** Traffic routing not properly configured
- **DNS Leak:** DNS queries bypassing VPN tunnel
- **Certificate Problems:** Device or user certificates expired/invalid

### **Network Interface Issues:**
- **Physical Connection:** Check Ethernet link light status
- **NIC Driver:** Verify network adapter driver is current
- **Cable Integrity:** Test with known-good Ethernet cable
- **Port Functionality:** Verify switch port is operational

### **Authentication & Policy Issues:**
- **Device Certificates:** Check for expired or invalid certificates
- **User Mapping:** Verify ZTNA (Zero Trust Network Access) policy mapping
- **Group Membership:** Confirm user is in correct security groups
- **Client Updates:** Check for recent VPN client software updates

### **Network Configuration:**
- **DNS Settings:** Verify corporate DNS servers are configured
- **Route Table:** Check for conflicting or missing routes
- **Firewall Rules:** Ensure VPN traffic is not blocked
- **Proxy Settings:** Verify proxy configuration if applicable`,

    ramStockCheck: `## ⚡ **VPN & Network Repair Procedure**

### **Step 1: VPN Profile Reset**
1) **Disconnect VPN:** Completely disconnect from VPN
2) **Reset Adapter:** Disable and re-enable VPN network adapter
3) **Re-import Profile:** Download and import latest VPN profile
4) **Clear Cache:** Clear VPN client cache and temporary files

### **Step 2: DNS Configuration**
1) **Corporate DNS:** Set primary DNS to corporate server (10.0.0.10)
2) **Secondary DNS:** Set secondary DNS (10.0.0.11)
3) **Flush DNS:** Clear DNS cache with \`ipconfig /flushdns\`
4) **Verify Settings:** Confirm DNS servers are properly configured

### **Step 3: VPN Reconnection**
1) **Fresh Connection:** Connect to VPN with updated profile
2) **Authentication:** Complete full authentication process
3) **Wait for Handshake:** Allow time for tunnel establishment
4) **Verify Status:** Confirm "Connected" status with valid IP

### **Step 4: Internal Access Testing**
1) **Portal Access:** Test corporate portal login
2) **File Shares:** Access network drives (\\\\server\\share)
3) **Internal Sites:** Browse intranet websites
4) **Ping Test:** Ping internal servers by FQDN

**Success Criteria:**
- VPN shows "Connected" status
- Internal DNS resolves corporate domains
- File shares are accessible
- Intranet sites load properly
- Ping to internal servers successful`,

    resolutionPlan: `## 🛠️ **Resolution Plan & Escalation Path**

### **Hardware Issues (Tech Required)**
**If physical connectivity problems persist:**

#### **Network Interface Issues:**
- **Link Light:** No link light indicates physical problem
- **Cable Test:** Test with known-good Ethernet cable
- **Port Verification:** Check switch port status and errors
- **NIC Replacement:** May need network adapter replacement

#### **Driver & Software Issues:**
- **Driver Update:** Install latest network adapter drivers
- **Driver Rollback:** Revert to previous working driver version
- **Windows Updates:** Apply pending system updates
- **Registry Cleanup:** Clean network adapter registry entries

#### **Network Infrastructure:**
- **Switch Port:** Check for port errors, disable/enable port
- **VLAN Assignment:** Verify correct VLAN configuration
- **Port Security:** Check for MAC address restrictions
- **Power over Ethernet:** Verify PoE delivery if applicable`,

    onsiteScheduling: `## 📅 **Onsite Technician Scheduled**

### **Visit Details:**
- **Date:** ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- **Time:** 3:00–4:00 PM
- **Duration:** 1 hour
- **Location:** User workstation
- **Service ID:** ONS-${Date.now().toString().slice(-6)}
- **SR Number:** SR-${Date.now().toString().slice(-8)}

### **Scheduled Tasks:**
1. **Physical Connection Verification**

2. **Network Interface Card (NIC) Diagnostics**

3. **Switch Port Analysis**

4. **Network Configuration Verification**
   

### **Validation Testing:**
- Stable Ethernet link with proper speed/duplex
- VPN connection establishes successfully
- Internal DNS resolution works properly
- SMB file shares are accessible
- 10-minute stability test completed`,

    genericResponse: `I'll guide you through a quick VPN profile reset and DNS configuration now. If the corporate network connection still fails after these steps, we'll dispatch a technician to replace the Ethernet cable/NIC and check the switch port configuration.`,
  },

  // ───────────────────────────────────────────
  // INC0146034 — Zscaler shows “Disable” in office (TECH very likely)
  // ───────────────────────────────────────────
  INC0146034: {
    performanceAnalysis: `## 🔍 **Zscaler State: “Disable”**
**Context:** User in Dalian office. Yesterday a restart temporarily fixed it; today issue persists.  
**Likely causes:**  
- Driver/service failure after a recent Windows or client update  
- NIC/port instability or incorrect 802.1X mapping  
- Corrupt proxy certificate preventing tunnel initialization  

**Checks to perform:**  
- Look for Ethernet link LEDs (blinking green/amber)  
- Verify Windows Update history (driver pushes, patches)  
- Confirm proxy root cert is present and trusted  
- Review Zscaler client version + status page`,

    ramStockCheck: `## ⚡ **Immediate Steps**
1) Perform a **Shift+Restart → Network reset** to clear stale configs.  
2) Reinstall the Zscaler client (latest approved build).  
3) Confirm **ZSATunnel** and **ZSAService** are both *Running*.  
4) Test split-tunnel (intranet DNS resolution + public browsing).  
**Success criteria:** Client shows *Connected*, DNS lookups resolve internal FQDNs, stable connectivity for >5 minutes.`,

    resolutionPlan: `## 🛠️ **Resolution Plan**
- If services are running and tunnel is stable.  
- If still disabled or no link:  
  - **Desk-side TECH** to validate NIC/port, replace Ethernet cable if needed, reinstall NIC driver.  
  - Confirm correct 802.1X port mapping and no VLAN mismatch.  
- **Ticket notes (must capture):** Client version, Windows patch level, Zscaler services status, NIC driver version, switch port ID, cert validation result.`,

    onsiteScheduling: `## 📅 **Desk-Side Visit Scheduled**
**When:** ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • 10:00–10:30 AM CST  
**Tasks:**  
- Swap Ethernet cable + switch port if needed  
- Reinstall NIC drivers and re-validate Zscaler client  
- Check 802.1X authentication and VLAN assignment  
- Confirm proxy cert chain installed and trusted  

**Service ID:** ONS-${Date.now().toString().slice(-6)} • **SR:** SR-${Date.now().toString().slice(-8)}  
**Onsite validation:** Client maintains *Connected* for 10 minutes, intranet + internet browsing stable.`,

    genericResponse: `I'll guide you through a Zscaler client reset and reinstall now. Since this is a recurring "Disable" state issue, I recommend scheduling a brief desk-side visit to validate your network adapter, check the switch port, and confirm the 802.1X authentication and certificate trust settings.`,
  },

  // ───────────────────────────────────────────
  // INC0140515 — Unable to connect to Zscaler VPN (AI-first, escalate if needed)
  // ───────────────────────────────────────────
  INC0140515: {
    performanceAnalysis: `## 🔍 **Zscaler Connection Analysis**
**Likely causes:**  
- Stale SSO token or cached credentials blocking login  
- Policy out-of-sync with central Zscaler portals  
- Expired/missing device certificate or incorrect time sync  

**Checks to perform:**  
- Confirm device time is accurate (auto sync enabled)  
- Check certificate store for valid Zscaler root + device certificate  
- Capture client logs if authentication loop persists`,

    ramStockCheck: `## ⚡ **Quick Fix**
1) Sign out of Zscaler client → clear cached credentials.  
2) Delete all files under \`%ProgramData%\\Zscaler\\*cache*\\\`.  
3) Reboot and sign in again via SSO → force policy sync.  
4) Validate internet + intranet access post-login.  
**Success criteria:** Client shows *Connected*, no authentication loop, DNS resolves both corporate and public domains.`,

    resolutionPlan: `## 🛠️ **Resolution Plan**
- If tunnel establishes and DNS works.  
- If authentication loops or fails:  
  - Push a new **device certificate**  
  - Reset **user mapping** in ZIA/ZPA portals  
  - Verify group/policy assignment matches user role  
- **Ticket notes (must capture):** Client version, last successful policy timestamp, specific error code, cert status, recent password or AD changes.`,

    onsiteScheduling: `## 📅 **Escalation Scheduled**
**When:** ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • 1:30–2:00 PM  
**Tasks:**  
- Push new device certificate + re-sync policies  
- Capture SSO trace for review  
- Reinstall client if corruption suspected  

**Service ID:** ONS-${Date.now().toString().slice(-6)} • **SR:** SR-${Date.now().toString().slice(-8)}  
**Validation:** Login completes without loop, policy timestamp matches current day, user able to access both internet + intranet.`,

    genericResponse: `I'll help you refresh your SSO credentials and clear the Zscaler cache now. If the login continues to loop or fails after these steps, I'll escalate to our security team to push a new device certificate and re-sync your access policies to restore your VPN connection.`,
  },

  // ───────────────────────────────────────────
  // INC0146287 — No internet for ~1 hour (TECH likely if area-wide)
  // ───────────────────────────────────────────
  INC0146287: {
    performanceAnalysis: `## 🔍 **Outage Triage**
  **Initial Question:** Is the outage affecting only your device, or are multiple users in the same area/ router impacted?  
  
  **Likely Scenarios:**  
  - **Multiple users impacted:** Could indicate router /switch uplink failure, DHCP scope exhaustion, or a localized power/firmware issue.  
  - **Single device impacted:** More likely tied to a stuck DHCP release, outdated NIC driver, corrupted Wi-Fi profile, or hardware fault.  
  
  **Next Step:** Quickly verify with at least one colleague nearby to confirm whether it’s isolated or widespread.`,

    ramStockCheck: `## ⚡ **Immediate Checks**
  - **For a single device:**  
    1. Run \`ipconfig /release\` → \`ipconfig /renew\` to refresh DHCP release.  
    2. Check NIC driver in Device Manager and update if flagged.  
    3. Test connectivity on a wired Ethernet port, if available.  
    4. Try connecting to an alternate SSID (guest/corp Wi-Fi) to rule out profile corruption.  
  
  - **For multiple devices:**  
    1. Check router / switch uplink health (CRC errors, packet drops, or high utilization).  
    2. Confirm router has stable power and no recent firmware rollback.  
    3. Verify DHCP scope has available releases and is not exhausted.  
  
  **Success Criteria:** Device(s) receive valid IP, gateway, and DNS. Stable browsing confirmed (intranet + internet) for at least 5–10 minutes without dropouts.`,

    resolutionPlan: `## 🛠️ **Resolution Plan**
  - **Single device resolution:** If connectivity is restored and stable.  
  - **Area-wide outage persists:** Escalate to **TECH** for deeper inspection of AP/switch, including uplink verification, firmware status, and cable integrity.  
  
  **Ticket Documentation Checklist:**  
  - Scope of impact (single user vs. multiple users/area).  
  - Router name(s), SSID, and physical location.  
  - Switch port IDs and observed errors (if any).  
  - Before/after IP/DNS details and any end-user error messages.  
  - Steps attempted prior to escalation (DHCP reset, driver check, etc.).`,

    onsiteScheduling: `## 📅 **Field Ticket (Area-Wide Issue)**
  **When:** ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • 9:30–10:30 AM  
  
  **Planned Onsite Tasks:**  
  1. Reset or failover router / uplink if health issues detected.  
  2. Perform switch port diagnostics (check logs, packet errors, utilization).  
  3. Inspect and reset/reterminate cabling if faults are identified.  
  4. Validate DHCP scope health and expand if near exhaustion.  
  5. Perform a firmware check and reapply stable image if required.  
  
  **Service ID:** ONS-${Date.now().toString().slice(-6)}  
  **SR:** SR-${Date.now().toString().slice(-8)}  
  
  **Onsite Validation:** Run sustained throughput, ping, and traceroute tests from affected gate, observing for 10+ minutes of stable performance.`,

    genericResponse: `First, please check if nearby colleagues are also experiencing internet connectivity issues. If it's only your device, I can guide you through a quick network adapter reset and DHCP renewal. If multiple users in your area are affected, I'll immediately escalate to dispatch an onsite technician to check the access point and network switch infrastructure.`,
  },
};
