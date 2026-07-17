# Smart-search Function proxy (production backend)

Cloud version of `../smart-search-proxy.py`. Lets the public GitHub Pages site
use **Smart search** by calling the Foundry agent server-side with a **managed
identity** — no secret in the browser or in config.

## Architecture

```
GitHub Pages (static)  --GET /api/search?q=...-->  Function App  --Bearer(MI)-->  Foundry agent (gpt-4.1)
```

## One-time deploy (Azure CLI, no func core tools needed)

Values used here match the current demo deployment; change as needed.

```powershell
$RG   = "zhenjiao-ncus"
$LOC  = "northcentralus"
$SUB  = "1756abc0-3554-4341-8d6a-46674962ea19"
$APP  = "sample-finder-proxy-<unique>"     # must be globally unique
$STOR = "sffinderproxy<unique>"            # 3-24 lc alnum, globally unique
$PROJECT = "/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.CognitiveServices/accounts/zhenjiao-devtest-ncus-resource/projects/zhenjiao-devtest-ncus"
$PAGES_ORIGIN = "https://kimizhu.github.io"

az account set --subscription $SUB

# 1. Storage (required by Functions)
az storage account create -n $STOR -g $RG -l $LOC --sku Standard_LRS

# 2. Function App (Linux Consumption, Python)
az functionapp create -n $APP -g $RG -s $STOR `
  --consumption-plan-location $LOC --runtime python --runtime-version 3.11 `
  --functions-version 4 --os-type Linux --assign-identity "[system]"

# 3. App settings (agent target)
az functionapp config appsettings set -n $APP -g $RG --settings `
  "SF_AGENT_ENDPOINT=https://zhenjiao-devtest-ncus-resource.services.ai.azure.com/api/projects/zhenjiao-devtest-ncus/agents/agent-framework-agent-basic-responses/endpoint/protocols/openai/responses?api-version=v1" `
  "SF_AGENT_MODEL=agent-framework-agent-basic-responses" `
  "SF_TOKEN_SCOPE=https://ai.azure.com/.default"

# 4. Grant the managed identity access to the Foundry project
$PRINCIPAL = az functionapp identity show -n $APP -g $RG --query principalId -o tsv
az role assignment create --assignee $PRINCIPAL `
  --role "Azure AI User" --scope $PROJECT

# 5. Lock CORS to the Pages origin
az functionapp cors add -n $APP -g $RG --allowed-origins $PAGES_ORIGIN

# 6. Deploy the code (remote Oryx build)
Compress-Archive -Path * -DestinationPath ../smart-search-func.zip -Force
az functionapp deployment source config-zip -n $APP -g $RG `
  --src ../smart-search-func.zip --build-remote true
```

## Wire the site

Set the proxy base in `index.html` (before `app.js`):

```html
<script>window.SF_SMART_PROXY = "https://<APP>.azurewebsites.net/api";</script>
```

Then Smart search on the public site calls this function instead of localhost.

## Notes

- **No secret anywhere** — the token comes from the Function App's system-assigned
  managed identity via `DefaultAzureCredential`.
- The agent lives on a **TTL = 3-day** subscription, so this is a demo backend.
  For a permanent site, redeploy the agent to a lasting project and update
  `SF_AGENT_ENDPOINT`.
- If Smart search fails for any reason, the site falls back to offline keyword
  search automatically.
