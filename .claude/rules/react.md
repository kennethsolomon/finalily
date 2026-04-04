---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "src/**/*.ts"
  - "resources/js/**"
---

# React Standards

## Conventions

- **Hooks**: Follow Rules of Hooks. Custom hooks start with `use`. Extract complex logic into custom hooks.
- **Components**: Prefer function components. Use `React.memo()` only when profiling shows a need.
- **State**: Use `useState` for local state, context for shared state, external stores (Zustand/Redux) for complex state.
- **Effects**: Minimize `useEffect`. Prefer derived state and event handlers. Always specify dependency arrays.
- **Keys**: Use stable, unique keys for lists. Never use array index as key for dynamic lists.
- **Error boundaries**: Wrap route-level components in error boundaries.
- **TypeScript**: Type props interfaces, not inline. Export prop types for reusable components.
