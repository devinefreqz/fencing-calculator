export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "text") node.textContent = String(value);
    else if (key === "dataset" && value && typeof value === "object") {
      for (const [name, item] of Object.entries(value)) node.dataset[name] = String(item);
    } else if (key === "value" && "value" in node) node.value = value == null ? "" : String(value);
    else if (key === "checked") node.checked = !!value;
    else if (key === "hidden") node.hidden = !!value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  node.replaceChildren();
}

export function field(label, control, hint) {
  const wrap = el("div", { class: "field" });
  if (label) {
    const lab = el("label", { text: label });
    if (control.id) lab.htmlFor = control.id;
    wrap.append(lab);
  }
  wrap.append(control);
  if (hint) wrap.append(el("p", { class: "hint", text: hint }));
  return wrap;
}

export function numberInput(attrs) {
  return el("input", {
    type: "number",
    inputmode: attrs.inputmode || "decimal",
    min: attrs.min,
    step: attrs.step || "any",
    value: attrs.value == null ? "" : String(attrs.value),
    placeholder: attrs.placeholder || "",
    autocomplete: "off",
    id: attrs.id,
    "data-testid": attrs.testid,
    "data-run-id": attrs.runId,
  });
}

export function unitWrap(input, unit) {
  return el("div", { class: "input-with-unit" }, [input, el("span", { class: "unit-suffix", text: unit })]);
}
