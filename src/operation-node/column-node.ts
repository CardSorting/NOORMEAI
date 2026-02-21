import { freeze } from '../util/object-utils.js'
import { IdentifierNode } from './identifier-node.js'
import { OperationNode } from './operation-node.js'
import { validateIdentifier } from '../util/security-validator.js'

export interface ColumnNode extends OperationNode {
  readonly kind: 'ColumnNode'
  readonly column: IdentifierNode
}

/**
 * @internal
 */
export const ColumnNode = freeze({
  is(node: OperationNode): node is ColumnNode {
    return node.kind === 'ColumnNode'
  },

  create(column: string): ColumnNode {
    // SECURITY: Validate column name to prevent SQL injection
    // Even though IdentifierNode will validate, we validate here too for defense in depth
    validateIdentifier(column, 'column name')

    return freeze({
      kind: 'ColumnNode',
      column: IdentifierNode.create(column),
    })
  },
})
