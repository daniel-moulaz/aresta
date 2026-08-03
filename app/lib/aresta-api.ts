export type ApiEvent = {
  id: string;
  status: "succeeded" | "failed" | "dead_letter";
  duration_ms: number | null;
  error_message: string | null;
};

const apiUrl = process.env.NEXT_PUBLIC_ARESTA_API_URL?.replace(/\/$/, "");

export function isApiConfigured() {
  return Boolean(apiUrl);
}

export async function sendDemoWebhook(): Promise<ApiEvent | null> {
  if (!apiUrl) return null;

  const workflowsResponse = await fetch(`${apiUrl}/api/v1/workflows`);
  if (!workflowsResponse.ok) throw new Error("Não foi possível consultar os fluxos");

  const workflows = (await workflowsResponse.json()) as Array<{ id: string; name: string }>;
  const workflow = workflows.find((item) => item.name === "Checkout → CRM") ?? workflows[0];
  if (!workflow) throw new Error("Nenhum fluxo disponível na API");

  const response = await fetch(`${apiUrl}/api/v1/workflows/${workflow.id}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Correlation-ID": `web_${crypto.randomUUID().slice(0, 8)}`,
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      order: { id: `ord-${Date.now()}` },
      customer: { email: "demo@aresta.dev" },
      total: 189.9,
    }),
  });

  if (!response.ok) throw new Error("A API recusou o evento de demonstração");
  return response.json() as Promise<ApiEvent>;
}

export async function retryRemoteEvent(eventId: string): Promise<ApiEvent | null> {
  if (!apiUrl || !eventId.startsWith("evt_")) return null;

  const response = await fetch(`${apiUrl}/api/v1/events/${eventId}/retry`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Não foi possível executar o retry");
  return response.json() as Promise<ApiEvent>;
}
