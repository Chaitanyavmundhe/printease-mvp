const fs = require('fs');
const path = require('path');

const FLOW_DOCS = [
  'upload-document-flow.md', 'draft-order-flow.md', 'manual-collection-flow.md',
  'print-queue-flow.md', 'hub-send-to-agent-flow.md', 'desktop-agent-pairing-flow.md',
  'desktop-job-polling-flow.md', 'local-printing-flow.md', 'document-download-flow.md',
  'desktop-update-flow.md'
];

const BACKEND_DOCS = [
  'app-and-security.md', 'upload-controller.md', 'order-controller.md',
  'manual-collection.md', 'print-queue-service.md', 'agent-controller.md',
  'hub-agent-controller.md', 'document-controller.md', 'print-options.md',
  'repository.md', 'rate-limit-middleware.md'
];

const DESKTOP_DOCS = [
  'main-process.md', 'preload-ipc-bridge.md', 'backend-config.md',
  'job-poller.md', 'print-executor.md', 'linux-cups.md', 'windows-printer.md',
  'updater.md', 'local-config-storage.md'
];

const FRONTEND_DOCS = [
  'api-service.md', 'upload-ui.md', 'order-ui.md', 'hub-orders-ui.md',
  'manual-collection-ui.md', 'agent-approval-ui.md'
];

const CONTRACT_DOCS = [
  'order-contract.md', 'manual-collection-contract.md', 'print-job-contract.md',
  'agent-payload-contract.md', 'print-options-contract.md', 'document-contract.md',
  'error-codes.md'
];

const TOP_LEVEL_DOCS = [
  '00-start-here.md', '01-project-boundaries.md', '02-flow-index.md',
  '03-module-index.md', '04-contract-index.md', '05-state-machines.md',
  '06-security-rules.md', '07-risky-files.md', '08-agent-work-rules.md',
  '09-reusability-plan.md', '10-next-small-tasks.md'
];

const flowTemplate = (name) => `# ${name.replace(/-/g, ' ').replace('.md', '').toUpperCase()}

## Purpose
TBD

## Actors
TBD

## Entry points
TBD

## Input
TBD

## Output
TBD

## Source of truth
TBD

## State changes
TBD

## Files involved
TBD

## Security rules
TBD

## Reusability opportunities
TBD

## Known risks
TBD

## Safe small follow-up tasks
TBD

## Tests
TBD
`;

const moduleTemplate = (name) => `# ${name.replace(/-/g, ' ').replace('.md', '').toUpperCase()}

## File paths
TBD

## Responsibility
TBD

## Owns
TBD

## Does not own
TBD

## Important functions
TBD

## Inputs
TBD

## Outputs
TBD

## Side effects
TBD

## API/database calls
TBD

## Security rules
TBD

## Known risks
TBD

## Reusable helper extraction ideas
TBD

## Safe to edit
TBD

## Do not edit
TBD

## Related flow docs
TBD

## Related contract docs
TBD
`;

const contractTemplate = (name) => `# ${name.replace(/-/g, ' ').replace('.md', '').toUpperCase()}

## Producer
TBD

## Consumer
TBD

## Payload shape
TBD

## Required fields
TBD

## Optional fields
TBD

## Legacy compatibility if any
TBD

## Validation rules
TBD

## Security rules
TBD

## Failure behavior
TBD
`;

function writeFiles(dir, files, template) {
  files.forEach(f => {
    fs.writeFileSync(path.join(__dirname, 'docs/agent-context', dir, f), template(f));
  });
}

writeFiles('flows', FLOW_DOCS, flowTemplate);
writeFiles('backend', BACKEND_DOCS, moduleTemplate);
writeFiles('desktop', DESKTOP_DOCS, moduleTemplate);
writeFiles('frontend', FRONTEND_DOCS, moduleTemplate);
writeFiles('contracts', CONTRACT_DOCS, contractTemplate);

// Top level files
TOP_LEVEL_DOCS.forEach(f => {
  let content = `# ${f.replace(/-/g, ' ').replace('.md', '').toUpperCase()}\n\nTBD\n`;
  if (f === '10-next-small-tasks.md') {
    content = `# NEXT SMALL TASKS

1. Fix manual collection method validation only.
2. Tighten production CORS only.
3. Clean /api/health response only.
4. Fix desktop updater owner/repo only.
5. Strengthen desktop package verification only.
6. Add desktop IPC sender validation only.
7. Add safe approval URL validator only.
8. Add desktop CSP only.
9. Add normalizeJobFiles(job) helper only.
10. Update jobPoller to process job.files[] sequentially only.
11. Add CUPS option mapper only.
12. Wire updater isPrintingActive to jobPoller only.
13. Extract manualCollectionService only.
14. Extract printJobReadinessService only.
15. Extract agentJobPayloadService only.
`;
  }
  fs.writeFileSync(path.join(__dirname, 'docs/agent-context', f), content);
});

console.log('All files created successfully!');
