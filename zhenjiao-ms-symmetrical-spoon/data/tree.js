// AUTO-GENERATED from data/tree.json by tools/build-data.py. Do not edit by hand.
window.HA_TREE = {
  "meta": {
    "model": "blocks",
    "source": "microsoft-foundry/foundry-samples",
    "note": "Building-blocks model: a Foundry base agent plus capability blocks you stack on top. Each block lists consolidated capabilities ('families'); a family's variants are the real framework/protocol samples for that capability. SDK-dot coverage (meta.sdks legend, 3 SDKs) is derived from the variants' 'sdk' field in samples.json. Voice/WebSocket samples are intentionally excluded.",
    "sdkOrder": [
      "agent-framework",
      "langgraph",
      "native"
    ]
  },
  "groups": [
    {
      "id": "building-blocks",
      "title": "Building blocks",
      "tagline": "Stack capabilities on the base agent",
      "blocks": [
        "tools",
        "knowledge",
        "files",
        "human-async",
        "orchestration",
        "browser",
        "adapters"
      ]
    },
    {
      "id": "production",
      "title": "Production & Trust",
      "tagline": "Run safely and observably in production",
      "blocks": [
        "observability",
        "security",
        "optimization"
      ]
    },
    {
      "id": "ecosystem",
      "title": "Channels & Ecosystem",
      "tagline": "Ship the agent to a Microsoft channel",
      "blocks": [
        "teams"
      ]
    }
  ],
  "base": {
    "id": "base",
    "title": "Foundry base · Basic agent",
    "tagline": "Start here — a minimal chat agent",
    "description": "Every hosted agent starts here: a minimal agent that handles request/response and multi-turn conversation. Pick your framework and protocol below, get it running on Foundry, then stack the building blocks on top.",
    "families": [
      {
        "id": "basic-agent",
        "title": "Basic agent",
        "description": "A minimal chat agent with multi-turn conversation — the same starting point across every framework and protocol.",
        "variants": [
          "af-resp-basic",
          "af-inv-basic",
          "lg-resp-chat",
          "lg-inv-chat",
          "byo-resp-hello-world",
          "byo-inv-hello-world"
        ]
      }
    ]
  },
  "blocks": [
    {
      "id": "tools",
      "title": "Tools, MCP & Skills",
      "tagline": "local tools · MCP · skills · toolbox",
      "description": "Give the agent capabilities: custom local function tools, remote MCP servers, reusable skills, and the managed Foundry toolbox.",
      "families": [
        {
          "id": "local-tools",
          "title": "Local / custom function tools",
          "description": "Define your own Python function tools and let the agent call them.",
          "variants": [
            "af-resp-tools"
          ]
        },
        {
          "id": "mcp",
          "title": "MCP server tools",
          "description": "Connect the agent to remote tools exposed over the Model Context Protocol.",
          "variants": [
            "af-resp-mcp",
            "lg-resp-mcp"
          ]
        },
        {
          "id": "toolbox",
          "title": "Foundry Toolbox (hosted tools)",
          "description": "Use Foundry's managed toolbox of hosted tools (web search, code, and more).",
          "variants": [
            "af-resp-foundry-toolbox",
            "lg-resp-toolbox",
            {
              "id": "byo-resp-langgraph-toolbox",
              "note": "BYO"
            },
            "byo-resp-toolbox",
            "byo-inv-toolbox"
          ]
        },
        {
          "id": "toolbox-user-identity",
          "title": "Toolbox with on-behalf-of user identity",
          "description": "Call toolbox tools as the signed-in user (on-behalf-of auth).",
          "variants": [
            "byo-resp-langgraph-toolbox-user-identity"
          ]
        },
        {
          "id": "skills",
          "title": "Skills",
          "description": "Package reusable, file-based skills the agent can invoke.",
          "variants": [
            "af-resp-skills"
          ]
        },
        {
          "id": "foundry-skills",
          "title": "Foundry Skills",
          "description": "Use Foundry-managed skills for grounded retrieval.",
          "variants": [
            "af-resp-foundry-skills"
          ]
        }
      ]
    },
    {
      "id": "knowledge",
      "title": "Knowledge, RAG & Memory",
      "tagline": "grounding · search · memory",
      "description": "Ground answers in your data: Azure AI Search RAG, semantic memory, and Foundry IQ agentic retrieval.",
      "families": [
        {
          "id": "rag",
          "title": "Azure AI Search RAG",
          "description": "Retrieval-augmented generation grounded in an Azure AI Search index.",
          "variants": [
            "af-resp-azure-search-rag"
          ]
        },
        {
          "id": "memory",
          "title": "Foundry Memory",
          "description": "Give the agent persistent semantic memory across turns and sessions.",
          "variants": [
            "af-resp-foundry-memory"
          ]
        },
        {
          "id": "foundry-iq",
          "title": "Foundry IQ knowledge base",
          "description": "Agentic retrieval over a Foundry IQ knowledge base.",
          "variants": [
            "af-resp-foundry-iq-toolbox"
          ]
        }
      ]
    },
    {
      "id": "files",
      "title": "Files & Documents",
      "tagline": "uploads · code interpreter",
      "description": "Let the agent accept file uploads and work with documents, including a code interpreter.",
      "families": [
        {
          "id": "files",
          "title": "File input & documents",
          "description": "Accept uploaded files and reason over their contents.",
          "variants": [
            "af-resp-files",
            "lg-resp-files"
          ]
        }
      ]
    },
    {
      "id": "human-async",
      "title": "Human-in-the-Loop, Async & Events",
      "tagline": "approvals · background · events",
      "description": "Pause for human approval, run long-running/background work, keep per-user session state, and react to events.",
      "families": [
        {
          "id": "hitl",
          "title": "Human-in-the-loop approvals",
          "description": "Pause the run to collect human approval before continuing.",
          "variants": [
            "lg-resp-hitl",
            "byo-inv-hitl"
          ]
        },
        {
          "id": "notetaking",
          "title": "Note-taking agent",
          "description": "Persist notes/state across turns for a stateful assistant.",
          "variants": [
            "byo-resp-notetaking",
            "byo-inv-notetaking"
          ]
        },
        {
          "id": "session-multiplexing",
          "title": "Session multiplexing",
          "description": "Keep isolated per-user session state on one hosted agent.",
          "variants": [
            "byo-resp-session-multiplexing"
          ]
        },
        {
          "id": "background",
          "title": "Background / long-running agent",
          "description": "Kick off long-running work and return results asynchronously.",
          "variants": [
            "byo-resp-background"
          ]
        },
        {
          "id": "event-grid",
          "title": "Event Grid trigger",
          "description": "React to Azure Event Grid events.",
          "variants": [
            "byo-inv-event-grid"
          ]
        }
      ]
    },
    {
      "id": "orchestration",
      "title": "Multi-Agent & Orchestration",
      "tagline": "workflows · A2A delegation",
      "description": "Coordinate multiple agents: pipelines, declarative routing, and agent-to-agent (A2A) delegation.",
      "families": [
        {
          "id": "workflows",
          "title": "Workflows",
          "description": "Chain steps and sub-agents into a multi-step workflow.",
          "variants": [
            "af-resp-workflows",
            "lg-resp-workflows"
          ]
        },
        {
          "id": "a2a",
          "title": "Agent-to-agent delegation",
          "description": "Delegate work between hosted agents over the A2A protocol.",
          "variants": [
            "af-a2a-delegation",
            "lg-a2a-delegation"
          ]
        },
        {
          "id": "declarative",
          "title": "Declarative agents",
          "description": "Define routing/behavior declaratively (customer-support example).",
          "variants": [
            "af-resp-declarative"
          ]
        }
      ]
    },
    {
      "id": "observability",
      "title": "Observability & Tracing",
      "tagline": "tracing · metrics · App Insights",
      "description": "See what the agent is doing: distributed tracing and metrics wired to Application Insights / OpenTelemetry.",
      "families": [
        {
          "id": "observability",
          "title": "Tracing & observability",
          "description": "Emit distributed traces and metrics to App Insights / OpenTelemetry.",
          "variants": [
            "af-resp-observability",
            "lg-resp-observability"
          ]
        }
      ]
    },
    {
      "id": "security",
      "title": "Security, Governance & Ops",
      "tagline": "identity · guardrails · secrets",
      "description": "Run safely in production: managed identity to downstream Azure services, content-safety guardrails, secrets/connections, and infra diagnostics.",
      "families": [
        {
          "id": "downstream-azure",
          "title": "Downstream Azure auth",
          "description": "Call downstream Azure services with managed identity.",
          "variants": [
            "af-resp-downstream-azure"
          ]
        },
        {
          "id": "content-safety",
          "title": "Content-safety guardrail",
          "description": "Screen inputs/outputs with Azure AI Content Safety.",
          "variants": [
            "af-resp-content-safety"
          ]
        },
        {
          "id": "env-vars",
          "title": "Env vars & secrets",
          "description": "Wire in configuration, secrets, and connections.",
          "variants": [
            "byo-resp-env-vars"
          ]
        },
        {
          "id": "diagnostics",
          "title": "Diagnostics",
          "description": "Diagnose the hosting environment and connectivity.",
          "variants": [
            "byo-inv-diagnostic"
          ]
        }
      ]
    },
    {
      "id": "optimization",
      "title": "Agent Optimization",
      "tagline": "auto-tune instructions (preview)",
      "description": "Automatically improve agent instructions and behavior with the Agent Optimizer (preview).",
      "families": [
        {
          "id": "optimization",
          "title": "Agent optimization (preview)",
          "description": "Auto-tune agent instructions with the Agent Optimizer, shown across a few scenarios.",
          "variants": [
            "af-resp-optimization-travel",
            {
              "id": "byo-resp-optimization-hello-world",
              "note": "hello world"
            },
            {
              "id": "byo-resp-optimization-customer-support",
              "note": "customer support"
            }
          ]
        }
      ]
    },
    {
      "id": "browser",
      "title": "Browser & Computer Use",
      "tagline": "Playwright · scraping",
      "description": "Drive a real browser for scraping and computer-use tasks via Playwright.",
      "families": [
        {
          "id": "browser",
          "title": "Browser automation",
          "description": "Drive a real browser (Playwright) for scraping and computer use.",
          "variants": [
            "af-resp-browser-automation",
            "byo-resp-browser-automation"
          ]
        }
      ]
    },
    {
      "id": "teams",
      "title": "Teams / M365 Channel",
      "tagline": "ship to Microsoft Teams",
      "description": "Ship the agent as a Microsoft Teams / M365 channel using the Activity protocol.",
      "families": [
        {
          "id": "teams",
          "title": "Teams / M365 channel",
          "description": "Expose the agent as a Teams / M365 channel via the Activity protocol.",
          "variants": [
            "af-resp-teams-activity"
          ]
        }
      ]
    },
    {
      "id": "adapters",
      "title": "Other SDKs & Adapters",
      "tagline": "bring another SDK to Foundry",
      "description": "Bring a different SDK to Foundry: LangGraph graphs, the OpenAI Agents SDK, the Claude Agent SDK, Pydantic AI (AG-UI), or the GitHub Copilot SDK.",
      "families": [
        {
          "id": "langgraph-byo",
          "title": "LangGraph (BYO integration)",
          "description": "Host an existing LangGraph graph on Foundry via the BYO integration.",
          "variants": [
            "byo-resp-langgraph-chat",
            "byo-inv-langgraph-chat"
          ]
        },
        {
          "id": "openai-agents",
          "title": "OpenAI Agents SDK",
          "description": "Run an agent built with the OpenAI Agents SDK on Foundry.",
          "variants": [
            "byo-resp-openai-agents-sdk"
          ]
        },
        {
          "id": "claude",
          "title": "Claude Agent SDK",
          "description": "Run an agent built with the Anthropic Claude Agent SDK on Foundry.",
          "variants": [
            "byo-inv-claude-agent-sdk"
          ]
        },
        {
          "id": "ag-ui",
          "title": "AG-UI (Pydantic AI)",
          "description": "Bridge a Pydantic AI / AG-UI agent to Foundry.",
          "variants": [
            "byo-inv-ag-ui"
          ]
        },
        {
          "id": "github-copilot",
          "title": "GitHub Copilot SDK",
          "description": "Bridge a GitHub Copilot SDK agent to Foundry.",
          "variants": [
            "byo-inv-github-copilot"
          ]
        }
      ]
    }
  ]
};
