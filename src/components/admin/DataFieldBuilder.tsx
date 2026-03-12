'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DATA_FIELD_TYPES,
  type DataFieldDefinition,
  type DataFieldType,
} from '@/lib/types/process-steps';
import { v4 as uuidv4 } from 'uuid';

interface DataFieldBuilderProps {
  fields: DataFieldDefinition[];
  onChange: (fields: DataFieldDefinition[]) => void;
}

const emptyField = (): DataFieldDefinition => ({
  id: uuidv4(),
  name: '',
  type: 'number',
  required: true,
});

export function DataFieldBuilder({ fields, onChange }: DataFieldBuilderProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const addField = () => {
    const newFields = [...fields, emptyField()];
    onChange(newFields);
    setExpandedIndex(newFields.length - 1);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const updateField = (index: number, updates: Partial<DataFieldDefinition>) => {
    const newFields = fields.map((f, i) =>
      i === index ? { ...f, ...updates } : f
    );
    onChange(newFields);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const newFields = [...fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    onChange(newFields);
    setExpandedIndex(newIndex);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Data Capture Fields</Label>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Field
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
          <p className="text-sm text-slate-500">No data fields configured</p>
          <p className="text-xs text-slate-400 mt-1">
            Add fields to capture measurements, parameters, and confirmations
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="border border-slate-200 rounded-lg bg-white"
            >
              {/* Field header (always visible) */}
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50"
                onClick={() =>
                  setExpandedIndex(expandedIndex === index ? null : index)
                }
              >
                <span className="text-xs text-slate-400 font-mono w-5">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-slate-700">
                  {field.name || '(unnamed field)'}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {DATA_FIELD_TYPES.find((t) => t.value === field.type)?.label ?? field.type}
                </Badge>
                {field.required && (
                  <Badge variant="default" className="text-xs bg-red-500">
                    Req
                  </Badge>
                )}
                {field.unit && (
                  <span className="text-xs text-slate-400">{field.unit}</span>
                )}
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    onClick={(e) => { e.stopPropagation(); moveField(index, 'up'); }}
                    disabled={index === 0}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    onClick={(e) => { e.stopPropagation(); moveField(index, 'down'); }}
                    disabled={index === fields.length - 1}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="p-1 text-red-400 hover:text-red-600"
                    onClick={(e) => { e.stopPropagation(); removeField(index); }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Field details (expanded) */}
              {expandedIndex === index && (
                <div className="border-t border-slate-200 p-3 space-y-3 bg-slate-50">
                  {/* Name & Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Field Name</Label>
                      <Input
                        value={field.name}
                        onChange={(e) => updateField(index, { name: e.target.value })}
                        placeholder="e.g., Press Force"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(v) =>
                          updateField(index, {
                            type: v as DataFieldType,
                            // Reset type-specific fields
                            min: undefined,
                            max: undefined,
                            unit: undefined,
                            options: undefined,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATA_FIELD_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label} - {t.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Type-specific fields */}
                  {field.type === 'number' && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Min Value</Label>
                        <Input
                          type="number"
                          step="any"
                          value={field.min ?? ''}
                          onChange={(e) =>
                            updateField(index, {
                              min: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          placeholder="Lower limit"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max Value</Label>
                        <Input
                          type="number"
                          step="any"
                          value={field.max ?? ''}
                          onChange={(e) =>
                            updateField(index, {
                              max: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          placeholder="Upper limit"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit</Label>
                        <Input
                          value={field.unit ?? ''}
                          onChange={(e) =>
                            updateField(index, { unit: e.target.value || undefined })
                          }
                          placeholder="e.g., N, mm"
                        />
                      </div>
                    </div>
                  )}

                  {field.type === 'select' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Options (comma-separated)</Label>
                      <Input
                        value={(field.options ?? []).join(', ')}
                        onChange={(e) =>
                          updateField(index, {
                            options: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter((s) => s),
                          })
                        }
                        placeholder="Option A, Option B, Option C"
                      />
                    </div>
                  )}

                  {/* Description & Required */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Help Text</Label>
                      <Input
                        value={field.description ?? ''}
                        onChange={(e) =>
                          updateField(index, {
                            description: e.target.value || undefined,
                          })
                        }
                        placeholder="Instructions for operator"
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`required-${field.id}`}
                          checked={field.required}
                          onCheckedChange={(checked) =>
                            updateField(index, { required: checked === true })
                          }
                        />
                        <Label htmlFor={`required-${field.id}`} className="font-normal text-sm">
                          Required field
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
