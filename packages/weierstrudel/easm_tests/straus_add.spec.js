const Runtime = require('../parser/runtime');
const bn128Reference = require('../js_snippets/bn128_reference');
const chai = require('chai');

const { expect, assert } = chai;

const testHelper = `
#include "./easm_modules/straus_add.easm"
#include "./easm_modules/constants.easm"
#define X2 = takes(0) returns(1) { 0x20 }
#define Y2 = takes(0) returns(1) { 0x00 }
#define STRAUS_ADD_IMPL = takes(3) returns(11) {
    STRAUS_ADD<P,P,P,X2,Y2>()
}`;


describe('bn128 straus-add', () => {
    let add;
    before(() => {
        add = new Runtime(testHelper);
    });
    it('macro STRAUS_ADD correctly calculates point addition', async () => {
        const { x: x2, y: y2 } = bn128Reference.randomPoint();
        const { x: x1, y: y1, z: z1 } = bn128Reference.randomPointJacobian();
        const { zz, zzz } = bn128Reference.zFactors({ x2, y2 }, { x1, y1, z1 });

        const { x, y, z } = bn128Reference.randomPointJacobian();
        const initialMemory = [{
            index: 32,
            value: bn128Reference.p.sub(x2),
        }, {
            index: 0,
            value: y2,
        }];
        const reference = bn128Reference.mixedAdd(x2, y2, x1, y1, z1);
        const { stack, memory } = await add('STRAUS_ADD_IMPL', [x1, bn128Reference.p.sub(y1), z1], initialMemory);
        expect(stack.length).to.equal(11);
        const [x1Out, y1Out, pA, zzzOut, pB, pC, zzOut, pD, x3, y3, z3] = stack;
        expect(pA.eq(bn128Reference.p)).to.equal(true);
        expect(pB.eq(bn128Reference.p)).to.equal(true);
        expect(pC.eq(bn128Reference.p)).to.equal(true);
        expect(pD.eq(bn128Reference.p)).to.equal(true);
        expect(x1Out.umod(pA).eq(x1)).to.equal(true);
        expect(y1Out.umod(pA).eq(pA.sub(y1))).to.equal(true);
        expect(x3.umod(pA).eq(reference.x)).to.equal(true);
        expect(y3.umod(pA).eq(pA.sub(reference.y))).to.equal(true);
        expect(z3.umod(pA).eq(reference.z)).to.equal(true);
        expect(zzOut.umod(pA).eq(zz)).to.equal(true);
        expect(zzzOut.umod(pA).eq(zzz)).to.equal(true);

    });
});