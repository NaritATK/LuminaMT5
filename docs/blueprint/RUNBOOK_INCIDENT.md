# Runbook — Incident Response

Severity model:
- **Sev-1:** Active capital risk or uncontrolled execution
- **Sev-2:** Major degradation, risk controls still effective
- **Sev-3:** Non-critical defect/latency/reporting issue

## 1) Detect & Declare (0–10 min)
1. Create incident record (ID, time, reporter, severity)
2. Assign roles:
   - Incident Commander (IC)
   - Operations Lead
   - Comms Owner
3. If Sev-1: trigger panic runbook immediately.

## 2) Stabilize (10–30 min)
- Stop change activity (deploy freeze)
- Contain blast radius (account/symbol isolation)
- Validate risk controls are active
- Establish 15-min status cadence

## 3) Diagnose (parallel)
Checklist:
- [ ] Last successful command and first bad event
- [ ] Risk gate outcomes before/after
- [ ] Worker heartbeat continuity
- [ ] Broker/API error patterns
- [ ] Infra/resource anomalies

## 4) Mitigate & Recover
- Apply smallest safe fix first (config rollback > code hotfix)
- Re-validate on canary account
- Resume progressively (never full restore in one step)

## 5) Closeout
Closure criteria:
- [ ] System stable for defined soak window (e.g., 2h)
- [ ] No new related alerts
- [ ] Stakeholder summary delivered

Postmortem within 24h:
- Timeline (UTC)
- Root cause + contributing factors
- What detection missed
- Corrective actions with owner/date
- Runbook updates required

## Target SLOs
- Acknowledge: < 5 min (Sev-1/2)
- Containment: < 15 min (Sev-1)
- Initial recovery plan: < 30 min
