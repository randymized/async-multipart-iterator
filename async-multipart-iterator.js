const {breakAtBoundaries} = require('./break-at-boundaries');
const { iterateParts } = require("./iterate-parts");
const { wrapUpParts } = require("./wrap-up-parts");

module.exports.multipartIterator = function multipartIterator(boundary, input) {
    return wrapUpParts(iterateParts(breakAtBoundaries(boundary, input)));
}