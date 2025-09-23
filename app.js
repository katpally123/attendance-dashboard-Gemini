// ====== CONFIG ======
const SETTINGS_URL = "./settings.json";

// ====== State ======
let SETTINGS = null;
const ORDER = ["Inbound","DA","ICQA","CRETs"];

// ====== Boot ======
fetch(SETTINGS_URL)
  .then(r => {
    if (!r.ok) {
      if (r.status === 404) {
        throw new Error("settings.json not found. Make sure the file is in the same folder as index.html.");
      }
      throw new Error("settings.json fetch failed with status: " + r.status);
    }
    return r.json();
  })
  .then(cfg => {
    SETTINGS = cfg;
    initUI();
  })
  .catch(e => {
    console.error(e);
    alert(e.message || "Couldn't load settings.json");
  });

// ====== Elements ======
const dateEl   = document.getElementById("dateInput");
const shiftEl  = document.getElementById("shiftInput");
const newHireEl= document.getElementById("excludeNewHires");
const rosterEl = document.getElementById("rosterFile");
const mytimeEl = document.getElementById("mytimeFile");
const vacEl    = document.getElementById("vacFile");
const swapEl   = document.getElementById("swapFile");
const vetEl    = document.getElementById("vetFile");
const codesEl  = document.getElementById("codesEl");
const processBtn = document.getElementById("processBtn");
const fileStatus = document.getElementById("fileStatus");

const summaryChips  = document.getElementById("summaryChips");
const expectedNote  = document.getElementById("expectedNote");
const expectedTable = document.getElementById("expectedTable");
const presentTable  = document.getElementById("presentTable");
const dashboardDateEl = document.getElementById("dashboardDate");
const dashboardShiftEl = document.getElementById("dashboardShift");
const totalExpectedChip = document.getElementById("totalExpectedChip");
const totalPresentChip = document.getElementById("totalPresentChip");
const vacExcludedChip = document.getElementById("vacExcludedChip");

// Tabs
document.querySelectorAll(".tab").forEach(b=>{
  b.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".tabpane").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    document.getElementById(b.dataset.tab).classList.add("active");
  });
});

// ====== UI init ======
function initUI(){
  const today = new Date();
  dateEl.value = today.toISOString().slice(0,10);
  shiftEl.value = "Day";
  renderShiftCodes();
  dateEl.addEventListener("change", renderShiftCodes);
  shiftEl.addEventListener("change", renderShiftCodes);
}

// ====== Helpers ======
function toDayName(iso){ if(!iso) return "Monday"; return new Date(iso+"T00:00:00").toLocaleDateString("en-US",{weekday:"long"}); }
function first2(s){ return (s||"").slice(0,2); }
function firstAndThird(s){ return (s?.length>=3) ? s[0]+s[2] : ""; }
function canon(s){ return String(s||"").trim().toLowerCase().replace(/\s+/g," ").replace(/[^\w? ]/g,""); }
function normalizeId(v){
  const t = String(v??"").trim();
  const digits = t.replace(/\D/g,"");
  const noLead = digits.replace(/^0+/,"");
  return noLead || t;
}
function parseDateLoose(s){ const d = new Date(s); return isNaN(d) ? null : d; }
function classifyEmpType(v){
  const x = canon(v);
  if (!x) return "UNKNOWN";
  if (/(amzn|amazon|blue badge|bb|fte|full time|part time|pt)\b/.test(x)) return "AMZN";
  if (/(temp|temporary|seasonal|agency|vendor|contract|white badge|wb|csg|adecco|randstad)/.test(x)) return "TEMP";
  if (x==="temp") return "TEMP";
  if (x==="amzn") return "AMZN";
  return "UNKNOWN";
}
function findKey(row, candidates){
  const keys = Object.keys(row||{});
  const wanted = candidates.map(canon);
  for (const k of keys){ const ck = canon(k); if (wanted.includes(ck)) return k; }
  for (const k of keys){ const ck = canon(k).replace(/\?/g,""); if (wanted.includes(ck)) return k; }
  return null;
}
function renderShiftCodes(){
  if (!SETTINGS) return;
  const dayName = toDayName(dateEl.value);
  const shift = shiftEl.value;
  const codes = (SETTINGS.shift_schedule?.[shift]?.[dayName]) || [];
  codesEl.innerHTML = codes.map(c=>`<code>${c}</code>`).join(" ");
}
function sumBlock(block){
  const acc = {AMZN:0, TEMP:0, TOTAL:0};
  for (const k of Object.keys(block)){
    acc.AMZN += block[k].AMZN; acc.TEMP += block[k].TEMP; acc.TOTAL += block[k].TOTAL;
  }
  return acc;
}
function renderTables(expected, present){
  const header = `
    <thead><tr>
      <th>Department</th><th class="right">AMZN</th><th class="right">TEMP</th><th class="right">TOTAL</th>
    </tr></thead>`;
  const row = v => `<tr><td>${v[0]}</td><td class="right">${v[1].AMZN}</td><td class="right">${v[1].TEMP}</td><td class="right">${v[1].TOTAL}</td></tr>`;

  const rowsExp = Object.entries(expected).map(row).join("");
  const totalsExp = sumBlock(expected);
  expectedTable.innerHTML = header + `<tbody>${rowsExp}</tbody>
    <tfoot><tr><td>Total</td><td class="right">${totalsExp.AMZN}</td><td class="right">${totalsExp.TEMP}</td><td class="right">${totalsExp.TOTAL}</td></tr></tfoot>`;

  const rowsPre = Object.entries(present).map(row).join("");
  const totalsPre = sumBlock(present);
  presentTable.innerHTML = header + `<tbody>${rowsPre}</tbody>
    <tfoot><tr><td>Total</td><td class="right">${totalsPre.AMZN}</td><td class="right">${totalsPre.TEMP}</td><td class="right">${totalsPre.TOTAL}</td></tr></tfoot>`;
}
function renderChips(expected, present, dayName, shift, codes, vacExcluded){
  const exp = sumBlock(expected).TOTAL;
  const pre = sumBlock(present).TOTAL;
  const pct = exp ? ((pre/exp)*100).toFixed(1) : "0.0";
  
  dashboardDateEl.textContent = dayName;
  dashboardShiftEl.textContent = shift;
  codesEl.innerHTML = codes.map(c=>`<code>${c}</code>`).join(" ");
  totalExpectedChip.textContent = exp;
  totalPresentChip.textContent = pre;
  vacExcludedChip.textContent = vacExcluded;
  
  if (pre >= exp) {
    totalPresentChip.closest('.chip').classList.remove('warn');
    totalPresentChip.closest('.chip').classList.add('ok');
  } else {
    totalPresentChip.closest('.chip').classList.remove('ok');
    totalPresentChip.closest('.chip').classList.add('warn');
  }
}

function parseCSVFile(file, opts={header:true, skipFirstLine:false}){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error("Failed to read file"));
    reader.onload = () => {
      let text = reader.result;
      if (opts.skipFirstLine){
        const i = text.indexOf("\n");
        text = i>=0 ? text.slice(i+1) : text;
      }
      Papa.parse(text, {
        header: opts.header,
        skipEmptyLines: true,
        transformHeader: h => h.trim(),
        complete: res => resolve(res.data)
      });
    };
    reader.readAsText(file);
  });
}

function toHours(val) {
  const t = String(val ?? "").trim();
  if (!t) return 0;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return parseInt(m[1],10) + parseInt(m[2],10)/60;
  const cleaned = t.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ====== PROCESS ======
processBtn.addEventListener("click", async ()=>{
  if (!SETTINGS){ alert("Settings not loaded yet. Try again."); return; }
  const dayName = toDayName(dateEl.value);
  if (!dateEl.value){ alert("Pick a date."); return; }
  if (!rosterEl.files[0] || !mytimeEl.files[0]){ alert("Upload both Roster CSV and MyTime CSV."); return; }

  const shift = shiftEl.value;
  const codes = SETTINGS.shift_schedule?.[shift]?.[dayName] || [];
  if (!codes.length){ alert("No shift codes configured for that selection."); return; }

  fileStatus.textContent = "Parsing files…";

  try {
    const [rosterRaw, mytimeRaw, vacRaw, swapRaw, vetRaw] = await Promise.all([
      parseCSVFile(rosterEl.files[0], {header:true}),
      parseCSVFile(mytimeEl.files[0], {header:true, skipFirstLine:true}),
      vacEl.files[0] ? parseCSVFile(vacEl.files[0], {header:true}) : Promise.resolve([]),
      swapEl.files[0] ? parseCSVFile(swapEl.files[0], {header:true}) : Promise.resolve([]),
      vetEl.files[0] ? parseCSVFile(vetEl.files[0], {header:true}) : Promise.resolve([]),
    ]);

    // Vacation
    let vacIds = new Set();
    let vacRowsCount = vacRaw.length;
    if (vacRowsCount > 0) {
      const selectedISO = dateEl.value;
      const sampleV = vacRaw[0] || {};
      const V_ID = findKey(sampleV, ["Employee ID", "Person ID", "Person Number", "Badge ID", "ID"]);
      const V_DATE = findKey(sampleV, ["Date", "Worked Date", "Shift Date", "Business Date"]);
      const V_VAC_CODE = findKey(sampleV, ["Pay Code", "PayCode", "Earning Code"]);
      const V_VAC_ABSENCE = findKey(sampleV, ["Absence Name", "Absence Type"]);
      const V_HOURS = findKey(sampleV, ["Hours"]);

      for (const row of vacRaw) {
        if (V_DATE && new Date(row[V_DATE]).toISOString().slice(0, 10) !== selectedISO) continue;
        const id = normalizeId(row[V_ID]);
        const code = String(row[V_VAC_CODE] || row[V_VAC_ABSENCE] || "").toLowerCase();
        const hours = parseFloat(row[V_HOURS]) || 0;
        if ((code.includes("vac") || code.includes("pto")) && hours > 0) {
          vacIds.add(id);
        }
      }
    }

    // Swap and VET/VTO
    const swapOutIds = new Set();
    const swapInIds = new Set();
    const vetIds = new Set();
    const vtoIds = new Set();
    const targetDate = dateEl.value.replace(/-/g, "/");

    if (swapRaw.length > 0) {
      const SWAP_EMP_ID = findKey(swapRaw[0], ["Employee 1 ID", "Person ID"]);
      const SWAP_STATUS = findKey(swapRaw[0], ["Status"]);
      const SWAP_DATE_SKIP = findKey(swapRaw[0], ["Date to Skip"]);
      const SWAP_DATE_WORK = findKey(swapRaw[0], ["Date to Work"]);
      for (const row of swapRaw) {
        if (row[SWAP_STATUS] === "Approved") {
          const empId = normalizeId(row[SWAP_EMP_ID]);
          if (row[SWAP_DATE_SKIP] === targetDate) {
            swapOutIds.add(empId);
          }
          if (row[SWAP_DATE_WORK] === targetDate) {
            swapInIds.add(empId);
          }
        }
      }
    }

    if (vetRaw.length > 0) {
      const VET_VTO_EMP_ID = findKey(vetRaw[0], ["Employee ID"]);
      const VET_VTO_TYPE = findKey(vetRaw[0], ["Opportunity Type"]);
      const VET_VTO_DATE = findKey(vetRaw[0], ["Shift Date"]);
      for (const row of vetRaw) {
        if (row[VET_VTO_DATE] === targetDate) {
          const empId = normalizeId(row[VET_VTO_EMP_ID]);
          if (row[VET_VTO_TYPE] === "VET") {
            vetIds.add(empId);
          } else if (row[VET_VTO_TYPE] === "VTO") {
            vtoIds.add(empId);
          }
        }
      }
    }

    // Build On-Prem map
    const onPremMap = new Map();
    const m0 = mytimeRaw[0] || {};
    const M_PERSON = findKey(m0, ["Person ID","Employee ID","Person Number","ID"]);
    const M_ONPREM = findKey(m0, ["On Premises","On Premises?","OnPremises"]);
    if (!M_PERSON || !M_ONPREM) throw new Error("Missing MyTime cols (Person ID / On Premises).");
    for (const row of mytimeRaw){
      const pid = normalizeId(row[M_PERSON]);
      const val = String(row[M_ONPREM] ?? "").trim().toUpperCase();
      const isOnPrem = (SETTINGS.present_markers || ["X"]).includes(val);
      if (pid) onPremMap.set(pid, (onPremMap.get(pid) || false) || isOnPrem);
    }

    // Resolve roster headers
    const r0 = rosterRaw[0] || {};
    const R_EMP   = findKey(r0, ["Employee ID","Person Number","Person ID","Badge ID"]);
    const R_DEPT  = findKey(r0, ["Department ID","Home Department ID","Dept ID"]);
    const R_AREA  = findKey(r0, ["Management Area ID","Mgmt Area ID","Area ID","Area"]);
    const R_TYPE  = findKey(r0, ["Employment Type","Associate Type","Worker Type","Badge Type","Company"]);
    const R_SP    = findKey(r0, ["Shift Pattern","Schedule Pattern","Shift"]);
    const R_CORNER= findKey(r0, ["Corner","Corner Code"]);
    const R_START = findKey(r0, ["Employment Start Date","Hire Date","Start Date"]);
    if (!R_EMP || !R_DEPT || !(R_SP || R_CORNER)) throw new Error("Missing roster cols (Employee ID, Department ID, Shift Pattern/Corner).");

    // Enrich roster
    const rosterEnriched = rosterRaw.map(r => {
      const empId  = normalizeId(r[R_EMP]);
      const deptId = String(r[R_DEPT] ?? "").trim();
      const areaId = String((R_AREA? r[R_AREA] : "") ?? "").trim();
      const empType= classifyEmpType(r[R_TYPE]);
      const sp     = String((R_SP? r[R_SP] : "") ?? "");
      const corner = R_CORNER ? String(r[R_CORNER] ?? "").trim() : first2(sp);
      const met    = firstAndThird(sp);
      const start  = R_START ? parseDateLoose(r[R_START]) : null;
      const onPrem = onPremMap.get(empId) === true;
      const vac    = vacIds.has(empId);
      const isSwapOut = swapOutIds.has(empId);
      const isVto = vtoIds.has(empId);
      return { empId, deptId, areaId, empType, sp, corner, met, start, onPrem, vac, isSwapOut, isVto };
    });

    // Corner filter
    let filtered = rosterEnriched.filter(x => codes.includes(x.corner));

    // New hires exclusion
    if (newHireEl && newHireEl.checked){
      const dayStart = new Date(dateEl.value+"T00:00:00");
      filtered = filtered.filter(x => {
        if (!x.start) return true;
        const diffDays = Math.floor((dayStart - x.start)/(1000*60*60*24));
        return diffDays >= 3;
      });
    }

    // Net expected (exclude vacations, swap-outs, and VTOs)
    const expectedCohort = filtered.filter(x => !x.vac && !x.isSwapOut && !x.isVto);
    const vacExcludedCount = filtered.length - expectedCohort.length;

    // Buckets (Inbound excludes DA)
    const cfg = SETTINGS.departments;
    const DA_IDS = cfg.DA.dept_ids;
    const inboundMinusDA = x => cfg.Inbound.dept_ids.includes(x.deptId) && !DA_IDS.includes(x.deptId);
    const belongsDA      = x => DA_IDS.includes(x.deptId);
    const belongsICQA    = x => cfg.ICQA.dept_ids.includes(x.deptId) && x.areaId === cfg.ICQA.management_area_id;
    const belongsCRETs   = x => cfg.CRETs.dept_ids.includes(x.deptId) && x.areaId === cfg.CRETs.management_area_id;

    const group = (rows, pred) => rows.filter(pred);

    // Expected (after vacation, swap-out, and VTO)
    const expGroups = {
      Inbound: group(expectedCohort, inboundMinusDA),
      DA:      group(expectedCohort, belongsDA),
      ICQA:    group(expectedCohort, belongsICQA),
      CRETs:   group(expectedCohort, belongsCRETs)
    };
    // Present (MyTime)
    const preGroups = {
      Inbound: group(filtered, x => inboundMinusDA(x) && x.onPrem),
      DA:      group(filtered, x => belongsDA(x)      && x.onPrem),
      ICQA:    group(filtered, x => belongsICQA(x)    && x.onPrem),
      CRETs:   group(filtered, x => belongsCRETs(x)   && x.onPrem)
    };

    const countByType = rows => {
      const amzn = rows.filter(x => x.empType==="AMZN").length;
      const temp = rows.filter(x => x.empType==="TEMP").length;
      return { AMZN: amzn, TEMP: temp, TOTAL: amzn+temp };
    };

    const expected = {
      Inbound: countByType(expGroups.Inbound),
      DA:      countByType(expGroups.DA),
      ICQA:    countByType(expGroups.ICQA),
      CRETs:   countByType(expGroups.CRETs),
    };
    const present = {
      Inbound: countByType(preGroups.Inbound),
      DA:      countByType(preGroups.DA),
      ICQA:    countByType(preGroups.ICQA),
      CRETs:   countByType(preGroups.CRETs),
    };

    // Add Swap-in and VET to the counts
    const swapInCounts = { AMZN: 0, TEMP: 0, TOTAL: 0 };
    for (const empId of swapInIds) {
      const empType = classifyEmpType(empId);
      swapInCounts[empType]++;
      swapInCounts.TOTAL++;
    }
    expected["Swap In"] = swapInCounts;
    present["Swap In"] = { AMZN: 0, TEMP: 0, TOTAL: 0 };
    for (const empId of swapInIds) {
      if (onPremMap.has(empId)) {
        const empType = classifyEmpType(empId);
        present["Swap In"][empType]++;
        present["Swap In"].TOTAL++;
      }
    }

    const vetCounts = { AMZN: 0, TEMP: 0, TOTAL: 0 };
    for (const empId of vetIds) {
      const empType = classifyEmpType(empId);
      vetCounts[empType]++;
      vetCounts.TOTAL++;
    }
    expected["VET"] = vetCounts;
    present["VET"] = { AMZN: 0, TEMP: 0, TOTAL: 0 };
    for (const empId of vetIds) {
      if (onPremMap.has(empId)) {
        const empType = classifyEmpType(empId);
        present["VET"][empType]++;
        present["VET"].TOTAL++;
      }
    }


    // Render
    const ordered = obj => Object.fromEntries([...ORDER.map(k=>[k, obj[k]]), ["Swap In", obj["Swap In"]], ["VET", obj["VET"]]]);
    renderTables(ordered(expected), ordered(present));
    renderChips(expected, present, dayName, shift, codes, vacExcludedCount);
    fileStatus.textContent = "Done.";

    // ====== AUDIT (Verify + CSV) ======
    const tagDept = (x)=>{
      if (belongsDA(x)) return "DA";
      if (inboundMinusDA(x)) return "Inbound";
      if (belongsICQA(x)) return "ICQA";
      if (belongsCRETs(x)) return "CRETs";
      return "Other";
    };

    const auditRows = filtered.map(x=>({
      empId: x.empId, empType: x.empType, deptId: x.deptId, areaId: x.areaId,
      corner: x.corner, onPrem: x.onPrem ? "YES" : "NO", vac: x.vac ? "YES" : "NO",
      bucket: tagDept(x),
    }));

    const sampleOf = (rows, pred)=> rows.filter(pred).slice(0,200);
    const samples = {
      Inbound: {
        "exp-amzn": sampleOf(expGroups.Inbound, r=>r.empType==="AMZN"),
        "exp-temp": sampleOf(expGroups.Inbound, r=>r.empType==="TEMP"),
        "exp-tot":  expGroups.Inbound.slice(0,200),
        "pre-amzn": sampleOf(preGroups.Inbound, r=>r.empType==="AMZN"),
        "pre-temp": sampleOf(preGroups.Inbound, r=>r.empType==="TEMP"),
        "pre-tot":  preGroups.Inbound.slice(0,200)
      },
      DA: {
        "exp-amzn": sampleOf(expGroups.DA, r=>r.empType==="AMZN"),
        "exp-temp": sampleOf(expGroups.DA, r=>r.empType==="TEMP"),
        "exp-tot":  expGroups.DA.slice(0,200),
        "pre-amzn": sampleOf(preGroups.DA, r=>r.empType==="AMZN"),
        "pre-temp": sampleOf(preGroups.DA, r=>r.empType==="TEMP"),
        "pre-tot":  preGroups.DA.slice(0,200)
      },
      ICQA: {
        "exp-amzn": sampleOf(expGroups.ICQA, r=>r.empType==="AMZN"),
        "exp-temp": sampleOf(expGroups.ICQA, r=>r.empType==="TEMP"),
        "exp-tot":  expGroups.ICQA.slice(0,200),
        "pre-amzn": sampleOf(preGroups.ICQA, r=>r.empType==="AMZN"),
        "pre-temp": sampleOf(preGroups.ICQA, r=>r.empType==="TEMP"),
        "pre-tot":  preGroups.ICQA.slice(0,200)
      },
      CRETs: {
        "exp-amzn": sampleOf(expGroups.CRETs, r=>r.empType==="AMZN"),
        "exp-temp": sampleOf(expGroups.CRETs, r=>r.empType==="TEMP"),
        "exp-tot":  expGroups.CRETs.slice(0,200),
        "pre-amzn": sampleOf(preGroups.CRETs, r=>r.empType==="AMZN"),
        "pre-temp": sampleOf(preGroups.CRETs, r=>r.empType==="TEMP"),
        "pre-tot":  preGroups.CRETs.slice(0,200)
      }
    };

    renderVerify({
      day: dayName,
      shift,
      presentMarkers: SETTINGS.present_markers || ["X"],
      rosterRows: rosterRaw.length,
      mytimeRows: mytimeRaw.length,
      vacRows: vacRowsCount,
      vacExcluded: vacExcludedCount,
      rosterEnriched: filtered.length,
      afterCorner: filtered.length,
      idMatches: (filtered.filter(x => x.empId && (x.onPrem===true || x.onPrem===false))).length,
      byDept: {
        Inbound: {expected: expected.Inbound, present: present.Inbound},
        DA:      {expected: expected.DA,      present: present.DA},
        ICQA:    {expected: expected.ICQA,    present: present.ICQA},
        CRETs:   {expected: expected.CRETs,   present: present.CRETs}
      },
      samples,
      auditRows
    });

  } catch (err){
    console.error(err);
    fileStatus.textContent = "Error processing files. Check CSV headers and try again.";
    alert(err.message || "Error processing files.");
  }
});

// ====== VERIFY UI ======
function renderVerify(stats) {
  const el = document.getElementById("verify");
  if (!el) return;

  const pill = (k,v) => `<span class="chip"><b>${k}</b>: ${v}</span>`;
  const row = (name, obj, key) => `
    <tr>
      <td>${name}</td>
      <td class="right"><a href="#" data-key="${key}" data-type="exp-amzn">${obj.expected.AMZN}</a></td>
      <td class="right"><a href="#" data-key="${key}" data-type="exp-temp">${obj.expected.TEMP}</a></td>
      <td class="right"><a href="#" data-key="${key}" data-type="exp-tot">${obj.expected.TOTAL}</a></td>
      <td class="right"><a href="#" data-key="${key}" data-type="pre-amzn">${obj.present.AMZN}</a></td>
      <td class="right"><a href="#" data-key="${key}" data-type="pre-temp">${obj.present.TEMP}</a></td>
      <td class="right"><a href="#" data-key="${key}" data-type="pre-tot">${obj.present.TOTAL}</a></td>
    </tr>`;

  el.innerHTML = `
    <div class="chips">
      ${pill("Roster rows", stats.rosterRows)}
      ${pill("MyTime rows", stats.mytimeRows)}
      ${pill("Vacation rows", stats.vacRows)}
      ${pill("Vacation excluded", stats.vacExcluded)}
      ${pill("ID matches", `${stats.idMatches} / ${stats.rosterEnriched}`)}
      ${pill("Corner filter", `${stats.afterCorner} rows`)}
      ${pill("Present markers", stats.presentMarkers.join(" / "))}
    </div>
    <h4>Drill-down (click any number)</h4>
    <table class="table">
      <thead>
        <tr>
          <th>Dept</th>
          <th class="right">Exp AMZN</th><th class="right">Exp TEMP</th><th class="right">Exp TOTAL</th>
          <th class="right">Pre AMZN</th><th class="right">Pre TEMP</th><th class="right">Pre TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${row("Inbound", stats.byDept.Inbound, "Inbound")}
        ${row("DA",      stats.byDept.DA,      "DA")}
        ${row("ICQA",    stats.byDept.ICQA,    "ICQA")}
        ${row("CRETs",   stats.byDept.CRETs,   "CRETs")}
      </tbody>
    </table>
    <div id="drill" class="mt"></div>
  `;

  el.querySelectorAll("a[data-key]").forEach(a=>{
    a.addEventListener("click", ev=>{
      ev.preventDefault();
      const key = a.dataset.key, type = a.dataset.type;
      const sample = stats.samples[key][type] || [];
      const drill = document.getElementById("drill");
      drill.innerHTML = `
        <div class="card">
          <b>${key} → ${type}</b>
          <pre>${sample.slice(0,50).map(x=>`${x.empId} | ${x.empType} | dept=${x.deptId} area=${x.areaId} | corner=${x.corner} | onPrem=${x.onPrem} | vac=${x.vac ? "YES" : "NO"}`).join("\n") || "(no rows)"}</pre>
        </div>`;
    });
  });

  const dl = document.getElementById("downloadAudit");
  if (dl) dl.onclick = ()=>{
    const rows = stats.auditRows;
    if (!rows || !rows.length) return alert("No audit rows to download.");
    const headers = Object.keys(rows[0]);
    const escape = v => `"${String(v??"").replace(/"/g,'""')}"`;
    const csv = [headers.join(","), ...rows.map(r=>headers.map(h=>escape(r[h])).join(","))].join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `audit_${stats.day}_${stats.shift}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
}
