'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { updateProcessStepDefinition } from '@/lib/actions/admin/process-steps';
import { ProcessStepEditDialog } from './ProcessStepEditDialog';
import { normalizeDataFields, type DataFieldDefinition } from '@/lib/types/process-steps';

type StepDefinition = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  stationId: string | null;
  sequenceOrder: number;
  isMandatory: boolean;
  requiresSignoff: boolean;
  triggersQc: boolean;
  cycleTimeTarget: number | null;
  dataFields: unknown;
  active: boolean;
  station: { id: string; name: string; stationType: string } | null;
  _count: { dataCaptures: number };
};

type Station = {
  id: string;
  name: string;
  stationType: string;
  site: { name: string };
};

interface ProcessStepTableProps {
  definitions: StepDefinition[];
  stations: Station[];
}

export function ProcessStepTable({ definitions, stations }: ProcessStepTableProps) {
  const [isPending, startTransition] = useTransition();
  const [editingStep, setEditingStep] = useState<StepDefinition | null>(null);

  const handleToggleActive = (def: StepDefinition) => {
    startTransition(async () => {
      await updateProcessStepDefinition(def.id, { active: !def.active });
    });
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Station</TableHead>
            <TableHead>Data Fields</TableHead>
            <TableHead>Options</TableHead>
            <TableHead>Uses</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {definitions.map((def) => {
            const fields = normalizeDataFields(def.dataFields);
            return (
              <TableRow key={def.id} className={!def.active ? 'opacity-50' : ''}>
                <TableCell className="font-mono text-xs text-slate-400">
                  {def.sequenceOrder}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-slate-900">{def.name}</p>
                    {def.description && (
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">
                        {def.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {def.station ? (
                    <span className="text-sm text-slate-700">{def.station.name}</span>
                  ) : (
                    <span className="text-xs text-slate-400">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {fields.length === 0 ? (
                      <span className="text-xs text-slate-400">None</span>
                    ) : (
                      fields.slice(0, 3).map((f) => (
                        <Badge key={f.id} variant="secondary" className="text-xs">
                          {f.name}
                          {f.unit ? ` (${f.unit})` : ''}
                        </Badge>
                      ))
                    )}
                    {fields.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{fields.length - 3} more
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {def.isMandatory && (
                      <Badge variant="default" className="text-xs bg-blue-600">
                        Required
                      </Badge>
                    )}
                    {def.requiresSignoff && (
                      <Badge variant="default" className="text-xs bg-purple-600">
                        Sign-off
                      </Badge>
                    )}
                    {def.triggersQc && (
                      <Badge variant="default" className="text-xs bg-amber-600">
                        QC
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-slate-500">{def._count.dataCaptures}</span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingStep(def)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant={def.active ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => handleToggleActive(def)}
                      disabled={isPending}
                    >
                      {def.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {editingStep && (
        <ProcessStepEditDialog
          step={editingStep}
          stations={stations}
          open={!!editingStep}
          onOpenChange={(open) => {
            if (!open) setEditingStep(null);
          }}
        />
      )}
    </>
  );
}
