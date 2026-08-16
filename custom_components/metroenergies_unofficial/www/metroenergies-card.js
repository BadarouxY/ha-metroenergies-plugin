// Custom Lovelace card for the Metroenergies (Unofficial) integration.
// Plain web component (no build step, no external dependency): reads the
// `history` attribute ([{date, conso}, ...]) of a metroenergies sensor and
// draws a simple SVG bar chart.

class MetroenergiesCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) {
      throw new Error("Vous devez définir une entité (entity) dans la configuration de la carte.");
    }
    this._config = {
      days: 30,
      title: "Consommation Metroenergies",
      unit: "kWh",
      ...config,
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 4;
  }

  static getStubConfig() {
    return { entity: "sensor.metroenergies_unofficial_consommation" };
  }

  _render() {
    if (!this._config || !this._hass) {
      return;
    }

    if (!this._elements) {
      this.innerHTML = `
        <ha-card>
          <div class="me-content" style="padding: 16px;">
            <div class="me-header" style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
              <span class="me-title" style="font-size:1.1em; font-weight:500; color: var(--primary-text-color);"></span>
              <span class="me-latest" style="font-size:1.4em; font-weight:600; color: var(--primary-color);"></span>
            </div>
            <div class="me-chart"></div>
          </div>
        </ha-card>
      `;
      this._elements = {
        chart: this.querySelector(".me-chart"),
        title: this.querySelector(".me-title"),
        latest: this.querySelector(".me-latest"),
      };
    }

    const { chart, title, latest } = this._elements;
    title.textContent = this._config.title;

    const stateObj = this._hass.states[this._config.entity];
    if (!stateObj) {
      latest.textContent = "";
      chart.innerHTML = `<div style="color: var(--error-color);">Entité ${this._config.entity} introuvable</div>`;
      return;
    }

    latest.textContent =
      stateObj.state !== "unknown" && stateObj.state !== "unavailable"
        ? `${Number(stateObj.state).toFixed(1)} ${this._config.unit}`
        : "";

    const history = (stateObj.attributes.history || []).slice(-this._config.days);
    if (history.length === 0) {
      chart.innerHTML = `<div style="color: var(--secondary-text-color);">Pas encore de données</div>`;
      return;
    }

    chart.innerHTML = this._buildChart(history);
  }

  _buildChart(history) {
    const width = 600;
    const height = 180;
    const padding = 24;
    const max = Math.max(...history.map((entry) => entry.conso), 1);
    const barWidth = (width - padding * 2) / history.length;

    const bars = history
      .map((entry, index) => {
        const barHeight = (entry.conso / max) * (height - padding * 2);
        const x = padding + index * barWidth;
        const y = height - padding - barHeight;
        const w = Math.max(barWidth - 2, 1);
        return `<rect x="${x + 1}" y="${y}" width="${w}" height="${barHeight}" rx="2" fill="var(--primary-color)"><title>${entry.date} : ${entry.conso} kWh</title></rect>`;
      })
      .join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;">
        ${bars}
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="var(--divider-color)" />
      </svg>
    `;
  }
}

customElements.define("metroenergies-card", MetroenergiesCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "metroenergies-card",
  name: "Metroenergies Card",
  description: "Graphique de consommation Metroenergies (non officiel)",
});
