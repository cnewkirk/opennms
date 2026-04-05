import React, { useState } from 'react'
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
  const [spec, setSpec] = useState<OpenNMSQuerySpec>(value)

  const update = (patch: Partial<OpenNMSQuerySpec>) => {
    const updated = { ...spec, ...patch }
    setSpec(updated)
    onChange(updated)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1 }}>
      <TextField
        label="Resource ID"
        size="small"
        value={spec.resourceId ?? ''}
        onChange={e => update({ resourceId: e.target.value })}
        helperText="e.g. node[1].interfaceSnmp[eth0-000000000000]"
        fullWidth
      />
      <TextField
        label="Attribute"
        size="small"
        value={spec.attribute ?? ''}
        onChange={e => update({ attribute: e.target.value })}
        helperText="e.g. ifInOctets"
        fullWidth
      />
      <TextField
        select
        label="Aggregation"
        size="small"
        value={spec.aggregation ?? 'AVERAGE'}
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
        value={spec.label ?? ''}
        onChange={e => update({ label: e.target.value || undefined })}
        fullWidth
      />
    </Box>
  )
}
