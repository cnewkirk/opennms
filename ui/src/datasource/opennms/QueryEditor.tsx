import React from 'react'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import type { OpenNMSQuerySpec } from './types'

interface QueryEditorProps {
  value: OpenNMSQuerySpec
  onChange: (spec: OpenNMSQuerySpec) => void
}

const AGGREGATIONS = ['AVERAGE', 'MIN', 'MAX', 'LAST'] as const

export const QueryEditor: React.FC<QueryEditorProps> = ({ value, onChange }) => {
  const update = (patch: Partial<OpenNMSQuerySpec>) => {
    onChange({ ...value, ...patch })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1 }}>
      <TextField
        label="Resource ID"
        size="small"
        value={value.resourceId ?? ''}
        onChange={e => update({ resourceId: e.target.value })}
        helperText="e.g. node[1].interfaceSnmp[eth0-000000000000]"
        fullWidth
      />
      <TextField
        label="Attribute"
        size="small"
        value={value.attribute ?? ''}
        onChange={e => update({ attribute: e.target.value })}
        helperText="e.g. ifInOctets"
        fullWidth
      />
      <TextField
        select
        label="Aggregation"
        size="small"
        value={value.aggregation ?? 'AVERAGE'}
        onChange={e => update({ aggregation: e.target.value as OpenNMSQuerySpec['aggregation'] })}
        fullWidth
      >
        {AGGREGATIONS.map(agg => (
          <MenuItem key={agg} value={agg}>{agg}</MenuItem>
        ))}
      </TextField>
      <TextField
        label="Label (optional)"
        size="small"
        value={value.label ?? ''}
        onChange={e => update({ label: e.target.value || undefined })}
        fullWidth
      />
    </Box>
  )
}
