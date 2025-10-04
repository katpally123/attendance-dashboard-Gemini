// ================= CONFIG / LOAD SETTINGS =================
const SETTINGS_URL = new URL("settings.json", document.baseURI).href + "?v=" + Date.now();
const DEFAULT_SETTINGS = {
  departments: {
    Inbound: { dept_ids: ["1211010","1211020","1299010","1299020"] },
    DA:      { dept_ids: ["1211030","1211040","1299030","1299040"] },
    ICQA:    { dept_ids: ["1299070","1211070"], management_area_id: "27" },
    CRETs:   { dept_ids: ["1299070","1211070"], management_area_id: "22" }
  },
  shift_schedule:{Day:{},Night:{}},
  present_markers:["X","Y","YES","TRUE","1"],
  swap_mapping:{
    id:["Employee 1 ID","Employee ID","Person ID","Person Number","Badge ID","ID","Associate ID"],
    status:["Status","Swap Status"],
    skip_date:["Date to Skip","Skip Date","Skip"],
    work_date:["Date to Work","Work Date","Work"],
    approved_statuses:["Approved","Completed","Accepted"]
  }
};

let SETTINGS = null;

// ================== DOM HOOKS ==================
const dateEl   = document.getElementById("dateInput");
const shiftEl  = document.getElementById("shiftInput");
const newHireEl= document.getElementById("excludeNewHires");

const rosterEl = document.getElementById("rosterFile");
const mytimeEl = document.getElementById("mytimeFile");
const vacEl    = document.getElementById("vacFile");
const swapOutEl= document.getElementById("swapOutFile");
const swapInEl = document.getElementById("swapInFile");
const vetEl    = document.getElementById("vetFile");

const fileStatus = document.getElementById("fileStatus");
const processBtn = document.getElementById("processBtn");

// tabs
const tabDash = document.getElementById("tabDashboard");
const tabAudit= document.getElementById("tabAudit");
const panelDash = document.getElementById("panelDashboard");
const panelAudit= document.getElementById("panelAudit");

// ribbon
const chipDay = document.getElementById("chipDay");
const chipShift = document.getElementById("chipShift");
const chipCorners = document.getElementById("chipCorners");
const chipCornerSource = document.getElementById("chipCornerSource");
const chipVacation = document.getElementById("chipVacation");
const chipBH = document.getElementById("chipBH");
const chipVacationCount = document.getElementById("chipVacationCount");
const chipBHCount = document.getElementById("chipBHCount");

// tables & downloads
const replicaTable = document.getElementById("replicaTable");
const auditTable = document.getElementById("auditTable");
const btnNoShow = document.getElementById("dlNoShow");
const btnAuditCSV = document.getElementById("dlAuditCSV");

// ================== INIT ==================
(async function boot(){
  try {
    const res = await fetch(SETTINGS_URL, {cache:"no-store"});
    SETTINGS = res.ok ? await res.json() : DEFAULT_SETTINGS;
  } catch { SETTINGS = DEFAULT_SETTINGS; }

  const today = new Date();
  dateEl.value = today.toISOString().slice(0,10);
  shiftEl.value = "Day";
  updateRibbonStatic();

  tabDash.addEventListener("click", ()=>switchTab("dash"));
  tabAudit.addEventListener("click", ()=>switchTab("audit"));

  dateEl.addEventListener("change", updateRibbonStatic);
  shiftEl.addEventListener("change", updateRibbonStatic);

  processBtn.addEventListener("click", processAll);
})();

function switchTab(which){
  if (which==="dash"){
    tabDash.classList.add("active"); tabAudit.classList.remove("active");
    panelDash.classList.remove("hidden"); panelAudit.classList.add("hidden");
  }else{
    tabAudit.classList.add("active"); tabDash.classList.remove("active");
    panelAudit.classList.remove("hidden"); panelDash.classList.add("hidden");
  }
}

function updateRibbonStatic(){
  chipDay.textContent = new Date(dateEl.value+"T00:00:00").toLocaleDateString("en-US",{weekday:"long"});
  chipShift.textContent = shiftEl.value;
  chipCorners.textContent = ""; chipCornerSource.textContent = "";
}

// ================== HELPERS ==================
const canon = s => String(s||"").trim().toLowerCase().replace(/\s+/g," ");
const normalizeId = v => {
  const t = String(v??"").trim(); const d=t.replace(/\D/g,""); const noLead=d.replace(/^0+/,"");
  return noLead || t;
};
const presentVal = (val, markers) => markers.includes(String(val||"").trim().toUpperCase());
const parseDateLoose = s => { const d=new Date(s); return isNaN(d)?null:d; };

function toISODate(d){
  if (!d) return null;
  const t = String(d).trim();
  const noTime = t.replace(/[T ]\d.*$/,"");
  const dt = new Date(noTime);
  if (!isNaN(dt)) return dt.toISOString().slice(0,10);
  const mdy=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const ymd=/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/;
  let m;
  if ((m=mdy.exec(noTime))){
    const [,mm,dd,yyyy]=m; return new Date(`${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`).toISOString().slice(0,10);
  }
  if ((m=ymd.exec(noTime))){
    const [,yyyy,mm,dd]=m; return new Date(`${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`).toISOString().slice(0,10);
  }
  return null;
}
function hoursToNumber(h){
  if (h==null) return 0;
  const s=String(h).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m){ const hh=+m[1], mm=+m[2]; return hh + (mm/60); }
  return parseFloat(s)||0;
}
function findKey(row, candidates){
  const keys = Object.keys(row||{});
  const wanted = candidates.map(canon);
  for(const k of keys){
    const ck = canon(k);
    if (wanted.includes(ck)) return k;
    if (wanted.includes(ck.replace(/\?/g,""))) return k;
  }
  return null;
}
function classifyEmpType(v){
  const x = canon(v);
  if (!x) return "UNKNOWN";
  if (/(amzn|amazon|blue badge|bb|fte|full time|part time|pt)\b/.test(x)) return "AMZN";
  if (/(temp|temporary|seasonal|agency|vendor|contract|white badge|wb|csg|adecco|randstad)/.test(x)) return "TEMP";
  return "UNKNOWN";
}
function parseCSVFile(file, opts={header:true, skipFirstLine:false}){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onerror=()=>reject(new Error("Failed to read file"));
    r.onload=()=>{
      let text=r.result;
      if (opts.skipFirstLine){
        const i=text.indexOf("\n");
        text = i>=0 ? text.slice(i+1) : text;
      }
      Papa.parse(text,{header:opts.header,skipEmptyLines:true,transformHeader:h=>h.trim(),complete:res=>resolve(res.data)});
    };
    r.readAsText(file);
  });
}
function downloadCSV(filename, rows){
  const headers = Object.keys(rows[0]||{id:"id",dept_bucket:"dept_bucket",emp_type:"emp_type",corner:"corner",date:"date",reason:"reason"});
  const csv=[headers.join(",")].concat(
    rows.map(r=>headers.map(h=>`"${String(r[h]??"").replace(/"/g,'""')}"`).join(","))
  ).join("\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},0);
}

function deriveCornersFromRoster(rows){
  if (!rows || !rows.length) return [];
  const r0 = rows[0] || {};
  const R_COR = findKey(r0, ["Corner","Corner Code"]);
  const R_SP  = findKey(r0, ["Shift Pattern","Schedule Pattern","Shift"]);
  const set = new Set();
  for (const r of rows){
    const sp = String(r[R_SP] ?? "");
    const c = R_COR ? String(r[R_COR] ?? "").trim() : (sp ? sp.slice(0,2) : "");
    if (c) set.add(c);
  }
  return [...set];
}

// ================== PROCESS ==================
async function processAll(){
  fileStatus.textContent = "Parsing…";
  try{
    if (!rosterEl.files[0] || !mytimeEl.files[0]) throw new Error("Upload Roster and MyTime CSVs.");

    // read all files
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

    let cornerCodes = SETTINGS.shift_schedule?.[shiftEl.value]?.[dayName] || [];
    let cornerSource = "settings";
    if (!cornerCodes.length){
      cornerCodes = deriveCornersFromRoster(rosterRaw);
      cornerSource = "derived";
    }
    chipCorners.textContent = cornerCodes.join(" ");
    chipCornerSource.textContent = cornerSource==="derived" ? "(derived)" : "";

    // MyTime on-prem map
    const m0 = mytimeRaw[0] || {};
    const M_ID = findKey(m0, ["Person ID","Employee ID","Person Number","ID"]);
    const M_ON = findKey(m0, ["On Premises","On Premises?","OnPremises"]);
    if (!M_ID || !M_ON) throw new Error("MyTime must include Person/Employee ID and On Premises.");
    const onPrem = new Map();
    const markers = (SETTINGS.present_markers||["X"]).map(s=>String(s).toUpperCase());
    for (const r of mytimeRaw){
      const id = normalizeId(r[M_ID]); if (!id) continue;
      const val = presentVal(r[M_ON], markers) || false;
      onPrem.set(id, (onPrem.get(id)||false) || val);
    }

    // Roster enrich
    const r0 = rosterRaw[0] || {};
    const R_ID   = findKey(r0, ["Employee ID","Person Number","Person ID","Badge ID","ID"]);
    const R_DEPT = findKey(r0, ["Department ID","Home Department ID","Dept ID"]);
    const R_AREA = findKey(r0, ["Management Area ID","Mgmt Area ID","Area ID","Area"]);
    const R_TYPE = findKey(r0, ["Employment Type","Associate Type","Worker Type","Badge Type","Company"]);
    const R_SP   = findKey(r0, ["Shift Pattern","Schedule Pattern","Shift"]);
    const R_COR  = findKey(r0, ["Corner","Corner Code"]);
    const R_HIRE = findKey(r0, ["Employment Start Date","Hire Date","Start Date"]);
    if (!R_ID || !R_DEPT || !(R_SP||R_COR)) throw new Error("Roster must include Employee ID, Department ID, and Shift Pattern/Corner.");

    const first2 = s=> (s||"").slice(0,2);
    const firstAndThird = s => (s?.length>=3 ? s[0]+s[2] : "");

    let roster = rosterRaw.map(r=>{
      const id = normalizeId(r[R_ID]);
      const deptId = String(r[R_DEPT]??"").trim();
      const area = String((R_AREA? r[R_AREA] : "")??"").trim();
      const typ = classifyEmpType(r[R_TYPE]);
      const sp  = String((R_SP? r[R_SP] : "")??"");
      const corner = R_COR ? String(r[R_COR]??"").trim() : first2(sp);
      const met = firstAndThird(sp);
      const start = R_HIRE ? parseDateLoose(r[R_HIRE]) : null;
      const onp = onPrem.get(id)===true;
      return { id, deptId, area, typ, corner, met, start, onp };
    });
    const fullById = new Map(roster.map(x=>[x.id,x]));

    // filter by corners
    if (cornerCodes.length) roster = roster.filter(x=>cornerCodes.includes(x.corner));

    // exclude new hires
    if (newHireEl.checked){
      const d0 = new Date(isoDate+"T00:00:00");
      roster = roster.filter(x=>{
        if (!x.start) return true;
        const days = Math.floor((d0-x.start)/(1000*60*60*24));
        return days>=3;
      });
    }

    // dept helpers
    const cfg = SETTINGS.departments;
    const DA_IDS = cfg.DA.dept_ids;
    const isInbound = x => cfg.Inbound.dept_ids.includes(x.deptId) && !DA_IDS.includes(x.deptId);
    const isDA      = x => DA_IDS.includes(x.deptId);
    const isICQA    = x => cfg.ICQA.dept_ids.includes(x.deptId) && x.area===cfg.ICQA.management_area_id;
    const isCRETs   = x => cfg.CRETs.dept_ids.includes(x.deptId) && x.area===cfg.CRETs.management_area_id;
    const bucketOf  = x => isInbound(x) ? "Inbound" : isDA(x) ? "DA" : isICQA(x) ? "ICQA" : isCRETs(x) ? "CRETs" : "Other";

    const depts = ["Inbound","DA","ICQA","CRETs"];
    const mkRow = () => Object.fromEntries(depts.map(d=>[d,{AMZN:0,TEMP:0,TOTAL:0}]));
    const pushCount = (ACC, row)=>{
      const b=bucketOf(row); if (!depts.includes(b)) return;
      if (row.typ==="AMZN"){ACC[b].AMZN++; ACC[b].TOTAL++;}
      else if (row.typ==="TEMP"){ACC[b].TEMP++; ACC[b].TOTAL++;}
    };
    const sumTotals = ACC => depts.reduce((s,d)=>s+ACC[d].TOTAL,0);

    const byId = new Map(roster.map(x=>[x.id,x]));

    // ====== Hours Summary: Vacation (>=10h) & Banked Holiday (>=12h) ======
    const vacSet = new Set();       // Vacation/PTO
    const bhSet  = new Set();       // Banked Holiday
    if (vacRaw.length){
      const v0 = vacRaw[0];
      const V_ID = findKey(v0, ["Employee ID","Person ID","Person Number","Badge ID","ID"]);
      const V_DT = findKey(v0, ["Date","Worked Date","Shift Date","Business Date"]);
      const V_PC = findKey(v0, ["Pay Code","PayCode","Earning Code","Absence Name","Absence Type"]);
      const V_HR = findKey(v0, ["Hours","Total Hours"]);
      for (const r of vacRaw){
        const id = normalizeId(r[V_ID]); if (!id) continue;
        if (toISODate(r[V_DT]) !== isoDate) continue;
        const code = String(r[V_PC]||"").toLowerCase();
        const hrs  = hoursToNumber(r[V_HR]);
        if (hrs >= 12 && /(banked|holiday\s*bank|banked-?holiday|bh\b)/.test(code)) bhSet.add(id);
        else if (hrs >= 10 && /(vac|pto)/.test(code)) vacSet.add(id);
      }
    }

    // ====== PostingAcceptance: VET/VTO (SOP: Status -> AcceptedCount=1 -> Date) ======
// ====== PostingAcceptance: VET/VTO (EmployeeID-based, float-safe, VTO-wins) ======
const vetSet = new Set(); // employee IDs with VET for isoDate
const vtoSet = new Set(); // employee IDs with VTO for isoDate

if (vetRaw && vetRaw.length) {
  const a0 = vetRaw[0];

  // --- Column detection ---
  const A_CLASS = findKey(a0, ["_class","class"]);
  const A_ID    = findKey(a0, ["employeeId","Employee ID","Person ID"]);
  const A_TYP   = findKey(a0, ["opportunity.type","Opportunity Type","Type"]);
  const A_ACC   = findKey(a0, ["opportunity.acceptedCount","Accepted Count"]);
  const A_FLG   = findKey(a0, ["isAccepted"]);
  const A_S1    = findKey(a0, ["opportunity.shiftStart","shiftStart"]);
  const A_S2    = findKey(a0, ["opportunity.shiftEnd","shiftEnd"]);
  const A_T1    = findKey(a0, ["acceptanceTime"]);
  const A_T2    = findKey(a0, ["opportunityCreatedAt","opportunity.createdAt"]);
  const A_OPID  = findKey(a0, ["opportunity.id","opportunityId","Opportunity Id"]);

  const dateFromTs = v => {
    const s = String(v||"").trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
    return m ? m[1] : (s.match(/^(\d{4}-\d{2}-\d{2})$/)?.[1] || null);
  };
  const classifyType = raw => {
    const t = String(raw||"").toLowerCase();
    if (t.includes("vto") || t.includes("timeoff")) return "VTO";
    if (t.includes("vet") || t.includes("overtime")) return "VET";
    return null;
  };

  // --- Counters and dedupe sets ---
  const firstLevel = new Set();
  const perType = { VET:new Set(), VTO:new Set() };
  let seenRows=0,acceptedPass=0,datePass=0,typePass=0,rosterPass=0;

  for (const r of vetRaw) {
    seenRows++;
    if (A_CLASS) {
      const cls = String(r[A_CLASS]||"");
      if (!/AcceptancePostingAcceptanceRecord/i.test(cls)) continue;
    }

    // uses already-declared normalizeId safely (no redeclaration)
    const empId = normalizeId(r[A_ID]);
    if (!empId) continue;

    const accCountOk = A_ACC ? Number(r[A_ACC]) > 0 : false;
    const accFlagOk  = A_FLG ? String(r[A_FLG]).trim().toLowerCase() === "true" : false;
    if (!(accCountOk || accFlagOk)) continue;
    acceptedPass++;

    const dISO = dateFromTs(r[A_S1]) || dateFromTs(r[A_S2]) ||
                 dateFromTs(r[A_T1]) || dateFromTs(r[A_T2]);
    if (dISO !== isoDate) continue;
    datePass++;

    const tClass = classifyType(r[A_TYP]);
    if (!tClass) continue;
    typePass++;

    const rosterEntry = byId.get(empId);
    if (!rosterEntry) continue;
    rosterPass++;

    const oppId = A_OPID ? (r[A_OPID]||"") : "";
    const k1 = `${empId}|${dISO}|${tClass}|${oppId}`;
    if (firstLevel.has(k1)) continue;
    firstLevel.add(k1);

    const k2 = `${empId}|${dISO}|${tClass}`;
    perType[tClass].add(k2);
  }

  // --- Collapse and enforce VTO precedence ---
  const pairsVTO = new Set([...perType.VTO].map(k=>k.split("|").slice(0,2).join("|")));
  const pairsVET = new Set([...perType.VET].map(k=>k.split("|").slice(0,2).join("|")));

  for (const p of pairsVTO) vtoSet.add(p.split("|")[0]);
  for (const p of pairsVET) if (!pairsVTO.has(p)) vetSet.add(p.split("|")[0]);

  console.log("✅ VET/VTO Summary:", {
    seenRows, acceptedPass, datePass, typePass, rosterPass,
    vetCount: vetSet.size, vtoCount: vtoSet.size
  });
}
    // ====== Swaps ======
    const collectSwaps=(rows,mapping)=>{
      const out=[], inn=[];
      if (!rows.length) return {out,inn};
      const s0=rows[0];
      const S_ID   = findKey(s0, mapping.id || DEFAULT_SETTINGS.swap_mapping.id);
      const S_ST   = findKey(s0, mapping.status || DEFAULT_SETTINGS.swap_mapping.status);
      const S_SKIP = findKey(s0, mapping.skip_date || DEFAULT_SETTINGS.swap_mapping.skip_date);
      const S_WORK = findKey(s0, mapping.work_date || DEFAULT_SETTINGS.swap_mapping.work_date);
      const APPROVED = (mapping.approved_statuses || DEFAULT_SETTINGS.swap_mapping.approved_statuses).map(s=>String(s).toUpperCase());
      for (const r of rows){
        const id = normalizeId(r[S_ID]); if (!id) continue;
        const st = String(r[S_ST] ?? "Approved").toUpperCase();
        const ok = !S_ST || APPROVED.includes(st) || /APPROVED|COMPLETED|ACCEPTED/.test(st);
        if (!ok) continue;
        const skipISO = toISODate(r[S_SKIP]);
        const workISO = toISODate(r[S_WORK]);
        if (skipISO===isoDate) out.push(id);
        if (workISO===isoDate) inn.push(id);
      }
      return {out,inn};
    };
    const mapping = SETTINGS.swap_mapping || DEFAULT_SETTINGS.swap_mapping;
    const S1 = collectSwaps(swapOutRaw, mapping);
    const S2 = collectSwaps(swapInRaw,  mapping);
    const swapOutSet = new Set([...S1.out, ...S2.out]);
    const swapInSet  = new Set([...S1.inn, ...S2.inn]);

    // ====== Build cohorts ======
    // Exclusions from "expected": Vacation, Banked Holiday, VTO, Swap-Out (priority Vacation > BH > VTO > Swap-Out)
    const excluded = new Set();
    for (const id of vacSet) if (byId.has(id)) excluded.add(id);
    for (const id of bhSet)  if (byId.has(id) && !excluded.has(id)) excluded.add(id);
    for (const id of vtoSet) if (byId.has(id) && !excluded.has(id)) excluded.add(id);
    for (const id of swapOutSet) if (byId.has(id) && !excluded.has(id)) excluded.add(id);

    const cohortExpected = roster.filter(x=>!excluded.has(x.id));
    const cohortPresentExSwaps = cohortExpected.filter(x=>x.onp);

    // rows for display
    const swapOutRows        = [...swapOutSet].map(id=>byId.get(id)).filter(Boolean);
    const swapInExpectedRows = [...swapInSet].map(id=>fullById.get(id)).filter(Boolean);
    const swapInPresentRows  = swapInExpectedRows.filter(x=>onPrem.get(x.id)===true);

    const vetExpectedRows = [...vetSet].map(id=>byId.get(id)||fullById.get(id)).filter(Boolean);
    const vetPresentRows  = vetExpectedRows.filter(x=>onPrem.get(x.id)===true);

    // ---------- Dashboard table ----------
    const row_RegularExpected   = mkRow(); cohortExpected.forEach(x=>pushCount(row_RegularExpected,x));
    const row_RegularPresentExS = mkRow(); cohortPresentExSwaps.forEach(x=>pushCount(row_RegularPresentExS,x));
    const row_SwapOut           = mkRow(); swapOutRows.forEach(x=>pushCount(row_SwapOut,x));
    const row_SwapInExpected    = mkRow(); swapInExpectedRows.forEach(x=>pushCount(row_SwapInExpected,x));
    const row_SwapInPresent     = mkRow(); swapInPresentRows.forEach(x=>pushCount(row_SwapInPresent,x));
    const row_VTO               = mkRow(); [...vtoSet].map(id=>byId.get(id)||fullById.get(id)).filter(Boolean).forEach(x=>pushCount(row_VTO,x));
    const row_VETExpected       = mkRow(); vetExpectedRows.forEach(x=>pushCount(row_VETExpected,x));
    const row_VETPresent        = mkRow(); vetPresentRows.forEach(x=>pushCount(row_VETPresent,x));

    const header = `
      <thead>
        <tr>
          <th>Attendance Details</th>
          ${depts.map(d=>`<th>${d} AMZN</th><th>${d} TEMP</th>`).join("")}
          <th>Total</th>
        </tr>
      </thead>`;
    const rowHTML = (label,ACC)=>{
      const cells = depts.map(d=>`<td>${ACC[d].AMZN}</td><td>${ACC[d].TEMP}</td>`).join("");
      const total = sumTotals(ACC);
      return `<tr><td>${label}</td>${cells}<td>${total}</td></tr>`;
    };
    replicaTable.innerHTML = header + "<tbody>"
      + rowHTML("Regular HC (Cohort Expected)", row_RegularExpected)
      + rowHTML("Regular HC Present (Excluding Swaps)", row_RegularPresentExS)
      + rowHTML("Shift Swap Out", row_SwapOut)
      + rowHTML("Shift Swap Expected", row_SwapInExpected)
      + rowHTML("Shift Swap Present", row_SwapInPresent)
      + rowHTML("VTO", row_VTO)
      + rowHTML("VET Expected", row_VETExpected)
      + rowHTML("VET Present", row_VETPresent)
      + "</tbody>";

    // ---------- Ribbon chips for Vacation / BH with CSV links ----------
    const vacRows = [...vacSet].map(id=>byId.get(id)||fullById.get(id)).filter(Boolean).map(x=>({
      id:x.id, dept_bucket:bucketOf(x), emp_type:x.typ, corner:x.corner, date:isoDate, reason:"Vacation"
    }));
    const bhRows  = [...bhSet].map(id=>byId.get(id)||fullById.get(id)).filter(Boolean).map(x=>({
      id:x.id, dept_bucket:bucketOf(x), emp_type:x.typ, corner:x.corner, date:isoDate, reason:"Banked Holiday"
    }));
    chipVacationCount.textContent = vacRows.length;
    chipBHCount.textContent = bhRows.length;
    const buildURL = (rows)=> {
      const headers=["id","dept_bucket","emp_type","corner","date","reason"];
      const csv=[headers.join(",")].concat(rows.map(r=>headers.map(h=>`"${String(r[h]??"").replace(/"/g,'""')}"`).join(","))).join("\n");
      const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
      return url;
    };
    chipVacation.href = buildURL(vacRows.length?vacRows:[{id:"",dept_bucket:"",emp_type:"",corner:"",date:isoDate,reason:"Vacation"}]);
    chipBH.href = buildURL(bhRows.length?bhRows:[{id:"",dept_bucket:"",emp_type:"",corner:"",date:isoDate,reason:"Banked Holiday"}]);

    // ---------- No-Show CSV ----------
    const noShows = cohortExpected.filter(x=>!x.onp).map(x=>({
      id:x.id, dept_bucket:bucketOf(x), emp_type:x.typ, corner:x.corner, date:isoDate, reason:"No-Show"
    }));
    btnNoShow.onclick = ()=> downloadCSV(`no_shows_${isoDate}.csv`, noShows.length?noShows:[{id:"",dept_bucket:"",emp_type:"",corner:"",date:isoDate,reason:"No-Show"}]);

    // ================= AUDIT TABLE =================
    // Priority tagging: Vacation > BH > VTO > Swap-Out > VET-not-shown > No-Show
    const reasonOf = new Map(); // id -> reason
    const tag = (ids, reason)=>{ for (const id of ids){ if (byId.has(id) && !reasonOf.has(id)) reasonOf.set(id, reason); } };

    tag(vacSet, "Vacation / PTO");
    tag(bhSet,  "Banked Holiday");
    tag(vtoSet, "VTO accepted");
    tag(swapOutSet, "Swap-Out");

    // VET-not-shown: accepted VET but not on-prem
    for (const x of vetExpectedRows){
      if (onPrem.get(x.id)!==true && !reasonOf.has(x.id)) reasonOf.set(x.id, "VET accepted but not shown");
    }
    // No-Show: scheduled after exclusions but not present and not already tagged
    for (const x of cohortExpected){
      if (x.onp!==true && !reasonOf.has(x.id)) reasonOf.set(x.id, "No-Show (plain)");
    }

    // Build audit counts
    const auditReasons = [
      "Vacation / PTO",
      "Banked Holiday",
      "VTO accepted",
      "Swap-Out",
      "VET accepted but not shown",
      "No-Show (plain)"
    ];
    const auditCounts = Object.fromEntries(auditReasons.map(r=>[r, mkRow()]));
    for (const [id, reason] of reasonOf.entries()){
      const row = byId.get(id) || fullById.get(id);
      if (!row) continue;
      pushCount(auditCounts[reason], row);
    }

    const auditHeader = `
      <thead>
        <tr>
          <th>Absence Reason</th>
          ${depts.map(d=>`<th>${d} AMZN</th><th>${d} TEMP</th>`).join("")}
          <th>Total</th>
        </tr>
      </thead>`;
    const auditBody = auditReasons.map(label=>{
      const ACC = auditCounts[label];
      const cells = depts.map(d=>`<td>${ACC[d].AMZN}</td><td>${ACC[d].TEMP}</td>`).join("");
      const total = sumTotals(ACC);
      return `<tr><td>${label}</td>${cells}<td>${total}</td></tr>`;
    }).join("");
    auditTable.innerHTML = auditHeader + "<tbody>" + auditBody + "</tbody>";

    // Audit CSV = row-level details (one line per associate with reason)
    const auditRows = [];
    for (const [id, reason] of reasonOf.entries()){
      const x = byId.get(id) || fullById.get(id); if (!x) continue;
      auditRows.push({ id:x.id, dept_bucket:bucketOf(x), emp_type:x.typ, corner:x.corner, date:isoDate, reason });
    }
    btnAuditCSV.onclick = ()=> downloadCSV(`audit_${isoDate}.csv`, auditRows.length?auditRows:[{id:"",dept_bucket:"",emp_type:"",corner:"",date:isoDate,reason:""}]);

    fileStatus.textContent = "Done";
  }catch(e){
    console.error(e);
    fileStatus.textContent="Error";
    alert(e.message || "Processing failed");
  }
}
