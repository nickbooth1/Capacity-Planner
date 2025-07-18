import { test, expect, Page } from '@playwright/test';

// Helper to wait for map to load
async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-container]', { timeout: 10000 });
  await page.waitForFunction(
    () => {
      const mapElement = document.querySelector('.leaflet-container');
      return mapElement !== null;
    },
    { timeout: 10000 }
  );
}

test.describe('Stands Page with Map Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to stands page
    await page.goto('/stands');
    await page.waitForLoadState('networkidle');
  });

  test('displays map above stands table', async ({ page }) => {
    // Check map is visible
    await expect(
      page.locator('[aria-label="Interactive map showing aircraft stand locations"]')
    ).toBeVisible();

    // Check table is visible
    await expect(page.locator('[data-testid="stands-table"]')).toBeVisible();

    // Map should be above table
    const mapBox = await page.locator('[data-map-container]').boundingBox();
    const tableBox = await page.locator('[data-testid="stands-table"]').boundingBox();

    expect(mapBox?.y).toBeLessThan(tableBox?.y || 0);
  });

  test('synchronizes selection between map and table', async ({ page }) => {
    await waitForMap(page);

    // Click on a table row
    const firstRow = page.locator('[data-testid="stands-table"] tbody tr').first();
    await firstRow.click();

    // Check row is highlighted
    await expect(firstRow).toHaveClass(/bg-blue-50/);

    // Check map marker is selected (would need to verify marker state)
    // This would require inspecting the map markers which is complex with Leaflet
  });

  test('synchronizes filters between map and table', async ({ page }) => {
    await waitForMap(page);

    // Get initial stand count
    const initialCount = await page.locator('[aria-live="polite"]').textContent();

    // Apply status filter
    await page.click('[data-testid="status-filter-button"]');
    await page.click('[data-value="operational"]');

    // Check stand count updated in map
    await expect(page.locator('[aria-live="polite"]')).not.toHaveText(initialCount || '');

    // Check table is filtered
    const rows = page.locator('[data-testid="stands-table"] tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const statusBadge = rows.nth(i).locator('[data-testid="status-badge"]');
      await expect(statusBadge).toHaveText('operational');
    }
  });

  test('handles fullscreen mode', async ({ page }) => {
    await waitForMap(page);

    // Click fullscreen button
    await page.click('[aria-label="Enter fullscreen mode"]');

    // Check map is fullscreen
    const mapContainer = page.locator('[data-map-container]');
    await expect(mapContainer).toHaveClass(/fixed inset-0 z-50/);

    // Exit fullscreen with Escape
    await page.keyboard.press('Escape');

    // Check map is not fullscreen
    await expect(mapContainer).not.toHaveClass(/fixed inset-0 z-50/);
  });

  test('mobile responsive behavior', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await waitForMap(page);

    // Check collapse button is visible
    const collapseButton = page.locator('[aria-label="Collapse map"]');
    await expect(collapseButton).toBeVisible();

    // Collapse map
    await collapseButton.click();

    // Check map is collapsed
    const mapContainer = page.locator('[data-map-container] > div').nth(1);
    await expect(mapContainer).toHaveClass(/h-0 overflow-hidden/);

    // Expand map
    await page.click('[aria-label="Expand map"]');
    await expect(mapContainer).not.toHaveClass(/h-0 overflow-hidden/);
  });

  test('keyboard navigation', async ({ page }) => {
    await waitForMap(page);

    // Focus on map container
    await page.focus('[data-map-container]');

    // Test reset view shortcut
    await page.keyboard.press('Control+r');
    // Would verify map view is reset

    // Test fullscreen shortcut
    await page.keyboard.press('Control+f');
    await expect(page.locator('[data-map-container]')).toHaveClass(/fixed inset-0 z-50/);

    // Exit with Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-map-container]')).not.toHaveClass(/fixed inset-0 z-50/);
  });

  test('accessibility - ARIA labels and roles', async ({ page }) => {
    await waitForMap(page);

    // Check main regions
    await expect(
      page.locator('[role="region"][aria-label="Interactive map showing aircraft stand locations"]')
    ).toBeVisible();
    await expect(page.locator('[role="toolbar"][aria-label="Map controls"]')).toBeVisible();
    await expect(page.locator('[role="complementary"][aria-label="Map legend"]')).toBeVisible();

    // Check controls have proper labels
    await expect(page.locator('[aria-label="Reset map view to show all stands"]')).toBeVisible();
    await expect(page.locator('[aria-label="Enter fullscreen mode"]')).toBeVisible();
  });

  test('accessibility - screen reader announcements', async ({ page }) => {
    await waitForMap(page);

    // Enter fullscreen
    await page.click('[aria-label="Enter fullscreen mode"]');

    // Check for screen reader announcement
    const announcement = await page.waitForSelector('[role="status"][aria-live="polite"]', {
      state: 'attached',
      timeout: 2000,
    });

    expect(await announcement.textContent()).toBe('Entered fullscreen mode');
  });

  test('map legend displays correctly', async ({ page }) => {
    await waitForMap(page);

    // Check all status indicators are shown
    await expect(page.locator('text=Operational')).toBeVisible();
    await expect(page.locator('text=Maintenance')).toBeVisible();
    await expect(page.locator('text=Closed')).toBeVisible();

    // Check instruction text
    const instructionText = page.locator('text=/Click|Tap/ markers for details');
    await expect(instructionText).toBeVisible();
  });

  test('handles empty state', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/stands/map', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stands: [],
          bounds: null,
          center: null,
          zoom: 14,
        }),
      });
    });

    await page.reload();

    // Check empty state message
    await expect(page.locator('text=No stands to display')).toBeVisible();
  });

  test('performance - handles large datasets', async ({ page }) => {
    // Mock response with many stands
    const manyStands = Array.from({ length: 100 }, (_, i) => ({
      id: `stand-${i}`,
      code: `S${i}`,
      name: `Stand ${i}`,
      latitude: 53.3498 + i * 0.0001,
      longitude: -2.2744 + i * 0.0001,
      status: i % 3 === 0 ? 'operational' : i % 3 === 1 ? 'maintenance' : 'closed',
      terminal_code: `T${(i % 3) + 1}`,
      aircraft_size_category: 'Medium',
      max_weight_kg: 75000,
      power_supply: ['400Hz'],
      ground_support: ['GPU'],
    }));

    await page.route('**/api/stands/map', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stands: manyStands,
          bounds: {
            north: 53.36,
            south: 53.3498,
            east: -2.2744,
            west: -2.285,
          },
          center: { lat: 53.3549, lng: -2.2797 },
          zoom: 14,
        }),
      });
    });

    await page.reload();
    await waitForMap(page);

    // Check stand count
    await expect(page.locator('text=(100 stands)')).toBeVisible();

    // Verify map loads within reasonable time
    const startTime = Date.now();
    await page.waitForSelector('.leaflet-marker-icon', { timeout: 5000 });
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
  });

  test('search functionality works with map', async ({ page }) => {
    await waitForMap(page);

    // Search for specific stand
    await page.fill('[placeholder="Search stands..."]', 'A1');

    // Wait for debounce
    await page.waitForTimeout(500);

    // Check stand count updated
    await expect(page.locator('[aria-live="polite"]')).toContainText('1 stands');

    // Clear search
    await page.fill('[placeholder="Search stands..."]', '');
    await page.waitForTimeout(500);

    // Check all stands shown again
    await expect(page.locator('[aria-live="polite"]')).not.toContainText('1 stands');
  });
});
