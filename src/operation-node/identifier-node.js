"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentifierNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const security_validator_js_1 = require("../util/security-validator.js");
/**
 * @internal
 */
exports.IdentifierNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'IdentifierNode';
    },
    create(name) {
        // SECURITY: Validate identifier to prevent SQL injection at the lowest level
        // This ensures ALL identifiers are validated, even when parsers are called directly
        (0, security_validator_js_1.validateIdentifier)(name, 'identifier');
        return (0, object_utils_js_1.freeze)({
            kind: 'IdentifierNode',
            name,
        });
    },
});
