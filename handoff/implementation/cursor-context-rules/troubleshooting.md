# Cursor Context Rules Troubleshooting

## Common Issues and Solutions

### 1. Rules Not Being Applied

#### Symptoms
- AI generates code that doesn't follow NOORMME patterns
- Rules are ignored during code generation
- No context from rules in AI responses

#### Solutions

**Check File Location**
```bash
# Verify rules are in the correct directory
ls .cursor/rules/
# Should show: architecture.mdc, coding-style.mdc, etc.
```

**Verify File Format**
```markdown
# Check that each rule file has proper metadata
---
description: NOORMME architectural principles
globs: '**/*.ts'
alwaysApply: true
---

# Rule content here
```

**Restart Cursor IDE**
- Close Cursor IDE completely
- Reopen the project
- Test rule application

**Check Rule Syntax**
- Ensure YAML frontmatter is valid
- Check for proper indentation
- Verify markdown formatting

### 2. AI Not Following Specific Patterns

#### Symptoms
- AI generates code but ignores specific guidelines
- Some patterns are followed, others are not
- Inconsistent rule application

#### Solutions

**Check Globs Patterns**
```markdown
# Ensure globs match your file types
globs: '**/*.{ts,tsx}'  # For TypeScript files
globs: '**/services/**' # For service files
```

**Verify AlwaysApply Settings**
```markdown
# Use alwaysApply: true for critical rules
alwaysApply: true   # Always include
alwaysApply: false  # Only when referenced
```

**Test with Explicit References**
```bash
# Reference rules explicitly in AI conversations
@architecture Generate a service class
@coding-style Create a repository method
```

**Check Rule Content**
- Ensure examples are clear and complete
- Verify patterns are well-documented
- Check for conflicting instructions

### 3. Performance Issues

#### Symptoms
- Slow AI responses
- Cursor IDE becomes unresponsive
- High memory usage

#### Solutions

**Reduce AlwaysApply Rules**
```markdown
# Change from alwaysApply: true to false
---
description: Performance guidelines
globs: '**/*.ts'
alwaysApply: false  # Instead of true
---
```

**Optimize Globs Patterns**
```markdown
# Use more specific patterns
globs: '**/services/**/*.ts'  # Instead of '**/*.ts'
globs: '**/*.test.ts'         # Instead of '**/*.ts'
```

**Split Large Rules**
```bash
# Break down large rules into smaller ones
# architecture.mdc -> architecture-core.mdc + architecture-patterns.mdc
```

**Check Rule Size**
- Keep individual rules under 1000 lines
- Remove redundant content
- Focus on essential patterns

### 4. Rule Conflicts

#### Symptoms
- Contradictory AI suggestions
- Inconsistent code generation
- Rules overriding each other

#### Solutions

**Review Rule Priorities**
```markdown
# More specific rules should override general ones
globs: '**/services/**/*.ts'  # Specific
globs: '**/*.ts'              # General
```

**Check for Contradictions**
- Review all rules for conflicting patterns
- Ensure consistent naming conventions
- Align architectural guidelines

**Test Rule Combinations**
```bash
# Test rules together
# Generate code and check for conflicts
# Adjust rules as needed
```

### 5. File Type Issues

#### Symptoms
- Rules not applying to specific file types
- Missing patterns for certain extensions
- Inconsistent behavior across file types

#### Solutions

**Update Globs Patterns**
```markdown
# Include all relevant file types
globs: '**/*.{ts,tsx,js,jsx}'  # All JavaScript/TypeScript files
globs: '**/*.{md,mdx}'         # Documentation files
```

**Create File-Specific Rules**
```markdown
# Create rules for specific file types
# components.mdc for React components
# services.mdc for service classes
# tests.mdc for test files
```

**Verify File Extensions**
```bash
# Check file extensions in your project
find . -name "*.ts" -o -name "*.tsx" | head -10
```

### 6. Cursor IDE Version Issues

#### Symptoms
- Rules work in one version but not another
- New features not supported
- Compatibility problems

#### Solutions

**Check Cursor Version**
```bash
# Check Cursor IDE version
# Update to latest version if needed
```

**Review Documentation**
- Check Cursor's rule system documentation
- Look for version-specific changes
- Update rules for new features

**Test with Minimal Rules**
```markdown
# Create a minimal test rule
---
description: Test rule
globs: '**/*.ts'
alwaysApply: true
---

# Simple test content
Use TypeScript for all files.
```

### 7. Project Structure Issues

#### Symptoms
- Rules work in one project but not another
- Path-related problems
- Directory structure conflicts

#### Solutions

**Check Project Structure**
```bash
# Verify project structure
ls -la
# Check for .cursor directory
ls -la .cursor/
```

**Use Relative Paths**
```markdown
# Use relative paths in rules
globs: '**/*.ts'  # Instead of absolute paths
```

**Verify Working Directory**
```bash
# Ensure you're in the correct project directory
pwd
# Should be your NOORMME project root
```

## Diagnostic Commands

### 1. Check Rule Files
```bash
# List all rule files
ls -la .cursor/rules/

# Check file permissions
ls -la .cursor/rules/*.mdc

# Verify file content
head -10 .cursor/rules/architecture.mdc
```

### 2. Test Rule Application
```bash
# Create a test file
echo "// Test file" > test-rule.ts

# Check if rules are applied
# Open in Cursor and test AI generation
```

### 3. Validate Rule Format
```bash
# Check YAML frontmatter
grep -A 5 "^---$" .cursor/rules/*.mdc

# Verify markdown formatting
markdownlint .cursor/rules/*.mdc
```

## Advanced Troubleshooting

### 1. Rule Debugging
```markdown
# Add debug information to rules
---
description: Debug rule
globs: '**/*.ts'
alwaysApply: true
---

# This rule should always apply to TypeScript files
# If you see this message, the rule is working
```

### 2. Performance Monitoring
```bash
# Monitor Cursor IDE performance
# Check memory usage
# Monitor response times
```

### 3. Rule Testing
```bash
# Create test scenarios
# Test different file types
# Verify rule combinations
```

## Getting Help

### 1. Check Documentation
- Review Cursor IDE documentation
- Check rule system updates
- Look for community solutions

### 2. Community Support
- Cursor IDE Discord/community
- GitHub issues and discussions
- Stack Overflow questions

### 3. Report Issues
- Document the problem clearly
- Include rule files and error messages
- Provide reproduction steps

## Prevention

### 1. Regular Maintenance
- Review rules monthly
- Update rules as project evolves
- Remove outdated patterns

### 2. Testing
- Test rules after changes
- Verify rule effectiveness
- Check for conflicts

### 3. Documentation
- Keep rule documentation updated
- Document customizations
- Share knowledge with team

---

**Status**: ✅ Troubleshooting guide complete
**Next**: Use this guide to resolve any issues with Cursor context rules
