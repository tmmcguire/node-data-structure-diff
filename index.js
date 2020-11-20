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

  patch(trees) {
    return insert(this.label, this.arity, this.diff.patch(trees));
  }
}

class Del extends Diff {
  constructor(label, arity, diff) {
    super('del', label, arity, diff);
  }

  patch(trees) {
    return this.diff.patch(del(this.label, this.arity, trees));
  }
}

class Cpy extends Diff {
  constructor(label, arity, diff) {
    super('cpy', label, arity, diff);
  }

  cost() {
    return 0;
  }

  patch(trees) {
    return insert(this.label, this.arity, this.diff.patch(del(this.label, this.arity, trees)))
  }
}

class End extends Diff {
  constructor() {
    super('end', undefined, 0, undefined);
  }

  cost() {
    return 0;
  }

  patch(trees) {
    if (trees.length === 0) {
      return [];
    } else {
      throw new Error(`end patch cannot be applied: ${JSON.stringify(trees)}`);
    }
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
    const entries = Object.entries(obj).sort((a, b) => a.localeCompare(b));
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

function diffR(ltrees, rtrees) {
  if (ltrees.length === 0 && rtrees.length === 0) {
    return new End();
  } else if (ltrees.length === 0) {
    const [y, ys, yss] = triple(rtrees);
    return new Ins(y, ys.length, diffR([], ys.concat(yss)))
  } else if (rtrees.length === 0) {
    const [x, xs, xss] = triple(ltrees);
    return new Del(x, xs.length, diffR(xs.concat(xss), []));
  } else {
    const [x, xs, xss] = triple(ltrees);
    const [y, ys, yss] = triple(rtrees);
    const d1 = new Del(x, xs.length, diffR(xs.concat(xss), rtrees));
    const d2 = new Ins(y, ys.length, diffR(ltrees, ys.concat(yss)));
    const b2 = choose(d1, d2);
    if (x === y && xs.length === ys.length) {
      const d3 = new Cpy(x, xs.length, diffR(xs.concat(xss), ys.concat(yss)));
      const b3 = choose(d3, b2);
      return b3;
    } else {
      return b2
    }
  }
}

function diff(left, right) {
  return diffR([left], [right]);
}

// --------------------------

function mkNode(label, children) {
  if (label === 'ARRAY') {
    return children;
  } else if (label === 'CLASS') {
    return Object.fromEntries(children);
  } else if (children.length === 0) {
    return label;
  } else {
    throw new Error(`${label} cannot have ${children.length} children`);
  }
}

function insert(label, arity, trees) {
  const ys = trees.slice(0, arity);
  if (ys.length === arity) {
    return [mkNode(label, ys)].concat(trees.slice(arity));
  } else {
    throw new Error(`Expected ${arity} subtrees, found only ${ys.toString()}`);
  }
}

function del(lbl, arity, trees) {
  if (trees.length === 0) {
    throw new Error(`Expected ${arity} subtrees, found only ${trees.length}`);
  } else {
    const [node, ...tss] = trees;
    const [l, subtrees] = label(node);
    if (lbl === l && arity === subtrees.length) {
      return subtrees.concat(tss);
    } else {
      throw new Error(`${lbl} did not mach ${l} or ${arity} did not match ${subtrees.length}`);
    }
  }
}

function patch(diff, tree) {
  return diff([tree])[0];
}

// --------------------------

module.exports = {
  diff, patch
}
