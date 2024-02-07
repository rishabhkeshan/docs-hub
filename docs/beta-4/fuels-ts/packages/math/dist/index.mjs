// src/bn.ts
import { ErrorCode, FuelError } from "@fuel-ts/errors";
import BnJs from "bn.js";

// src/configs.ts
var DEFAULT_PRECISION = 9;
var DEFAULT_MIN_PRECISION = 3;
var DECIMAL_UNITS = 9;

// src/decimal.ts
function toFixed(value, options) {
  const { precision = DEFAULT_PRECISION, minPrecision = DEFAULT_MIN_PRECISION } = options || {};
  const [valueUnits = "0", valueDecimals = "0"] = String(value || "0.0").split(".");
  const groupRegex = /(\d)(?=(\d{3})+\b)/g;
  const units = valueUnits.replace(groupRegex, "$1,");
  let decimals = valueDecimals.slice(0, precision);
  if (minPrecision < precision) {
    const trimmedDecimal = decimals.match(/.*[1-9]{1}/);
    const lastNonZeroIndex = trimmedDecimal?.[0].length || 0;
    const keepChars = Math.max(minPrecision, lastNonZeroIndex);
    decimals = decimals.slice(0, keepChars);
  }
  const decimalPortion = decimals ? `.${decimals}` : "";
  return `${units}${decimalPortion}`;
}

// src/bn.ts
var BN = class extends BnJs {
  constructor(value, base, endian) {
    if (BN.isBN(value)) {
      super(value.toArray(), base, endian);
      return;
    }
    if (typeof value === "string" && value.slice(0, 2) === "0x") {
      super(value.substring(2), base || "hex", endian);
      return;
    }
    const defaultValue = value == null ? 0 : value;
    super(defaultValue, base, endian);
  }
  // ANCHOR: HELPERS
  // make sure we always include `0x` in hex strings
  toString(base, length) {
    const output = super.toString(base, length);
    if (base === 16 || base === "hex") {
      return `0x${output}`;
    }
    return output;
  }
  toHex(bytesPadding) {
    const bytes = bytesPadding || 0;
    const bytesLength = bytes * 2;
    if (this.isNeg()) {
      throw new FuelError(ErrorCode.CONVERTING_FAILED, "Cannot convert negative value to hex.");
    }
    if (bytesPadding && this.byteLength() > bytesPadding) {
      throw new FuelError(
        ErrorCode.CONVERTING_FAILED,
        `Provided value ${this} is too large. It should fit within ${bytesPadding} bytes.`
      );
    }
    return this.toString(16, bytesLength);
  }
  toBytes(bytesPadding) {
    if (this.isNeg()) {
      throw new FuelError(ErrorCode.CONVERTING_FAILED, "Cannot convert negative value to bytes.");
    }
    return Uint8Array.from(this.toArray(void 0, bytesPadding));
  }
  toJSON() {
    return this.toString(16);
  }
  valueOf() {
    return this.toString();
  }
  format(options) {
    const {
      units = DECIMAL_UNITS,
      precision = DEFAULT_PRECISION,
      minPrecision = DEFAULT_MIN_PRECISION
    } = options || {};
    const formattedUnits = this.formatUnits(units);
    const formattedFixed = toFixed(formattedUnits, { precision, minPrecision });
    if (!parseFloat(formattedFixed)) {
      const [, originalDecimals = "0"] = formattedUnits.split(".");
      const firstNonZero = originalDecimals.match(/[1-9]/);
      if (firstNonZero && firstNonZero.index && firstNonZero.index + 1 > precision) {
        const [valueUnits = "0"] = formattedFixed.split(".");
        return `${valueUnits}.${originalDecimals.slice(0, firstNonZero.index + 1)}`;
      }
    }
    return formattedFixed;
  }
  formatUnits(units = DECIMAL_UNITS) {
    const valueUnits = this.toString().slice(0, units * -1);
    const valueDecimals = this.toString().slice(units * -1);
    const length = valueDecimals.length;
    const defaultDecimals = Array.from({ length: units - length }).fill("0").join("");
    const integerPortion = valueUnits ? `${valueUnits}.` : "0.";
    return `${integerPortion}${defaultDecimals}${valueDecimals}`;
  }
  // END ANCHOR: HELPERS
  // ANCHOR: OVERRIDES to accept better inputs
  add(v) {
    return this.caller(v, "add");
  }
  pow(v) {
    return this.caller(v, "pow");
  }
  sub(v) {
    return this.caller(v, "sub");
  }
  div(v) {
    return this.caller(v, "div");
  }
  mul(v) {
    return this.caller(v, "mul");
  }
  mod(v) {
    return this.caller(v, "mod");
  }
  divRound(v) {
    return this.caller(v, "divRound");
  }
  lt(v) {
    return this.caller(v, "lt");
  }
  lte(v) {
    return this.caller(v, "lte");
  }
  gt(v) {
    return this.caller(v, "gt");
  }
  gte(v) {
    return this.caller(v, "gte");
  }
  eq(v) {
    return this.caller(v, "eq");
  }
  cmp(v) {
    return this.caller(v, "cmp");
  }
  // END ANCHOR: OVERRIDES to accept better inputs
  // ANCHOR: OVERRIDES to output our BN type
  sqr() {
    return new BN(super.sqr().toArray());
  }
  neg() {
    return new BN(super.neg().toArray());
  }
  abs() {
    return new BN(super.abs().toArray());
  }
  toTwos(width) {
    return new BN(super.toTwos(width).toArray());
  }
  fromTwos(width) {
    return new BN(super.fromTwos(width).toArray());
  }
  // END ANCHOR: OVERRIDES to output our BN type
  // ANCHOR: OVERRIDES to avoid losing references
  caller(v, methodName) {
    const output = super[methodName](new BN(v));
    if (BN.isBN(output)) {
      return new BN(output.toArray());
    }
    if (typeof output === "boolean") {
      return output;
    }
    return output;
  }
  clone() {
    return new BN(this.toArray());
  }
  mulTo(num, out) {
    const output = new BnJs(this.toArray()).mulTo(num, out);
    return new BN(output.toArray());
  }
  egcd(p) {
    const { a, b, gcd } = new BnJs(this.toArray()).egcd(p);
    return {
      a: new BN(a.toArray()),
      b: new BN(b.toArray()),
      gcd: new BN(gcd.toArray())
    };
  }
  divmod(num, mode, positive) {
    const { div, mod } = new BnJs(this.toArray()).divmod(new BN(num), mode, positive);
    return {
      div: new BN(div?.toArray()),
      mod: new BN(mod?.toArray())
    };
  }
  // END ANCHOR: OVERRIDES to avoid losing references
};
var bn = (value, base, endian) => new BN(value, base, endian);
bn.parseUnits = (value, units = DECIMAL_UNITS) => {
  const valueToParse = value === "." ? "0." : value;
  const [valueUnits = "0", valueDecimals = "0"] = valueToParse.split(".");
  const length = valueDecimals.length;
  if (length > units) {
    throw new FuelError(
      ErrorCode.CONVERTING_FAILED,
      `Decimal can't have more than ${units} digits.`
    );
  }
  const decimals = Array.from({ length: units }).fill("0");
  decimals.splice(0, length, valueDecimals);
  const amount = `${valueUnits.replaceAll(",", "")}${decimals.join("")}`;
  return bn(amount);
};

// src/functional.ts
function toNumber(value) {
  return bn(value).toNumber();
}
function toHex(value, bytesPadding) {
  return bn(value).toHex(bytesPadding);
}
function toBytes(value, bytesPadding) {
  return bn(value).toBytes(bytesPadding);
}
function formatUnits(value, units) {
  return bn(value).formatUnits(units);
}
function format(value, options) {
  return bn(value).format(options);
}

// src/math.ts
function max(...numbers) {
  return numbers.reduce((prev, cur) => bn(cur).gt(prev) ? bn(cur) : prev, bn(0));
}
function multiply(...numbers) {
  return bn(Math.ceil(numbers.reduce((a, b) => bn(a).mul(b), bn(1)).toNumber()));
}
export {
  BN,
  bn,
  format,
  formatUnits,
  max,
  multiply,
  toBytes,
  toFixed,
  toHex,
  toNumber
};
//# sourceMappingURL=index.mjs.map