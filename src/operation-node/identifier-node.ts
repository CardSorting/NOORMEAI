import { freeze } from '../util/object-utils.js'
import { OperationNode } from './operation-node.js'
import { validateIdentifier } from '../util/security-validator.js'

export interface IdentifierNode extends OperationNode {
  readonly kind: 'IdentifierNode'
  readonly name: string
}

/**
 * @internal
 */
export const IdentifierNode = freeze({
  is(node: OperationNode): node is IdentifierNode {
    return node.kind === 'IdentifierNode'
  },

  create(name: string): IdentifierNode {
    // SECURITY: Validate identifier to prevent SQL injection at the lowest level
    // This ensures ALL identifiers are validated, even when parsers are called directly
    validateIdentifier(name, 'identifier')

    return freeze({
      kind: 'IdentifierNode',
      name,
    })
  },
})
