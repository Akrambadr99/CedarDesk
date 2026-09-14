import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable } from './DataTable';
const columns = [{ key: 'lot', label: 'Production lot', render: (row: { id: string }) => row.id }] as const;
describe('DataTable', () => {
  it('labels its scroll region and cells for responsive presentation', () => { render(<DataTable caption="Released lots" columns={columns} rows={[{ id: 'LOT-42' }]} rowKey={(row) => row.id} />); expect(screen.getByRole('region', { name: 'Released lots' })).toBeInTheDocument(); expect(screen.getByRole('cell', { name: 'LOT-42' })).toHaveAttribute('data-label', 'Production lot'); });
  it('explains an empty production view', () => { render(<DataTable caption="Released lots" columns={columns} rows={[]} rowKey={(row) => row.id} />); expect(screen.getByText('No production records match the current view.')).toBeVisible(); });
});
