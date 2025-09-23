document.addEventListener("DOMContentLoaded", () => {
    const dateEl = document.getElementById("date-input");
    const shiftEl = document.getElementById("shift-select");
    const rosterEl = document.getElementById("rosterFile");
    const mytimeEl = document.getElementById("mytimeFile");
    const vacFileEl = document.getElementById("vacFile");
    const swapFileEl = document.getElementById("swapFile");
    const vetVtoFileEl = document.getElementById("vetVtoFile");
    const processBtn = document.getElementById("processBtn");
    const fileStatus = document.getElementById("file-status");
    const dashboardDateEl = document.getElementById("dashboardDate");
    const dashboardShiftEl = document.getElementById("dashboardShift");
    const dashboardCodesEl = document.getElementById("dashboardCodes");
    const expectedTable = document.getElementById("expectedTable");
    const presentTable = document.getElementById("presentTable");
    const totalExpectedChip = document.getElementById("totalExpectedChip");
    const totalPresentChip = document.getElementById("totalPresentChip");
    const vacExcludedChip = document.getElementById("vacExcludedChip");
    const auditLogContainer = document.getElementById("auditLogContainer");

    const settings = {
        YHM2: {
            "DAY": {
                "codes": ["DEE-DAY-REG", "DEE-DAY", "DSW-DAY"],
                "dept_ids": {
                    "ICQA": [39000, 39010, 39020],
                    "CRET": [39000, 39010, 39020],
                },
                "mgmt_area_ids": {
                    "ICQA": [180429],
                    "CRET": [180436]
                }
            },
            "NIGHT": {
                "codes": ["DEE-NIGHT", "DSW-NIGHT"],
                "dept_ids": {
                    "ICQA": [39000, 39010, 39020],
                    "CRET": [39000, 39010, 39020],
                },
                "mgmt_area_ids": {
                    "ICQA": [180429],
                    "CRET": [180436]
                }
            }
        }
    };

    const R_EMP = "Employee ID";
    const R_START_DATE = "Start Date";
    const R_CORNER = "Corner";
    const R_MGMT_AREA = "Management Area ID";
    const R_DEPT_ID = "Department ID";
    const MT_EMP = "Emp ID";
    const MT_ON_PREMISE = "On Premises";
    const VET_VTO_EMP = "Employee ID";
    const VET_VTO_TYPE = "Opportunity Type";
    const VET_VTO_DATE = "Shift Date";
    const SWAP_EMP = "Employee 1 ID";
    const SWAP_STATUS = "Status";
    const SWAP_DATE_SKIP = "Date to Skip";
    const SWAP_DATE_WORK = "Date to Work";

    const normalizeId = (id) => String(id).replace(/(\.0+)?$/, "");

    const findKey = (obj, keys) => {
        if (!obj) return null;
        for (const key of keys) {
            if (obj.hasOwnProperty(key)) {
                return key;
            }
        }
        return Object.keys(obj)[0]; // Fallback to the first key if none match
    };

    const classifyEmpType = (empId) => {
        const idStr = String(empId);
        return idStr.length === 8 ? "AMZN" : "TEMP";
    };

    const isNewHire = (startDate, today) => {
        const start = new Date(startDate);
        const diff = today.getTime() - start.getTime();
        const days = diff / (1000 * 60 * 60 * 24);
        return days <= 3;
    };

    const parseCSVFile = (file, options) => {
        if (!file) return Promise.resolve([]);
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                ...options,
                complete: (results) => {
                    if (results.errors.length > 0) {
                        console.error("Parsing errors:", results.errors);
                    }
                    if (options.skipFirstLine && results.data.length > 0) {
                        resolve(results.data.slice(1));
                    } else {
                        resolve(results.data);
                    }
                },
                error: (err) => reject(err),
            });
        });
    };

    const renderTables = (expected, present, swapInExp, swapInPres, vetExp, vetPres) => {
        const departments = Object.keys(expected);
        const header = expectedTable.querySelector("thead").innerHTML;
        const rowsExp = departments.map(d => `
            <tr>
                <td>${d}</td>
                <td class="right">${expected[d].AMZN}</td>
                <td class="right">${expected[d].TEMP}</td>
                <td class="right">${expected[d].TOTAL}</td>
            </tr>
        `).join("");
        const rowsPre = departments.map(d => `
            <tr>
                <td>${d}</td>
                <td class="right">${present[d].AMZN}</td>
                <td class="right">${present[d].TEMP}</td>
                <td class="right">${present[d].TOTAL}</td>
            </tr>
        `).join("");

        const swapExpRow = `
            <tr data-type="swap">
                <td>Swap In (Exp.)</td>
                <td class="right">${swapInExp.AMZN}</td>
                <td class="right">${swapInExp.TEMP}</td>
                <td class="right">${swapInExp.TOTAL}</td>
            </tr>`;
        const swapPresRow = `
            <tr data-type="swap">
                <td>Swap In (Pres.)</td>
                <td class="right">${swapInPres.AMZN}</td>
                <td class="right">${swapInPres.TEMP}</td>
                <td class="right">${swapInPres.TOTAL}</td>
            </tr>`;
        
        const vetExpRow = `
            <tr data-type="vet">
                <td>VET (Exp.)</td>
                <td class="right">${vetExp.AMZN}</td>
                <td class="right">${vetExp.TEMP}</td>
                <td class="right">${vetExp.TOTAL}</td>
            </tr>`;
        const vetPresRow = `
            <tr data-type="vet">
                <td>VET (Pres.)</td>
                <td class="right">${vetPres.AMZN}</td>
                <td class="right">${vetPres.TEMP}</td>
                <td class="right">${vetPres.TOTAL}</td>
            </tr>`;

        const totalExpected = Object.values(expected).reduce((sum, d) => sum + d.TOTAL, 0) + swapInExp.TOTAL + vetExp.TOTAL;
        const totalPresent = Object.values(present).reduce((sum, d) => sum + d.TOTAL, 0) + swapInPres.TOTAL + vetPres.TOTAL;

        expectedTable.innerHTML = `<thead>${header}</thead><tbody>${rowsExp}${swapExpRow}${vetExpRow}</tbody>
            <tfoot><tr><td>Total</td><td class="right">${expected.total.AMZN + swapInExp.AMZN + vetExp.AMZN}</td><td class="right">${expected.total.TEMP + swapInExp.TEMP + vetExp.TEMP}</td><td class="right">${totalExpected}</td></tr></tfoot>`;

        presentTable.innerHTML = `<thead>${header}</thead><tbody>${rowsPre}${swapPresRow}${vetPresRow}</tbody>
            <tfoot><tr><td>Total</td><td class="right">${present.total.AMZN + swapInPres.AMZN + vetPres.AMZN}</td><td class="right">${present.total.TEMP + swapInPres.TEMP + vetPres.TEMP}</td><td class="right">${totalPresent}</td></tr></tfoot>`;
    };

    const renderChips = (expected, present, day, shift, codes, vacExcludedCount) => {
        const totalExpected = Object.values(expected).reduce((sum, d) => sum + d.TOTAL, 0);
        const totalPresent = Object.values(present).reduce((sum, d) => sum + d.TOTAL, 0);

        dashboardDateEl.textContent = day;
        dashboardShiftEl.textContent = shift;
        dashboardCodesEl.textContent = codes.join(", ");
        totalExpectedChip.textContent = totalExpected;
        totalPresentChip.textContent = totalPresent;
        vacExcludedChip.textContent = vacExcludedCount;
    };

    const logAudit = (message) => {
        const p = document.createElement("p");
        p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        auditLogContainer.prepend(p);
    };

    processBtn.addEventListener("click", async () => {
        const date = dateEl.value;
        const shift = shiftEl.value;

        if (!date || !shift) {
            fileStatus.textContent = "Please select date and shift.";
            return;
        }

        const today = new Date(date);
        const dayOfWeek = today.toLocaleString("en-US", { weekday: "long" });

        fileStatus.textContent = "Parsing files…";

        const locationSettings = settings["YHM2"];
        if (!locationSettings[shift]) {
            fileStatus.textContent = `Error: No settings found for ${shift} shift.`;
            return;
        }
        const { codes, dept_ids, mgmt_area_ids } = locationSettings[shift];

        try {
            const [rosterRaw, mytimeRaw, vacRaw, swapRaw, vetVtoRaw] = await Promise.all([
                parseCSVFile(rosterEl.files[0], { header: true }),
                parseCSVFile(mytimeEl.files[0], { header: true, skipFirstLine: true }),
                parseCSVFile(vacFileEl.files[0], { header: true }),
                parseCSVFile(swapFileEl.files[0], { header: true }),
                parseCSVFile(vetVtoFileEl.files[0], { header: true }),
            ]);

            logAudit("All files parsed successfully.");

            // Process MyTime to get On Premises data
            const onPremMap = new Map();
            const mytimeEmpIdKey = findKey(mytimeRaw[0], [MT_EMP, "Employee ID"]);
            const mytimeOnPremKey = findKey(mytimeRaw[0], [MT_ON_PREMISE, "On Premises"]);
            for (const row of mytimeRaw) {
                if (row[mytimeEmpIdKey] && row[mytimeOnPremKey] === "X") {
                    onPremMap.set(normalizeId(row[mytimeEmpIdKey]), true);
                }
            }
            logAudit(`MyTime file processed. Found ${onPremMap.size} on-premises associates.`);

            // Process Vacation file
            const vacIds = new Set();
            if (vacRaw.length > 0) {
                const vacEmpIdKey = findKey(vacRaw[0], ["Employee ID"]);
                for (const row of vacRaw) {
                    vacIds.add(normalizeId(row[vacEmpIdKey]));
                }
            }
            logAudit(`Vacation file processed. Found ${vacIds.size} associates on vacation.`);
            
            // Process Swap file
            const swapOutIds = new Set();
            const swapInExpectedIds = new Set();
            if (swapRaw.length > 0) {
                const swapEmpIdKey = findKey(swapRaw[0], [SWAP_EMP, "Person ID"]);
                const swapStatusKey = findKey(swapRaw[0], [SWAP_STATUS, "Status"]);
                const swapDateSkipKey = findKey(swapRaw[0], [SWAP_DATE_SKIP, "Date to Skip"]);
                const swapDateWorkKey = findKey(swapRaw[0], [SWAP_DATE_WORK, "Date to Work"]);
                const dayFormatted = date.replace(/-/g, "/");

                for (const row of swapRaw) {
                    if (row[swapStatusKey]?.toLowerCase() === "approved") {
                        if (row[swapDateSkipKey] === dayFormatted) {
                            swapOutIds.add(normalizeId(row[swapEmpIdKey]));
                        }
                        if (row[swapDateWorkKey] === dayFormatted) {
                            swapInExpectedIds.add(normalizeId(row[swapEmpIdKey]));
                        }
                    }
                }
            }
            logAudit(`Swap file processed. Found ${swapOutIds.size} swap-outs and ${swapInExpectedIds.size} swap-in expected.`);

            // Process VET/VTO file
            const vetExpectedIds = new Set();
            const vtoIds = new Set();
            if (vetVtoRaw.length > 0) {
                const vetVtoEmpIdKey = findKey(vetVtoRaw[0], [VET_VTO_EMP]);
                const vetVtoTypeKey = findKey(vetVtoRaw[0], [VET_VTO_TYPE]);
                const vetVtoDateKey = findKey(vetVtoRaw[0], [VET_VTO_DATE]);
                const dayFormatted = date.replace(/-/g, "/");

                for (const row of vetVtoRaw) {
                    if (row[vetVtoDateKey] === dayFormatted) {
                        if (row[vetVtoTypeKey] === "VET") {
                            vetExpectedIds.add(normalizeId(row[vetVtoEmpIdKey]));
                        } else if (row[vetVtoTypeKey] === "VTO") {
                            vtoIds.add(normalizeId(row[vetVtoEmpIdKey]));
                        }
                    }
                }
            }
            logAudit(`VET/VTO file processed. Found ${vetExpectedIds.size} VET expected.`);

            // Process Roster
            const rosterEmpIdKey = findKey(rosterRaw[0], [R_EMP, "Person ID"]);
            const rosterStartDateKey = findKey(rosterRaw[0], [R_START_DATE, "Start Date"]);
            const rosterCornerKey = findKey(rosterRaw[0], [R_CORNER, "Corner"]);
            const rosterMgmtAreaKey = findKey(rosterRaw[0], [R_MGMT_AREA]);
            const rosterDeptIdKey = findKey(rosterRaw[0], [R_DEPT_ID]);

            const expectedCounts = {};
            const presentCounts = {};
            let vacExcludedCount = 0;

            const departments = Object.keys(dept_ids);
            departments.forEach(d => {
                expectedCounts[d] = { AMZN: 0, TEMP: 0, TOTAL: 0 };
                presentCounts[d] = { AMZN: 0, TEMP: 0, TOTAL: 0 };
            });

            for (const r of rosterRaw) {
                const empId = normalizeId(r[rosterEmpIdKey]);
                const empType = classifyEmpType(empId);
                const isNew = isNewHire(r[rosterStartDateKey], today);
                const isVac = vacIds.has(empId);
                const isSwapOut = swapOutIds.has(empId);
                const isVet = vetExpectedIds.has(empId);
                const isVto = vtoIds.has(empId);
                const onPrem = onPremMap.has(empId);
                
                if (isNew) continue;
                if (isVac) {
                    vacExcludedCount++;
                    continue;
                }

                const corner = r[rosterCornerKey];
                const deptId = Number(r[rosterDeptIdKey]);
                const mgmtAreaId = Number(r[rosterMgmtAreaKey]);
                
                const deptName = departments.find(d => {
                    if (d === "ICQA" || d === "CRET") {
                        return dept_ids[d].includes(deptId) && mgmt_area_ids[d].includes(mgmtAreaId);
                    }
                    return false;
                });

                if (codes.includes(corner)) {
                    if (deptName) {
                        // Expected headcount logic
                        if (!isSwapOut && !isVto) {
                            expectedCounts[deptName][empType]++;
                            expectedCounts[deptName]["TOTAL"]++;
                        }
                        
                        // Present headcount logic
                        if (onPrem) {
                            presentCounts[deptName][empType]++;
                            presentCounts[deptName]["TOTAL"]++;
                        }
                    }
                }
            }

            // Add swap in and VET to the counts
            const swapInExpectedCounts = { AMZN: 0, TEMP: 0, TOTAL: 0 };
            const swapInPresentCounts = { AMZN: 0, TEMP: 0, TOTAL: 0 };
            for (const empId of swapInExpectedIds) {
                const empType = classifyEmpType(empId);
                swapInExpectedCounts[empType]++;
                swapInExpectedCounts.TOTAL++;
                if (onPremMap.has(empId)) {
                    swapInPresentCounts[empType]++;
                    swapInPresentCounts.TOTAL++;
                }
            }

            const vetExpectedCounts = { AMZN: 0, TEMP: 0, TOTAL: 0 };
            const vetPresentCounts = { AMZN: 0, TEMP: 0, TOTAL: 0 };
            for (const empId of vetExpectedIds) {
                const empType = classifyEmpType(empId);
                vetExpectedCounts[empType]++;
                vetExpectedCounts.TOTAL++;
                if (onPremMap.has(empId)) {
                    vetPresentCounts[empType]++;
                    vetPresentCounts.TOTAL++;
                }
            }

            logAudit("Headcount calculations complete.");

            renderTables(expectedCounts, presentCounts, swapInExpectedCounts, swapInPresentCounts, vetExpectedCounts, vetPresentCounts);
            renderChips(expectedCounts, presentCounts, date, shift, codes, vacExcludedCount);

            fileStatus.textContent = "Processing complete!";
        } catch (err) {
            fileStatus.textContent = "Error during processing.";
            console.error(err);
        }
    });

    // Initial load state
    dateEl.valueAsDate = new Date();
});
