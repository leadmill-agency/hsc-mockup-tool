import App from "@/components/App";

// Public entrance (PRD §7.0): anyone can design a sign — a fresh project is
// created on the spot, the proposal is email-gated, and completion points at
// booking a call. The staff cockpit lives at /staff.
export default function Page() {
  return <App publicMode />;
}
