import{expect,test}from'@playwright/test';test('ForgeAxis exposes routed enterprise workflows',async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'ForgeAxis command center'})).toBeVisible();await page.getByRole('link',{name:'Operations'}).click();const review=page.getByRole('region',{name:'Machine readiness review'});await review.getByRole('button',{name:'Evaluate release'}).click();await expect(review).toContainText(/ready|blocked/);await page.getByRole('link',{name:'Workflows'}).click();await expect(page.getByRole('heading',{name:'Workflow catalog'})).toBeVisible();await page.getByRole('link',{name:'Data model'}).click();await expect(page.getByRole('heading',{name:'Connected data model'})).toBeVisible();await page.getByRole('link',{name:'Data tools'}).click();await expect(page.getByRole('heading',{name:'Import and recovery tools'})).toBeVisible();await page.getByRole('textbox',{name:'Workspace JSON'}).fill('{}');await page.getByRole('button',{name:'Preview import'}).click();await expect(page.getByRole('alert')).toContainText('not a compatible');await page.getByRole('link',{name:'Activity',exact:true}).click();await expect(page.getByRole('heading',{name:'Operational activity'})).toBeVisible()})

test('failed production inspection executes rework and verified release', async ({ page }) => {
    await page.goto('/operations');
    const actor = page.getByRole('combobox', { name: 'Current actor' });
    const action = async (name: string) => page.getByRole('button', { name, exact: true }).click();
    const save = async () => { await action('Save command'); await expect(page.getByRole('dialog')).toHaveCount(0); };
    await page.getByRole('button', { name: /^Work orders/ }).click();
    await action('Release production'); await save();
    await actor.selectOption('actor-1');
    await action('Record production count');
    await page.getByRole('spinbutton', { name: 'Good units', exact: true }).fill('100'); await save();
    await page.getByRole('button', { name: /^Quality inspections/ }).click();
    await actor.selectOption('actor-2');
    await action('Record quality decision');
    await page.getByRole('combobox', { name: 'Decision', exact: true }).selectOption('failed'); await save();
    await action('Plan quality rework');
    await page.getByRole('textbox', { name: 'Rework instructions', exact: true }).fill('Rework the housing mating surface.'); await save();
    await page.getByRole('button', { name: /^Quality dispositions/ }).click();
    await actor.selectOption('actor-1');
    await action('Record completed rework');
    await page.getByRole('textbox', { name: 'Execution evidence', exact: true }).fill('Surface reworked to drawing tolerance.'); await save();
    await actor.selectOption('actor-2');
    await action('Release verified rework'); await action('Save command');
    await expect(page.getByRole('alert')).toContainText('must pass');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Quality inspections/ }).click();
    await page.getByRole('button', { name: /^Rework verification/ }).click();
    await action('Record quality decision'); await save();
    await page.getByRole('button', { name: /^Quality dispositions/ }).click();
    await action('Release verified rework'); await save();
    await actor.selectOption('actor-0');
    await page.getByRole('button', { name: /^Work orders/ }).click();
    await action('Complete batch'); await save();
    await page.reload();
    await page.getByRole('button', { name: /^Work orders/ }).click();
    await expect(page.locator('.detail-title')).toContainText('complete');
    await page.getByRole('button', { name: /^Quality inspections/ }).click();
    await expect(page.locator('.detail-title')).toContainText('failed');
});


test('operator downtime survives maintenance and resumes explicitly', async ({page}) => {
 await page.goto('/operations');
 const actor = page.getByRole('combobox',{name:'Current actor'});
 const dialog = page.getByRole('dialog');
 const save = async () => {await dialog.getByRole('button',{name:'Save command',exact:true}).click();await expect(dialog).toHaveCount(0);};
 await page.getByRole('button',{name:/^Work orders/}).click();
 await page.getByRole('button',{name:'Release production',exact:true}).click(); await save();
 await actor.selectOption('actor-1');
 await page.getByRole('button',{name:'Run: Pause production',exact:true}).click();
 await dialog.getByLabel('Stop reason',{exact:true}).fill('Planned tooling calibration stop.');await save();
 await actor.selectOption('actor-0');
 await page.getByRole('button',{name:/^Production machines/}).click();
 await page.getByRole('button',{name:'Place machine on maintenance',exact:true}).click();
 await dialog.getByLabel('Maintenance reason',{exact:true}).fill('Inspect tooling before restart.');await save();
 await page.getByRole('button',{name:'Run: Resume stopped production',exact:true}).click();
 await dialog.getByRole('button',{name:'Save command',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('maintenance');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:/^Maintenance tickets/}).click();
 await page.getByRole('button',{name:'Resolve maintenance',exact:true}).click();await save();
 await page.getByRole('button',{name:/^Work orders/}).click();
 await expect(page.locator('.detail-title')).toContainText('held');
 await page.getByRole('button',{name:'Run: Resume stopped production',exact:true}).click();await save();
 await page.reload(); await page.getByRole('button',{name:/^Work orders/}).click();
 await expect(page.locator('.detail-title')).toContainText('running');
 await expect(page.getByRole('region',{name:'Production release gate'})).toContainText('resumed');
});

test('recorded scrap requires classified supervisor release before completion', async ({page}) => {
 await page.goto('/operations');
 const actor = page.getByRole('combobox',{name:'Current actor'});
 const dialog = page.getByRole('dialog');
 const save = async () => {await dialog.getByRole('button',{name:'Save command',exact:true}).click();await expect(dialog).toHaveCount(0);};
 await page.getByRole('button',{name:/^Work orders/}).click();
 await page.getByRole('button',{name:'Release production',exact:true}).click();await save();
 await actor.selectOption('actor-1');
 await page.getByRole('button',{name:'Record production count',exact:true}).click();
 await dialog.getByLabel('Good units',{exact:true}).fill('95');
 await dialog.getByLabel('Scrapped units',{exact:true}).fill('5');await save();
 await page.getByRole('button',{name:/^Production events/}).click();
 await actor.selectOption('actor-2');
 await page.getByRole('button',{name:'Classify recorded scrap',exact:true}).click();
 await dialog.getByRole('combobox',{name:'Scrap category',exact:true}).selectOption('setup');
 await dialog.getByLabel('Disposition rationale',{exact:true}).fill('Initial tooling setup produced dimensional rejects.');await save();
 await page.getByRole('button',{name:/^Work orders/}).click();
 await expect(page.locator('.detail-title')).toContainText('held');
 await page.getByRole('button',{name:/^Scrap dispositions/}).click();
 await actor.selectOption('actor-0');
 await page.getByRole('button',{name:'Release scrap disposition',exact:true}).click();await save();
 await page.reload();await page.getByRole('button',{name:/^Scrap dispositions/}).click();
 await expect(page.locator('.detail-title')).toContainText('released');
 await expect(page.locator('.detail')).toContainText('5');
 await page.getByRole('button',{name:/^Work orders/}).click();
 await expect(page.locator('.detail-title')).toContainText('running');
});


test('machine changeover rejection and quality release govern production', async ({ page }) => {
    await page.goto('/operations');
    const actor = page.getByRole('combobox', { name: 'Current actor' });
    const dialog = page.getByRole('dialog');
    const save = async () => { await dialog.getByRole('button', { name: 'Save command', exact: true }).click(); await expect(dialog).toHaveCount(0); };
    const material = await page.locator('.detail dl').innerText();
    const materialCode = material.split('Material code')[1]?.trim().split(/\s+/)[0] ?? '';
    await page.getByRole('button', { name: /^Production machines/ }).click();
    await page.getByRole('button', { name: 'Request machine changeover', exact: true }).click();
    await dialog.getByLabel('Target material', { exact: true }).fill(materialCode);
    await dialog.getByLabel('Changeover evidence', { exact: true }).fill('Clear the previous batch and prepare the line for this material.');
    await save();
    await page.getByRole('button', { name: /^Machine changeovers/ }).click();
    await actor.selectOption('actor-1');
    await page.getByRole('button', { name: 'Submit setup evidence', exact: true }).click();
    await dialog.getByLabel('Changeover evidence', { exact: true }).fill('Operator confirms cleaning and tooling alignment are complete.');await save();
    await actor.selectOption('actor-2');
    await page.getByRole('button', { name: 'Reject setup evidence', exact: true }).click();
    await dialog.getByLabel('Changeover evidence', { exact: true }).fill('Inspectors found residue requiring another cleaning pass.');await save();
    await actor.selectOption('actor-1');
    await page.getByRole('button', { name: 'Submit setup evidence', exact: true }).click();
    await dialog.getByLabel('Changeover evidence', { exact: true }).fill('Cleaning repeated and residue removed from the tooling.');await save();
    await actor.selectOption('actor-2');
    await page.getByRole('button', { name: 'Release verified setup', exact: true }).click();
    await dialog.getByLabel('Changeover evidence', { exact: true }).fill('Independent quality inspection confirms safe material setup.');await save();
    await page.reload();
    await actor.selectOption('actor-0');
    await page.getByRole('button', { name: /^Production machines/ }).click();
    await page.getByRole('button', { name: 'Edit draft', exact: true }).click();
    await expect(dialog.getByLabel('Configured material', { exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Work orders/ }).click();
    await page.getByRole('button', { name: 'Release production', exact: true }).click();await save();
    await expect(page.locator('.detail-title')).toContainText('running');
});

test('factory execution reserves material, records consumption and verifies genealogy', async ({ page }) => {
  await page.goto('/factory-execution');
  await expect(page.getByRole('heading', { name: 'Shift, material and genealogy control' })).toBeVisible();
  const role = page.getByRole('combobox', { name: 'Execution role' });
  await page.getByRole('button', { name: 'Reserve for work order' }).click();
  await expect(page.getByRole('status')).toContainText('Material reserved');
  await expect(page.getByText('Lot balance: 800 kg')).toBeVisible();
  await role.selectOption('Operator');
  await page.getByRole('button', { name: 'Accept staged material' }).click();
  await page.getByRole('button', { name: 'Record consumption' }).click();
  await role.selectOption('Quality Engineer');
  await page.getByRole('button', { name: 'Verify output genealogy' }).click();
  await expect(page.getByRole('status')).toContainText('Lot genealogy verified');
  await page.reload();
  await expect(page.getByRole('listitem').filter({ hasText: 'lot-1 → FG-2026-001' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Factory execution history' })).toContainText('genealogy-recorded');
});

test('current operator certification gates assignment acceptance and quality release',async({page})=>{
 await page.goto('/operator-control');const role=page.getByLabel('Operator-control role');await page.getByRole('button',{name:'Request press certification'}).click();
 await role.selectOption('Quality Engineer');await page.getByRole('button',{name:'Activate certification'}).click();await role.selectOption('Supervisor');await page.getByRole('button',{name:'Assign certified operator'}).click();
 await role.selectOption('Operator');await page.getByRole('button',{name:'Accept work assignment'}).click();await role.selectOption('Quality Engineer');await page.getByRole('button',{name:'Release assigned work'}).click();await page.reload();
 await expect(page.getByRole('heading',{name:'Work assignment'}).locator('..')).toContainText('released · operator-a');await expect(page.getByRole('region',{name:'Operator control history'})).toContainText('work-released');
});

test('downtime holds production until assigned repair passes quality verification',async({page})=>{await page.goto('/maintenance-control');const role=page.getByLabel('Maintenance role');await page.getByRole('button',{name:'Report machine downtime'}).click();await role.selectOption('Supervisor');await page.getByRole('button',{name:'Assign independent repair'}).click();await role.selectOption('Operator');await page.getByRole('button',{name:'Complete assigned repair'}).click();await role.selectOption('Quality Engineer');await page.getByRole('button',{name:'Verify and resume production'}).click();await page.reload();await expect(page.getByRole('heading',{name:'Machine 1 recovery'}).locator('..')).toContainText('verified · machine ready · order running');await expect(page.getByRole('region',{name:'Maintenance control history'})).toContainText('repair-verified')});

test('passing sample and verified genealogy produce a durable batch release',async({page})=>{await page.goto('/batch-release');const role=page.getByLabel('Batch role');await page.getByRole('button',{name:'Record passing sample'}).click();await role.selectOption('Supervisor');await page.getByRole('button',{name:'Issue batch release'}).click();await page.reload();await expect(page.getByRole('heading',{name:'Batch 1'}).locator('..')).toContainText('released · 1 samples · genealogy verified');await expect(page.getByRole('region',{name:'Batch release history'})).toContainText('batch-released')});
test('gauge drift holds production until calibration is independently verified',async({page})=>{await page.goto('/calibration-control');const role=page.getByRole('combobox',{name:'Calibration role'});await page.getByRole('button',{name:'Report gauge drift'}).click();await role.selectOption('Supervisor');await page.getByRole('button',{name:'Assign calibration'}).click();await role.selectOption('Maintenance');await page.getByRole('button',{name:'Complete calibration'}).click();await role.selectOption('Quality Engineer');await page.getByRole('button',{name:'Verify calibration'}).click();await role.selectOption('Supervisor');await page.getByRole('button',{name:'Release held order'}).click();await page.reload();await expect(page.getByText('verified · order running · case closed')).toBeVisible();await expect(page.getByRole('list',{name:'Calibration history'})).toContainText('order-released-after-calibration')});
test('verified genealogy releases production into shipment custody',async({page})=>{await page.goto('/release-dossier');const role=page.getByRole('combobox',{name:'Release role'});await page.getByRole('button',{name:'Open release dossier'}).click();await role.selectOption('Operator');await page.getByRole('button',{name:'Record material genealogy'}).click();await role.selectOption('Quality Engineer');await page.getByRole('button',{name:'Verify release quality'}).click();await role.selectOption('Production Supervisor');await page.getByRole('button',{name:'Authorize production release'}).click();await role.selectOption('Shipping');await page.getByRole('button',{name:'Dispatch released batch'}).click();await expect(page.getByRole('status')).toContainText('dispatched');await page.reload();await expect(page.getByText(/dispatched · 120 of 120 units/)).toBeVisible();await expect(page.getByText(/Shipment dispatched · 120 units/)).toBeVisible();await expect(page.getByRole('region',{name:'Release dossier history'})).toContainText('released-batch-dispatched')});
test('approved deviation updates production material and machine release',async({page})=>{await page.goto('/deviation-control');const role=page.getByRole('combobox',{name:'Deviation role'});await page.getByRole('button',{name:'Report production deviation'}).click();await role.selectOption('Process Engineer');await page.getByRole('button',{name:'Assess production deviation'}).click();await role.selectOption('Quality Lead');await page.getByRole('button',{name:'Approve deviation disposition'}).click();await role.selectOption('Production Supervisor');await page.getByRole('button',{name:'Execute deviation disposition'}).click();await role.selectOption('Quality Lead');await page.getByRole('button',{name:'Verify production release'}).click();await page.reload();await expect(page.getByText(/running · completed 78 · scrap 2 · deviation verified/)).toBeVisible();await expect(page.getByText(/Machine released · material consumed 78/)).toBeVisible();await expect(page.getByRole('list',{name:'Deviation history'})).toContainText('deviation-release-verified')});

test('executes a constrained production schedule',async({page})=>{await page.goto('/production-scheduling');await page.getByRole('button',{name:'Draft production schedule'}).click();await page.getByLabel('Scheduling role').selectOption('Material Controller');await page.getByRole('button',{name:'Allocate inputs'}).click();await page.getByLabel('Scheduling role').selectOption('Production Manager');await page.getByRole('button',{name:'Release schedule'}).click();await page.getByLabel('Scheduling role').selectOption('Operator');await page.getByRole('button',{name:'Start work order'}).click();await page.getByRole('button',{name:'Complete work order'}).click();await expect(page.getByRole('status')).toContainText('Work order completed');});

test('releases independently approved incoming material',async({page})=>{await page.goto('/incoming-quality');await page.getByRole('button',{name:'Open incoming inspection'}).click();await page.getByLabel('Incoming quality role').selectOption('Quality Technician');await page.getByRole('button',{name:'Record strength sample'}).click();await page.getByRole('button',{name:'Evaluate sample'}).click();await page.getByLabel('Incoming quality role').selectOption('Quality Manager');await page.getByRole('button',{name:'Approve lot release'}).click();await page.getByLabel('Incoming quality role').selectOption('Inventory Controller');await page.getByRole('button',{name:'Release incoming inventory'}).click();await expect(page.getByRole('status')).toContainText('Incoming inventory released');});

test('closes a verified supplier corrective action into rework',async({page})=>{await page.goto('/supplier-corrective-action');const role=page.getByLabel('Corrective-action role');await page.getByRole('button',{name:'Issue supplier action'}).click();await role.selectOption('Supplier Representative');await page.getByRole('button',{name:'Submit corrective response'}).click();await role.selectOption('Quality Manager');await page.getByRole('button',{name:'Verify corrective effectiveness'}).click();await role.selectOption('Procurement Manager');await page.getByRole('button',{name:'Close action for rework'}).click();await expect(page.getByRole('status')).toContainText('Corrective action closed for rework');await expect(page.getByText(/Quarantine 0 · rework 180/)).toBeVisible();});
test('releases a versioned process change after a passing first article',async({page})=>{await page.goto('/process-change');const role=page.getByLabel('Process-change role');await page.getByRole('button',{name:'Draft process change'}).click();await role.selectOption('Quality Engineer');await page.getByRole('button',{name:'Review process risk'}).click();await role.selectOption('Production Supervisor');await page.getByRole('button',{name:'Approve process trial'}).click();await page.getByRole('button',{name:'Stage process trial'}).click();await role.selectOption('Operator');await page.getByRole('button',{name:'Execute process trial'}).click();await role.selectOption('Quality Manager');await page.getByRole('button',{name:'Release process change'}).click();await expect(page.getByRole('status')).toContainText('Process change released');await expect(page.getByText(/Change released · 185°C · 45 bar/)).toBeVisible();await expect(page.getByText(/Machine ready · order released · samples 1/)).toBeVisible();});
