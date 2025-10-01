/* =========================================================
   PXT Attendance Dashboard — app.js (surgical VET/VTO + swap fix)
   ========================================================= */

/* ---------- SETTINGS ---------- */
const SETTINGS_URL = "./settings.json";
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
    id: ["Employee 1 ID","Employee ID","Person ID","Person Number","Badge ID","ID","Associate ID","EID"],
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

/* ---------- BOOT ---------- */
(async function boot(){
  try {
    const r = await fetch(SETTINGS_URL, { cache: "no-store" });
    SETTINGS = r.ok ? await r.json() : DEFAULT_SETTINGS;
  } catch {
    SETTINGS = DEFAULT_SETTINGS;
  }

  // tabs
  tabDash?.addEventListener("click",()=>setTab("dash"));
  tabAudit?.addEventListener("click",()=>setTab("audit"));

  // defaults
  if (!dateEl.value) dateEl.value = new Date().toISOString().slice(0,10);
  chipDay.textContent = new Date(dateEl.value+"T00:00:00").toLocaleDateString("en-US",{weekday:"long"});
  chipShift.textContent = shiftEl.value || "Day";

  dateEl.addEventListener("change", () => {
    chipDay.textContent = new Date(dateEl.value+"T00:00:00").toLocaleDateString("en-US",{weekday:"long"});
  });
  shiftEl.addEventListener("change", () => {
    chipShift.textContent = shiftEl.value || "Day";
  });

  processBtn.addEventListener("click", processAll);
})();

function setTab(which){
  const dash = which==="dash";
  tabDash.classList.toggle("active", dash);
  tabAudit.classList.toggle("active", !dash);
  panelDash.classList.toggle("hidden", !dash);
  panelAudit.classList.toggle("hidden", dash);
}

/* ---------- HELPERS ---------- */
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
  // mm/dd/yyyy
  let m = /^(?:(\d{1,2})\/(\d{1,2})\/(\d{4}))$/.exec(t);
  if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  // yyyy-mm-dd or yyyy/mm/dd
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

// Accept both ISO (yyyy-mm-dd) and legacy (yyyy/mm/dd) date strings
function dateMatches(val, iso){
  const isoFromVal = toISODate(val);
  if (isoFromVal && isoFromVal === iso) return true;
  const legacy = iso.replace(/-/g,"/");
  return String(val||"").trim() === legacy;
}

/* ---------- CORE ---------- */
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

    // Corners
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
    const myOnPrem = new Set();
    if (mytimeRaw.length){
      const m0 = mytimeRaw[0] || {};
      const M_ID  = firstKey(m0, ["Employee ID","Person ID","Person Number","Badge ID","ID","EID"]);
      const M_ONP = firstKey(m0, ["On Premise","On-Premise","OnPremise","On Site","OnSite","On Prem","On Premises","On Premises?","OnPremises"]);
      const markers = SETTINGS.present_markers || DEFAULT_SETTINGS.present_markers;
      if (M_ID && M_ONP){
        for (const r of mytimeRaw){
          const id = normalizeId(r[M_ID]); if (!id) continue;
          if (presentVal(r[M_ONP], markers)) myOnPrem.add(id);
        }
      }
    }

    /* ---- Roster (never used for presence) ---- */
    const r0 = rosterRaw[0] || {};
    const R_ID   = findKey(r0,["Employee ID","Person ID","Person Number","Badge ID","ID"]);
    const R_TYP  = findKey(r0,["Employment Type","EmploymentType","Type","Associate Type","Worker Type","Company"]);
    const R_DEPT = findKey(r0,["Department ID","Department","Dept ID","Dept","Home Department ID"]);
    const R_AREA = findKey(r0,["Management Area ID","Area ID","Area","Mgmt Area ID"]);
    const R_COR  = findKey(r0,["Corner","Corner Code","CornerName","Corner ID"]);
    const R_SP   = findKey(r0,["Shift Pattern","Schedule Pattern","Shift"]);
    const R_START= findKey(r0,["Employment Start Date","Hire Date","Start Date"]);
    if (!R_ID || !R_TYP || !R_DEPT) throw new Error("Roster missing required columns (ID, Employment Type, Department).");

    const cornerFromSP = sp => (sp ? String(sp).slice(0,2) : "");
    let roster = rosterRaw.map(r=>{
      const id = normalizeId(r[R_ID]);
      const onp = myOnPrem.has(id); // presence only from MyTime
      return {
        id,
        onp,
        typ: /TEMP|AGENCY|VENDOR|CONTRACT/i.test(String(r[R_TYP]||"")) ? "TEMP" : "AMZN",
        deptId: String(r[R_DEPT]||"").trim(),
        area: String(r[R_AREA]||"").trim(),
        corner: String(r[R_COR]||"").trim() || cornerFromSP(r[R_SP]),
        start: r[R_START] ? new Date(r[R_START]) : null
      };
    }).filter(x=>x.id);

    // Corner filter (if codes set)
    if (cornerCodes.length){
      roster = roster.filter(x => cornerCodes.includes(x.corner));
    }

    // Exclude new hires (<3 days) if toggled
    if (newHireEl.checked){
      const date0 = new Date(isoDate+"T00:00:00");
      roster = roster.filter(x=>{
        if (!x.start || isNaN(x.start)) return true;
        const days = Math.floor((date0 - x.start)/86400000);
        return days >= 3;
      });
    }

    const byId = new Map(roster.map(x=>[x.id,x]));

    // Dept buckets
    const cfg = SETTINGS.departments;
    const DA_IDS = cfg.DA.dept_ids;
    const isInbound = x => cfg.Inbound.dept_ids.includes(x.deptId) && !DA_IDS.includes(x.deptId);
    const isDA      = x => DA_IDS.includes(x.deptId);
    const isICQA    = x => cfg.ICQA.dept_ids.includes(x.deptId) && x.area===cfg.ICQA.management_area_id;
    const isCRETs   = x => cfg.CRETs.dept_ids.includes(x.deptId) && x.area===cfg.CRETs.management_area_id;
    const bucketOf  = x => isInbound(x) ? "Inbound" : isDA(x) ? "DA" : isICQA(x) ? "ICQA" : isCRETs(x) ? "CRETs" : null;
    const depts = ["Inbound","DA","ICQA","CRETs"];
    const mkRow = () => Object.fromEntries(depts.map(d=>[d,{AMZN:0,TEMP:0,TOTAL:0}]));
    const bump = (A,x)=>{ const b=bucketOf(x); if(!b) return; A[b][x.typ]++; A[b].TOTAL++; };
    const fold = rows => { const A = mkRow(); rows.forEach(x=>bump(A,x)); return A; };
    const sumTotals = A => depts.reduce((s,d)=>s+(A[d]?.TOTAL||0),0);

    /* ---- Vacation / BH (use your thresholds & codes) ---- */
    const vacSet = new Set(), bhSet = new Set();
    if (vacRaw.length){
      const v0 = vacRaw[0] || {};
      const V_ID = findKey(v0, ["Employee ID","Person ID","Person Number","Badge ID","ID"]);
      const V_H  = findKey(v0, ["Hours","Payable Hours","Total Hours","Duration"]);
      const V_C  = findKey(v0, ["Comment","Pay Code","Description","Pay Reason","Absence Name"]);
      const V_D  = findKey(v0, ["Date","Worked Date","Shift Date","Business Date","Transaction Date","Posting Date"]);
      for (const r of vacRaw){
        const id = normalizeId(r[V_ID]); if (!id) continue;
        const dtISO = toISODate(r[V_D]); if (dtISO !== isoDate) continue;
        const hours = parseFloat(String(r[V_H]||"0").replace(/[^\d.]/g,"")) || 0;
        const codeU = String(r[V_C]||"").toUpperCase();
        if (hours>=12 && /BANKED|HOLIDAY/.test(codeU)) bhSet.add(id);
        else if (hours>=10 && /VAC|PTO|VACATION/.test(codeU)) vacSet.add(id);
      }
    }
    chipVacationCount.textContent = vacSet.size;
    chipBHCount.textContent = bhSet.size;
    chipVacation.onclick = (e)=>{ e.preventDefault(); if (!vacSet.size) return; downloadCSV("vacation_excluded.csv",[...vacSet].map(id=>({id}))); };
    chipBH.onclick = (e)=>{ e.preventDefault(); if (!bhSet.size) return; downloadCSV("banked_holiday_excluded.csv",[...bhSet].map(id=>({id}))); };

    /* ---- VET/VTO — FIXED (only change) ---- */
    const vetSet = new Set(), vtoSet = new Set();
    if (vetRaw.length){
      const v0 = vetRaw[0] || {};
      const K_ID    = firstKey(v0, ["employeeId","Employee ID","Person ID","Person Number","Badge ID","ID","EID"]);
      const K_TYPE  = firstKey(v0, ["opportunity.type","Opportunity Type","Type"]);
      const K_ACC   = firstKey(v0, ["opportunity.acceptedCount","Accepted Count","Accepted"]);
      const K_FLAG  = firstKey(v0, ["isAccepted"]);
      const K_T1    = firstKey(v0, ["acceptanceTime"]);
      const K_T2    = firstKey(v0, ["opportunityCreatedAt","opportunity.createdAt"]);
      const K_T3    = firstKey(v0, ["opportunity.postedDate","postedDate","Posting Date"]);
      const K_TFALL = firstKey(v0, ["Shift Date","Date","opportunity.date"]);

      for (const r of vetRaw){
        const id = normalizeId(r[K_ID]); if (!id) continue;

        // accepted?
        const accCountOk = K_ACC ? (String(r[K_ACC]).trim()==="1" || r[K_ACC]===1) : false;
        const accFlagOk  = K_FLAG ? String(r[K_FLAG]).trim().toLowerCase()==="true" : false;
        if (!(accCountOk || accFlagOk)) continue;

        // date priority
        const dISO = toISODate(r[K_T1]) || toISODate(r[K_T2]) || toISODate(r[K_T3]) || toISODate(r[K_TFALL]);
        if (dISO !== isoDate) continue;

        const typ = String(r[K_TYPE]||"").toUpperCase();
        if (typ.includes("VTO")) vtoSet.add(id);
        else if (typ.includes("VET")) vetSet.add(id);
      }
    }

    /* ---- Swaps (only date-matching changed) ---- */
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
        const st = String(r[S_ST] ?? "Approved").toUpperCase();
        const ok = !S_ST || APPROVED.includes(st) || /APPROVED|COMPLETED|ACCEPTED/.test(st);
        if (!ok) continue;
        if (dateMatches(r[S_SKIP], isoDate)) OUT.push(id);
        if (dateMatches(r[S_WORK], isoDate)) IN.push(id);
      }
      return {out:OUT, inn:IN};
    }
    const mapping = SETTINGS.swap_mapping || DEFAULT_SETTINGS.swap_mapping;
    const S1 = collectSwaps(swapOutRaw, mapping);
    const S2 = collectSwaps(swapInRaw,  mapping);
    const swapOutSet = new Set([...S1.out, ...S2.out]);
    const swapInSet  = new Set([...S1.inn, ...S2.inn]);

    /* ---- Cohorts (unchanged) ----
       Exclude: Vacation > Banked Holiday > VTO > Swap-Out from EXPECTED. */
    const excluded = new Set();
    for (const id of vacSet) if (byId.has(id)) excluded.add(id);
    for (const id of bhSet)  if (byId.has(id) && !excluded.has(id)) excluded.add(id);
    for (const id of vtoSet) if (byId.has(id) && !excluded.has(id)) excluded.add(id);
    for (const id of swapOutSet) if (byId.has(id) && !excluded.has(id)) excluded.add(id);

    const cohortExpected         = roster.filter(x=>!excluded.has(x.id));
    const cohortPresentExSwaps   = cohortExpected.filter(x=>x.onp);

    // Rows for display
    const swapOutRows            = [...swapOutSet].map(id=>byId.get(id)).filter(Boolean);
    const swapInExpectedRows     = [...swapInSet].map(id=>byId.get(id)).filter(Boolean);
    const swapInPresentRows      = swapInExpectedRows.filter(x=>x.onp);

    const vetExpectedRows        = [...vetSet].map(id=>byId.get(id)).filter(Boolean);
    const vetPresentRows         = vetExpectedRows.filter(x=>x.onp);

    const row_RegularExpected    = fold(cohortExpected);
    const row_RegularPresentExS  = fold(cohortPresentExSwaps);
    const row_SwapOut            = fold(swapOutRows);
    const row_SwapInExpected     = fold(swapInExpectedRows);
    const row_SwapInPresent      = fold(swapInPresentRows);
    const row_VTO                = fold([...vtoSet].map(id=>byId.get(id)).filter(Boolean));
    const row_VETExpected        = fold(vetExpectedRows);
    const row_VETPresent         = fold(vetPresentRows);

    /* ---- Render (exactly your structure; no extra rows) ---- */
    const header = `<thead>
      <tr>
        <th>Attendance Details</th>
        ${depts.map(d=>`<th>${d} AMZN</th><th>${d} TEMP</th>`).join("")}
        <th>Day 1 HC</th>
      </tr>
    </thead>`;

    const rowHTML = (label, ACC)=>{
      const cells = depts.map(d=>`<td>${ACC[d].AMZN}</td><td>${ACC[d].TEMP}</td>`).join("");
      const total = sumTotals(ACC);
      return `<tr><td>${label}</td>${cells}<td>${total}</td></tr>`;
    };

    // Regular Attendance % row content (per your UI)
    const pctParts = depts.map(d=>{
      const exp = row_RegularExpected[d].TOTAL || 0;
      const pre = row_RegularPresentExS[d].TOTAL || 0;
      const pct = exp ? (100*pre/exp) : 0;
      return `${pct.toFixed(2)}%`;
    }).join(" / ");
    const pctRow = `<tr><td>Regular Attendance %</td>${depts.map(d=>`<td>${row_RegularPresentExS[d].AMZN}</td><td>${row_RegularPresentExS[d].TEMP}</td>`).join("")}<td>${pctParts}</td></tr>`;

    replicaTable.innerHTML = header + "<tbody>"
      + rowHTML("Regular HC (Cohort Expected)", row_RegularExpected)
      + rowHTML("Regular HC Present (Excluding Swaps)", row_RegularPresentExS)
      + rowHTML("Shift Swap Out", row_SwapOut)
      + rowHTML("Shift Swap Expected", row_SwapInExpected)
      + rowHTML("Shift Swap Present", row_SwapInPresent)
      + pctRow
      + rowHTML("VTO", row_VTO)
      + rowHTML("VET Accepted", row_VETExpected)
      + rowHTML("VET Present", row_VETPresent)
      + "</tbody>";

    fileStatus.textContent = "Done";
  }catch(e){
    console.error(e);
    fileStatus.textContent = e.message || "Error";
    alert(e.message || "Failed to process files. Check console for details.");
  }
}

/* ---------- CSV export helper (used by chips) ---------- */
function downloadCSV(filename, rows){
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
