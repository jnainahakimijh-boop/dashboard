/** Columnar fact table: rows are appended in non-decreasing day order so a
 *  date range maps to a contiguous slice via `dayStart`. Measures are stored
 *  as Float32 (exact for integers below 16.7M); aggregation uses Float64. */
export class FactTable<D extends string = string, M extends string = string> {
  readonly dimNames: readonly D[];
  readonly measNames: readonly M[];
  n = 0;
  private cap: number;
  day: Uint16Array;
  dims: Record<D, Uint16Array>;
  meas: Record<M, Float32Array>;
  dayStart: Int32Array = new Int32Array(0);
  days = 0;

  constructor(dimNames: readonly D[], measNames: readonly M[], capacity = 1024) {
    this.dimNames = dimNames;
    this.measNames = measNames;
    this.cap = capacity;
    this.day = new Uint16Array(capacity);
    this.dims = {} as Record<D, Uint16Array>;
    this.meas = {} as Record<M, Float32Array>;
    for (const d of dimNames) this.dims[d] = new Uint16Array(capacity);
    for (const m of measNames) this.meas[m] = new Float32Array(capacity);
  }

  private grow(): void {
    const cap = this.cap * 2;
    const nd = new Uint16Array(cap);
    nd.set(this.day);
    this.day = nd;
    for (const d of this.dimNames) {
      const a = new Uint16Array(cap);
      a.set(this.dims[d]);
      this.dims[d] = a;
    }
    for (const m of this.measNames) {
      const a = new Float32Array(cap);
      a.set(this.meas[m]);
      this.meas[m] = a;
    }
    this.cap = cap;
  }

  /** Append a row. `dimVals` / `measVals` follow dimNames / measNames order. */
  push(day: number, dimVals: ArrayLike<number>, measVals: ArrayLike<number>): void {
    if (this.n >= this.cap) this.grow();
    const i = this.n++;
    this.day[i] = day;
    for (let k = 0; k < this.dimNames.length; k++) this.dims[this.dimNames[k]][i] = dimVals[k];
    for (let k = 0; k < this.measNames.length; k++) this.meas[this.measNames[k]][i] = measVals[k];
  }

  /** Build the day index; must be called once after all rows are appended. */
  finalize(totalDays: number): this {
    this.days = totalDays;
    const ds = new Int32Array(totalDays + 1);
    let row = 0;
    for (let d = 0; d <= totalDays; d++) {
      while (row < this.n && this.day[row] < d) row++;
      ds[d] = row;
    }
    this.dayStart = ds;
    // trim to size
    this.day = this.day.slice(0, this.n);
    for (const d of this.dimNames) this.dims[d] = this.dims[d].slice(0, this.n);
    for (const m of this.measNames) this.meas[m] = this.meas[m].slice(0, this.n);
    this.cap = this.n;
    return this;
  }

  /** Row slice [start, end) for an inclusive day range (clipped to the table). */
  rows(fromDay: number, toDay: number): [number, number] {
    const f = Math.max(0, Math.min(this.days, fromDay));
    const t = Math.max(-1, Math.min(this.days - 1, toDay));
    if (t < f) return [0, 0];
    return [this.dayStart[f], this.dayStart[t + 1]];
  }
}
