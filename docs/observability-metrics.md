# Observability Metrics

This document defines the platform Prometheus metrics contract for the HTTP `/metrics` endpoint, plus alert and dashboard seed queries for operators.

> Scope: `apps/platform` service only (party lifecycle and Socket.IO gateway behavior).

## `/metrics` endpoint

- **Path:** `GET /metrics`
- **Format:** Prometheus text exposition format (`text/plain; version=0.0.4`)
- **Default exposure:** enabled outside production, disabled by default in production
- **Config:** `METRICS_ENABLED`, `METRICS_AUTH_TOKEN`
- **Auth:** keep internal-only and/or require `METRICS_AUTH_TOKEN` via `Authorization: Bearer <token>` or `x-metrics-token: <token>`.
- **Timeout target:** p95 under 250ms.
- **Availability target:** endpoint should be available whenever `/health` is available, unless intentionally disabled by config.

### Endpoint expectations

- The handler should return all platform process metrics in a single payload.
- Scrapes should be safe to run every 15s.
- Endpoint must never include secrets or user payload fields.
- Label values must use normalized IDs (for example `game_id=\"blackout\"`) rather than user-controlled strings.
- Unauthorized scrapes must return `401` with `WWW-Authenticate: Bearer` when token protection is enabled.
- Disabled metrics endpoints should return `404`.

## Metric catalog

Metric names use the `platform_` prefix and Prometheus naming conventions (`_total` counters, `_seconds` durations, etc.).

### Socket and connection health

| Metric                                     | Type      | Labels                                              | Description                                                                      |
| ------------------------------------------ | --------- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `platform_socket_connections_open`         | Gauge     | `namespace`, `game_id`                              | Current open Socket.IO connections by namespace (`/party`, `/g/blackout`, etc.). |
| `platform_engine_connections`              | Gauge     | _none_                                              | Current number of active Socket.IO engine connections (all namespaces combined). |
| `platform_socket_events_total`             | Counter   | `namespace`, `event`, `game_id`, `result`, `reason` | Total explicitly recorded namespace-level socket events with outcome labels.     |
| `platform_event_latency_seconds`           | Histogram | `namespace`, `event`, `game_id`, `result`, `reason` | Latency for explicitly recorded namespace-level socket events.                   |
| `platform_socket_handler_total`            | Counter   | `namespace`, `event`, `result`                      | Total socket handler invocations by outcome (`ok`, `rejected`, `failed`).        |
| `platform_socket_handler_duration_seconds` | Histogram | `namespace`, `event`, `result`                      | Socket handler execution duration in seconds by outcome.                         |

### Party lifecycle

| Metric                             | Type    | Labels                      | Description                                                                                                                                                 |
| ---------------------------------- | ------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `platform_parties_active`          | Gauge   | _none_                      | Current number of active parties in memory.                                                                                                                 |
| `platform_party_members_connected` | Gauge   | _none_                      | Current number of connected party members.                                                                                                                  |
| `platform_party_lifecycle_total`   | Counter | `event`, `result`, `reason` | Unified party lifecycle counter. `event` values include `createParty`, `joinParty`, `resumeParty`, `launchGame`, `returnToLobby`, `selectGame`, and others. |

### Match/game lifecycle

| Metric                            | Type  | Labels    | Description                                  |
| --------------------------------- | ----- | --------- | -------------------------------------------- |
| `platform_match_active`           | Gauge | `game_id` | Current number of active game rooms by game. |
| `platform_room_players_connected` | Gauge | `game_id` | Current connected room players by game.      |

### Scrape health

| Metric                          | Type    | Labels   | Description                                                                          |
| ------------------------------- | ------- | -------- | ------------------------------------------------------------------------------------ |
| `platform_metrics_scrape_total` | Counter | `result` | Self-observation counter for the `/metrics` handler (`ok`, `unauthorized`, `error`). |

## Label cardinality rules

Use these rules to avoid high-cardinality metrics that degrade Prometheus and Grafana performance.

### Allowed labels (low cardinality)

- `game_id`: one of `blackout`, `imposter`, `secret-signals`
- `namespace`: `/party`, `/g/blackout`, `/g/imposter`, `/g/secret-signals`
- `result`: bounded enums such as `ok`, `rejected`, `failed`, `unauthorized`
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
# HELP platform_parties_active Current number of active parties in this server process.
# TYPE platform_parties_active gauge
platform_parties_active 42

# HELP platform_socket_events_total Total number of explicitly recorded namespace-level socket events.
# TYPE platform_socket_events_total counter
platform_socket_events_total{namespace="/g/imposter",event="connection",game_id="imposter",result="ok"} 923

# HELP platform_event_latency_seconds Latency for explicitly recorded namespace-level socket events.
# TYPE platform_event_latency_seconds histogram
platform_event_latency_seconds_bucket{namespace="/g/imposter",event="connection",game_id="imposter",result="ok",le="0.1"} 923
platform_event_latency_seconds_bucket{namespace="/g/imposter",event="connection",game_id="imposter",result="ok",le="0.25"} 1331
platform_event_latency_seconds_bucket{namespace="/g/imposter",event="connection",game_id="imposter",result="ok",le="0.5"} 1498
platform_event_latency_seconds_sum{namespace="/g/imposter",event="connection",game_id="imposter",result="ok"} 242.6
platform_event_latency_seconds_count{namespace="/g/imposter",event="connection",game_id="imposter",result="ok"} 1502

# HELP platform_party_lifecycle_total Total party lifecycle transitions and actions by outcome.
# TYPE platform_party_lifecycle_total counter
platform_party_lifecycle_total{event="createParty",result="ok"} 150
platform_party_lifecycle_total{event="joinParty",result="ok"} 430
platform_party_lifecycle_total{event="joinParty",result="rejected",reason="party_not_found"} 12
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
    authorization:
      type: Bearer
      credentials: ${METRICS_AUTH_TOKEN}
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
      - alert: PlatformHighSocketHandlerFailureRatio
        expr: |
          (
            sum(rate(platform_socket_handler_total{result="failed"}[5m]))
            /
            clamp_min(sum(rate(platform_socket_handler_total[5m])), 1)
          ) > 0.03
        for: 10m
        labels:
          severity: warning
          service: game-platform
        annotations:
          summary: 'High socket handler failure ratio'
          description: 'Socket handler failure ratio > 3% for 10m. Investigate party/game namespace health.'

      - alert: PlatformSuddenConnectionDrop
        expr: |
          delta(platform_engine_connections[5m]) < -20
        for: 5m
        labels:
          severity: warning
          service: game-platform
        annotations:
          summary: 'Sudden drop in engine connections'
          description: 'Engine connection count dropped significantly. Check transport/network instability.'

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

      - alert: PlatformHighHandlerLatency
        expr: |
          histogram_quantile(
            0.95,
            sum by (le, namespace, event) (rate(platform_socket_handler_duration_seconds_bucket[5m]))
          ) > 1.0
        for: 10m
        labels:
          severity: warning
          service: game-platform
        annotations:
          summary: 'High p95 socket handler latency'
          description: 'Socket handler p95 latency is above 1s for 10m. Investigate slow event handlers.'
```

## Grafana dashboard seed queries

Use these as starter panels for an operational dashboard.

### Party lifecycle funnel

1. **Party creates (5m rate)**

```promql
sum(rate(platform_party_lifecycle_total{event="createParty",result="ok"}[5m]))
```

2. **Join success ratio**

```promql
sum(rate(platform_party_lifecycle_total{event="joinParty",result="ok"}[5m]))
/
clamp_min(sum(rate(platform_party_lifecycle_total{event="joinParty"}[5m])), 1)
```

3. **Game launch success ratio by event**

```promql
sum by (event) (rate(platform_party_lifecycle_total{event="launchGame",result="ok"}[5m]))
/
clamp_min(sum by (event) (rate(platform_party_lifecycle_total{event="launchGame"}[5m])), 1)
```

4. **Return-to-lobby success ratio**

```promql
sum(rate(platform_party_lifecycle_total{event="returnToLobby",result="ok"}[5m]))
/
clamp_min(sum(rate(platform_party_lifecycle_total{event="returnToLobby"}[5m])), 1)
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
- Decide production exposure strategy (`METRICS_ENABLED`, `METRICS_AUTH_TOKEN`, internal-only ingress).
- Validate metric output shape in local and staging environments.
- Create recording rules for expensive dashboard expressions if query load grows.
- Tune alert thresholds after at least 7 days of baseline traffic.
