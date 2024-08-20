"use client";

import React, { useContext } from "react";
import { notFound } from "next/navigation";
import { useForm } from "react-hook-form";
import type { FieldErrors, Control, UseFormRegister } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";

import { TaxonomySelect } from "./taxonomyselect";
import "./blastFlavour.scss";
import type { BlastFlavour } from "./blastflavour";
//@ts-ignore
import { ALLOWED_FLAVOURS } from "./blastflavour.d.ts";
import { ThemeContext } from "../themecontext";
import type { Theme } from "../themecontext";

const NUCLEOTIDE_DBS = new Map<string, string>([
  ["nt", "Nucleotide collection"],
  ["refseq_select_rna", "RefSeq Select RNA sequences"],
  ["refseq_rna", "Reference RNA sequences"],
  ["Representative_Genomes", "RefSeq representative genomes"],
  ["16S_ribosomal_RNA", "16S Ribosomal RNA"],
]);
const PROTEIN_DBS = new Map<string, string>([
  ["refseq_protein", "Reference proteins"],
  ["nr", "Non-redundant protein sequences"],
  ["landmark", "Model organisms"],
  ["refseq_select_prot", "RefSeq Select proteins"],
  ["swissprot", "UniProtKB/Swiss-Prot"],
]);

const DB_NAMES = new Map<string, string>([...PROTEIN_DBS, ...NUCLEOTIDE_DBS]);

const BLAST_DBS = new Map<BlastFlavour, string[]>([
  ["blastp", Array.from(PROTEIN_DBS.keys())],
  ["blastx", Array.from(PROTEIN_DBS.keys())],
  ["blastn", Array.from(NUCLEOTIDE_DBS.keys())],
  ["tblastx", Array.from(NUCLEOTIDE_DBS.keys())],
  ["tblastn", Array.from(NUCLEOTIDE_DBS.keys())],
]);

const PROGRAMS = new Map<BlastFlavour, string[]>([
  //[
  //'blastp', [
  //  'Quick BLASTP (Accelerated protein-protein BLAST)',
  //  'blastp (protein-protein BLAST)'
  //]],
  [
    "blastn",
    [
      "Megablast (Highly similar sequences)",
      "Discontiguous megablast (More dissimilar sequences)",
      "Blastn (Somewhat similar sequences)",
    ],
  ],
]);

function numberTransform(_unused: any, val: string) {
  return val !== "" ? Number(val) : null;
}

const baseForm = Yup.object().shape({
  jobTitle: Yup.string().notRequired(),
  email: Yup.string().notRequired(),
  query: Yup.string()
    .required("Query is required")
    .max(10e4)
    .trim()
    .test(
      "is-not-multifasta",
      "Query contains multiple FASTA sequences",
      (value) => (value.match(/>/g) || []).length < 2
    )
    .test(
      "is-not-short",
      "Query is shorter than 25 characters",
      (value) => value.length >= 25
    )
    .test(
      "is-not-long",
      "Query is longer than 10,000 characters",
      (value) => value.length <= 10_000
    ),
  queryFrom: Yup.number()
    .notRequired()
    .moreThan(0, "Query FROM cannot be negative")
    .transform(numberTransform),
  queryTo: Yup.number()
    .notRequired()
    .moreThan(0, "Query TO cannot be negative")
    .transform(numberTransform),
  maxTargetSeqs: Yup.number()
    .required("Must specify maximum number of target sequences")
    .oneOf([10, 50, 100, 250, 500, 1000, 5000])
    .required()
    .default(100)
    .transform(numberTransform),
  expectThreshold: Yup.number()
    .required("Must specify an expect threshold")
    .moreThan(0, "Expect threshold cannot be negative")
    .default(0.05)
    .required()
    .transform(numberTransform),
  maxMatchesInQueryRange: Yup.number()
    .notRequired()
    .moreThan(-1, "Max. matches in query range cannot be negative")
    .default(0)
    .required()
    .transform(numberTransform),
  taxids: Yup.array().of(Yup.string()).default([]).required(),
  excludeTaxids: Yup.boolean().default(false).required(),
  softMasking: Yup.boolean().default(false).required(),
  lcaseMasking: Yup.boolean().default(false).required(),
  filterLowComplexity: Yup.boolean().default(false).required(),
  shortQueries: Yup.boolean().default(true).required(),
  compositionalAdjustment: Yup.string()
    .oneOf([
      "No adjustment",
      "Compositon-based statistics",
      "Conditional compositional score matrix adjustment",
      "Universal compositional score matrix adjustment",
    ])
    .default("Conditional compositional score matrix adjustment")
    .notRequired(),
});

const blastpForm = Yup.object()
  .concat(baseForm)
  .shape({
    flavour: Yup.string().oneOf(["blastp"]).default("blastp").required(),
    database: Yup.string()
      .oneOf(BLAST_DBS.get("blastp")!)
      .default(BLAST_DBS.get("blastp")![0])
      .required(),
    matrix: Yup.string()
      .oneOf([
        "PAM30",
        "PAM70",
        "PAM250",
        "BLOSUM45",
        "BLOSUM50",
        "BLOSUM62",
        "BLOSUM80",
        "BLOSUM90",
      ])
      .default("BLOSUM62")
      .required(),
    wordSize: Yup.number()
      .oneOf([3, 5, 6])
      .default(5)
      .required()
      .transform(numberTransform),
    program: Yup.string().oneOf(["blastp"]).default("blastp").required(),
    gapCosts: Yup.string()
      .oneOf([
        "11,2",
        "10,2",
        "9,2",
        "8,2",
        "7,2",
        "6,2",
        "13,1",
        "12,1",
        "11,1",
        "10,1",
        "9,1",
      ])
      .default("11,1")
      .required(),
  });
interface BlastpParameters extends Yup.InferType<typeof blastpForm> {}

const blastnForm = Yup.object()
  .concat(baseForm)
  .shape({
    flavour: Yup.string().oneOf(["blastn"]).default("blastn").required(),
    database: Yup.string()
      .oneOf(BLAST_DBS.get("blastn")!)
      .default(BLAST_DBS.get("blastn")![0])
      .required(),
    wordSize: Yup.number()
      .oneOf([16, 20, 24, 28, 32, 48, 64, 128, 256])
      .default(28)
      .defined(),
    matchMismatch: Yup.string()
      .oneOf(["1,-2", "1,-3", "1,-4", "2,-3", "4,-5", "1,-1"])
      .default("1,-2")
      .defined(),
    gapCosts: Yup.string()
      .oneOf(["linear", "5,2", "2,2", "1,2", "0,2", "3,1", "2,1", "1,1"])
      .default("linear")
      .required(),
  });
interface BlastnParameters extends Yup.InferType<typeof blastnForm> {}

const blastxForm = Yup.object()
  .concat(blastpForm)
  .shape({
    flavour: Yup.string().oneOf(["blastx"]).default("blastx").required(),
  });

interface BlastxParameters extends Yup.InferType<typeof blastxForm> {}

const tblastnForm = Yup.object()
  .concat(blastpForm)
  .shape({
    flavour: Yup.string().oneOf(["tblastn"]).default("tblastn").required(),
  });
interface TblastnParameters extends Yup.InferType<typeof tblastnForm> {}

const tblastxForm = Yup.object().concat(baseForm);

interface TblastxParameters extends Yup.InferType<typeof tblastxForm> {}

export type BlastParameters =
  | BlastpParameters
  | BlastnParameters
  | BlastxParameters
  | TblastnParameters
  | TblastxParameters;

type BlastForm =
  | typeof blastpForm
  | typeof tblastnForm
  | typeof blastnForm
  | typeof blastxForm
  | typeof tblastxForm;

const BLASTFLAVOUR_FORMS = new Map<BlastFlavour, BlastForm>([
  ["blastp", blastpForm],
  ["blastn", blastnForm],
  ["blastx", blastxForm],
  ["tblastn", tblastnForm],
  ["tblastx", tblastxForm],
]);

function EnterQuery({
  register,
  errors,
  //  formDescription,
  theme,
}: {
  register: UseFormRegister<BlastParameters>;
  errors: FieldErrors;
  formDescription: Yup.SchemaObjectDescription;
  theme: Theme;
}) {
  return (
    <fieldset
      className={`box ${theme === "dark" ? "has-background-grey-dark" : ""}`}
    >
      <legend className="label has-text-centered">Enter Query Sequence</legend>
      <div className="field">
        <div className="field-body">
          <div className="field">
            <label className="label">Enter (single) FASTA sequence</label>
            <div className="control">
              <textarea
                className={`textarea is-small ${
                  errors.query?.message ? "is-danger" : ""
                } ${
                  theme === "dark"
                    ? "dark has-background-grey is-dark has-text-light"
                    : ""
                }`}
                placeholder="QUERY SEQUENCE"
                style={{ fontFamily: "monospace" }}
                {...register("query")}
              />
            </div>
            {errors.query && (
              <p className="help is-danger">{String(errors.query?.message)}</p>
            )}
          </div>

          <div className="field">
            <label className="label">Query subrange</label>
            <div className="field is-horizontal">
              <div className="field-label is-small">
                <label className="label">From</label>
              </div>
              <div className="field-body">
                <div className="field">
                  <div className="control">
                    <input
                      className={`input is-small ${
                        errors.queryFrom?.message ? "is-danger" : ""
                      } ${
                        theme === "dark"
                          ? "dark has-background-grey is-dark has-text-light"
                          : ""
                      }`}
                      placeholder="FROM"
                      style={{ maxWidth: 120 }}
                      {...register("queryFrom")}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className="field is-horizontal"
              style={{ paddingTop: ".75em" }}
            >
              <div className="field-label is-small">
                <label className="label">To</label>
              </div>
              <div className="field-body">
                <div className="field">
                  <div className="control">
                    <input
                      className={`input is-small ${
                        errors.queryTo?.message ? "is-danger" : ""
                      } ${
                        theme === "dark"
                          ? "dark has-background-grey is-dark has-text-light"
                          : ""
                      }`}
                      placeholder="TO"
                      type="text"
                      style={{ maxWidth: 120 }}
                      {...register("queryTo")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="field is-horizontal">
        <div className="field-label is-small">
          <label className="label">Job Title</label>
        </div>
        <div className="field-body">
          <div className="field">
            <div className="control">
              <input
                className={`input is-small ${
                  errors.jobtitle?.message ? "is-danger" : ""
                } ${
                  theme === "dark"
                    ? "dark has-background-grey is-dark has-text-light"
                    : ""
                }`}
                type="text"
                placeholder="JOBTITLE"
                style={{ maxWidth: 240 }}
                disabled
                {...register("jobTitle")}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="field is-horizontal">
        <div className="field-label is-small">
          <label className="label">E-mail address</label>
        </div>
        <div className="field-body">
          <div className="field">
            <div className="control">
              <input
                className={`input is-small ${
                  errors.email?.message ? "is-danger" : ""
                } ${
                  theme === "dark"
                    ? "dark has-background-grey is-dark has-text-light"
                    : ""
                }`}
                type="text"
                placeholder="JOHN@DOE.COM"
                style={{ maxWidth: 240 }}
                disabled
                {...register("email")}
              />
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  );
}

function ChooseSearchSet({
  register,
  errors,
  blastFlavour,
  control,
  //  formDescription,
  theme,
}: {
  register: UseFormRegister<BlastParameters>;
  errors: FieldErrors;
  blastFlavour: BlastFlavour;
  control: Control<BlastParameters>;
  formDescription: Yup.SchemaObjectDescription;
  theme: Theme;
}) {
  const dbOptions = BLAST_DBS.get(blastFlavour);
  return (
    <fieldset
      className={`box ${theme === "dark" ? "has-background-grey-dark" : ""}`}
    >
      <legend className="label has-text-centered">Choose Search Set</legend>

      <div className="field is-horizontal">
        <div className="field-label is-small">
          <label className="label">Database</label>
        </div>
        <div className="field-body">
          <div className="field">
            <div className="control">
              <div
                className={`select is-small ${
                  errors.database?.message ? "is-danger" : ""
                } ${theme === "dark" ? "is-dark" : ""}`}
              >
                <select
                  {...register("database")}
                  style={{ minWidth: 290 }}
                  className={`${
                    theme === "dark"
                      ? "dark has-background-grey is-dark has-text-light"
                      : ""
                  }`}
                >
                  {dbOptions &&
                    dbOptions.map((db) => (
                      <option key={db} value={db}>
                        {`${DB_NAMES.get(db)} (${db})`}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="field is-horizontal">
        <div className="field-label is-small">
          <label className="label">Organism</label>
        </div>
        <div className="field-body">
          <div className="field">
            <div className="control">
              <TaxonomySelect
                control={control}
                register={register}
                theme={theme}
              />
            </div>
            <p className="help">
              Select one or more taxonomy levels to limit or exclude
            </p>
          </div>
        </div>
      </div>
    </fieldset>
  );
}

function ProgramSelection({
  blastFlavour,
  register,
  //  errors,
  //  getValues,
  //  formDescription,
  theme,
}: {
  blastFlavour: BlastFlavour;
  register: UseFormRegister<BlastParameters>;
  errors: FieldErrors;
  getValues: Function;
  formDescription: Yup.SchemaObjectDescription;
  theme: Theme;
}) {
  if (!PROGRAMS.has(blastFlavour)) return null;
  const selectedProgram = "Blastn (Somewhat similar sequences)"; //getValues('program');
  return (
    <fieldset
      className={`box ${theme === "dark" ? "has-background-grey-dark" : ""}`}
    >
      <legend className="label has-text-centered">Program Selection</legend>
      <div className="field is-horizontal">
        <div className="field-label is-small">
          <label className="label">Optimize for</label>
        </div>
        <div className="field-body">
          <div className="field">
            <div className="control">
              {PROGRAMS.get(blastFlavour)?.map((program: string) => (
                <React.Fragment key={program}>
                  <label className="radio is-small">
                    <input
                      type="radio"
                      checked={program === selectedProgram}
                      {...register("program")}
                    />
                    &nbsp;
                    {program}
                  </label>
                  <br />
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  );
}

function SubmitButton({
  //  register,
  //  errors,
  getValues,
  watch,
  //  formDescription,
  theme,
}: {
  register: UseFormRegister<BlastParameters>;
  errors: FieldErrors;
  getValues: Function;
  watch: Function;
  formDescription: Yup.SchemaObjectDescription;
  theme: Theme;
}) {
  const db = watch("database");
  const program = getValues("program");
  return (
    <div
      className={`box ${
        theme === "dark" ? "has-background-grey has-text-light " : ""
      }`}
    >
      <div className="columns is-vcentered">
        <div className="column is-2">
          <div className="field">
            <div className="control">
              <button type="submit" className="button is-info is-pulled-right">
                BLAST
              </button>
            </div>
          </div>
        </div>
        <div className="column">
          <p>
            Search database{" "}
            <em>
              <u>{db}</u>
            </em>{" "}
            using{" "}
            <em>
              <u>{program}</u>
            </em>
          </p>
        </div>
      </div>
    </div>
  );
}

function AlgorithmParameters({
  register,
  //  errors,
  //  getValues,
  formDescription,
  blastFlavour,
  theme,
}: {
  register: UseFormRegister<BlastParameters>;
  errors: FieldErrors;
  getValues: Function;
  formDescription: Yup.SchemaObjectDescription;
  blastFlavour: BlastFlavour;
  theme: Theme;
}) {
  const { fields } = formDescription;

  return (
    <div className="panel is-info">
      <p className="panel-heading">Algorithm parameters</p>
      <div className="panel-block algorithm-parameters">
        <fieldset
          className={`box ${
            theme === "dark" ? "has-background-grey-dark" : ""
          }`}
        >
          <legend className="label has-text-centered">
            General Parameters
          </legend>

          <div className="field is-horizontal">
            <div className="field-label is-small">
              <label className="label">Max target sequences</label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  <div className="select is-small">
                    <select
                      className={
                        theme === "dark"
                          ? "has-background-grey has-text-light"
                          : ""
                      }
                      style={{ width: 80 }}
                      {...register("maxTargetSeqs")}
                    >
                      {
                        //@ts-ignore
                        fields.maxTargetSeqs.oneOf.map((n_targets) => (
                          <option key={n_targets}>{n_targets}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="field is-horizontal">
            <div className="field-label is-small">
              <label className="label">Short queries</label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  <label className="checkbox">
                    <input type="checkbox" {...register("shortQueries")} />
                    Automatically adjust parameters for short input sequences
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="field is-horizontal">
            <div className="field-label is-small">
              <label
                className={`label ${theme === "dark" ? "has-text-light" : ""}`}
              >
                Expect threshold
              </label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  <input
                    className={`input is-small ${
                      theme === "dark"
                        ? "has-background-grey is-dark has-text-light"
                        : ""
                    }`}
                    type="text"
                    style={{ width: 80 }}
                    {...register("expectThreshold")}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="field is-horizontal">
            <div className="field-label is-small">
              <label
                className={`label ${theme === "dark" ? "has-text-light" : ""}`}
              >
                Word size
              </label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  <div
                    className={`select is-small ${
                      theme === "dark" ? "is-dark" : ""
                    }`}
                  >
                    <select
                      {...register("wordSize")}
                      style={{ width: 80 }}
                      className={
                        theme === "dark"
                          ? "has-background-grey has-text-light"
                          : ""
                      }
                    >
                      {
                        //@ts-ignore
                        fields.wordSize.oneOf.map((wordSize) => (
                          <option key={wordSize}>{wordSize}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="field is-horizontal">
            <div className="field-label is-small">
              <label
                className={`label ${theme === "dark" ? "has-text-light" : ""}`}
              >
                Max. matches in a query range
              </label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  <input
                    className={`input is-small ${
                      theme === "dark"
                        ? "has-background-grey is-dark has-text-light"
                        : ""
                    }`}
                    type="text"
                    style={{ width: 80 }}
                    {...register("maxMatchesInQueryRange")}
                    defaultValue={0}
                  />
                </div>
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset
          className={`box ${
            theme === "dark" ? "has-background-grey-dark" : ""
          }`}
        >
          <legend
            className={`label has-text-centered ${
              theme === "dark" ? "has-text-light" : ""
            }`}
          >
            Scoring Parameters
          </legend>

          {["blastp", "tblastn"].indexOf(blastFlavour) >= 0 && (
            <div className="field is-horizontal">
              <div className="field-label is-small">
                <label
                  className={`label ${
                    theme === "dark" ? "has-text-light" : ""
                  }`}
                >
                  Matrix
                </label>
              </div>
              <div className="field-body">
                <div className="field">
                  <div className="control">
                    <div
                      className={`select is-small ${
                        theme === "dark" ? "is-dark" : ""
                      }`}
                    >
                      <select
                        className={
                          theme === "dark"
                            ? "has-background-grey has-text-light"
                            : ""
                        }
                        style={{ width: 140 }}
                        {...register("matrix")}
                      >
                        {
                          //@ts-ignore
                          fields.matrix.oneOf.map((wordSize) => (
                            <option key={wordSize}>{wordSize}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {["blastn"].indexOf(blastFlavour) >= 0 && (
            <div className="field is-horizontal">
              <div className="field-label is-small">
                <label
                  className={`label ${
                    theme === "dark" ? "has-text-light" : ""
                  }`}
                >
                  Match/Mismatch Scores
                </label>
              </div>
              <div className="field-body">
                <div className="field">
                  <div className="control">
                    <div
                      className={`select is-small ${
                        theme === "dark" ? "is-dark" : ""
                      }`}
                    >
                      <select
                        className={
                          theme === "dark"
                            ? "has-background-grey has-text-light"
                            : ""
                        }
                        style={{ width: 140 }}
                        {...register("matchMismatch")}
                      >
                        {
                          //@ts-ignore
                          fields.matchMismatch.oneOf.map((match) => (
                            <option key={match}>{match}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="field is-horizontal">
            <div className="field-label is-small">
              <label
                className={`label ${theme === "dark" ? "has-text-light" : ""}`}
              >
                Gap costs
              </label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  <div
                    className={`select is-small ${
                      theme === "dark" ? "is-dark" : ""
                    }`}
                  >
                    <select
                      className={
                        theme === "dark"
                          ? "has-background-grey has-text-light"
                          : ""
                      }
                      style={{ width: 140 }}
                      {...register("gapCosts")}
                    >
                      {
                        //@ts-ignore
                        fields["gapCosts"].oneOf.map((gapCost) => {
                          //const [gapOpen, gapExtend] = gapCost.split(",");
                          return <option key={gapCost}>{gapCost}</option>;
                        })
                      }
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {["blastp", "tblastn"].indexOf(blastFlavour) >= 0 && (
            <div className="field is-horizontal">
              <div className="field-label is-small">
                <label
                  className={`label ${
                    theme === "dark" ? "has-text-light" : ""
                  }`}
                >
                  Compositional adjustment
                </label>
              </div>
              <div className="field-body">
                <div className="field">
                  <div className="control">
                    <div
                      className={`select is-small ${
                        theme === "dark" ? "is-dark" : ""
                      }`}
                    >
                      <select
                        className={
                          theme === "dark"
                            ? "has-background-grey has-text-light"
                            : ""
                        }
                        {...register("compositionalAdjustment")}
                      >
                        {
                          //@ts-ignore
                          fields["compositionalAdjustment"].oneOf.map(
                            (adjustment: String) => (
                              <option key={adjustment as React.Key}>
                                {adjustment}
                              </option>
                            )
                          )
                        }
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </fieldset>

        <fieldset
          className={`box ${
            theme === "dark" ? "has-background-grey-dark" : ""
          }`}
        >
          <legend
            className={`label has-text-centered ${
              theme === "dark" ? "has-text-light" : ""
            }`}
          >
            Filters and masking
          </legend>

          <div className="field is-horizontal">
            <div className="field-label is-small">
              <label
                className={`label ${theme === "dark" ? "has-text-light" : ""}`}
              >
                Filter
              </label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      {...register("filterLowComplexity")}
                    />
                    Low complexity regions
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="field is-horizontal">
            <div className="field-label is-small">
              <label
                className={`label ${theme === "dark" ? "has-text-light" : ""}`}
              >
                Mask
              </label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  <label className="checkbox">
                    <input type="checkbox" />
                    Mask for lookup table only
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="field is-horizontal">
            <div className="field-label is-small">
              <label className="label" />
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  <label className="checkbox">
                    <input type="checkbox" {...register("lcaseMasking")} />
                    Mask lower case letters
                  </label>
                </div>
              </div>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
}

export default function BlastFlavourPage({
  params,
}: {
  params: { blastFlavour: BlastFlavour };
}) {
  const { theme } = useContext(ThemeContext);
  const { blastFlavour } = params;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (ALLOWED_FLAVOURS.indexOf(blastFlavour) < 0) {
    notFound();
  }
  // const defaultProgram = (PROGRAMS.get(blastFlavour) || [blastFlavour])[0];

  const blastForm = BLASTFLAVOUR_FORMS.get(blastFlavour)!;

  const formDescription = blastForm.describe();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
    control,
    watch,
  } = useForm<BlastParameters>({
    //@ts-ignore
    resolver: yupResolver(blastForm),
    //@ts-ignore
    defaultValues: blastForm.default(),
    //@ts-ignore
    values: blastForm.default(),
  });

  console.log({ errors });

  async function onSubmit(formData: BlastParameters) {
    console.log({ formData });
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
        const { jobId } = data;
        window.location.replace(`${basePath}/results/${jobId}`); // HACK
      });
  }

  return (
    <section
      className={`section ${
        theme === "dark" ? "has-background-dark has-text-light" : ""
      }`}
    >
      <div className="container is-fullhd">
        <form onSubmit={handleSubmit(onSubmit)}>
          <h1 className={`title ${theme === "dark" ? "has-text-light" : ""}`}>
            {blastFlavour}
          </h1>
          <EnterQuery
            register={register}
            errors={errors}
            formDescription={formDescription}
            theme={theme}
          />
          <ChooseSearchSet
            register={register}
            errors={errors}
            blastFlavour={blastFlavour}
            control={control}
            formDescription={formDescription}
            theme={theme}
          />
          <ProgramSelection
            register={register}
            errors={errors}
            getValues={getValues}
            blastFlavour={blastFlavour}
            formDescription={formDescription}
            theme={theme}
          />
          <SubmitButton
            register={register}
            errors={errors}
            getValues={getValues}
            watch={watch}
            formDescription={formDescription}
            theme={theme}
          />
          <AlgorithmParameters
            register={register}
            errors={errors}
            getValues={getValues}
            formDescription={formDescription}
            blastFlavour={blastFlavour}
            theme={theme}
          />
        </form>
      </div>
    </section>
  );
}
