'use strict'

const CRLF = Buffer.from("\r\n");
const EmptyBuffer = Buffer.alloc(0);  // start with no remnant

class PartParserWrapper {
    constructor() {
        this.chunkCount = 0;
    }
    async *parser(fromParser) {
        let haveHeader = false;
        let headerlines = [];
        let remnant = EmptyBuffer;  // start with no remnant
        while (true) {
            let chunk = await fromParser.next();
            if (chunk.done)
                throw new Error('Boundary not found in document')
            if (chunk.value) {
                chunk = chunk.value;    // at this point, only work with the chunk value
                this.chunkCount++;
                let cursor = 0;
                if (!haveHeader) {
                    while (!haveHeader) {
                        chunk = Buffer.concat([remnant,chunk]); // append any remnant from last pass
                        remnant = EmptyBuffer;
                        let icrlf = chunk.indexOf(CRLF, cursor);
                        if (icrlf == cursor) {
                            // found the empty line marking the end of the header section
                            haveHeader = true;
                            cursor += 2;
                            const headerStrings = headerlines.map(line => line.toString());
                            yield headerStrings
                            yield chunk.slice(cursor);
                        }
                        else if (icrlf > cursor) {
                            headerlines.push(chunk.slice(cursor,icrlf));
                            cursor = icrlf + 2;
                        }
                        else {
                            remnant = chunk.slice(cursor);
                            break;  // drop out of header loop for another chunk
                        }
                    }
                }
                else {
                    yield chunk;
                }
            }
            else {
                // a false chunk is received when the next boundary is encountered
                return;
            }
        }
    }
}
/**
 *
 * @param {*} docPartIterator
 */

async function* iterateParts(docPartIterator) {
    let chunkCount = 1; // an initial non-zero count is needed to start the loop
    await docPartIterator.next(); // wait for the first boundary

    // note that since the final partParser will just receive the second false chunk,
    // which marks the end of the multipart document, it will have received no
    // chunks. So we can keep looping until a partParser receives no chunks.
    while (chunkCount) {
        const wrapper = new PartParserWrapper();
        yield wrapper.parser(docPartIterator);
        await wrapper.parser;
        chunkCount = wrapper.chunkCount;
    }
}
exports.iterateParts = iterateParts;
