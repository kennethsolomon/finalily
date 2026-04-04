---
paths:
  - "tests/**"
  - "test/**"
  - "__tests__/**"
  - "**/*.test.ts"
  - "**/*.test.js"
  - "**/*.spec.ts"
  - "**/*.spec.js"
  - "**/*.test.php"
---

# Testing Standards

## Conventions

- **Naming**: `test_[system]_[scenario]_[expected_result]` or `describe > it` blocks with descriptive names
- **Structure**: Arrange / Act / Assert — every test must clearly separate setup, execution, and verification
- **Independence**: Unit tests must not depend on external state (filesystem, network, database)
- **Cleanup**: Integration tests must clean up artifacts after execution
- **Coverage**: All new code requires test coverage. Target 100% coverage on new code paths.
- **Regression**: Every bug fix requires a regression test that would have caught the original defect
- **Fixtures**: Test data belongs in the test itself or dedicated fixtures — never shared mutable state
- **Mocking**: Mock external dependencies, not the code under test. Test behavior, not implementation.
- **Performance**: Tests should run fast. Mock slow dependencies (network, disk, database) in unit tests.
