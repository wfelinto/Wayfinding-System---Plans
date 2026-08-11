import * as XLSX from "xlsx";

// Column headers used both for the downloadable template and for reading
// an uploaded file back — keeping these in one place guarantees the
// upload parser recognizes exactly what the template produces.
export const GLOSSARY_HEADERS = ["ID", "English", "Spanish (ES)", "French (FR)", "Portuguese - Brazil (PT)"];

/** Triggers a download of a blank (with two example rows) glossary template. */
export function downloadGlossaryTemplate(projectName = "Project") {
  const rows = [
    GLOSSARY_HEADERS,
    [1, "Restrooms", "Baños", "Toilettes", "Banheiros"],
    [2, "Exit", "Salida", "Sortie", "Saída"],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 30 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Glossary");
  XLSX.writeFile(workbook, `${projectName} - glossary template.xlsx`);
}

/**
 * Parses an uploaded glossary Excel file into an array of
 * { external_id, term_en, term_es, term_fr, term_pt } rows. Rows missing
 * an ID or English term are skipped rather than causing an error, since
 * a stray blank row at the end of a spreadsheet is common and harmless.
 */
export function parseGlossaryExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const terms = rows
          .map((row) => {
            const externalId = Number(row["ID"]);
            const termEn = String(row["English"] || "").trim();
            if (!externalId || !Number.isFinite(externalId) || !termEn) return null;
            return {
              external_id: externalId,
              term_en: termEn,
              term_es: String(row["Spanish (ES)"] || "").trim() || null,
              term_fr: String(row["French (FR)"] || "").trim() || null,
              term_pt: String(row["Portuguese - Brazil (PT)"] || "").trim() || null,
            };
          })
          .filter(Boolean);

        resolve(terms);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsArrayBuffer(file);
  });
}
