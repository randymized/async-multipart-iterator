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

const chunkedDoc = baseDoc.replace(/--separator/g,'|--separator').split('|')

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
  it('should parse the basic document, where there is a chunk break just before the "--" of each boundary', async function () {
    const testcase = chunkedDoc;
    await testBaseDocument(testcase);
  });
  for (let i= 0; i<15; i++) {
    it(`should parse the basic document, where the chunk split is ${i} chars into the boundary`, async function () {
      const t = Array.from(chunkedDoc);
      if (i != 0) {
        t[0] = t[0]+t[1].substr(0,i);
        for (let j= 1; j<t.length-1; j++) {
          t[j] = t[j].substr(i) + t[j+1].substr(0,i);
        }
        t[t.length-1] = t[t.length-1].substr(i);
      }
      await testBaseDocument(t);
    });
  }

  const minusBase = Array.from(chunkedDoc);
  const mbfirst = minusBase.shift();
  minusBase[0] = mbfirst + minusBase[0];

  for (let i= 1; i<15; i++) {
    it(`should parse the basic document, where the chunk split is ${i} chars before the boundary`, async function () {
      const t = Array.from(minusBase);
      let toNext = t[0].substr(-i);
      t[0] = t[0].substr(0,t[0].length-i);

      for (let j= 1; j<t.length-1; j++) {
        let toNext2 = t[j].substr(-i);
        t[j] = toNext + t[j].substr(0,t[j].length-i);
        toNext = toNext2;
      }
      t[t.length-1] = toNext + t[t.length-1]
      await testBaseDocument(t);
    });
  }
  it('should parse the basic document, where there is a chunk break between the "--" of a boundary', async function () {
    const testcase = baseDoc.replace(/--separator/g, '-|-separator').split('|');
    await testBaseDocument(testcase);
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