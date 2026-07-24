# Smart-search proxy (Azure Functions, Flex Consumption)

Small auth/CORS shim that lets the static site use the Foundry hosted agent for
**Smart search**. The static site (`../index.html`, `../app.js`) can't call the
agent directly because it needs an Entra token and the agent endpoint sends no
CORS headers. This function:

1. gets a bearer token from its **managed identity** (`DefaultAzureCredential`) —
   no keys or secrets are stored, and
2. forwards `GET /api/search?q=<text>` to the agent's OpenAI-compatible
   `responses` endpoint, returning the agent JSON with permissive CORS headers.

All ranking logic lives in the Foundry agent; the proxy is stateless. When the
proxy is unreachable, the site silently falls back to offline keyword search.

## Endpoints

| Route             | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| `GET /api/health` | Liveness check → `{"ok": true, "model": "..."}`     |
| `GET /api/search?q=<text>` | Ranked matches `{matches:[{id,why}], understood:[]}` |

## Files

| File                            | Purpose                                        |
| ------------------------------- | ---------------------------------------------- |
| `function_app.py`               | The Python v2 function app (health + search)   |
| `host.json`                     | Functions host config (extension bundle v4)    |
| `requirements.txt`              | `azure-functions`, `azure-identity`            |
| `local.settings.sample.json`    | Template for local `func start` (no secrets)   |

## App settings (in Azure)

| Setting                             | Value                                                        |
| ----------------------------------- | ----------------------------------------------------------- |
| `SF_AGENT_ENDPOINT`                 | Full `responses` URL of the deployed Foundry agent          |
| `SF_AGENT_MODEL`                    | Agent name used as the `model` field                        |
| `SF_TOKEN_SCOPE`                    | `https://ai.azure.com/.default`                             |
| `AzureWebJobsStorage__accountName`  | Storage account name (identity-based; **no** connection string) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights (added automatically on create)            |

## Security model

The proxy runs on **Flex Consumption**, which — unlike the classic Consumption
(Y1) plan — does not need an Azure Files content share, so its storage account
can have **shared-key (local auth) disabled**. Every storage interaction uses
the app's system-assigned managed identity:

- **Deployment package** — `blobContainer` deployment storage with
  `SystemAssignedIdentity` auth (container `deployment-package`).
- **Runtime host state** — `AzureWebJobsStorage__accountName` (identity-based).
- **Foundry agent call** — token from the same managed identity.

### Required role assignments (managed identity → scope)

| Role                             | Scope                                   | Why                              |
| -------------------------------- | --------------------------------------- | -------------------------------- |
| Storage Blob Data Owner          | the proxy storage account               | deployment package + host state  |
| Storage Queue Data Contributor   | the proxy storage account               | host state queues                |
| Cognitive Services User          | the Foundry **account**                 | call the agent                   |
| Foundry User                     | the Foundry **project**                 | call the agent                   |

## Provision + deploy (reproducible)

Requires the Azure CLI. Adjust the variables to your environment.

```bash
RG=zhenjiao-ncus
APP=sample-finder-proxy2-dz098b            # must be globally unique
SA=sffinderpxydz098b                       # storage account (shared key disabled)
LOC=northcentralus                         # must support Flex Consumption
SA_ID=$(az storage account show -n "$SA" -g "$RG" --query id -o tsv)

# 1. Deployment-package container (create with a still-valid auth path).
az storage container create --name deployment-package --account-name "$SA" --auth-mode login

# 2. Create the Flex Consumption app with a system-assigned identity and
#    identity-based deployment storage. Grants Storage Blob Data Owner too.
az functionapp create -g "$RG" -n "$APP" -s "$SA" \
  -f "$LOC" --runtime python --runtime-version 3.11 \
  --assign-identity '[system]' \
  --deployment-storage-auth-type SystemAssignedIdentity \
  --deployment-storage-container-name deployment-package \
  --role "Storage Blob Data Owner" --scope "$SA_ID"

PID=$(az functionapp show -n "$APP" -g "$RG" --query identity.principalId -o tsv)

# 3. Identity-based runtime storage (replace the shared-key connection string).
az functionapp config appsettings delete -n "$APP" -g "$RG" --setting-names AzureWebJobsStorage
az functionapp config appsettings set -n "$APP" -g "$RG" --settings \
  "AzureWebJobsStorage__accountName=$SA" \
  "SF_AGENT_MODEL=agent-framework-agent-basic-responses" \
  "SF_TOKEN_SCOPE=https://ai.azure.com/.default" \
  "SF_AGENT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>/agents/<agent>/endpoint/protocols/openai/responses?api-version=v1"

# 4. Remaining role assignments.
ACCT=/subscriptions/<sub>/resourceGroups/$RG/providers/Microsoft.CognitiveServices/accounts/<resource>
PROJ=$ACCT/projects/<project>
az role assignment create --assignee "$PID" --role "Storage Queue Data Contributor" --scope "$SA_ID"
az role assignment create --assignee "$PID" --role "Cognitive Services User" --scope "$ACCT"
az role assignment create --assignee "$PID" --role "Foundry User" --scope "$PROJ"

# 5. Deploy the code (remote build installs requirements.txt).
cd proxy
az functionapp deployment source config-zip -g "$RG" -n "$APP" \
  --src <(python -c "import shutil;shutil.make_archive('pkg','zip','.')" && echo pkg.zip) \
  --build-remote true
# (or simply: func azure functionapp publish "$APP")

# 6. Now that nothing uses the storage key, disable shared-key auth.
az storage account update -n "$SA" -g "$RG" --allow-shared-key-access false

# 7. Smoke test.
curl "https://$APP.azurewebsites.net/api/health"
curl "https://$APP.azurewebsites.net/api/search?q=browser%20automation"
```

Finally, point the site at the proxy in `../index.html`:

```js
window.SF_SMART_PROXY = "https://<APP>.azurewebsites.net/api";
```

## Local development

You usually don't need to deploy to iterate — `tools/smart-search-proxy.py`
serves the same `/health` and `/search` routes using your `az login` token. To
run *this* function app locally instead:

```bash
cd proxy
cp local.settings.sample.json local.settings.json
func start        # requires Azure Functions Core Tools + `az login`
```
