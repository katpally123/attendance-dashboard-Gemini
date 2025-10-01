/* =========================================================
   PXT Attendance Dashboard — app.js
   ========================================================= */

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
function unique(list){ return [...new Set(list)]; }
function presentBool(val){
  const s = String(val||"").trim().toUpperCase();
  return ["Y","YES","TRUE","1","X","P","PRESENT"].includes(s);
}
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

    /* ---- MyTime presence ---- */
    const m0 = mytimeRaw[0] || {};
    const M_ID  = findKey(m0, ["Employee ID","Person ID","Person Number","Badge ID","ID","EID"]);
    const M_ONP = findKey(m0, ["On Premise","On-Premise","OnPremise","On Premises","On Premises?","On Site","OnSite"]);
    const myOnPrem = new Set();
    if (M_ID && M_ONP){
      for (const r of mytimeRaw){
        const id = normalizeId(r[M_ID]); if (!id) continue;
        if (presentBool(r[M_ONP])) myOnPrem.add(id);
      }
    }

    /* ---- Roster ---- */
    const r0 = rosterRaw[0] || {};
    const R_ID   = findKey(r0,["Employee ID","Person ID","Person Number","Badge ID","ID"]);
    const R_TYP  = findKey(r0,["Employment Type","EmploymentType","Type"]);
    const R_DEPT = findKey(r0,["Department ID","Department","Dept ID"]);
    const R_AREA = findKey(r0,["Management Area ID","Area ID"]);
    const R_COR  = findKey(r0,["Corner","Corner Code"]);
    const R_SP   = findKey(r0,["Shift Pattern","Schedule Pattern","Shift"]);
    const R_START= findKey(r0,["Employment Start Date","Hire Date","Start Date"]);
    if (!R_ID || !R_TYP || !R_DEPT) throw new Error("Roster missing required columns.");

    let roster = rosterRaw.map(r=>{
      const id = normalizeId(r[R_ID]);
      return {
        id,
        onp: myOnPrem.has(id),
        typ: /TEMP|AGENCY|VENDOR|CONTRACT/i.test(String(r[R_TYP]||"")) ? "TEMP" : "AMZN",
        deptId: String(r[R_DEPT]||"").trim(),
        area: String(r[R_AREA]||"").trim(),
        corner: String(r[R_COR]||"").trim() || String(r[R_SP]||"").slice(0,2),
        start: r[R_START] ? new Date(r[R_START]) : null
      };
    }).filter(x=>x.id);

    const byId = new Map(roster.map(x=>[x.id,x]));

    /* ---- Vacation / BH ---- */
    const vacSet = new Set(), bhSet = new Set();
    if (vacRaw.length){
      const v0 = vacRaw[0] || {};
      const V_ID = findKey(v0, ["Employee ID","Person ID","Person Number","Badge ID","ID"]);
      const V_H  = findKey(v0, ["Hours","Total Hours"]);
      const V_C  = findKey(v0, ["Pay Code","Description","Absence Name"]);
      const V_D  = findKey(v0, ["Date","Shift Date","Business Date"]);
      for (const r of vacRaw){
        const id = normalizeId(r[V_ID]); if (!id) continue;
        const dt = toISODate(r[V_D]); if (dt !== isoDate) continue;
        const hrs = parseFloat(r[V_H])||0;
        const code = String(r[V_C]||"").toUpperCase();
        if (hrs>=12 && /BANKED|HOLIDAY/.test(code)) bhSet.add(id);
        else if (hrs>=10 && /VAC|PTO/.test(code)) vacSet.add(id);
      }
    }

    /* ---- VET/VTO (fixed for your headers) ---- */
    const vetSet = new Set(), vtoSet = new Set();
    if (vetRaw.length){
      const a0 = vetRaw[0];
      const A_ID   = findKey(a0, ["employeeId","Employee ID"]);
      const A_TYP  = findKey(a0, ["opportunity.type","Opportunity Type","Type"]);
      const A_ACC  = findKey(a0, ["opportunity.acceptedCount","Accepted Count"]);
      const A_FLAG = findKey(a0, ["isAccepted"]);
      const A_T1   = findKey(a0, ["acceptanceTime"]);
      const A_T2   = findKey(a0, ["opportunityCreatedAt"]);

      for (const r of vetRaw){
        const id = normalizeId(r[A_ID]); if (!id) continue;
        const accCountOk = A_ACC ? (String(r[A_ACC]).trim()==="1" || r[A_ACC]===1) : false;
        const accFlagOk  = A_FLAG ? String(r[A_FLAG]).trim().toLowerCase()==="true" : false;
        if (!(accCountOk || accFlagOk)) continue;

        const dISO = toISODate(r[A_T1]) || toISODate(r[A_T2]);
        if (dISO !== isoDate) continue;

        const typ = String(r[A_TYP]||"").toUpperCase();
        if (typ.includes("VTO")) vtoSet.add(id);
        else if (typ.includes("VET")) vetSet.add(id);
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

    /* ---- Build rows ---- */
    const depts = ["Inbound","DA","ICQA","CRETs"];
    const mkRow = () => Object.fromEntries(depts.map(d=>[d,{AMZN:0,TEMP:0,TOTAL:0}]));
    const bump = (A,x)=>{ const b=deptBucket(x); if(!b) return; A[b][x.typ]++; A[b].TOTAL++; };
    const fold = rows => { const A = mkRow(); rows.forEach(x=>bump(A,x)); return A; };
    const deptBucket = x=>{
      if (SETTINGS.departments.Inbound.dept_ids.includes(x.deptId) && !SETTINGS.departments.DA.dept_ids.includes(x.deptId)) return "Inbound";
      if (SETTINGS.departments.DA.dept_ids.includes(x.deptId)) return "DA";
      if (SETTINGS.departments.ICQA.dept_ids.includes(x.deptId) && x.area===SETTINGS.departments.ICQA.management_area_id) return "ICQA";
      if (SETTINGS.departments.CRETs.dept_ids.includes(x.deptId) && x.area===SETTINGS.departments.CRETs.management_area_id) return "CRETs";
      return null;
    };

    const excluded = new Set([...vacSet,...bhSet,...vtoSet,...swapOutSet]);
    const cohortExpected = roster.filter(x=>!excluded.has(x.id));
    const cohortPresentExSwaps = cohortExpected.filter(x=>x.onp);

    const swapOutRows = [...swapOutSet].map(id=>byId.get(id)).filter(Boolean);
    const swapInExpectedRows = [...swapInSet].map(id=>byId.get(id)).filter(Boolean);
    const swapInPresentRows  = swapInExpectedRows.filter(x=>x.onp);

    const vetExpectedRows = [...vetSet].map(id=>byId.get(id)).filter(Boolean);
    const vetPresentRows  = vetExpectedRows.filter(x=>x.onp);

    const row_RegularExpected   = fold(cohortExpected);
    const row_RegularPresentExS = fold(cohortPresentExSwaps);
    const row_SwapOut           = fold(swapOutRows);
    const row_SwapInExpected    = fold(swapInExpectedRows);
    const row_SwapInPresent     = fold(swapInPresentRows);
    const row_VTO               = fold([...vtoSet].map(id=>byId.get(id)).filter(Boolean));
    const row_VETExpected       = fold(vetExpectedRows);
    const row_VETPresent        = fold(vetPresentRows);

    /* ---- Render ---- */
    const header = `<thead>
      <tr>
        <th>Attendance Details</th>
        ${depts.map(d=>`<th>${d} AMZN</th><th>${d} TEMP</th>`).join("")}
        <th>Day 1 HC</th>
      </tr>
    </thead>`;
    const rowHTML = (label, ACC)=>{
      const cells = depts.map(d=>`<td>${ACC[d].AMZN}</td><td>${ACC[d].TEMP}</td>`).join("");
      const total = depts.reduce((s,d)=>s+(ACC[d]?.TOTAL||0),0);
      return `<tr><td>${label}</td>${cells}<td>${total}</td></tr>`;
    };

    replicaTable.innerHTML = header + "<tbody>"
      + rowHTML("Regular HC (Cohort Expected)", row_RegularExpected)
      + rowHTML("Regular HC Present (Excluding Swaps)", row_RegularPresentExS)
      + rowHTML("Shift Swap Out", row_SwapOut)
      + rowHTML("Shift Swap Expected", row_SwapInExpected)
      + rowHTML("Shift Swap Present", row_SwapInPresent)
      + rowHTML("VTO", row_VTO)
      + rowHTML("VET Accepted", row_VETExpected)
      + rowHTML("VET Present", row_VETPresent)
      + "</tbody>";

    fileStatus.textContent = "Done";
  }catch(e){
    console.error(e);
    fileStatus.textContent = e.message || "Error";
    alert(e.message || "Failed to process files.");
  }
}
