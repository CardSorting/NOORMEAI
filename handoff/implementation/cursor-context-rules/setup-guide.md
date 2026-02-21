# Cursor Context Rules Setup Guide

## Prerequisites

- Cursor IDE installed
- NOORMME project directory
- Basic understanding of Cursor's rule system

## Step-by-Step Setup

### 1. Create Rules Directory

```bash
# Navigate to your NOORMME project directory
cd /path/to/your/noormme/project

# Create the .cursor/rules directory
mkdir -p .cursor/rules
```

### 2. Copy Rule Files

```bash
# Copy all rule files from the handoff directory
cp handoff/implementation/cursor-context-rules/rules/* .cursor/rules/

# Verify the files were copied
ls .cursor/rules/
```

Expected output:
```
architecture.mdc
coding-style.mdc
database.mdc
marie-kondo.mdc
nextjs-patterns.mdc
```

### 3. Verify Rule Structure

Each rule file should have the following structure:

```markdown
---
description: [Brief description]
globs: '**/*.ts'
alwaysApply: true
---

# Rule Content
[Detailed guidelines and examples]
```

### 4. Test Rule Application

#### Test 1: Open Cursor IDE
1. Open Cursor IDE in your NOORMME project directory
2. Create a new TypeScript file
3. Check if the AI suggests code that follows NOORMME patterns

#### Test 2: Generate Code
1. Ask the AI to create a new service class
2. Verify it follows the Laravel-style service pattern
3. Check that it includes proper JSDoc comments

#### Test 3: Database Operations
1. Ask the AI to create a repository method
2. Verify it uses the NOORMME repository pattern
3. Check that it includes proper type safety

### 5. Customize Rules (Optional)

See `rule-customization.md` for detailed customization instructions.

## Verification Checklist

- [ ] `.cursor/rules/` directory exists
- [ ] All 5 rule files are present
- [ ] Rule files have proper metadata headers
- [ ] Cursor IDE recognizes the rules
- [ ] AI generates code following NOORMME patterns
- [ ] Code includes proper TypeScript types
- [ ] Code follows NORMIE DEV methodology

## Troubleshooting

### Rules Not Working
1. Check that files are in `.cursor/rules/` directory
2. Verify file extensions are `.mdc`
3. Ensure metadata headers are properly formatted
4. Restart Cursor IDE

### AI Not Following Patterns
1. Check `alwaysApply: true` in rule metadata
2. Verify `globs` patterns match your file types
3. Test with explicit rule references: `@architecture`

### Performance Issues
1. Reduce number of `alwaysApply: true` rules
2. Use more specific `globs` patterns
3. Split large rules into smaller, focused rules

## Next Steps

1. **Test the rules** with various code generation scenarios
2. **Customize rules** to match your specific needs
3. **Share feedback** on rule effectiveness
4. **Update rules** as the project evolves

## Support

If you encounter issues:
1. Check the troubleshooting guide
2. Review the rule customization documentation
3. Test with minimal rule sets
4. Verify Cursor IDE version compatibility

---

**Status**: ✅ Setup guide complete
**Next**: Follow the verification checklist to ensure rules are working
