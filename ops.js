/**
 * Ops functionality for PXT Phoenix Attendance Dashboard
 * Shows planned vs actual headcount by shift code in site split format
 */

// ================== OPS CONFIGURATION ==================

/**
 * Get planned headcount by shift code for each department
 */
function getPlannedHeadcount(shift = "Day") {
  const shiftSchedule = {
    "Day": {
      "Sunday":    ["DA","DN","DL","DH"],
      "Monday":    ["DA","DL","DC","DH"],
      "Tuesday":   ["DA","DL","DC"],
      "Wednesday": ["DA","DB"],
      "Thursday":  ["DB","DN","DC"],
      "Friday":    ["DB","DN","DC","DH"],
      "Saturday":  ["DB","DN","DL","DH"]
    },
    "Night": {
      "Sunday":    ["NA","NN","NL","NH"],
      "Monday":    ["NA","NL","NC","NH"],
      "Tuesday":   ["NA","NL","NC"],
      "Wednesday": ["NA","NB"],
      "Thursday":  ["NB","NN","NC"],
      "Friday":    ["NB","NN","NC","NH"],
      "Saturday":  ["NB","NN","NL","NH"]
    }
  };

  // Planned headcount per shift code
  const plannedHC = {
    // YDD2-CRETS (Area 22)
    "YDD2": {
      "DA": 25, "DB": 30, "DC": 20, "DH": 15, "DL": 18, "DN": 22,
      "NA": 20, "NB": 25, "NC": 15, "NH": 12, "NL": 14, "NN": 18
    },
    // YHM2-Inbound/DA (Not ICQA)
    "YHM2": {
      "DA": 35, "DB": 40, "DC": 28, "DH": 20, "DL": 25, "DN": 30,
      "NA": 30, "NB": 35, "NC": 22, "NH": 18, "NL": 20, "NN": 25
    }
  };

  return { shiftSchedule, plannedHC };
}

// ================== OPS TABLE RENDERING ==================

/**
 * Render both ops tables
 */
function renderOpsDashboard() {
  const date = document.getElementById("dateInput")?.value || new Date().toISOString().slice(0, 10);
  const shift = document.getElementById("shiftInput")?.value || "Day";
  
  const opsContainer = document.getElementById("opsTableContainer");
  if (!opsContainer) {
    console.error("Ops container not found");
    return;
  }
  
  const ydd2Table = renderYDD2OpsTable(date, shift);
  const yhm2Table = renderYHM2OpsTable(date, shift);
  
  opsContainer.innerHTML = ydd2Table + yhm2Table;
}

/**
 * Render YDD2-CRETS ops table (simple format)
 */
function renderYDD2OpsTable(date, shift) {
  const { shiftSchedule, plannedHC } = getPlannedHeadcount(shift);
  const dayName = new Date(date + "T00:00:00").toLocaleDateString("en-US", {weekday: "long"});
  const activeShiftCodes = shiftSchedule[shift][dayName] || [];
  
  // Get actual headcount
  const actualHC = getActualHeadcount("YDD2", activeShiftCodes);
  
  let tableHTML = `
    <div class="ops-section">
      <h3>YDD2-CRETS Operations</h3>
      <p>Date: ${date} (${dayName}) | Shift: ${shift}</p>
      <table class="ops-table">
        <thead>
          <tr>
            <th>Shift Code</th>
            <th>Planned HC</th>
            <th>Present HC</th>
            <th>Delta</th>
          </tr>
        </thead>
        <tbody>`;

  // Shift code rows
  let totalPlanned = 0, totalPresent = 0;
  for (const code of activeShiftCodes) {
    const planned = plannedHC.YDD2[code] || 0;
    const present = actualHC[code] || 0;
    const delta = present - planned;
    totalPlanned += planned;
    totalPresent += present;
    
    tableHTML += `
      <tr>
        <td>${code}</td>
        <td>${planned}</td>
        <td>${present}</td>
        <td class="delta-cell ${delta < 0 ? 'negative' : delta > 0 ? 'positive' : ''}" 
            onclick="showAbsentees('YDD2', '${code}')" 
            style="cursor: pointer;" 
            title="Click to see absent associates">
          ${delta >= 0 ? '+' : ''}${delta}
        </td>
      </tr>`;
  }

  // Swap/VET/VTO rows
  const swapOut = getSwapVetVtoCount("swapOut");
  const swapIn = getSwapVetVtoCount("swapIn");
  const vet = getSwapVetVtoCount("vet");
  const vto = getSwapVetVtoCount("vto");

  const totalDelta = totalPresent - totalPlanned;

  tableHTML += `
    <tr><td>Swap Out</td><td>-</td><td>${swapOut}</td><td>-</td></tr>
    <tr><td>Swap In</td><td>-</td><td>${swapIn}</td><td>-</td></tr>
    <tr><td>VET</td><td>-</td><td>${vet}</td><td>-</td></tr>
    <tr><td>VTO</td><td>-</td><td>${vto}</td><td>-</td></tr>
    <tr class="total-row">
      <td><strong>Total</strong></td>
      <td><strong>${totalPlanned}</strong></td>
      <td><strong>${totalPresent}</strong></td>
      <td class="${totalDelta < 0 ? 'negative' : totalDelta > 0 ? 'positive' : ''}">
        <strong>${totalDelta >= 0 ? '+' : ''}${totalDelta}</strong>
      </td>
    </tr>
  `;

  tableHTML += `</tbody></table></div>`;
  return tableHTML;
}

/**
 * Render YHM2-Inbound/DA ops table (simple format)
 */
function renderYHM2OpsTable(date, shift) {
  const { shiftSchedule, plannedHC } = getPlannedHeadcount(shift);
  const dayName = new Date(date + "T00:00:00").toLocaleDateString("en-US", {weekday: "long"});
  const activeShiftCodes = shiftSchedule[shift][dayName] || [];
  
  // Get actual headcount
  const actualHC = getActualHeadcount("YHM2", activeShiftCodes);
  
  let tableHTML = `
    <div class="ops-section">
      <h3>YHM2-Inbound/DA Operations</h3>
      <p>Date: ${date} (${dayName}) | Shift: ${shift}</p>
      <table class="ops-table">
        <thead>
          <tr>
            <th>Shift Code</th>
            <th>Planned HC</th>
            <th>Present HC</th>
            <th>Delta</th>
          </tr>
        </thead>
        <tbody>`;

  // Shift code rows
  let totalPlanned = 0, totalPresent = 0;
  for (const code of activeShiftCodes) {
    const planned = plannedHC.YHM2[code] || 0;
    const present = actualHC[code] || 0;
    const delta = present - planned;
    totalPlanned += planned;
    totalPresent += present;
    
    tableHTML += `
      <tr>
        <td>${code}</td>
        <td>${planned}</td>
        <td>${present}</td>
        <td class="delta-cell ${delta < 0 ? 'negative' : delta > 0 ? 'positive' : ''}" 
            onclick="showAbsentees('YHM2', '${code}')" 
            style="cursor: pointer;" 
            title="Click to see absent associates">
          ${delta >= 0 ? '+' : ''}${delta}
        </td>
      </tr>`;
  }

  // Swap/VET/VTO rows
  const swapOut = getSwapVetVtoCount("swapOut");
  const swapIn = getSwapVetVtoCount("swapIn");
  const vet = getSwapVetVtoCount("vet");
  const vto = getSwapVetVtoCount("vto");

  const totalDelta = totalPresent - totalPlanned;

  tableHTML += `
    <tr><td>Swap Out</td><td>-</td><td>${swapOut}</td><td>-</td></tr>
    <tr><td>Swap In</td><td>-</td><td>${swapIn}</td><td>-</td></tr>
    <tr><td>VET</td><td>-</td><td>${vet}</td><td>-</td></tr>
    <tr><td>VTO</td><td>-</td><td>${vto}</td><td>-</td></tr>
    <tr class="total-row">
      <td><strong>Total</strong></td>
      <td><strong>${totalPlanned}</strong></td>
      <td><strong>${totalPresent}</strong></td>
      <td class="${totalDelta < 0 ? 'negative' : totalDelta > 0 ? 'positive' : ''}">
        <strong>${totalDelta >= 0 ? '+' : ''}${totalDelta}</strong>
      </td>
    </tr>
  `;

  tableHTML += `</tbody></table></div>`;
  return tableHTML;
}

// ================== HELPER FUNCTIONS ==================

/**
 * Get actual headcount from roster data by department and shift codes
 */
function getActualHeadcount(department, activeShiftCodes) {
  const actualHC = {};
  
  // Initialize all shift codes to 0
  for (const code of activeShiftCodes) {
    actualHC[code] = 0;
  }
  
  // Count present employees by shift code
  if (window.roster && window.roster.length) {
    for (const employee of window.roster) {
      // Check if employee matches department criteria
      let matchesDept = false;
      
      if (department === "YDD2") {
        // YDD2 = CRETS (Area 22)
        const cretsDepts = ["1299070", "1211070"];
        matchesDept = cretsDepts.includes(employee.deptId) && employee.area === "22";
      } else if (department === "YHM2") {
        // YHM2 = Inbound + DA (NOT ICQA which is Area 27)
        const inboundDepts = ["1211010", "1211020", "1299010", "1299020"];
        const daDepts = ["1211030", "1211040", "1299030", "1299040"];
        matchesDept = (inboundDepts.includes(employee.deptId) || daDepts.includes(employee.deptId)) && employee.area !== "27";
      }
      
      if (matchesDept && employee.onp && employee.corner) {
        // Extract shift code from corner (first 2 characters)
        const shiftCode = employee.corner.slice(0, 2).toUpperCase();
        if (activeShiftCodes.includes(shiftCode)) {
          actualHC[shiftCode] = (actualHC[shiftCode] || 0) + 1;
        }
      }
    }
  }
  
  return actualHC;
}

/**
 * Get swap/VET/VTO counts from global data
 */
function getSwapVetVtoCount(type, department = null) {
  // For now, return total counts (can be enhanced later to filter by department)
  switch(type) {
    case "swapIn": return window.swapInCount || 0;
    case "swapOut": return window.swapOutCount || 0;
    case "vet": return window.vetCount || 0;
    case "vto": return window.vtoCount || 0;
    default: return 0;
  }
}

// Test function to verify ops is working
function testOpsRender() {
  const container = document.getElementById("opsTableContainer");
  if (container) {
    container.innerHTML = `
      <div class="ops-section">
        <h3>🎯 Ops Tab is Working!</h3>
        <p>This is a test render to verify the ops functionality is connected.</p>
        <p>Date: ${new Date().toLocaleDateString()}</p>
        <p>Time: ${new Date().toLocaleTimeString()}</p>
      </div>
    `;
    console.log("Test render complete");
  } else {
    console.error("Test render failed - container not found");
  }
}

/**
 * Show absent associates for a specific department and shift code
 */
function showAbsentees(department, shiftCode) {
  console.log(`Showing absentees for ${department} - ${shiftCode}`);
  
  if (!window.roster || !Array.isArray(window.roster)) {
    alert("Roster data not available");
    return;
  }

  // Filter associates by department and shift code
  const departmentFilter = department === "YDD2" ? 
    (person) => person.department === "CRETS" && person.area === "Area 22" :
    (person) => (person.department === "Inbound" || person.department === "DA") && person.area !== "Area 27";

  const scheduledAssociates = window.roster.filter(person => 
    departmentFilter(person) && person.shiftCode === shiftCode
  );

  const presentAssociates = scheduledAssociates.filter(person => person.status === "Present");
  const absentAssociates = scheduledAssociates.filter(person => person.status !== "Present");

  // Create modal content
  const modalContent = `
    <div id="absentModal" style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.5); z-index: 1000; display: flex; 
      justify-content: center; align-items: center;">
      <div style="
        background: white; padding: 20px; border-radius: 8px; 
        max-width: 600px; max-height: 80%; overflow-y: auto; 
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 15px;">
          <h3 style="margin: 0; color: #333;">
            ${department} - ${shiftCode} Associate Status
          </h3>
          <button onclick="document.getElementById('absentModal').remove()" 
            style="background: #ff4444; color: white; border: none; 
            padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-left: 20px;">
            ✕ Close
          </button>
        </div>
        
        <div style="margin-bottom: 15px;">
          <strong>Summary:</strong> 
          ${presentAssociates.length} Present, 
          ${absentAssociates.length} Absent, 
          ${scheduledAssociates.length} Total Scheduled
        </div>
        
        ${absentAssociates.length > 0 ? `
          <div style="margin-bottom: 15px;">
            <h4 style="color: #cc0000; margin-bottom: 10px;">Absent Associates (${absentAssociates.length}):</h4>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px;">
              ${absentAssociates.map(person => `
                <div style="padding: 5px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                  <span><strong>${person.name}</strong></span>
                  <span style="color: #666;">${person.status || 'Absent'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : '<p style="color: #008800;"><strong>✅ No absent associates - everyone is present!</strong></p>'}
        
        <details style="margin-top: 15px;">
          <summary style="cursor: pointer; font-weight: bold; color: #666;">
            Show Present Associates (${presentAssociates.length})
          </summary>
          <div style="max-height: 150px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; margin-top: 5px;">
            ${presentAssociates.map(person => `
              <div style="padding: 3px; border-bottom: 1px solid #eee;">
                <strong>${person.name}</strong> - Present
              </div>
            `).join('')}
          </div>
        </details>
      </div>
    </div>
  `;

  // Remove existing modal if any
  const existing = document.getElementById("absentModal");
  if (existing) existing.remove();

  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalContent);
}

// Initialize ops functionality
function initOps() {
  console.log("Initializing ops functionality...");
  
  // Make functions globally available
  window.renderOpsDashboard = renderOpsDashboard;
  window.testOpsRender = testOpsRender;
  window.showAbsentees = showAbsentees;
  
  console.log("Ops functions registered:", {
    renderOpsDashboard: typeof window.renderOpsDashboard,
    testOpsRender: typeof window.testOpsRender,
    showAbsentees: typeof window.showAbsentees
  });
}

// Initialize immediately
initOps();

console.log("ops.js loaded - ready for ops functionality");