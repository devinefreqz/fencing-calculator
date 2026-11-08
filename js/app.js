import { initCalculators, showCalculator } from "./calculators-ui.js";
import { createQuotes } from "./quotes-ui.js";

const quotesRoot = document.getElementById("quotes-root");
const calcRoot = document.getElementById("calculators-root");
const skip = document.querySelector(".skip-link");
const quotesNav = document.getElementById("nav-quotes");
const calcNav = document.getElementById("nav-calculators");

const quotes = createQuotes(quotesRoot, {
  status(message, isError) {
    const live = document.getElementById("status-live");
    live.textContent = message || "";
    live.classList.toggle("is-error", !!isError);
  },
});

initCalculators();

function route() {
  const hash = location.hash || "#/quotes";
  const calc = hash.startsWith("#/calc");
  calcRoot.hidden = !calc;
  quotesRoot.hidden = calc;
  document.body.classList.toggle("is-calc", calc);
  quotesNav.classList.toggle("is-active", !calc);
  calcNav.classList.toggle("is-active", calc);
  if (!calc) quotesNav.setAttribute("aria-current", "page");
  else quotesNav.removeAttribute("aria-current");
  if (calc) calcNav.setAttribute("aria-current", "page");
  else calcNav.removeAttribute("aria-current");
  if (skip) skip.setAttribute("href", calc ? "#calc-main" : "#quotes-root");
  if (calc) showCalculator((hash.split("/")[2] || "stepdown").split("?")[0]);
  else quotes.show(hash);
}

quotesNav.addEventListener("click", () => {
  location.hash = "#/quotes";
});
calcNav.addEventListener("click", () => {
  location.hash = "#/calc/stepdown";
});
window.addEventListener("hashchange", route);
if (!location.hash) location.hash = "#/quotes";
else route();
