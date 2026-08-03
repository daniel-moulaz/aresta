import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import ArestaDashboard from "../app/aresta-dashboard";

afterEach(cleanup);

describe("ArestaDashboard", () => {
  it("navega entre eventos e incidentes", async () => {
    const user = userEvent.setup();
    render(<ArestaDashboard />);

    await user.click(screen.getByRole("button", { name: "Eventos", exact: true }));
    expect(screen.getByRole("heading", { name: "Eventos", exact: true })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Buscar por fluxo ou ID")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Incidentes", exact: true }));
    expect(screen.getByRole("heading", { name: "Incidentes", exact: true })).toBeInTheDocument();
    expect(screen.getByText("HubSpot recusando atualizações", { selector: "h2" })).toBeInTheDocument();
  });

  it("cria um fluxo pelo formulário", async () => {
    const user = userEvent.setup();
    render(<ArestaDashboard />);

    await user.click(screen.getByRole("button", { name: "Novo fluxo" }));
    const nameInput = screen.getByRole("textbox", { name: "Nome do fluxo" });
    await user.clear(nameInput);
    await user.type(nameInput, "ERP para Financeiro");
    await user.click(screen.getByRole("radio", { name: "XML" }));
    await user.click(screen.getByRole("button", { name: "Criar fluxo" }));

    expect(screen.getByRole("heading", { name: "Fluxos", exact: true })).toBeInTheDocument();
    const createdFlow = screen.getByText("ERP para Financeiro");
    const createdFlowRow = createdFlow.closest(".table-row");
    expect(createdFlowRow).not.toBeNull();
    expect(within(createdFlowRow as HTMLElement).getByText("XML")).toBeInTheDocument();
  });

  it("recupera uma falha com retry", async () => {
    const user = userEvent.setup();
    render(<ArestaDashboard />);

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(
      () => expect(screen.getByText("Retry concluído")).toBeInTheDocument(),
      { timeout: 1600 },
    );
  });

  it("abre notificações e leva ao evento relacionado", async () => {
    const user = userEvent.setup();
    render(<ArestaDashboard />);

    await user.click(screen.getByRole("button", { name: "Abrir notificações" }));
    const center = screen.getByRole("region", { name: "Notificações recentes" });
    expect(within(center).getByRole("heading", { name: "Notificações" })).toBeInTheDocument();

    await user.click(within(center).getByRole("button", { name: /Retry agendado/ }));
    expect(screen.getByRole("heading", { name: "Eventos", exact: true })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "evt_d911f0" })).toBeInTheDocument();
  });

  it("filtra eventos por método e limpa os filtros", async () => {
    const user = userEvent.setup();
    render(<ArestaDashboard />);

    await user.click(screen.getByRole("button", { name: "Eventos", exact: true }));
    await user.click(screen.getByRole("button", { name: /Mais filtros/ }));
    await user.selectOptions(screen.getByLabelText("Método"), "PUT");

    expect(screen.getByText("1 resultados")).toBeInTheDocument();
    expect(screen.getByText("/webhooks/orders")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("6 resultados")).toBeInTheDocument();
  });

  it("gerencia destinos e incidentes sem ações decorativas", async () => {
    const user = userEvent.setup();
    render(<ArestaDashboard />);

    await user.click(screen.getByRole("button", { name: "Destinos" }));
    expect(screen.getByRole("heading", { name: "Destinos" })).toBeInTheDocument();
    const hubspotRow = screen.getByText("HubSpot CRM").closest(".table-row");
    expect(hubspotRow).not.toBeNull();
    await user.click(within(hubspotRow as HTMLElement).getByRole("button", { name: "Testar conexão" }));
    await waitFor(
      () => expect(within(hubspotRow as HTMLElement).getByText("agora")).toBeInTheDocument(),
      { timeout: 1000 },
    );

    await user.click(screen.getByRole("button", { name: "Incidentes", exact: true }));
    await user.click(screen.getByRole("button", { name: /Timeout acima do limite/ }));
    expect(screen.getByText("Timeout acima do limite", { selector: "h2" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Marcar como resolvido" }));
    expect(screen.getByText("2 incidentes")).toBeInTheDocument();
  });
});
