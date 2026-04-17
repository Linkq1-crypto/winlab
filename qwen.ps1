param([string]$q)
if (-not $q) { $q = Read-Host "Domanda per Qwen" }
$h = @{ "Authorization" = "Bearer $env:OPENROUTER_API_KEY"; "Content-Type" = "application/json" }
$b = @{ model = "qwen/qwen-2.5-72b-instruct"; messages = @(@{ role = "user"; content = $q }) } | ConvertTo-Json
try { (Invoke-RestMethod -Uri "https://openrouter.ai/api/v1/chat/completions" -Method Post -Headers $h -Body $b -TimeoutSec 30).choices[0].message.content } catch { "❌ $($_.Exception.Message)" }