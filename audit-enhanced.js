/**
 * Enhanced Interactive Audit Functionality
 * 
 * This module enhances the audit tab with clickable counts that show detailed
 * associate lists and provide CSV download options for each category.
 */

// Global storage for audit data
let auditDetailData = {};

// ================== AUDIT DATA MANAGEMENT ==================

/**
 * Stores detailed audit data for interactive features
 * @param {Object} data - Object containing reason -> associate list mapping
 */
function storeAuditDetailData(data) {
  auditDetailData = data;
}

/**
 * Gets associates for a specific reason and department/type combination
 * @param {string} reason - The absence reason
 * @param {string} dept - Department (Inbound, DA, ICQA, CRETs)
 * @param {string} empType - Employee type (AMZN, TEMP)
 * @returns {Array} - List of associates matching criteria
 */
function getAssociatesForCell(reason, dept, empType) {
  if (!auditDetailData[reason]) return [];
  
  return auditDetailData[reason].filter(associate => 
    associate.dept_bucket === dept && associate.emp_type === empType
  );
}

/**
 * Gets all associates for a specific reason
 * @param {string} reason - The absence reason
 * @returns {Array} - List of all associates for this reason
 */
function getAssociatesForReason(reason) {
  return auditDetailData[reason] || [];
}

// ================== MODAL FUNCTIONALITY ==================

/**
 * Creates and shows a modal with associate details
 * @param {string} title - Modal title
 * @param {Array} associates - List of associates to show
 * @param {string} reason - The absence reason for CSV filename
 */
function showAssociateModal(title, associates, reason) {
  // Remove existing modal if present
  const existingModal = document.getElementById('auditModal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal HTML
  const modal = document.createElement('div');
  modal.id = 'auditModal';
  modal.className = 'audit-modal-overlay';
  
  const associateRows = associates.map(assoc => `
    <tr>
      <td>${assoc.id}</td>
      <td>${assoc.dept_bucket}</td>
      <td>${assoc.emp_type}</td>
      <td>${assoc.corner}</td>
      <td>${assoc.date}</td>
    </tr>
  `).join('');

  modal.innerHTML = `
    <div class="audit-modal">
      <div class="audit-modal-header">
        <h3>${title}</h3>
        <button class="audit-modal-close" onclick="closeAuditModal()">&times;</button>
      </div>
      <div class="audit-modal-content">
        <div class="audit-modal-summary">
          <span class="audit-count">${associates.length}</span> associates found
          <button class="btn btn-green audit-download-btn" onclick="downloadAuditDetails('${reason}', '${title}')">
            Download CSV
          </button>
        </div>
        <div class="audit-table-container">
          <table class="table audit-detail-table">
            <thead>
              <tr>
                <th>Associate ID</th>
                <th>Department</th>
                <th>Type</th>
                <th>Corner</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${associateRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeAuditModal();
    }
  });

  // Add escape key to close
  document.addEventListener('keydown', handleEscapeKey);
}

/**
 * Closes the audit modal
 */
function closeAuditModal() {
  const modal = document.getElementById('auditModal');
  if (modal) {
    modal.remove();
  }
  document.removeEventListener('keydown', handleEscapeKey);
}

/**
 * Handle escape key to close modal
 */
function handleEscapeKey(e) {
  if (e.key === 'Escape') {
    closeAuditModal();
  }
}

// ================== CSV DOWNLOAD ==================

/**
 * Downloads CSV for specific audit details
 * @param {string} reason - The absence reason
 * @param {string} title - Title for filename
 */
function downloadAuditDetails(reason, title) {
  const associates = getAssociatesForReason(reason);
  
  if (associates.length === 0) {
    alert('No data to download');
    return;
  }

  const headers = ['Associate ID', 'Department', 'Type', 'Corner', 'Date', 'Reason'];
  const csvContent = [
    headers.join(','),
    ...associates.map(assoc => [
      `"${assoc.id}"`,
      `"${assoc.dept_bucket}"`,
      `"${assoc.emp_type}"`,
      `"${assoc.corner}"`,
      `"${assoc.date}"`,
      `"${assoc.reason}"`
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  
  const filename = `audit_${reason.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ================== AUDIT TABLE ENHANCEMENT ==================

/**
 * Enhanced audit table rendering with clickable cells
 * @param {Object} auditCounts - Count data by reason and department
 * @param {Array} auditReasons - List of audit reasons
 * @param {Array} depts - List of departments
 * @param {Function} sumTotals - Function to sum totals
 * @returns {string} - HTML for enhanced audit table
 */
function renderEnhancedAuditTable(auditCounts, auditReasons, depts, sumTotals) {
  const auditHeader = `
    <thead>
      <tr>
        <th>Absence Reason</th>
        ${depts.map(d=>`<th>${d} AMZN</th><th>${d} TEMP</th>`).join("")}
        <th>Total</th>
      </tr>
    </thead>`;

  const auditBody = auditReasons.map(reason => {
    const ACC = auditCounts[reason];
    const cells = depts.map(dept => {
      const amznCount = ACC[dept].AMZN;
      const tempCount = ACC[dept].TEMP;
      
      // Make cells clickable if they have data
      const amznCell = amznCount > 0 
        ? `<td class="audit-clickable" data-reason="${reason}" data-dept="${dept}" data-type="AMZN">${amznCount}</td>`
        : `<td>${amznCount}</td>`;
      
      const tempCell = tempCount > 0
        ? `<td class="audit-clickable" data-reason="${reason}" data-dept="${dept}" data-type="TEMP">${tempCount}</td>`
        : `<td>${tempCount}</td>`;
      
      return amznCell + tempCell;
    }).join("");
    
    const total = sumTotals(ACC);
    const totalCell = total > 0
      ? `<td class="audit-clickable audit-total" data-reason="${reason}" data-type="ALL">${total}</td>`
      : `<td>${total}</td>`;
    
    return `<tr>
      <td class="audit-reason-cell" data-reason="${reason}">${reason}</td>
      ${cells}
      ${totalCell}
    </tr>`;
  }).join("");

  return auditHeader + "<tbody>" + auditBody + "</tbody>";
}

/**
 * Attaches click handlers to audit table cells
 */
function attachAuditClickHandlers() {
  // Handle clicks on individual cells
  document.querySelectorAll('.audit-clickable').forEach(cell => {
    cell.addEventListener('click', function() {
      const reason = this.dataset.reason;
      const dept = this.dataset.dept;
      const empType = this.dataset.type;
      
      let associates;
      let title;
      
      if (empType === 'ALL') {
        // Total column clicked - show all associates for this reason
        associates = getAssociatesForReason(reason);
        title = `${reason} - All Associates`;
      } else {
        // Specific dept/type cell clicked
        associates = getAssociatesForCell(reason, dept, empType);
        title = `${reason} - ${dept} ${empType}`;
      }
      
      showAssociateModal(title, associates, reason);
    });

    // Add hover effect
    cell.style.cursor = 'pointer';
    cell.title = 'Click to view associate details';
  });

  // Handle clicks on reason cells (show all for that reason)
  document.querySelectorAll('.audit-reason-cell').forEach(cell => {
    cell.addEventListener('click', function() {
      const reason = this.dataset.reason;
      const associates = getAssociatesForReason(reason);
      const title = `${reason} - All Associates`;
      
      showAssociateModal(title, associates, reason);
    });

    cell.style.cursor = 'pointer';
    cell.title = 'Click to view all associates for this reason';
  });
}

// ================== INTEGRATION WITH MAIN APP ==================

/**
 * Hooks into the existing audit table generation
 * Call this function after the audit data is processed in processAll()
 */
function enhanceAuditTable() {
  // This will be called from the main app after audit processing
  setTimeout(() => {
    attachAuditClickHandlers();
  }, 100);
}

/**
 * Processes audit data for detailed tracking
 * @param {Map} reasonOf - Map of associate ID to reason
 * @param {Map} byId - Map of associate data by ID
 * @param {Map} fullById - Full associate data map
 * @param {Function} bucketOf - Function to determine department bucket
 * @param {string} isoDate - Current date in ISO format
 */
function processAuditDetailData(reasonOf, byId, fullById, bucketOf, isoDate) {
  const detailData = {};
  
  // Group associates by reason
  for (const [id, reason] of reasonOf.entries()) {
    if (!detailData[reason]) {
      detailData[reason] = [];
    }
    
    const associate = byId.get(id) || fullById.get(id);
    if (associate) {
      detailData[reason].push({
        id: associate.id,
        dept_bucket: bucketOf(associate),
        emp_type: associate.typ,
        corner: associate.corner,
        date: isoDate,
        reason: reason
      });
    }
  }
  
  storeAuditDetailData(detailData);
}

// ================== STYLES ==================

/**
 * Injects CSS styles for the audit modal and interactive elements
 */
function injectAuditStyles() {
  if (document.getElementById('audit-styles')) return; // Already injected

  const styles = `
    <style id="audit-styles">
      .audit-clickable {
        background-color: rgba(74, 167, 255, 0.1) !important;
        transition: background-color 0.2s ease;
      }
      
      .audit-clickable:hover {
        background-color: rgba(74, 167, 255, 0.2) !important;
      }
      
      .audit-reason-cell {
        background-color: rgba(40, 167, 69, 0.1) !important;
        transition: background-color 0.2s ease;
      }
      
      .audit-reason-cell:hover {
        background-color: rgba(40, 167, 69, 0.2) !important;
      }
      
      .audit-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      
      .audit-modal {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 12px;
        width: 90%;
        max-width: 800px;
        max-height: 80%;
        display: flex;
        flex-direction: column;
      }
      
      .audit-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--line);
      }
      
      .audit-modal-header h3 {
        margin: 0;
        color: var(--text);
      }
      
      .audit-modal-close {
        background: none;
        border: none;
        font-size: 24px;
        color: var(--muted);
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .audit-modal-close:hover {
        color: var(--text);
      }
      
      .audit-modal-content {
        padding: 20px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        flex: 1;
      }
      
      .audit-modal-summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding-bottom: 15px;
        border-bottom: 1px solid var(--line);
      }
      
      .audit-count {
        font-size: 18px;
        font-weight: bold;
        color: var(--accent);
      }
      
      .audit-download-btn {
        padding: 8px 16px;
      }
      
      .audit-table-container {
        flex: 1;
        overflow: auto;
        border: 1px solid var(--line);
        border-radius: 6px;
      }
      
      .audit-detail-table {
        margin: 0;
      }
      
      .audit-detail-table th {
        position: sticky;
        top: 0;
        background: var(--card);
        z-index: 10;
      }
      
      .audit-total {
        font-weight: bold;
        background-color: rgba(40, 167, 69, 0.1) !important;
      }
    </style>
  `;
  
  document.head.insertAdjacentHTML('beforeend', styles);
}

// ================== INITIALIZATION ==================

/**
 * Initialize enhanced audit functionality
 */
function initializeEnhancedAudit() {
  injectAuditStyles();
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEnhancedAudit);
} else {
  initializeEnhancedAudit();
}

// ================== EXPORTS ==================

// Make functions globally available
window.enhanceAuditTable = enhanceAuditTable;
window.processAuditDetailData = processAuditDetailData;
window.renderEnhancedAuditTable = renderEnhancedAuditTable;
window.closeAuditModal = closeAuditModal;
window.downloadAuditDetails = downloadAuditDetails;