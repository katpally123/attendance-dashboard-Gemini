/* ==============================
   PXT Attendance Dashboard — app.js
   ============================== */

/* ---------- SETTINGS & STATE ---------- */
const SETTINGS_URL = new URL("settings.json", document.baseURI).href + "?v=" + Date.now();
const DEFAULT_SETTINGS = {
  departments: {
    Inbound: { dept_ids: ["1211010","1211020","1299010","1299020"] },
    DA:      { dept_ids: ["1211030","1211040","1299030","1299040"] },
    ICQA:    { dept_ids: ["1299070","1211070"], management_area_id: "27" },
    CRETs:   { dept_ids: ["1299070","1211070"], management_area_id: "22" }
  },
  shift_schedule: { Day: {}, Night: {} },
  present_markers: ["X","Y","YES","TRUE","1"],
  swap_mapping: {
    id: ["Employee 1 ID","Employee ID","Person ID","Person Number","Badge ID","ID","Associate ID"],
    status: ["Status","Swap Status"],
    skip_date: ["Date to Skip","Skip Date","Skip"],
    work_date: ["Date to Work","Work Date","Work"],
    approved_statuses: ["Approved","Completed","Accepted"]
  }
};
let SETTINGS = null;

/* ---------- DOM ---------- */
const dateEl        = document.getElementById("dateInput");
const shiftEl       = document.getElementById("shiftInput");
const newHireEl     = document.getElementById("excludeNewHires");

const rosterEl      = document.getElementById("rosterFile");
const mytimeEl      = document.getElementById("mytimeFile");
const vacEl         = document.getElementById("vacFile");
const swapOutEl     = document.getElementById("swapOutFile");
const swapInEl      = document.getElementById("swapInFile");
const vetEl         = document.getElementById("vetFile");

const fileStatus    = document.getElementById("fileStatus");
const processBtn    = document.getElementById("processBtn");

const tabDash       = document.getElementById("tabDashboard");
const tabAudit      = document.getElementById("tabAudit");
const panelDash     = document.getElementById("panelDashboard");
const panelAudit    = document.getElementById("panelAudit");

const chipDay       = document.getElementById("chipDay");
const chipShift     = document.getElementById("chipShift");
const chipCorners   = document.getElementById("chipCorners");
const chipCornerSource = document.getElementById("chipCornerSource");
const chipVacationCount = document.getElementById("chipVacationCount");
const chipBHCount   = document.getElementById("chipBHCount");
const chipVacation  = document.getElementById("chipVacation");
const chipBH        = document.getElementById("chipBH");

const replicaTable  = document.getElementById("replicaTable");
const auditTable    = document.getElementById("auditTable");
const btnNoShow     = document.getElementById("dlNoShow");
const btnAuditCSV   = document.getElementById("dlAuditCSV");

/* ---------- BOOT ---------- */
(async function boot(){
  try{
    const r = await fetch(SETTINGS_URL);
    if (!r.ok) throw new Error("settings.json fetch failed");
    SETTINGS = await r.json();
  }catch(e){
    console.warn("Falling back to DEFAULT_SETTINGS", e);
    SETTINGS = DEFAULT_SETTINGS;
  }

  tabDash.addEventListener("click",()=>setTab("dash"));
  tabAudit.addEventListener("click",()=>setTab("audit"));

  loadUserPrefs();
  if (!dateEl.value) dateEl.value = isoToday();
  updateRibbonStatic();

  dateEl.addEventListener("change",()=>{updateRibbonStatic(); saveUserPrefs();});
  shiftEl.addEventListener("change",()=>{updateRibbonStatic(); saveUserPrefs();});
  newHireEl.addEventListener("change",()=>{updateRibbonStatic(); saveUserPrefs();});

  processBtn.addEventListener("click", processAll);
})();

/* ---------- UI Helpers ---------- */
function setTab(which){
  const dash = which==="dash";
  tabDash.classList.toggle("active", dash);
  tabAudit.classList.toggle("active", !dash);
  panelDash.classList.toggle("hidden", !dash);
  panelAudit.classList.toggle("hidden", dash);
}
function isoToday(){ return new Date().toISOString().slice(0,10); }
function saveUserPrefs(){
  try{
    localStorage.setItem("pxt_attendance_prefs",
      JSON.stringify({date:dateEl.value, shift:shiftEl.value, excludeNewHires:newHireEl.checked}));
  }catch(_){}
}
function loadUserPrefs(){
  try{
    const s = JSON.parse(localStorage.getItem("pxt_attendance_prefs")||"{}");
    if (s.date) dateEl.value = s.date;
    if (s.shift) shiftEl.value = s.shift;
    if (typeof s.excludeNewHires==="boolean") newHireEl.checked = s.excludeNewHires;
  }catch(_){}
}
function updateRibbonStatic(){
  chipDay.textContent = dateEl.value ? new Date(dateEl.value+"T00:00:00").toLocaleDateString("en-US",{weekday:"long"}) : "—";
  chipShift.textContent = shiftEl.value || "—";
  chipCorners.textContent = "—";
  chipCornerSource.textContent = "";
}

/* ---------- CSV/Parsing Helpers ---------- */
function parseCSVFile(file, opts={header:true, skipFirstLine:false}){
  return new Promise((resolve,reject)=>{
    Papa.parse(file,{
      header: !!opts.header,
      skipEmptyLines: true,
      complete: res=>{
        let rows = res.data || [];
        if (opts.skipFirstLine && rows.length) rows = rows.slice(1);
        resolve(rows);
      },
      error: err=>reject(err)
    });
  });
}
const canon = s => String(s||"").trim().toLowerCase().replace(/\s+/g," ");
function findKey(obj, candidates){
  const keys = Object.keys(obj||{});
  for (const cand of candidates){
    const k = keys.find(x=>canon(x)===canon(cand));
    if (k) return k;
  }
  return null;
}
function firstKey(o, cands){ return findKey(o,cands) || null; }
function toISODate(v){
  if (v == null) return null;
  const t = String(v).trim();
  if (!t) return null;
  let d = new Date(t);
  if (!isNaN(d)) return d.toISOString().slice(0,10);
  let m = /^(?:(\d{1,2})\/(\d{1,2})\/(\d{4}))$/.exec(t);
  if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  return null;
}
function normalizeId(v){
  const t = String(v??"").trim();
  const d = t.replace(/\D/g,"");
  const noLead = d.replace(/^0+/,"");
  return noLead || t;
}
function presentVal(val, markers){
  return (markers||[]).includes(String(val||"").trim().toUpperCase());
}
function unique(list){ return [...new Set(list)]; }
function downloadCSV(filename, rows){
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ---------- VET/VTO helpers ---------- */
function pickISODate(row, keys){
  for (const k of keys){
    if (!k) continue;
    const iso = toISODate(row[k]);
    if (iso) return iso;
  }
  return null;
}
function isAccepted(row, kAcceptedCount, kIsAccepted){
  const count = String(row[kAcceptedCount] ?? "").trim();
  const acceptedCountIsOne = count === "1" || count === 1;
  const flag = String(row[kIsAccepted] ?? "").toUpperCase();
  const acceptedFlagTrue = flag === "TRUE";
  return acceptedCountIsOne || acceptedFlagTrue;
}
function vetVtoType(row, kType){
  const t = String(row[kType] ?? "").toUpperCase();
  if (t.includes("VET")) return "VET";
  if (t.includes("VTO")) return "VTO";
  return "";
}

/* ---------- PROCESS ---------- */
async function processAll(){
  fileStatus.textContent = "Parsing…";
  try{
    if (!rosterEl.files[0] || !mytimeEl.files[0]) {
      throw new Error("Upload at least Roster and MyTime CSVs.");
    }

    const [rosterRaw, mytimeRaw, vacRaw, swapOutRaw, swapInRaw, vetRaw] = await Promise.all([
      parseCSVFile(rosterEl.files[0], {header:true}),
      parseCSVFile(mytimeEl.files[0], {header:true, skipFirstLine:true}),
      vacEl.files[0]     ? parseCSVFile(vacEl.files[0], {header:true})     : Promise.resolve([]),
      swapOutEl.files[0] ? parseCSVFile(swapOutEl.files[0], {header:true}) : Promise.resolve([]),
      swapInEl.files[0]  ? parseCSVFile(swapInEl.files[0],  {header:true}) : Promise.resolve([]),
      vetEl.files[0]     ? parseCSVFile(vetEl.files[0],     {header:true}) : Promise.resolve([]),
    ]);

    const isoDate = dateEl.value;
    const dayName = new Date(isoDate+"T00:00:00").toLocaleDateString("en-US",{weekday:"long"});
    chipDay.textContent = dayName;
    chipShift.textContent = shiftEl.value;

    // Corners: from settings or fallback from roster
    let cornerCodes = SETTINGS.shift_schedule?.[shiftEl.value]?.[dayName] || [];
    let cornerSource = "settings";
    if (!cornerCodes.length){
      const cornerKey = findKey(rosterRaw[0]||{},["Corner","Corner Code","CornerName","Corner ID"]) || "Corner";
      cornerCodes = unique(rosterRaw.map(r=>String(r[cornerKey]||"").trim()).filter(Boolean)).slice(0,12);
      cornerSource = "derived";
    }
    chipCorners.textContent = cornerCodes.join(", ");
    chipCornerSource.textContent = cornerSource==="settings" ? "(from settings.json)" : "(derived from Roster)";

    /* ---- MyTime ON-PREMISE (authoritative) ---- */
    const myTimeOnPrem = new Set();
    if (mytimeRaw.length){
      const m0 = mytimeRaw[0] || {};
      const M_ID  = firstKey(m0, ["Employee ID","Person ID","Person Number","Badge ID","ID","EID"]);
      const M_ONP = firstKey(m0, ["On Premise","On-Premise","OnPremise","On Site","OnSite","On Prem"]);
      const markers = SETTINGS.present_markers || DEFAULT_SETTINGS.present_markers;
      if (M_ID && M_ONP){
        for (const r of mytimeRaw){
          const id = normalizeId(r[M_ID]); if (!id) continue;
          if (presentVal(r[M_ONP], markers)) myTimeOnPrem.add(id);
        }
      }
    }

    /* ---- Roster (never used for presence) ---- */
    const r0 = rosterRaw[0] || {};
    const K_ID   = findKey(r0,["Employee ID","Person ID","Person Number","Badge ID","ID"]);
    const K_TYP  = findKey(r0,["Employment Type","EmploymentType","Type"]);
    const K_DEPT = findKey(r0,["Department ID","Department","Dept ID","Dept"]);
    const K_AREA = findKey(r0,["Management Area ID","Area ID","Area"]);
    const K_CORNER = findKey(r0,["Corner","Corner Code","CornerName","Corner ID"]);
    const K_START= findKey(r0,["Employment Start Date","Hire Date","Start Date"]);
    if (!K_ID || !K_TYP || !K_DEPT) throw new Error("Roster missing required columns (ID, Employment Type, Department).");

    let roster = rosterRaw.map(r=>{
      const id = normalizeId(r[K_ID]);
      return {
        id,
        onp: myTimeOnPrem.has(id),                            // <- ALWAYS from MyTime
        typ: /TEMP/i.test(String(r[K_TYP]||"")) ? "TEMP" : "AMZN",
        deptId: String(r[K_DEPT]||"").trim(),
        area: String(r[K_AREA]||"").trim(),
        corner: String(r[K_CORNER]||"").trim(),
        start: r[K_START] ? new Date(r[K_START]) : null
      };
    }).filter(x=>x.id);

    // Exclude new hires (<3 days) if toggle on
    if (newHireEl.checked){
      const date0 = new Date(isoDate+"T00:00:00");
      roster = roster.filter(x=>{
        if (!x.start || isNaN(x.start)) return true;
        const days = Math.floor((date0 - x.start)/86400000);
        return days >= 3;
      });
    }

    const byId = new Map(roster.map(x=>[x.id,x]));

    // Department bucketing
    const cfg = SETTINGS.departments;
    const DA_IDS = cfg.DA.dept_ids;
    const isInbound = x => cfg.Inbound.dept_ids.includes(x.deptId) && !DA_IDS.includes(x.deptId);
    const isDA      = x => DA_IDS.includes(x.deptId);
    const isICQA    = x => cfg.ICQA.dept_ids.includes(x.deptId) && x.area===cfg.ICQA.management_area_id;
    const isCRETs   = x => cfg.CRETs.dept_ids.includes(x.deptId) && x.area===cfg.CRETs.management_area_id;
    const bucketOf  = x => isInbound(x) ? "Inbound" : isDA(x) ? "DA" : isICQA(x) ? "ICQA" : isCRETs(x) ? "CRETs" : null;
    const depts = ["Inbound","DA","ICQA","CRETs"];
    const mkRow = () => Object.fromEntries(depts.map(d=>[d,{AMZN:0,TEMP:0,TOTAL:0}]));
    const bump = (ACC, x)=>{
      const b = bucketOf(x); if (!b) return;
      ACC[b][x.typ]++; ACC[b].TOTAL++;
    };
    const fold = rows => { const A = mkRow(); rows.forEach(x=>bump(A,x)); return A; };
    const sumTotals = A => depts.reduce((s,d)=>s + (A[d]?.TOTAL||0), 0);

    /* ---- Vacation & Banked Holiday ---- */
    const vacSet = new Set(), bhSet = new Set();
    if (vacRaw.length){
      const v0 = vacRaw[0] || {};
      const V_ID = findKey(v0, ["Employee ID","Person ID","Person Number","Badge ID","ID"]);
      const V_H  = findKey(v0, ["Hours","Payable Hours","Total Hours","Duration"]);
      const V_C  = findKey(v0, ["Comment","Pay Code","Description","Pay Reason"]);
      const V_D  = findKey(v0, ["Date","Transaction Date","Posting Date"]);
      for (const r of vacRaw){
        const id = normalizeId(r[V_ID]); if (!id) continue;
        const dt = toISODate(r[V_D]);
        if (dt !== isoDate) continue;
        const hours = parseFloat(String(r[V_H]||"0").replace(/[^\d.]/g,"")) || 0;
        const codeU = String(r[V_C]||"").toUpperCase();
        if (hours>=12 && /BANKED|HOLIDAY/.test(codeU)) bhSet.add(id);
        else if (hours>=10 && /VAC|PTO|VACATION/.test(codeU)) vacSet.add(id);
      }
    }
    chipVacationCount.textContent = vacSet.size;
    chipBHCount.textContent = bhSet.size;
    chipVacation.onclick = (e)=>{ e.preventDefault(); if (!vacSet.size) return;
      downloadCSV("vacation_excluded.csv", [...vacSet].map(id=>({id}))); };
    chipBH.onclick = (e)=>{ e.preventDefault(); if (!bhSet.size) return;
      downloadCSV("banked_holiday_excluded.csv", [...bhSet].map(id=>({id}))); };

    /* ---- VET/VTO (acceptanceTime → opportunityCreatedAt → postedDate) ---- */
    const vetSet = new Set(), vtoSet = new Set();
    if (vetRaw.length){
      const v0 = vetRaw[0] || {};
      const P_ID   = firstKey(v0, ["employeeId","EID","Employee ID","Person ID","Person Number","Badge ID","ID"]);
      const P_TYPE = firstKey(v0, ["opportunity.type","Type","Opportunity Type"]);
      const P_ACC  = firstKey(v0, ["opportunity.acceptedCount","Accepted","Accepted Count"]);
      const P_FLAG = firstKey(v0, ["isAccepted"]);
      const P_AT   = firstKey(v0, ["acceptanceTime"]);
      const P_CR   = firstKey(v0, ["opportunityCreatedAt","opportunity.createdAt"]);
      const P_PD   = firstKey(v0, ["opportunity.postedDate","postedDate","Posting Date"]);
      for (const r of vetRaw){
        const id = normalizeId(r[P_ID]); if (!id) continue;
        const dISO = pickISODate(r, [P_AT, P_CR, P_PD]);
        if (dISO !== isoDate) continue;
        if (!isAccepted(r, P_ACC, P_FLAG)) continue;
        const typ = vetVtoType(r, P_TYPE);
        if (typ==="VET") vetSet.add(id);
        else if (typ==="VTO") vtoSet.add(id);
      }
    }

    /* ---- Swaps ---- */
    function collectSwaps(rows, mapping){
      if (!rows.length) return {out:[], inn:[]};
      const S_ID   = findKey(rows[0]||{}, mapping.id) || "";
      const S_ST   = findKey(rows[0]||{}, mapping.status) || "";
      const S_SKIP = findKey(rows[0]||{}, mapping.skip_date) || "";
      const S_WORK = findKey(rows[0]||{}, mapping.work_date) || "";
      const APPROVED = (mapping.approved_statuses||[]).map(s=>s.toUpperCase());
      const OUT=[], IN=[];
      for (const r of rows){
        const id = normalizeId(r[S_ID]); if (!id) continue;
        const status = String(r[S_ST] ?? "Approved").toUpperCase();
        const ok = !S_ST || APPROVED.includes(status) || /APPROVED|COMPLETED|ACCEPTED/.test(status);
        if (!ok) continue;
        const skipISO = toISODate(r[S_SKIP]);
        const workISO = toISODate(r[S_WORK]);
        if (skipISO===isoDate) OUT.push(id);
        if (workISO===isoDate) IN.push(id);
      }
      return {out:OUT, inn:IN};
    }
    const mapping = SETTINGS.swap_mapping || DEFAULT_SETTINGS.swap_mapping;
    const S1 = collectSwaps(swapOutRaw, mapping);
    const S2 = collectSwaps(swapInRaw,  mapping);
    const swapOutSet = new Set([...S1.out, ...S2.out]);
    const swapInSet  = new Set([...S1.inn, ...S2.inn]);

    /* ---- Build cohorts ----
       Exclude Vacation > BH > VTO > Swap-Out from EXPECTED. */
    const excluded = new Set();
    for (const id of vacSet) if (byId.has(id)) excluded.add(id);
    for (const id of bhSet)  if (byId.has(id) && !excluded.has(id)) excluded.add(id);
    for (const id of vtoSet) if (byId.has(id) && !excluded.has(id)) excluded.add(id);
    for (const id of swapOutSet) if (byId.has(id) && !excluded.has(id)) excluded.add(id);

    const cohortExpected         = roster.filter(x=>!excluded.has(x.id));
    const cohortPresentExSwaps   = cohortExpected.filter(x=>x.onp);

    const swapOutRows            = [...swapOutSet].map(id=>byId.get(id)).filter(Boolean);
    const swapInExpectedRows     = [...swapInSet ].map(id=>byId.get(id)).filter(Boolean);
    const swapInPresentRows      = swapInExpectedRows.filter(x=>x.onp);

    const vetExpectedRows        = [...vetSet].map(id=>byId.get(id)).filter(Boolean);
    const vetPresentRows         = vetExpectedRows.filter(x=>x.onp);

    const depts = ["Inbound","DA","ICQA","CRETs"];
    const row_RegularExpected    = fold(cohortExpected);
    const row_RegularPresentExS  = fold(cohortPresentExSwaps);
    const row_SwapOut            = fold(swapOutRows);
    const row_SwapInExpected     = fold(swapInExpectedRows);
    const row_SwapInPresent      = fold(swapInPresentRows);
    const row_VTO                = fold([...vtoSet].map(id=>byId.get(id)).filter(Boolean));
    const row_VETExpected        = fold(vetExpectedRows);
    const row_VETPresent         = fold(vetPresentRows);

    /* ---- Render replica table ---- */
    const header = `<thead>
      <tr>
        <th>Attendance Details</th>
        ${depts.map(d=>`<th>${d} AMZN</th><th>${d} TEMP</th>`).join("")}
        <th>Total</th>
      </tr>
    </thead>`;
    const rowHTML = (label, ACC)=>{
      const cells = depts.map(d=>`<td>${ACC[d].AMZN}</td><td>${ACC[d].TEMP}</td>`).join("");
      const total = sumTotals(ACC);
      return `<tr><td>${label}</td>${cells}<td>${total}</td></tr>`;
    };

    const totalExpected = depts.reduce((s,d)=>s + row_RegularExpected[d].TOTAL, 0);
    const showedIncl = depts.reduce((s,d)=>s
      + row_RegularPresentExS[d].TOTAL
      + row_SwapInPresent[d].TOTAL
      + row_VETPresent[d].TOTAL, 0);
    const pctShowInclVETSwap = totalExpected ? Math.round((showedIncl/totalExpected)*100) + "%" : "0%";

    replicaTable.innerHTML = header + "<tbody>"
      + rowHTML("Regular HC (Cohort Expected)", row_RegularExpected)
      + rowHTML("Regular HC Present (Excluding Swaps)", row_RegularPresentExS)
      + rowHTML("Shift Swap Out", row_SwapOut)
      + rowHTML("Shift Swap Expected", row_SwapInExpected)
      + rowHTML("Shift Swap Present", row_SwapInPresent)
      + rowHTML("VTO", row_VTO)
      + rowHTML("VET Expected", row_VETExpected)
      + rowHTML("VET Present", row_VETPresent)
      + `<tr><td><b>Total % Showed incl VET + Swap (excl VTO)</b></td>`
      + depts.map(_=>`<td colspan="2"></td>`).join("")
      + `<td><b>${pctShowInclVETSwap}</b></td></tr>`
      + "</tbody>";

    /* ---- Audit + Downloads ---- */
    const reasonOf = (id)=>{
      if (vacSet.has(id)) return "Vacation";
      if (bhSet.has(id))  return "Banked Holiday";
      if (vtoSet.has(id)) return "VTO";
      if (swapOutSet.has(id)) return "Swap-Out";
      if (vetSet.has(id) && !roster.find(x=>x.id===id && x.onp)) return "VET (not shown)";
      return "No-Show";
    };
    const scheduledIds = new Set(cohortExpected.map(x=>x.id));
    const absent = [...scheduledIds].filter(id => {
      const x = byId.get(id);
      return x && !x.onp;
    });

    const auditRows = absent.map(id=>{
      const x = byId.get(id);
      const b = bucketOf(x) || "Other";
      return { id, department: b, type: x.typ, reason: reasonOf(id) };
    });

    const agg = {};
    for (const r of auditRows){
      const key = `${r.department}|${r.type}|${r.reason}`;
      agg[key] = (agg[key]||0) + 1;
    }
    const auditDisplay = Object.entries(agg).map(([k,v])=>{
      const [department,type,reason] = k.split("|");
      return { Department: department, Type: type, Reason: reason, Count: v };
    }).sort((a,b)=> a.Department.localeCompare(b.Department)||a.Type.localeCompare(b.Type)||a.Reason.localeCompare(b.Reason));

    const auditHeader = `<thead>
      <tr><th>Department</th><th>Type</th><th>Reason</th><th>Count</th></tr>
    </thead>`;
    const auditBody = "<tbody>" + auditDisplay.map(r=>(
      `<tr><td>${r.Department}</td><td>${r.Type}</td><td>${r.Reason}</td><td style="text-align:right">${r.Count}</td></tr>`
    )).join("") + "</tbody>";
    auditTable.innerHTML = auditHeader + auditBody;

    btnNoShow.onclick = ()=>{
      const rows = absent
        .filter(id=>reasonOf(id)==="No-Show")
        .map(id=>({ id, department: (byId.get(id) && bucketOf(byId.get(id))) || "", type: byId.get(id)?.typ || "" }));
      downloadCSV(`noshow_${isoDate}.csv`, rows);
    };
    btnAuditCSV.onclick = ()=>{
      downloadCSV(`absence_audit_${isoDate}.csv`, auditRows);
    };

    fileStatus.textContent = "Done";
  }catch(e){
    console.error(e);
    fileStatus.textContent = e.message || "Error";
    alert(e.message || "Failed to process files. Check console for details.");
  }
}
