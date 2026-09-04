/** Canonical public origin for customer-facing links (booking emails,
 *  proposal pages). Zapier posts to the *.vercel.app URL, so deriving the
 *  origin from the request would leak that domain into emails — set
 *  PUBLIC_ORIGIN (e.g. https://tool.houstonsigncrafters.com) to override. */
export function publicOrigin(req: Request): string {
  return (
    process.env.PUBLIC_ORIGIN?.replace(/\/+$/, "") || new URL(req.url).origin
  );
}
