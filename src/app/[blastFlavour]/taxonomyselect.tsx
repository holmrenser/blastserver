import AsyncSelect from 'react-select/async';
import { Controller } from 'react-hook-form';
import type { Control, UseFormRegister } from 'react-hook-form'; 

import type { FormData, BlastFlavour } from './blastflavour'

type SelectElement = {
  value: string
  label: string
}

type TaxonomyEntry = {
  id: string
  name: string
}

function DropdownIndicator(){
  return <div style={{width:30, height:30}}>
    &nbsp;
  </div>
}

function promiseOptions(inputValue: string){
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH;
  return new Promise<SelectElement[]>((resolve, reject) => {
    const url = `${basePath}/api/taxonomy?` + new URLSearchParams({ query: inputValue });
    fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'GET'
    })
    .then(res => res.json())
    .then(data => {
      const { taxonomyEntries }: { taxonomyEntries: TaxonomyEntry[] } = data;
      resolve(taxonomyEntries.map(({ id, name }) => (
      { value: id, label: `${name} (taxid: ${id})`} 
      )))
    })
    .catch(err => reject(err))
  })
 }

export function TaxonomySelect({
  control,
  register
}: {
  control: Control<FormData<BlastFlavour>>,
  register: UseFormRegister<FormData<BlastFlavour>>
}){
  return <>
    <div className='select is-small'>
      <Controller
        control={control}
        name='taxids'
        render={({ field: { onChange, onBlur, ref }}) => {
          return <AsyncSelect
          styles={{
            control: (baseStyles) => {
              const height = 30;
              return { ...baseStyles, height, minHeight: height, minWidth: 400 }
            },
            indicatorsContainer: (baseStyles) => ({
              ...baseStyles, flexShrink: 2
            }),
            indicatorSeparator: (baseStyles, { hasValue }) => {
              const marginBottom = hasValue ? 12 : 4;
              return {
              ...baseStyles, marginBottom, marginTop: 4
            }},
            valueContainer: (baseStyles, { hasValue }) => {
              const marginTop = hasValue ? -8 : 0
              return {
              ...baseStyles, paddingTop: 0, paddingBottom: 0, marginTop
            }}
          }}
          components={{ DropdownIndicator }}
          loadOptions={promiseOptions}
          placeholder='Enter taxonomic name or taxid'
          noOptionsMessage={()=>('Start typing to see suggestions')}
          onChange={(options: readonly SelectElement[]) => {
            const taxids = options?.map(({ value }) => (value))
            onChange(taxids)
          }}
          isClearable
          isMulti
          {...{ ref, onBlur }}
        />
        }}
      />
    </div>
    <label className='checkbox'>
      <input
        type='checkbox'
        style={{ marginLeft: 8, marginRight: 4}}
        {...register('excludeTaxids')}
      />
      Exclude taxids
    </label>
  </>
}