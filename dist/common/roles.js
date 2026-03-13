"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTENT_ROLES = void 0;
exports.hasContentAccess = hasContentAccess;
exports.CONTENT_ROLES = ['admin', 'teacher', 'student'];
function hasContentAccess(roleName) {
    return !!roleName && exports.CONTENT_ROLES.includes(roleName.toLowerCase());
}
//# sourceMappingURL=roles.js.map