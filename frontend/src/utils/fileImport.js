import * as XLSX from 'xlsx';

// Reads a real uploaded file (.csv/.txt as plain text, .xlsx/.xls via SheetJS)
// and returns CSV text the existing backend parsers (bank statement import,
// invoice import) already know how to read — so an uploaded file goes
// through exactly the same parsing path a pasted CSV would.
export function readFileAsCsvText(file) {
  const isSpreadsheet = /\.(xlsx|xls)$/i.test(file.name);
  if (!isSpreadsheet) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_csv(sheet));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Reads every file in a FileList/array and returns their CSV text in order —
// used so selecting several statement files at once imports all of them.
export async function readFilesAsCsvText(files) {
  const out = [];
  for (const file of files) {
    out.push({ name: file.name, csv: await readFileAsCsvText(file) });
  }
  return out;
}
