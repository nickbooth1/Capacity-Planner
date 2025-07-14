# Branch Protection Rules

This document describes the recommended branch protection rules for the Capacity Planner repository.

## Main Branch Protection

The `main` branch should have the following protection rules enabled:

### Required Status Checks

Before merging to main, the following checks must pass:

1. **CI / All Checks Passed** - Ensures all CI jobs complete successfully
2. **Docker Build / All Docker Builds Passed** - Ensures Docker images build correctly

### Pull Request Requirements

- **Require pull request reviews before merging**
  - Required approving reviews: 1
  - Dismiss stale pull request approvals when new commits are pushed
  - Require review from CODEOWNERS (when CODEOWNERS file is added)

- **Require status checks to pass before merging**
  - Require branches to be up to date before merging
  - Status checks listed above must pass

- **Require conversation resolution before merging**
  - All PR comments must be resolved

### Additional Protections

- **Require linear history** - Prevents merge commits, enforces rebasing
- **Include administrators** - Apply rules to repository administrators
- **Restrict who can push to matching branches** - Only allow specific teams/users
- **Do not allow force pushes** - Prevents history rewriting
- **Do not allow deletions** - Prevents branch deletion

## Setting Up Branch Protection

To configure these rules in GitHub:

1. Go to Settings → Branches
2. Click "Add rule" under Branch protection rules
3. Enter `main` as the branch name pattern
4. Configure the settings as described above
5. Click "Create" to save the rules

## Additional Branch Policies

### Feature Branches

- Naming convention: `feature/description-of-feature`
- Should be created from latest `main`
- Should be deleted after merging

### Hotfix Branches

- Naming convention: `hotfix/description-of-fix`
- Can bypass some checks in emergencies (requires admin approval)
- Must still pass critical security checks

### Release Branches

- Naming convention: `release/v1.2.3`
- Protected similar to main but allows version bumps
- Used for preparing production releases

## Automated Enforcement

The CI/CD pipeline enforces:

- Code quality via ESLint
- Test coverage requirements
- Security vulnerability scanning
- Docker image building
- Nx affected commands for efficiency

## Exceptions

Emergency hotfixes may bypass some rules with:
- Admin override
- Documented justification
- Post-merge review requirement

## Review Guidelines

Pull request reviewers should verify:

1. Code follows project conventions
2. Tests are included for new features
3. Documentation is updated
4. No sensitive data is exposed
5. Performance implications are considered
6. Security best practices are followed