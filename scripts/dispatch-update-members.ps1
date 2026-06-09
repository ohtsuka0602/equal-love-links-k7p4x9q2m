[CmdletBinding()]
param(
  [string]$Owner = $(if ($env:GITHUB_OWNER) { $env:GITHUB_OWNER } else { "ohtsuka0602" }),
  [string]$Repo = $(if ($env:GITHUB_REPO_NAME) { $env:GITHUB_REPO_NAME } else { "equal-love-links-k7p4x9q2m" }),
  [string]$Workflow = $(if ($env:GITHUB_WORKFLOW_FILE) { $env:GITHUB_WORKFLOW_FILE } else { "update-members.yml" }),
  [string]$Ref = $(if ($env:GITHUB_REF_NAME) { $env:GITHUB_REF_NAME } else { "main" }),
  [string]$Token = $(if ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN } else { $env:GH_TOKEN }),
  [int]$RunPollSeconds = 120,
  [int]$RunPollIntervalSeconds = 5,
  [switch]$WaitForCompletion,
  [int]$CompletionTimeoutSeconds = 1200
)

$ErrorActionPreference = "Stop"

function Stop-WithMessage {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

function Invoke-GitHubJson {
  param([string]$Uri)
  Invoke-RestMethod -Method Get -Uri $Uri -Headers $script:Headers
}

if (-not $Token) {
  Stop-WithMessage "Set GITHUB_TOKEN or GH_TOKEN to a token that can dispatch the workflow."
}

$ApiVersion = "2022-11-28"
$BaseUri = "https://api.github.com/repos/$Owner/$Repo/actions/workflows/$Workflow"
$DispatchUri = "$BaseUri/dispatches"
$RequestedAt = (Get-Date).ToUniversalTime().AddSeconds(-5)
$BranchQuery = [uri]::EscapeDataString($Ref)

$script:Headers = @{
  "Accept" = "application/vnd.github+json"
  "Authorization" = "Bearer $Token"
  "X-GitHub-Api-Version" = $ApiVersion
  "User-Agent" = "equal-love-links-dispatch"
}

$Body = @{ ref = $Ref } | ConvertTo-Json -Compress

try {
  $Response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $DispatchUri -Headers $Headers -ContentType "application/json" -Body $Body
  $StatusCode = [int]$Response.StatusCode
} catch {
  $StatusCode = $null
  $ResponseBody = ""

  if ($_.Exception.Response) {
    try {
      $StatusCode = [int]$_.Exception.Response.StatusCode
      $Stream = $_.Exception.Response.GetResponseStream()
      if ($Stream) {
        $Reader = New-Object System.IO.StreamReader($Stream)
        $ResponseBody = $Reader.ReadToEnd()
      }
    } catch {
      $ResponseBody = $_.Exception.Message
    }
  }

  Write-Host "Dispatch HTTP status: $StatusCode"
  if ($ResponseBody) { Write-Host $ResponseBody }
  exit 1
}

Write-Host "Dispatch HTTP status: $StatusCode"

if ($StatusCode -ne 204 -and $StatusCode -ne 200) {
  if ($Response.Content) { Write-Host $Response.Content }
  Stop-WithMessage "Dispatch failed. Expected HTTP 204 No Content, or HTTP 200 on newer GitHub API responses."
}

$DispatchedRunId = $null
if ($Response.Content) {
  try {
    $ResponseJson = $Response.Content | ConvertFrom-Json
    $DispatchedRunId = $ResponseJson.workflow_run_id
    if ($ResponseJson.html_url) {
      Write-Host "Dispatch response run URL: $($ResponseJson.html_url)"
    }
  } catch {
    # Older API versions commonly return 204 with no body.
  }
}

$Run = $null
$Deadline = (Get-Date).AddSeconds($RunPollSeconds)
$RunsUri = "$BaseUri/runs?event=workflow_dispatch&branch=$BranchQuery&per_page=10"

while ((Get-Date) -lt $Deadline) {
  $Runs = Invoke-GitHubJson -Uri $RunsUri
  $Candidates = @($Runs.workflow_runs | Where-Object {
    $_.event -eq "workflow_dispatch" -and ([DateTime]$_.created_at).ToUniversalTime() -ge $RequestedAt
  } | Sort-Object -Property created_at -Descending)

  if ($DispatchedRunId) {
    $Run = @($Runs.workflow_runs | Where-Object { $_.id -eq $DispatchedRunId } | Select-Object -First 1)
  }

  if (-not $Run -and $Candidates.Count -gt 0) {
    $Run = $Candidates[0]
  }

  if ($Run) { break }
  Start-Sleep -Seconds $RunPollIntervalSeconds
}

if (-not $Run) {
  Stop-WithMessage "Dispatch returned success, but no workflow_dispatch run was found within $RunPollSeconds seconds."
}

Write-Host "Run created:"
Write-Host "  id: $($Run.id)"
Write-Host "  head_sha: $($Run.head_sha)"
Write-Host "  status: $($Run.status)"
Write-Host "  conclusion: $($Run.conclusion)"
Write-Host "  url: $($Run.html_url)"

if (-not $WaitForCompletion) {
  exit 0
}

$RunUri = "https://api.github.com/repos/$Owner/$Repo/actions/runs/$($Run.id)"
$CompletionDeadline = (Get-Date).AddSeconds($CompletionTimeoutSeconds)

while ((Get-Date) -lt $CompletionDeadline) {
  $Run = Invoke-GitHubJson -Uri $RunUri
  Write-Host "Run status: $($Run.status), conclusion: $($Run.conclusion)"

  if ($Run.status -eq "completed") {
    if ($Run.conclusion -eq "success") {
      Write-Host "Run completed successfully: $($Run.html_url)"
      exit 0
    }

    Stop-WithMessage "Run completed with conclusion '$($Run.conclusion)': $($Run.html_url)"
  }

  Start-Sleep -Seconds 15
}

Stop-WithMessage "Run did not complete within $CompletionTimeoutSeconds seconds: $($Run.html_url)"