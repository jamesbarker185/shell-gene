// The SHELL gene (Singh et al., Nature 500, 340–344, 2013) as a small pure model.
// One gene, two alleles: Sh+ (normal) and sh- (either of the two mutations MPOB found
// in the MADS-box, sh-MPOB and sh-AVROS). The fruit form follows the genotype.

export const FORMS = {
  dura: { genotype: "Sh+/Sh+", copies: 0, shell: "thick, 2–8 mm", oil: 1.0, plant: false },
  tenera: { genotype: "Sh+/sh-", copies: 1, shell: "thin, 0.5–4 mm, with a fibre ring", oil: 1.3, plant: true },
  pisifera: { genotype: "sh-/sh-", copies: 2, shell: "none; usually female-sterile", oil: 0, plant: false },
};

export const ORDER = ["dura", "tenera", "pisifera"];

// Tenera yields about 30% more oil per hectare than dura. Pisifera palms are usually
// female-sterile: their bunches abort, so they carry no oil to the mill.
export const UPLIFT = FORMS.tenera.oil / FORMS.dura.oil - 1;

// Without the test, the form shows only when the palm first fruits.
export const YEARS_TO_FRUIT = 6;

// An illustrative seed lot sold as tenera (dura × pisifera), with stray pollen giving
// three dura and one pisifera in 24. The bench screens it seedling by seedling.
export const LOT = "TTDTTTTPTTTDTTTTTTDTTTTT".split("").map((c) => ({ T: "tenera", D: "dura", P: "pisifera" })[c]);

export function countsOf(forms) {
  const out = { dura: 0, tenera: 0, pisifera: 0 };
  for (const form of forms) out[form]++;
  return out;
}

// Oil per hectare of a block, relative to a block of dura palms (= 100).
export function yieldOf(forms) {
  if (!forms.length) return 0;
  return (100 * forms.reduce((sum, form) => sum + FORMS[form].oil, 0)) / forms.length;
}

export const UNSCREENED = yieldOf(LOT);
export const SCREENED = yieldOf(LOT.filter((form) => FORMS[form].plant));

export function readoutOf({ screened, counts }) {
  return `${screened} screened · T ${counts.tenera} · D ${counts.dura} · P ${counts.pisifera}`;
}
