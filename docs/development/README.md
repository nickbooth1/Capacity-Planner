# Development Documentation

This directory contains comprehensive documentation for developers working on the CapaCity Planner project.

## 📚 Documentation Structure

### Core Guidelines

- **[Testing Strategy](./testing-strategy.md)** - Comprehensive testing guidelines and standards
- **[Testing Quick Reference](./testing-quick-reference.md)** - Quick reference for common testing tasks

### Examples

- **[Test Examples](../examples/tests/)** - Real-world examples of different test types:
  - [Validation Tests](../examples/tests/validation-example.spec.ts)
  - [Repository Integration Tests](../examples/tests/repository-example.integration.spec.ts)
  - [API E2E Tests](../examples/tests/api-example.e2e.spec.ts)

## 🚀 Quick Start for New Developers

1. **Read the Testing Strategy** - Start with [testing-strategy.md](./testing-strategy.md) to understand our testing approach

2. **Keep the Quick Reference Handy** - Bookmark [testing-quick-reference.md](./testing-quick-reference.md) for daily use

3. **Study the Examples** - Review the test examples to see best practices in action

4. **Set Up Your Environment**:
   ```bash
   # Install dependencies
   pnpm install
   
   # Set up test databases
   pnpm docker:db:up
   pnpm prisma:migrate:dev
   
   # Run tests to verify setup
   pnpm test:all
   ```

## 🧪 Testing Commands

```bash
# Run all tests for a module
pnpm test:assets

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run tests in watch mode
pnpm test:assets:watch

# Run with coverage
pnpm test:assets:coverage
```

## 📋 Development Workflow

1. **Write Tests First** (TDD)
   - Create test file next to source file
   - Write failing tests for new functionality
   - Implement code to make tests pass

2. **Run Tests Continuously**
   - Use watch mode during development
   - Run full test suite before committing

3. **Maintain Coverage**
   - Keep coverage above 80%
   - Critical paths require 95% coverage

4. **Review Test Quality**
   - Tests should be clear and maintainable
   - Follow examples and patterns in documentation

## 🤝 Contributing

When contributing to the project:

1. Follow the testing strategy guidelines
2. Write tests for all new code
3. Update documentation if adding new patterns
4. Ensure all tests pass before creating PR
5. Include test results in PR description

## 📖 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Nx Testing Guide](https://nx.dev/guides/testing)

## 🆘 Getting Help

- Check the troubleshooting section in [testing-strategy.md](./testing-strategy.md#debugging-tests)
- Ask in #testing Slack channel
- Review existing test examples
- Create an issue with the `testing` label

---

**Remember**: Well-tested code is reliable code. When in doubt, write a test!