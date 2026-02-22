import { freeze } from '../util/object-utils.js'
import { OperationNode } from './operation-node.js'

export type IndexType = 'btree' | 'hash' | 'gist' | 'gin'

export interface IndexTypeNode extends OperationNode {
  readonly kind: 'IndexTypeNode'
  readonly indexType: IndexType
}

/**
 * @internal
 */
export const IndexTypeNode = freeze({
  is(node: OperationNode): node is IndexTypeNode {
    return node.kind === 'IndexTypeNode'
  },

  create(indexType: IndexType): IndexTypeNode {
    return freeze({
      kind: 'IndexTypeNode',
      indexType,
    })
  },
})
