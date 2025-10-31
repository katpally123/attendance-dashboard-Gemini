/**
 * Site Split functionality for PXT Phoenix Attendance Dashboard
 * 
 * This module implements a new "Site Split" tab that aggregates attendance data
 * by site groups (YHM2-SDC, ICQA, YDD2-IXD, Other) instead of departments.
 * 
 * Reuses existing data pipeline and summary objects without modification.
 */

// ================== SITE CLASSIFICATION ==================

/**
 * Classifies a roster record into one of four site groups
 * @param {Object} r - Roster record with deptId and area properties
 * @returns {string} - One of "YHM2-SDC", "ICQA", "YDD2-IXD", "Other"
 */
function classifySite(r) {
  const d = Number(r.deptId);
  const a = Number(r.area);
  
  // YHM2-SDC: Inbound and DA departments
  if ([1211010, 1211020, 1299010, 1299020].includes(d)) return "YHM2-SDC";
  if ([1211030, 1211040, 1299030, 1299040].includes(d)) return "YHM2-SDC";
  
  // ICQA: Area 27
  if (a === 27) return "ICQA";
  
  // YDD2-IXD: Area 22 (CRETs)
  if (a === 22) return "YDD2-IXD";
  
  // Everything else
  return "Other";
}

// ================== SITE AGGREGATION ==================

/**
 * Aggregates department-level counts into site-level counts
 * @param {Object} rowData - Summary object with department counts (Inbound, DA, ICQA, CRETs)
 * @returns {Object} - Site-level aggregated counts
 */
function aggregateSiteCounts(rowData) {
  const siteData = {
    "YHM2-SDC": { AMZN: 0, TEMP: 0, TOTAL: 0 },
    "ICQA": { AMZN: 0, TEMP: 0, TOTAL: 0 },
    "YDD2-IXD": { AMZN: 0, TEMP: 0, TOTAL: 0 },
    "Other": { AMZN: 0, TEMP: 0, TOTAL: 0 }
  };

  // YHM2-SDC = Inbound + DA
  if (rowData.Inbound) {
    siteData["YHM2-SDC"].AMZN += rowData.Inbound.AMZN || 0;
    siteData["YHM2-SDC"].TEMP += rowData.Inbound.TEMP || 0;
    siteData["YHM2-SDC"].TOTAL += rowData.Inbound.TOTAL || 0;
  }
  if (rowData.DA) {
    siteData["YHM2-SDC"].AMZN += rowData.DA.AMZN || 0;
    siteData["YHM2-SDC"].TEMP += rowData.DA.TEMP || 0;
    siteData["YHM2-SDC"].TOTAL += rowData.DA.TOTAL || 0;
  }

  // ICQA = ICQA department
  if (rowData.ICQA) {
    siteData.ICQA.AMZN = rowData.ICQA.AMZN || 0;
    siteData.ICQA.TEMP = rowData.ICQA.TEMP || 0;
    siteData.ICQA.TOTAL = rowData.ICQA.TOTAL || 0;
  }

  // YDD2-IXD = CRETs
  if (rowData.CRETs) {
    siteData["YDD2-IXD"].AMZN = rowData.CRETs.AMZN || 0;
    siteData["YDD2-IXD"].TEMP = rowData.CRETs.TEMP || 0;
    siteData["YDD2-IXD"].TOTAL = rowData.CRETs.TOTAL || 0;
  }

  // Other department gets mapped to "Other" site
  if (rowData.Other) {
    siteData.Other.AMZN = rowData.Other.AMZN || 0;
    siteData.Other.TEMP = rowData.Other.TEMP || 0;
    siteData.Other.TOTAL = rowData.Other.TOTAL || 0;
  }

  return siteData;
}

// ================== SITE SPLIT TABLE RENDERING ==================

/**
 * Renders the Site Split table with aggregated site data
 * Reads the global row_* summary objects and creates the detailed site breakdown
 */
function renderSiteSplitTable() {
  const siteSplitTableEl = document.getElementById("siteSplitTable");
  if (!siteSplitTableEl) {
    console.warn("Site split table element not found");
    return;
  }

  // Check if summary objects exist (they're created in processAll())
  if (typeof window.row_RegularExpected === 'undefined') {
    siteSplitTableEl.innerHTML = '<p class="hint">Please process files first to view site split data.</p>';
    return;
  }

  // Build detailed table HTML matching Excel format
  const header = `
    <thead>
      <tr>
        <th rowspan="2">Attendance Details</th>
        <th colspan="5">YHM2 - SDC</th>
        <th colspan="2">ICQA</th>
        <th colspan="3">YDD2 - IXD</th>
        <th rowspan="2">TOTAL</th>
      </tr>
      <tr>
        <th>INBOUND<br>AMZN</th>
        <th>INBOUND<br>TEMP</th>
        <th>DA<br>AMZN</th>
        <th>DA<br>TEMP</th>
        <th>SDC TOTAL</th>
        <th>AMZN</th>
        <th>TEMP</th>
        <th>CRETs<br>AMZN</th>
        <th>CRETs<br>TEMP</th>
        <th>IXD TOTAL</th>
      </tr>
    </thead>`;

  const rowHTML = (label, rowData) => {
    // Get department data
    const inbound = rowData.Inbound || { AMZN: 0, TEMP: 0, TOTAL: 0 };
    const da = rowData.DA || { AMZN: 0, TEMP: 0, TOTAL: 0 };
    const icqa = rowData.ICQA || { AMZN: 0, TEMP: 0, TOTAL: 0 };
    const crets = rowData.CRETs || { AMZN: 0, TEMP: 0, TOTAL: 0 };
    
    // Calculate totals
    const sdcTotal = inbound.TOTAL + da.TOTAL;
    const ixdTotal = crets.TOTAL;
    const grandTotal = sdcTotal + icqa.TOTAL + ixdTotal;

    return `
      <tr>
        <td>${label}</td>
        <td>${inbound.AMZN}</td>
        <td>${inbound.TEMP}</td>
        <td>${da.AMZN}</td>
        <td>${da.TEMP}</td>
        <td>${sdcTotal}</td>
        <td>${icqa.AMZN}</td>
        <td>${icqa.TEMP}</td>
        <td>${crets.AMZN}</td>
        <td>${crets.TEMP}</td>
        <td>${ixdTotal}</td>
        <td>${grandTotal}</td>
      </tr>`;
  };

  const tableBody = `
    <tbody>
      ${rowHTML("Regular HC (Cohort Expected)", window.row_RegularExpected)}
      ${rowHTML("Regular HC Present (Excluding Swaps)", window.row_RegularPresentExS)}
      ${rowHTML("Shift Swap Out", window.row_SwapOut)}
      ${rowHTML("Shift Swap Expected", window.row_SwapInExpected)}
      ${rowHTML("Shift Swap Present", window.row_SwapInPresent)}
      ${rowHTML("VTO", window.row_VTO)}
      ${rowHTML("VET Expected", window.row_VETExpected)}
      ${rowHTML("VET Present", window.row_VETPresent)}
    </tbody>`;

  siteSplitTableEl.innerHTML = header + tableBody;
}

// ================== TAB MANAGEMENT ==================

/**
 * Extended switchTab function to handle the new "siteSplit" tab
 * Integrates with existing tab switching logic
 */
function switchToSiteSplit() {
  // Hide other tabs
  const tabDash = document.getElementById("tabDashboard");
  const tabAudit = document.getElementById("tabAudit");
  const tabSiteSplit = document.getElementById("tab-siteSplit");
  
  const panelDash = document.getElementById("panelDashboard");
  const panelAudit = document.getElementById("panelAudit");
  const panelSiteSplit = document.getElementById("siteSplitPage");

  // Remove active states from other tabs
  if (tabDash) tabDash.classList.remove("active");
  if (tabAudit) tabAudit.classList.remove("active");
  if (tabSiteSplit) tabSiteSplit.classList.add("active");

  // Hide other panels and show site split
  if (panelDash) panelDash.classList.add("hidden");
  if (panelAudit) panelAudit.classList.add("hidden");
  if (panelSiteSplit) panelSiteSplit.classList.remove("hidden");
}

/**
 * Extended switchTab function that handles all tab types including siteSplit
 */
function switchTabExtended(which) {
  if (which === "siteSplit") {
    switchToSiteSplit();
    return;
  }
  
  // Handle original tabs using existing logic
  const tabDash = document.getElementById("tabDashboard");
  const tabAudit = document.getElementById("tabAudit");
  const tabSiteSplit = document.getElementById("tab-siteSplit");
  
  const panelDash = document.getElementById("panelDashboard");
  const panelAudit = document.getElementById("panelAudit");
  const panelSiteSplit = document.getElementById("siteSplitPage");

  // Remove active state from site split tab
  if (tabSiteSplit) tabSiteSplit.classList.remove("active");
  if (panelSiteSplit) panelSiteSplit.classList.add("hidden");

  if (which === "dash") {
    if (tabDash) tabDash.classList.add("active");
    if (tabAudit) tabAudit.classList.remove("active");
    if (panelDash) panelDash.classList.remove("hidden");
    if (panelAudit) panelAudit.classList.add("hidden");
  } else if (which === "audit") {
    if (tabAudit) tabAudit.classList.add("active");
    if (tabDash) tabDash.classList.remove("active");
    if (panelAudit) panelAudit.classList.remove("hidden");
    if (panelDash) panelDash.classList.add("hidden");
  }
}

// ================== INITIALIZATION ==================



/**
 * Initialize site split functionality after DOM is loaded
 */
function initializeSiteSplit() {
  // Hook up the site split tab click handler
  const siteSplitTab = document.getElementById("tab-siteSplit");
  if (siteSplitTab) {
    siteSplitTab.addEventListener("click", () => switchTabExtended("siteSplit"));
  }

  // Override the original switchTab function if it exists
  if (typeof window.switchTab === 'function') {
    const originalSwitchTab = window.switchTab;
    window.switchTab = function(which) {
      if (which === "siteSplit") {
        switchTabExtended("siteSplit");
      } else {
        switchTabExtended(which);
      }
    };
  } else {
    // If switchTab doesn't exist yet, create it
    window.switchTab = switchTabExtended;
  }

  // Hook into existing tab handlers to ensure proper behavior
  const tabDash = document.getElementById("tabDashboard");
  const tabAudit = document.getElementById("tabAudit");
  
  if (tabDash) {
    // Remove existing listeners and add new ones that use our extended function
    const newTabDash = tabDash.cloneNode(true);
    tabDash.parentNode.replaceChild(newTabDash, tabDash);
    newTabDash.addEventListener("click", () => switchTabExtended("dash"));
  }
  
  if (tabAudit) {
    const newTabAudit = tabAudit.cloneNode(true);
    tabAudit.parentNode.replaceChild(newTabAudit, tabAudit);
    newTabAudit.addEventListener("click", () => switchTabExtended("audit"));
  }


}

// ================== POST-PROCESS HOOK ==================

/**
 * Hook that gets called after processAll() completes
 * This ensures the site split table is updated with fresh data
 */
function onProcessComplete() {
  renderSiteSplitTable();
}

/**
 * Hook into the existing processAll function to call our update
 */
function hookProcessAll() {
  if (typeof window.processAll === 'function') {
    const originalProcessAll = window.processAll;
    window.processAll = async function(...args) {
      const result = await originalProcessAll.apply(this, args);
      // Call our site split update after the original processing is done
      setTimeout(onProcessComplete, 100); // Small delay to ensure all globals are set
      return result;
    };
  }
}

// ================== EXPORTS FOR TESTING ==================

// Export functions for unit testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    classifySite,
    aggregateSiteCounts,
    renderSiteSplitTable,
    switchTabExtended,
    onProcessComplete
  };
}

// ================== AUTO-INITIALIZATION ==================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeSiteSplit();
    hookProcessAll();
  });
} else {
  // DOM already loaded
  initializeSiteSplit();
  hookProcessAll();
}