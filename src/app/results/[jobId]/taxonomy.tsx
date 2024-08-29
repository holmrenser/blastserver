import React from "react";
import { flattenDeep } from "lodash";

import { TaxonomyNode, BlastHit } from "../../api/[...jobId]/formatResults";
import styles from "./taxonomy.module.scss";

type FormattedTaxonomyNode = TaxonomyNode & {
  isLast: boolean;
  hasSiblings: boolean;
  siblingLevels: number[];
};

function* depthFirst(
  tree: TaxonomyNode,
  depth = 0,
  siblingLevels: number[] = [],
  isLast: boolean = false,
  hasSiblings: boolean = false
): Generator<FormattedTaxonomyNode> {
  const { name } = tree;
  console.log({ name, depth, isLast, siblingLevels });
  if (isLast) {
    siblingLevels = siblingLevels.filter((l) => l !== depth - 1);
  }
  yield { depth, isLast, hasSiblings, siblingLevels, ...tree };
  const { children } = tree;
  if (typeof children !== "undefined" && children.length) {
    for (const [index, childTree] of children.entries()) {
      const isLast = index === children.length - 1;
      const hasSiblings = children.length > 1;
      if (hasSiblings && !isLast) {
        siblingLevels.push(depth);
      }
      yield* depthFirst(
        childTree,
        depth + 1,
        siblingLevels,
        isLast,
        hasSiblings
      );
    }
  }
}

function getTreePrefix({
  depth,
  isLast,
  siblingLevels,
  // eslint-disable-next-line no-unused-vars
  name,
}: {
  depth: number;
  isLast: boolean;
  siblingLevels: number[];
  name: string;
}): string {
  const prefix = Array(depth).fill("\u00A0"); // \u00A0
  if (isLast) {
    prefix[prefix.length - 1] = "\u2514\u2500";
  } else {
    prefix[prefix.length - 1] = "\u251C\u2500";
  }
  siblingLevels.forEach((level) => {
    if (level < depth - 1) {
      prefix[level] = "\u2502";
    }
  });
  return prefix.join("");
}

export default function Taxonomy({
  taxonomyTrees,
}: {
  hits: BlastHit[];
  taxonomyTrees: TaxonomyNode[];
}): React.JSX.Element {
  if (!taxonomyTrees.length) {
    return <h2>No taxonomy info found</h2>;
  }
  const flatTrees = taxonomyTrees.map((taxonomyTree) =>
    Array.from(depthFirst(taxonomyTree))
  );
  const flatTree = flattenDeep(flatTrees);
  return (
    <div className={styles.taxonomyResults}>
      <nav className="navbar has-background-info-light" role="navigation">
        <div className="navbar-brand">
          <b className="navbar-item">Reports</b>
        </div>
        <div className="navbar-menu">
          <div className="navbar-start">
            <p className="navbar-item is-disabled">Lineage</p>
            <p className="navbar-item">Organism</p>
          </div>
        </div>
      </nav>
      <div className="has-background-light">
        <div className={`columns is-centered ${styles.centerTable}`}>
          <table className="table is-size-6 is-narrow is-hoverable">
            <thead>
              <tr>
                <th>Taxonomy</th>
                <th>Number of Hits</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {flatTree.map(
                ({
                  name,
                  count,
                  id,
                  depth = 0,
                  isLast,
                  children,
                  siblingLevels = [],
                }) => (
                  <tr key={id}>
                    <td>
                      <span style={{ fontFamily: "monospace" }}>
                        {getTreePrefix({ depth, isLast, siblingLevels, name })}
                      </span>
                      <a
                        href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${id}`}
                        target="_blank"
                        title={`Show taxonomy information for ${name} (taxid ${id})`}
                        style={{ marginLeft: ".2rem" }}
                      >
                        {name}
                      </a>
                    </td>
                    <td>{count}</td>
                    <td>{!children?.length && name}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
