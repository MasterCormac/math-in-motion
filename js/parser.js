/* =========================================================================
 * parser.js — a tiny, safe math-expression compiler (no eval()).
 *
 * Turns a string like "16*sin(t)^3" into a JavaScript function of t using
 * the classic shunting-yard algorithm. Supports:
 *   operators : + - * / % ^   ( ^ is right-associative, unary minus works )
 *   constants : pi  e  tau
 *   functions : sin cos tan asin acos atan sinh cosh tanh
 *               exp ln log sqrt abs floor ceil round sign
 *   implicit multiplication: "2t", "3sin(t)", "2(t+1)" all work.
 * ========================================================================= */
(function () {
  "use strict";

  var CONSTANTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

  var FUNCTIONS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    exp: Math.exp, ln: Math.log, log: Math.log, // log = natural log here
    sqrt: Math.sqrt, abs: Math.abs,
    floor: Math.floor, ceil: Math.ceil, round: Math.round,
    sign: Math.sign
  };

  // operator precedence / associativity table
  var OPERATORS = {
    "+": { prec: 2, right: false },
    "-": { prec: 2, right: false },
    "*": { prec: 3, right: false },
    "/": { prec: 3, right: false },
    "%": { prec: 3, right: false },
    "^": { prec: 4, right: true },
    "u-": { prec: 5, right: true } // unary minus
  };

  function tokenize(src) {
    var tokens = [];
    var i = 0;
    while (i < src.length) {
      var c = src[i];
      if (c === " " || c === "\t") { i++; continue; }

      if (/[0-9.]/.test(c)) {
        var num = "";
        while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
        if ((num.match(/\./g) || []).length > 1 || isNaN(parseFloat(num))) {
          throw new Error("Bad number: '" + num + "'");
        }
        tokens.push({ type: "num", value: parseFloat(num) });
        continue;
      }

      if (/[a-zA-Z_]/.test(c)) {
        var word = "";
        while (i < src.length && /[a-zA-Z_]/.test(src[i])) word += src[i++];
        word = word.toLowerCase();
        if (FUNCTIONS[word]) tokens.push({ type: "func", value: word });
        else if (word === "t") tokens.push({ type: "var", value: "t" });
        else if (CONSTANTS[word] !== undefined) tokens.push({ type: "num", value: CONSTANTS[word] });
        else throw new Error("Unknown name: '" + word + "' (only t, pi, e, tau and math functions are allowed)");
        continue;
      }

      if ("+-*/%^".indexOf(c) !== -1) { tokens.push({ type: "op", value: c }); i++; continue; }
      if (c === "(") { tokens.push({ type: "lparen" }); i++; continue; }
      if (c === ")") { tokens.push({ type: "rparen" }); i++; continue; }

      throw new Error("Unexpected character: '" + c + "'");
    }

    // ---- insert implicit multiplication: 2t -> 2*t, 3sin(x) -> 3*sin(x), )( -> )*( ----
    var out = [];
    for (var k = 0; k < tokens.length; k++) {
      var cur = tokens[k];
      var prev = out[out.length - 1];
      if (prev) {
        var prevIsValue = prev.type === "num" || prev.type === "var" || prev.type === "rparen";
        var curStartsValue = cur.type === "num" || cur.type === "var" || cur.type === "func" || cur.type === "lparen";
        if (prevIsValue && curStartsValue) out.push({ type: "op", value: "*" });
      }
      out.push(cur);
    }
    return out;
  }

  function toRPN(tokens) {
    var output = [];
    var stack = [];
    var expectOperand = true; // for unary minus detection

    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];

      if (tok.type === "num" || tok.type === "var") {
        output.push(tok);
        expectOperand = false;
      } else if (tok.type === "func") {
        stack.push(tok);
        expectOperand = true;
      } else if (tok.type === "op") {
        var op = tok.value;
        if (expectOperand) {
          if (op === "-") op = "u-";
          else if (op === "+") { expectOperand = true; continue; } // unary plus: skip
          else throw new Error("Misplaced operator '" + op + "'");
        }
        var o1 = OPERATORS[op];
        while (stack.length) {
          var top = stack[stack.length - 1];
          if (top.type === "func" ||
              (top.type === "op" &&
               (OPERATORS[top.value].prec > o1.prec ||
                (OPERATORS[top.value].prec === o1.prec && !o1.right)))) {
            output.push(stack.pop());
          } else break;
        }
        stack.push({ type: "op", value: op });
        expectOperand = true;
      } else if (tok.type === "lparen") {
        stack.push(tok);
        expectOperand = true;
      } else if (tok.type === "rparen") {
        var found = false;
        while (stack.length) {
          var t2 = stack.pop();
          if (t2.type === "lparen") { found = true; break; }
          output.push(t2);
        }
        if (!found) throw new Error("Mismatched parentheses");
        if (stack.length && stack[stack.length - 1].type === "func") {
          output.push(stack.pop());
        }
        expectOperand = false;
      }
    }

    if (expectOperand && output.length > 0) throw new Error("Expression ends unexpectedly");

    while (stack.length) {
      var t3 = stack.pop();
      if (t3.type === "lparen") throw new Error("Mismatched parentheses");
      output.push(t3);
    }
    if (output.length === 0) throw new Error("Empty expression");
    return output;
  }

  function evalRPN(rpn, t) {
    var st = [];
    for (var i = 0; i < rpn.length; i++) {
      var tok = rpn[i];
      if (tok.type === "num") st.push(tok.value);
      else if (tok.type === "var") st.push(t);
      else if (tok.type === "func") {
        if (!st.length) throw new Error("Function '" + tok.value + "' needs an argument");
        st.push(FUNCTIONS[tok.value](st.pop()));
      } else if (tok.type === "op") {
        if (tok.value === "u-") {
          if (!st.length) throw new Error("Bad unary minus");
          st.push(-st.pop());
        } else {
          if (st.length < 2) throw new Error("Not enough operands for '" + tok.value + "'");
          var b = st.pop(), a = st.pop();
          switch (tok.value) {
            case "+": st.push(a + b); break;
            case "-": st.push(a - b); break;
            case "*": st.push(a * b); break;
            case "/": st.push(a / b); break;
            case "%": st.push(a % b); break;
            case "^": st.push(Math.pow(a, b)); break;
          }
        }
      }
    }
    if (st.length !== 1) throw new Error("Malformed expression");
    return st[0];
  }

  /**
   * compile("16*sin(t)^3") -> function (t) -> number
   * Throws Error with a human-readable message on invalid input.
   */
  function compile(src) {
    var rpn = toRPN(tokenize(src));
    return function (t) { return evalRPN(rpn, t); };
  }

  window.MathParser = { compile: compile };
})();
