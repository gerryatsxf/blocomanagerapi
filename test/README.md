# Authentication Module Smoke Tests

## Overview

Automated integration tests for the authentication module that validate complete user flows and response schemas against Swagger documentation.

## Features

✅ **Automated Schema Validation** - Validates API responses against `swagger-spec.json`  
✅ **Complete Flow Testing** - Tests end-to-end user scenarios  
✅ **Colored Output** - Easy-to-read test results with color-coded messages  
✅ **CI/CD Ready** - Returns proper exit codes (0 = success, 1 = failure)  
✅ **Minimal Maintenance** - Schema validation auto-updates with Swagger changes  

## Installation

```bash
# Install Python dependencies
pip install -r requirements.txt
```

## Usage

### Basic Usage (Default: http://localhost:3000)

```bash
python auth_module_smoke_test.py
```

### Custom API URL

```bash
python auth_module_smoke_test.py --base-url http://localhost:4000
```

### Custom Swagger Path

```bash
python auth_module_smoke_test.py --swagger-path /path/to/swagger-spec.json
```

### Using Environment Variables

```bash
export API_BASE_URL=http://localhost:3000
export SWAGGER_SPEC_PATH=../swagger-spec.json
python auth_module_smoke_test.py
```

## Test Scenarios

### 1. Registration Flow ✅ Implemented
Tests the complete new user registration process:
1. **Create Session** - `POST /auth/session` → Get anonymous session token
2. **Register User** - `POST /auth/register` → Convert session to authenticated
3. **Get Profile** - `GET /users/profile` → Verify user data matches registration

**Validations:**
- ✅ Status codes (201, 201, 200)
- ✅ Response schema against Swagger spec
- ✅ Token presence in responses
- ✅ User data consistency (email, firstName, lastName)

### 2. Login Flow (To be added)
Tests existing user login:
1. Create Session → Login → Get Profile

### 3. Session Expiration (To be added)
Tests session timeout and token expiration handling

### 4. Unauthorized Access (To be added)
Tests that protected endpoints reject requests without valid tokens

## How Schema Validation Works

The script automatically:
1. Loads `swagger-spec.json` at startup
2. For each API response, finds the matching endpoint + method + status code in Swagger
3. Extracts the expected schema
4. Validates response structure and field types
5. Reports any mismatches

**Benefits:**
- When you update your API and regenerate Swagger docs, tests adapt automatically
- Catches breaking changes in response structure
- Validates required fields are present
- Type-checks response data

## Output Example

```
============================================================
  Authentication Module Smoke Tests
  Started at: 2025-11-26 14:30:00
  API Base URL: http://localhost:3000
============================================================

✓ Loaded Swagger spec from: /path/to/swagger-spec.json

━━━ Test 1: Registration Flow ━━━
ℹ Step 1: Creating anonymous session...
ℹ POST http://localhost:3000/auth/session
ℹ   Status: 201
ℹ   Response: {
    "access_token": "eyJhbGciOiJIUzI1NiIs..."
  }
✓ Session created successfully. Token: eyJhbGciOiJIUzI1NiIs...

ℹ Step 2: Registering user with email: test_user_20251126143000@smoketest.com...
ℹ POST http://localhost:3000/auth/register
✓ User registered successfully. New token: eyJhbGciOiJIUzI1NiIs...

ℹ Step 3: Fetching user profile...
ℹ GET http://localhost:3000/users/profile
✓ Profile data validated successfully!
✓ ✓ Registration flow test PASSED

============================================================
  Test Summary
============================================================
Total Tests: 1
Passed: 1
Failed: 0

✓ ALL TESTS PASSED!
```

## Adding New Test Scenarios

To add a new test scenario:

1. Create a new method in the `SmokeTestRunner` class:

```python
def test_login_flow(self) -> bool:
    """Test existing user login."""
    self.log_test_start("Test 2: Login Flow")
    
    # Your test logic here
    # Use self.make_request() for API calls
    # Use self.validate_response_schema() for validation
    
    return True  # or False if test fails
```

2. Add it to the `run_all_tests()` method:

```python
tests = [
    ("Registration Flow", self.test_registration_flow),
    ("Login Flow", self.test_login_flow),  # Add this line
]
```

## Integration with CI/CD

The script returns proper exit codes:
- `0` = All tests passed
- `1` = One or more tests failed

### GitHub Actions Example

```yaml
- name: Run Smoke Tests
  run: |
    cd scripts
    pip install -r requirements.txt
    python auth_module_smoke_test.py --base-url http://localhost:3000
```

### GitLab CI Example

```yaml
smoke_test:
  script:
    - cd scripts
    - pip install -r requirements.txt
    - python auth_module_smoke_test.py --base-url $API_BASE_URL
```

## Troubleshooting

### Import Error: requests not found
```bash
pip install requests
```

### Swagger spec not found
Ensure `swagger-spec.json` exists in the parent directory, or specify with `--swagger-path`

### Connection refused
Make sure your API server is running:
```bash
npm start  # or your start command
```

## Future Enhancements

- [ ] Add more test scenarios (login, logout, password reset)
- [ ] Support for environment-specific test data
- [ ] Integration with jsonschema library for advanced validation
- [ ] Parallel test execution
- [ ] Test data cleanup (delete test users after tests)
- [ ] Performance metrics (response time tracking)
- [ ] HTML test report generation
