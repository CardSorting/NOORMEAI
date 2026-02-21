import { freeze } from '../util/object-utils.js'
import { IdentifierNode } from './identifier-node.js'
import { OperationNode } from './operation-node.js'
import { RawNode } from './raw-node.js'
import { TableNode } from './table-node.js'
import { WhereNode } from './where-node.js'

import { IndexTypeNode } from './index-type-node.js'

export type CreateIndexNodeProps = Omit<CreateIndexNode, 'kind' | 'name'>

export interface CreateIndexNode extends OperationNode {
  readonly kind: 'CreateIndexNode'
  // This isn't and shouldn't be a `SchemableIdentifier`. Postgres doesn't
  // allow explicit schema for create index query. The schema is always the
  // same as the target table's schema.
  readonly name: IdentifierNode
  readonly table?: TableNode
  readonly columns?: OperationNode[]
  readonly unique?: boolean
  readonly using?: IndexTypeNode | RawNode
  readonly ifNotExists?: boolean
  readonly where?: WhereNode
  readonly nullsNotDistinct?: boolean
}

/**
 * @internal
 */
export const CreateIndexNode = freeze({
  is(node: OperationNode): node is CreateIndexNode {
    return node.kind === 'CreateIndexNode'
  },

  create(name: string): CreateIndexNode {
    return freeze({
      kind: 'CreateIndexNode',
      name: IdentifierNode.create(name),
    })
  },

  cloneWith(
    node: CreateIndexNode,
    props: CreateIndexNodeProps,
  ): CreateIndexNode {
    return freeze({
      ...node,
      ...props,
    })
  },

  cloneWithColumns(
    node: CreateIndexNode,
    columns: OperationNode[],
  ): CreateIndexNode {
    return freeze({
      ...node,
      columns: [...(node.columns || []), ...columns],
    })
  },
})
