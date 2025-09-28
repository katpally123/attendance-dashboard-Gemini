// ====== CONFIG ======
const SETTINGS_URL = new URL("settings.json", document.baseURI).href + "?v=" + Date.now();

const DEFAULT_SETTINGS = {
  departments: {
    Inbound: { dept_ids: ["1211010","1211020","1299010","1299020"] },
    DA:      { dept_ids: ["1211030","1211040","1299030","1299040"] },
    ICQA:    { dept_ids: ["1299070","1211070"], management_area_id: "27" },
    CRETs:   { dept_ids: ["1299070","1211070"], management_area_id: "22" }
  },
  shift_schedule: { Day:{}, Night:{} },
  present_markers: ["X","Y","YES","TRUE","1"],
  swap_mapping: {
    id: ["Employee 1 ID","Employee ID","Person ID","Person Number","Badge ID","ID","Associate ID"],
    status: ["Status","Swap Status"],
    skip_date: ["Date to Skip","Skip Date","Skip"],
    work_date: ["Date to Work","Work Date","Work"],
    approved_statuses: ["Approved","Completed","Accepted"]
  }
};

// ====== STATE / ELEMS ======
let SETTINGS = null;

const dateEl   = document.getElementById("dateInput");
const shiftEl  = document.getElementById("shiftInput");
const newHireEl= document.getElementById("excludeNewHires");

const rosterEl = document.getElementById("rosterFile");
const mytimeEl = document.getElementById("mytimeFile");
const vacEl    = document.getElementById("vacFile");
const swapOutEl= document.getElementById("swapOutFile");
const swapInEl = document.getElementById("swapInFile");
const vetEl    = document.getElementById("vetFile");

const codesEl  = document.getElementById("codesEl");
const processBtn = document.getElementById("processBtn");
const fileStatus = document.getElementById("fileStatus");
const noShowBtn  = document.getElementById("dlNoShow");

const vacNote = document.getElementById("vacNote");
const vacCSV  = document.getElementById("vacCSV");

const replicaTable = document.getElementById("replicaTable");

// ====== BOOT ======
(async function boot(){
  try {
    const r = await fetch(SETTINGS_URL, { cache: "no-store" });
    SETTINGS = r.ok ? await r.json() : DEFAULT_SETTINGS;
  } catch { SETTINGS = DEFAULT_SETTINGS; }
  initUI();
})();

window.addEventListener("error", ev=>{
  fileStatus.textContent = "JS error: " + (ev.message || "See console");
  alert(fileStatus.textContent);
});

// ====== UI ======
function initUI(){
  const today = new Date();
  dateEl.value = today.toISOString().slice(0,10);
  shiftEl.value = "Day";
  renderShiftCodes();
  dateEl.addEventListener("change", renderShiftCodes);
  shiftEl.addEventListener("change", renderShiftCodes);
}

function toDayName(iso){ if(!iso) return "Monday"; return new Date(iso+"T00:00:00").toLocaleDateString("en-US",{weekday:"long"}); }
function renderShiftCodes(){
  const day = toDayName(dateEl.value);
  const shift = shiftEl.value;
  const codes = SETTINGS.shift_schedule?.[shift]?.[day] || [];
  codesEl.innerHTML = codes.map(c=>`<code>${c}</code>`).join(" ");
}

// ====== HELPERS ======
const canon = s => String(s||"").trim().toLowerCase().replace(/\s+/g," ");
const normalizeId = v => {
  const t = String(v??"").trim(); const d=t.replace(/\D/g,""); const noLead=d.replace(/^0+/,"");
  return noLead || t;
};
const parseDateLoose = s => { const d = new Date(s); return isNaN(d) ? null : d; };
const presentVal = (val, markers) => markers.includes(String(val||"").trim().toUpperCase());
function findKey(row, candidates){
  const keys = Object.keys(row||{});
  const wanted = candidates.map(canon);
  for (const k of keys){
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
// Robust "to ISO date" normalizer
const toISODate = (d) => {
  if (!d) return null;
  const t = String(d).trim();
  const noTime = t.replace(/[T ]\d.*$/, "");
  const dt = new Date(noTime);
  if (!isNaN(dt)) return dt.toISOString().slice(0,10);
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const ymd = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/;
  let m;
  if ((m = mdy.exec(noTime))) {
    const [_, mm, dd, yyyy] = m;
    return new Date(`${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`).toISOString().slice(0,10);
  }
  if ((m = ymd.exec(noTime))) {
    const [_, yyyy, mm, dd] = m;
    return new Date(`${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`).toISOString().slice(0,10);
  }
  return null;
};
// Derive corners from Roster when settings.json doesn’t provide any
function deriveCornersFromRoster(rows){
  if (!rows || !rows.length) return [];
  const r0 = rows[0] || {};
  const R_COR = findKey(r0, ["Corner","Corner Code"]);
  const R_SP  = findKey(r0, ["Shift Pattern","Schedule Pattern","Shift"]);
  const set = new Set();
  for (const r of rows){
    const sp = String(r[R_SP] ?? "");
    const corner = R_COR ? String(r[R_COR] ?? "").trim() : (sp ? sp.slice(0,2) : "");
    if (corner) set.add(corner);
  }
  return Array.from(set);
}

function parseCSVFile(file, opts={header:true, skipFirstLine:false}){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error("Failed to read file"));
    reader.onload = ()=>{
      let text = reader.result;
      if (opts.skipFirstLine){
        const i = text.indexOf("\n"); text = i>=0 ? text.slice(i+1) : text;
      }
      Papa.parse(text, { header: opts.header, skipEmptyLines: true, transformHeader: h=>h.trim(), complete: res=>resolve(res.data) });
    };
    reader.readAsText(file);
  });
}

function downloadCSV(filename, rows){
  const csv = [Object.keys(rows[0]||{id:"EmployeeID"}).join(",")]
    .concat(rows.map(r => Object.values(r).map(v => `"${String(v??"").replace(/"/g,'""')}"`).join(",")))
    .join("\n");
  const blob = new Blob([csv], {type: "text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
}

// ====== PROCESS ======
processBtn.addEventListener("click", async ()=>{
  fileStatus.textContent = "Parsing…";
  try {
    if (!rosterEl.files[0] || !mytimeEl.files[0]) throw new Error("Upload Roster and MyTime CSVs.");

    const [rosterRaw, mytimeRaw, vacRaw, swapOutRaw, swapInRaw, vetRaw] = await Promise.all([
      parseCSVFile(rosterEl.files[0], {header:true}),
      parseCSVFile(mytimeEl.files[0], {header:true, skipFirstLine:true}),
      vacEl.files[0]     ? parseCSVFile(vacEl.files[0], {header:true})     : Promise.resolve([]),
      swapOutEl.files[0] ? parseCSVFile(swapOutEl.files[0], {header:true}) : Promise.resolve([]),
      swapInEl.files[0]  ? parseCSVFile(swapInEl.files[0],  {header:true}) : Promise.resolve([]),
      vetEl.files[0]     ? parseCSVFile(vetEl.files[0],     {header:true}) : Promise.resolve([]),
    ]);

    const isoDate = dateEl.value;
    const dayName = toDayName(isoDate);
    let cornerCodes = SETTINGS.shift_schedule?.[shiftEl.value]?.[dayName] || [];
    if (!cornerCodes.length) console.warn("No corner codes from settings.json; will fallback to roster-derived.");
    const markers = (SETTINGS.present_markers || ["X"]).map(s=>String(s).toUpperCase());

    // MyTime map
    const m0 = mytimeRaw[0] || {};
    const M_ID   = findKey(m0, ["Person ID","Employee ID","Person Number","ID"]);
    const M_ONPR = findKey(m0, ["On Premises","On Premises?","OnPremises"]);
    if (!M_ID || !M_ONPR) throw new Error("MyTime must include Person/Employee ID and On Premises.");
    const onPrem = new Map();
    for (const r of mytimeRaw){
      const id = normalizeId(r[M_ID]);
      const val = presentVal(r[M_ONPR], markers);
      if (id) onPrem.set(id, (onPrem.get(id)||false) || val);
    }

    // Vacation (CAN Daily Hours Summary)
    const vacIds = new Set();
    if (vacRaw.length){
      const v0 = vacRaw[0];
      const V_ID   = findKey(v0, ["Employee ID","Person ID","Person Number","Badge ID","ID"]);
      const V_DATE = findKey(v0, ["Date","Worked Date","Shift Date","Business Date"]);
      const V_CODE = findKey(v0, ["Pay Code","PayCode","Earning Code","Absence Name","Absence Type"]);
      const V_HR   = findKey(v0, ["Hours","Total Hours"]);
      for (const r of vacRaw){
        const dOk = !V_DATE || (toISODate(r[V_DATE]) === isoDate);
        const code = String(r[V_CODE]||"").toLowerCase();
        const hrs = parseFloat(r[V_HR])||0;
        if (dOk && (code.includes("vac") || code.includes("pto")) && hrs>0){
          vacIds.add(normalizeId(r[V_ID]));
        }
      }
    }

    // VET/VTO (PostingAcceptance)
    const vetIds = new Set(), vtoIds = new Set();
    if (vetRaw.length){
      const a0 = vetRaw[0];
      const A_ID  = findKey(a0, ["Employee ID","Person ID","EID","Person Number"]);
      const A_TYP = findKey(a0, ["Opportunity Type","opportunity.type","Type"]);
      const A_DT  = findKey(a0, ["Shift Date","Date","opportunity.date"]);
      const A_ACC = findKey(a0, ["opportunity.acceptedCount","Accepted Count","Accepted"]);
      for (const r of vetRaw){
        const accepted = A_ACC ? String(r[A_ACC]).trim() === "1" : true;
        const dMatch = !A_DT || (toISODate(r[A_DT]) === isoDate);
        const t = String(r[A_TYP]||"").toUpperCase();
        const id = normalizeId(r[A_ID]);
        if (!id || !accepted || !dMatch) continue;
        if (t.includes("VTO")) vtoIds.add(id);
        else if (t.includes("VET")) vetIds.add(id);
      }
    }

    // Swaps
    const collectSwaps = (rows, mapping)=>{
      const out = [], inn = [];
      if (!rows.length) return { out, inn };
      const s0 = rows[0];
      const S_ID   = findKey(s0, mapping.id || DEFAULT_SETTINGS.swap_mapping.id);
      const S_ST   = findKey(s0, mapping.status || DEFAULT_SETTINGS.swap_mapping.status);
      const S_SKIP = findKey(s0, mapping.skip_date || DEFAULT_SETTINGS.swap_mapping.skip_date);
      const S_WORK = findKey(s0, mapping.work_date || DEFAULT_SETTINGS.swap_mapping.work_date);
      const APPROVED = (mapping.approved_statuses || DEFAULT_SETTINGS.swap_mapping.approved_statuses)
        .map(s => String(s).toUpperCase());
      for (const r of rows){
        const id = normalizeId(r[S_ID]);
        if (!id) continue;
        const status = String(r[S_ST] ?? "Approved").trim().toUpperCase();
        const approved = !S_ST || APPROVED.includes(status) || /APPROVED|COMPLETED|ACCEPTED/.test(status);
        const skipISO = toISODate(r[S_SKIP]);
        const workISO = toISODate(r[S_WORK]);
        if (!approved) continue;
        if (skipISO && skipISO === isoDate) out.push(id);
        if (workISO && workISO === isoDate) inn.push(id);
      }
      return { out, inn };
    };
    const mapping = SETTINGS.swap_mapping || DEFAULT_SETTINGS.swap_mapping;
    const sA = collectSwaps(swapOutRaw, mapping);
    const sB = collectSwaps(swapInRaw, mapping);
    const swapOutIds = new Set([...sA.out, ...sB.out]);
    const swapInIds  = new Set([...sA.inn, ...sB.inn]);

    // -------- Roster enrichment --------
    const r0 = rosterRaw[0] || {};
    const R_ID   = findKey(r0, ["Employee ID","Person Number","Person ID","Badge ID","ID"]);
    const R_DEPT = findKey(r0, ["Department ID","Home Department ID","Dept ID"]);
    const R_AREA = findKey(r0, ["Management Area ID","Mgmt Area ID","Area ID","Area"]);
    const R_TYPE = findKey(r0, ["Employment Type","Associate Type","Worker Type","Badge Type","Company"]);
    const R_SP   = findKey(r0, ["Shift Pattern","Schedule Pattern","Shift"]);
    const R_COR  = findKey(r0, ["Corner","Corner Code"]);
    const R_START= findKey(r0, ["Employment Start Date","Hire Date","Start Date"]);
    if (!R_ID || !R_DEPT || !(R_SP||R_COR)) throw new Error("Roster must include Employee ID, Department ID, and Shift Pattern/Corner.");

    const first2 = s => (s||"").slice(0,2);
    const firstAndThird = s => (s?.length>=3 ? s[0]+s[2] : "");

    // Enrich roster (raw)
    let roster = rosterRaw.map(r=>{
      const id = normalizeId(r[R_ID]);
      const deptId = String(r[R_DEPT]??"").trim();
      const area = String((R_AREA? r[R_AREA] : "")??"").trim();
      const typ = classifyEmpType(r[R_TYPE]);
      const sp  = String((R_SP? r[R_SP] : "")??"");
      const corner = R_COR ? String(r[R_COR]??"").trim() : first2(sp);
      const met = firstAndThird(sp);
      const start = R_START ? parseDateLoose(r[R_START]) : null;
      const onp = onPrem.get(id) === true;
      return { id, deptId, area, typ, corner, met, start, onp };
    });

    const fullById = new Map(roster.map(x => [x.id, x]));

    // Corner filter with fallback
    if (!cornerCodes.length) {
      cornerCodes = deriveCornersFromRoster(rosterRaw);
      if (cornerCodes.length) {
        codesEl.innerHTML = cornerCodes.map(c=>`<code>${c}</code>`).join(" ");
      }
    }
    if (cornerCodes.length) {
      roster = roster.filter(x => cornerCodes.includes(x.corner));
    } else {
      console.warn("No corner codes available; skipping corner filter.");
    }

    // Exclude new hires
    if (newHireEl.checked){
      const d0 = new Date(isoDate+"T00:00:00");
      roster = roster.filter(x=>{
        if (!x.start) return true;
        const days = Math.floor((d0 - x.start)/(1000*60*60*24));
        return days >= 3;
      });
    }

    // Dept checkers
    const cfg = SETTINGS.departments;
    const DA_IDS = cfg.DA.dept_ids;
    const isInbound = x => cfg.Inbound.dept_ids.includes(x.deptId) && !DA_IDS.includes(x.deptId);
    const isDA      = x => DA_IDS.includes(x.deptId);
    const isICQA    = x => cfg.ICQA.dept_ids.includes(x.deptId) && x.area===cfg.ICQA.management_area_id;
    const isCRETs   = x => cfg.CRETs.dept_ids.includes(x.deptId) && x.area===cfg.CRETs.management_area_id;
    const bucketOf  = x => isInbound(x) ? "Inbound" : isDA(x) ? "DA" : isICQA(x) ? "ICQA" : isCRETs(x) ? "CRETs" : "Other";

    // Lookup maps
    const byId = new Map(roster.map(x=>[x.id, x]));

    // Base cohort BEFORE exclusions (for denominator)
    const cohort = roster.slice();

    // Apply exclusions to cohort: Vacation + Swap-Out + VTO
    const excluded = new Set();
    for (const id of vacIds) if (byId.has(id)) excluded.add(id);
    for (const id of swapOutIds) if (byId.has(id)) excluded.add(id);
    for (const id of vtoIds) if (byId.has(id)) excluded.add(id);

    const cohortExpected = cohort.filter(x => !excluded.has(x.id));
    const cohortPresentExSwaps = cohort.filter(x => x.onp && !excluded.has(x.id));

    // For displays
    const swapOutRows        = [...swapOutIds].map(id => byId.get(id)).filter(Boolean);
    const swapInExpectedRows = [...swapInIds].map(id => fullById.get(id)).filter(Boolean);
    const swapInPresentRows  = swapInExpectedRows.filter(x => onPrem.get(x.id)===true);
    const vetExpectedRows    = [...vetIds].map(id => byId.get(id) || fullById.get(id)).filter(Boolean);
    const vetPresentRows     = vetExpectedRows.filter(x => onPrem.get(x.id)===true);

    // Vacation excluded rows (for CSV link)
    const vacationExcludedRows = [...vacIds].map(id => byId.get(id) || fullById.get(id)).filter(Boolean);

    // ---------- aggregators ----------
    const depts = ["Inbound","DA","ICQA","CRETs"];
    const mkTable = () => Object.fromEntries(depts.map(d=>[d, {AMZN:0, TEMP:0, TOTAL:0}]));
    const countInto = (acc, row) => {
      const b = bucketOf(row);
      if (!depts.includes(b)) return;
      if (row.typ==="AMZN") { acc[b].AMZN++; acc[b].TOTAL++; }
      else if (row.typ==="TEMP") { acc[b].TEMP++; acc[b].TOTAL++; }
    };
    const sumTotals = ACC => {
      let t=0; for (const d of depts){ t+=ACC[d].TOTAL; } return t;
    };

    // Build rows that we might show (we'll hide zero-total ones)
    const rows = [
      ["Regular HC (Cohort Expected)", (()=>{ const R=mkTable(); cohortExpected.forEach(x=>countInto(R,x)); return R; })()],
      ["Regular HC Present (Excluding Swaps)", (()=>{ const R=mkTable(); cohortPresentExSwaps.forEach(x=>countInto(R,x)); return R; })()],
      ["Shift Swap Out", (()=>{ const R=mkTable(); swapOutRows.forEach(x=>countInto(R,x)); return R; })()],
      ["Shift Swap Expected", (()=>{ const R=mkTable(); swapInExpectedRows.forEach(x=>countInto(R,x)); return R; })()],
      ["Shift Swap Present", (()=>{ const R=mkTable(); swapInPresentRows.forEach(x=>countInto(R,x)); return R; })()],
      ["VTO", (()=>{ const R=mkTable(); [...vtoIds].map(id=>byId.get(id) || fullById.get(id)).filter(Boolean).forEach(x=>countInto(R,x)); return R; })()],
      ["VET Accepted", (()=>{ const R=mkTable(); vetExpectedRows.forEach(x=>countInto(R,x)); return R; })()],
      ["VET Present", (()=>{ const R=mkTable(); vetPresentRows.forEach(x=>countInto(R,x)); return R; })()]
    ];

    // ====== Render table (only rows with data) ======
    const header = `
      <thead>
        <tr>
          <th>Attendance Details</th>
          ${depts.map(d=>`<th>${d} AMZN</th><th>${d} TEMP</th>`).join("")}
          <th>Total</th>
        </tr>
      </thead>`;

    const bodyRows = rows
      .filter(([label, ACC]) => sumTotals(ACC) > 0)
      .map(([label, ACC]) => {
        const cells = depts.map(d=>`<td>${ACC[d].AMZN}</td><td>${ACC[d].TEMP}</td>`).join("");
        const total = sumTotals(ACC);
        return `<tr><td>${label}</td>${cells}<td>${total}</td></tr>`;
      })
      .join("");

    replicaTable.innerHTML = header + "<tbody>" + bodyRows + "</tbody>";

    // Vacation note + CSV
    if (vacationExcludedRows.length){
      const vacRows = vacationExcludedRows.map(x => ({
        id: x.id,
        dept_bucket: (isInbound(x)?"Inbound":isDA(x)?"DA":isICQA(x)?"ICQA":isCRETs(x)?"CRETs":"Other"),
        emp_type: x.typ,
        corner: x.corner
      }));
      const csv = ["id,dept_bucket,emp_type,corner"].concat(
        vacRows.map(r=>[r.id,r.dept_bucket,r.emp_type,r.corner].map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(","))
      ).join("\n");
      const blob = new Blob([csv], {type: "text/csv"});
      const url = URL.createObjectURL(blob);
      vacCSV.href = url;
      vacNote.style.display = "block";
    } else {
      vacNote.style.display = "none";
    }

    // No-Show CSV (scheduled after exclusions, not present)
    const noShows = cohortExpected.filter(x => !x.onp).map(x => ({
      id: x.id,
      dept_bucket: (isInbound(x)?"Inbound":isDA(x)?"DA":isICQA(x)?"ICQA":isCRETs(x)?"CRETs":"Other"),
      emp_type: x.typ,
      corner: x.corner,
      date: isoDate,
      reason: "No-Show"
    }));

    noShowBtn.onclick = () => {
      if (!noShows.length) {
        alert("No no-shows based on current files/date.");
        return;
      }
      downloadCSV(`no_shows_${isoDate}.csv`, noShows);
    };

    fileStatus.textContent = "Done";
  } catch (e){
    console.error(e);
    fileStatus.textContent = "Error";
    alert(e.message || "Processing failed");
  }
});
