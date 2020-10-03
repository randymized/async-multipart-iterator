'use strict'

class PartParserWrapper {
    constructor() {
        this.chunkCount = 0;
    }
    async *parser(fromParser) {
        let chunk = await fromParser.next();
        if (chunk.done) return;
        yield chunk.value;
    }
}

/**
 *
 * @param {*} partIterator
 */

async function* wrapUpParts(partIterator) {
    while (true) {
        // the first yield is of the otherwise unparsed header lines.
        const rslt = await partIterator.next();
        if (rslt.done) return;
        const subIterator = rslt.value;
        const headerRslt = await subIterator.next();
        if (headerRslt.done) return;
        const headerLines = headerRslt.value;
        const headerStrings = headerLines.map(line => line.toString());

        // the rest (the body) will available from the sub-iterator

        // although usually only the first two elements, headerStrings and the sub-part iterator
        // are used, a third element is yielded, in case it is desirable to access the raw
        // buffer header lines before decoding into strings.
        yield [headerStrings, subIterator, headerLines]
    }
}

exports.wrapUpParts = wrapUpParts;
