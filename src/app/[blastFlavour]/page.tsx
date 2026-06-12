"use client";

import React from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import type { Route } from "next";
import { Controller, useForm } from "react-hook-form";
import type {
  Control,
  FieldErrors,
  FieldPath,
  SubmitErrorHandler,
  SubmitHandler,
  UseFormRegister,
  UseFormWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { cn } from "@/lib/utils";
import { TaxonomySelect } from "./taxonomyselect";
import {
  ALLOWED_FLAVOURS,
  BLAST_DBS,
  DB_NAMES,
  PROGRAMS,
  BLASTFLAVOUR_FORMS,
  BLASTFLAVOUR_DEFAULTS,
  getFieldOptions,
} from "./parameters";
import type { BlastParameters, BlastFlavour, FieldOptions } from "./parameters";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type BlastControl = Control<BlastParameters, any, unknown>;
type BlastRegister = UseFormRegister<BlastParameters>;
type BlastWatch = UseFormWatch<BlastParameters>;

/** Compact field groups stack on mobile and pair two-per-row on wider screens. */
const FIELD_GRID = "grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2";

/** A shadcn Select wired to react-hook-form via Controller. */
function FormSelect({
  control,
  name,
  options,
  getLabel,
  disabled,
  className,
}: {
  control: BlastControl;
  name: FieldPath<BlastParameters>;
  options: readonly (string | number)[];
  getLabel?: (option: string | number) => string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          value={field.value != null ? String(field.value) : undefined}
          onValueChange={field.onChange}
          disabled={disabled}
        >
          <SelectTrigger className={className}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((option) => (
                <SelectItem key={String(option)} value={String(option)}>
                  {getLabel ? getLabel(option) : String(option)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
    />
  );
}

function EnterQuery({
  register,
  errors,
}: {
  register: BlastRegister;
  errors: FieldErrors<BlastParameters>;
}) {
  return (
    <FieldSet>
      <FieldLegend>Enter Query Sequence</FieldLegend>
      <FieldGroup className={FIELD_GRID}>
        <Field data-invalid={!!errors.query} className="sm:col-span-2">
          <FieldLabel htmlFor="query">
            Enter (single) FASTA sequence
          </FieldLabel>
          <Textarea
            id="query"
            placeholder="QUERY SEQUENCE"
            className="font-mono"
            rows={6}
            aria-invalid={!!errors.query}
            {...register("query")}
          />
          {errors.query && (
            <FieldError
              errors={[{ message: String(errors.query.message) }]}
            />
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="queryFrom">Query subrange (from)</FieldLabel>
          <Input
            id="queryFrom"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="FROM"
            aria-invalid={!!errors.queryFrom}
            {...register("queryFrom")}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="queryTo">Query subrange (to)</FieldLabel>
          <Input
            id="queryTo"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="TO"
            aria-invalid={!!errors.queryTo}
            {...register("queryTo")}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="jobTitle">Job Title</FieldLabel>
          <Input
            id="jobTitle"
            placeholder="JOBTITLE"
            disabled
            {...register("jobTitle")}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">E-mail address</FieldLabel>
          <Input
            id="email"
            placeholder="JOHN@DOE.COM"
            disabled
            {...register("email")}
          />
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

function ChooseSearchSet({
  control,
  blastFlavour,
}: {
  control: BlastControl;
  blastFlavour: BlastFlavour;
}) {
  const dbOptions = BLAST_DBS.get(blastFlavour) ?? [];
  return (
    <FieldSet>
      <FieldLegend>Choose Search Set</FieldLegend>
      <FieldGroup className={FIELD_GRID}>
        <Field>
          <FieldLabel>Database</FieldLabel>
          <FormSelect
            control={control}
            name="database"
            options={dbOptions}
            getLabel={(db) => `${DB_NAMES.get(String(db))} (${db})`}
            className="w-full"
          />
        </Field>

        <Field>
          <FieldLabel>Organism</FieldLabel>
          <TaxonomySelect control={control} />
          <FieldDescription>
            Select one or more taxonomy levels to limit or exclude
          </FieldDescription>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

function ProgramSelection({
  blastFlavour,
  watch,
}: {
  blastFlavour: BlastFlavour;
  watch: BlastWatch;
}) {
  if (blastFlavour !== "blastn") return null;
  const selectedProgram = watch("program");
  return (
    <FieldSet>
      <FieldLegend>Program Selection</FieldLegend>
      <Field>
        <FieldLabel>Optimize for</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          value={selectedProgram}
          disabled
          className="flex-wrap justify-start"
        >
          {PROGRAMS.get(blastFlavour)?.map((program) => (
            <ToggleGroupItem key={program} value={program}>
              {program}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
    </FieldSet>
  );
}

function SubmitButton({ watch }: { watch: BlastWatch }) {
  const db = watch("database");
  const program = watch("program");
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-input px-4 py-4 sm:flex-row sm:items-center">
      <Button type="submit" size="lg">
        BLAST
      </Button>
      <p className="text-sm text-muted-foreground">
        Search database <em className="font-medium text-foreground">{db}</em>{" "}
        using <em className="font-medium text-foreground">{program}</em>
      </p>
    </div>
  );
}

function DisabledCheckboxField({
  label,
  description,
  checked,
  className,
}: {
  label: string;
  description: string;
  checked: boolean;
  className?: string;
}) {
  return (
    <Label
      className={cn(
        "flex items-start gap-2 font-normal text-muted-foreground",
        className
      )}
    >
      <Checkbox checked={checked} disabled className="mt-0.5" />
      <span>
        <span className="block">{label}</span>
        <span className="block text-xs">{description}</span>
      </span>
    </Label>
  );
}

function AlgorithmParameters({
  control,
  register,
  watch,
  fieldOptions,
  blastFlavour,
}: {
  control: BlastControl;
  register: BlastRegister;
  watch: BlastWatch;
  fieldOptions: FieldOptions;
  blastFlavour: BlastFlavour;
}) {
  const isProteinScoring =
    blastFlavour === "blastp" || blastFlavour === "tblastn";
  const isNucleotideScoring = blastFlavour === "blastn";

  return (
    <FieldSet>
      <FieldLegend>Algorithm parameters</FieldLegend>
      <Accordion
        type="multiple"
        defaultValue={["general", "scoring", "filters"]}
      >
        <AccordionItem value="general">
          <AccordionTrigger>General parameters</AccordionTrigger>
          <AccordionContent>
            <FieldGroup className={FIELD_GRID}>
              <Field>
                <FieldLabel>Max target sequences</FieldLabel>
                <FormSelect
                  control={control}
                  name="maxTargetSeqs"
                  options={fieldOptions.maxTargetSeqs}
                  className="w-full"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="expectThreshold">
                  Expect threshold
                </FieldLabel>
                <Input
                  id="expectThreshold"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  {...register("expectThreshold")}
                />
                <FieldDescription>
                  Lower values return only the strongest matches (e.g. 1e-5).
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Word size</FieldLabel>
                <FormSelect
                  control={control}
                  name="wordSize"
                  options={fieldOptions.wordSize}
                  className="w-full"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="maxMatchesInQueryRange">
                  Max. matches in a query range
                </FieldLabel>
                <Input
                  id="maxMatchesInQueryRange"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  {...register("maxMatchesInQueryRange")}
                />
                <FieldDescription>0 means no limit.</FieldDescription>
              </Field>

              <DisabledCheckboxField
                label="Short queries"
                description="Automatically adjust parameters for short input sequences"
                checked={Boolean(watch("shortQueries"))}
                className="sm:col-span-2"
              />
            </FieldGroup>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="scoring">
          <AccordionTrigger>Scoring parameters</AccordionTrigger>
          <AccordionContent>
            <FieldGroup className={FIELD_GRID}>
              {isProteinScoring && (
                <Field>
                  <FieldLabel>Matrix</FieldLabel>
                  <FormSelect
                    control={control}
                    name="matrix"
                    options={fieldOptions.matrix}
                    className="w-full"
                  />
                </Field>
              )}
              {isNucleotideScoring && (
                <Field>
                  <FieldLabel>Match/Mismatch scores</FieldLabel>
                  <FormSelect
                    control={control}
                    name="matchMismatch"
                    options={fieldOptions.matchMismatch}
                    className="w-full"
                  />
                </Field>
              )}
              <Field>
                <FieldLabel>Gap costs</FieldLabel>
                <FormSelect
                  control={control}
                  name="gapCosts"
                  options={fieldOptions.gapCosts}
                  className="w-full"
                />
              </Field>
              {isProteinScoring && (
                <Field>
                  <FieldLabel>Compositional adjustment</FieldLabel>
                  <FormSelect
                    control={control}
                    name="compositionalAdjustment"
                    options={fieldOptions.compositionalAdjustment}
                    disabled
                    className="w-full"
                  />
                </Field>
              )}
            </FieldGroup>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="filters">
          <AccordionTrigger>Filters and masking</AccordionTrigger>
          <AccordionContent>
            <FieldGroup>
              <DisabledCheckboxField
                label="Filter"
                description="Low complexity regions"
                checked={Boolean(watch("filterLowComplexity"))}
              />
              <DisabledCheckboxField
                label="Mask"
                description="Mask for lookup table only"
                checked={false}
              />
              <DisabledCheckboxField
                label="Mask lower case letters"
                description="Mask lower case letters"
                checked={Boolean(watch("lcaseMasking"))}
              />
            </FieldGroup>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </FieldSet>
  );
}

export default function BlastFlavourPage() {
  const { blastFlavour } = useParams<{ blastFlavour: BlastFlavour }>();
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  if (ALLOWED_FLAVOURS.indexOf(blastFlavour) < 0) {
    notFound();
  }

  const blastForm = BLASTFLAVOUR_FORMS.get(blastFlavour)!;
  const fieldOptions = getFieldOptions(blastFlavour);
  const defaults = BLASTFLAVOUR_DEFAULTS[blastFlavour];

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
  } = useForm<BlastParameters>({
    //@ts-ignore - per-flavour schema resolves to a member of the union
    resolver: zodResolver(blastForm),
    //@ts-ignore
    defaultValues: defaults,
    //@ts-ignore
    values: defaults,
  });

  const onSubmit: SubmitHandler<any> = (formData: BlastParameters) => {
    fetch(`${basePath}/api/submit`, {
      body: JSON.stringify(formData),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    })
      .then((res) => res.json())
      .then((data) => {
        const { jobId }: { jobId: string } = data;
        router.push(`results/${jobId}` as Route);
      });
  };
  const onError: SubmitErrorHandler<any> = (errors) => console.log(errors);

  return (
    <section className="container mx-auto px-4 py-8">
      <form
        onSubmit={handleSubmit(onSubmit, onError)}
        className="mx-auto w-full max-w-2xl"
      >
        <h1 className="mb-6 text-3xl font-bold capitalize tracking-tight">
          {blastFlavour}
        </h1>
        <div className="flex flex-col gap-6">
          <EnterQuery register={register} errors={errors} />
          <ChooseSearchSet control={control} blastFlavour={blastFlavour} />
          <ProgramSelection blastFlavour={blastFlavour} watch={watch} />
          <SubmitButton watch={watch} />
          <AlgorithmParameters
            control={control}
            register={register}
            watch={watch}
            fieldOptions={fieldOptions}
            blastFlavour={blastFlavour}
          />
        </div>
      </form>
    </section>
  );
}
