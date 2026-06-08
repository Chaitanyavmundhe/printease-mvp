# Reusability Plan

Our primary goal is to turn large monolithic flows into reusable, testable micro-components.

## Immediate Goals
- Extracting specific controllers into modular services (e.g., `manualCollectionService.js`, `printJobReadinessService.js`).
- Encapsulating desktop OS interactions behind pure JS contracts (e.g., passing `printOptions` into `buildCupsOptions`).

## Long-term Architecture
- **Dependency Injection**: Services should not rely on global DB pools directly. Pass the `client` or transaction context as an argument.
- **Pure Functions**: Business logic (like checking if an order is eligible for printing) must be pure functions that take data structures and return booleans or errors.
- **Framework Agnostic**: The backend services should not depend on Express `req`/`res` objects. Extract inputs, pass them to services, and format the output in the controller.
