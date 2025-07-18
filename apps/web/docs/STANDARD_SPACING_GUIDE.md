# Standard Spacing Guide

## Overview
This guide establishes consistent spacing patterns using Tailwind's built-in utility classes. No custom configuration needed - just consistent application of standard values.

## Core Spacing Values

### Padding Scale
| Value | Tailwind Class | Pixels | Usage |
|-------|---------------|--------|--------|
| Extra Small | `p-2` | 8px | Compact elements, small buttons |
| Small | `p-3` | 12px | Tight spacing, inline badges |
| Medium | `p-4` | 16px | Default content padding |
| Large | `p-6` | 24px | Card containers, main sections |
| Extra Large | `p-8` | 32px | Page-level padding |

### Gap/Space Scale
| Value | Tailwind Class | Pixels | Usage |
|-------|---------------|--------|--------|
| Extra Small | `space-x-1` | 4px | Icon + text alignment |
| Small | `space-x-2` | 8px | Inline elements, compact buttons |
| Medium | `space-x-3` | 12px | Button groups, menu items |
| Large | `space-x-4` | 16px | Major elements |
| Extra Large | `space-x-6` | 24px | Section separators |
| XXL | `space-x-8` | 32px | Page sections |

## Component Patterns

### Page Layout
```tsx
// Main page container
<div className="p-8 space-y-8">
  // Page sections with consistent spacing
</div>

// Page header
<div className="px-8 py-6">
  // Header content
</div>
```

### Cards and Containers
```tsx
// Standard card
<div className="bg-white rounded-xl shadow-sm p-6">
  // Card content
</div>

// Compact card
<div className="bg-white rounded-lg shadow-sm p-4">
  // Smaller card content
</div>
```

### Navigation and Sidebars
```tsx
// Sidebar container
<div className="p-6">
  // Sidebar header
</div>

// Menu items
<nav className="px-4 pb-4 space-y-3">
  // Navigation links
</nav>

// Menu item
<Link className="flex items-center space-x-3 px-4 py-3">
  // Icon and text
</Link>
```

### Button Groups
```tsx
// Standard button group
<div className="flex items-center space-x-3">
  <Button>Action 1</Button>
  <Button>Action 2</Button>
</div>

// Compact button group
<div className="flex items-center space-x-2">
  <IconButton />
  <IconButton />
</div>
```

### Tables
```tsx
// Table cell
<TableCell className="py-4">
  // Cell content
</TableCell>

// Table header/footer sections
<div className="px-6 py-4">
  // Section content
</div>
```

### Forms
```tsx
// Form container
<div className="space-y-4">
  <FormField />
  <FormField />
</div>

// Compact form
<div className="space-y-3">
  <Input />
  <Input />
</div>
```

## Responsive Patterns

```tsx
// Mobile-first responsive padding
<div className="p-4 md:p-6 lg:p-8">
  // Scales up on larger screens
</div>

// Responsive gaps
<div className="space-y-4 md:space-y-6">
  // Larger gaps on desktop
</div>
```

## Common Patterns by Component Type

### Headers and Titles
- Main page header: `px-8 py-6`
- Section header: `p-6`
- Card header: `p-4`

### Content Areas
- Page content: `p-8`
- Card content: `p-6`
- Compact content: `p-4`
- Minimal padding: `p-3` or `p-2`

### Spacing Between Elements
- Page sections: `space-y-8`
- Card sections: `space-y-6`
- Form fields: `space-y-4`
- List items: `space-y-3`
- Inline elements: `space-x-2`

### Specific Components
- Stats cards grid: `gap-6`
- Button text spacing: `space-x-2`
- Icon + label: `space-x-2`
- Badge content: `space-x-1`

## Best Practices

1. **Be Consistent**: Use the same spacing for similar components
2. **Think in Scales**: Jump by consistent intervals (2 → 3 → 4 → 6 → 8)
3. **Mobile First**: Start with smaller padding on mobile
4. **Visual Hierarchy**: Larger spacing = more separation/importance
5. **Test Responsively**: Ensure spacing works on all screen sizes

## Quick Reference

### Most Common Values
- Page padding: `p-8`
- Card padding: `p-6`  
- Default spacing: `p-4`
- Button groups: `space-x-3`
- Inline spacing: `space-x-2`
- Section gaps: `space-y-8`
- Element gaps: `space-y-4`

### Do's and Don'ts
✅ DO use consistent spacing within a component type
✅ DO use larger spacing for major sections
✅ DO test spacing on different screen sizes
❌ DON'T mix different spacing scales randomly
❌ DON'T use inline styles for spacing
❌ DON'T create custom spacing values without strong justification

This guide ensures consistent, maintainable spacing without custom configuration.