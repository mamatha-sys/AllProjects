// Same-state supply splits GST into CGST+SGST (half each); a different state
// is IGST in full. Blank state on either side is treated as same-state
// (assume intra-state) rather than guessing an inter-state charge.
function splitGst(gstAmount, companyState, clientState) {
  const amount = Number(gstAmount) || 0;
  const same = !companyState || !clientState
    || String(companyState).trim().toLowerCase() === String(clientState).trim().toLowerCase();
  if (same) {
    const half = Math.round((amount / 2) * 100) / 100;
    return { same, cgst: half, sgst: Math.round((amount - half) * 100) / 100, igst: 0 };
  }
  return { same, cgst: 0, sgst: 0, igst: amount };
}

module.exports = { splitGst };
