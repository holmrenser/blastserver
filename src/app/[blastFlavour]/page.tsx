"use client";

import React, { useContext } from "react";
import { notFound } from "next/navigation";
import { useForm } from "react-hook-form";
import type { FieldErrors, Control, UseFormRegister } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";

import { TaxonomySelect } from "./taxonomyselect";
import {
  ALLOWED_FLAVOURS,
  BLAST_DBS,
  DB_NAMES,
  PROGRAMS,
  BLASTFLAVOUR_FORMS,
} from "./parameters";
import type { BlastParameters, BlastFlavour } from "./parameters";
import { ThemeContext } from "../themecontext";
import type { Theme } from "../themecontext";

import "./blastFlavour.scss";

function EnterQuery({
  register,
  errors,
  theme,
}: {
  register: UseFormRegister<BlastParameters>;
  errors: FieldErrors;
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
  theme,
}: {
  register: UseFormRegister<BlastParameters>;
  errors: FieldErrors;
  blastFlavour: BlastFlavour;
  control: Control<BlastParameters>;
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
                  style={{ minWidth: 290, maxWidth: 290 }}
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
  setValue,
  watch,
  theme,
}: {
  blastFlavour: BlastFlavour;
  register: UseFormRegister<BlastParameters>;
  setValue: Function;
  watch: Function;
  theme: Theme;
}) {
  if (blastFlavour !== "blastn") return null;
  const selectedProgram = watch("program");
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
              {PROGRAMS.get(blastFlavour)?.map((program: string) => {
                // console.log({ program, selectedProgram });
                return (
                  <React.Fragment key={program}>
                    <label className="radio is-small">
                      <input
                        disabled
                        type="radio"
                        checked={program === selectedProgram}
                        value={program}
                        {...register("program", {
                          onChange: ({ target: { value } }) => {
                            // console.log({ value });
                            setValue("program", value);
                          },
                        })}
                      />
                      &nbsp;
                      {program}
                    </label>
                    <br />
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  );
}

function SubmitButton({
  getValues,
  watch,
  theme,
}: {
  getValues: Function;
  watch: Function;
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
  formDescription,
  blastFlavour,
  theme,
}: {
  register: UseFormRegister<BlastParameters>;
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
                        disabled
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
                      disabled
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
                    <input type="checkbox" disabled />
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
                    <input
                      type="checkbox"
                      disabled
                      {...register("lcaseMasking")}
                    />
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

  const blastForm = BLASTFLAVOUR_FORMS.get(blastFlavour)!;

  const formDescription = blastForm.describe();

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
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

  async function onSubmit(formData: BlastParameters) {
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
          <EnterQuery register={register} errors={errors} theme={theme} />
          <ChooseSearchSet
            register={register}
            errors={errors}
            blastFlavour={blastFlavour}
            control={control}
            theme={theme}
          />
          <ProgramSelection
            register={register}
            setValue={setValue}
            watch={watch}
            blastFlavour={blastFlavour}
            theme={theme}
          />
          <SubmitButton getValues={getValues} watch={watch} theme={theme} />
          <AlgorithmParameters
            register={register}
            formDescription={formDescription}
            blastFlavour={blastFlavour}
            theme={theme}
          />
        </form>
      </div>
    </section>
  );
}
