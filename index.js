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
    return ins(this.label, this.arity, this.diff.patch(trees));
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
    return ins(this.label, this.arity, this.diff.patch(del(this.label, this.arity, trees)))
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

function label(obj) {
  if (isPrimitive(obj)) {
    return [obj, []];
  } else if (isArray(obj)) {
    return [[], obj];
  } else /* isObject(obj) */ {
    const entries = Object.entries(obj).sort(
      (a, b) => a[0].localeCompare(b[0])
    );
    return [{}, entries];
  }
}

function triple(trees) {
  const [head, ...tail] = trees;
  const [l, subtrees] = label(head);
  return [l, subtrees, tail];
}

// --------------------------

function choose(p1, p2) {
  return p1.cost() <= p2.cost() ? p1 : p2;
}

// --------------------------

function diffRM(ltrees, rtrees, [lc, rc], m) {
  // console.log(`${JSON.stringify([ltrees, rtrees])} -- (${lc},${rc})`);
  if (ltrees.length === 0 && rtrees.length === 0) {
    return new End();
  } else if (ltrees.length === 0) {
    const [y, ys, yss] = triple(rtrees);
    return new Ins(
      y,
      ys.length,
      diffR([], ys.concat(yss), [lc, rc+1], m)
    );
  } else if (rtrees.length === 0) {
    const [x, xs, xss] = triple(ltrees);
    return new Del(
      x,
      xs.length,
      diffR(xs.concat(xss), [], [lc+1, rc], m)
    );
  } else {
    const [x, xs, xss] = triple(ltrees);
    const [y, ys, yss] = triple(rtrees);
    const d1 = new Del(
      x,
      xs.length,
      diffR(xs.concat(xss), rtrees, [lc+1, rc], m)
    );
    const d2 = new Ins(
      y,
      ys.length,
      diffR(ltrees, ys.concat(yss), [lc, rc+1], m)
    );
    const b2 = choose(d1, d2);
    if (labelsMatch(x,y) && xs.length == ys.length) {
      const d3 = new Cpy(
        x,
        xs.length,
        diffR(xs.concat(xss), ys.concat(yss), [lc+1, rc+1], m)
      );
      return choose(d3, b2);
    } else {
      return b2
    }
  }
}

function diffR(ltrees, rtrees, [lc,rc], memoized) {
  if (memoized) {
    const key = `${lc},${rc}`;
    if (memoized.hasOwnProperty(key)) {
      return memoized[key];
    } else {
      const value = diffRM(ltrees, rtrees, [lc,rc], memoized);
      memoized[key] = value;
      return value;
    }
  } else {
    return diffRM(ltrees, rtrees, [lc,rc], memoized);
  }
}

function diff(left, right, memoized=true) {
  return diffR([left], [right], [0,0], memoized ? {} : null);
}

// --------------------------

function fromEntries(entries) {
  if (Object.hasOwnProperty('fromEntries')) {
    return Object.fromEntries(entries);
  } else {
    return entries.reduce((obj, [k,v]) => {
      obj[k] = v;
      return obj;
    }, {});
  }
}

function mkNode(label, children) {
  if (isArray(label)) {
    return children;
  } else if (isObject(label)) {
    return fromEntries(children);
  } else if (children.length === 0) {
    return label;
  } else {
    throw new Error(
      `${JSON.stringify(label)} cannot have ${children.length} children`
    );
  }
}

function labelsMatch(l1, l2) {
  if ((isArray(l1) && isArray(l2)) || (isObject(l1) && isObject(l2))) {
    return true;
  } else if (isPrimitive(l1) && isPrimitive(l2)) {
    return l1 === l2 || (Number.isNaN(l1) && Number.isNaN(l2));
  } else {
    return false;
  }
}

function ins(label, arity, trees) {
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
    const [head, ...tail] = trees;
    const [l, subtrees] = label(head);
    if (labelsMatch(lbl, l) && arity === subtrees.length) {
      return subtrees.concat(tail);
    } else {
      throw new Error(
        `${JSON.stringify(lbl)} did not match ${JSON.stringify(l)} or ${arity} did not match ${subtrees.length}`
      );
    }
  }
}

function patch(diff, tree) {
  return diff.patch([tree])[0];
}

// --------------------------

module.exports = {
  diff, patch
}
