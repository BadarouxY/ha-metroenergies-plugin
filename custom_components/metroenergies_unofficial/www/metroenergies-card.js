// Custom Lovelace card for the Metroenergies (Unofficial) integration.
// Plain web component (no build step, no external dependency): reads the
// `history` attribute ([{date: "YYYY-MM-DD", conso}, ...]) of a
// metroenergies sensor and draws an interactive bar chart, with a
// day/month/year period selector.

const MONTHS_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
}

function formatNumber(value) {
  return Math.round(value * 10) / 10;
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr, delta) {
  const { y, m, d } = parseDate(dateStr);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function filterByRange(history, start, end) {
  return history.filter((entry) => (!start || entry.date >= start) && (!end || entry.date <= end));
}

function average(values) {
  if (!values || values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// count is only used in rolling-window mode (last N buckets); range mode
// pre-filters history to the chosen bounds and keeps every bucket in it.
function aggregateByDay(history, count = Infinity) {
  const sliced = Number.isFinite(count) ? history.slice(-count) : history;
  return sliced.map((entry) => {
    const { m, d } = parseDate(entry.date);
    return {
      key: entry.date,
      label: `${d}/${m}`,
      value: entry.conso,
      temp: entry.temp ?? null,
    };
  });
}

function aggregateByMonth(history, count = Infinity) {
  const totals = new Map();
  const temps = new Map();
  for (const entry of history) {
    const { y, m } = parseDate(entry.date);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    totals.set(key, (totals.get(key) || 0) + entry.conso);
    if (entry.temp !== null && entry.temp !== undefined) {
      if (!temps.has(key)) temps.set(key, []);
      temps.get(key).push(entry.temp);
    }
  }
  const sortedKeys = [...totals.keys()].sort();
  const keys = Number.isFinite(count) ? sortedKeys.slice(-count) : sortedKeys;
  return keys.map((key) => {
    const [y, m] = key.split("-").map(Number);
    return {
      key,
      label: `${MONTHS_FR[m - 1]} ${y}`,
      value: totals.get(key),
      temp: average(temps.get(key)),
    };
  });
}

function aggregateByYear(history, count = Infinity) {
  const totals = new Map();
  const temps = new Map();
  for (const entry of history) {
    const { y } = parseDate(entry.date);
    totals.set(y, (totals.get(y) || 0) + entry.conso);
    if (entry.temp !== null && entry.temp !== undefined) {
      if (!temps.has(y)) temps.set(y, []);
      temps.get(y).push(entry.temp);
    }
  }
  const sortedKeys = [...totals.keys()].sort();
  const keys = Number.isFinite(count) ? sortedKeys.slice(-count) : sortedKeys;
  return keys.map((y) => ({
    key: String(y),
    label: String(y),
    value: totals.get(y),
    temp: average(temps.get(y)),
  }));
}

const PERIODS = {
  day: { label: "Jour", aggregate: aggregateByDay, defaultCount: 30, unitLabel: "jours" },
  month: { label: "Mois", aggregate: aggregateByMonth, defaultCount: 12, unitLabel: "mois" },
  year: { label: "Année", aggregate: aggregateByYear, defaultCount: 5, unitLabel: "années" },
};

class MetroenergiesCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) {
      throw new Error("Vous devez définir une entité (entity) dans la configuration de la carte.");
    }
    this._config = {
      unit: "kWh",
      title: null,
      color: null,
      // A native color input can never be "empty" once touched, so a plain
      // color field alone gives no way back to the theme default. Default
      // this from whether `color` was already set, so existing YAML
      // configs keep working, but expose it as its own toggle so the
      // visual editor has an unambiguous way to reset to the theme color.
      custom_color: Boolean(config.color),
      temp_color: null,
      custom_temp_color: Boolean(config.temp_color),
      default_period: "day",
      days: PERIODS.day.defaultCount,
      months: PERIODS.month.defaultCount,
      years: PERIODS.year.defaultCount,
      show_period_selector: true,
      default_mode: "rolling",
      show_mode_selector: true,
      show_temperature: true,
      ...config,
    };
    this._period = this._config.default_period in PERIODS ? this._config.default_period : "day";
    this._counts = this._counts || {
      day: this._config.days,
      month: this._config.months,
      year: this._config.years,
    };
    this._mode = this._mode || (["rolling", "range"].includes(this._config.default_mode) ? this._config.default_mode : "rolling");
    if (!this._range) {
      const end = todayISO();
      this._range = { start: addDays(end, -29), end };
    }
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 5;
  }

  static getStubConfig() {
    return { entity: "sensor.metroenergies_unofficial_consommation" };
  }

  static getConfigForm() {
    const LABELS = {
      entity: "Entité",
      title: "Titre",
      unit: "Unité",
      custom_color: "Couleur personnalisée",
      color: "Couleur",
      default_period: "Période par défaut",
      show_period_selector: "Afficher le sélecteur de période",
      days: "Jours affichés par défaut",
      months: "Mois affichés par défaut",
      years: "Années affichées par défaut",
      default_mode: "Mode par défaut",
      show_mode_selector: "Afficher le sélecteur Glissant/Plage",
      show_temperature: "Afficher la courbe de température",
      custom_temp_color: "Couleur personnalisée (courbe)",
      temp_color: "Couleur de la courbe",
    };
    const HELPERS = {
      entity: "Entité exposant l'attribut history (ex. sensor.metroenergies_unofficial_consommation).",
      title: "Affiché au-dessus du graphique. Laisser vide pour ne rien afficher.",
      unit: "Unité affichée dans les infobulles et le total.",
      custom_color: "Décoché, la carte utilise la couleur du thème Home Assistant, quelle que soit la couleur choisie ci-dessous.",
      color: "Utilisée seulement si « Couleur personnalisée » est coché.",
      days: "Valeur de départ, modifiable ensuite directement dans la carte.",
      months: "Valeur de départ, modifiable ensuite directement dans la carte.",
      years: "Valeur de départ, modifiable ensuite directement dans la carte.",
      show_mode_selector: "Si désactivé, masque aussi les champs nombre de jours / plage de dates : la carte reste figée sur le mode et les valeurs par défaut.",
      show_temperature: "Température extérieure moyenne à Grenoble, en surimpression avec sa propre échelle (°C) à droite. Absente si l'entité n'a pas encore de données de température.",
      custom_temp_color: "Décoché, la courbe utilise l'orange par défaut.",
      temp_color: "Utilisée seulement si « Couleur personnalisée (courbe) » est coché.",
    };

    return {
      schema: [
        { name: "entity", required: true, selector: { entity: { domain: "sensor" } } },
        { name: "title", selector: { text: {} } },
        {
          type: "grid",
          name: "",
          schema: [
            { name: "unit", selector: { text: {} } },
            { name: "custom_color", selector: { boolean: {} } },
          ],
        },
        { name: "color", selector: { text: { type: "color" } } },
        {
          type: "grid",
          name: "",
          schema: [
            {
              name: "default_period",
              selector: {
                select: {
                  mode: "dropdown",
                  options: [
                    { value: "day", label: "Jour" },
                    { value: "month", label: "Mois" },
                    { value: "year", label: "Année" },
                  ],
                },
              },
            },
            { name: "show_period_selector", selector: { boolean: {} } },
          ],
        },
        {
          type: "grid",
          name: "",
          schema: [
            { name: "show_temperature", selector: { boolean: {} } },
            { name: "custom_temp_color", selector: { boolean: {} } },
          ],
        },
        { name: "temp_color", selector: { text: { type: "color" } } },
        {
          type: "grid",
          name: "",
          schema: [
            { name: "days", selector: { number: { min: 1, max: 3650, mode: "box" } } },
            { name: "months", selector: { number: { min: 1, max: 600, mode: "box" } } },
            { name: "years", selector: { number: { min: 1, max: 100, mode: "box" } } },
          ],
        },
        {
          type: "grid",
          name: "",
          schema: [
            {
              name: "default_mode",
              selector: {
                select: {
                  mode: "dropdown",
                  options: [
                    { value: "rolling", label: "Glissant" },
                    { value: "range", label: "Plage" },
                  ],
                },
              },
            },
            { name: "show_mode_selector", selector: { boolean: {} } },
          ],
        },
      ],
      computeLabel: (schema) => LABELS[schema.name],
      computeHelper: (schema) => HELPERS[schema.name],
    };
  }

  _periodCount(period) {
    return this._counts[period];
  }

  _contentStyle() {
    const vars = [];
    if (this._config.custom_color && this._config.color) {
      vars.push(`--me-bar-color:${this._config.color};`);
    }
    if (this._config.custom_temp_color && this._config.temp_color) {
      vars.push(`--me-temp-color:${this._config.temp_color};`);
    }
    return vars.join("");
  }

  _buildSkeleton() {
    this.innerHTML = `
      <ha-card>
        <style>
          .me-content { padding: 16px; }
          .me-card-title { font-size:1.1em; font-weight:500; color: var(--primary-text-color); margin-bottom: 8px; }
          .me-header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; gap: 8px; flex-wrap: wrap; }
          .me-subheader { display:flex; justify-content:flex-end; align-items:center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap; }
          .me-periods, .me-mode-group { display:flex; align-items:center; gap:4px; }
          .me-count-group, .me-range-group { display:flex; align-items:center; gap:6px; }
          .me-count-input, .me-range-input {
            padding: 3px 4px; border-radius: 6px;
            border: 1px solid var(--divider-color); background: var(--card-background-color, #fff);
            color: var(--primary-text-color); font-size: 0.85em;
          }
          .me-count-input { width: 3.5em; text-align: right; }
          .me-range-sep { color: var(--secondary-text-color); font-size: 0.8em; }
          .me-count-label { font-size: 0.8em; color: var(--secondary-text-color); margin-right: 8px; }
          .me-period-btn {
            border: none; cursor: pointer; padding: 4px 10px; border-radius: 12px;
            font-size: 0.85em; background: var(--secondary-background-color, #eee);
            color: var(--secondary-text-color);
          }
          .me-period-btn.active { background: var(--primary-color); color: var(--text-primary-color, #fff); }
          .me-chart-wrap { position: relative; }
          .me-bar { fill: var(--me-bar-color, var(--primary-color)); cursor: pointer; }
          .me-bar:hover { opacity: 0.85; }
          .me-axis-line { stroke: var(--divider-color); stroke-width: 1; }
          .me-axis-label { fill: var(--secondary-text-color); font-size: 12px; }
          .me-axis-label-temp { fill: var(--me-temp-color, #ff9800); }
          .me-temp-line { stroke: var(--me-temp-color, #ff9800); stroke-width: 2; fill: none; }
          .me-temp-dot { fill: var(--me-temp-color, #ff9800); }
          .me-total { margin-top: 10px; text-align: right; font-size: 0.85em; color: var(--secondary-text-color); }
          .me-total strong { color: var(--primary-text-color); font-weight: 600; }
          .me-tooltip {
            position: absolute; pointer-events: none; padding: 4px 8px; border-radius: 4px;
            background: var(--card-background-color, #fff); border: 1px solid var(--divider-color);
            color: var(--primary-text-color); font-size: 0.8em; transform: translate(-50%, -110%);
            white-space: nowrap; box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0,0,0,0.2));
            display: none; z-index: 1;
          }
          .me-empty { color: var(--secondary-text-color); padding: 24px 0; text-align: center; }
        </style>
        <div class="me-content" style="${this._contentStyle()}">
          ${this._config.title ? `<div class="me-card-title">${this._config.title}</div>` : ""}
          <div class="me-header">
            <div class="me-periods"></div>
            <div class="me-mode-group">
              <button class="me-period-btn me-mode-btn" data-mode="rolling">Glissant</button>
              <button class="me-period-btn me-mode-btn" data-mode="range">Plage</button>
            </div>
          </div>
          <div class="me-subheader">
            <div class="me-count-group">
              <span class="me-count-label"></span>
              <input class="me-count-input" type="number" min="1" max="3650" />
            </div>
            <div class="me-range-group">
              <input class="me-range-input me-range-start" type="date" />
              <span class="me-range-sep">→</span>
              <input class="me-range-input me-range-end" type="date" />
            </div>
          </div>
          <div class="me-chart-wrap">
            <div class="me-tooltip"></div>
            <div class="me-chart"></div>
          </div>
          <div class="me-total"></div>
        </div>
      </ha-card>
    `;
    this._els = {
      periods: this.querySelector(".me-periods"),
      modeGroup: this.querySelector(".me-mode-group"),
      subheader: this.querySelector(".me-subheader"),
      countGroup: this.querySelector(".me-count-group"),
      countLabel: this.querySelector(".me-count-label"),
      countInput: this.querySelector(".me-count-input"),
      rangeGroup: this.querySelector(".me-range-group"),
      rangeStart: this.querySelector(".me-range-start"),
      rangeEnd: this.querySelector(".me-range-end"),
      chart: this.querySelector(".me-chart"),
      tooltip: this.querySelector(".me-tooltip"),
      chartWrap: this.querySelector(".me-chart-wrap"),
      total: this.querySelector(".me-total"),
    };

    if (this._config.show_period_selector) {
      for (const [key, def] of Object.entries(PERIODS)) {
        const btn = document.createElement("button");
        btn.className = "me-period-btn";
        btn.textContent = def.label;
        btn.dataset.period = key;
        btn.addEventListener("click", () => {
          this._period = key;
          this._render();
        });
        this._els.periods.appendChild(btn);
      }
    }

    if (this._config.show_mode_selector) {
      for (const btn of this._els.modeGroup.querySelectorAll(".me-mode-btn")) {
        btn.addEventListener("click", () => {
          this._mode = btn.dataset.mode;
          this._render();
        });
      }
    } else {
      this._els.modeGroup.remove();
      this._els.subheader.remove();
    }

    this._els.countInput.addEventListener("change", () => {
      const value = Math.max(1, Math.min(3650, Math.round(Number(this._els.countInput.value) || 1)));
      this._counts[this._period] = value;
      this._render();
    });

    this._els.rangeStart.addEventListener("change", () => {
      this._range.start = this._els.rangeStart.value || this._range.start;
      this._render();
    });
    this._els.rangeEnd.addEventListener("change", () => {
      this._range.end = this._els.rangeEnd.value || this._range.end;
      this._render();
    });
  }

  _render() {
    if (!this._config || !this._hass) {
      return;
    }
    if (!this._els) {
      this._buildSkeleton();
    }

    const { periods, chart } = this._els;
    const stateObj = this._hass.states[this._config.entity];

    if (!stateObj) {
      chart.innerHTML = `<div class="me-empty">Entité ${this._config.entity} introuvable</div>`;
      return;
    }

    for (const btn of periods.querySelectorAll(".me-period-btn")) {
      btn.classList.toggle("active", btn.dataset.period === this._period);
    }

    const rangeMode = this._mode === "range";
    if (this._config.show_mode_selector) {
      for (const btn of this._els.modeGroup.querySelectorAll(".me-mode-btn")) {
        btn.classList.toggle("active", btn.dataset.mode === this._mode);
      }

      this._els.countGroup.style.display = rangeMode ? "none" : "flex";
      this._els.rangeGroup.style.display = rangeMode ? "flex" : "none";

      this._els.countLabel.textContent = PERIODS[this._period].unitLabel;
      if (document.activeElement !== this._els.countInput) {
        this._els.countInput.value = this._counts[this._period];
      }
      if (document.activeElement !== this._els.rangeStart) {
        this._els.rangeStart.value = this._range.start;
      }
      if (document.activeElement !== this._els.rangeEnd) {
        this._els.rangeEnd.value = this._range.end;
      }
    }

    const history = stateObj.attributes.history || [];
    const periodDef = PERIODS[this._period];
    const data = rangeMode
      ? periodDef.aggregate(filterByRange(history, this._range.start, this._range.end))
      : periodDef.aggregate(history, this._periodCount(this._period));

    if (data.length === 0) {
      chart.innerHTML = `<div class="me-empty">Pas encore de données</div>`;
      this._els.total.textContent = "";
      return;
    }

    chart.innerHTML = this._buildChart(data);
    this._attachInteractions(data);

    const total = data.reduce((sum, entry) => sum + entry.value, 0);
    this._els.total.innerHTML = `Total : <strong>${formatNumber(total)} ${this._config.unit}</strong>`;
  }

  _buildChart(data) {
    const width = 600;
    const height = 230;
    const padLeft = 52;
    const temps = data.map((d) => d.temp).filter((t) => t !== null && t !== undefined);
    const hasTemp = this._config.show_temperature && temps.length > 0;
    // Wider right margin only when needed, to fit the °C axis labels.
    const padRight = hasTemp ? 38 : 8;
    const padTop = 14;
    const padBottom = 34;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    const dataMax = Math.max(...data.map((d) => d.value), 0);
    // Fixed here rather than user-configurable: a fixed axis scale would
    // distort the chart whenever the period selector switches between
    // day/month/year views, since their value ranges differ wildly.
    const yMax = dataMax > 0 ? dataMax * 1.15 : 1;
    const yMin = 0;
    const range = yMax - yMin || 1;

    // The temperature scale is independent from the consumption one: both
    // just share the same 5 horizontal gridlines, each line meaning a
    // different value on the left vs. the right axis.
    let tempMin = 0;
    let tempRange = 1;
    if (hasTemp) {
      const rawMin = Math.min(...temps);
      const rawMax = Math.max(...temps);
      const pad = (rawMax - rawMin) * 0.15 || 1;
      tempMin = rawMin - pad;
      tempRange = rawMax + pad - tempMin || 1;
    }

    const barSlot = plotWidth / data.length;
    const barWidth = Math.max(barSlot - 2, 1);

    const yToPixel = (value) => padTop + plotHeight - ((value - yMin) / range) * plotHeight;
    const tempToPixel = (value) => padTop + plotHeight - ((value - tempMin) / tempRange) * plotHeight;

    // Horizontal gridlines + labels (0%, 25%, 50%, 75%, 100%)
    let gridSvg = "";
    for (let i = 0; i <= 4; i++) {
      const value = yMin + (range * i) / 4;
      const y = yToPixel(value);
      gridSvg += `<line class="me-axis-line" x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" />`;
      gridSvg += `<text class="me-axis-label" x="${padLeft - 6}" y="${y + 3}" text-anchor="end">${formatNumber(value)}</text>`;
      if (hasTemp) {
        const tempValue = tempMin + (tempRange * i) / 4;
        gridSvg += `<text class="me-axis-label me-axis-label-temp" x="${width - padRight + 6}" y="${y + 3}" text-anchor="start">${formatNumber(tempValue)}°</text>`;
      }
    }

    // Bars
    let barsSvg = "";
    data.forEach((entry, index) => {
      const x = padLeft + index * barSlot + (barSlot - barWidth) / 2;
      const y = yToPixel(entry.value);
      const barHeight = padTop + plotHeight - y;
      barsSvg += `<rect class="me-bar" data-index="${index}" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barHeight, 0)}" rx="2" />`;
    });

    // Temperature line: only points where temp is known, connected as one
    // polyline (any gap from missing data is simply bridged with a straight
    // segment rather than broken up).
    let tempSvg = "";
    if (hasTemp) {
      const points = data
        .map((entry, index) => {
          if (entry.temp === null || entry.temp === undefined) return null;
          const x = padLeft + index * barSlot + barSlot / 2;
          return `${x},${tempToPixel(entry.temp)}`;
        })
        .filter(Boolean);
      if (points.length > 1) {
        tempSvg = `<polyline class="me-temp-line" points="${points.join(" ")}" />`;
      } else if (points.length === 1) {
        const [x, y] = points[0].split(",");
        tempSvg = `<circle class="me-temp-dot" cx="${x}" cy="${y}" r="2.5" />`;
      }
    }

    // X-axis labels, thinned to avoid overlap
    const maxLabels = 10;
    const step = Math.max(Math.ceil(data.length / maxLabels), 1);
    let labelsSvg = "";
    data.forEach((entry, index) => {
      if (index % step !== 0 && index !== data.length - 1) return;
      const x = padLeft + index * barSlot + barSlot / 2;
      labelsSvg += `<text class="me-axis-label" x="${x}" y="${height - 8}" text-anchor="middle">${entry.label}</text>`;
    });

    return `
      <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;" data-slot="${barSlot}" data-padleft="${padLeft}">
        ${gridSvg}
        ${barsSvg}
        ${tempSvg}
        ${labelsSvg}
      </svg>
    `;
  }

  _attachInteractions(data) {
    const svg = this._els.chart.querySelector("svg");
    const tooltip = this._els.tooltip;
    if (!svg) return;

    svg.querySelectorAll(".me-bar").forEach((bar) => {
      bar.addEventListener("mouseenter", (event) => {
        const index = Number(event.target.dataset.index);
        const entry = data[index];
        const tempPart =
          entry.temp !== null && entry.temp !== undefined ? ` (${formatNumber(entry.temp)}°C)` : "";
        tooltip.textContent = `${entry.label} : ${formatNumber(entry.value)} ${this._config.unit}${tempPart}`;
        tooltip.style.display = "block";
      });
      bar.addEventListener("mousemove", (event) => {
        const wrapRect = this._els.chartWrap.getBoundingClientRect();
        tooltip.style.left = `${event.clientX - wrapRect.left}px`;
        tooltip.style.top = `${event.clientY - wrapRect.top}px`;
      });
      bar.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });
    });
  }
}

customElements.define("metroenergies-card", MetroenergiesCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "metroenergies-card",
  name: "Metroenergies Card",
  description: "Graphique de consommation Metroenergies (non officiel), avec sélecteur jour/mois/année",
});
