'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { captureStepData, signOffStep } from '@/lib/actions/step-data';
import type { DataFieldDefinition } from '@/lib/types/process-steps';
import { useRouter } from 'next/navigation';

interface StepDefinition {
  id: string;
  name: string;
  description: string | null;
  category: string;
  sequenceOrder: number;
  isMandatory: boolean;
  requiresSignoff: boolean;
  triggersQc: boolean;
  dataFields: unknown;
}

interface ExistingCapture {
  id: string;
  stepDefinitionId: string;
  capturedData: unknown;
  signedOff: boolean;
  signedOffAt: string | null;
  operatorName: string;
}

interface StepDataCapturePanelProps {
  executionId: string;
  stepDefinitions: StepDefinition[];
  existingCaptures: ExistingCapture[];
  disabled?: boolean;
}

export function StepDataCapturePanel({
  executionId,
  stepDefinitions,
  existingCaptures,
  disabled,
}: StepDataCapturePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, Record<string, unknown>>>(() => {
    // Initialize from existing captures
    const initial: Record<string, Record<string, unknown>> = {};
    for (const capture of existingCaptures) {
      initial[capture.stepDefinitionId] = capture.capturedData as Record<string, unknown>;
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, 'pass' | 'fail'>>({});

  if (stepDefinitions.length === 0) {
    return null;
  }

  const getFieldValue = (stepId: string, fieldId: string) => {
    return formData[stepId]?.[fieldId] ?? '';
  };

  const setFieldValue = (stepId: string, fieldId: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] ?? {}),
        [fieldId]: value,
      },
    }));
  };

  const getCaptureForStep = (stepId: string) => {
    return existingCaptures.find((c) => c.stepDefinitionId === stepId);
  };

  const getFieldStatus = (field: DataFieldDefinition, value: unknown): 'pass' | 'fail' | 'none' => {
    if (value === undefined || value === null || value === '') return 'none';
    if (field.type === 'number') {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(numValue)) return 'none';
      if (field.min !== undefined && numValue < field.min) return 'fail';
      if (field.max !== undefined && numValue > field.max) return 'fail';
      if (field.min !== undefined || field.max !== undefined) return 'pass';
    }
    return 'none';
  };

  const handleSaveStep = (stepId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const data = formData[stepId] ?? {};
        const result = await captureStepData(executionId, stepId, data);
        setLastResult((prev) => ({ ...prev, [stepId]: result.autoResult }));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save step data');
      }
    });
  };

  const handleSignOff = (stepId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await signOffStep(executionId, stepId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sign off step');
      }
    });
  };

  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
          Data Capture
        </span>
        <span className="text-xs text-slate-400 ml-auto">
          {existingCaptures.length}/{stepDefinitions.length} completed
        </span>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {stepDefinitions.map((step) => {
          const fields = (step.dataFields ?? []) as DataFieldDefinition[];
          const capture = getCaptureForStep(step.id);
          const isExpanded = expandedStepId === step.id;
          const isCaptured = !!capture;
          const isSignedOff = capture?.signedOff ?? false;
          const stepResult = lastResult[step.id];

          return (
            <div
              key={step.id}
              className={`border rounded-lg bg-white overflow-hidden ${
                isSignedOff
                  ? 'border-green-300'
                  : isCaptured
                    ? 'border-blue-300'
                    : 'border-slate-200'
              }`}
            >
              {/* Step header */}
              <button
                type="button"
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 ${
                  disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={() => {
                  if (!disabled) {
                    setExpandedStepId(isExpanded ? null : step.id);
                  }
                }}
                disabled={disabled}
              >
                {/* Status indicator */}
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  isSignedOff
                    ? 'bg-green-500'
                    : isCaptured
                      ? 'bg-blue-500'
                      : 'bg-slate-200'
                }`}>
                  {isSignedOff ? (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCaptured ? (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs text-slate-500 font-mono">{step.sequenceOrder}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {step.name}
                  </p>
                  {step.description && (
                    <p className="text-xs text-slate-400 truncate">{step.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {step.isMandatory && !isCaptured && (
                    <Badge variant="outline" className="text-xs border-red-300 text-red-600">
                      Required
                    </Badge>
                  )}
                  {step.requiresSignoff && !isSignedOff && isCaptured && (
                    <Badge variant="outline" className="text-xs border-purple-300 text-purple-600">
                      Needs Sign-off
                    </Badge>
                  )}
                  {stepResult && (
                    <Badge
                      className={`text-xs ${
                        stepResult === 'pass' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    >
                      {stepResult === 'pass' ? 'PASS' : 'FAIL'}
                    </Badge>
                  )}
                  {fields.length > 0 && (
                    <span className="text-xs text-slate-400">
                      {fields.length} field{fields.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded data capture form */}
              {isExpanded && fields.length > 0 && (
                <div className="border-t border-slate-200 p-3 space-y-3 bg-slate-50">
                  {fields.map((field) => {
                    const value = getFieldValue(step.id, field.id);
                    const status = getFieldStatus(field, value);

                    return (
                      <div key={field.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">
                            {field.name}
                            {field.required && <span className="text-red-500 ml-0.5">*</span>}
                          </Label>
                          {field.unit && (
                            <span className="text-xs text-slate-400">({field.unit})</span>
                          )}
                          {status !== 'none' && (
                            <Badge
                              className={`text-xs ml-auto ${
                                status === 'pass' ? 'bg-green-500' : 'bg-red-500'
                              }`}
                            >
                              {status === 'pass' ? 'IN SPEC' : 'OUT OF SPEC'}
                            </Badge>
                          )}
                        </div>

                        {field.description && (
                          <p className="text-xs text-slate-400">{field.description}</p>
                        )}

                        {field.type === 'number' && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="any"
                              value={value as string}
                              onChange={(e) => setFieldValue(step.id, field.id, e.target.value ? parseFloat(e.target.value) : '')}
                              className={`h-12 text-lg font-mono ${
                                status === 'fail'
                                  ? 'border-red-400 bg-red-50 text-red-700'
                                  : status === 'pass'
                                    ? 'border-green-400 bg-green-50 text-green-700'
                                    : ''
                              }`}
                              disabled={isSignedOff || disabled}
                            />
                            {(field.min !== undefined || field.max !== undefined) && (
                              <span className="text-xs text-slate-400 whitespace-nowrap">
                                {field.min !== undefined ? field.min : ''}
                                {field.min !== undefined && field.max !== undefined ? ' - ' : ''}
                                {field.max !== undefined ? field.max : ''}
                                {field.unit ? ` ${field.unit}` : ''}
                              </span>
                            )}
                          </div>
                        )}

                        {field.type === 'text' && (
                          <Input
                            value={value as string}
                            onChange={(e) => setFieldValue(step.id, field.id, e.target.value)}
                            className="h-12"
                            disabled={isSignedOff || disabled}
                          />
                        )}

                        {field.type === 'boolean' && (
                          <div className="flex items-center gap-3 h-12">
                            <Checkbox
                              id={`field-${step.id}-${field.id}`}
                              checked={value === true}
                              onCheckedChange={(checked) => setFieldValue(step.id, field.id, checked === true)}
                              className="h-6 w-6"
                              disabled={isSignedOff || disabled}
                            />
                            <Label
                              htmlFor={`field-${step.id}-${field.id}`}
                              className="text-sm font-normal"
                            >
                              Confirmed
                            </Label>
                          </div>
                        )}

                        {field.type === 'select' && (
                          <Select
                            value={value as string}
                            onValueChange={(v) => setFieldValue(step.id, field.id, v)}
                            disabled={isSignedOff || disabled}
                          >
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(field.options ?? []).map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      onClick={() => handleSaveStep(step.id)}
                      disabled={isPending || isSignedOff || disabled}
                      className="flex-1 h-12"
                    >
                      {isPending ? 'Saving...' : isCaptured ? 'Update Data' : 'Save Data'}
                    </Button>
                    {step.requiresSignoff && isCaptured && !isSignedOff && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleSignOff(step.id)}
                        disabled={isPending || disabled}
                        className="h-12 border-purple-300 text-purple-700 hover:bg-purple-50"
                      >
                        Sign Off
                      </Button>
                    )}
                  </div>

                  {isSignedOff && capture && (
                    <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg p-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Signed off by {capture.operatorName}
                      {capture.signedOffAt && ` at ${new Date(capture.signedOffAt).toLocaleTimeString()}`}
                    </div>
                  )}
                </div>
              )}

              {/* Show message for steps with no fields */}
              {isExpanded && fields.length === 0 && (
                <div className="border-t border-slate-200 p-3 bg-slate-50">
                  <p className="text-sm text-slate-500 text-center py-2">
                    No data fields configured for this step
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
