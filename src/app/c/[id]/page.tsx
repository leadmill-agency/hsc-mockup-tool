import App from "@/components/App";

// Customer's personal link from the booking email: opens exactly one
// project in customer mode (Flow 1, PRD §7.0).
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <App customerProjectId={id} />;
}
