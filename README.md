# async-multipart-iterator
Iterate the parts of an RFC 1528 multipart (multipart/mixed, multipart/alternative, multipart/digest, multipart/parallel) document, sequentially producing a header and a body iterator for each part.

## Quick example

```js
'use strict'
const someInputFile = 'something';  // name of a multipart file to be parsed
const someOutputDir = '/tmp/something';  // name of a directory in which bodies of each of the parts will be written
const boundary = 'cd67d1a112145bdcfdce0c5839b36b53'; // the boundaries to be found in the input file

const fs = require('fs');
const {multipartIterator} = require('async-multipart-iterator');

async function main() {
    const input = fs.createReadStream(someInputFile);

    let count = 0;
    for await (let [header, bodyIterator] of multipartIterator(boundary, input)) {
        // here for each part of the document
        console.log(header)  // right now just an array of unparsed lines from the part's header
        const stream = fs.createWriteStream(`{someOutputFile}/${count++}`);
        for await (let chunk of bodyIterator) {
            await new Promise( (res,rej) => stream.write(chunk, res));
        }
        await new Promise( (res,rej) => stream.end(res));
    }
}
main().catch(console.error)
```