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

function aggregateByDay(history, count) {
  return history.slice(-count).map((entry) => {
    const { m, d } = parseDate(entry.date);
    return {
      key: entry.date,
      label: `${d}/${m}`,
      value: entry.conso,
    };
  });
}

function aggregateByMonth(history, count) {
  const totals = new Map();
  for (const entry of history) {
    const { y, m } = parseDate(entry.date);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    totals.set(key, (totals.get(key) || 0) + entry.conso);
  }
  const keys = [...totals.keys()].sort().slice(-count);
  return keys.map((key) => {
    const [y, m] = key.split("-").map(Number);
    return {
      key,
      label: `${MONTHS_FR[m - 1]} ${y}`,
      value: totals.get(key),
    };
  });
}

function aggregateByYear(history, count) {
  const totals = new Map();
  for (const entry of history) {
    const { y } = parseDate(entry.date);
    totals.set(y, (totals.get(y) || 0) + entry.conso);
  }
  const keys = [...totals.keys()].sort().slice(-count);
  return keys.map((y) => ({
    key: String(y),
    label: String(y),
    value: totals.get(y),
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
      default_period: "day",
      days: PERIODS.day.defaultCount,
      months: PERIODS.month.defaultCount,
      years: PERIODS.year.defaultCount,
      show_period_selector: true,
      ...config,
    };
    this._period = this._config.default_period in PERIODS ? this._config.default_period : "day";
    this._counts = this._counts || {
      day: this._config.days,
      month: this._config.months,
      year: this._config.years,
    };
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
      color: "Couleur",
      default_period: "Période par défaut",
      show_period_selector: "Afficher le sélecteur de période",
      days: "Jours affichés par défaut",
      months: "Mois affichés par défaut",
      years: "Années affichées par défaut",
    };
    const HELPERS = {
      entity: "Entité exposant l'attribut history (ex. sensor.metroenergies_unofficial_consommation).",
      title: "Affiché au-dessus du graphique. Laisser vide pour ne rien afficher.",
      unit: "Unité affichée dans les infobulles et le total.",
      days: "Valeur de départ, modifiable ensuite directement dans la carte.",
      months: "Valeur de départ, modifiable ensuite directement dans la carte.",
      years: "Valeur de départ, modifiable ensuite directement dans la carte.",
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
            { name: "color", selector: { color_rgb: {} } },
          ],
        },
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
            { name: "days", selector: { number: { min: 1, max: 3650, mode: "box" } } },
            { name: "months", selector: { number: { min: 1, max: 600, mode: "box" } } },
            { name: "years", selector: { number: { min: 1, max: 100, mode: "box" } } },
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

  _colorToCss(color) {
    // The color_rgb selector (visual color picker) yields an [r, g, b]
    // array; YAML-configured colors (hex, var(--...)) stay plain strings.
    return Array.isArray(color) ? `rgb(${color.join(",")})` : color;
  }

  _buildSkeleton() {
    this.innerHTML = `
      <ha-card>
        <style>
          .me-content { padding: 16px; }
          .me-card-title { font-size:1.1em; font-weight:500; color: var(--primary-text-color); margin-bottom: 8px; }
          .me-header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap; }
          .me-periods { display:flex; align-items:center; gap:4px; }
          .me-count-group { display:flex; align-items:center; gap:6px; }
          .me-count-input {
            width: 3.5em; padding: 3px 4px; border-radius: 6px; text-align: right;
            border: 1px solid var(--divider-color); background: var(--card-background-color, #fff);
            color: var(--primary-text-color); font-size: 0.85em;
          }
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
        <div class="me-content" style="${this._config.color ? `--me-bar-color:${this._colorToCss(this._config.color)};` : ""}">
          ${this._config.title ? `<div class="me-card-title">${this._config.title}</div>` : ""}
          <div class="me-header">
            <div class="me-periods"></div>
            <div class="me-count-group">
              <span class="me-count-label"></span>
              <input class="me-count-input" type="number" min="1" max="3650" />
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
      countLabel: this.querySelector(".me-count-label"),
      countInput: this.querySelector(".me-count-input"),
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

    this._els.countInput.addEventListener("change", () => {
      const value = Math.max(1, Math.min(3650, Math.round(Number(this._els.countInput.value) || 1)));
      this._counts[this._period] = value;
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

    this._els.countLabel.textContent = PERIODS[this._period].unitLabel;
    if (document.activeElement !== this._els.countInput) {
      this._els.countInput.value = this._counts[this._period];
    }

    const history = stateObj.attributes.history || [];
    const periodDef = PERIODS[this._period];
    const data = periodDef.aggregate(history, this._periodCount(this._period));

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
    const padRight = 8;
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

    const barSlot = plotWidth / data.length;
    const barWidth = Math.max(barSlot - 2, 1);

    const yToPixel = (value) => padTop + plotHeight - ((value - yMin) / range) * plotHeight;

    // Horizontal gridlines + labels (0%, 25%, 50%, 75%, 100%)
    let gridSvg = "";
    for (let i = 0; i <= 4; i++) {
      const value = yMin + (range * i) / 4;
      const y = yToPixel(value);
      gridSvg += `<line class="me-axis-line" x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" />`;
      gridSvg += `<text class="me-axis-label" x="${padLeft - 6}" y="${y + 3}" text-anchor="end">${formatNumber(value)}</text>`;
    }

    // Bars
    let barsSvg = "";
    data.forEach((entry, index) => {
      const x = padLeft + index * barSlot + (barSlot - barWidth) / 2;
      const y = yToPixel(entry.value);
      const barHeight = padTop + plotHeight - y;
      barsSvg += `<rect class="me-bar" data-index="${index}" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barHeight, 0)}" rx="2" />`;
    });

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
        tooltip.textContent = `${entry.label} : ${formatNumber(entry.value)} ${this._config.unit}`;
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
