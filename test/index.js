const assert = require('assert');
const {multipartIterator} = require('../async-multipart-iterator');
const boundary = 'separator'

function toCRLF(s) {
  return s.replace(/\n/g, "\r\n")
}

const baseBodies = [
  'part 1',

  `
part 2's data
and more!
Part 2 includes a blank line before and after
`,

  'part 3 has no header!'

  ];

const baseHeaders = [
  [
    'key1: value1',
    'key2: value2'
  ],
  [
    'keya: something',
    'keyb: something else'
  ],
  []
];

let baseDoc = toCRLF(`
--separator
key1: value1
key2: value2

part 1
--separator
keya: something
keyb: something else


part 2's data
and more!
Part 2 includes a blank line before and after

--separator

part 3 has no header!
--separator--
`);

const expectedHeaders = baseHeaders;
const expectedBodies = baseBodies.map(s => s.replace(/\n/g, "\r\n"))

async function testBaseDocument(input,options) {
  let n = 1;
  const headers = [];
  const bodies = [];
  try {
    for await (let [header, iterator] of multipartIterator((options && options.substituteBoundary) || boundary, input)) {
      headers.push(header);
      const accum = [];
      for await (let chunk of iterator) {
        accum.push(chunk.toString());
      }
      bodies.push(accum.join(''));
    }
    assert.deepStrictEqual(headers, expectedHeaders);
    assert.deepStrictEqual(bodies, expectedBodies);
  }
  catch(e) {
    if (options && options.substituteBoundary) {
      assert(e.message == 'Boundary not found in document')
    }
    else {
      throw e;
    }
  }
}

describe('Multipart iterator', async function () {
  it('should throw an error if the boundary was not found in the document', async function () {
    await testBaseDocument(baseDoc, {substituteBoundary: boundary+'x'});
  });
  it('should parse, given a single input chunk', async function () {
    await testBaseDocument(baseDoc);
  });
  it('should parse the basic document, broken into even several chunks', async function () {
    const chunks = [];
    const chunksize = 32;
    for (let i = 0; i < baseDoc.length; i+= chunksize) {
      chunks.push(baseDoc.substr(i,chunksize))
    }
    await testBaseDocument(chunks);
  });
  it('should parse the basic document, broken into 1 byte chunks', async function () {
    // Note: a subset of this test would be testing if a boundary is split across two chunks. This test does
    // check that possibility plus other "what if (feature) straddles two (or more) chunks" scenarios.
    const chunks = [];
    const chunksize = 1;     // await never satisfied with this small of a chunk! (or may go into a tight loop)
    for (let i = 0; i < baseDoc.length; i+= chunksize) {
      chunks.push(baseDoc.substr(i,chunksize))
    }
    await testBaseDocument(chunks);
  });
});