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

// ================= INIT (safe) =================
document.addEventListener("DOMContentLoaded", bootSafe);

function mustGet(id){ const el=document.getElementById(id); if(!el) throw new Error(`Missing element #${id}`); return el; }

async function bootSafe(){
  try{
    // Required controls (match your HTML exactly)
    window.dateEl       = mustGet("dateInput");
    window.shiftEl      = mustGet("shiftInput");
    window.processBtn   = mustGet("processBtn");
    window.rosterEl     = mustGet("rosterFile");
    window.mytimeEl     = mustGet("mytimeFile");

    // Optional inputs
    window.newHireEl    = document.getElementById("excludeNewHires") || {checked:false};
    window.vacEl        = document.getElementById("vacFile")     || {files:[]};
    window.swapOutEl    = document.getElementById("swapOutFile") || {files:[]};
    window.swapInEl     = document.getElementById("swapInFile")  || {files:[]};
    window.vetEl        = document.getElementById("vetFile")     || {files:[]};

    // UI
    window.fileStatus   = document.getElementById("fileStatus");
    window.tabDashboard = document.getElementById("tabDashboard");
    window.tabAudit     = document.getElementById("tabAudit");
    window.panelDashboard = document.getElementById("panelDashboard");
    window.panelAudit     = document.getElementById("panelAudit");

    window.chipDay      = document.getElementById("chipDay");
    window.chipShift    = document.getElementById("chipShift");
    window.chipCorners  = document.getElementById("chipCorners");
    window.chipCornerSource = document.getElementById("chipCornerSource");
    window.chipVacation = document.getElementById("chipVacation");
    window.chipBH       = document.getElementById("chipBH");
    window.chipVacationCount = document.getElementById("chipVacationCount");
    window.chipBHCount  = document.getElementById("chipBHCount");
    window.replicaTable = document.getElementById("replicaTable");
    window.auditTable   = document.getElementById("auditTable");

    // Settings
    try{
      const res = await fetch(SETTINGS_URL, {cache:"no-store"});
      SETTINGS = res.ok ? await res.json() : DEFAULT_SETTINGS;
    }catch{ SETTINGS = DEFAULT_SETTINGS; }

    // Defaults
    const today = new Date();
    dateEl.value = today.toISOString().slice(0,10);
    shiftEl.value = "Day";
    updateRibbonStatic();

    // Tabs
    tabDashboard.addEventListener("click", ()=>switchTab("dash"));
    tabAudit.addEventListener("click", ()=>switchTab("audit"));

    // Inputs
    dateEl.addEventListener("change", updateRibbonStatic);
    shiftEl.addEventListener("change", updateRibbonStatic);

    // Buttons
    processBtn.addEventListener("click", processAll);
    document.getElementById("dlNoShow").addEventListener("click", ()=> _downloadNoShow?.());
    document.getElementById("dlAuditCSV").addEventListener("click", ()=> _downloadAudit?.());
  }catch(e){
    console.error(e);
    alert(e.message);
  }
}

function switchTab(which){
  if (which==="dash"){
    panelDashboard.classList.remove("hidden");
    panelAudit.classList.add("hidden");
    tabDashboard.classList.add("active");
    tabAudit.classList.remove("active");
  }else{
    panelAudit.classList.remove("hidden");
    panelDashboard.classList.add("hidden");
    tabAudit.classList.add("active");
    tabDashboard.classList.remove("active");
  }
}

function updateRibbonStatic(){
  chipDay.textContent = new Date(dateEl.value+"T00:00:00").toLocaleDateString("en-US",{weekday:"long"});
  chipShift.textContent = shiftEl.value;
  chipCorners.textContent = ""; chipCornerSource.textContent = "";
}

// ================= HELPERS =================
const canon = s => String(s||"").trim().toLowerCase().replace(/\s+/g," ");
function normalizeId(v){
  if (v==null) return "";
  return String(v).trim().replace(/\.0$/,"").replace(/\s+/g,"").replace(/\u200b/g,"").replace(/\D/g,"").replace(/^0+/,"");
}
const presentVal = (val, markers)=> markers.includes(String(val||"").trim().toUpperCase());
const parseDateLoose = s => { const d=new Date(s); return isNaN(d)?null:d; };

function toISODate(d){
  if (!d) return null;
  const t=String(d).trim();
  const noTime=t.replace(/[T ]\d.*$/,"");
  const dt=new Date(noTime);
  if (!isNaN(dt)) return dt.toISOString().slice(0,10);
  const mdy=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const ymd=/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/;
  let m;
  if ((m=mdy.exec(noTime))){ const [,mm,dd,yyyy]=m; return new Date(`${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`).toISOString().slice(0,10); }
  if ((m=ymd.exec(noTime))){ const [,yyyy,mm,dd]=m; return new Date(`${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`).toISOString().slice(0,10); }
  return null;
}
function hoursToNumber(h){
  if (h==null) return 0;
  const s=String(h).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const m=/^(\d{1,2}):(\d{2})$/.exec(s);
  if (m){ return (+m[1]) + (+m[2]/60); }
  return parseFloat(s)||0;
}
function findKey(row, candidates){
  const keys=Object.keys(row||{});
  const wanted=candidates.map(canon);
  for (const k of keys){
    const ck=canon(k);
    if (wanted.includes(ck)) return k;
    if (wanted.includes(ck.replace(/\?/g,""))) return k;
  }
  return null;
}
function classifyEmpType(v){
  const x=canon(v);
  if (!x) return "UNKNOWN";
  if (/(amzn|amazon|blue badge|bb|fte|full time|part time|pt)\b/.test(x)) return "AMZN";
  if (/(temp|temporary|seasonal|agency|vendor|contract|white badge|wb|csg|adecco|randstad)/.test(x)) return "TEMP";
  return "UNKNOWN";
}
function classifyShift(ts){
  if (!ts) return null;
  const m = String(ts).match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  const hh=+m[1], mm=+m[2], mins=hh*60+mm;
  if (mins>=420 && mins<=1139) return "Day";   // 07:00–18:59
  if (mins>=1140 || mins<=390) return "Night"; // 19:00–06:30
  return null;
}
function parseCSVFile(file, opts={header:true, skipFirstLine:false}){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onerror=()=>reject(new Error("Failed to read file"));
    r.onload=()=>{
      let text=r.result;
      if (opts.skipFirstLine){ const i=text.indexOf("\n"); text = i>=0 ? text.slice(i+1) : text; }
      Papa.parse(text,{header:opts.header,skipEmptyLines:true,transformHeader:h=>h.trim(),complete:res=>resolve(res.data)});
    };
    r.readAsText(file);
  });
}
function downloadCSV(filename, rows){
  const headers = Object.keys(rows[0]||{id:"id",dept_bucket:"dept_bucket",emp_type:"emp_type",corner:"corner",date:"date",reason:"reason"});
  const csv=[headers.join(",")].concat(rows.map(r=>headers.map(h=>`"${String(r[h]??"").replace(/"/g,'""')}"`).join(","))).join("\n");
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

// ================= PROCESS =================
let _downloadNoShow = null;
let _downloadAudit = null;

async function processAll(){
  fileStatus.textContent = "Parsing…";
  try{
    if (!rosterEl.files[0] || !mytimeEl.files[0]) throw new Error("Upload Roster and MyTime CSVs first.");

    const [rosterRawCSV, mytimeRaw, vacRaw, swapOutRaw, swapInRaw, vetRaw] = await Promise.all([
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
    if (!cornerCodes.length){ cornerCodes = deriveCornersFromRoster(rosterRawCSV); cornerSource="derived"; }
    chipCorners.textContent = cornerCodes.join(" ");
    chipCornerSource.textContent = cornerSource==="derived" ? "(derived)" : "";

    const passesUIFilters = (row) => {
      if (!row) return false;
      if (cornerCodes && cornerCodes.length){
        const c=(row.corner||"").slice(0,2).toUpperCase();
        const ok = cornerCodes.some(cc => c === cc.slice(0,2).toUpperCase());
        if (!ok) return false;
      }
      if (newHireEl.checked && row.start instanceof Date){
        const d0=new Date(isoDate+"T00:00:00");
        const days=Math.floor((d0-row.start)/(1000*60*60*24));
        if (days < 3) return false;
      }
      return true;
    };

    // MyTime presence
    const m0 = mytimeRaw[0] || {};
    const M_ID = findKey(m0, ["Person ID","Employee ID","Person Number","ID"]);
    const M_ON = findKey(m0, ["On Premises","On Premises?","OnPremises","Premises"]);
    if (!M_ID || !M_ON) throw new Error("MyTime must include Person/Employee ID and On Premises.");
    const onPrem = new Map();
    const markers = (SETTINGS.present_markers||["X"]).map(s=>String(s).toUpperCase());
    for (const r of mytimeRaw){
      const id=normalizeId(r[M_ID]); if (!id) continue;
      const val = presentVal(r[M_ON], markers) || false;
      onPrem.set(id, (onPrem.get(id)||false) || val);
    }

    // Roster enrich
    const r0 = rosterRawCSV[0] || {};
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

    const rosterFullRows = rosterRawCSV.map(r=>{
      const id = normalizeId(r[R_ID]);
      const deptId=String(r[R_DEPT]??"").trim();
      const area=String((R_AREA? r[R_AREA]:"")??"").trim();
      const typ=classifyEmpType(r[R_TYPE]);
      const sp =String((R_SP? r[R_SP] :"")??"");
      const corner= R_COR ? String(r[R_COR]??"").trim() : first2(sp);
      const met = firstAndThird(sp);
      const start = R_HIRE ? parseDateLoose(r[R_HIRE]) : null;
      const onp = onPrem.get(id)===true;
      return {id,deptId,area,typ,corner,met,start,onp};
    });

    const fullById = new Map(rosterFullRows.map(x=>[x.id,x]));

    // filter for dashboard
    let roster = rosterFullRows.slice();
    if (cornerCodes.length) roster = roster.filter(x=>cornerCodes.some(cc => (x.corner||"").slice(0,2).toUpperCase() === cc.slice(0,2).toUpperCase()));
    if (newHireEl.checked){
      const d0 = new Date(isoDate+"T00:00:00");
      roster = roster.filter(x=> !x.start || Math.floor((d0-x.start)/(1000*60*60*24))>=3);
    }
    const byId = new Map(roster.map(x=>[x.id,x]));

    // dept helpers
    const cfg = SETTINGS.departments;
    const depts = ["Inbound","DA","ICQA","CRETs"];
    const bucketOf = x => {
      const dept=String(x.deptId||"").trim();
      const area=String(x.area||"").trim();
      if (cfg.ICQA.dept_ids.includes(dept) && area===String(cfg.ICQA.management_area_id)) return "ICQA";
      if (cfg.CRETs.dept_ids.includes(dept) && area===String(cfg.CRETs.management_area_id)) return "CRETs";
      if (cfg.DA.dept_ids.includes(dept)) return "DA";
      if (cfg.Inbound.dept_ids.includes(dept)) return "Inbound";
      return "Other";
    };
    const mkRow = () => Object.fromEntries(depts.map(d=>[d,{AMZN:0,TEMP:0,TOTAL:0}]));
    const pushCount = (ACC,row)=>{ const b=bucketOf(row); if(!depts.includes(b))return; if(row.typ==="AMZN"){ACC[b].AMZN++; ACC[b].TOTAL++;} else if(row.typ==="TEMP"){ACC[b].TEMP++; ACC[b].TOTAL++;} };
    const sumTotals = ACC => depts.reduce((s,d)=>s+ACC[d].TOTAL,0);

    // Vacation / BH
    const vacSet=new Set(), bhSet=new Set();
    if (vacRaw.length){
      const v0=vacRaw[0];
      const V_ID=findKey(v0,["Employee ID","Person ID","Person Number","Badge ID","ID"]);
      const V_DT=findKey(v0,["Date","Worked Date","Shift Date","Business Date"]);
      const V_PC=findKey(v0,["Pay Code","PayCode","Earning Code","Absence Name","Absence Type"]);
      const V_HR=findKey(v0,["Hours","Total Hours"]);
      for (const r of vacRaw){
        const id=normalizeId(r[V_ID]); if(!id)continue;
        if (toISODate(r[V_DT])!==isoDate) continue;
        const code=String(r[V_PC]||"").toLowerCase();
        const hrs=hoursToNumber(r[V_HR]);
        if (hrs>=12 && /(banked|holiday\s*bank|banked-?holiday|bh\b)/.test(code)) bhSet.add(id);
        else if (hrs>=10 && /(vac|pto)/.test(code)) vacSet.add(id);
      }
    }

    // VET / VTO (pandas-compliant)
    let vetSet=new Set(), vtoSet=new Set();
    if (vetRaw && vetRaw.length){
      const a0=vetRaw[0];
      const A_CLASS=findKey(a0,["_class","class"]);
      const A_ID=findKey(a0,["employeeId","Employee ID","Person ID"]);
      const A_TYP=findKey(a0,["opportunity.type","Opportunity Type","Type"]);
      const A_ACC=findKey(a0,["opportunity.acceptedCount","Accepted Count"]);
      const A_FLG=findKey(a0,["isAccepted"]);
      const A_S1=findKey(a0,["opportunity.shiftStart","shiftStart"]);
      const A_T1=findKey(a0,["acceptanceTime"]);
      const A_OPID=findKey(a0,["opportunity.id","opportunityId","Opportunity Id"]);
      const dateFromTs=s=>{ const m=String(s||"").trim().match(/^(\d{4}-\d{2}-\d{2})/); return m?m[1]:null; };
      const classifyType=raw=>{ const t=String(raw||"").toLowerCase(); if(t.includes("vto")||t.includes("timeoff")) return "VTO"; if(t.includes("vet")||t.includes("overtime")) return "VET"; return null; };
      const wantShift=shiftEl.value;
      const seen=new Set(); const perType={VET:new Set(), VTO:new Set()};
      for (const r of vetRaw){
        if (A_CLASS){ const cls=String(r[A_CLASS]||""); if(!/AcceptancePostingAcceptanceRecord/i.test(cls)) continue; }
        const empId=normalizeId(r[A_ID]); if(!empId)continue;
        const okAcc = (A_ACC && Number(r[A_ACC])>0) || (A_FLG && String(r[A_FLG]).trim().toLowerCase()==="true");
        if(!okAcc) continue;
        const dISO = dateFromTs(r[A_S1]) || dateFromTs(r[A_T1]); if (dISO!==isoDate) continue;
        const sType = classifyShift(r[A_S1]); if (!sType || sType!==wantShift) continue;
        const tClass = classifyType(r[A_TYP]); if(!tClass) continue;
        const rosterEntry = fullById.get(empId); if(!passesUIFilters(rosterEntry)) continue;
        const oppId = A_OPID ? (r[A_OPID]||"") : "";
        const k1=`${empId}|${dISO}|${tClass}|${oppId}`; if(seen.has(k1)) continue; seen.add(k1);
        const k2=`${empId}|${dISO}|${tClass}`; perType[tClass].add(k2);
      }
      const pairsVTO=new Set([...perType.VTO].map(k=>k.split("|").slice(0,2).join("|")));
      const pairsVET=new Set([...perType.VET].map(k=>k.split("|").slice(0,2).join("|")));
      for (const p of pairsVTO) vtoSet.add(p.split("|")[0]);
      for (const p of pairsVET) if(!pairsVTO.has(p)) vetSet.add(p.split("|")[0]);
      const normSet = s=> new Set([...s].map(normalizeId));
      vetSet=normSet(vetSet); vtoSet=normSet(vtoSet);
    }

    // Swaps
    const collectSwaps=(rows,mapping)=>{
      const out=[], inn=[]; if(!rows.length) return {out,inn};
      const s0=rows[0];
      const S_ID=findKey(s0, mapping.id || DEFAULT_SETTINGS.swap_mapping.id);
      const S_ST=findKey(s0, mapping.status || DEFAULT_SETTINGS.swap_mapping.status);
      const S_SKIP=findKey(s0, mapping.skip_date || DEFAULT_SETTINGS.swap_mapping.skip_date);
      const S_WORK=findKey(s0, mapping.work_date || DEFAULT_SETTINGS.swap_mapping.work_date);
      const APPROVED=(mapping.approved_statuses || DEFAULT_SETTINGS.swap_mapping.approved_statuses).map(s=>String(s).toUpperCase());
      for (const r of rows){
        const id=normalizeId(r[S_ID]); if(!id)continue;
        const st=String(r[S_ST]??"Approved").toUpperCase();
        const ok=!S_ST || APPROVED.includes(st) || /APPROVED|COMPLETED|ACCEPTED/.test(st);
        const skipISO=toISODate(r[S_SKIP]); const workISO=toISODate(r[S_WORK]);
        if(!ok) continue;
        if (skipISO===isoDate) out.push(id);
        if (workISO===isoDate) inn.push(id);
      }
      return {out,inn};
    };
    const mapping = SETTINGS.swap_mapping || DEFAULT_SETTINGS.swap_mapping;
    const S1=collectSwaps(swapOutRaw,mapping);
    const S2=collectSwaps(swapInRaw,mapping);
    const swapOutSet=new Set([...S1.out,...S2.out].map(normalizeId));
    const swapInSet =new Set([...S1.inn,...S2.inn].map(normalizeId));

    // ===== Build cohorts (Option A: use fullById for exclusions) =====
    const excluded=new Set();
    for (const id of vacSet)     if (fullById.has(id)) excluded.add(id);
    for (const id of bhSet)      if (fullById.has(id) && !excluded.has(id)) excluded.add(id);
    for (const id of vtoSet)     if (fullById.has(id) && !excluded.has(id)) excluded.add(id);
    for (const id of swapOutSet) if (fullById.has(id) && !excluded.has(id)) excluded.add(id);

    const cohortExpected = roster.filter(x=>!excluded.has(x.id));
    const cohortPresentExSwaps = cohortExpected.filter(x=>x.onp);

    // Display rows
    const swapOutRows        = [...swapOutSet].map(id=>fullById.get(id)).filter(Boolean).filter(passesUIFilters);
    const swapInExpectedRows = [...swapInSet].map(id=>fullById.get(id)).filter(Boolean).filter(passesUIFilters);
    const swapInPresentRows  = swapInExpectedRows.filter(x=>onPrem.get(x.id)===true);
    const vetExpectedRows    = [...vetSet].map(id=>fullById.get(id)).filter(Boolean).filter(passesUIFilters);
    const vetPresentRows     = vetExpectedRows.filter(x=>onPrem.get(x.id)===true);

    // ===== Dashboard table =====
    const row_RegularExpected   = mkRow(); cohortExpected.forEach(x=>pushCount(row_RegularExpected,x));
    const row_RegularPresentExS = mkRow(); cohortPresentExSwaps.forEach(x=>pushCount(row_RegularPresentExS,x));
    const row_SwapOut           = mkRow(); swapOutRows.forEach(x=>pushCount(row_SwapOut,x));
    const row_SwapInExpected    = mkRow(); swapInExpectedRows.forEach(x=>pushCount(row_SwapInExpected,x));
    const row_SwapInPresent     = mkRow(); swapInPresentRows.forEach(x=>pushCount(row_SwapInPresent,x));
    const row_VTO               = mkRow(); [...vtoSet].map(id=>fullById.get(id)).filter(Boolean).filter(passesUIFilters).forEach(x=>pushCount(row_VTO,x));
    const row_VETExpected       = mkRow(); vetExpectedRows.forEach(x=>pushCount(row_VETExpected,x));
    const row_VETPresent        = mkRow(); vetPresentRows.forEach(x=>pushCount(row_VETPresent,x));

    const depts=["Inbound","DA","ICQA","CRETs"];
    const header = `
      <thead>
        <tr>
          <th>Attendance Details</th>
          ${depts.map(d=>`<th>${d} AMZN</th><th>${d} TEMP</th>`).join("")}
          <th>Total</th>
        </tr>
      </thead>`;
    const rowHTML=(label,ACC)=>{ const cells=depts.map(d=>`<td>${ACC[d].AMZN}</td><td>${ACC[d].TEMP}</td>`).join(""); const total=sumTotals(ACC); return `<tr><td>${label}</td>${cells}<td>${total}</td></tr>`; };
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

    // Ribbon chips & CSV links
    const vacRows=[...vacSet].map(id=>fullById.get(id)).filter(Boolean).filter(passesUIFilters).map(x=>({id:x.id,dept_bucket:bucketOf(x),emp_type:x.typ,corner:x.corner,date:isoDate,reason:"Vacation"}));
    const bhRows =[...bhSet].map(id=>fullById.get(id)).filter(Boolean).filter(passesUIFilters).map(x=>({id:x.id,dept_bucket:bucketOf(x),emp_type:x.typ,corner:x.corner,date:isoDate,reason:"Banked Holiday"}));
    chipVacationCount.textContent = vacRows.length;
    chipBHCount.textContent = bhRows.length;
    const buildURL = rows => {
      const headers=["id","dept_bucket","emp_type","corner","date","reason"];
      const csv=[headers.join(",")].concat(rows.map(r=>headers.map(h=>`"${String(r[h]??"").replace(/"/g,'""')}"`).join(","))).join("\n");
      return URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    };
    chipVacation.href = buildURL(vacRows.length?vacRows:[{id:"",dept_bucket:"",emp_type:"",corner:"",date:isoDate,reason:"Vacation"}]);
    chipBH.href       = buildURL(bhRows.length?bhRows:[{id:"",dept_bucket:"",emp_type:"",corner:"",date:isoDate,reason:"Banked Holiday"}]);

    // No-show CSV & Audit CSV (stable functions; buttons are static in your HTML)
    const noShows = cohortExpected.filter(x=>!x.onp).map(x=>({id:x.id,dept_bucket:bucketOf(x),emp_type:x.typ,corner:x.corner,date:isoDate,reason:"No-Show"}));
    _downloadNoShow = ()=> downloadCSV(`no_shows_${isoDate}.csv`, noShows.length?noShows:[{id:"",dept_bucket:"",emp_type:"",corner:"",date:isoDate,reason:"No-Show"}]);

    // ===== Audit table =====
    const reasonOf=new Map();
    const tag=(ids,reason)=>{ for(const id of ids){ const x=fullById.get(id); if(x && passesUIFilters(x) && !reasonOf.has(id)) reasonOf.set(id,reason); } };

    tag(vacSet,"Vacation / PTO");
    tag(bhSet,"Banked Holiday");
    tag(vtoSet,"VTO accepted");
    tag(swapOutSet,"Swap-Out");

    for(const x of vetExpectedRows){ if(onPrem.get(x.id)!==true && !reasonOf.has(x.id)) reasonOf.set(x.id,"VET accepted but not shown"); }
    for(const x of cohortExpected){ if(x.onp!==true && !reasonOf.has(x.id)) reasonOf.set(x.id,"No-Show (plain)"); }

    const auditReasons=["Vacation / PTO","Banked Holiday","VTO accepted","Swap-Out","VET accepted but not shown","No-Show (plain)"];
    const auditCounts=Object.fromEntries(auditReasons.map(r=>[r,mkRow()]));
    for (const [id,reason] of reasonOf.entries()){ const row=byId.get(id)||fullById.get(id); if(row) pushCount(auditCounts[reason],row); }

    const auditHeader=`
      <thead>
        <tr>
          <th>Absence Reason</th>
          ${depts.map(d=>`<th>${d} AMZN</th><th>${d} TEMP</th>`).join("")}
          <th>Total</th>
        </tr>
      </thead>`;
    const auditBody=auditReasons.map(label=>{
      const ACC=auditCounts[label];
      const cells=depts.map(d=>`<td>${ACC[d].AMZN}</td><td>${ACC[d].TEMP}</td>`).join("");
      const total=sumTotals(ACC);
      return `<tr><td>${label}</td>${cells}<td>${total}</td></tr>`;
    }).join("");
    auditTable.innerHTML = auditHeader + "<tbody>" + auditBody + "</tbody>";

    const auditRows=[]; for(const [id,reason] of reasonOf.entries()){ const x=byId.get(id)||fullById.get(id); if(x) auditRows.push({id:x.id,dept_bucket:bucketOf(x),emp_type:x.typ,corner:x.corner,date:isoDate,reason}); }
    _downloadAudit = ()=> downloadCSV(`audit_${isoDate}.csv`, auditRows.length?auditRows:[{id:"",dept_bucket:"",emp_type:"",corner:"",date:isoDate,reason:""}]);

    fileStatus.textContent = "Done";
  }catch(e){
    console.error(e);
    fileStatus.textContent="Error";
    alert(e.message || "Processing failed");
  }
}
