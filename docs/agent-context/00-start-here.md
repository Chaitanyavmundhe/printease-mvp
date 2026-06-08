# Start Here

PrintEase is broken into ultra-small abstract components so humans and agents can work safely without scanning the whole codebase.

## Hierarchy
Product → Domain → Flow → Module → Component → Function → Contract → Tiny Task

## Read Order
1. `01-domain-map.md`
2. `02-flow-map.md`
3. `03-module-map.md`
4. `04-contract-map.md`
5. `05-micro-component-index.md`
6. `06-state-machines.md`
7. `07-security-rules.md`
8. `08-risky-files.md`
9. `09-agent-work-rules.md`
10. `10-reusability-plan.md`
11. `11-next-tiny-tasks.md`

## Rules for Agents
1. Identify domain.
2. Identify flow.
3. Identify module.
4. Identify tiny component.
5. Read contract.
6. Check security rules.
7. Edit only tiny component.
8. Run focused test.
9. Update doc.
10. Stop.

## Current Implemented Micro-Services
- `backend/src/services/manualCollectionService.js`
- `backend/src/services/printJobReadinessService.js`
- `backend/src/services/agentJobPayloadService.js`

These services are the first extraction step out of larger controllers. New work should prefer extending these tiny service boundaries instead of adding more logic directly into controllers.
