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

        // the rest (the body) will available from the sub-iterator
        yield [headerLines, subIterator]
    }
}

exports.wrapUpParts = wrapUpParts;
