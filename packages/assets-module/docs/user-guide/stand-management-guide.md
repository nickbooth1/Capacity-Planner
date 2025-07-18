# Stand Management User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Managing Stands](#managing-stands)
4. [Bulk Import](#bulk-import)
5. [Search and Filters](#search-and-filters)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)
8. [FAQ](#faq)

## Introduction

The Stand Management system allows you to efficiently manage aircraft parking stands at your airport. This guide will help you understand how to create, update, and manage stands, as well as perform bulk operations and track changes.

### Key Features

- **Complete CRUD Operations**: Create, view, update, and delete stands
- **Bulk Import**: Import hundreds of stands from CSV files
- **Real-time Updates**: See changes made by other users instantly
- **Advanced Search**: Find stands quickly with powerful search and filters
- **Audit Trail**: Track all changes with comprehensive history
- **Role-based Access**: Control who can view and modify stands

## Getting Started

### Accessing Stand Management

1. Log in to the Capacity Planner application
2. Navigate to **Assets** → **Stands** from the main menu
3. You'll see the Stand Management dashboard

### Understanding the Interface

![Stand Management Interface](./images/stand-management-overview.png)

The main interface consists of:

- **Search Bar**: Quick search by stand code or name
- **Filter Panel**: Advanced filtering options
- **Add Stand Button**: Create new stands
- **Import Button**: Bulk import from CSV
- **Data Table**: List of all stands with actions

### Required Permissions

To perform various actions, you need specific permissions:

- **View Stands**: `stands.read`
- **Create Stands**: `stands.create`
- **Update Stands**: `stands.update`
- **Delete Stands**: `stands.delete`
- **Import Stands**: `stands.import`

Contact your administrator if you need additional permissions.

## Managing Stands

### Creating a New Stand

1. Click the **"Add Stand"** button
2. Fill in the required information:
   - **Code**: Unique identifier (e.g., "A1", "B15")
   - **Name**: Descriptive name (e.g., "Alpha 1")
   - **Terminal**: Associated terminal (optional)
   - **Status**: Operational, Maintenance, or Closed

3. Add capability details (optional but recommended):
   - **Dimensions**: Length, width, and height
   - **Aircraft Compatibility**: Maximum wingspan, length, and compatible categories
   - **Ground Support**: Available services and equipment
   - **Operational Constraints**: Time restrictions and weather limits

4. Click **"Create Stand"** to save

#### Example: Creating a Wide-body Stand

```
Code: E5
Name: Echo 5 - Wide Body
Terminal: Terminal 2
Status: Operational

Dimensions:
- Length: 75m
- Width: 80m
- Height: 18m

Aircraft Compatibility:
- Max Wingspan: 80m
- Max Length: 76m
- Compatible Categories: D, E, F
- Specific Aircraft: A380, B777-300ER, A350-1000
```

### Viewing Stand Details

1. Click on any stand in the table to view details
2. The detail view shows:
   - Basic information
   - Full capability specifications
   - Maintenance history
   - Change history
   - Current utilization

### Updating a Stand

1. Click the **"Edit"** button next to the stand
2. Modify the desired fields
3. Click **"Update Stand"** to save changes

**Important**: The system uses optimistic locking. If another user has modified the stand while you were editing, you'll see a conflict message. Refresh and try again.

### Deleting a Stand

1. Click the **"Delete"** button next to the stand
2. Provide a reason for deletion (optional but recommended)
3. Confirm the deletion

**Note**: Stands are soft-deleted, meaning they're marked as deleted but retained for historical records.

## Bulk Import

### Preparing Your CSV File

Create a CSV file with the following columns:

```csv
code,name,terminal,status,length,width,height,maxWingspan,maxLength,maxWeight,categories
A1,Alpha 1,Terminal 1,operational,60,30,15,65,70,560000,"C,D,E"
A2,Alpha 2,Terminal 1,operational,55,28,14,60,65,450000,"B,C,D"
```

#### CSV Column Reference

| Column | Required | Description | Format |
|--------|----------|-------------|--------|
| code | Yes | Unique stand identifier | Alphanumeric, max 10 chars |
| name | Yes | Stand name | Text, max 100 chars |
| terminal | No | Terminal assignment | Text, max 50 chars |
| status | No | Stand status | operational/maintenance/closed |
| length | No | Stand length | Number (meters) |
| width | No | Stand width | Number (meters) |
| height | No | Stand height clearance | Number (meters) |
| maxWingspan | No | Maximum aircraft wingspan | Number (meters) |
| maxLength | No | Maximum aircraft length | Number (meters) |
| maxWeight | No | Maximum aircraft weight | Number (kg) |
| categories | No | Compatible ICAO categories | Comma-separated list |

### Performing the Import

1. Click the **"Import Stands"** button
2. Select your CSV file
3. Review the preview to ensure data looks correct
4. Click **"Start Import"**
5. Monitor the progress:
   - Total rows to process
   - Successfully imported
   - Errors encountered

### Handling Import Errors

If errors occur during import:

1. Download the error report
2. Fix the issues in your CSV file
3. Re-import only the corrected rows

Common errors:
- **Duplicate code**: A stand with this code already exists
- **Invalid status**: Use only operational, maintenance, or closed
- **Invalid number format**: Ensure numeric fields contain only numbers

## Search and Filters

### Quick Search

Use the search bar to quickly find stands by:
- Stand code (e.g., "A1")
- Stand name (e.g., "Alpha")

Search is case-insensitive and finds partial matches.

### Advanced Filters

Click **"Filters"** to access advanced filtering:

1. **Status Filter**
   - Operational
   - Maintenance
   - Closed

2. **Terminal Filter**
   - Select one or multiple terminals

3. **Aircraft Category Filter**
   - Filter by compatible aircraft categories

4. **Dimension Filters**
   - Minimum/maximum length
   - Minimum/maximum wingspan

### Combining Filters

Filters work together (AND logic). For example:
- Status: Operational
- Terminal: Terminal 1
- Category: E

This shows only operational stands in Terminal 1 that can handle category E aircraft.

### Saving Filter Presets

1. Apply your desired filters
2. Click **"Save Filter Preset"**
3. Name your preset (e.g., "Wide-body Stands")
4. Access saved presets from the filter menu

## Troubleshooting

### Common Issues and Solutions

#### "Stand has been modified by another user"

**Cause**: Someone else updated the stand while you were editing.

**Solution**:
1. Note your changes
2. Refresh the page
3. Re-apply your changes

#### Import fails with "Permission denied"

**Cause**: You don't have the `stands.import` permission.

**Solution**: Contact your administrator to grant import permissions.

#### Cannot see certain fields

**Cause**: Field-level permissions restrict access to sensitive data.

**Solution**: 
- Location data requires `stands.location` permission
- Infrastructure details require `stands.infrastructure` permission

#### Search returns no results

**Cause**: Filters may be too restrictive.

**Solution**:
1. Clear all filters
2. Try a broader search term
3. Check if you're in the correct organization

### Performance Tips

1. **Use filters** instead of scrolling through all stands
2. **Export filtered results** for offline analysis
3. **Batch similar updates** using the bulk import feature
4. **Avoid concurrent edits** to the same stand

## Best Practices

### Naming Conventions

Establish consistent naming:
- **Codes**: Use systematic patterns (A1-A20, B1-B20)
- **Names**: Include terminal and type (e.g., "T2 Gate A1 - Narrow Body")

### Regular Maintenance

1. **Review stand status** weekly
2. **Update dimensions** when modifications occur
3. **Archive unused stands** instead of deleting
4. **Document changes** in the reason field

### Data Quality

1. **Complete all fields** for better search and filtering
2. **Verify aircraft compatibility** data regularly
3. **Use standard units** (meters for dimensions, kg for weight)
4. **Regular audits** of stand data accuracy

### Security Best Practices

1. **Limit permissions** to necessary personnel only
2. **Review audit logs** for unauthorized changes
3. **Use strong passwords** and enable 2FA
4. **Report suspicious activity** immediately

## FAQ

### Q: Can I recover a deleted stand?

A: Yes, deleted stands are soft-deleted. Contact your administrator to restore a deleted stand.

### Q: How often is data synchronized?

A: Data updates are real-time. Changes made by other users appear immediately.

### Q: What's the maximum number of stands I can import?

A: The system can handle imports of 10,000+ stands, but we recommend batches of 1,000 for optimal performance.

### Q: Can I export stand data?

A: Yes, use the **"Export"** button to download data in CSV format. Exports respect your current filters.

### Q: How do I track who made changes?

A: View the change history in the stand details, or contact an administrator for detailed audit logs.

### Q: Can I attach documents to stands?

A: This feature is planned for a future release. Currently, use the metadata field for reference information.

### Q: What happens if two people edit the same stand?

A: The system uses optimistic locking. The first person to save wins; the second person sees a conflict error and must refresh.

### Q: How do I report a bug or request a feature?

A: Use the feedback button in the application or contact support at support@capacity-planner.com

## Keyboard Shortcuts

- **Ctrl/Cmd + K**: Focus search
- **Ctrl/Cmd + N**: New stand
- **Ctrl/Cmd + F**: Toggle filters
- **Esc**: Close dialogs
- **Enter**: Submit forms

## Getting Help

If you need additional assistance:

1. **In-app Help**: Click the "?" icon for contextual help
2. **Documentation**: Full documentation at docs.capacity-planner.com
3. **Support Team**: support@capacity-planner.com
4. **Training Videos**: Available in the Help Center

---

*Last updated: January 2025*
*Version: 1.0*