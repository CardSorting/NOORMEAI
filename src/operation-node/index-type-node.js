"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexTypeNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.IndexTypeNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'IndexTypeNode';
    },
    create(indexType) {
        return (0, object_utils_js_1.freeze)({
            kind: 'IndexTypeNode',
            indexType,
        });
    },
});
