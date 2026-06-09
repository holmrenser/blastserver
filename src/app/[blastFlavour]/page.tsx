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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
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
    <Card>
      <CardHeader>
        <CardTitle>Enter Query Sequence</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field data-invalid={!!errors.query}>
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

          <Field orientation="responsive">
            <FieldLabel htmlFor="queryFrom">Query subrange (from)</FieldLabel>
            <Input
              id="queryFrom"
              placeholder="FROM"
              className="max-w-32"
              aria-invalid={!!errors.queryFrom}
              {...register("queryFrom")}
            />
          </Field>

          <Field orientation="responsive">
            <FieldLabel htmlFor="queryTo">Query subrange (to)</FieldLabel>
            <Input
              id="queryTo"
              placeholder="TO"
              className="max-w-32"
              aria-invalid={!!errors.queryTo}
              {...register("queryTo")}
            />
          </Field>

          <Field orientation="responsive">
            <FieldLabel htmlFor="jobTitle">Job Title</FieldLabel>
            <Input
              id="jobTitle"
              placeholder="JOBTITLE"
              className="max-w-60"
              disabled
              {...register("jobTitle")}
            />
          </Field>

          <Field orientation="responsive">
            <FieldLabel htmlFor="email">E-mail address</FieldLabel>
            <Input
              id="email"
              placeholder="JOHN@DOE.COM"
              className="max-w-60"
              disabled
              {...register("email")}
            />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>Choose Search Set</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="responsive">
            <FieldLabel>Database</FieldLabel>
            <FormSelect
              control={control}
              name="database"
              options={dbOptions}
              getLabel={(db) => `${DB_NAMES.get(String(db))} (${db})`}
              className="w-full max-w-[320px]"
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
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>Program Selection</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

function SubmitButton({ watch }: { watch: BlastWatch }) {
  const db = watch("database");
  const program = watch("program");
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Button type="submit" size="lg">
          BLAST
        </Button>
        <p className="text-sm text-muted-foreground">
          Search database <em className="font-medium text-foreground">{db}</em>{" "}
          using <em className="font-medium text-foreground">{program}</em>
        </p>
      </CardContent>
    </Card>
  );
}

function DisabledCheckboxField({
  label,
  description,
  checked,
}: {
  label: string;
  description: string;
  checked: boolean;
}) {
  return (
    <Label className="flex items-start gap-2 font-normal text-muted-foreground">
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
    <Card>
      <CardHeader>
        <CardTitle>Algorithm parameters</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion
          type="multiple"
          defaultValue={["general", "scoring", "filters"]}
        >
          <AccordionItem value="general">
            <AccordionTrigger>General parameters</AccordionTrigger>
            <AccordionContent>
              <FieldGroup>
                <Field orientation="responsive">
                  <FieldLabel>Max target sequences</FieldLabel>
                  <FormSelect
                    control={control}
                    name="maxTargetSeqs"
                    options={fieldOptions.maxTargetSeqs}
                    className="w-24"
                  />
                </Field>

                <Field orientation="responsive">
                  <FieldLabel>Short queries</FieldLabel>
                  <DisabledCheckboxField
                    label="Short queries"
                    description="Automatically adjust parameters for short input sequences"
                    checked={Boolean(watch("shortQueries"))}
                  />
                </Field>

                <Field orientation="responsive">
                  <FieldLabel htmlFor="expectThreshold">
                    Expect threshold
                  </FieldLabel>
                  <Input
                    id="expectThreshold"
                    className="max-w-24"
                    {...register("expectThreshold")}
                  />
                </Field>

                <Field orientation="responsive">
                  <FieldLabel>Word size</FieldLabel>
                  <FormSelect
                    control={control}
                    name="wordSize"
                    options={fieldOptions.wordSize}
                    className="w-24"
                  />
                </Field>

                <Field orientation="responsive">
                  <FieldLabel htmlFor="maxMatchesInQueryRange">
                    Max. matches in a query range
                  </FieldLabel>
                  <Input
                    id="maxMatchesInQueryRange"
                    className="max-w-24"
                    {...register("maxMatchesInQueryRange")}
                  />
                </Field>
              </FieldGroup>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="scoring">
            <AccordionTrigger>Scoring parameters</AccordionTrigger>
            <AccordionContent>
              <FieldGroup>
                {isProteinScoring && (
                  <Field orientation="responsive">
                    <FieldLabel>Matrix</FieldLabel>
                    <FormSelect
                      control={control}
                      name="matrix"
                      options={fieldOptions.matrix}
                      className="w-40"
                    />
                  </Field>
                )}
                {isNucleotideScoring && (
                  <Field orientation="responsive">
                    <FieldLabel>Match/Mismatch scores</FieldLabel>
                    <FormSelect
                      control={control}
                      name="matchMismatch"
                      options={fieldOptions.matchMismatch}
                      className="w-40"
                    />
                  </Field>
                )}
                <Field orientation="responsive">
                  <FieldLabel>Gap costs</FieldLabel>
                  <FormSelect
                    control={control}
                    name="gapCosts"
                    options={fieldOptions.gapCosts}
                    className="w-40"
                  />
                </Field>
                {isProteinScoring && (
                  <Field orientation="responsive">
                    <FieldLabel>Compositional adjustment</FieldLabel>
                    <FormSelect
                      control={control}
                      name="compositionalAdjustment"
                      options={fieldOptions.compositionalAdjustment}
                      disabled
                      className="w-full max-w-[360px]"
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
      </CardContent>
    </Card>
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
      <form onSubmit={handleSubmit(onSubmit, onError)}>
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
