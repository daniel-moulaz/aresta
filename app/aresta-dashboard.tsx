"use client";

import {
  Activity,
  Bell,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Code2,
  Copy,
  FileJson2,
  Filter,
  GitBranch,
  Inbox,
  Layers3,
  Network,
  Plus,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Webhook,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { isApiConfigured, retryRemoteEvent, sendDemoWebhook } from "./lib/aresta-api";

type TabId = "overview" | "events" | "flows" | "incidents" | "destinations";
type EventStatus = "success" | "retry" | "failed" | "processing";
type StatusFilter = "Todos" | "Sucesso" | "Retry" | "Falha";
type MethodFilter = "Todos" | "POST" | "PUT";

type ArestaEvent = {
  id: string;
  timestamp: string;
  age: string;
  status: EventStatus;
  method: "POST" | "PUT";
  route: string;
  flow: string;
  source: string;
  target: string;
  duration: string;
  attempt: number;
  correlationId: string;
  title: string;
  response: string;
};

type Flow = {
  id: string;
  name: string;
  source: string;
  target: string;
  format: "JSON" | "XML";
  status: "Ativo" | "Pausado" | "Com falha";
  successRate: string;
  lastRun: string;
  volume: string;
};

type Destination = {
  id: string;
  name: string;
  kind: string;
  endpoint: string;
  enabled: boolean;
  health: "Operacional" | "Instável";
  lastCheck: string;
};

type NotificationItem = {
  id: string;
  eventId: string;
  title: string;
  copy: string;
  time: string;
  tone: "failed" | "retry" | "success";
  read: boolean;
};

type Incident = {
  id: string;
  eventId: string;
  priority: 1 | 2 | 3;
  title: string;
  flow: string;
  events: number;
  summary: string;
  firstEvent: string;
  lastAttempt: string;
  correlationId: string;
  cause: string;
  recommendation: string;
  status: "Aberto" | "Resolvido";
};

const navItems: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Visão geral", icon: Activity },
  { id: "events", label: "Eventos", icon: Code2 },
  { id: "flows", label: "Fluxos", icon: GitBranch },
  { id: "incidents", label: "Incidentes", icon: TriangleAlert },
];

const starterEvents: ArestaEvent[] = [
  {
    id: "evt_8d27ca",
    timestamp: "11:42:08.219",
    age: "há 2 min",
    status: "success",
    method: "POST",
    route: "/webhooks/checkout",
    flow: "Checkout → CRM",
    source: "checkout-api",
    target: "hubspot",
    duration: "184 ms",
    attempt: 1,
    correlationId: "cor_4f92b817",
    title: "Entrega concluída",
    response: "201 Created",
  },
  {
    id: "evt_31ae09",
    timestamp: "11:39:44.081",
    age: "há 5 min",
    status: "success",
    method: "POST",
    route: "/webhooks/payment",
    flow: "Pagamento → Slack",
    source: "payments",
    target: "slack",
    duration: "92 ms",
    attempt: 1,
    correlationId: "cor_2e80ad11",
    title: "Notificação entregue",
    response: "200 OK",
  },
  {
    id: "evt_7f40bb",
    timestamp: "11:34:17.602",
    age: "há 10 min",
    status: "failed",
    method: "POST",
    route: "/webhooks/leads",
    flow: "Leads → HubSpot",
    source: "lead-capture",
    target: "hubspot",
    duration: "5.01 s",
    attempt: 3,
    correlationId: "cor_9f31a204",
    title: "Destino recusou a entrega",
    response: "429 Too Many Requests",
  },
  {
    id: "evt_d911f0",
    timestamp: "11:28:51.332",
    age: "há 16 min",
    status: "retry",
    method: "PUT",
    route: "/webhooks/orders",
    flow: "Pedidos → ERP",
    source: "orders-api",
    target: "erp-legacy",
    duration: "2.14 s",
    attempt: 2,
    correlationId: "cor_8aa67e32",
    title: "Aguardando nova tentativa",
    response: "504 Gateway Timeout",
  },
  {
    id: "evt_b05a6d",
    timestamp: "11:22:19.405",
    age: "há 22 min",
    status: "success",
    method: "POST",
    route: "/webhooks/support",
    flow: "Suporte → E-mail",
    source: "chatwoot",
    target: "mailer",
    duration: "263 ms",
    attempt: 1,
    correlationId: "cor_7bb531dc",
    title: "Mensagem encaminhada",
    response: "202 Accepted",
  },
  {
    id: "evt_2b139c",
    timestamp: "11:16:03.771",
    age: "há 28 min",
    status: "success",
    method: "POST",
    route: "/webhooks/invoice",
    flow: "Fatura → Financeiro",
    source: "billing",
    target: "finance-api",
    duration: "311 ms",
    attempt: 1,
    correlationId: "cor_a80127ef",
    title: "Fatura registrada",
    response: "201 Created",
  },
];

const starterFlows: Flow[] = [
  {
    id: "flow-checkout-crm",
    name: "Checkout → CRM",
    source: "Webhook",
    target: "HubSpot",
    format: "JSON",
    status: "Ativo",
    successRate: "99,2%",
    lastRun: "há 2 min",
    volume: "12,8k",
  },
  {
    id: "flow-payment-slack",
    name: "Pagamento → Slack",
    source: "API REST",
    target: "Slack",
    format: "JSON",
    status: "Ativo",
    successRate: "98,5%",
    lastRun: "há 5 min",
    volume: "8,4k",
  },
  {
    id: "flow-leads-hubspot",
    name: "Leads → HubSpot",
    source: "Webhook",
    target: "HubSpot",
    format: "XML",
    status: "Com falha",
    successRate: "91,8%",
    lastRun: "há 10 min",
    volume: "2,1k",
  },
  {
    id: "flow-support-mail",
    name: "Suporte → E-mail",
    source: "Fila",
    target: "Mailer",
    format: "JSON",
    status: "Ativo",
    successRate: "99,7%",
    lastRun: "há 22 min",
    volume: "5,9k",
  },
];

const starterDestinations: Destination[] = [
  {
    id: "dest-hubspot",
    name: "HubSpot CRM",
    kind: "API REST",
    endpoint: "api.hubapi.com/crm/v3",
    enabled: true,
    health: "Instável",
    lastCheck: "há 3 min",
  },
  {
    id: "dest-slack",
    name: "Slack Operations",
    kind: "Webhook",
    endpoint: "hooks.slack.com/services/••••",
    enabled: true,
    health: "Operacional",
    lastCheck: "há 5 min",
  },
  {
    id: "dest-erp",
    name: "ERP legado",
    kind: "API REST",
    endpoint: "erp.internal.local/v1",
    enabled: true,
    health: "Operacional",
    lastCheck: "há 11 min",
  },
];

const starterNotifications: NotificationItem[] = [
  {
    id: "notification-1",
    eventId: "evt_7f40bb",
    title: "Falha na entrega ao HubSpot",
    copy: "O destino respondeu 429 após quatro tentativas.",
    time: "há 10 min",
    tone: "failed",
    read: false,
  },
  {
    id: "notification-2",
    eventId: "evt_d911f0",
    title: "Retry agendado",
    copy: "Pedidos → ERP terá uma nova tentativa automática.",
    time: "há 16 min",
    tone: "retry",
    read: false,
  },
  {
    id: "notification-3",
    eventId: "evt_31ae09",
    title: "Entrega normalizada",
    copy: "Pagamento → Slack voltou a operar normalmente.",
    time: "há 28 min",
    tone: "success",
    read: true,
  },
];

const starterIncidents: Incident[] = [
  {
    id: "inc-hubspot-rate-limit",
    eventId: "evt_7f40bb",
    priority: 1,
    title: "HubSpot recusando atualizações",
    flow: "Leads → HubSpot",
    events: 4,
    summary: "A API de destino respondeu 429 Too Many Requests em quatro tentativas dentro de oito minutos.",
    firstEvent: "10:39:44",
    lastAttempt: "10:47:12",
    correlationId: "cor_9f31a204",
    cause: "Rate limit do destino excedido",
    recommendation: "A janela de quota deve ser liberada em aproximadamente dois minutos.",
    status: "Aberto",
  },
  {
    id: "inc-erp-timeout",
    eventId: "evt_d911f0",
    priority: 2,
    title: "Timeout acima do limite",
    flow: "Pedidos → ERP",
    events: 2,
    summary: "O ERP não respondeu dentro do limite configurado em duas tentativas consecutivas.",
    firstEvent: "10:31:09",
    lastAttempt: "10:44:22",
    correlationId: "cor_8aa67e32",
    cause: "Latência elevada no ERP legado",
    recommendation: "Verifique a disponibilidade do serviço antes de executar um novo retry.",
    status: "Aberto",
  },
  {
    id: "inc-support-field",
    eventId: "evt_b05a6d",
    priority: 3,
    title: "Campo opcional ausente",
    flow: "Suporte → E-mail",
    events: 1,
    summary: "Um evento chegou sem o campo opcional de categoria e usou o valor padrão.",
    firstEvent: "10:22:19",
    lastAttempt: "10:22:19",
    correlationId: "cor_7bb531dc",
    cause: "Payload incompleto na origem",
    recommendation: "A entrega foi concluída; ajuste o mapeamento apenas se a categoria for necessária.",
    status: "Aberto",
  },
];

const statusLabels: Record<EventStatus, string> = {
  success: "Sucesso",
  retry: "Retry",
  failed: "Falha",
  processing: "Processando",
};

const sleep = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export default function ArestaDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [events, setEvents] = useState(starterEvents);
  const [flows, setFlows] = useState(starterFlows);
  const [destinations, setDestinations] = useState(starterDestinations);
  const [notifications, setNotifications] = useState(starterNotifications);
  const [incidents, setIncidents] = useState(starterIncidents);
  const [selectedEventId, setSelectedEventId] = useState("evt_7f40bb");
  const [selectedIncidentId, setSelectedIncidentId] = useState(starterIncidents[0].id);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("Todos");
  const [sourceFilter, setSourceFilter] = useState("Todas");
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [showFlowForm, setShowFlowForm] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [testingDestinationId, setTestingDestinationId] = useState("");
  const [toast, setToast] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const availableSources = useMemo(
    () => Array.from(new Set(events.map((event) => event.source))).sort(),
    [events],
  );

  const openIncidents = useMemo(
    () => incidents.filter((incident) => incident.status === "Aberto"),
    [incidents],
  );

  const unreadNotifications = notifications.filter((notification) => !notification.read).length;

  const visibleEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return events.filter((event) => {
      const matchesQuery =
        !normalizedQuery ||
        `${event.id} ${event.flow} ${event.route} ${event.source} ${event.target}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedQuery);
      const matchesStatus =
        statusFilter === "Todos" || statusLabels[event.status] === statusFilter;
      const matchesMethod = methodFilter === "Todos" || event.method === methodFilter;
      const matchesSource = sourceFilter === "Todas" || event.source === sourceFilter;
      return matchesQuery && matchesStatus && matchesMethod && matchesSource;
    });
  }, [events, methodFilter, query, sourceFilter, statusFilter]);

  const selectedEvent =
    visibleEvents.find((event) => event.id === selectedEventId) ?? visibleEvents[0] ?? events[0];

  useEffect(() => {
    if (!showFlowForm) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowFlowForm(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showFlowForm]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setActiveTab("events");
        window.requestAnimationFrame(() => searchInputRef.current?.focus());
      }
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function navigate(tab: TabId) {
    setActiveTab(tab);
    setMobileNavOpen(false);
    setNotificationsOpen(false);
  }

  function clearEventFilters() {
    setStatusFilter("Todos");
    setMethodFilter("Todos");
    setSourceFilter("Todas");
  }

  async function copyEventId(eventId: string) {
    try {
      await navigator.clipboard?.writeText(eventId);
      setToast(`ID ${eventId} copiado`);
    } catch {
      setToast(`ID do evento: ${eventId}`);
    }
  }

  function openNotification(notification: NotificationItem) {
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item,
      ),
    );
    clearEventFilters();
    setQuery("");
    setSelectedEventId(notification.eventId);
    navigate("events");
  }

  function markAllNotificationsRead() {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setToast("Todas as notificações foram marcadas como lidas");
  }

  async function testDestination(destinationId: string) {
    const destination = destinations.find((item) => item.id === destinationId);
    if (!destination || testingDestinationId) return;
    setTestingDestinationId(destinationId);
    await sleep(700);
    setDestinations((current) =>
      current.map((item) =>
        item.id === destinationId
          ? { ...item, health: "Operacional", lastCheck: "agora" }
          : item,
      ),
    );
    setTestingDestinationId("");
    setToast(`Conexão com ${destination.name} verificada`);
  }

  function toggleDestination(destinationId: string) {
    const destination = destinations.find((item) => item.id === destinationId);
    if (!destination) return;
    setDestinations((current) =>
      current.map((item) =>
        item.id === destinationId ? { ...item, enabled: !item.enabled } : item,
      ),
    );
    setToast(`${destination.name} ${destination.enabled ? "pausado" : "ativado"}`);
  }

  function resolveIncident(incidentId: string) {
    setIncidents((current) =>
      current.map((incident) =>
        incident.id === incidentId ? { ...incident, status: "Resolvido" } : incident,
      ),
    );
    const next = incidents.find(
      (incident) => incident.id !== incidentId && incident.status === "Aberto",
    );
    if (next) setSelectedIncidentId(next.id);
    setToast("Incidente marcado como resolvido");
  }

  async function simulateWebhook() {
    if (running) return;
    setRunning(true);
    setActiveStep(0);

    for (let step = 1; step < 4; step += 1) {
      await sleep(360);
      setActiveStep(step);
    }

    try {
      const remoteEvent = await sendDemoWebhook();
      const now = new Date();
      const timestamp = now.toLocaleTimeString("pt-BR", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const created: ArestaEvent = {
        id: remoteEvent?.id ?? `evt_${crypto.randomUUID().slice(0, 6)}`,
        timestamp: `${timestamp}.000`,
        age: "agora",
        status: remoteEvent?.status === "failed" ? "failed" : "success",
        method: "POST",
        route: "/webhooks/checkout",
        flow: "Checkout → CRM",
        source: "checkout-api",
        target: "hubspot",
        duration:
          remoteEvent?.duration_ms != null ? `${remoteEvent.duration_ms} ms` : "176 ms",
        attempt: 1,
        correlationId: `cor_${crypto.randomUUID().slice(0, 8)}`,
        title: remoteEvent ? "Evento processado pela API" : "Entrega concluída",
        response: remoteEvent?.status === "failed" ? "502 Bad Gateway" : "201 Created",
      };
      setEvents((current) => [created, ...current]);
      setSelectedEventId(created.id);
      setToast(
        remoteEvent
          ? "Evento persistido e entregue pela API Python"
          : "Webhook recebido, transformado e entregue",
      );
    } catch {
      const failedId = `evt_${crypto.randomUUID().slice(0, 6)}`;
      setEvents((current) => [
        {
          ...starterEvents[2],
          id: failedId,
          timestamp: "agora",
          age: "agora",
          title: "API local indisponível",
          response: "Connection refused",
        },
        ...current,
      ]);
      setSelectedEventId(failedId);
      setToast("A API local não respondeu. Confira os containers.");
    }

    setRunning(false);
    await sleep(500);
    setActiveStep(-1);
  }

  async function retryEvent(eventId: string) {
    setSelectedEventId(eventId);
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId
          ? {
              ...event,
              status: "processing",
              title: "Executando nova tentativa",
              response: "Aguardando destino",
            }
          : event,
      ),
    );

    await sleep(900);
    const remoteEvent = await retryRemoteEvent(eventId).catch(() => null);
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId
          ? {
              ...event,
              status: "success",
              title: "Retry concluído",
              response: "200 OK",
              age: "agora",
              attempt: event.attempt + 1,
              duration:
                remoteEvent?.duration_ms != null ? `${remoteEvent.duration_ms} ms` : "1.82 s",
            }
          : event,
      ),
    );
    setToast("Evento reenviado com a mesma chave de idempotência");
  }

  function createFlow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "Novo fluxo");
    const source = String(data.get("source") || "Webhook");
    const target = String(data.get("target") || "API REST");
    const format = data.get("format") === "XML" ? "XML" : "JSON";

    setFlows((current) => [
      {
        id: `flow-${Date.now()}`,
        name,
        source,
        target,
        format,
        status: "Ativo",
        successRate: "—",
        lastRun: "aguardando evento",
        volume: "0",
      },
      ...current,
    ]);
    setShowFlowForm(false);
    setActiveTab("flows");
    setToast(`Fluxo “${name}” criado`);
  }

  return (
    <div className="aresta-shell">
      <aside className={mobileNavOpen ? "sidebar open" : "sidebar"}>
        <div className="brand-row">
          <button
            className="brand"
            type="button"
            onClick={() => navigate("overview")}
            aria-label="Abrir visão geral do Aresta"
          >
            <span className="brand-mark" aria-hidden="true">
              <Network size={19} strokeWidth={2.1} />
            </span>
            <span>Aresta</span>
          </button>
          <button
            className="mobile-close"
            type="button"
            aria-label="Fechar navegação"
            onClick={() => setMobileNavOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="environment-switcher environment-static" aria-label="Ambiente de produção ativo">
          <span className="environment-icon"><Server size={15} /></span>
          <span><small>AMBIENTE</small><strong>Produção</strong></span>
          <span className="environment-state"><span className="live-dot" />ON</span>
        </div>

        <nav className="side-nav" aria-label="Navegação principal">
          <span className="nav-label">MONITORAMENTO</span>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              className={activeTab === id ? "side-nav-item active" : "side-nav-item"}
              key={id}
              type="button"
              onClick={() => navigate(id)}
              aria-label={label}
              aria-current={activeTab === id ? "page" : undefined}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "incidents" && openIncidents.length > 0 && <span className="nav-count">{openIncidents.length}</span>}
            </button>
          ))}
          <span className="nav-label secondary">CONFIGURAÇÃO</span>
          <button
            className={activeTab === "destinations" ? "side-nav-item active" : "side-nav-item"}
            type="button"
            onClick={() => navigate("destinations")}
            aria-current={activeTab === "destinations" ? "page" : undefined}
          >
            <Settings2 size={17} strokeWidth={1.8} />
            <span>Destinos</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="service-line">
            <span className="live-dot" />
            <span><strong>Todos os serviços</strong><small>{isApiConfigured() ? "API Python conectada" : "Modo demonstração"}</small></span>
          </div>
          <div className="version-line"><span>aresta</span><code>v0.1.0</code></div>
        </div>
      </aside>

      {mobileNavOpen && <button className="nav-scrim" onClick={() => setMobileNavOpen(false)} aria-label="Fechar menu" />}

      <div className="workspace">
        <header className="topbar">
          <button className="mobile-menu" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Abrir navegação">
            <Layers3 size={18} />
          </button>
          <div className="breadcrumb"><span>aresta</span><ChevronRight size={13} /><strong>production</strong></div>
          <label className="global-search">
            <Search size={15} />
            <span className="sr-only">Buscar eventos</span>
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setActiveTab("events")}
              placeholder="Buscar evento, fluxo ou correlation ID"
            />
            <kbd>Ctrl K</kbd>
          </label>
          <div className="notification-wrap">
            <button
              className="topbar-icon"
              type="button"
              aria-label="Abrir notificações"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell size={17} />
              {unreadNotifications > 0 && <span className="notification-badge">{unreadNotifications}</span>}
            </button>
            {notificationsOpen && (
              <section className="notification-popover" aria-label="Notificações recentes">
                <div className="notification-head">
                  <div><span className="mono-label">CENTRAL</span><h2>Notificações</h2></div>
                  <button
                    className="quiet-button"
                    type="button"
                    onClick={markAllNotificationsRead}
                    disabled={unreadNotifications === 0}
                  >
                    Marcar lidas
                  </button>
                </div>
                <div className="notification-list">
                  {notifications.map((notification) => (
                    <button
                      className={notification.read ? "notification-item read" : "notification-item"}
                      key={notification.id}
                      type="button"
                      onClick={() => openNotification(notification)}
                    >
                      <span className={`notification-dot ${notification.tone}`} />
                      <span><strong>{notification.title}</strong><small>{notification.copy}</small></span>
                      <time>{notification.time}</time>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
          <span className="avatar" aria-label="Usuário Daniel">DM</span>
        </header>

        <main className="main-content">
          {activeTab === "overview" && (
            <Overview
              activeStep={activeStep}
              events={visibleEvents}
              onRun={simulateWebhook}
              onRetry={retryEvent}
              onSelect={setSelectedEventId}
              onCopy={copyEventId}
              running={running}
              selectedEvent={selectedEvent}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
            />
          )}
          {activeTab === "events" && (
            <EventsView
              events={visibleEvents}
              availableSources={availableSources}
              methodFilter={methodFilter}
              onClearFilters={clearEventFilters}
              onMethodFilter={setMethodFilter}
              onRetry={retryEvent}
              onSelect={setSelectedEventId}
              onCopy={copyEventId}
              onQueryChange={setQuery}
              onSourceFilter={setSourceFilter}
              query={query}
              selectedEvent={selectedEvent}
              sourceFilter={sourceFilter}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
            />
          )}
          {activeTab === "flows" && (
            <FlowsView flows={flows} onCreate={() => setShowFlowForm(true)} />
          )}
          {activeTab === "incidents" && (
            <IncidentsView
              incidents={incidents}
              onResolve={resolveIncident}
              onRetry={retryEvent}
              onSelect={setSelectedIncidentId}
              selectedIncidentId={selectedIncidentId}
            />
          )}
          {activeTab === "destinations" && (
            <DestinationsView
              destinations={destinations}
              onTest={testDestination}
              onToggle={toggleDestination}
              testingId={testingDestinationId}
            />
          )}
        </main>
      </div>

      <button className="floating-create" type="button" onClick={() => setShowFlowForm(true)}>
        <Plus size={17} /> Novo fluxo
      </button>

      {showFlowForm && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-flow-title">
            <div className="modal-header">
              <div><span className="mono-label">FLOW / CREATE</span><h2 id="new-flow-title">Novo fluxo</h2></div>
              <button className="icon-button" type="button" onClick={() => setShowFlowForm(false)} aria-label="Fechar formulário"><X size={18} /></button>
            </div>
            <form className="flow-form" onSubmit={createFlow}>
              <label>Nome do fluxo<input name="name" defaultValue="Pedidos → ERP" required /></label>
              <div className="form-row">
                <label>Origem<select name="source" defaultValue="Webhook"><option>Webhook</option><option>API REST</option><option>Fila</option></select></label>
                <label>Destino<select name="target" defaultValue="API REST"><option>API REST</option><option>HubSpot</option><option>Slack</option><option>Banco de dados</option></select></label>
              </div>
              <fieldset>
                <legend>Formato do payload</legend>
                <label className="radio-option"><input name="format" type="radio" value="JSON" defaultChecked />JSON</label>
                <label className="radio-option"><input name="format" type="radio" value="XML" />XML</label>
              </fieldset>
              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setShowFlowForm(false)}>Cancelar</button>
                <button className="primary-button" type="submit">Criar fluxo</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  );
}

function Overview({
  activeStep,
  events,
  onCopy,
  onRun,
  onRetry,
  onSelect,
  running,
  selectedEvent,
  statusFilter,
  onStatusFilter,
}: {
  activeStep: number;
  events: ArestaEvent[];
  onCopy: (id: string) => void;
  onRun: () => void;
  onRetry: (id: string) => void;
  onSelect: (id: string) => void;
  running: boolean;
  selectedEvent: ArestaEvent;
  statusFilter: StatusFilter;
  onStatusFilter: (status: StatusFilter) => void;
}) {
  return (
    <section className="page-view">
      <PageHeader
        kicker="OBSERVABILIDADE / TEMPO REAL"
        title="Visão geral"
        copy="Tráfego, latência e falhas das integrações em produção."
        action={
          <button className="primary-button" type="button" onClick={onRun} disabled={running}>
            {running ? <RefreshCw className="spin" size={16} /> : <Send size={16} />}
            {running ? "Processando" : "Simular webhook"}
          </button>
        }
      />

      <MetricsStrip />

      <div className="monitor-grid">
        <section className="data-panel log-explorer" aria-label="Tráfego recente">
          <PanelHeader title="Tráfego recente" count={`${events.length} eventos`}>
            <span className="stream-state"><span className="live-dot" />LIVE</span>
            <StatusSelect value={statusFilter} onChange={onStatusFilter} />
          </PanelHeader>
          <EventTable events={events.slice(0, 6)} selectedId={selectedEvent.id} onSelect={onSelect} />
        </section>

        <EventDetail event={selectedEvent} activeStep={activeStep} onCopy={onCopy} onRetry={onRetry} />
      </div>
    </section>
  );
}

function MetricsStrip() {
  const metrics = [
    { label: "EVENTOS / 24H", value: "24.891", delta: "+8,2%", tone: "positive" },
    { label: "TAXA DE SUCESSO", value: "98,7%", delta: "+0,4%", tone: "positive" },
    { label: "LATÊNCIA P95", value: "1,82 s", delta: "−120 ms", tone: "positive" },
    { label: "DEAD LETTER", value: "3", delta: "+2 hoje", tone: "negative" },
  ];
  return (
    <section className="metrics-strip" aria-label="Resumo da operação">
      {metrics.map((metric) => (
        <div className="metric" key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small className={metric.tone}>{metric.delta}</small>
        </div>
      ))}
    </section>
  );
}

function EventTable({
  events,
  selectedId,
  onSelect,
}: {
  events: ArestaEvent[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (!events.length) {
    return <div className="empty-state"><Inbox size={24} /><strong>Nenhum evento encontrado</strong><span>Ajuste a busca ou os filtros.</span></div>;
  }

  return (
    <div className="event-table" role="table" aria-label="Eventos de integração">
      <div className="event-table-head" role="row">
        <span>Horário</span><span>Status</span><span>Rota</span><span>Fluxo</span><span>Duração</span><span />
      </div>
      {events.map((event) => (
        <button
          className={selectedId === event.id ? "event-table-row selected" : "event-table-row"}
          key={event.id}
          type="button"
          onClick={() => onSelect(event.id)}
          role="row"
        >
          <code>{event.timestamp}</code>
          <span className={`event-status ${event.status}`}><span className="status-pip" />{statusLabels[event.status]}</span>
          <span className="route-cell"><code>{event.method}</code><span>{event.route}</span></span>
          <span className="flow-cell"><strong>{event.flow}</strong><small>{event.source} → {event.target}</small></span>
          <code className="duration-cell">{event.duration}</code>
          <ChevronRight className="row-chevron" size={15} />
        </button>
      ))}
    </div>
  );
}

function EventDetail({
  event,
  activeStep,
  onCopy,
  onRetry,
}: {
  event: ArestaEvent;
  activeStep: number;
  onCopy: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const stages = [
    { label: "Recebido", meta: "HMAC verificado", icon: Webhook },
    { label: "Validado", meta: "Schema válido", icon: ShieldCheck },
    { label: "Transformado", meta: "4 campos mapeados", icon: Braces },
    { label: "Entregue", meta: event.response, icon: Zap },
  ];
  const failedIndex = event.status === "failed" || event.status === "retry" ? 3 : -1;

  return (
    <aside className="data-panel detail-panel" aria-label="Detalhes do evento">
      <div className="detail-heading">
        <div><span className="mono-label">EVENT DETAIL</span><h2>{event.id}</h2></div>
        <button className="icon-button" type="button" aria-label="Copiar ID" onClick={() => onCopy(event.id)}><Copy size={15} /></button>
      </div>
      <div className="detail-summary">
        <span className={`event-status ${event.status}`}><span className="status-pip" />{statusLabels[event.status]}</span>
        <span>{event.age}</span>
      </div>

      <div className="event-outcome">
        <span>{event.title}</span>
        <code>{event.response}</code>
      </div>

      <div className="trace">
        {stages.map(({ label, meta, icon: Icon }, index) => {
          const processing = activeStep === index || (event.status === "processing" && index === 3);
          const failed = failedIndex === index;
          return (
            <div className={`trace-step ${processing ? "processing" : ""} ${failed ? "failed" : ""}`} key={label}>
              <span className="trace-icon">{processing ? <RefreshCw className="spin" size={14} /> : failed ? <X size={14} /> : <Icon size={14} />}</span>
              <div><strong>{label}</strong><small>{meta}</small></div>
              <code>{index === 0 ? "0 ms" : index === 1 ? "12 ms" : index === 2 ? "31 ms" : event.duration}</code>
            </div>
          );
        })}
      </div>

      <div className="detail-meta-grid">
        <span><small>CORRELATION ID</small><code>{event.correlationId}</code></span>
        <span><small>TENTATIVA</small><strong>{event.attempt} / 4</strong></span>
      </div>

      <div className="payload-block">
        <div><span>Payload</span><code>JSON</code></div>
        <pre>{`{\n  "order_id": "ord_1048",\n  "email": "cliente@exemplo.com",\n  "amount": 189.90\n}`}</pre>
      </div>

      {(event.status === "failed" || event.status === "retry") && (
        <button className="retry-action" type="button" onClick={() => onRetry(event.id)}>
          <RefreshCw size={15} /> Tentar novamente
        </button>
      )}
    </aside>
  );
}

function EventsView({
  availableSources,
  events,
  methodFilter,
  onClearFilters,
  onCopy,
  onMethodFilter,
  onQueryChange,
  onRetry,
  onSelect,
  onSourceFilter,
  query,
  selectedEvent,
  sourceFilter,
  statusFilter,
  onStatusFilter,
}: {
  availableSources: string[];
  events: ArestaEvent[];
  methodFilter: MethodFilter;
  onClearFilters: () => void;
  onCopy: (id: string) => void;
  onMethodFilter: (value: MethodFilter) => void;
  onQueryChange: (value: string) => void;
  onRetry: (id: string) => void;
  onSelect: (id: string) => void;
  onSourceFilter: (value: string) => void;
  query: string;
  selectedEvent: ArestaEvent;
  sourceFilter: string;
  statusFilter: StatusFilter;
  onStatusFilter: (status: StatusFilter) => void;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const extraFilterCount = Number(methodFilter !== "Todos") + Number(sourceFilter !== "Todas");

  return (
    <section className="page-view">
      <PageHeader kicker="LOG EXPLORER" title="Eventos" copy="Inspecione cada execução do recebimento à entrega." />
      <div className="event-toolbar">
        <label className="search-box"><Search size={15} /><span className="sr-only">Buscar eventos</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar por fluxo ou ID" /></label>
        <StatusSelect value={statusFilter} onChange={onStatusFilter} />
        <button
          className={showFilters ? "secondary-button active-filter" : "secondary-button"}
          type="button"
          onClick={() => setShowFilters((open) => !open)}
          aria-expanded={showFilters}
        >
          <Filter size={15} />Mais filtros{extraFilterCount > 0 && <span className="filter-count">{extraFilterCount}</span>}
        </button>
        <span className="toolbar-spacer" />
        <span className="result-count">{events.length} resultados</span>
      </div>
      {showFilters && (
        <div className="advanced-filters">
          <label className="filter-field">Método<select value={methodFilter} onChange={(event) => onMethodFilter(event.target.value as MethodFilter)}><option>Todos</option><option>POST</option><option>PUT</option></select></label>
          <label className="filter-field">Origem<select value={sourceFilter} onChange={(event) => onSourceFilter(event.target.value)}><option>Todas</option>{availableSources.map((source) => <option key={source}>{source}</option>)}</select></label>
          <button className="quiet-button clear-filters" type="button" onClick={onClearFilters}>Limpar filtros</button>
        </div>
      )}
      <div className="monitor-grid events-grid">
        <section className="data-panel"><EventTable events={events} selectedId={selectedEvent.id} onSelect={onSelect} /></section>
        <EventDetail event={selectedEvent} activeStep={-1} onCopy={onCopy} onRetry={onRetry} />
      </div>
    </section>
  );
}

function FlowsView({ flows, onCreate }: { flows: Flow[]; onCreate: () => void }) {
  return (
    <section className="page-view">
      <PageHeader
        kicker="ROTEAMENTO"
        title="Fluxos"
        copy="Origens, transformações e destinos com rastreabilidade ponta a ponta."
        action={<button className="primary-button" type="button" onClick={onCreate}><Plus size={16} />Novo fluxo</button>}
      />
      <section className="data-panel flow-table">
        <div className="table-header flow-columns"><span>Fluxo</span><span>Rota</span><span>Formato</span><span>Eventos / 24h</span><span>Sucesso</span><span>Status</span></div>
        {flows.map((flow) => (
          <div className="table-row flow-columns" key={flow.id}>
            <div className="flow-name"><span className="flow-glyph"><Network size={16} /></span><span><strong>{flow.name}</strong><small>{flow.lastRun}</small></span></div>
            <span className="integration-route"><span>{flow.source}</span><ChevronRight size={14} /><span>{flow.target}</span></span>
            <span className="format-badge"><FileJson2 size={13} />{flow.format}</span>
            <code>{flow.volume}</code>
            <strong>{flow.successRate}</strong>
            <span className={`flow-status ${flow.status === "Ativo" ? "active" : flow.status === "Com falha" ? "failed" : "paused"}`}><span className="status-pip" />{flow.status}</span>
          </div>
        ))}
      </section>
    </section>
  );
}

function IncidentsView({
  incidents,
  onResolve,
  onRetry,
  onSelect,
  selectedIncidentId,
}: {
  incidents: Incident[];
  onResolve: (id: string) => void;
  onRetry: (id: string) => void;
  onSelect: (id: string) => void;
  selectedIncidentId: string;
}) {
  const [ascending, setAscending] = useState(true);
  const openIncidents = incidents
    .filter((incident) => incident.status === "Aberto")
    .sort((first, second) =>
      ascending ? first.priority - second.priority : second.priority - first.priority,
    );
  const selected =
    openIncidents.find((incident) => incident.id === selectedIncidentId) ?? openIncidents[0];
  const priorityName = selected?.priority === 1 ? "ALTA" : selected?.priority === 2 ? "MÉDIA" : "BAIXA";
  const severityClass = selected?.priority === 1 ? "high" : selected?.priority === 2 ? "medium" : "low";

  return (
    <section className="page-view">
      <PageHeader kicker="TRIAGEM" title="Incidentes" copy="Falhas agrupadas por causa provável e impacto operacional." />
      <div className="incident-layout">
        <section className="data-panel incident-list">
          <PanelHeader title="Abertos" count={`${openIncidents.length} incidentes`}>
            <button className="quiet-button" type="button" onClick={() => setAscending((value) => !value)}>
              Prioridade {ascending ? "P1 → P3" : "P3 → P1"} <ChevronDown className={ascending ? "" : "flip"} size={14} />
            </button>
          </PanelHeader>
          {openIncidents.map((incident) => {
            const tone = incident.priority === 1 ? "high" : incident.priority === 2 ? "medium" : "low";
            return (
              <button
                className={selected?.id === incident.id ? "incident-item selected" : "incident-item"}
                key={incident.id}
                type="button"
                onClick={() => onSelect(incident.id)}
              >
                <span className={`severity ${tone}`}>P{incident.priority}</span>
                <span><strong>{incident.title}</strong><small>{incident.flow} · {incident.events} {incident.events === 1 ? "evento" : "eventos"}</small></span>
                <ChevronRight size={15} />
              </button>
            );
          })}
          {!openIncidents.length && <div className="empty-state"><CheckCircle2 size={24} /><strong>Nenhum incidente aberto</strong><span>A operação está normalizada.</span></div>}
        </section>
        {selected ? (
          <section className="data-panel incident-detail">
            <div className="incident-detail-head"><div><span className={`severity ${severityClass}`}>P{selected.priority} · {priorityName}</span><h2>{selected.title}</h2></div><span className="event-status failed"><span className="status-pip" />{selected.status}</span></div>
            <p>{selected.summary}</p>
            <div className="incident-facts"><span><small>PRIMEIRO EVENTO</small><strong>{selected.firstEvent}</strong></span><span><small>ÚLTIMA TENTATIVA</small><strong>{selected.lastAttempt}</strong></span><span><small>CORRELATION ID</small><code>{selected.correlationId}</code></span></div>
            <div className="cause-box"><CircleAlert size={18} /><div><span>CAUSA PROVÁVEL</span><strong>{selected.cause}</strong><p>{selected.recommendation}</p></div></div>
            <div className="incident-actions"><button className="primary-button" type="button" onClick={() => onRetry(selected.eventId)}><RefreshCw size={15} />Executar retry</button><button className="secondary-button" type="button" onClick={() => onResolve(selected.id)}>Marcar como resolvido</button></div>
          </section>
        ) : (
          <section className="data-panel incident-detail incident-empty"><CheckCircle2 size={28} /><h2>Fila de incidentes limpa</h2><p>Não há nenhuma falha aberta para investigar agora.</p></section>
        )}
      </div>
    </section>
  );
}

function DestinationsView({
  destinations,
  onTest,
  onToggle,
  testingId,
}: {
  destinations: Destination[];
  onTest: (id: string) => void;
  onToggle: (id: string) => void;
  testingId: string;
}) {
  return (
    <section className="page-view">
      <PageHeader kicker="CONFIGURAÇÃO" title="Destinos" copy="Conexões usadas pelos fluxos para entregar dados processados." />
      <section className="data-panel destination-table">
        <div className="table-header destination-columns"><span>Destino</span><span>Endpoint</span><span>Saúde</span><span>Último teste</span><span>Estado</span><span>Ação</span></div>
        {destinations.map((destination) => (
          <div className="table-row destination-columns" key={destination.id}>
            <div className="destination-name"><span className="flow-glyph"><Server size={16} /></span><span><strong>{destination.name}</strong><small>{destination.kind}</small></span></div>
            <code className="endpoint-cell">{destination.endpoint}</code>
            <span className={`destination-health ${destination.health === "Operacional" ? "healthy" : "unstable"}`}><span className="status-pip" />{destination.health}</span>
            <span className="destination-check">{destination.lastCheck}</span>
            <button
              className={destination.enabled ? "toggle-button enabled" : "toggle-button"}
              type="button"
              onClick={() => onToggle(destination.id)}
              aria-pressed={destination.enabled}
              aria-label={`${destination.enabled ? "Pausar" : "Ativar"} ${destination.name}`}
            >
              <span />{destination.enabled ? "Ativo" : "Pausado"}
            </button>
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={() => onTest(destination.id)}
              disabled={!destination.enabled || Boolean(testingId)}
            >
              {testingId === destination.id ? <RefreshCw className="spin" size={14} /> : <Check size={14} />}
              {testingId === destination.id ? "Testando" : "Testar conexão"}
            </button>
          </div>
        ))}
      </section>
    </section>
  );
}

function PageHeader({ kicker, title, copy, action }: { kicker: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><span className="mono-label">{kicker}</span><h1>{title}</h1><p>{copy}</p></div>{action}</div>;
}

function PanelHeader({ title, count, children }: { title: string; count: string; children?: React.ReactNode }) {
  return <div className="panel-header"><div><h2>{title}</h2><span>{count}</span></div><div className="panel-actions">{children}</div></div>;
}

function StatusSelect({ value, onChange }: { value: StatusFilter; onChange: (value: StatusFilter) => void }) {
  return (
    <label className="select-control"><span className="sr-only">Filtrar por status</span><span className="filter-icon"><Filter size={13} /></span><select value={value} onChange={(event) => onChange(event.target.value as StatusFilter)}><option>Todos</option><option>Sucesso</option><option>Retry</option><option>Falha</option></select><ChevronDown size={13} /></label>
  );
}
