'use strict';

/// True if obj is a JS primitive.
function isPrimitive(obj) {
  switch (typeof obj) {
    case 'undefined':
    case 'boolean':
    case 'number':
    case 'string':
    case 'bigint':
    case 'symbol':
    case 'function':
      return true;
    default:
      return obj === null || obj instanceof Date;
  }
}

function isArray(obj) { return obj instanceof Array; }
function isObject(obj) { return !isPrimitive(obj) && !isArray(obj); }

// --------------------------
class Diff {
  constructor(op, label, arity, diff) {
    this.op = op;
    this.label = label;
    this.arity = arity;
    this.diff = diff;
  }
  cost() {
    return 1 + this.diff.cost();
  }
  toString() {
    return `${this.op}(${this.label}, ${this.arity}, [${this.diff}])`;
  }
}

class Ins extends Diff {
  constructor(label, arity, diff) {
    super('ins', label, arity, diff);
  }
}

class Del extends Diff {
  constructor(label, arity, diff) {
    super('del', label, arity, diff);
  }
}

class Cpy extends Diff {
  constructor(label, arity, diff) {
    super('cpy', label, arity, diff);
  }
  cost() {
    return 0;
  }
}

class End extends Diff {
  constructor() {
    super('end', undefined, 0, undefined);
  }
  cost() {
    return 0;
  }
  toString() {
    return 'end()'
  }
}
// --------------------------

const ARRAY = 'ARRAY';
const OBJECT = 'OBJECT';

function label(obj) {
  if (isPrimitive(obj)) {
    return [obj, []];
  } else if (isArray(obj)) {
    return [ARRAY, obj];
  } else /* isObject(obj) */ {
    const entries = Object.entries(obj).sort((a,b) => a.localeCompare(b));
    return [OBJECT, entries];
  }
}

function triple(trees) {
  const [hd, ...tl] = trees;
  const [lbl, subtrees] = label(hd);
  return [lbl, subtrees, tl];
}

// --------------------------

function choose(p1, p2) {
  return p1.cost() <= p2.cost() ? p1 : p2;
}

// --------------------------

function doDiff(ltrees, rtrees) {
  if (ltrees.length === 0 && rtrees.length === 0) {
    return new End();
  } else if (ltrees.length === 0) {
    const [y, ys, yss] = triple(rtrees);
    return new Ins(y, ys.length, doDiff([], ys.concat(yss)))
  } else if (rtrees.length === 0) {
    const [x, xs, xss] = triple(ltrees);
    return new Del(x, xs.length, doDiff(xs.concat(xss), []));
  } else {
    const [x, xs, xss] = triple(ltrees);
    const [y, ys, yss] = triple(rtrees);
    const d1 = new Del(x, xs.length, doDiff(xs.concat(xss), rtrees));
    const d2 = new Ins(y, ys.length, doDiff(ltrees, ys.concat(yss)));
    const b2 = choose(d1,d2);
    if (x === y && xs.length === ys.length) {
      const d3 = new Cpy(x, xs.length, doDiff(xs.concat(xss), ys.concat(yss)));
      const b3 = choose(d3, b2);
      return b3;
    } else {
      return b2
    }
  }
}

function diff(left, right) {
  return doDiff([left], [right]);
}

module.exports = {
  diff,
}
