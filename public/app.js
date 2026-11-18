const parkingView = document.querySelector("#parking-view");
const backstageView = document.querySelector("#backstage-view");
const parkingTab = document.querySelector("#parking-tab");
const backstageTab = document.querySelector("#backstage-tab");
const connection = document.querySelector("#connection");
const connectionLabel = document.querySelector("#connection-label");
const parkingCount = document.querySelector("#parking-count");
const parkingUpdated = document.querySelector("#parking-updated");
const addButton = document.querySelector("#add-visitor");
const undoButton = document.querySelector("#undo-visitor");
const timeframeSelect = document.querySelector("#timeframe");
const errorMessage = document.querySelector("#error-message");

let visitorState = { visits: [], lastUpdated: null };
let connectionSource;
let errorTimer;

function setView() {
  const backstage = new URLSearchParams(window.location.search).get("view") === "backstage";
  parkingView.hidden = backstage;
  backstageView.hidden = !backstage;
  parkingTab.classList.toggle("active", !backstage);
  backstageTab.classList.toggle("active", backstage);
  parkingTab.setAttribute("aria-current", backstage ? "false" : "page");
  backstageTab.setAttribute("aria-current", backstage ? "page" : "false");
  document.title = `Christmas Farm | ${backstage ? "Backstage" : "Parking"}`;
  if (backstage) {
    renderDashboard();
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  window.clearTimeout(errorTimer);
  errorTimer = window.setTimeout(() => {
    errorMessage.hidden = true;
  }, 5000);
}

function setConnection(connected) {
  connection.classList.toggle("connected", connected);
  connection.classList.toggle("disconnected", !connected);
  connectionLabel.textContent = connected ? "Live updates" : "Reconnecting…";
}

async function postAction(action) {
  const button = action === "visitors" ? addButton : undoButton;
  button.disabled = true;
  try {
    const response = await fetch(`/api/${action}`, { method: "POST" });
    if (!response.ok) {
      throw new Error(`The server returned ${response.status}.`);
    }
    visitorState = await response.json();
    render();
  } catch (error) {
    showError(`Could not ${action === "visitors" ? "add the visitor" : "undo the count"}. Check the connection and try again.`);
    console.error("Visitor update failed:", error);
  } finally {
    button.disabled = action === "undo" && visitorState.visits.length === 0;
  }
}

function formatDuration(milliseconds) {
  const minutes = Math.max(0, Math.floor(milliseconds / 60000));
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function selectedWindowHours() {
  return Number(timeframeSelect.value);
}

function renderParking() {
  parkingCount.textContent = visitorState.visits.length.toLocaleString();
  undoButton.disabled = visitorState.visits.length === 0;
  if (!visitorState.lastUpdated) {
    parkingUpdated.textContent = "Waiting for the first update";
  } else {
    parkingUpdated.textContent = `Last refreshed ${new Date(visitorState.lastUpdated).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
}

function svgElement(name, attributes, text) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function renderChart(visits, hours) {
  const svg = document.querySelector("#visitor-chart");
  const width = 720;
  const height = 320;
  const plot = { left: 54, right: 12, top: 16, bottom: 44 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const now = Date.now();
  const start = now - hours * 60 * 60 * 1000;
  const bucketCount = Math.min(hours, 12);
  const bucketSize = (now - start) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, () => 0);

  for (const visit of visits) {
    const time = Date.parse(visit);
    if (time >= start && time <= now) {
      const index = Math.min(bucketCount - 1, Math.floor((time - start) / bucketSize));
      buckets[index] += 1;
    }
  }

  const maxValue = Math.max(1, ...buckets);
  const axisTop = Math.ceil(maxValue / 4) * 4 || 1;
  const points = buckets.map((value, index) => ({
    x: plot.left + (index / Math.max(1, bucketCount - 1)) * plotWidth,
    y: plot.top + plotHeight - (value / axisTop) * plotHeight,
    value,
  }));
  svg.replaceChildren();

  const defs = svgElement("defs", {});
  const gradient = svgElement("linearGradient", { id: "chart-fill", x1: "0", x2: "0", y1: "0", y2: "1" });
  gradient.append(
    svgElement("stop", { offset: "0%", "stop-color": "#4aa778", "stop-opacity": "0.2" }),
    svgElement("stop", { offset: "100%", "stop-color": "#4aa778", "stop-opacity": "0.01" }),
  );
  defs.append(gradient);
  svg.append(defs);

  for (let index = 0; index <= 4; index += 1) {
    const y = plot.top + (plotHeight / 4) * index;
    const value = Math.round(axisTop * (1 - index / 4));
    svg.append(
      svgElement("line", { x1: plot.left, x2: width - plot.right, y1: y, y2: y, class: "chart-grid" }),
      svgElement("text", { x: plot.left - 13, y: y + 4, "text-anchor": "end", class: "chart-label" }, String(value)),
    );
  }
  svg.append(
    svgElement("text", {
      x: 15,
      y: plot.top + plotHeight / 2,
      transform: `rotate(-90 15 ${plot.top + plotHeight / 2})`,
      "text-anchor": "middle",
      class: "chart-label",
    }, "Visitors"),
  );

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = `M ${points[0].x} ${plot.top + plotHeight} L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points[points.length - 1].x} ${plot.top + plotHeight} Z`;
  svg.append(svgElement("path", { d: areaPath, class: "chart-area" }));
  svg.append(svgElement("polyline", { points: linePoints, class: "chart-line" }));
  for (const point of points) {
    svg.append(svgElement("circle", { cx: point.x, cy: point.y, r: 4, class: "chart-point" }));
  }

  const labels = [
    { x: plot.left, y: height - 23, value: new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), anchor: "start" },
    { x: plot.left + plotWidth / 2, y: height - 23, value: new Date(start + (now - start) / 2).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), anchor: "middle" },
    { x: width - plot.right, y: height - 23, value: "Now", anchor: "end" },
  ];
  for (const label of labels) {
    svg.append(svgElement("text", { x: label.x, y: label.y, "text-anchor": label.anchor, class: "chart-label" }, label.value));
  }
  svg.append(svgElement("text", { x: width / 2, y: height - 4, "text-anchor": "middle", class: "chart-label" }, "Time"));
  document.querySelector("#chart-wrap").setAttribute(
    "aria-label",
    `Visitor graph for the last ${hours} hours. ${visits.length} visitors in this interval.`,
  );
}

function renderDashboard() {
  const hours = selectedWindowHours();
  const now = Date.now();
  const start = now - hours * 60 * 60 * 1000;
  const visitsInWindow = visitorState.visits.filter((visit) => Date.parse(visit) >= start && Date.parse(visit) <= now);
  document.querySelector("#chart-subtitle").textContent = `Visitors over the last ${hours} hour${hours === 1 ? "" : "s"}`;
  document.querySelector("#current-load").textContent = visitsInWindow.length.toLocaleString();
  document.querySelector("#last-timeframe").textContent = formatDuration(hours * 60 * 60 * 1000);
  document.querySelector("#last-update").textContent = visitorState.lastUpdated
    ? formatDuration(now - Date.parse(visitorState.lastUpdated))
    : "--:--";
  const elapsedHours = Math.min(hours, Math.max((now - start) / 3600000, 1 / 60));
  const expected = Math.round((visitsInWindow.length / elapsedHours) * hours);
  document.querySelector("#expected-amount").textContent = expected.toLocaleString();
  renderChart(visitsInWindow, hours);
}

function render() {
  renderParking();
  if (!backstageView.hidden) {
    renderDashboard();
  }
}

function connectToUpdates() {
  connectionSource = new EventSource("/api/events");
  connectionSource.onopen = () => setConnection(true);
  connectionSource.onmessage = (event) => {
    try {
      const state = JSON.parse(event.data);
      if (!Array.isArray(state.visits)) {
        throw new Error("The server sent invalid visitor data.");
      }
      visitorState = state;
      setConnection(true);
      render();
    } catch (error) {
      console.error("Could not read live visitor update:", error);
      showError("Received an invalid update from the server. Reconnecting…");
    }
  };
  connectionSource.onerror = () => setConnection(false);
}

window.addEventListener("popstate", setView);
addButton.addEventListener("click", () => postAction("visitors"));
undoButton.addEventListener("click", () => postAction("undo"));
timeframeSelect.addEventListener("change", renderDashboard);
window.addEventListener("resize", () => {
  if (!backstageView.hidden) {
    renderDashboard();
  }
});
window.setInterval(() => {
  if (!backstageView.hidden) {
    renderDashboard();
  }
}, 60000);

setView();
connectToUpdates();
