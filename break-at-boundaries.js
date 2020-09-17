'use strict'

// see: RFC1521, section 7.2: The Multipart Content-Type
//    https://tools.ietf.org/html/rfc1521#page-29

const finalMarker = Buffer.from('--');
const crlf = Buffer.from("\r\n");

/**
 * Parse a multipart document.
 * Yields false for every boundary encountered.
 * Yields false twice at the end of the multipart document.
 * Yields buffers for all content between boundaries.
 * Ignores any content before the first boundary.
 * Stops parsing and ignores any content after the terminal boundary.
 */
module.exports.parseMultipart = async function* parseMultipart(boundary, input) {
    const fullBoundaryLength = boundary.length + 4; // add preceding "\r\n--"
    const boundbuff = Buffer.from(`\r\n--${boundary}`);
    const initialBoundbuff = Buffer.from(`--${boundary}`);
    let first = true;
    let prologue = true;  // ignore any content before the first boundary
    let needTail= false;
    let flush = false;
    let remnant = Buffer.alloc(0);  // start with no remnant

    // Try to assure that the input is an iterator over buffers.
    // Adapt a single buffer or a string to an array of buffers.
    if (Buffer.isBuffer(input)) input = [input];
    else if (typeof input == 'string') input = [Buffer.from(input)];


    for await (let chunk of input) {
        if (flush) break;  // flushing out any remaining buffer after the ending boundary

        chunk = Buffer.concat([remnant, Buffer.isBuffer(chunk)? chunk: Buffer.from(chunk)]); // prepend any remnant from last pass
        let cursor = 0
        const end = chunk.length
        while (cursor < end) {
            await new Promise( res => process.nextTick(res))

            /**
             * Reads the tail of the boundary.
             * If this is a terminal boundary, finds '--' after the boundary and returns 2.
             * For normal boundaries, skips over \r\n and returns 1.
             * If there is not enough content in the current chunk, sets `needTail` and returns 0.
             *
             * @returns the number of false yields needed.
             */
            function readTail() {
                debugger
                if (cursor > end - 2) {
                    // need to read another check before checking the tail of the boundary
                    needTail = true;
                    remnant = chunk.slice(cursor);
                    cursor = end;
                    return 0;
                }
                else {
                    if (finalMarker.equals(chunk.slice(cursor, cursor+2))) {
                        // boundary after the final part
                        cursor += 2;
                        return 2;
                    }
                    if (crlf.equals(chunk.slice(cursor, cursor+2))) {
                        // cr lf after the boundary (really not optional)
                        cursor += 2;
                        return 1;  // signal the end of the part
                    }
                }
            }
            if (needTail) {
                needTail = false;
                const neededYields = readTail()
                if (neededYields === 0) continue;       // loop back for another chunk
                for (let i = neededYields; i--; ) yield false;
                if (neededYields == 2) return;  // terminal boundary was encountered
            }
            if (first) {
                if (end < fullBoundaryLength) {
                    // buffer is not long enough to hold a boundary. Go back for more.
                    remnant = chunk;
                    cursor = end;
                    break;
                }
                first = false;
                if (chunk.indexOf(initialBoundbuff) == 0) {
                    // \r\n does not precede the first boundary -- prepend \r\n
                    chunk= Buffer.concat([Buffer.from("\r\n"),chunk]);
                }
            }
            let ibound = chunk.indexOf(boundbuff, cursor);
            if (ibound === -1) {
                // no boundary in what remains of this chunk
                const beginRemnant = end - fullBoundaryLength;
                if (beginRemnant < 0) {
                    // the buffer is shorter than a boundary
                    remnant = chunk.slice(cursor)  // retain whatever is available
                } else {
                    // the buffer is longer than a boundary
                    if (cursor < beginRemnant) {
                        // yield up to where the remnant should begin
                        yield chunk.slice(cursor, beginRemnant);
                    }
                    // retain enough that a boundary that straddles this and the next
                    // chunk will be found next time through the loop.
                    remnant = chunk.slice(Math.max(cursor, beginRemnant));
                }
                cursor = end;   // exit the loop and get a new chunk
            }
            else {
                // found a boundary
                if (ibound > cursor) {
                    // yield the chunk up to the boundary
                    if (!prologue) yield chunk.slice(cursor, ibound);
                    cursor = ibound;
                }
                prologue = false;       // (at least) the first boundary has been encountered
                cursor += boundbuff.length;

                const neededYields = readTail();
                for (let i = neededYields; i--; ) yield false;
                if (neededYields == 2) {  // terminal boundary was encountered
                    flush = true;
                    cursor = end;
                }
            }
        }
    }
}
