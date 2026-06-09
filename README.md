# =LOVE SNS Links

=LOVE SNS Links は、メンバー別SNSリンク、YouTube最新動画、ニュース、スケジュールを表示する静的アプリです。

## 自動更新の運用

### 結論

`Update members` の主起動は、GitHub Actions 内蔵の `schedule` ではなく、外部cronから GitHub REST API の `workflow_dispatch` を呼び出す方式です。

これは人間が毎回手動で `Run workflow` を押す運用ではありません。外部cronが定刻にAPIを呼び、`Update members` workflowを自動実行します。

GitHub Actions の `schedule` は `.github/workflows/update-members.yml` に残していますが、これは best-effort の予備扱いです。過去の検証で `schedule` event の run 自体が作成されないケースを確認しているため、本番の更新成立条件としては信用しません。

### 対象workflow

- Repository: `ohtsuka0602/equal-love-links-k7p4x9q2m`
- Workflow file: `.github/workflows/update-members.yml`
- Ref: `main`
- Primary trigger: external cron -> `workflow_dispatch`
- Fallback trigger: GitHub Actions `schedule`

### GitHub REST API 仕様

Endpoint:

```text
POST https://api.github.com/repos/ohtsuka0602/equal-love-links-k7p4x9q2m/actions/workflows/update-members.yml/dispatches
```

Body:

```json
{
  "ref": "main"
}
```

Headers:

```text
Accept: application/vnd.github+json
Authorization: Bearer <token>
X-GitHub-Api-Version: 2022-11-28
Content-Type: application/json
```

GitHub REST APIでは、`workflow_id` にworkflowファイル名を指定できます。`workflow_dispatch` を使うには、workflow側に `workflow_dispatch` event が定義されている必要があります。

GitHub公式ドキュメント:

- Create a workflow dispatch event: https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
- List workflow runs: https://docs.github.com/en/rest/actions/workflow-runs

### Token 権限

推奨は Fine-grained personal access token です。

Fine-grained PAT:

- Repository access: `ohtsuka0602/equal-love-links-k7p4x9q2m` のみ
- Repository permissions: `Actions: Read and write`
- `Metadata: Read-only` は自動で付与されます

Classic PATを使う場合は、GitHub公式ドキュメント上は `repo` scope が必要です。

TokenはスクリプトやREADMEに直書きしません。外部cron側のsecret、または環境変数 `GITHUB_TOKEN` / `GH_TOKEN` に保存します。

### PowerShell で dispatch する

```powershell
$env:GITHUB_TOKEN = "<token>"
./scripts/dispatch-update-members.ps1
```

run作成だけでなく、完了まで確認する場合:

```powershell
$env:GITHUB_TOKEN = "<token>"
./scripts/dispatch-update-members.ps1 -WaitForCompletion
```

成功時は以下を表示します。

- Dispatch HTTP status
- latest `workflow_dispatch` run の `head_sha`
- `status`
- `conclusion`
- run URL

HTTP status は、API version `2022-11-28` では通常 `204 No Content` を成功扱いにします。GitHubの新しいAPIレスポンスでは `200` とrun情報が返る場合があるため、スクリプトは `200` と `204` の両方を成功扱いにしています。

### curl で dispatch する

```sh
export GITHUB_TOKEN="<token>"
sh scripts/dispatch-update-members.curl.sh
```

`node` がある環境では、dispatch後に `event=workflow_dispatch` のrun作成確認も行います。`node` がない環境では、dispatchのHTTP statusのみ確認します。

### 外部cron候補

| 候補 | 実装の簡単さ | コスト | token保管 | ログ確認 | 失敗検知 | コメント |
| --- | --- | --- | --- | --- | --- | --- |
| Cloudflare Workers Cron Triggers | 簡単 | 無料枠あり | Workers Secrets | Workers Logs | 通知連携可 | この規模では最有力。HTTP dispatchとsecret管理がまとまる |
| Google Cloud Scheduler | 中 | 低コスト | Secret Manager併用が安全 | Cloud Logging | Cloud Monitoring | GCPを既に使っているなら安定。Scheduler単体にBearer token直置きより、Cloud Run/Functions経由が安全 |
| 自前サーバーcron | 簡単 | サーバー次第 | OS側secret/env | サーバーログ | 自前実装 | 常時稼働サーバーがある場合のみおすすめ |
| 外部cronサービス | 最も簡単 | 無料/低コスト | サービス側にtoken保存 | サービス次第 | サービス次第 | tokenを第三者サービスに置くため、Fine-grained PATで権限を最小化する |

現時点で最も置きやすい候補は Cloudflare Workers Cron Triggers です。無料枠で足りやすく、`GITHUB_TOKEN` をWorkers Secretとして保存でき、cronからGitHub APIを呼び出せます。

GCP環境を既に使っているなら、Google Cloud Scheduler + Cloud Run/Functions + Secret Manager が安定寄りです。

### 推奨実行時刻

GitHub Actions内蔵 `schedule` の時刻と同じ目的で、外部cronを以下のJSTに設定します。

```text
5:43
11:43
17:43
23:43
```

外部cron側でUTC指定が必要な場合:

```text
20:43 UTC -> 05:43 JST
02:43 UTC -> 11:43 JST
08:43 UTC -> 17:43 JST
14:43 UTC -> 23:43 JST
```

### 失敗時の確認方法

1. 外部cronの実行ログを確認する
   - HTTP status が `204` または `200` か
   - `workflow_dispatch` run URL が出ているか

2. GitHub Actionsのrunを確認する
   - Actions > `Update members`
   - `event=workflow_dispatch` のrunが作成されているか
   - runの `status` / `conclusion` を見る

3. APIで確認する

```powershell
$env:GITHUB_TOKEN = "<token>"
./scripts/dispatch-update-members.ps1
```

または直接:

```sh
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/ohtsuka0602/equal-love-links-k7p4x9q2m/actions/workflows/update-members.yml/runs?event=workflow_dispatch&branch=main&per_page=5"
```

4. workflow runが成功しているのにアプリが古い場合
   - GitHub Pages の deployment run を確認する
   - ブラウザ/PWAの更新ボタンで最新JSONを取得する

### 運用判断

- `schedule` runが作成されなくても、外部cronが `workflow_dispatch` を作成できれば更新運用は成立します。
- 外部cronのdispatchが失敗する場合は、token権限、token期限、外部cronログ、GitHub API rate limitを確認します。
- 人間が毎回手動実行する運用にはしません。手動実行は緊急時の確認・復旧用です。