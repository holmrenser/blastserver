import { flattenDeep } from 'lodash';

import { TaxonomyNode, BlastHit } from "../../api/[...jobId]/route";
import styles from './taxonomy.module.scss';

function *depthFirst(trees: TaxonomyNode[], depth=0): Generator<TaxonomyNode>{
  for (const tree of trees) {
    yield {depth, ...tree};
    if (typeof tree.children !== 'undefined'){
      yield *depthFirst(tree.children, depth+1)
    }
  }
}

export default function Taxonomy({
  hits,
  taxonomyTrees
}: {
  hits: BlastHit[],
  taxonomyTrees: TaxonomyNode[]
}): JSX.Element {
  // console.log({ taxonomyTrees })
  const flatTree = taxonomyTrees.length ? flattenDeep(Array.from(depthFirst(taxonomyTrees))) : taxonomyTrees;
  return (
    <div>
      <nav className='navbar has-background-info-light' role='navigation'>
        <div className='navbar-brand'>
          <b className='navbar-item'>Reports</b>
        </div>

        <div className='navbar-menu'>
          <div className='navbar-start'>
            <p className='navbar-item'>Lineage</p>
            <p className='navbar-item'>Organism</p>
          </div>
        </div>
      </nav>
      <div className='has-background-light'>
        <div className={`columns is-centered ${styles.centerTable}`}>
          <table className='table is-size-6 is-narrow is-hoverable'>
            <thead>
              <tr>
                <th>Taxonomy</th>
                <th>Number of Hits</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
            {
              flatTree.map(({ name, count, id, depth, children }) => (
                <tr key={id}>
                  <td>
                    {`${'. '.repeat(depth || 0)}`}
                    <a
                      href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${id}`}
                      target='_blank'
                      title={`Show taxonomy information for ${name} (taxid ${id})`}
                    >
                      {name}
                    </a>
                  </td>
                  <td>{count}</td>
                  <td>{!children?.length && name}</td>
                </tr>
              ))
            }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}