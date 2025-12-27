# Testing Documentation

## Overview

This document explains the different types of tests used in this project, their purposes, and when to use each type.

---

## 📊 Test Types Comparison

| Aspect | Smoke Tests | Integration Tests | Unit Tests |
|--------|-------------|-------------------|------------|
| **Purpose** | Quick sanity check | Verify components work together | Test isolated functions |
| **Scope** | Critical paths only | Complete workflows | Single function/method |
| **Coverage** | ~20% of features | ~60% of features | ~100% of code |
| **Speed** | Very fast (1-5 sec) | Moderate (10s-minutes) | Extremely fast (<1 sec) |
| **Dependencies** | Real API/DB | Real API/DB | Mocked dependencies |
| **Validates schemas** | ❌ No | ✅ Yes | ❌ No |
| **Tests data flow** | ❌ No | ✅ Yes | ❌ No |
| **Multi-step workflows** | ❌ Single calls | ✅ Yes | ❌ Single function |
| **When to run** | After every deployment | CI/CD pipeline | Every code change |
| **Example** | "Is API alive?" | "Can user register and login?" | "Does hash function work?" |
| **Typical assertions** | Status code 200 | Data consistency, schemas | Return value correctness |
| **Execution time** | 1-5 seconds | 10 seconds - 5 minutes | <1 second per test |
| **Failures indicate** | Major outage | Integration problems | Code bugs |

---

## 🔄 The Testing Pyramid

```
                /\
               /  \
              / E2E \ ← End-to-End Tests
             /------\ (Slowest, UI + API + DB)
            /        \ Full user journeys
           /----------\
          /            \
         / Integration  \ ← Integration Tests (YOU ARE HERE)
        /----------------\ API workflows, schema validation
       /                  \
      /   Unit Tests       \ ← Unit Tests
     /----------------------\ Individual functions, mocked deps
    /                        \
   /   Smoke Tests (Subset)   \ ← Quick sanity checks
  /----------------------------\ "Is it alive?"
```

**Distribution Guidelines:**
- **Unit Tests**: 70% of your tests (base of pyramid)
- **Integration Tests**: 20% of your tests (middle)
- **E2E Tests**: 10% of your tests (top)
- **Smoke Tests**: Subset of integration (run first)

**Why Pyramid Shape?**
- More tests at the bottom = faster feedback
- Fewer tests at the top = less maintenance
- Catch bugs early with unit tests
- Verify integration with fewer, focused tests

---

## 🎯 Detailed Explanation

### Understanding Test Types and Their Purposes

Software testing requires multiple strategies to ensure quality at different levels. Each test type serves a distinct purpose and catches different categories of bugs.

**Unit tests** form the foundation of your testing strategy. They test individual functions or methods in complete isolation, with all external dependencies mocked or stubbed. For example, testing that a password hashing function correctly generates bcrypt hashes without actually connecting to a database. Unit tests execute in milliseconds and provide immediate feedback during development. They're excellent for catching logic errors, edge cases, and ensuring code correctness at the most granular level. However, they cannot verify that different parts of your system work together correctly.

**Integration tests** validate that multiple components interact correctly as a system. They test real workflows that span multiple modules, services, or APIs. In our authentication module, an integration test creates a session, registers a user with that session token, and verifies the profile endpoint returns consistent data. These tests use real dependencies (actual API, database) and validate not just status codes but data consistency, schema compliance, and business logic across component boundaries. They're slower than unit tests but catch issues that only appear when components interact, such as incorrect data serialization, authentication token handling, or API contract violations.

**Smoke tests** are a minimal subset of tests designed for rapid validation that critical functionality hasn't completely broken. They answer one question: "Is the system basically operational?" A smoke test might simply verify the server responds, the database connection works, and authentication endpoints return appropriate status codes. These tests sacrifice thoroughness for speed, running in seconds rather than minutes. They're ideal for immediate post-deployment validation or as a first gate before running more expensive test suites. Think of them as a quick health check before committing to a full examination.

The key difference lies in scope and purpose: unit tests verify correctness in isolation, integration tests verify components work together correctly, and smoke tests verify the system is minimally functional. Each type is essential for comprehensive quality assurance.

---

## 📁 Tests in This Project

### Current Test Files

#### `auth_module_integration_test.py`
**Type**: Integration Tests  
**Purpose**: Validate complete authentication workflows  
**What it tests**:
- Complete registration flow (session → register → profile)
- Schema validation against Swagger spec
- Data consistency across endpoints
- Token-based authentication
- Multi-step user journeys

**When to run**:
```bash
# Before commits
python tests/auth_module_integration_test.py

# In CI/CD pipeline
python tests/auth_module_integration_test.py --base-url $STAGING_URL
```

---

## 🚀 Future Testing Additions

### Recommended Test Files to Create

#### 1. `smoke_test.py` (Not yet created)
**Purpose**: 10-second health check  
**Should test**:
- Server responds to health endpoint
- Can create anonymous session
- Protected endpoints reject unauthenticated requests
- Database connection works

#### 2. Unit Tests (Not yet created)
**Location**: `src/**/*.spec.ts` (NestJS convention)  
**Should test**:
- Password hashing/comparison (EncryptionService)
- JWT token generation/validation
- Email validation logic
- Schema validation functions
- Business logic functions in isolation

#### 3. E2E Tests (Not yet created)
**Purpose**: Full user scenarios with UI (if applicable)  
**Should test**:
- Complete user registration through UI
- Login flow with form validation
- Session persistence across page reloads
- Error handling and user feedback

---

## 📝 Testing Best Practices

### When to Use Each Test Type

**Use Unit Tests When:**
- Testing pure functions with no side effects
- Validating business logic calculations
- Testing error handling and edge cases
- Developing new features (TDD approach)

**Use Integration Tests When:**
- Testing API endpoints
- Validating database interactions
- Testing authentication/authorization flows
- Verifying schema compliance
- Testing multi-step workflows

**Use Smoke Tests When:**
- Deploying to production
- Testing after infrastructure changes
- Quick validation before deeper testing
- Monitoring system health

### Test Writing Guidelines

1. **Arrange-Act-Assert Pattern**
   ```python
   # Arrange: Set up test data
   test_email = "test@example.com"
   
   # Act: Execute the functionality
   response = register_user(test_email)
   
   # Assert: Verify the results
   assert response.status_code == 201
   ```

2. **Unique Test Data**
   - Use timestamps or UUIDs to avoid conflicts
   - Clean up test data after execution (if possible)
   - Don't rely on specific database state

3. **Clear Test Names**
   - `test_registration_flow()` ✅
   - `test1()` ❌

4. **Independent Tests**
   - Each test should run independently
   - Tests shouldn't depend on execution order
   - Clean state between tests

---

## 🔧 Running Tests

### Prerequisites
```bash
# Install Python dependencies
pip install -r requirements.txt

# Ensure API is running
npm start
```

### Commands

```bash
# Run integration tests (default localhost)
python tests/auth_module_integration_test.py

# Run with custom URL
python tests/auth_module_integration_test.py --base-url http://localhost:4000

# Run with custom Swagger path
python tests/auth_module_integration_test.py --swagger-path ./custom-swagger.json

# Using environment variables
export API_BASE_URL=http://staging.example.com
python tests/auth_module_integration_test.py
```

### CI/CD Integration

**Exit Codes:**
- `0` = All tests passed
- `1` = One or more tests failed

**GitHub Actions Example:**
```yaml
- name: Run Integration Tests
  run: |
    pip install -r requirements.txt
    python tests/auth_module_integration_test.py --base-url http://localhost:3000
```

---

## 📊 Test Metrics

### Coverage Goals
- **Unit Tests**: 80%+ code coverage
- **Integration Tests**: 100% of critical user flows
- **Smoke Tests**: 100% of critical endpoints

### What Good Tests Look Like
- ✅ Run quickly (unit: <1s, integration: <30s)
- ✅ Fail only when something is actually broken
- ✅ Provide clear error messages
- ✅ Are maintainable (not brittle)
- ✅ Test behavior, not implementation

### What Bad Tests Look Like
- ❌ Flaky (sometimes pass, sometimes fail)
- ❌ Slow (integration tests taking minutes)
- ❌ Unclear failure messages
- ❌ Testing implementation details
- ❌ Require manual intervention

---

## 🎓 Additional Resources

### Learning Materials
- [Martin Fowler - Testing Strategies](https://martinfowler.com/testing/)
- [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)

### Tools Used
- **Python `requests`** - HTTP client for API testing
- **Swagger/OpenAPI** - Schema validation
- **Jest** - Unit testing (for TypeScript/NestJS code)
- **Supertest** - HTTP assertions (for NestJS E2E tests)

---

## 🔄 Continuous Improvement

### Expanding Test Coverage

As the project grows, consider adding:

1. **Performance Tests**
   - Load testing with tools like `locust` or `k6`
   - Response time benchmarks
   - Concurrent user simulation

2. **Security Tests**
   - SQL injection attempts
   - XSS vulnerability checks
   - Authentication bypass attempts
   - Rate limiting validation

3. **Contract Tests**
   - API contract testing with Pact
   - Ensure backward compatibility
   - Validate API versioning

4. **Chaos Engineering**
   - Database connection failures
   - Network timeouts
   - Service degradation scenarios

Remember: **Tests are code too!** Keep them clean, maintainable, and well-documented.
