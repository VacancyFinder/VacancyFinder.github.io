/** Display names for groups whose slug alone reads badly. Others are title-cased. */
export const GROUP_NAMES: Record<string, string> = {
  keells: "John Keells Group",
  hayleys: "Hayleys Group",
  softlogic: "Softlogic Group",
  aitkenspence: "Aitken Spence Group",
  brownsgroup: "Browns Group",
  lolc: "LOLC Group",
  cargillsceylon: "Cargills Group",
  dialog: "Dialog Axiata Group",
  arpico: "Richard Pieris Group (Arpico)",
  renukagroup: "Renuka Group",
  carsoncumberbatch: "Carson Cumberbatch Group",
  amanatakaful: "Amana Takaful Group",
  asirihealth: "Asiri Health",
  lionbeer: "Lion Brewery Group",
  firstcapital: "First Capital Group",
  lankatiles: "Lanka Tiles Group",
  laugfs: "LAUGFS Group",
  acl: "ACL Group",
  ambeon: "Ambeon Group",
};

export function groupName(slug: string): string {
  return GROUP_NAMES[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}
