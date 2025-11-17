/**
 * Ops functionality for PXT Phoenix Attendance Dashboard
 * 
 * This module implements the "Ops" tab showing weekly expected roster headcount
 * for YDD2-CRETs and YHM2 Inbound/Outbound departments.
 */

// ================== OPS DATA MANAGEMENT ==================

/**
 * Get shift schedule for ops specifically from global settings or use default
 * @returns {Object} - Shift schedule configuration
 */
function getOpsShiftSchedule() {
  // Try to get from global SETTINGS if available
  if (typeof SETTINGS !== 'undefined' && SETTINGS && SETTINGS.shift_schedule) {
    return SETTINGS.shift_schedule;
  }
  
  // Default shift schedule if settings not loaded
  return {
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
}

/**
 * Get YDD2-CRETs specific headcount per shift code
 * @param {string} shift - "Day" or "Night"
 * @returns {Object} - Headcount by shift code for YDD2-CRETs (Area 22)
 */
function getYDD2ShiftCodeHeadcount(shift = "Day") {
  // YDD2-CRETs headcount (typically higher TEMP ratios)
  const dayShiftHeadcount = {
    // Day shift codes for CRETs department
    "DA": { AMZN: 15, TEMP: 25 },  // Main day shift - CRETs heavy on TEMP
    "DB": { AMZN: 12, TEMP: 20 },  // Second day shift
    "DC": { AMZN: 10, TEMP: 18 },  // Third day shift
    "DD": { AMZN: 8, TEMP: 15 },   // Fourth day shift
    "DH": { AMZN: 6, TEMP: 12 },   // Holiday/weekend day shift
    "DL": { AMZN: 13, TEMP: 22 },  // Long day shift
    "DN": { AMZN: 9, TEMP: 16 }    // Night-adjacent day shift
  };
  
  const nightShiftHeadcount = {
    // Night shift codes for CRETs department
    "NA": { AMZN: 12, TEMP: 20 },  // Main night shift
    "NB": { AMZN: 10, TEMP: 18 },  // Second night shift
    "NC": { AMZN: 9, TEMP: 16 },   // Third night shift
    "ND": { AMZN: 7, TEMP: 14 },   // Fourth night shift
    "NH": { AMZN: 5, TEMP: 10 },   // Holiday/weekend night shift
    "NL": { AMZN: 11, TEMP: 19 },  // Long night shift
    "NN": { AMZN: 8, TEMP: 15 }    // Night-night shift
  };
  
  return shift === "Day" ? dayShiftHeadcount : nightShiftHeadcount;
}

/**
 * Get YHM2 Inbound/Outbound specific headcount per shift code
 * @param {string} shift - "Day" or "Night"
 * @returns {Object} - Headcount by shift code for YHM2 Inbound/DA departments
 */
function getYHM2ShiftCodeHeadcount(shift = "Day") {
  // YHM2 Inbound/Outbound headcount (higher AMZN ratios)
  const dayShiftHeadcount = {
    // Day shift codes for Inbound + DA departments
    "DA": { AMZN: 35, TEMP: 15 },  // Main day shift - Inbound/DA heavy on AMZN
    "DB": { AMZN: 28, TEMP: 12 },  // Second day shift
    "DC": { AMZN: 25, TEMP: 10 },  // Third day shift
    "DD": { AMZN: 22, TEMP: 8 },   // Fourth day shift
    "DH": { AMZN: 18, TEMP: 6 },   // Holiday/weekend day shift
    "DL": { AMZN: 30, TEMP: 13 },  // Long day shift
    "DN": { AMZN: 24, TEMP: 9 }    // Night-adjacent day shift
  };
  
  const nightShiftHeadcount = {
    // Night shift codes for Inbound + DA departments
    "NA": { AMZN: 28, TEMP: 12 },  // Main night shift
    "NB": { AMZN: 25, TEMP: 10 },  // Second night shift
    "NC": { AMZN: 22, TEMP: 9 },   // Third night shift
    "ND": { AMZN: 20, TEMP: 7 },   // Fourth night shift
    "NH": { AMZN: 15, TEMP: 5 },   // Holiday/weekend night shift
    "NL": { AMZN: 26, TEMP: 11 },  // Long night shift
    "NN": { AMZN: 21, TEMP: 8 }    // Night-night shift
  };
  
  return shift === "Day" ? dayShiftHeadcount : nightShiftHeadcount;
}

/**
 * Get selected shift from main dashboard controls (ops-specific)
 * @returns {string} - "Day" or "Night"
 */
function getOpsSelectedShift() {
  const shiftSelect = document.getElementById('shiftInput');
  return shiftSelect ? shiftSelect.value : 'Day';
}

/**
 * Update the shift display in the Ops controls
 */
function updateOpsShiftDisplay() {
  const shiftDisplay = document.getElementById('currentShiftDisplay');
  if (shiftDisplay) {
    const selectedShift = getOpsSelectedShift();
    shiftDisplay.textContent = `Shift: ${selectedShift}`;
    shiftDisplay.className = `chip ${selectedShift === 'Day' ? 'chip-green' : 'chip-blue'}`;
  }
}

/**
 * Generate weekly ops data for a given week
 * @param {Date} weekStart - Starting date of the week (Monday)
 * @param {string} selectedShift - "Day" or "Night"
 * @returns {Object} - Weekly ops data structure
 */
function generateWeeklyOpsData(weekStart, selectedShift = "Day") {
  const weekDays = [];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Generate 7 days starting from weekStart
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    weekDays.push({
      date: date,
      dayName: dayNames[i],
      dateStr: date.toISOString().split('T')[0] // YYYY-MM-DD format
    });
  }
  
  return {
    weekStart: weekStart,
    selectedShift: selectedShift,
    days: weekDays,
    ydd2Data: generateYDD2WeeklyData(weekDays, selectedShift),
    yhm2Data: generateYHM2WeeklyData(weekDays, selectedShift)
  };
}

/**
 * Generate YDD2-CRETs weekly data based on shift codes and roster patterns
 * @param {Array} weekDays - Array of day objects
 * @param {string} selectedShift - "Day" or "Night"
 * @returns {Object} - YDD2 weekly headcount data by shift codes
 */
function generateYDD2WeeklyData(weekDays, selectedShift = "Day") {
  // Load shift schedule from settings (if available)
  const shiftSchedule = getOpsShiftSchedule();
  
  // YDD2-CRETs specific headcount (Area 22)
  const shiftCodeHeadcount = getYDD2ShiftCodeHeadcount(selectedShift);
  
  const weeklyData = {};
  
  weekDays.forEach(day => {
    const daySchedule = shiftSchedule[selectedShift]?.[day.dayName] || [];
    const dayData = {};
    
    // Calculate headcount for each shift code scheduled on this day
    daySchedule.forEach(shiftCode => {
      if (shiftCodeHeadcount[shiftCode]) {
        dayData[shiftCode] = {
          AMZN: shiftCodeHeadcount[shiftCode].AMZN,
          TEMP: shiftCodeHeadcount[shiftCode].TEMP,
          TOTAL: shiftCodeHeadcount[shiftCode].AMZN + shiftCodeHeadcount[shiftCode].TEMP
        };
      }
    });
    
    weeklyData[day.dateStr] = {
      dayName: day.dayName,
      date: day.dateStr,
      shiftCodes: dayData,
      scheduledCodes: daySchedule
    };
  });
  
  return weeklyData;
}

/**
 * Generate YHM2 (Inbound/Outbound) weekly data based on shift codes
 * @param {Array} weekDays - Array of day objects
 * @param {string} selectedShift - "Day" or "Night"
 * @returns {Object} - YHM2 weekly headcount data by shift codes
 */
function generateYHM2WeeklyData(weekDays, selectedShift = "Day") {
  // Load shift schedule from settings (if available)
  const shiftSchedule = getOpsShiftSchedule();
  
  // YHM2 Inbound/Outbound specific headcount (Inbound + DA departments)
  const shiftCodeHeadcount = getYHM2ShiftCodeHeadcount(selectedShift);
  
  const weeklyData = {};
  
  weekDays.forEach(day => {
    const daySchedule = shiftSchedule[selectedShift]?.[day.dayName] || [];
    const dayData = {};
    
    // Calculate headcount for each shift code scheduled on this day
    daySchedule.forEach(shiftCode => {
      if (shiftCodeHeadcount[shiftCode]) {
        dayData[shiftCode] = {
          AMZN: shiftCodeHeadcount[shiftCode].AMZN,
          TEMP: shiftCodeHeadcount[shiftCode].TEMP,
          TOTAL: shiftCodeHeadcount[shiftCode].AMZN + shiftCodeHeadcount[shiftCode].TEMP
        };
      }
    });
    
    weeklyData[day.dateStr] = {
      dayName: day.dayName,
      date: day.dateStr,
      shiftCodes: dayData,
      scheduledCodes: daySchedule
    };
  });
  
  return weeklyData;
}

// ================== OPS TABLE RENDERING ==================

/**
 * Render the YDD2-CRETs weekly table with shift codes as rows (total headcount only)
 * @param {Object} ydd2Data - YDD2 weekly data
 * @param {string} selectedShift - "Day" or "Night"
 */
function renderYDD2OpsTable(ydd2Data, selectedShift = "Day") {
  const tableEl = document.getElementById("opsYDD2Table");
  if (!tableEl) return;
  
  const dates = Object.keys(ydd2Data).sort();
  
  // Get all unique shift codes for this shift type
  const allShiftCodes = getAllShiftCodesForWeek(ydd2Data, selectedShift);
  
  // Header with days of the week
  const headerCells = dates.map(date => {
    const dayData = ydd2Data[date];
    return `<th>${dayData.dayName}<br><span class="ops-date">${formatDateShort(date)}</span></th>`;
  }).join('');
  
  const header = `
    <thead>
      <tr>
        <th>YDD2-CRETs (${selectedShift} Shift)</th>
        ${headerCells}
        <th>Week Total</th>
      </tr>
    </thead>`;
  
  // Generate rows for each shift code (total headcount only)
  let bodyRows = '';
  
  allShiftCodes.forEach(shiftCode => {
    let weekTotal = 0;
    
    // Total headcount row for this shift code
    const totalCells = dates.map(date => {
      const dayData = ydd2Data[date];
      const shiftData = dayData.shiftCodes[shiftCode];
      const totalCount = shiftData ? shiftData.TOTAL : 0;
      weekTotal += totalCount;
      
      return `<td>${totalCount || 0}</td>`;
    }).join('');
    
    bodyRows += `
      <tr>
        <td>${shiftCode}</td>
        ${totalCells}
        <td><strong>${weekTotal}</strong></td>
      </tr>`;
  });
  
  // Daily totals row
  const dailyTotalCells = dates.map(date => {
    const dayData = ydd2Data[date];
    const dayTotal = Object.values(dayData.shiftCodes).reduce((sum, shift) => sum + shift.TOTAL, 0);
    return `<td><strong>${dayTotal}</strong></td>`;
  }).join('');
  
  const grandTotal = dates.reduce((sum, date) => {
    const dayData = ydd2Data[date];
    return sum + Object.values(dayData.shiftCodes).reduce((daySum, shift) => daySum + shift.TOTAL, 0);
  }, 0);
  
  bodyRows += `
    <tr class="subtotal-row">
      <td><strong>DAILY TOTALS</strong></td>
      ${dailyTotalCells}
      <td><strong>${grandTotal}</strong></td>
    </tr>`;
  
  const body = `<tbody>${bodyRows}</tbody>`;
  
  tableEl.innerHTML = header + body;
}

/**
 * Render the YHM2 (Inbound/Outbound) weekly table with shift codes as rows (total headcount only)
 * @param {Object} yhm2Data - YHM2 weekly data  
 * @param {string} selectedShift - "Day" or "Night"
 */
function renderYHM2OpsTable(yhm2Data, selectedShift = "Day") {
  const tableEl = document.getElementById("opsYHM2Table");
  if (!tableEl) return;
  
  const dates = Object.keys(yhm2Data).sort();
  
  // Get all unique shift codes for this shift type
  const allShiftCodes = getAllShiftCodesForWeek(yhm2Data, selectedShift);
  
  // Header with days of the week
  const headerCells = dates.map(date => {
    const dayData = yhm2Data[date];
    return `<th>${dayData.dayName}<br><span class="ops-date">${formatDateShort(date)}</span></th>`;
  }).join('');
  
  const header = `
    <thead>
      <tr>
        <th>YHM2 - Inbound/Outbound (${selectedShift} Shift)</th>
        ${headerCells}
        <th>Week Total</th>
      </tr>
    </thead>`;
  
  // Generate rows for each shift code (total headcount only)
  let bodyRows = '';
  
  allShiftCodes.forEach(shiftCode => {
    let weekTotal = 0;
    
    // Total headcount row for this shift code
    const totalCells = dates.map(date => {
      const dayData = yhm2Data[date];
      const shiftData = dayData.shiftCodes[shiftCode];
      const totalCount = shiftData ? shiftData.TOTAL : 0;
      weekTotal += totalCount;
      
      return `<td>${totalCount || 0}</td>`;
    }).join('');
    
    bodyRows += `
      <tr>
        <td>${shiftCode}</td>
        ${totalCells}
        <td><strong>${weekTotal}</strong></td>
      </tr>`;
  });
  
  // Daily totals row
  const dailyTotalCells = dates.map(date => {
    const dayData = yhm2Data[date];
    const dayTotal = Object.values(dayData.shiftCodes).reduce((sum, shift) => sum + shift.TOTAL, 0);
    return `<td><strong>${dayTotal}</strong></td>`;
  }).join('');
  
  const grandTotal = dates.reduce((sum, date) => {
    const dayData = yhm2Data[date];
    return sum + Object.values(dayData.shiftCodes).reduce((daySum, shift) => daySum + shift.TOTAL, 0);
  }, 0);
  
  bodyRows += `
    <tr class="subtotal-row">
      <td><strong>DAILY TOTALS</strong></td>
      ${dailyTotalCells}
      <td><strong>${grandTotal}</strong></td>
    </tr>`;
  
  const body = `<tbody>${bodyRows}</tbody>`;
  
  tableEl.innerHTML = header + body;
}

/**
 * Get all unique shift codes used in a week of data
 * @param {Object} weekData - Weekly data object
 * @param {string} selectedShift - "Day" or "Night"
 * @returns {Array} - Array of shift codes sorted alphabetically
 */
function getAllShiftCodesForWeek(weekData, selectedShift) {
  const shiftCodes = new Set();
  
  Object.values(weekData).forEach(dayData => {
    if (dayData.scheduledCodes) {
      dayData.scheduledCodes.forEach(code => shiftCodes.add(code));
    }
  });
  
  return Array.from(shiftCodes).sort();
}

/**
 * Format date for display (MM/DD)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} - Formatted date string
 */
function formatDateShort(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
}

// ================== OPS TAB MANAGEMENT ==================

/**
 * Switch to Ops tab
 */
function switchToOps() {
  // Hide other tabs
  const tabDash = document.getElementById("tabDashboard");
  const tabAudit = document.getElementById("tabAudit");
  const tabSiteSplit = document.getElementById("tab-siteSplit");
  const tabOps = document.getElementById("tab-ops");
  
  const panelDash = document.getElementById("panelDashboard");
  const panelAudit = document.getElementById("panelAudit");
  const panelSiteSplit = document.getElementById("siteSplitPage");
  const panelOps = document.getElementById("opsPage");

  // Remove active states from other tabs
  if (tabDash) tabDash.classList.remove("active");
  if (tabAudit) tabAudit.classList.remove("active");
  if (tabSiteSplit) tabSiteSplit.classList.remove("active");
  if (tabOps) tabOps.classList.add("active");

  // Hide other panels and show ops
  if (panelDash) panelDash.classList.add("hidden");
  if (panelAudit) panelAudit.classList.add("hidden");
  if (panelSiteSplit) panelSiteSplit.classList.add("hidden");
  if (panelOps) panelOps.classList.remove("hidden");
  
  // Update shift display
  updateOpsShiftDisplay();
  
  // Refresh the ops view when switching to it
  renderOpsView();
}

/**
 * Main function to render the complete ops view
 */
function renderOpsView() {
  const weekStartInput = document.getElementById('opsWeekStart');
  let weekStart;
  
  if (weekStartInput && weekStartInput.value) {
    weekStart = new Date(weekStartInput.value + 'T00:00:00');
  } else {
    // Default to current Monday
    weekStart = getCurrentMonday();
    if (weekStartInput) {
      weekStartInput.value = weekStart.toISOString().split('T')[0];
    }
  }
  
  // Ensure weekStart is a Monday
  weekStart = getMonday(weekStart);
  
  // Get selected shift from main controls
  const selectedShift = getOpsSelectedShift();
  
  // Update shift display
  updateOpsShiftDisplay();
  
  // Generate weekly data
  const weeklyData = generateWeeklyOpsData(weekStart, selectedShift);
  
  // Render both tables
  renderYDD2OpsTable(weeklyData.ydd2Data, selectedShift);
  renderYHM2OpsTable(weeklyData.yhm2Data, selectedShift);
  
  // Apply ops styling
  injectOpsStyles();
}

/**
 * Get the Monday of the week containing the given date
 * @param {Date} date - Any date
 * @returns {Date} - Monday of that week
 */
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Get the current Monday
 * @returns {Date} - Monday of the current week
 */
function getCurrentMonday() {
  return getMonday(new Date());
}

// ================== OPS INITIALIZATION ==================

/**
 * Initialize ops functionality
 */
function initializeOps() {
  // Hook up the ops tab click handler
  const opsTab = document.getElementById("tab-ops");
  if (opsTab) {
    opsTab.addEventListener("click", switchToOps);
  }
  
  // Hook up refresh button
  const refreshBtn = document.getElementById("refreshOpsView");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", renderOpsView);
  }
  
  // Hook up week start input change
  const weekStartInput = document.getElementById('opsWeekStart');
  if (weekStartInput) {
    weekStartInput.addEventListener('change', renderOpsView);
  }
  
  // Hook up shift selection change from main controls
  const shiftInput = document.getElementById('shiftInput');
  if (shiftInput) {
    shiftInput.addEventListener('change', renderOpsView);
  }
  
  // Initialize default date
  if (weekStartInput) {
    weekStartInput.value = getCurrentMonday().toISOString().split('T')[0];
  }
}

/**
 * Inject minimal CSS styles for ops controls only (tables use existing .table class)
 */
function injectOpsStyles() {
  if (document.getElementById('ops-styles')) return;

  const styles = `
    <style id="ops-styles">
      /* Ops Controls Styling */
      .ops-controls {
        margin-bottom: 20px;
        padding: 15px;
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: 8px;
      }
      
      .ops-week-selector {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 10px;
      }
      
      .ops-week-selector label {
        font-weight: bold;
        color: var(--text);
      }
      
      .ops-week-selector input {
        padding: 6px 10px;
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 4px;
        color: var(--text);
      }
      
      .ops-tables {
        display: grid;
        gap: 30px;
      }
      
      .ops-site-section h3 {
        color: var(--accent);
        margin-bottom: 10px;
        border-bottom: 2px solid var(--accent);
        padding-bottom: 5px;
      }
      
      .ops-date {
        font-size: 10px;
        opacity: 0.8;
      }
      
      /* Subtotal row styling to match dashboard */
      .subtotal-row {
        background: var(--card);
        font-weight: bold;
      }
      
      .subtotal-row td {
        background: var(--card);
        font-weight: bold;
      }
    </style>
  `;

  document.head.insertAdjacentHTML('beforeend', styles);
}

// Make functions globally available
window.switchToOps = switchToOps;
window.renderOpsView = renderOpsView;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeOps);
} else {
  initializeOps();
}