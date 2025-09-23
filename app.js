// ====== CONFIG ======
const SETTINGS_URL = "./settings.json";

// ====== State ======
let SETTINGS = null;
const ORDER = ["Inbound","DA","ICQA","CRETs"];

// ====== Boot ======
fetch(SETTINGS_URL)
  .then(r => {
    if (!r.ok) {
      if (r.status === 404) throw new Error("settings.json not found. Put it beside index.html.");
      throw new Error("settings.json fetch failed with status: " + r.status);
    }
    return r.json();
  })
  .then(cfg => { SETTINGS = cfg; initUI(); })
  .catch(e => { console.error(e); alert(e.message || "Couldn't load settings.json"); });

// ====== Elements ======
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

const expectedTable = document.getElementById("expectedTable");
const presentTable  = document.getElementById("presentTable");
const dashboardDateEl = document.getElementById("dashboardDate");
const dashboardShiftEl = document.getElementById("dashboardShift");
const totalExpectedChip = document.getElementById("totalExpectedChip");
const totalPresentChip = document.getElementById("totalPresentChip");
const vacExcludedChip = document.getElementById("vacExcludedChip");

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

  const rowsExp = Object.entries(expected).map(row).filter(r=>!r.includes("undefined")).join("");
  const totalsExp = sumBlock(expected);
  expectedTable.innerHTML = header + `<tbody>${rowsExp}</tbody>
    <tfoot><tr><td>Total</td><td class="right">${totalsExp.AMZN}</td><td class="right">${totalsExp.TEMP}</td><td class="right">${totalsExp.TOTAL}</td></tr></tfoot>`;

  const rowsPre = Object.entries(present).map(row).filter(r=>!r.includes("undefined")).join("");
  const totalsPre = sumBlock(present);
  presentTable.innerHTML = header + `<tbody>${rowsPre}</tbody>
    <tfoot><tr><td>Total</td><td class="right">${totalsPre.AMZN}</td><td class="right">${totalsPre.TEMP}</td><td class="right">${totalsPre.TOTAL}</td></tr></tfoot>`;
}
function renderChips(expected, present, dayName, shift, codes, vacExcluded){
  const exp = sumBlock(expected).TOTAL;
  const pre = sumBlock(present).TOTAL;

  dashboardDateEl.textContent = dayName;
  dashboardShiftEl.textContent = shift;
  codesEl.innerHTML = codes.map(c=>`<code>${c}</code>`).join(" ");
  totalExpectedChip.textContent = exp;
  totalPresentChip.textContent = pre;
  vacExcludedChip.textContent = vacExcluded;

  const chip = totalPresentChip.closest('.chip');
  chip.classList.remove('ok','warn');
  chip.classList.add(pre >= exp ? 'ok' : 'warn');
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

// ====== PROCESS ======
processBtn.addEventListener("click", async ()=>{
  if (!SETTINGS){ alert("Settings not loaded yet. Try again."); return; }
  if (!dateEl.value){ alert("Pick a date."); return; }
  if (!rosterEl.files[0] || !mytimeEl.files[0]){ alert("Upload both Roster CSV and MyTime CSV."); return; }

  const dayName = toDayName(dateEl.value);
  const shift = shiftEl.value;
  const codes = SETTINGS.shift_schedule?.[shift]?.[dayName] || [];
  if (!codes.length){ alert("No shift codes configured for that selection."); return; }

  fileStatus.textContent = "Parsing files…";

  try {
    const [rosterRaw, mytimeRaw, vacRaw, swapOutRaw, swapInRaw, vetRaw] = await Promise.all([
      parseCSVFile(rosterEl.files[0], {header:true}),
      parseCSVFile(mytimeEl.files[0], {header:true, skipFirstLine:true}),
      vacEl.files[0]     ? parseCSVFile(vacEl.files[0], {header:true})     : Promise.resolve([]),
      swapOutEl.files[0] ? parseCSVFile(swapOutEl.files[0], {header:true}) : Promise.resolve([]),
      swapInEl.files[0]  ? parseCSVFile(swapInEl.files[0],  {header:true}) : Promise.resolve([]),
      vetEl.files[0]     ? parseCSVFile(vetEl.files[0],     {header:true}) : Promise.resolve([]),
    ]);

    // Vacation IDs (same-day)
    const vacIds = new Set();
    if (vacRaw.length) {
      const selectedISO = dateEl.value;
      const sampleV = vacRaw[0] || {};
      const V_ID = findKey(sampleV, ["Employee ID", "Person ID", "Person Number", "Badge ID", "ID"]);
      const V_DATE = findKey(sampleV, ["Date", "Worked Date", "Shift Date", "Business Date"]);
      const V_VAC_CODE = findKey(sampleV, ["Pay Code", "PayCode", "Earning Code"]);
      const V_VAC_ABSENCE = findKey(sampleV, ["Absence Name", "Absence Type"]);
      const V_HOURS = findKey(sampleV, ["Hours"]);

      for (const row of vacRaw) {
        if (V_DATE && new Date(row[V_DATE]).toISOString().slice(0,10) !== selectedISO) continue;
        const id = normalizeId(row[V_ID]);
        const code = String(row[V_VAC_CODE] || row[V_VAC_ABSENCE] || "").toLowerCase();
        const hours = parseFloat(row[V_HOURS]) || 0;
        if ((code.includes("vac") || code.includes("pto")) && hours > 0) vacIds.add(id);
      }
    }

    // Swaps: OUT file suppresses expected; IN file adds to expected (+ present if onPrem)
    const swapOutIds = new Set(), swapInIds = new Set();
    const targetDate = dateEl.value.replace(/-/
