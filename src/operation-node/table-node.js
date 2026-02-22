"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const schemable_identifier_node_js_1 = require("./schemable-identifier-node.js");
const security_validator_js_1 = require("../util/security-validator.js");
/**
 * @internal
 */
exports.TableNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'TableNode';
    },
    create(table) {
        // SECURITY: Validate table name to prevent SQL injection
        // Even though SchemableIdentifierNode will validate, we validate here too for defense in depth
        (0, security_validator_js_1.validateIdentifier)(table, 'table name');
        return (0, object_utils_js_1.freeze)({
            kind: 'TableNode',
            table: schemable_identifier_node_js_1.SchemableIdentifierNode.create(table),
        });
    },
    createWithSchema(schema, table) {
        // SECURITY: Validate both schema and table names
        (0, security_validator_js_1.validateIdentifier)(schema, 'schema name');
        (0, security_validator_js_1.validateIdentifier)(table, 'table name');
        return (0, object_utils_js_1.freeze)({
            kind: 'TableNode',
            table: schemable_identifier_node_js_1.SchemableIdentifierNode.createWithSchema(schema, table),
        });
    },
});
