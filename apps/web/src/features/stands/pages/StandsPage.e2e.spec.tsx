import { test, expect } from '@playwright/test';

test.describe('Stand Management E2E Tests', () => {
  const organizationId = 'test-org-id';
  const userId = 'test-user-id';

  test.beforeEach(async ({ page }) => {
    // Mock authentication headers
    await page.route('**/*', async (route) => {
      const headers = route.request().headers();
      headers['x-organization-id'] = organizationId;
      headers['x-user-id'] = userId;
      await route.continue({ headers });
    });

    // Navigate to stands page
    await page.goto('/admin/stands');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Stand List View', () => {
    test('should display stands table with data', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('[data-testid="stands-table"]');

      // Check table headers
      await expect(page.locator('th:has-text("Code")')).toBeVisible();
      await expect(page.locator('th:has-text("Name")')).toBeVisible();
      await expect(page.locator('th:has-text("Terminal")')).toBeVisible();
      await expect(page.locator('th:has-text("Status")')).toBeVisible();
      await expect(page.locator('th:has-text("Dimensions")')).toBeVisible();

      // Check that stands are displayed
      await expect(page.locator('td:has-text("A1")')).toBeVisible();
      await expect(page.locator('td:has-text("Stand A1")')).toBeVisible();
    });

    test('should search stands', async ({ page }) => {
      // Type in search box
      await page.fill('input[placeholder="Search stands..."]', 'A1');
      await page.waitForTimeout(500); // Debounce delay

      // Check that only matching results are shown
      await expect(page.locator('td:has-text("A1")')).toBeVisible();
      await expect(page.locator('td:has-text("A2")')).not.toBeVisible();
    });

    test('should filter stands by status', async ({ page }) => {
      // Open filters
      await page.click('button:has-text("Filters")');

      // Select operational status
      await page.click('[data-testid="status-filter"]');
      await page.click('text=Operational');

      // Verify filtered results
      await page.waitForTimeout(500);
      const statusBadges = await page.locator('[data-testid="status-badge"]').allTextContents();
      expect(statusBadges.every((status) => status === 'operational')).toBeTruthy();
    });

    test('should paginate through stands', async ({ page }) => {
      // Check initial page info
      await expect(page.locator('text=/Showing \\d+ of \\d+ stands/')).toBeVisible();

      // Navigate to next page if available
      const nextButton = page.locator('button:has-text("Next")');
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForLoadState('networkidle');

        // Verify page changed
        await expect(page.locator('text=/Showing \\d+ of \\d+ stands/')).toBeVisible();
      }
    });
  });

  test.describe('Stand CRUD Operations', () => {
    test('should create a new stand', async ({ page }) => {
      // Click Add Stand button
      await page.click('button:has-text("Add Stand")');

      // Wait for dialog
      await page.waitForSelector('h2:has-text("Create New Stand")');

      // Fill form
      await page.fill('input[name="code"]', 'E2E-1');
      await page.fill('input[name="name"]', 'E2E Test Stand 1');
      await page.fill('input[name="terminal"]', 'Terminal E2E');

      // Select status
      await page.click('[data-testid="status-select"]');
      await page.click('text=Operational');

      // Fill dimensions
      await page.fill('input[name="dimensions.length"]', '65');
      await page.fill('input[name="dimensions.width"]', '35');
      await page.fill('input[name="dimensions.height"]', '18');

      // Fill aircraft compatibility
      await page.fill('input[name="aircraftCompatibility.maxWingspan"]', '70');
      await page.fill('input[name="aircraftCompatibility.maxLength"]', '75');
      await page.fill('input[name="aircraftCompatibility.maxWeight"]', '600000');

      // Submit form
      await page.click('button:has-text("Create Stand")');

      // Wait for success
      await page.waitForSelector('text=Stand created successfully', { timeout: 5000 });

      // Verify new stand appears in table
      await expect(page.locator('td:has-text("E2E-1")')).toBeVisible();
      await expect(page.locator('td:has-text("E2E Test Stand 1")')).toBeVisible();
    });

    test('should edit an existing stand', async ({ page }) => {
      // Find and click edit button for first stand
      const firstRow = page.locator('tr').filter({ hasText: 'A1' });
      await firstRow.locator('button:has-text("Edit")').click();

      // Wait for dialog
      await page.waitForSelector('h2:has-text("Edit Stand")');

      // Update name
      await page.fill('input[name="name"]', 'Updated Stand A1');

      // Update status
      await page.click('[data-testid="status-select"]');
      await page.click('text=Maintenance');

      // Submit form
      await page.click('button:has-text("Update Stand")');

      // Wait for success
      await page.waitForSelector('text=Stand updated successfully', { timeout: 5000 });

      // Verify updates in table
      await expect(page.locator('td:has-text("Updated Stand A1")')).toBeVisible();
      await expect(
        page.locator('[data-testid="status-badge"]:has-text("maintenance")')
      ).toBeVisible();
    });

    test('should handle optimistic locking conflict', async ({ page }) => {
      // Open edit dialog for same stand in two "tabs" (simulated)
      const firstRow = page.locator('tr').filter({ hasText: 'A1' });

      // First edit
      await firstRow.locator('button:has-text("Edit")').click();
      await page.fill('input[name="name"]', 'First Update');
      await page.click('button:has-text("Update Stand")');
      await page.waitForSelector('text=Stand updated successfully');

      // Simulate second user trying to update with old version
      await page.evaluate(() => {
        // Mock API to return version conflict
        window.fetch = async (url, options) => {
          if (url.includes('/stands/') && options?.method === 'PUT') {
            return {
              ok: false,
              status: 409,
              json: async () => ({
                success: false,
                error: 'Stand has been modified by another user',
              }),
            };
          }
          return window.fetch(url, options);
        };
      });

      // Try second edit
      await firstRow.locator('button:has-text("Edit")').click();
      await page.fill('input[name="name"]', 'Second Update');
      await page.click('button:has-text("Update Stand")');

      // Should show conflict error
      await expect(page.locator('text=Stand has been modified by another user')).toBeVisible();
    });

    test('should delete a stand', async ({ page }) => {
      // Find and click delete button
      const targetRow = page.locator('tr').filter({ hasText: 'A2' });
      await targetRow.locator('button:has-text("Delete")').click();

      // Confirm deletion in dialog
      await page.waitForSelector('text=Are you sure you want to delete this stand?');
      await page.click('button:has-text("Delete")');

      // Wait for success
      await page.waitForSelector('text=Stand deleted successfully', { timeout: 5000 });

      // Verify stand is removed from table
      await expect(page.locator('td:has-text("A2")')).not.toBeVisible();
    });
  });

  test.describe('Bulk Import', () => {
    test('should import stands from CSV', async ({ page }) => {
      // Click import button
      await page.click('button:has-text("Import Stands")');

      // Wait for import dialog
      await page.waitForSelector('h2:has-text("Import Stands")');

      // Upload CSV file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'stands.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(`code,name,terminal,status,length,width,height
B1,Stand B1,Terminal 2,operational,60,30,15
B2,Stand B2,Terminal 2,operational,55,28,14`),
      });

      // Start import
      await page.click('button:has-text("Start Import")');

      // Wait for import to complete
      await page.waitForSelector('text=Import completed', { timeout: 10000 });

      // Check import results
      await expect(page.locator('text=Total rows: 2')).toBeVisible();
      await expect(page.locator('text=Success: 2')).toBeVisible();
      await expect(page.locator('text=Errors: 0')).toBeVisible();

      // Close dialog and verify stands were added
      await page.click('button:has-text("Close")');
      await expect(page.locator('td:has-text("B1")')).toBeVisible();
      await expect(page.locator('td:has-text("B2")')).toBeVisible();
    });

    test('should handle import errors', async ({ page }) => {
      // Click import button
      await page.click('button:has-text("Import Stands")');

      // Upload CSV with invalid data
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'invalid-stands.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(`code,name,terminal,status,length,width
,Missing Code,Terminal 1,operational,60,30
DUPLICATE,Stand 1,Terminal 1,invalid-status,not-a-number,30`),
      });

      // Start import
      await page.click('button:has-text("Start Import")');

      // Wait for import to complete
      await page.waitForSelector('text=Import completed', { timeout: 10000 });

      // Check error report
      await expect(page.locator('text=Errors: 2')).toBeVisible();

      // View error details
      await page.click('button:has-text("View Errors")');
      await expect(page.locator('text=Row 1: Code is required')).toBeVisible();
      await expect(page.locator('text=Row 2: Invalid status')).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('should receive real-time updates when another user modifies stands', async ({
      page,
      context,
    }) => {
      // Open second page (simulating another user)
      const page2 = await context.newPage();
      await page2.goto('/admin/stands');
      await page2.waitForLoadState('networkidle');

      // Create stand in second page
      await page2.click('button:has-text("Add Stand")');
      await page2.fill('input[name="code"]', 'RT-1');
      await page2.fill('input[name="name"]', 'Real-time Test Stand');
      await page2.click('button:has-text("Create Stand")');
      await page2.waitForSelector('text=Stand created successfully');

      // Check that first page receives update
      await page.waitForSelector('td:has-text("RT-1")', { timeout: 5000 });
      await expect(page.locator('td:has-text("Real-time Test Stand")')).toBeVisible();

      // Clean up
      await page2.close();
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      // Tab through main controls
      await page.keyboard.press('Tab'); // Search input
      await expect(page.locator('input[placeholder="Search stands..."]')).toBeFocused();

      await page.keyboard.press('Tab'); // Filters button
      await expect(page.locator('button:has-text("Filters")')).toBeFocused();

      await page.keyboard.press('Tab'); // Add Stand button
      await expect(page.locator('button:has-text("Add Stand")')).toBeFocused();

      // Open create dialog with Enter
      await page.keyboard.press('Enter');
      await expect(page.locator('h2:has-text("Create New Stand")')).toBeVisible();

      // Tab through form fields
      await page.keyboard.press('Tab');
      await expect(page.locator('input[name="code"]')).toBeFocused();
    });

    test('should have proper ARIA labels', async ({ page }) => {
      // Check main elements have ARIA labels
      await expect(page.locator('[aria-label="Search stands"]')).toBeVisible();
      await expect(page.locator('[aria-label="Filter options"]')).toBeVisible();
      await expect(page.locator('[aria-label="Add new stand"]')).toBeVisible();

      // Check table has proper structure
      await expect(page.locator('table[role="table"]')).toBeVisible();
      await expect(page.locator('thead[role="rowgroup"]')).toBeVisible();
    });

    test('should announce status changes to screen readers', async ({ page }) => {
      // Create a stand
      await page.click('button:has-text("Add Stand")');
      await page.fill('input[name="code"]', 'SR-1');
      await page.fill('input[name="name"]', 'Screen Reader Test');
      await page.click('button:has-text("Create Stand")');

      // Check for ARIA live region announcement
      await expect(
        page.locator('[role="status"]:has-text("Stand created successfully")')
      ).toBeVisible();
    });
  });
});
