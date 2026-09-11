import { expect, test } from '@playwright/test'

test('ForgeAxis exposes its primary domain workflow', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('ForgeAxis')
  await expect(page.getByRole('heading', { level: 1, name: 'Line control' })).toBeVisible()
  await page.getByRole('button', { name: 'quality' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Quality gates' })).toBeVisible()
})
