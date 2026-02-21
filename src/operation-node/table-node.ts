import { freeze } from '../util/object-utils.js'
import { OperationNode } from './operation-node.js'
import { SchemableIdentifierNode } from './schemable-identifier-node.js'
import { validateIdentifier } from '../util/security-validator.js'

export interface TableNode extends OperationNode {
  readonly kind: 'TableNode'
  readonly table: SchemableIdentifierNode
}

/**
 * @internal
 */
export const TableNode = freeze({
  is(node: OperationNode): node is TableNode {
    return node.kind === 'TableNode'
  },

  create(table: string): TableNode {
    // SECURITY: Validate table name to prevent SQL injection
    // Even though SchemableIdentifierNode will validate, we validate here too for defense in depth
    validateIdentifier(table, 'table name')

    return freeze({
      kind: 'TableNode',
      table: SchemableIdentifierNode.create(table),
    })
  },

  createWithSchema(schema: string, table: string): TableNode {
    // SECURITY: Validate both schema and table names
    validateIdentifier(schema, 'schema name')
    validateIdentifier(table, 'table name')

    return freeze({
      kind: 'TableNode',
      table: SchemableIdentifierNode.createWithSchema(schema, table),
    })
  },
})
