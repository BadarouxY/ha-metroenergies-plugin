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
  day: { label: "Jour", aggregate: aggregateByDay, defaultCount: 30 },
  month: { label: "Mois", aggregate: aggregateByMonth, defaultCount: 12 },
  year: { label: "Année", aggregate: aggregateByYear, defaultCount: 5 },
};

class MetroenergiesCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) {
      throw new Error("Vous devez définir une entité (entity) dans la configuration de la carte.");
    }
    this._config = {
      title: "Consommation",
      unit: "kWh",
      default_period: "day",
      days: PERIODS.day.defaultCount,
      months: PERIODS.month.defaultCount,
      years: PERIODS.year.defaultCount,
      show_period_selector: true,
      ...config,
    };
    this._period = this._config.default_period in PERIODS ? this._config.default_period : "day";
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

  _periodCount(period) {
    if (period === "day") return this._config.days;
    if (period === "month") return this._config.months;
    return this._config.years;
  }

  _buildSkeleton() {
    this.innerHTML = `
      <ha-card>
        <style>
          .me-content { padding: 16px; }
          .me-header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap; }
          .me-title-block { display:flex; flex-direction:column; }
          .me-title { font-size:1.1em; font-weight:500; color: var(--primary-text-color); }
          .me-latest { font-size:1.4em; font-weight:600; color: var(--primary-color); }
          .me-periods { display:flex; gap:4px; }
          .me-period-btn {
            border: none; cursor: pointer; padding: 4px 10px; border-radius: 12px;
            font-size: 0.85em; background: var(--secondary-background-color, #eee);
            color: var(--secondary-text-color);
          }
          .me-period-btn.active { background: var(--primary-color); color: var(--text-primary-color, #fff); }
          .me-chart-wrap { position: relative; }
          .me-bar { fill: var(--primary-color); cursor: pointer; }
          .me-bar:hover { fill: var(--accent-color, var(--primary-color)); opacity: 0.85; }
          .me-axis-line { stroke: var(--divider-color); stroke-width: 1; }
          .me-axis-label { fill: var(--secondary-text-color); font-size: 9px; }
          .me-tooltip {
            position: absolute; pointer-events: none; padding: 4px 8px; border-radius: 4px;
            background: var(--card-background-color, #fff); border: 1px solid var(--divider-color);
            color: var(--primary-text-color); font-size: 0.8em; transform: translate(-50%, -110%);
            white-space: nowrap; box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0,0,0,0.2));
            display: none; z-index: 1;
          }
          .me-empty { color: var(--secondary-text-color); padding: 24px 0; text-align: center; }
        </style>
        <div class="me-content">
          <div class="me-header">
            <div class="me-title-block">
              <span class="me-title"></span>
              <span class="me-latest"></span>
            </div>
            <div class="me-periods"></div>
          </div>
          <div class="me-chart-wrap">
            <div class="me-tooltip"></div>
            <div class="me-chart"></div>
          </div>
        </div>
      </ha-card>
    `;
    this._els = {
      title: this.querySelector(".me-title"),
      latest: this.querySelector(".me-latest"),
      periods: this.querySelector(".me-periods"),
      chart: this.querySelector(".me-chart"),
      tooltip: this.querySelector(".me-tooltip"),
      chartWrap: this.querySelector(".me-chart-wrap"),
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
  }

  _render() {
    if (!this._config || !this._hass) {
      return;
    }
    if (!this._els) {
      this._buildSkeleton();
    }

    const { title, latest, periods, chart } = this._els;
    const stateObj = this._hass.states[this._config.entity];

    title.textContent = this._config.title;

    if (!stateObj) {
      latest.textContent = "";
      chart.innerHTML = `<div class="me-empty">Entité ${this._config.entity} introuvable</div>`;
      return;
    }

    for (const btn of periods.querySelectorAll(".me-period-btn")) {
      btn.classList.toggle("active", btn.dataset.period === this._period);
    }

    const history = stateObj.attributes.history || [];
    const periodDef = PERIODS[this._period];
    const data = periodDef.aggregate(history, this._periodCount(this._period));

    if (data.length === 0) {
      latest.textContent = "";
      chart.innerHTML = `<div class="me-empty">Pas encore de données</div>`;
      return;
    }

    const latestValue = data[data.length - 1].value;
    latest.textContent = `${formatNumber(latestValue)} ${this._config.unit}`;

    chart.innerHTML = this._buildChart(data);
    this._attachInteractions(data);
  }

  _buildChart(data) {
    const width = 600;
    const height = 220;
    const padLeft = 42;
    const padRight = 8;
    const padTop = 12;
    const padBottom = 26;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    const dataMax = Math.max(...data.map((d) => d.value), 0);
    const yMax = this._config.y_max ?? (dataMax > 0 ? dataMax * 1.15 : 1);
    const yMin = this._config.y_min ?? 0;
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
