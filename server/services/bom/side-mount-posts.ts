/**
 * Shared AIRE side-mount (face-mount) post emission — the ONLY side/face-mount system, used by
 * every aluminium style. Resolves from the shared "side-mount-posts" slot table. Counts mirror
 * the legacy emitFaceMountPosts: mid posts = panels-1-corners, corner posts ×2, one L+R end
 * 2-pack, dome nuts + M12 fixings per face post. A miss → [UNMAPPED].
 */
import { resolveSlot } from "../slots/catalogue-slots";

type BomLine = { qty: number; description: string; sku: string };

export function emitSideMountPosts(
  out: BomLine[],
  unmapped: string[],
  opts: { finishCode: string; material: string; totalPanels: number; corners: number },
): void {
  const { finishCode: code, material, totalPanels, corners } = opts;
  const get = (label: string, cs2: string, finish: string, qty: number): void => {
    if (qty <= 0) return;
    const m = resolveSlot("side-mount-posts", { cs1: "Side Mount Post", cs2, cs3: "", finish });
    if (m && m.category_slug) out.push({ qty, description: m.description || m.sku, sku: m.sku });
    else unmapped.push(`side-mount ${label} [${cs2} / finish~${finish}]`);
  };

  const midPosts = Math.max(0, totalPanels - 1 - corners);
  const cornerPosts = corners * 2; // face-mount corners fix to one face → 2 back-to-back
  const fmid = midPosts + cornerPosts;
  get("mid post", "Mid Post", code, fmid);
  get("end post", "End Post 2PK", code, 1); // one L+R 2-pack per connected run
  const facePosts = fmid + 2;
  // dome nuts per face post — silver (W) for white, black for black/monument
  get("dome nut", "Dome Nut", code === "W" ? "W" : "B", facePosts);
  if (material === "timber") get("timber fixing", "Timber Fixing", "", facePosts * 4);
  else if (material === "concrete") {
    get("concrete fixing", "Concrete Fixing", "", facePosts * 4);
    get("chemical anchor", "Chemical Anchor", "", Math.ceil(facePosts / 15));
  } // steel: customer-supplied main fixings (dome nuts still emitted)
}
