import{expect,test}from'@playwright/test';test('ForgeAxis exposes routed enterprise workflows',async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'ForgeAxis command center'})).toBeVisible();await page.getByRole('link',{name:'Operations'}).click();const review=page.getByRole('region',{name:'Machine readiness review'});await review.getByRole('button',{name:'Evaluate release'}).click();await expect(review).toContainText(/ready|blocked/);await page.getByRole('link',{name:'Workflows'}).click();await expect(page.getByRole('heading',{name:'Workflow catalog'})).toBeVisible();await page.getByRole('link',{name:'Data model'}).click();await expect(page.getByRole('heading',{name:'Connected data model'})).toBeVisible();await page.getByRole('link',{name:'Data tools'}).click();await expect(page.getByRole('heading',{name:'Import and recovery tools'})).toBeVisible();await page.getByRole('textbox',{name:'Workspace JSON'}).fill('{}');await page.getByRole('button',{name:'Preview import'}).click();await expect(page.getByRole('alert')).toContainText('not a compatible');await page.getByRole('link',{name:'Activity',exact:true}).click();await expect(page.getByRole('heading',{name:'Operational activity'})).toBeVisible()})

test('factory shell supports keyboard bypass and narrow operational navigation',async({page})=>{await page.setViewportSize({width:640,height:800});await page.goto('/');const skip=page.getByRole('link',{name:'Skip to main content'});await skip.focus();await expect(skip).toBeFocused();await skip.press('Enter');await expect(page.locator('#main-content')).toBeFocused();await page.getByRole('link',{name:'Rework control'}).click();await expect(page.getByRole('heading',{name:'Rework control'})).toBeVisible();await expect(page.getByRole('navigation',{name:'Product navigation'})).toBeVisible();});

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

test('downtime recovery preserves evidence through rejection and corrected repair',async({page})=>{await page.goto('/maintenance-control');const role=page.getByLabel('Maintenance role');await page.getByRole('button',{name:'Report machine downtime'}).click();await role.selectOption('Supervisor');await page.getByRole('button',{name:'Assign independent repair'}).click();await role.selectOption('Operator');const evidence=page.getByLabel('Repair completion evidence');await evidence.fill('Replaced primary seal and completed three stable pressure cycles.');await page.getByRole('button',{name:'Complete assigned repair'}).click();await role.selectOption('Quality Engineer');await page.getByRole('button',{name:'Reject repair verification'}).click();await expect(page.getByRole('status')).toContainText('returned to the assigned operator');await role.selectOption('Operator');await evidence.fill('Replaced secondary seal and completed six stable pressure cycles.');await page.getByRole('button',{name:'Refresh maintenance state'}).click();await expect(evidence).toHaveValue('Replaced secondary seal and completed six stable pressure cycles.');await page.getByRole('button',{name:'Complete assigned repair'}).click();await role.selectOption('Quality Engineer');await page.getByRole('button',{name:'Verify and resume production'}).click();await page.getByText(/Maintenance history/).click();await expect(page.getByRole('region',{name:'Maintenance control history'})).toContainText('repair-rejected');await page.reload();await expect(page.getByRole('heading',{name:'Machine 1 recovery'}).locator('..')).toContainText('verified · machine ready · order running')});

test('passing sample and verified genealogy produce a durable batch release',async({page})=>{await page.goto('/batch-release');const role=page.getByLabel('Batch role');await page.getByRole('button',{name:'Record passing sample'}).click();await role.selectOption('Supervisor');await page.getByRole('button',{name:'Issue batch release'}).click();await page.reload();await expect(page.getByRole('heading',{name:'Batch 1'}).locator('..')).toContainText('released · 1 samples · genealogy verified');await expect(page.getByRole('region',{name:'Batch release history'})).toContainText('batch-released')});
test('gauge drift holds production until calibration is independently verified',async({page})=>{await page.goto('/calibration-control');const role=page.getByRole('combobox',{name:'Calibration role'});await page.getByRole('button',{name:'Report gauge drift'}).click();await role.selectOption('Supervisor');await page.getByRole('button',{name:'Assign calibration'}).click();await role.selectOption('Maintenance');await page.getByRole('button',{name:'Complete calibration'}).click();await role.selectOption('Quality Engineer');await page.getByRole('button',{name:'Verify calibration'}).click();await role.selectOption('Supervisor');await page.getByRole('button',{name:'Release held order'}).click();await page.reload();await expect(page.getByText('verified · order running · case closed')).toBeVisible();await expect(page.getByRole('list',{name:'Calibration history'})).toContainText('order-released-after-calibration')});
test('verified genealogy releases production into shipment custody',async({page})=>{await page.goto('/release-dossier');const role=page.getByRole('combobox',{name:'Release role'});await page.getByRole('button',{name:'Open release dossier'}).click();await role.selectOption('Operator');await page.getByRole('button',{name:'Record material genealogy'}).click();await role.selectOption('Quality Engineer');await page.getByRole('button',{name:'Verify release quality'}).click();await role.selectOption('Production Supervisor');await page.getByRole('button',{name:'Authorize production release'}).click();await role.selectOption('Shipping');await page.getByRole('button',{name:'Dispatch released batch'}).click();await expect(page.getByRole('status')).toContainText('dispatched');await page.reload();await expect(page.getByText(/dispatched · 120 of 120 units/)).toBeVisible();await expect(page.getByText(/Shipment dispatched · 120 units/)).toBeVisible();await expect(page.getByRole('region',{name:'Release dossier history'})).toContainText('released-batch-dispatched')});
test('deviation review preserves rejected disposition input before dependent updates',async({page})=>{await page.goto('/deviation-control');const role=page.getByRole('combobox',{name:'Deviation role'});await page.getByRole('button',{name:'Report production deviation'}).click();await role.selectOption('Process Engineer');await page.getByRole('button',{name:'Assess production deviation'}).click();await role.selectOption('Quality Lead');await page.getByRole('button',{name:'Approve deviation disposition'}).click();await role.selectOption('Production Supervisor');const scrap=page.getByLabel('Disposition scrap quantity');await scrap.fill('11');await page.getByRole('button',{name:'Execute deviation disposition'}).click();await expect(page.getByRole('alert')).toContainText('exceeds affected');await page.getByRole('button',{name:'Refresh deviation record'}).click();await expect(scrap).toHaveValue('11');await scrap.fill('2');await page.getByRole('button',{name:'Execute deviation disposition'}).click();await role.selectOption('Quality Lead');await page.getByRole('button',{name:'Verify production release'}).click();await page.getByText(/Deviation history/).click();await expect(page.getByRole('list',{name:'Deviation history'})).toContainText('deviation-release-verified');await page.reload();await expect(page.getByText(/running · completed 78 · scrap 2 · deviation verified/)).toBeVisible();await expect(page.getByText(/Machine released · material consumed 78/)).toBeVisible()});

test('executes a constrained production schedule',async({page})=>{await page.goto('/production-scheduling');await page.getByRole('button',{name:'Draft production schedule'}).click();await page.getByLabel('Scheduling role').selectOption('Material Controller');await page.getByRole('button',{name:'Allocate inputs'}).click();await page.getByLabel('Scheduling role').selectOption('Production Manager');await page.getByRole('button',{name:'Release schedule'}).click();await page.getByLabel('Scheduling role').selectOption('Operator');await page.getByRole('button',{name:'Start work order'}).click();await page.getByRole('button',{name:'Complete work order'}).click();await expect(page.getByRole('status')).toContainText('Work order completed');});

test('releases independently approved incoming material',async({page})=>{await page.goto('/incoming-quality');await page.getByRole('button',{name:'Open incoming inspection'}).click();await page.getByLabel('Incoming quality role').selectOption('Quality Technician');await page.getByRole('button',{name:'Record strength sample'}).click();await page.getByRole('button',{name:'Evaluate sample'}).click();await page.getByLabel('Incoming quality role').selectOption('Quality Manager');await page.getByRole('button',{name:'Approve lot release'}).click();await page.getByLabel('Incoming quality role').selectOption('Inventory Controller');await page.getByRole('button',{name:'Release incoming inventory'}).click();await expect(page.getByRole('status')).toContainText('Incoming inventory released');});

test('closes a verified supplier corrective action into rework',async({page})=>{await page.goto('/supplier-corrective-action');const role=page.getByLabel('Corrective-action role');await page.getByRole('button',{name:'Issue supplier action'}).click();await role.selectOption('Supplier Representative');await page.getByRole('button',{name:'Submit corrective response'}).click();await role.selectOption('Quality Manager');await page.getByRole('button',{name:'Verify corrective effectiveness'}).click();await role.selectOption('Procurement Manager');await page.getByRole('button',{name:'Close action for rework'}).click();await expect(page.getByRole('status')).toContainText('Corrective action closed for rework');await expect(page.getByText(/Quarantine 0 · rework 180/)).toBeVisible();});
test('releases a versioned process change after a passing first article',async({page})=>{await page.goto('/process-change');const role=page.getByLabel('Process-change role');await page.getByRole('button',{name:'Draft process change'}).click();await role.selectOption('Quality Engineer');await page.getByRole('button',{name:'Review process risk'}).click();await role.selectOption('Production Supervisor');await page.getByRole('button',{name:'Approve process trial'}).click();await page.getByRole('button',{name:'Stage process trial'}).click();await role.selectOption('Operator');await page.getByRole('button',{name:'Execute process trial'}).click();await role.selectOption('Quality Manager');await page.getByRole('button',{name:'Release process change'}).click();await expect(page.getByRole('status')).toContainText('Process change released');await expect(page.getByText(/Change released · 185°C · 45 bar/)).toBeVisible();await expect(page.getByText(/Machine ready · order released · samples 1/)).toBeVisible();});
test('issues certified material and reconciles the unused production return',async({page})=>{await page.goto('/material-control');const role=page.getByLabel('Material role');await page.getByRole('button',{name:'Reserve production material'}).click();await role.selectOption('Warehouse Clerk');await page.getByRole('button',{name:'Pick reserved material'}).click();await role.selectOption('Quality Inspector');await page.getByRole('button',{name:'Inspect picked material'}).click();await role.selectOption('Warehouse Clerk');await page.getByRole('button',{name:'Issue material to line'}).click();await role.selectOption('Operator');await page.getByRole('button',{name:'Consume production material'}).click();await role.selectOption('Inventory Controller');await page.getByRole('button',{name:'Reconcile material return'}).click();await page.reload();await expect(page.getByText(/WO-441 · reconciled/)).toBeVisible();await expect(page.getByText(/Order complete · consumed 75\/80kg/)).toBeVisible();await expect(page.getByText(/Lot available · available 25kg · movements 2 · genealogy 1/)).toBeVisible();});
test('repairs and independently releases worn production tooling',async({page})=>{await page.goto('/tooling-control');const role=page.getByLabel('Tooling role');await page.getByRole('button',{name:'Report tool wear'}).click();await role.selectOption('Maintenance Planner');await page.getByRole('button',{name:'Approve tool maintenance'}).click();await role.selectOption('Production Supervisor');await page.getByRole('button',{name:'Isolate production tool'}).click();await role.selectOption('Toolmaker');await page.getByRole('button',{name:'Repair production tool'}).click();await role.selectOption('Metrology Inspector');await page.getByRole('button',{name:'Calibrate production tool'}).click();await role.selectOption('Quality Manager');await page.getByRole('button',{name:'Release production tool'}).click();await expect(page.getByRole('status')).toContainText('line restored');await page.reload();await expect(page.getByText(/DIE-204 · released/)).toBeVisible();await expect(page.getByText(/LINE-4 · available · installed DIE-204/)).toBeVisible();await expect(page.getByText(/Replacement insert · consumed · quantity 0/)).toBeVisible();await expect(page.getByRole('region',{name:'Tooling evidence'})).toContainText('Evidence records: 4');});
test('clears prior material and independently releases the next production order',async({page})=>{await page.goto('/line-clearance');const role=page.getByLabel('Line clearance role');await page.getByRole('button',{name:'Open line clearance'}).click();await role.selectOption('Material Controller');await page.getByRole('button',{name:'Return residual material'}).click();await role.selectOption('Sanitation Technician');await page.getByRole('button',{name:'Sanitize production line'}).click();await role.selectOption('Quality Inspector');await page.getByRole('button',{name:'Inspect line clearance'}).click();await role.selectOption('Production Manager');await page.getByRole('button',{name:'Release next production order'}).click();await role.selectOption('Operator');await page.getByRole('button',{name:'Start cleared production'}).click();await expect(page.getByRole('status')).toContainText('production started');await page.reload();await expect(page.getByText(/LINE-9 · started/)).toBeVisible();await expect(page.getByText(/Line running · active order WO-901/)).toBeVisible();await expect(page.getByText(/Prior WO-900 · closed · residual 0kg/)).toBeVisible();await expect(page.getByText(/Next WO-901 · running · LOT-BLUE-901/)).toBeVisible();});
test('preserves priority selection and releases two held orders under one disposition',async({page})=>{await page.goto('/rework-control');const reworkRole=page.getByLabel('Rework role');await page.getByLabel('Rework filter').selectOption('eligible');await page.getByLabel('Select LOT-RW-51').check();await page.getByLabel('Select LOT-RW-52').check();await reworkRole.selectOption('Process Engineer');await page.getByRole('button',{name:'Refresh rework routing'}).click();await reworkRole.selectOption('Rework Planner');await page.getByRole('button',{name:'Create rework traveler'}).click();await reworkRole.selectOption('Quality Engineer');await page.getByRole('button',{name:'Approve rework traveler'}).click();await reworkRole.selectOption('Production Supervisor');await page.getByRole('button',{name:'Reserve rework resources'}).click();await reworkRole.selectOption('Operator');await page.getByRole('button',{name:'Execute rework traveler'}).click();await reworkRole.selectOption('Quality Inspector');await page.getByRole('button',{name:'Inspect reworked lots'}).click();await reworkRole.selectOption('Inventory Controller');await page.getByRole('button',{name:'Release reworked lots'}).click();await page.goto('/quality-release-queue');await page.getByLabel('Quality order filter').selectOption('priority');await page.getByLabel('Select WO-710').check();await page.getByLabel('Select WO-711').check();await page.getByLabel('Quality queue role').selectOption('Inspection Analyst');await page.getByRole('button',{name:'Refresh inspection results'}).click();await expect(page.getByLabel('Select WO-710')).toBeChecked();await page.getByLabel('Quality queue role').selectOption('Quality Planner');await page.getByRole('button',{name:'Create shared disposition'}).click();await page.getByLabel('Quality queue role').selectOption('Quality Manager');await page.getByRole('button',{name:'Approve shared disposition'}).click();await page.getByLabel('Quality queue role').selectOption('Production Controller');await page.getByRole('button',{name:'Release disposition orders'}).click();await expect(page.getByRole('status')).toContainText('released atomically');await page.reload();await expect(page.getByText(/DISPOSITION-71 · released/)).toBeVisible();await expect(page.getByText(/Quarantine 25 · available 100/)).toBeVisible();await expect(page.getByText('Immutable evidence 3')).toBeVisible();});
test('contains affected lots and notifies every traced recall customer',async({page})=>{await page.goto('/lot-recall');await page.getByLabel('Recall lot filter').selectOption('affected');await page.getByLabel('Select LOT-VX-31').check();await page.getByLabel('Select LOT-VX-32').check();await page.getByLabel('Recall role').selectOption('Traceability Analyst');await page.getByRole('button',{name:'Refresh shipment trace'}).click();await expect(page.getByLabel('Select LOT-VX-31')).toBeChecked();await page.getByLabel('Recall role').selectOption('Quality Engineer');await page.getByRole('button',{name:'Create multi-lot recall'}).click();await page.getByLabel('Recall role').selectOption('Quality Director');await page.getByRole('button',{name:'Approve lot recall'}).click();await page.getByLabel('Recall role').selectOption('Inventory Controller');await page.getByRole('button',{name:'Contain recalled lots'}).click();await page.getByLabel('Recall role').selectOption('Customer Safety Officer');await page.getByRole('button',{name:'Notify recall customers'}).click();await page.getByRole('button',{name:'Record recall acknowledgements'}).click();await page.getByLabel('Recall role').selectOption('Quality Director');await page.getByRole('button',{name:'Close lot recall'}).click();await page.getByRole('button',{name:'Assign recall recovery'}).click();await expect(page.getByLabel('Recall recovery coverage')).toContainText('Customer recovery team');await page.getByLabel('Recall role').selectOption('Inventory Controller');await page.getByRole('button',{name:'Reconcile recalled returns'}).click();await page.getByLabel('Recall role').selectOption('Customer Safety Officer');await page.getByRole('button',{name:'Confirm recall effectiveness'}).click();await page.getByLabel('Recall role').selectOption('Quality Director');await page.getByRole('button',{name:'Complete final recall disposition'}).click();await expect(page.getByRole('status')).toContainText('disposition completed');await page.reload();await expect(page.getByText(/RECALL-SEAL-B88 · finally-closed/)).toBeVisible();await expect(page.getByText(/Available 70 · quarantine 0/)).toBeVisible();await expect(page.getByText(/Stopped work orders 2 · customer notices 2/)).toBeVisible();await expect(page.getByText(/Immutable evidence 9/)).toBeVisible();});
test('reworks two compatible held lots and releases only conforming units',async({page})=>{await page.goto('/rework-control');await page.getByLabel('Rework filter').selectOption('eligible');await page.getByLabel('Select LOT-RW-51').check();await page.getByLabel('Select LOT-RW-52').check();await page.getByLabel('Rework role').selectOption('Process Engineer');await page.getByRole('button',{name:'Refresh rework routing'}).click();await expect(page.getByLabel('Select LOT-RW-51')).toBeChecked();await page.getByLabel('Rework role').selectOption('Rework Planner');await page.getByRole('button',{name:'Create rework traveler'}).click();await page.getByLabel('Rework role').selectOption('Quality Engineer');await page.getByRole('button',{name:'Approve rework traveler'}).click();await page.getByLabel('Rework role').selectOption('Production Supervisor');await page.getByRole('button',{name:'Reserve rework resources'}).click();await page.getByLabel('Rework role').selectOption('Operator');await page.getByRole('button',{name:'Execute rework traveler'}).click();await page.getByLabel('Rework role').selectOption('Quality Inspector');await page.getByRole('button',{name:'Inspect reworked lots'}).click();await page.getByLabel('Rework role').selectOption('Inventory Controller');await page.getByRole('button',{name:'Release reworked lots'}).click();await expect(page.getByRole('status')).toContainText('released to inventory');await page.reload();await expect(page.getByText(/TRAVELER-B88-15 · released/)).toBeVisible();await expect(page.getByText(/Available 96 · quarantine 10 · scrap 5/)).toBeVisible();await expect(page.getByText(/Repair material 5 available · 7 consumed · immutable evidence 10/)).toBeVisible();});

test('ForgeAxis second-pass workflows expose indexed execution and recall detail',async({page})=>{await page.setViewportSize({width:820,height:900});await page.goto('/factory-execution');await expect(page.getByRole('navigation',{name:'Factory workstreams'})).toBeVisible();await expect(page.locator('#material-control-card')).toBeVisible();const executionHistory=page.getByRole('region',{name:'Factory execution history'}).locator('details');await expect(executionHistory).not.toHaveAttribute('open','');await executionHistory.locator('summary').click();await expect(executionHistory).toHaveAttribute('open','');await page.goto('/lot-recall');await expect(page.getByRole('region',{name:'Recall lot results'})).toBeVisible();await expect(page.getByRole('complementary',{name:'Lot recall'})).toBeVisible();await expect(page.getByRole('list',{name:'Lot recall stages'})).toBeVisible();const disclosure=page.getByRole('region',{name:'Recall history'}).locator('details');await disclosure.locator('summary').click();await expect(disclosure).toHaveAttribute('open','');});

test('holds a short material return until quality authorizes controlled loss',async({page})=>{await page.goto('/material-control');const role=page.getByLabel('Material role');await page.getByRole('button',{name:'Reserve production material'}).click();await role.selectOption('Warehouse Clerk');await page.getByRole('button',{name:'Pick reserved material'}).click();await role.selectOption('Quality Inspector');await page.getByRole('button',{name:'Inspect picked material'}).click();await role.selectOption('Warehouse Clerk');await page.getByRole('button',{name:'Issue material to line'}).click();await role.selectOption('Operator');await page.getByRole('button',{name:'Consume production material'}).click();await role.selectOption('Inventory Controller');await page.getByRole('button',{name:'Report return shortfall'}).click();await expect(page.getByText(/WO-441 · return-held/)).toBeVisible();await role.selectOption('Quality Inspector');await page.getByRole('button',{name:'Authorize controlled loss'}).click();await role.selectOption('Inventory Controller');await page.getByRole('button',{name:'Reconcile material return'}).click();await expect(page.getByText(/Lot available · available 23kg · movements 3 · genealogy 1/)).toBeVisible();await page.reload();await expect(page.getByText('controlled-material-loss-authorized')).toBeVisible();});

test('cancels reserved rework and restores resources before a safe resume',async({page})=>{await page.goto('/rework-control');const role=page.getByLabel('Rework role');await page.getByLabel('Rework filter').selectOption('eligible');await page.getByLabel('Select LOT-RW-51').check();await page.getByLabel('Select LOT-RW-52').check();await role.selectOption('Process Engineer');await page.getByRole('button',{name:'Refresh rework routing'}).click();await role.selectOption('Rework Planner');await page.getByRole('button',{name:'Create rework traveler'}).click();await role.selectOption('Quality Engineer');await page.getByRole('button',{name:'Approve rework traveler'}).click();await role.selectOption('Production Supervisor');await page.getByRole('button',{name:'Reserve rework resources'}).click();await page.getByRole('button',{name:'Cancel reserved rework'}).click();await expect(page.getByText(/Repair material 12 available/)).toBeVisible();await role.selectOption('Rework Planner');await page.getByRole('button',{name:'Resume cancelled rework'}).click();await page.reload();await expect(page.getByRole('region',{name:'Rework traveler'})).toContainText('approved');await expect(page.getByRole('region',{name:'Rework history'})).toContainText('reserved-rework-cancelled');});


test('shows concurrent recall recovery priority',async({page})=>{await page.goto('/lot-recall');const workload=page.getByRole('region',{name:'Recall workload'});await expect(workload).toContainText('RECALL-SEAL-B88 · critical');await expect(workload).toContainText('45 units outstanding');});


test('quality director reassigns a critical recall with persisted review custody',async({page})=>{await page.goto('/lot-recall');await page.getByLabel('Recall portfolio authority').selectOption('Quality Director');await page.getByRole('button',{name:'Reassign critical recall'}).click();await expect(page.getByRole('status')).toContainText('effectiveness review scheduled');await expect(page.getByRole('region',{name:'Recall workload'})).toContainText('Senior recall cell');await page.reload();await expect(page.getByRole('list',{name:'Recall assignment history'})).toContainText('population 45');});

test('quality director closes a recall after durable acknowledgements and population reconciliation',async({page})=>{await page.goto('/lot-recall');await page.getByLabel('Recall portfolio authority').selectOption('Quality Director');await page.getByRole('button',{name:'Reassign critical recall'}).click();await page.getByRole('button',{name:'Record customer acknowledgements'}).click();await expect(page.getByRole('list',{name:'Recall notification history'})).toContainText('CUSTOMER-2 · acknowledged');await page.getByRole('button',{name:'Confirm final recall effectiveness'}).click();await expect(page.getByRole('status')).toContainText('population and disposition');await page.reload();await expect(page.getByRole('list',{name:'Recall closure history'})).toContainText('repaired 30 · scrapped 15');});
test('filters recall recovery by operational acknowledgement state',async({page})=>{await page.goto('/lot-recall');await page.getByLabel('Recovery timeline').selectOption('outstanding');await expect(page.getByRole('list',{name:'Filtered recall recovery'})).toContainText('RECALL-SEAL-B88 · 2 acknowledgements outstanding');await page.getByLabel('Recovery timeline').selectOption('failed');await expect(page.getByRole('list',{name:'Filtered recall recovery'})).toBeEmpty();});
