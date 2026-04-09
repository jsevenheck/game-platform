# Observability Metrics

This document defines the platform Prometheus metrics contract for the HTTP `/metrics` endpoint, plus alert and dashboard seed queries for operators.

> Scope: `apps/platform` service only (party lifecycle and Socket.IO gateway behavior).

## `/metrics` endpoint

- **Path:** `GET /metrics`
- **Format:** Prometheus text exposition format (`text/plain; version=0.0.4`)
- **Auth:** Keep internal-only (cluster network, ingress allowlist, or service mesh policy).
- **Timeout target:** p95 under 250ms.
- **Availability target:** endpoint should be available whenever `/health` is available.

### Endpoint expectations

- The handler should return all platform process metrics in a single payload.
- Scrapes should be safe to run every 15s.
- Endpoint must never include secrets or user payload fields.
- Label values must use normalized IDs (for example `game_id=\"blackout\"`) rather than user-controlled strings.

## Metric catalog

Metric names use the `platform_` prefix and Prometheus naming conventions (`_total` counters, `_seconds` durations, etc.).

### Socket and connection health

| Metric                              | Type    | Labels                            | Description                                                                      |
| ----------------------------------- | ------- | --------------------------------- | -------------------------------------------------------------------------------- |
| `platform_socket_connections_open`  | Gauge   | `namespace`                       | Current open Socket.IO connections by namespace (`/party`, `/g/blackout`, etc.). |
| `platform_socket_connections_total` | Counter | `namespace`                       | Total accepted socket connections.                                               |
| `platform_socket_disconnects_total` | Counter | `namespace`, `reason`             | Total disconnects grouped by reason (`transport close`, `ping timeout`, etc.).   |
| `platform_socket_errors_total`      | Counter | `namespace`, `error_code`         | Count of socket-level errors emitted by platform handlers.                       |
| `platform_socket_events_total`      | Counter | `namespace`, `event`, `direction` | Socket event throughput (`in` / `out`) for core platform events.                 |

### Party lifecycle

| Metric                                 | Type    | Labels              | Description                                                                                       |
| -------------------------------------- | ------- | ------------------- | ------------------------------------------------------------------------------------------------- |
| `platform_parties_active`              | Gauge   | _none_              | Current number of active parties in memory.                                                       |
| `platform_party_created_total`         | Counter | _none_              | Parties created since process start.                                                              |
| `platform_party_join_attempts_total`   | Counter | `result`            | Join attempts (`ok`, `rejected_not_found`, `rejected_in_match`, `rejected_duplicate_name`, etc.). |
| `platform_party_resumes_total`         | Counter | `result`            | Resume attempts (`ok`, `rejected`, `expired`).                                                    |
| `platform_party_launch_total`          | Counter | `game_id`, `result` | Match launch attempts by selected game.                                                           |
| `platform_party_return_to_lobby_total` | Counter | `game_id`, `result` | Return-to-lobby actions and outcomes.                                                             |
| `platform_party_cleanup_total`         | Counter | `reason`            | Party cleanup executions (`idle_timeout`, `empty_leave`, `manual`, `process_shutdown`).           |

### Match/game lifecycle

| Metric                           | Type      | Labels                      | Description                                                              |
| -------------------------------- | --------- | --------------------------- | ------------------------------------------------------------------------ |
| `platform_match_active`          | Gauge     | `game_id`                   | Active matches by game.                                                  |
| `platform_match_started_total`   | Counter   | `game_id`                   | Matches started by game.                                                 |
| `platform_match_ended_total`     | Counter   | `game_id`, `end_reason`     | Match completions by reason (`host_return`, `timeout`, `abandon`, etc.). |
| `platform_room_cleanup_total`    | Counter   | `game_id`, `reason`         | Game room cleanup operations triggered from platform workflows.          |
| `platform_event_latency_seconds` | Histogram | `game_id`, `event`, `phase` | End-to-end latency for key party/game events.                            |

### HTTP and scrape health

| Metric                                   | Type      | Labels                            | Description                                                            |
| ---------------------------------------- | --------- | --------------------------------- | ---------------------------------------------------------------------- |
| `platform_http_requests_total`           | Counter   | `route`, `method`, `status_class` | HTTP request volume for platform routes (`/health`, `/metrics`, etc.). |
| `platform_http_request_duration_seconds` | Histogram | `route`, `method`                 | HTTP request duration.                                                 |
| `platform_metrics_scrape_total`          | Counter   | `result`                          | Optional self-observation for scrape handler (`ok`, `error`).          |

## Label cardinality rules

Use these rules to avoid high-cardinality metrics that degrade Prometheus and Grafana performance.

### Allowed labels (low cardinality)

- `game_id`: one of `blackout`, `imposter`, `secret-signals`
- `namespace`: `/party`, `/g/blackout`, `/g/imposter`, `/g/secret-signals`
- `result`: bounded enums (`ok`, `error`, `rejected_*`)
- `reason` / `end_reason`: bounded enums controlled by server code
- `status_class`: `2xx`, `3xx`, `4xx`, `5xx`
- `event`: only a curated allowlist of platform/game lifecycle event names

### Forbidden labels (high cardinality)

Never use these as metric labels:

- `partyId`, `matchKey`, `inviteCode`, `playerId`, `playerName`
- socket IDs, IP addresses, user agent strings
- raw error messages or stack traces
- free-form payload fragments

### Cardinality guardrails

- Prefer **enums** over free-form strings.
- Bucket outcome details into stable categories.
- Add labels only when needed for an operational decision.
- Before adding a label, estimate `series_count = metric_names * label_combinations * targets`.

## Example metric lines

```txt
# HELP platform_parties_active Current number of active parties in memory.
# TYPE platform_parties_active gauge
platform_parties_active 42

# HELP platform_socket_errors_total Count of socket-level errors emitted by platform handlers.
# TYPE platform_socket_errors_total counter
platform_socket_errors_total{namespace="/party",error_code="emit_failed"} 19

# HELP platform_event_latency_seconds End-to-end latency for key party/game events.
# TYPE platform_event_latency_seconds histogram
platform_event_latency_seconds_bucket{game_id="imposter",event="auto_join_room",phase="server",le="0.1"} 923
platform_event_latency_seconds_bucket{game_id="imposter",event="auto_join_room",phase="server",le="0.25"} 1331
platform_event_latency_seconds_bucket{game_id="imposter",event="auto_join_room",phase="server",le="0.5"} 1498
platform_event_latency_seconds_sum{game_id="imposter",event="auto_join_room",phase="server"} 242.6
platform_event_latency_seconds_count{game_id="imposter",event="auto_join_room",phase="server"} 1502
```

## Prometheus scrape config example

Use a dedicated job for the platform service and scrape `/metrics` directly.

```yaml
scrape_configs:
  - job_name: game-platform
    scheme: http
    metrics_path: /metrics
    scrape_interval: 15s
    scrape_timeout: 10s
    static_configs:
      - targets:
          - platform:3000
        labels:
          service: game-platform
          env: prod
```

If using Kubernetes service discovery, keep `metrics_path: /metrics` and relabel to preserve stable `service`, `env`, and `cluster` labels.

## Initial alert rules

Below are seed Prometheus alert definitions. Adjust thresholds after baseline data is collected.

```yaml
groups:
  - name: game-platform-alerts
    rules:
      - alert: PlatformHighSocketErrorRatio
        expr: |
          (
            sum(rate(platform_socket_errors_total[5m]))
            /
            clamp_min(sum(rate(platform_socket_events_total{direction="in"}[5m])), 1)
          ) > 0.03
        for: 10m
        labels:
          severity: warning
          service: game-platform
        annotations:
          summary: 'High socket error ratio'
          description: 'Socket error ratio > 3% for 10m. Investigate party/game namespace health.'

      - alert: PlatformSuddenConnectionDrops
        expr: |
          sum(rate(platform_socket_disconnects_total[5m]))
          >
          (2.5 * sum(rate(platform_socket_disconnects_total[30m])))
        for: 5m
        labels:
          severity: warning
          service: game-platform
        annotations:
          summary: 'Sudden spike in connection drops'
          description: 'Disconnect rate is significantly above 30m baseline. Check transport/network instability.'

      - alert: PlatformZeroActivePartiesDuringExpectedTraffic
        expr: |
          (
            day_of_week() >= 1 and day_of_week() <= 5
            and hour() >= 16 and hour() < 23
          )
          and
          avg_over_time(platform_parties_active[10m]) == 0
        for: 10m
        labels:
          severity: critical
          service: game-platform
        annotations:
          summary: 'Zero active parties during expected traffic window'
          description: 'No active parties during weekday peak window (16:00-23:00 UTC).'

      - alert: PlatformHighRoomCleanupChurn
        expr: |
          sum(rate(platform_room_cleanup_total[15m]))
          /
          clamp_min(sum(rate(platform_match_started_total[15m])), 1)
          > 1.2
        for: 15m
        labels:
          severity: warning
          service: game-platform
        annotations:
          summary: 'Unusually high room cleanup churn'
          description: 'Room cleanup-to-match-start ratio is high, indicating unstable session lifecycle.'
```

## Grafana dashboard seed queries

Use these as starter panels for an operational dashboard.

### Party lifecycle funnel

1. **Party creates (5m rate)**

```promql
sum(rate(platform_party_created_total[5m]))
```

2. **Join success ratio**

```promql
sum(rate(platform_party_join_attempts_total{result="ok"}[5m]))
/
clamp_min(sum(rate(platform_party_join_attempts_total[5m])), 1)
```

3. **Launch success ratio by game**

```promql
sum by (game_id) (rate(platform_party_launch_total{result="ok"}[5m]))
/
clamp_min(sum by (game_id) (rate(platform_party_launch_total[5m])), 1)
```

4. **Return-to-lobby success ratio**

```promql
sum(rate(platform_party_return_to_lobby_total{result="ok"}[5m]))
/
clamp_min(sum(rate(platform_party_return_to_lobby_total[5m])), 1)
```

5. **Active parties (current)**

```promql
platform_parties_active
```

### Per-game event latency

1. **p50 event latency by game/event**

```promql
histogram_quantile(
  0.50,
  sum by (le, game_id, event) (rate(platform_event_latency_seconds_bucket[5m]))
)
```

2. **p95 event latency by game/event**

```promql
histogram_quantile(
  0.95,
  sum by (le, game_id, event) (rate(platform_event_latency_seconds_bucket[5m]))
)
```

3. **p99 event latency by game/event**

```promql
histogram_quantile(
  0.99,
  sum by (le, game_id, event) (rate(platform_event_latency_seconds_bucket[5m]))
)
```

4. **Slow event volume (>500ms), by game**

```promql
sum by (game_id) (
  rate(platform_event_latency_seconds_bucket{le="+Inf"}[5m])
  -
  rate(platform_event_latency_seconds_bucket{le="0.5"}[5m])
)
```

## Rollout checklist

- Add `/metrics` route and instrumentation wiring in `apps/platform/server`.
- Validate metric output shape in local and staging environments.
- Create recording rules for expensive dashboard expressions if query load grows.
- Tune alert thresholds after at least 7 days of baseline traffic.
